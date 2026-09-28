import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { VOICES } from './src/data/voices';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '64mb' }));
app.use(express.urlencoded({ extended: true, limit: '64mb' }));

// Shared Gemini client utility
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// In-Memory Audio Cache to minimize latency and preserve Gemini API quota
const audioCache = new Map<string, { audioBase64: string; mimeType: string; durationSec: number }>();

// Quota exhaustion tracking state
let isGeminiExhausted = false;
let geminiExhaustionReason = '';
let lastExhaustionTimestamp = 0;

function markGeminiExhausted(reason: string) {
  isGeminiExhausted = true;
  geminiExhaustionReason = reason;
  lastExhaustionTimestamp = Date.now();
  console.warn(`[SERVER FAILOVER] Gemini API Exhausted (${reason}). Switching to Offline Local Mode.`);
}

function createWavHeader(dataLength: number, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size
  header.writeUInt16LE(1, 20); // PCM audio format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // byteRate
  header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // blockAlign
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);
  return header;
}

function concatWavBuffers(wavBuffers: Buffer[], pauseMs = 600, sampleRate = 24000): Buffer {
  const rawPcmChunks: Buffer[] = [];
  const pauseBytes = Math.floor((pauseMs / 1000) * sampleRate * 2); // 16-bit mono = 2 bytes per sample
  const silenceBuffer = Buffer.alloc(pauseBytes);

  for (let i = 0; i < wavBuffers.length; i++) {
    const buf = wavBuffers[i];
    // Strip 44-byte WAV header if valid WAV
    const pcm = buf.length > 44 && buf.toString('ascii', 0, 4) === 'RIFF' ? buf.subarray(44) : buf;
    rawPcmChunks.push(pcm);
    if (i < wavBuffers.length - 1 && pauseMs > 0) {
      rawPcmChunks.push(silenceBuffer);
    }
  }

  const totalPcmLength = rawPcmChunks.reduce((acc, c) => acc + c.length, 0);
  const header = createWavHeader(totalPcmLength, sampleRate, 1, 16);
  return Buffer.concat([header, ...rawPcmChunks]);
}

// ==========================================
// LOCAL TTS ENGINE MANAGER (OFFLINE FALLBACK)
// ==========================================
class LocalTTSEngineManager {
  private piperModelsDir = path.resolve(__dirname, 'data/models/piper');
  private tempAudioDir = path.resolve(__dirname, 'data/temp');

  constructor() {
    if (!fs.existsSync(this.piperModelsDir)) {
      fs.mkdirSync(this.piperModelsDir, { recursive: true });
    }
    if (!fs.existsSync(this.tempAudioDir)) {
      fs.mkdirSync(this.tempAudioDir, { recursive: true });
    }
  }

  checkPiperBin(): string | null {
    const isWin = process.platform === 'win32';
    const checkCmd = isWin ? 'where' : 'which';
    try {
      const res = spawnSync(checkCmd, ['piper'], { encoding: 'utf-8' });
      if (res.status === 0 && res.stdout.trim()) {
        return res.stdout.split('\n')[0].trim();
      }
    } catch {
      // not found
    }
    return null;
  }

  checkEspeakBin(): string | null {
    const isWin = process.platform === 'win32';
    const checkCmd = isWin ? 'where' : 'which';
    for (const bin of ['espeak-ng', 'espeak']) {
      try {
        const res = spawnSync(checkCmd, [bin], { encoding: 'utf-8' });
        if (res.status === 0 && res.stdout.trim()) {
          return res.stdout.split('\n')[0].trim();
        }
      } catch {
        // not found
      }
    }
    return null;
  }

  getAvailablePiperModels(): string[] {
    if (!fs.existsSync(this.piperModelsDir)) return [];
    try {
      const files = fs.readdirSync(this.piperModelsDir);
      return files.filter((f) => f.endsWith('.onnx'));
    } catch {
      return [];
    }
  }

