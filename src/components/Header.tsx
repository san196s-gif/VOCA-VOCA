import React from 'react';
import { Mic2, ShieldCheck, Cpu, HardDrive, Database, Sparkles } from 'lucide-react';
import { HardwareInfo } from '../types';
import { User } from 'firebase/auth';

interface HeaderProps {
  backendConnected: boolean;
  hardware?: HardwareInfo;
  currentUser: User | null;
  onOpenWorkspace: () => void;
  onOpenBenchmark?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  backendConnected,
  hardware,
  currentUser,
  onOpenWorkspace,
  onOpenBenchmark,
}) => {
  return (
    <header className="w-full border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-40 py-3.5 px-4 sm:px-8">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
            <Mic2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
              PODCAST AI
              <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Studio
              </span>
            </h1>
            <p className="text-xs text-slate-400 hidden sm:block">
              Local-First Offline Multi-Speaker Studio • Native Persian & English Oratory
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {/* Persian Voice Quality Benchmark Button */}
          {onOpenBenchmark && (
            <button
              type="button"
              onClick={onOpenBenchmark}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 transition-all font-semibold text-[11px] shadow-sm shadow-amber-500/10"
              title="تست و ارزیابی ۴ جمله استاندارد وضوح صدای فارسی با گویندگان مختلف"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>آزمون کیفیت صدای فارسی</span>
            </button>
          )}

          {/* Local Status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium text-[11px]">100% Studio</span>
          </div>

          {/* Engine indicator */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${
              backendConnected
                ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
                : 'bg-blue-950/40 border-blue-800/50 text-blue-300'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{backendConnected ? 'FastAPI Engine' : 'Local Web Engine'}</span>
          </div>

          {/* Google Workspace & Cloud Sync Button */}
          <button
            type="button"
            onClick={onOpenWorkspace}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all border shadow-sm ${
              currentUser
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-amber-400" />
            <span>{currentUser ? 'Drive & Gmail' : 'Connect Workspace'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
