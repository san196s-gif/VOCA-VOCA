import { ProviderMode, ProviderSystemState, TTSOptions, TTSResult, MultiSpeakerTTSResult, ScriptOrchestrationResult, TranscriptionResult } from './types';
import { PrimaryAIProvider, GeminiExhaustionError } from './PrimaryAIProvider';
import { LocalAIProvider } from './LocalAIProvider';
import { LocalTTSProvider, LocalTTSUnavailableError } from './LocalTTSProvider';
import { LocalSTTProvider } from './LocalSTTProvider';
import { ScriptSegment } from '../../types';

export class ProviderRegistry {
  private primaryAI = new PrimaryAIProvider();
  private localAI = new LocalAIProvider();
  private localTTS = new LocalTTSProvider();
  private localSTT = new LocalSTTProvider();

  private state: ProviderSystemState = {
    mode: 'primary',
    geminiStatus: 'ready',
    localTtsAvailable: false,
    localTtsEngine: 'Local Piper/ONNX Engine',
    localSttAvailable: true,
    activeVoicesCount: 20,
  };

  private listeners: Set<(state: ProviderSystemState) => void> = new Set();

  constructor() {
    this.initProviders();
  }

  private async initProviders() {
    // Check local engine availability
    const localAvailable = await this.localTTS.isAvailable();
    this.state.localTtsAvailable = localAvailable;
    this.state.localTtsEngine = this.localTTS.getEngineName();
    this.notify();
  }

  getState(): ProviderSystemState {
    return { ...this.state };
  }

  subscribe(listener: (state: ProviderSystemState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((fn) => fn(currentState));
  }

  switchToOffline(reason: string) {
    console.warn(`[ProviderRegistry] Switching to OFFLINE_LOCAL mode: ${reason}`);
    this.state.mode = 'offline_local';
    this.state.geminiStatus = reason.includes('quota') || reason.includes('RESOURCE_EXHAUSTED')
      ? 'quota_exhausted'
      : reason.includes('rate')
      ? 'rate_limited'
      : 'network_error';
    this.state.geminiErrorReason = reason;
    this.state.lastSwitchTimestamp = Date.now();
    this.primaryAI.markExhausted(reason);
    this.notify();
  }

  resetToPrimary() {
    this.state.mode = 'primary';
    this.state.geminiStatus = 'ready';
    this.state.geminiErrorReason = undefined;
    this.primaryAI.resetStatus();
    this.notify();
  }

  // Automatic Failover Speech Segment Synthesis
  async synthesizeSegment(options: TTSOptions): Promise<TTSResult> {
    if (this.state.mode === 'primary') {
      try {
        return await this.primaryAI.synthesizeSegment(options);
      } catch (err) {
        if (err instanceof GeminiExhaustionError) {
          this.switchToOffline(err.reason);
          // Seamless failover to Local TTS
          return await this.localTTS.synthesizeSegment(options);
        }
        throw err;
      }
    }

    // Direct Offline Local Synthesis
    return await this.localTTS.synthesizeSegment(options);
  }

  // Automatic Failover Multi-Speaker Podcast Synthesis
  async synthesizeMultiSpeaker(
    segments: ScriptSegment[],
    voiceIds: string[]
  ): Promise<MultiSpeakerTTSResult> {
    if (this.state.mode === 'primary') {
      try {
        return await this.primaryAI.synthesizeMultiSpeaker(segments, voiceIds);
      } catch (err) {
        if (err instanceof GeminiExhaustionError) {
          this.switchToOffline(err.reason);
          // Seamless failover to Local TTS
          return await this.localTTS.synthesizeMultiSpeaker(segments, voiceIds);
        }
        throw err;
      }
    }

    // Direct Offline Local Synthesis
    return await this.localTTS.synthesizeMultiSpeaker(segments, voiceIds);
  }

  // Script Orchestration (Local-first rule-based with validation)
  async orchestrateScript(text: string, voiceIds: string[]): Promise<ScriptOrchestrationResult> {
    return await this.localAI.orchestrateAndValidate(text, voiceIds);
  }

  // Automatic Failover Speech-To-Text Transcription
  async transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
    if (this.state.mode === 'primary') {
      try {
        return await this.primaryAI.transcribe(audioBlob);
      } catch (err) {
        if (err instanceof GeminiExhaustionError) {
          this.switchToOffline(err.reason);
          return await this.localSTT.transcribe(audioBlob);
        }
        throw err;
      }
    }

    return await this.localSTT.transcribe(audioBlob);
  }
}

export const providerRegistry = new ProviderRegistry();