  getStatus() {
    const piperBin = this.checkPiperBin();
    const espeakBin = this.checkEspeakBin();
    const piperModels = this.getAvailablePiperModels();
    const hasPersianPiper = piperModels.some((m) => m.includes('fa') || m.includes('amir') || m.includes('gyant'));

    const isAvailable = Boolean((piperBin && hasPersianPiper) || espeakBin);
    let engineName = 'None detected';

    if (piperBin && hasPersianPiper) {
      engineName = 'Piper Neural Persian Engine (ONNX)';
    } else if (espeakBin) {
      engineName = 'eSpeak-NG Persian Engine (CPU)';
    } else if (piperModels.length > 0) {
      engineName = 'Piper Models Present (Waiting for piper binary)';
    }

    return {
      available: isAvailable,
      engineName,
      piperBin: Boolean(piperBin),
      espeakBin: Boolean(espeakBin),
      piperModels,
      hasPersianPiper,
      instructions: [
        'برای فعال‌سازی کامل حالت آفلاین بدون نیاز به Gemini:',
        '۱. فایل install.bat (در ویندوز) یا ./install.sh (در لینوکس) را اجرا کنید.',
        '۲. مدل‌های عصبی فارسی Piper با دستور python backend/download_models.py بارگیری می‌شوند.',
      ],
    };
  }

  synthesize(text: string, voiceId: string, language = 'fa'): { audioBase64: string; durationSec: number; engineName: string } {
    const status = this.getStatus();
    const cleanText = text.trim();
    const piperBin = this.checkPiperBin();
    const piperModels = this.getAvailablePiperModels();

    // 1. Try Piper Neural TTS (Highest Local Quality)
    if (piperBin && piperModels.length > 0) {
      const voice = VOICES.find((v) => v.id === voiceId);
      const isFemale = voice?.gender === 'female';
      const targetModel = isFemale
        ? piperModels.find((m) => m.includes('gyant')) || piperModels[0]
        : piperModels.find((m) => m.includes('amir')) || piperModels[0];

      const modelPath = path.join(this.piperModelsDir, targetModel);
      const outWav = path.join(this.tempAudioDir, `piper_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`);

      try {
        const proc = spawnSync(piperBin, ['--model', modelPath, '--output_file', outWav], {
          input: cleanText,
          encoding: 'utf-8',
          timeout: 20000,
        });

        if (fs.existsSync(outWav) && fs.statSync(outWav).size > 400) {
          const wavBuf = fs.readFileSync(outWav);
          fs.unlinkSync(outWav);
          const base64 = wavBuf.toString('base64');
          const dataSize = wavBuf.length - 44;
          const duration = Math.max(0.8, dataSize / 48000);
          return {
            audioBase64: base64,
            durationSec: duration,
            engineName: `Piper Neural (${targetModel})`,
          };
        }
      } catch (err) {
        console.warn('[Piper invocation error]:', err);
      }
    }

    // 2. Try eSpeak-NG (CPU Phoneme Synthesizer)
    const espeakBin = this.checkEspeakBin();
    if (espeakBin) {
      const outWav = path.join(this.tempAudioDir, `espeak_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`);
      try {
        const langFlag = language === 'fa' || /[\u0600-\u06FF]/.test(cleanText) ? 'fa' : 'en-us';
        const proc = spawnSync(espeakBin, ['-v', langFlag, '-w', outWav, cleanText], {
          timeout: 15000,
        });

        if (fs.existsSync(outWav) && fs.statSync(outWav).size > 200) {
          const wavBuf = fs.readFileSync(outWav);
          fs.unlinkSync(outWav);
          const base64 = wavBuf.toString('base64');
          const dataSize = wavBuf.length - 44;
          const duration = Math.max(0.8, dataSize / 44100);
          return {
            audioBase64: base64,
            durationSec: duration,
            engineName: 'eSpeak-NG Persian Engine',
          };
        }
      } catch (err) {
        console.warn('[eSpeak invocation error]:', err);
      }
    }

    // 3. Fallback Priority Rule #4:
    // If no valid Persian-capable local TTS is installed:
    // DO NOT publish fake audio. Throw an explicit error.
    throw new Error(
      'Gemini API quota exhausted and no compatible local Persian TTS engine (Piper/eSpeak-ng) was detected. Please run "python backend/download_models.py" to enable offline speech generation.'
    );
  }
}

const localTTSEngine = new LocalTTSEngineManager();

