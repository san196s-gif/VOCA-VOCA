import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Download,
  Volume2,
  VolumeX,
  RotateCcw,
  ListCollapse,
  ChevronDown,
  ChevronUp,
  FileAudio,
  HardDrive,
  Mail,
} from 'lucide-react';
import { ScriptSegment } from '../types';

interface AudioPlayerProps {
  audioUrl: string;
  durationSec?: number;
  script?: ScriptSegment[];
  onExportDrive?: () => void;
  onShareGmail?: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  durationSec = 0,
  script = [],
  onExportDrive,
  onShareGmail,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSec || 0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showScript, setShowScript] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch((err) => {
        console.warn('Playback error:', err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    setCurrentTime(target);
    if (audioRef.current) {
      audioRef.current.currentTime = target;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.8;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const togglePlaybackRate = () => {
    const rates = [1.0, 1.25, 1.5, 2.0];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const triggerDownload = (format: 'mp3' | 'wav') => {
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `podcast_episode_${Date.now()}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Color palette for multiple speakers in timeline
  const speakerColors = [
    '#f59e0b', // amber
    '#3b82f6', // blue
    '#10b981', // emerald
    '#ec4899', // pink
    '#8b5cf6', // purple
    '#06b6d4', // cyan
  ];

  // Map unique speakers to colors
  const speakerColorMap = new Map<string, string>();
  script.forEach((seg) => {
    if (!speakerColorMap.has(seg.speaker_id)) {
      const colorIndex = speakerColorMap.size % speakerColors.length;
      speakerColorMap.set(seg.speaker_id, speakerColors[colorIndex]);
    }
  });

  return (
    <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 space-y-5 shadow-2xl backdrop-blur-md">
      <audio ref={audioRef} src={audioUrl} preload="auto" />

      {/* Title / Header of the Player */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <FileAudio className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Generated Episode Master</h3>
            <p className="text-xs text-slate-400">
              Broadcast Ready • EBU R128 (-16 LUFS) • Stereo 44.1kHz
            </p>
          </div>
        </div>

        {script.length > 0 && (
          <button
            type="button"
            onClick={() => setShowScript((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <span>{showScript ? 'Hide Script' : 'View Script'}</span>
            {showScript ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Speaker Timeline Track (shows colored segments) */}
      {script.length > 1 && duration > 0 && (
        <div className="space-y-1.5">
          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden flex">
            {script.map((seg, idx) => {
              const segDur = seg.duration || duration / script.length;
              const widthPct = Math.max(2, (segDur / duration) * 100);
              const color = speakerColorMap.get(seg.speaker_id) || '#f59e0b';
              return (
                <div
                  key={idx}
                  style={{ width: `${widthPct}%`, backgroundColor: color }}
                  className="h-full border-r border-slate-900/60 opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                  title={`${seg.speaker_name}: "${seg.text.slice(0, 40)}..."`}
                  onClick={() => {
                    if (seg.startTime !== undefined && audioRef.current) {
                      audioRef.current.currentTime = seg.startTime;
                      setCurrentTime(seg.startTime);
                    }
                  }}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
            {Array.from(speakerColorMap.entries()).map(([spkId, color]) => {
              const spkName = script.find((s) => s.speaker_id === spkId)?.speaker_name || spkId;
              return (
                <div key={spkId} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="font-medium text-slate-300">{spkName}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scrubber & Time */}
      <div className="space-y-1.5">
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400"
        />

        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Main Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Play/Pause & Rate */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 transition-transform active:scale-95"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                setCurrentTime(0);
              }
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Restart"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Speed Toggle */}
          <button
            type="button"
            onClick={togglePlaybackRate}
            className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            {playbackRate}x
          </button>
        </div>

        {/* Volume Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className="text-slate-400 hover:text-slate-200"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>

        {/* Download & Cloud Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onExportDrive && (
            <button
              type="button"
              onClick={onExportDrive}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-amber-300 bg-amber-950/40 hover:bg-amber-900/50 transition-colors border border-amber-800/60"
              title="Save directly to your Google Drive"
            >
              <HardDrive className="w-4 h-4" />
              <span>Drive</span>
            </button>
          )}

          {onShareGmail && (
            <button
              type="button"
              onClick={onShareGmail}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-blue-300 bg-blue-950/40 hover:bg-blue-900/50 transition-colors border border-blue-800/60"
              title="Share podcast episode via Gmail"
            >
              <Mail className="w-4 h-4" />
              <span>Gmail</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => triggerDownload('mp3')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            <span>Download MP3</span>
          </button>

          <button
            type="button"
            onClick={() => triggerDownload('wav')}
            className="px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700/60"
            title="Download Lossless 16-bit WAV"
          >
            WAV
          </button>
        </div>
      </div>

      {/* Expandable Script Inspector */}
      {showScript && script.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-800 space-y-2.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Dialogue Script Breakdown ({script.length} Segments)
          </h4>
          {script.map((seg, idx) => {
            const isFa = /[\u0600-\u06FF]/.test(seg.text);
            const color = speakerColorMap.get(seg.speaker_id) || '#f59e0b';
            return (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-1 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="font-bold text-slate-200">{seg.speaker_name}</span>
                    {seg.role && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[10px] capitalize">
                        {seg.role}
                      </span>
                    )}
                  </div>
                  {seg.startTime !== undefined && (
                    <span className="font-mono text-slate-500">{formatTime(seg.startTime)}</span>
                  )}
                </div>
                <p
                  dir={isFa ? 'rtl' : 'ltr'}
                  className={`text-slate-300 leading-relaxed ${
                    isFa ? "font-['Vazirmatn',sans-serif]" : 'font-sans'
                  }`}
                >
                  {seg.text}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
