import React from 'react';
import { Loader2, CheckCircle, Radio, Sparkles, Sliders, ShieldCheck, FileCheck, AudioWaveform } from 'lucide-react';
import { GenerationJob } from '../types';

interface GenerationProgressProps {
  job: GenerationJob;
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({ job }) => {
  const steps = [
    { key: 'normalizing', label: 'Persian Normalization', icon: Sparkles },
    { key: 'analyzing', label: 'Script Structuring', icon: FileCheck },
    { key: 'validating_script', label: 'Script Quality Check', icon: ShieldCheck },
    { key: 'generating_voice', label: 'Voice Synthesis', icon: Radio },
    { key: 'mixing_audio', label: 'Loudness Mastering', icon: Sliders },
    { key: 'validating_audio', label: 'Audio Quality Check', icon: AudioWaveform },
  ];

  const getStepStatus = (stepKey: string) => {
    const order = [
      'pending',
      'normalizing',
      'analyzing',
      'validating_script',
      'generating_voice',
      'mixing_audio',
      'validating_audio',
      'finalizing',
      'completed',
    ];
    const currentIdx = order.indexOf(job.status);
    const stepIdx = order.indexOf(stepKey);

    if (currentIdx > stepIdx || job.status === 'completed') return 'completed';
    if (currentIdx === stepIdx) return 'active';
    return 'pending';
  };

  return (
    <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Quality Control & Generation Pipeline</h3>
              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Stage {job.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-400">{job.message || 'Processing in progress...'}</p>
          </div>
        </div>
        <span className="text-sm font-mono font-bold text-amber-400">
          {job.progress}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
        <div
          className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 transition-all duration-300 ease-out rounded-full shadow-lg shadow-amber-500/30"
          style={{ width: `${Math.max(5, Math.min(100, job.progress))}%` }}
        />
      </div>

      {/* Steps Pipeline View */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
        {steps.map((st) => {
          const status = getStepStatus(st.key);
          const Icon = st.icon;
          return (
            <div
              key={st.key}
              className={`flex items-center gap-1.5 p-2 rounded-xl border text-[11px] transition-all ${
                status === 'completed'
                  ? 'border-emerald-700/50 bg-emerald-950/30 text-emerald-300'
                  : status === 'active'
                  ? 'border-amber-500/80 bg-amber-950/30 text-amber-300 animate-pulse ring-1 ring-amber-500/40'
                  : 'border-slate-800/80 bg-slate-950/40 text-slate-500'
              }`}
            >
              {status === 'completed' ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              ) : (
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              <span className="truncate font-semibold">{st.label}</span>
            </div>
          );
        })}
      </div>

      {/* Live Quality feedback badge if script validation is ready */}
      {job.script_validation && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300">
              Script Validation Score: <strong className="text-emerald-400">{job.script_validation.score}/100</strong>
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">
              {job.script_validation.autoRepaired ? 'Auto-Repaired & Formatted' : 'Verified'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            {job.script?.length || 0} dialogue segments checked
          </span>
        </div>
      )}
    </div>
  );
};
