import { ScriptSegment, VoiceProfile, ScriptValidationReport, AudioValidationReport } from '../../types';

export type ProviderMode = 'primary' | 'offline_local';

export type GeminiHealthStatus = 'ready' | 'quota_exhausted' | 'rate_limited' | 'network_error' | 'disabled';

export interface ProviderSystemState {
  mode: ProviderMode;
  geminiStatus: GeminiHealthStatus;
  geminiErrorReason?: string;
  localTtsAvailable: boolean;
  localTtsEngine: string; // e.g. "Piper Neural ONNX", "eSpeak-NG", "Web Speech API (fa-IR)", "Not Installed"
  localSttAvailable: boolean;
  activeVoicesCount: number;
  lastSwitchTimestamp?: number;
}

export interface TTSOptions {
  text: string;
  voiceId: string;
  language?: 'fa' | 'en';
  style?: string;
  speakerName?: string;
}

export interface TTSResult {
  audioUrl: string;
  audioBase64?: string;
  durationSec: number;
  provider: string; // 'gemini' | 'local_piper' | 'local_espeak' | 'browser_speech'
  isOffline: boolean;
}

export interface MultiSpeakerTTSResult {
  audioUrl: string;
  audioBase64?: string;
  durationSec: number;
  segments: ScriptSegment[];
  provider: string;
  isOffline: boolean;
}

export interface ScriptOrchestrationResult {
  segments: ScriptSegment[];
  validationReport: ScriptValidationReport;
  provider: string;
  isOffline: boolean;
}

export interface TranscriptionResult {
  transcript: string;
  provider: string;
  isOffline: boolean;
}

export interface ITTSProvider {
  name: string;
  isOffline: boolean;
  isAvailable(): Promise<boolean>;
  synthesizeSegment(options: TTSOptions): Promise<TTSResult>;
  synthesizeMultiSpeaker(segments: ScriptSegment[], voiceIds: string[]): Promise<MultiSpeakerTTSResult>;
}

export interface ISTTProvider {
  name: string;
  isOffline: boolean;
  isAvailable(): Promise<boolean>;
  transcribe(audioBlob: Blob): Promise<TranscriptionResult>;
}

export interface IScriptProvider {
  name: string;
  isOffline: boolean;
  isAvailable(): Promise<boolean>;
  orchestrateAndValidate(text: string, voiceIds: string[]): Promise<ScriptOrchestrationResult>;
}
