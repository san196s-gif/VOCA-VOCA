import { ScriptSegment, VoiceProfile } from '../types';
import { VOICES } from '../data/voices';
import { PersianSpeechNormalizer } from './persianNormalizer';

/**
 * Browser-Side Audio Engine & Native Persian Oratory Dispatcher
 * Bridges to the server-side Google Gemini Neural Speech Engine
 * and provides Web Audio playback, voice auditioning, and timeline synchronization.
 */
export class BrowserAudioEngine {
  private activeAudioElement: HTMLAudioElement | null = null;

  /**
   * Preview a voice by speaking genuine human speech
   * Preserves natural Persian intonation, distinctive timbre, resonance and personality.
   */
  async playVoicePreview(voice: VoiceProfile, customText?: string): Promise<void> {
    const isPersian = voice.language === 'fa';
    const sampleText =
      customText ||
      (isPersian
        ? voice.samplePhraseFa || 'سلام و درود، من با هویت و طنین اختصاصی در این پادکست همراه شما هستم.'
        : voice.samplePhraseEn || 'Hello, I am ready to host this podcast with you in broadcast audio quality.');

    // Stop any previously playing preview
    if (this.activeAudioElement) {
      this.activeAudioElement.pause();
      this.activeAudioElement = null;
    }

    try {
      // 1. Primary: Server-side Gemini Neural Speech Engine
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sampleText,
          voiceId: voice.id,
          language: voice.language,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
          this.activeAudioElement = audio;
          await audio.play();
          return;
        }
      }
    } catch (e) {
      console.warn('[AudioEngine] Server TTS preview failed, attempting browser SpeechSynthesis:', e);
    }

    // 2. Fallback: Browser Web Speech API (if system has Persian voice installed)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(sampleText);
      utterance.lang = isPersian ? 'fa-IR' : 'en-US';
      utterance.rate = Math.max(0.85, Math.min(1.2, voice.speed || 1.0));
      utterance.pitch = Math.max(0.7, Math.min(1.3, 1.0 + (voice.pitch || 0) * 0.05));

      const sysVoices = window.speechSynthesis.getVoices();
      const match = sysVoices.find(
        (v) =>
          (isPersian && (v.lang.includes('fa') || v.name.toLowerCase().includes('persian') || v.name.toLowerCase().includes('farsi'))) ||
          (!isPersian && v.lang.startsWith('en'))
      );
      if (match) utterance.voice = match;

      window.speechSynthesis.speak(utterance);
    }
  }

  /**
   * Orchestrates source text into conversational segments for 1 to 6 voices.
   * Strictly preserves all numbers, names, and facts while applying Persian normalization.
   */
  orchestrateScript(text: string, selectedVoiceIds: string[]): ScriptSegment[] {
    const cleanText = text.trim();
    if (!cleanText) return [];

    const activeVoices = selectedVoiceIds
      .map((id) => VOICES.find((v) => v.id === id))
      .filter((v): v is VoiceProfile => Boolean(v));

    const voices = activeVoices.length > 0 ? activeVoices : [VOICES[1]]; // default to Omid
    const isFa = /[\u0600-\u06FF]/.test(cleanText);

    // Persian speech normalization layer
    const normalizedInput = isFa ? PersianSpeechNormalizer.normalizeZwnj(cleanText) : cleanText;

    // Split into sentences preserving punctuation
    const rawSentences = normalizedInput.split(/([.?!؛\n]+)/);
    const sentences: string[] = [];
    for (let i = 0; i < rawSentences.length - 1; i += 2) {
      const s = (rawSentences[i] + (rawSentences[i + 1] || '')).trim();
      if (s) sentences.push(s);
    }
    if (rawSentences.length % 2 === 1 && rawSentences[rawSentences.length - 1].trim()) {
      sentences.push(rawSentences[rawSentences.length - 1].trim());
    }
    if (sentences.length === 0) sentences.push(normalizedInput);

    // Single voice narration
    if (voices.length === 1) {
      const speaker = voices[0];
      return sentences.map((sent, i) => {
        const { normalizedText, metadata } = PersianSpeechNormalizer.prepareForTTS(sent);
        return {
          speaker_id: speaker.id,
          speaker_name: isFa ? speaker.name : speaker.name_en,
          text: isFa ? normalizedText : sent,
          role: 'narrator',
          tone: i === 0 ? 'engaging_intro' : metadata.register,
          pause_after_ms: Math.round(750 * (isFa ? metadata.pauseFactor : 1.0)),
        };
      });
    }

    // Multi-speaker dialogue (2 to 6 voices)
    const roles = ['host', 'analyst', 'inquisitor', 'critic', 'storyteller', 'synthesizer'];
    const segments: ScriptSegment[] = [];
    const total = sentences.length;
    let idx = 0;
    let turnCount = 0;

    while (idx < total) {
      let take = 1;
      let speakerIdx = 0;
      let tone = 'conversational';

      if (idx === 0) {
        take = Math.min(2, total);
        speakerIdx = 0;
        tone = 'engaging_introduction';
      } else if (idx >= total - 2) {
        take = total - idx;
        speakerIdx = voices.length <= 2 ? 0 : Math.min(voices.length - 1, 5);
        tone = 'thoughtful_conclusion';
      } else {
        take = turnCount % 3 !== 0 ? Math.min(2, total - idx) : 1;
        speakerIdx = turnCount % voices.length;
        tone = speakerIdx === 1 ? 'analytical_discussion' : 'conversational_exchange';
      }

      const rawChunk = sentences.slice(idx, idx + take).join(' ');
      const spk = voices[speakerIdx % voices.length];

      // Run Persian speech normalization layer
      let finalText = rawChunk;
      let pauseAfter = 650;
      if (isFa) {
        const prep = PersianSpeechNormalizer.prepareForTTS(rawChunk);
        finalText = prep.normalizedText;
        pauseAfter = Math.round(650 * prep.metadata.pauseFactor);
        tone = `${prep.metadata.register}_${tone}`;
      }

      segments.push({
        speaker_id: spk.id,
        speaker_name: isFa ? spk.name : spk.name_en,
        text: finalText,
        role: roles[speakerIdx % roles.length],
        tone,
        pause_after_ms: pauseAfter,
      });

      idx += take;
      turnCount++;
    }

    return segments;
  }

  /**
   * Synthesizes audio for all segments using genuine neural human Persian speech,
   * masters the continuous audio track, and returns a playable WAV Blob URL.
   */
  async generatePodcastAudio(
    segments: ScriptSegment[],
    onProgress: (step: string, progress: number) => void
  ): Promise<{ audioUrl: string; durationSec: number; segments: ScriptSegment[] }> {
    onProgress('analyzing', 20);

    // Call server synthesizer
    onProgress('generating_voice', 45);

    try {
      const selectedVoiceIds = Array.from(new Set(segments.map((s) => s.speaker_id)));
      const res = await fetch('/api/podcast/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments,
          selectedVoiceIds,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with status ${res.status}`);
      }

      onProgress('mixing_audio', 85);
      const data = await res.json();

      if (!data.audioBase64) {
        throw new Error('Server returned empty audio payload');
      }

      onProgress('finalizing', 95);

      // Convert base64 to Blob URL
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
        durationSec: data.durationSec || 60,
        segments: data.segments || segments,
      };
    } catch (serverErr) {
      console.error('[AudioEngine] Server synthesis encountered error:', serverErr);
      throw new Error(`Speech synthesis error: ${serverErr instanceof Error ? serverErr.message : 'Audio synthesis failed'}`);
    }
  }
}

export const audioEngine = new BrowserAudioEngine();
