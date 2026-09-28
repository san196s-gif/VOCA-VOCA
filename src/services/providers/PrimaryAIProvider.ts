import { ITTSProvider, ISTTProvider, IScriptProvider, TTSOptions, TTSResult, MultiSpeakerTTSResult, ScriptOrchestrationResult, TranscriptionResult } from './types';
import { ScriptSegment } from '../../types';
import { scriptValidator } from '../scriptValidator';
import { PersianSpeechNormalizer } from '../persianNormalizer';

export class GeminiExhaustionError extends Error {
  public status?: number;
  public reason: string;

  constructor(reason: string, status?: number) {
    super(`Gemini API Exhausted: ${reason}`);
    this.name = 'GeminiExhaustionError';
    this.status = status;
    this.reason = reason;
  }
}

export class PrimaryAIProvider implements ITTSProvider, ISTTProvider, IScriptProvider {
  name = 'Google Gemini 3.8 Neural Engine';
  isOffline = false;

  private isExhausted = false;
  private exhaustionReason?: string;

  checkExhausted(): boolean {
    return this.isExhausted;
  }

  getExhaustionReason(): string | undefined {
    return this.exhaustionReason;
  }

  markExhausted(reason: string, status?: number) {
    this.isExhausted = true;
    this.exhaustionReason = reason;
    console.warn(`[PrimaryAIProvider] Gemini marked as exhausted: ${reason} (status ${status})`);
  }

  resetStatus() {
    this.isExhausted = false;
    this.exhaustionReason = undefined;
  }

  async isAvailable(): Promise<boolean> {
    if (this.isExhausted) return false;
    try {
      const res = await fetch('/api/health');
      return res.ok;
    } catch {
      return false;
    }
  }

  // TTS Segment Synthesis
  async synthesizeSegment(options: TTSOptions): Promise<TTSResult> {
    if (this.isExhausted) {
      throw new GeminiExhaustionError(this.exhaustionReason || 'Gemini marked as exhausted');
    }

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        const status = res.status;
        const msg = errorJson.error || `HTTP ${status}`;

        // Detect quota exhaustion, rate limit (429), or billing limits
        if (
          status === 429 ||
          status === 403 ||
          status === 503 ||
          msg.includes('quota') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('Rate limit')
        ) {
          this.markExhausted(msg, status);
          throw new GeminiExhaustionError(msg, status);
        }

        throw new Error(msg);
      }

      const data = await res.json();
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
        durationSec: data.durationSec || 4.0,
        provider: this.name,
        isOffline: false,
      };
    } catch (err: any) {
      if (err instanceof GeminiExhaustionError) throw err;
      if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
        this.markExhausted('Network connection to Gemini unavailable');
        throw new GeminiExhaustionError('Network connection unavailable');
      }
      throw err;
    }
  }

  // Multi-Speaker Podcast Dialogue Synthesis
  async synthesizeMultiSpeaker(
    segments: ScriptSegment[],
    voiceIds: string[]
  ): Promise<MultiSpeakerTTSResult> {
    if (this.isExhausted) {
      throw new GeminiExhaustionError(this.exhaustionReason || 'Gemini marked as exhausted');
    }

    try {
      const res = await fetch('/api/podcast/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments,
          selectedVoiceIds: voiceIds,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        const status = res.status;
        const msg = errorJson.error || `HTTP ${status}`;

        if (
          status === 429 ||
          status === 403 ||
          status === 503 ||
          msg.includes('quota') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('Rate limit')
        ) {
          this.markExhausted(msg, status);
          throw new GeminiExhaustionError(msg, status);
        }

        throw new Error(msg);
      }

      const data = await res.json();
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
        provider: this.name,
        isOffline: false,
      };
    } catch (err: any) {
      if (err instanceof GeminiExhaustionError) throw err;
      if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
        this.markExhausted('Network connection to Gemini unavailable');
        throw new GeminiExhaustionError('Network connection unavailable');
      }
      throw err;
    }
  }

  // Speech-To-Text Transcription
  async transcribe(audioBlob: Blob): Promise<TranscriptionResult> {
    if (this.isExhausted) {
      throw new GeminiExhaustionError(this.exhaustionReason || 'Gemini marked as exhausted');
    }

    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const res = reader.result as string;
        resolve(res.split(',')[1] || '');
      };
      reader.onerror = reject;
    });
    reader.readAsDataURL(audioBlob);

    const audioBase64 = await base64Promise;

    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64,
        mimeType: audioBlob.type || 'audio/wav',
      }),
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      const msg = errorJson.error || 'Transcription failed';
      if (res.status === 429 || res.status === 403 || msg.includes('quota')) {
        this.markExhausted(msg, res.status);
        throw new GeminiExhaustionError(msg, res.status);
      }
      throw new Error(msg);
    }

    const data = await res.json();
    return {
      transcript: data.transcript,
      provider: this.name,
      isOffline: false,
    };
  }

  // Script Orchestration with Gemini / Rule Hybrid
  async orchestrateAndValidate(text: string, voiceIds: string[]): Promise<ScriptOrchestrationResult> {
    // Normalization & structuring
    const isFa = /[\u0600-\u06FF]/.test(text);
    const normalizedInput = isFa ? PersianSpeechNormalizer.prepareForTTS(text).normalizedText : text;

    // Use rule-based dialogue orchestrator with validation
    const { repairedScript, report } = scriptValidator.validateAndRepair(
      [],
      normalizedInput,
      true
    );

    return {
      segments: repairedScript,
      validationReport: report,
      provider: this.name,
      isOffline: false,
    };
  }
}