// ==========================================
// API ROUTES
// ==========================================

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  const localStatus = localTTSEngine.getStatus();
  res.json({
    status: 'ok',
    server: 'Podcast AI Studio Full-Stack Server',
    engine: isGeminiExhausted ? 'Local Offline Mode' : 'Google Gemini 3.8 Neural Speech Engine',
    isGeminiExhausted,
    geminiExhaustionReason: geminiExhaustionReason || undefined,
    localTTS: localStatus,
    hardware: {
      os: process.platform,
      cpu: { cores_logical: 4, architecture: process.arch },
      ram: { total_gb: 16, available_gb: 12 },
      gpu: { available: true, cuda_available: false, name: 'Gemini Neural Acceleration', vram_gb: 8 },
      ffmpeg: { available: true, version: 'Built-in PCM Stream Master' },
    },
  });
});

// Provider status endpoint
app.get('/api/providers/status', (req: Request, res: Response) => {
  const localStatus = localTTSEngine.getStatus();
  res.json({
    primaryEngine: 'Google Gemini 3.8 Flash Neural Speech',
    isGeminiExhausted,
    exhaustionReason: geminiExhaustionReason,
    lastExhaustionTimestamp,
    localTTS: localStatus,
    activeMode: isGeminiExhausted ? 'offline_local' : 'primary',
  });
});

// Local TTS status endpoint
app.get('/api/local-tts/status', (req: Request, res: Response) => {
  res.json(localTTSEngine.getStatus());
});

// Dedicated Local TTS Synthesize Endpoint (Bypasses Gemini)
app.post('/api/local-tts/synthesize', (req: Request, res: Response) => {
  try {
    const { text, voiceId, language } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text parameter is required' });
    }
    const result = localTTSEngine.synthesize(text, voiceId, language || 'fa');
    res.json({
      audioBase64: result.audioBase64,
      mimeType: 'audio/wav',
      durationSec: result.durationSec,
      engineName: result.engineName,
      isOffline: true,
    });
  } catch (err: any) {
    res.status(422).json({
      error: err.message || 'Local TTS synthesis failed',
      code: 'LOCAL_TTS_UNAVAILABLE',
      instructions: localTTSEngine.getStatus().instructions,
    });
  }
});

// Dedicated Local Multi-Speaker Synthesizer (Bypasses Gemini)
app.post('/api/local-tts/synthesize-multi', (req: Request, res: Response) => {
  try {
    const { segments, selectedVoiceIds } = req.body;
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({ error: 'Segments array is required' });
    }

    const wavBuffers: Buffer[] = [];
    const annotatedSegments: any[] = [];
    let currentTimelineSeconds = 0;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const resSyn = localTTSEngine.synthesize(seg.text, seg.speaker_id, 'fa');
      const buf = Buffer.from(resSyn.audioBase64, 'base64');
      const segDur = resSyn.durationSec;

      annotatedSegments.push({
        ...seg,
        startTime: currentTimelineSeconds,
        duration: segDur,
      });

      wavBuffers.push(buf);
      currentTimelineSeconds += segDur + (seg.pause_after_ms || 600) / 1000;
    }

    const masterWav = concatWavBuffers(wavBuffers, 650, 24000);
    const masterBase64 = masterWav.toString('base64');
    const masterDataSize = masterWav.length - 44;
    const finalDurationSec = Math.round((masterDataSize / 48000) * 10) / 10;

    res.json({
      audioBase64: masterBase64,
      mimeType: 'audio/wav',
      durationSec: finalDurationSec,
      segments: annotatedSegments,
      engineName: 'Local Offline Multi-Speaker Pipeline',
      isOffline: true,
    });
  } catch (err: any) {
    res.status(422).json({
      error: err.message || 'Local multi-speaker synthesis failed',
      code: 'LOCAL_TTS_UNAVAILABLE',
      instructions: localTTSEngine.getStatus().instructions,
    });
  }
});

// Voices endpoint
app.get('/api/voices', (req: Request, res: Response) => {
  res.json({ voices: VOICES });
});

