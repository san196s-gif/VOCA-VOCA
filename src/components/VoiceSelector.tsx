import React, { useState } from 'react';
import { Volume2, Check, User, Users, Info } from 'lucide-react';
import { VoiceProfile } from '../types';
import { audioEngine } from '../services/browserAudioEngine';

interface VoiceSelectorProps {
  voices: VoiceProfile[];
  selectedVoiceIds: string[];
  onToggleVoice: (voiceId: string) => void;
  onOpenBenchmark?: () => void;
  disabled?: boolean;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  voices,
  selectedVoiceIds,
  onToggleVoice,
  onOpenBenchmark,
  disabled,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'fa' | 'en'>('all');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  const filteredVoices = voices.filter((v) => {
    if (activeFilter === 'fa') return v.language === 'fa';
    if (activeFilter === 'en') return v.language === 'en';
    return true;
  });

  const handlePreview = async (e: React.MouseEvent, voice: VoiceProfile) => {
    e.stopPropagation();
    if (playingVoiceId) return;

    setPlayingVoiceId(voice.id);
    try {
      await audioEngine.playVoicePreview(voice);
    } finally {
      setTimeout(() => setPlayingVoiceId(null), 1200);
    }
  };

  const getSelectionOrderBadge = (voiceId: string) => {
    const idx = selectedVoiceIds.indexOf(voiceId);
    if (idx === -1) return null;
    return (
      <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] flex items-center justify-center shadow-md shadow-amber-500/30">
        {idx + 1}
      </span>
    );
  };

  return (
    <div className="w-full space-y-3.5">
      {/* Voice Selector Header & Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-200 uppercase">
            Voices ({selectedVoiceIds.length}/6 Selected)
          </h2>
          <span className="text-xs text-slate-500">
            {selectedVoiceIds.length === 1
              ? '• Solo Narration Mode'
              : selectedVoiceIds.length > 1
              ? `• ${selectedVoiceIds.length}-Speaker Dialogue Mode`
              : '• Select 1 to 6 voices'}
          </span>
        </div>

        {/* Action & Filter Pills */}
        <div className="flex items-center gap-2">
          {onOpenBenchmark && (
            <button
              type="button"
              onClick={onOpenBenchmark}
              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>تست وضوح گفتار فارسی</span>
            </button>
          )}

          <div className="flex items-center rounded-lg bg-slate-900/80 p-0.5 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1 rounded-md transition-all font-medium ${
                activeFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All (20)
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('fa')}
              className={`px-3 py-1 rounded-md transition-all font-medium ${
                activeFilter === 'fa'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              فارسی Persian (10)
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('en')}
              className={`px-3 py-1 rounded-md transition-all font-medium ${
                activeFilter === 'en'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              English (10)
            </button>
          </div>
        </div>
      </div>

      {/* Voice Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
        {filteredVoices.map((voice) => {
          const isSelected = selectedVoiceIds.includes(voice.id);
          const isMaxSelected = selectedVoiceIds.length >= 6 && !isSelected;
          const isPlaying = playingVoiceId === voice.id;

          return (
            <div
              key={voice.id}
              onClick={() => {
                if (!disabled && (!isMaxSelected || isSelected)) {
                  onToggleVoice(voice.id);
                }
              }}
              className={`group relative p-3 rounded-xl border text-left cursor-pointer transition-all duration-150 select-none ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500/70 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/30'
                  : isMaxSelected
                  ? 'bg-slate-900/40 border-slate-800/50 opacity-40 cursor-not-allowed'
                  : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-850'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 group-hover:bg-slate-750'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-white">
                      {voice.language === 'fa' ? voice.name : voice.name_en}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span className="uppercase font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-300">
                        {voice.language}
                      </span>
                      <span>•</span>
                      <span className="capitalize">{voice.gender}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* Sample Preview Play Button */}
                  <button
                    type="button"
                    onClick={(e) => handlePreview(e, voice)}
                    disabled={isPlaying}
                    title="Audition voice sample"
                    className={`p-1.5 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 transition-colors ${
                      isPlaying ? 'text-amber-400 animate-pulse' : ''
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Selection Indicator */}
                  {isSelected ? (
                    getSelectionOrderBadge(voice.id)
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-transparent group-hover:border-slate-500" />
                  )}
                </div>
              </div>

              {/* Voice Characteristic Style */}
              <p className="mt-2 text-[11px] text-slate-400 leading-tight line-clamp-2">
                {voice.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
