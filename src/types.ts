export interface VoiceProfile {
  id: string;
  name: string;
  name_en: string;
  language: 'fa' | 'en';
  gender: 'male' | 'female';
  style: string;
  speed: number;
  pitch: number;
  base_freq: number;
  description: string;
  geminiVoice?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede' | 'Zephyr' | 'Leda' | 'Orpheus' | 'Callisto' | string;
  speechStylePrompt?: string;
  persianStylePrompt?: string;
  samplePhraseFa?: string;
  samplePhraseEn?: string;
}

export interface ScriptSegment {
  speaker_id: string;
  speaker_name: string;
  text: string;
  role?: string;
  tone?: string;
  pause_after_ms?: number;
  startTime?: number;
  duration?: number;
}

export type JobStatus =
  | 'idle'
  | 'pending'
  | 'transcribing'
  | 'normalizing'
  | 'analyzing'
  | 'validating_script'
  | 'generating_voice'
  | 'mixing_audio'
  | 'validating_audio'
  | 'finalizing'
  | 'completed'
  | 'failed';

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  rule: string;
  message: string;
  suggestion?: string;
  segmentIndex?: number;
}

export interface ScriptValidationReport {
  score: number; // 0 - 100
  passed: boolean;
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  autoRepaired: boolean;
  integrity: {
    score: number;
    numbersVerified: boolean;
    numberDetails?: string;
    keyPointsFound: string[];
    missingPoints: string[];
  };
}

export interface AudioValidationReport {
  score: number; // 0 - 100
  passed: boolean;
  peakDbfs: number;
  clippingDetected: boolean;
  clippingSamples: number;
  speakerBalanceScore: number;
  silenceGapsOk: boolean;
  metrics: {
    lufs: number;
    dynamicRangeDb: number;
    avgPauseMs: number;
    silenceRatioPct?: number;
  };
  note?: string;
}

export interface GenerationJob {
  id: string;
  status: JobStatus;
  progress: number;
  message: string;
  error?: string;
  audio_url?: string;
  script?: ScriptSegment[];
  duration_sec?: number;
  voices?: string[];
  normalized_text?: string;
  script_validation?: ScriptValidationReport;
  audio_validation?: AudioValidationReport;
  is_published?: boolean;
  published_at?: string;
}

export interface HardwareInfo {
  os?: string;
  cpu?: { cores_logical: number; architecture: string };
  ram?: { total_gb: number; available_gb: number };
  gpu?: { available: boolean; cuda_available: boolean; name: string; vram_gb: number };
  storage?: { free_gb: number; total_gb: number };
  ffmpeg?: { available: boolean; version: string };
}