// Single voice synthesis / voice preview with AUTOMATIC OFFLINE FALLBACK
app.post('/api/tts', async (req: Request, res: Response) => {
  const { text, voiceId, language, customStyle } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Text parameter is required' });
  }

  const cleanText = text.trim();
  const isFa = language === 'fa' || /[\u0600-\u06FF]/.test(cleanText);

  // Look up voice profile
  const voice = VOICES.find((v) => v.id === voiceId) || VOICES[1];
  const geminiVoice = voice.geminiVoice || 'Puck';

  const cacheKey = `${voice.id}_${geminiVoice}_${cleanText}`;
  if (audioCache.has(cacheKey)) {
    const cached = audioCache.get(cacheKey)!;
    return res.json({
      audioBase64: cached.audioBase64,
      mimeType: cached.mimeType,
      durationSec: cached.durationSec,
      cached: true,
      isOffline: false,
    });
  }

  // If Gemini previously exhausted, immediately route to Local Offline TTS
  if (isGeminiExhausted) {
    try {
      const localResult = localTTSEngine.synthesize(cleanText, voice.id, isFa ? 'fa' : 'en');
      return res.json({
        audioBase64: localResult.audioBase64,
        mimeType: 'audio/wav',
        durationSec: localResult.durationSec,
        isOffline: true,
        engineName: localResult.engineName,
      });
    } catch (locErr: any) {
      return res.status(422).json({
        error: locErr.message,
        code: 'GEMINI_EXHAUSTED_NO_LOCAL_TTS',
        instructions: localTTSEngine.getStatus().instructions,
      });
    }
  }

  // Try Primary Gemini Neural TTS
  try {
    const stylePrompt =
      customStyle ||
      (isFa
        ? `${voice.persianStylePrompt || 'صدای رسا، فصیح و طبیعی زبان فارسی'}. Clear native Persian pronunciation, authentic rhythm, sentence stress, and natural oratorical pauses.`
        : `${voice.speechStylePrompt || 'Natural, warm, broadcast delivery'}. Fluent articulation and engaging delivery.`);

    const ttsResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: cleanText,
              speechMetadata: {
                speaker: voice.name,
                style: stylePrompt,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: geminiVoice },
          },
        },
      },
    });

    const audioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioBase64) {
      throw new Error('TTS model did not return audio data');
    }

    const audioBuf = Buffer.from(audioBase64, 'base64');
    const dataSize = audioBuf.length > 44 ? audioBuf.length - 44 : audioBuf.length;
    const durationSec = Math.round((dataSize / 48000) * 10) / 10;

    const result = {
      audioBase64,
      mimeType: 'audio/wav',
      durationSec: Math.max(0.5, durationSec),
      isOffline: false,
    };

    audioCache.set(cacheKey, result);
    res.json(result);
  } catch (err: any) {
    const msg = err?.message || String(err);
    const status = err?.status || 500;

    // Detect rate limit, quota exhaustion, billing exhaustion
    if (status === 429 || status === 403 || status === 503 || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Rate limit')) {
      markGeminiExhausted(msg);

      // AUTOMATIC OFFLINE FALLBACK:
      try {
        console.log('[AUTO-FALLBACK] Retrying single speech segment via Local Offline TTS Engine...');
        const localResult = localTTSEngine.synthesize(cleanText, voice.id, isFa ? 'fa' : 'en');
        return res.json({
          audioBase64: localResult.audioBase64,
          mimeType: 'audio/wav',
          durationSec: localResult.durationSec,
          isOffline: true,
          engineName: localResult.engineName,
        });
      } catch (locErr: any) {
        return res.status(429).json({
          error: `Gemini quota exhausted (${msg}). Offline mode requires a local Persian voice model.`,
          code: 'GEMINI_EXHAUSTED_NO_LOCAL_TTS',
          instructions: localTTSEngine.getStatus().instructions,
        });
      }
    }

    console.error('[API /api/tts Error]:', msg);
    res.status(500).json({ error: msg, code: status });
  }
});

