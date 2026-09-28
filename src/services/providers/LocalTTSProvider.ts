import { ITTSProvider, TTSOptions, TTSResult, MultiSpeakerTTSResult } from './types';
import { ScriptSegment, VoiceProfile } from '../../types';
import { VOICES } from '../../data/voices';

export class LocalTTSUnavailableError extends Error {
  public instructions: string[];
  public installCommand: string;

  constructor(message: string) {
    super(message);
    this.name = 'LocalTTSUnavailableError';
    this.installCommand = 'python backend/download_models.py';
    this.instructions = [
      'یک موتور تبدیل متن به گفتار آفلاین سازگار با زبان فارسی در سیستم یافت نشد.',
      'برای راه‌اندازی حالت کاملاً آفلاین:',
      '۱. فایل install.bat را در ویندوز (یا ./install.sh در لینوکس/مک) اجرا کنید.',
      '۲. یا با دستور زیر مدل‌های عصبی فارسی Piper را دانلود نمایید:',
      '   python backend/download_models.py',
      'مدل‌های پیشنهادی: fa_IR-amir-medium.onnx و fa_IR-gyant-medium.onnx',
    ];
  }
}

export class LocalTTSProvider implements ITTSProvider {
  name = 'Local Offline TTS Engine';
  isOffline = true;

  private serverLocalEngineAvailable: boolean | null = null;
  private serverEngineName = 'Checking...';

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch('/api/local-tts/status');
      if (res.ok) {
        const data = await res.json();
        this.serverLocalEngineAvailable = Boolean(data.available);
        this.serverEngineName = data.engineName || 'Local Engine';
        if (data.available) return true;
      }
    } catch {
      // Server check failed
    }

    // Check browser SpeechSynthesis for Persian voice
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const voices = window.speechSynthesis.getVoices();
      const hasFa = voices.some(
        (v) =>
          v.lang.toLowerCase().includes('fa') ||
          v.name.toLowerCase().includes('persian') ||
          v.name.toLowerCase().includes('farsi') ||
          v.name.toLowerCase().includes('dilara') ||
          v.name.toLowerCase().includes('farid')
      );
      if (hasFa) {
        this.serverLocalEngineAvailable = true;
        this.serverEngineName = 'Browser Native Persian Engine (fa-IR)';
        return true;
      }
    }

    this.serverLocalEngineAvailable = false;
    return false;
  }

  getEngineName(): string {
    return this.serverEngineName;
  }

  async synthesizeSegment(options: TTSOptions): Promise<TTSResult> {
    const { text, voiceId, language } = options;

    // 1. Try Local Server TTS (Piper ONNX / eSpeak-ng / Python backend)
    try {
      const res = await fetch('/api/local-tts/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceId,
          language: language || 'fa',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          const byteCharacters = atob(data.audioBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: data.mimeType || 'audio/wav' });
          const audioUrl = URL.createObjectURL(blob);

          return {
            audioUrl,
            audioBase64: data.audioBase64,
            durationSec: data.durationSec || 3.0,
            provider: data.engineName || 'Local Piper Engine',
            isOffline: true,
          };
        }
      }
    } catch (e) {
      console.warn('[LocalTTSProvider] Local server route failed:', e);
    }

    // 2. Try browser SpeechSynthesis with native Persian voice
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const sysVoices = window.speechSynthesis.getVoices();
      const persianVoice = sysVoices.find(
        (v) =>
          v.lang.toLowerCase().includes('fa') ||
          v.name.toLowerCase().includes('persian') ||
          v.name.toLowerCase().includes('farsi') ||
          v.name.toLowerCase().includes('dilara') ||
          v.name.toLowerCase().includes('farid')
      );

      if (persianVoice) {
        // Play directly via SpeechSynthesis for preview
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = persianVoice;
        utterance.lang = 'fa-IR';
        window.speechSynthesis.speak(utterance);

        return {
          audioUrl: '',
          durationSec: Math.max(1.5, text.length * 0.08),
          provider: `Native ${persianVoice.name}`,
          isOffline: true,
        };
      }
    }

    // 3. Fallback Priority Rule #4:
    // If no valid Persian-capable local TTS is available:
    // - DO NOT publish audio
    // - DO NOT generate fake audio
    // - Report clearly that a compatible local TTS model is unavailable
    throw new LocalTTSUnavailableError(
      'هیچ موتور تبدیل متن به گفتار آفلاین فارسی (مانند Piper TTS) در سیستم شما نصب نشده است.'
    );
  }

  async synthesizeMultiSpeaker(
    segments: ScriptSegment[],
    voiceIds: string[]
  ): Promise<MultiSpeakerTTSResult> {
    try {
      const res = await fetch('/api/local-tts/synthesize-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments,
          selectedVoiceIds: voiceIds,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          const byteCharacters = atob(data.audioBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: data.mimeType || 'audio/wav' });
          const audioUrl = URL.createObjectURL(blob);

          return {
            audioUrl,
            audioBase64: data.audioBase64,
            durationSec: data.durationSec || 60,
            segments: data.segments || segments,
            provider: data.engineName || 'Local Offline Audio Master',
            isOffline: true,
          };
        }
      }
    } catch (e) {
      console.warn('[LocalTTSProvider] Multi-speaker local synthesis failed:', e);
    }

    // Do NOT generate fake audio. Throw LocalTTSUnavailableError
    throw new LocalTTSUnavailableError(
      'برای تولید پادکست در حالت آفلاین، موتور صوتی محلی (Piper TTS با مدل فارسی) الزامی است.'
    );
  }
}