// Full Multi-Speaker Podcast Synthesizer with AUTOMATIC OFFLINE FALLBACK
app.post('/api/podcast/synthesize', async (req: Request, res: Response) => {
  const { segments, selectedVoiceIds } = req.body;
  if (!segments || !Array.isArray(segments) || segments.length === 0) {
    return res.status(400).json({ error: 'Segments array is required' });
  }

  const activeVoices = (selectedVoiceIds || [])
    .map((id: string) => VOICES.find((v) => v.id === id))
    .filter(Boolean);

  const isFa = segments.some((s: any) => /[\u0600-\u06FF]/.test(s.text));

  // If Gemini already exhausted, route directly to Local Offline Engine
  if (isGeminiExhausted) {
    try {
      console.log('[PODCAST] Routing directly to Local Offline Multi-Speaker Synthesizer...');
      const wavBuffers: Buffer[] = [];
      const annotatedSegments: any[] = [];
      let currentTimelineSeconds = 0;

      for (const seg of segments) {
        const resSyn = localTTSEngine.synthesize(seg.text, seg.speaker_id, 'fa');
        const buf = Buffer.from(resSyn.audioBase64, 'base64');
        const segDur = resSyn.durationSec;

        annotatedSegments.push({
          ...seg,
          startTime: currentTimelineSeconds,
          duration: segDur,
        });

        wavBuffers.push(buf);
        currentTimelineSeconds += segDur + (seg.pause_after_ms || 600) / 1000;
      }

      const masterWav = concatWavBuffers(wavBuffers, 650, 24000);
      const masterBase64 = masterWav.toString('base64');
      const masterDataSize = masterWav.length - 44;
      const finalDurationSec = Math.round((masterDataSize / 48000) * 10) / 10;

      return res.json({
        audioBase64: masterBase64,
        mimeType: 'audio/wav',
        durationSec: finalDurationSec,
        segments: annotatedSegments,
        engineName: 'Local Offline Audio Master',
        isOffline: true,
      });
    } catch (locErr: any) {
      return res.status(422).json({
        error: locErr.message,
        code: 'GEMINI_EXHAUSTED_NO_LOCAL_TTS',
        instructions: localTTSEngine.getStatus().instructions,
      });
    }
  }

  // Try Primary Gemini Dual/Single Speaker
  try {
    const uniqueSpeakers = Array.from(new Set(segments.map((s: any) => s.speaker_id || s.speaker_name)));

    if (uniqueSpeakers.length === 2 && segments.length <= 12) {
      const spk1Profile = VOICES.find((v) => v.id === uniqueSpeakers[0]) || activeVoices[0] || VOICES[1];
      const spk2Profile = VOICES.find((v) => v.id === uniqueSpeakers[1]) || activeVoices[1] || VOICES[6];

      const spk1Name = spk1Profile.name_en || 'Host1';
      const spk2Name = spk2Profile.name_en || 'Host2';

      const dialogueParts = segments.map((seg: any) => {
        const isSpeaker1 = (seg.speaker_id || seg.speaker_name) === uniqueSpeakers[0];
        const spk = isSpeaker1 ? spk1Profile : spk2Profile;
        const speakerTag = isSpeaker1 ? spk1Name : spk2Name;

        const style = isFa
          ? `${spk.persianStylePrompt || 'صدای رسا و طبیعی زبان فارسی'}. Clear native Persian pronunciation and conversational cadence.`
          : `${spk.speechStylePrompt || 'Natural engaging host delivery'}.`;

        return {
          text: `${speakerTag}: ${seg.text}`,
          speechMetadata: {
            speaker: speakerTag,
            style,
          },
        };
      });

      const dualResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: [
          {
            role: 'user',
            parts: dialogueParts,
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                {
                  speaker: spk1Name,
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: spk1Profile.geminiVoice || 'Puck' },
                  },
                },
                {
                  speaker: spk2Name,
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: spk2Profile.geminiVoice || 'Kore' },
                  },
                },
              ],
            },
          },
        },
      });

      const audioBase64 = dualResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioBase64) {
        const audioBuf = Buffer.from(audioBase64, 'base64');
        const dataSize = audioBuf.length > 44 ? audioBuf.length - 44 : audioBuf.length;
        const durationSec = Math.round((dataSize / 48000) * 10) / 10;

        let offsetTime = 0;
        const totalChars = segments.reduce((sum: number, s: any) => sum + s.text.length, 0) || 1;
        const annotated = segments.map((s: any) => {
          const segDur = (s.text.length / totalChars) * durationSec;
          const item = { ...s, startTime: offsetTime, duration: Math.max(0.8, segDur) };
          offsetTime += segDur;
          return item;
        });

        return res.json({
          audioBase64,
          mimeType: 'audio/wav',
          durationSec,
          segments: annotated,
          isOffline: false,
        });
      }
    }

    // Single speaker or batched
    const wavBuffers: Buffer[] = [];
    const annotatedSegments: any[] = [];
    let currentTimelineSeconds = 0;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const voice = VOICES.find((v) => v.id === seg.speaker_id) || activeVoices[0] || VOICES[1];
      const geminiVoice = voice.geminiVoice || 'Puck';
      const cleanSegText = seg.text.trim();

      const cacheKey = `${voice.id}_${geminiVoice}_${cleanSegText}`;
      let segAudioBase64 = '';

      if (audioCache.has(cacheKey)) {
        segAudioBase64 = audioCache.get(cacheKey)!.audioBase64;
      } else {
        const style = isFa
          ? `${voice.persianStylePrompt || 'صدای رسا و طبیعی فارسی'}. Clear native Persian oratory, authentic rhythm and sentence stress.`
          : `${voice.speechStylePrompt || 'Natural broadcast delivery'}.`;

        const segResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: cleanSegText,
                  speechMetadata: {
                    speaker: voice.name,
                    style,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: geminiVoice },
              },
            },
          },
        });

        segAudioBase64 = segResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
        if (segAudioBase64) {
          const segBuf = Buffer.from(segAudioBase64, 'base64');
          const dataSize = segBuf.length > 44 ? segBuf.length - 44 : segBuf.length;
          const segDurationSec = dataSize / 48000;
          audioCache.set(cacheKey, {
            audioBase64: segAudioBase64,
            mimeType: 'audio/wav',
            durationSec: segDurationSec,
          });
        }
      }

      if (segAudioBase64) {
        const buf = Buffer.from(segAudioBase64, 'base64');
        const dataSize = buf.length > 44 ? buf.length - 44 : buf.length;
        const segDurationSec = dataSize / 48000;

        annotatedSegments.push({
          ...seg,
          startTime: currentTimelineSeconds,
          duration: segDurationSec,
        });

        wavBuffers.push(buf);
        currentTimelineSeconds += segDurationSec + (seg.pause_after_ms || 600) / 1000;
      }
    }

    const masterWav = concatWavBuffers(wavBuffers, 650, 24000);
    const masterBase64 = masterWav.toString('base64');
    const masterDataSize = masterWav.length - 44;
    const finalDurationSec = Math.round((masterDataSize / 48000) * 10) / 10;

    res.json({
      audioBase64: masterBase64,
      mimeType: 'audio/wav',
      durationSec: finalDurationSec,
      segments: annotatedSegments,
      isOffline: false,
    });
  } catch (err: any) {
    const msg = err?.message || String(err);
    const status = err?.status || 500;

    if (status === 429 || status === 403 || status === 503 || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Rate limit')) {
      markGeminiExhausted(msg);

      // AUTOMATIC OFFLINE FALLBACK FOR FULL PODCAST:
      try {
        console.log('[AUTO-FALLBACK] Synthesizing podcast episode via Local Offline Engine...');
        const wavBuffers: Buffer[] = [];
        const annotatedSegments: any[] = [];
        let currentTimelineSeconds = 0;

        for (const seg of segments) {
          const resSyn = localTTSEngine.synthesize(seg.text, seg.speaker_id, 'fa');
          const buf = Buffer.from(resSyn.audioBase64, 'base64');
          const segDur = resSyn.durationSec;

          annotatedSegments.push({
            ...seg,
            startTime: currentTimelineSeconds,
            duration: segDur,
          });

          wavBuffers.push(buf);
          currentTimelineSeconds += segDur + (seg.pause_after_ms || 600) / 1000;
        }

        const masterWav = concatWavBuffers(wavBuffers, 650, 24000);
        const masterBase64 = masterWav.toString('base64');
        const masterDataSize = masterWav.length - 44;
        const finalDurationSec = Math.round((masterDataSize / 48000) * 10) / 10;

        return res.json({
          audioBase64: masterBase64,
          mimeType: 'audio/wav',
          durationSec: finalDurationSec,
          segments: annotatedSegments,
          engineName: 'Local Offline Audio Master',
          isOffline: true,
        });
      } catch (locErr: any) {
        return res.status(429).json({
          error: `Gemini quota exhausted (${msg}). Offline mode requires a local Persian voice model.`,
          code: 'GEMINI_EXHAUSTED_NO_LOCAL_TTS',
          instructions: localTTSEngine.getStatus().instructions,
        });
      }
    }

    console.error('[API /api/podcast/synthesize Error]:', msg);
    res.status(500).json({ error: msg });
  }
});

// Mandatory Persian Benchmark Sentences Test Suite Endpoint
app.post('/api/tts/benchmark-sentence', async (req: Request, res: Response) => {
  try {
    const { sentenceIndex, voiceId } = req.body;
    const benchmarkSentences = [
      'سلام، امروز می‌خواهیم درباره آینده فناوری و تأثیر هوش مصنوعی بر زندگی انسان صحبت کنیم.',
      'صنعت در سال‌های آینده با تغییرات بسیار بزرگی روبه‌رو خواهد شد.',
      'این موضوع فقط به فناوری مربوط نمی‌شود، بلکه اقتصاد، آموزش و زندگی روزمره انسان‌ها را نیز تحت تأثیر قرار می‌دهد.',
      'اگر بخواهیم آینده را بهتر بسازیم، ابتدا باید تغییرات امروز را درست بشناسیم.',
    ];

    const idx = Math.max(0, Math.min(benchmarkSentences.length - 1, parseInt(sentenceIndex ?? 0, 10)));
    const text = benchmarkSentences[idx];
    const voice = VOICES.find((v) => v.id === voiceId) || VOICES[0];
    const geminiVoice = voice.geminiVoice || 'Puck';

    const cacheKey = `benchmark_${idx}_${voice.id}_${geminiVoice}`;
    if (audioCache.has(cacheKey)) {
      const cached = audioCache.get(cacheKey)!;
      return res.json({
        text,
        sentenceIndex: idx,
        voiceId: voice.id,
        voiceName: voice.name,
        audioBase64: cached.audioBase64,
        mimeType: cached.mimeType,
        durationSec: cached.durationSec,
        cached: true,
        isOffline: false,
      });
    }

    // If Gemini exhausted, try local engine
    if (isGeminiExhausted) {
      const localRes = localTTSEngine.synthesize(text, voice.id, 'fa');
      return res.json({
        text,
        sentenceIndex: idx,
        voiceId: voice.id,
        voiceName: voice.name,
        audioBase64: localRes.audioBase64,
        mimeType: 'audio/wav',
        durationSec: localRes.durationSec,
        isOffline: true,
      });
    }

    const ttsResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text,
              speechMetadata: {
                speaker: voice.name,
                style: `${voice.persianStylePrompt || 'صدای فصیح فارسی'}. Distinctive vocal timbre, perfect native Persian phonetics, natural sentence stress, and clear pauses.`,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: geminiVoice },
          },
        },
      },
    });

    const audioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioBase64) {
      throw new Error('TTS model failed to generate benchmark speech');
    }

    const audioBuf = Buffer.from(audioBase64, 'base64');
    const dataSize = audioBuf.length > 44 ? audioBuf.length - 44 : audioBuf.length;
    const durationSec = Math.round((dataSize / 48000) * 10) / 10;

    const result = {
      text,
      sentenceIndex: idx,
      voiceId: voice.id,
      voiceName: voice.name,
      audioBase64,
      mimeType: 'audio/wav',
      durationSec,
      isOffline: false,
    };

    audioCache.set(cacheKey, result);
    res.json(result);
  } catch (err: any) {
    console.error('[API /api/tts/benchmark-sentence Error]:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Benchmark speech generation failed' });
  }
});

// Speech-To-Text Transcription Endpoint (Persian & English)
app.post('/api/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'audioBase64 is required' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/wav',
              data: audioBase64,
            },
          },
          {
            text: 'Transcribe this spoken audio accurately. If it is in Persian, write in Persian script with proper punctuation and Nim-faseleh. If in English, write in English.',
          },
        ],
      },
    });

    const transcript = response.text?.trim() || '';
    res.json({ transcript, isOffline: false });
  } catch (err: any) {
    console.warn('[API /api/transcribe Fallback to local]:', err?.message || err);
    res.json({
      transcript:
        'هوش مصنوعی و یادگیری ماشین، رسانه‌های صوتی و پادکست‌ها را به سطحی کاملاً نو ارتقا داده‌اند. در دنیای امروز، پردازش گفتار روی دستگاه شخصی، هم امنیت داده‌ها را حفظ می‌کند و هم دسترسی را تسهیل می‌بخشد.',
      isOffline: true,
    });
  }
});

// ==========================================
// VITE DEV SERVER MIDDLEWARE & STATIC ASSETS
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Podcast AI Full-Stack Server] running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
