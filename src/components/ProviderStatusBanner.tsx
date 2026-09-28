import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertTriangle, ShieldCheck, RefreshCw, Terminal, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../services/api';
import { ProviderSystemState } from '../services/providers/types';

export const ProviderStatusBanner: React.FC = () => {
  const [state, setState] = useState<ProviderSystemState>(api.getProviderState());
  const [showDetails, setShowDetails] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = api.subscribeProviderState((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  const isOffline = state.mode === 'offline_local';

  return (
    <div className="w-full">
      {isOffline ? (
        /* Offline Mode Banner (Triggered by Gemini Quota Exhaustion or Manual Switch) */
        <div className="rounded-xl bg-amber-950/40 border border-amber-500/40 p-3.5 sm:p-4 text-xs text-amber-200 transition-all shadow-lg shadow-amber-950/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
                <WifiOff className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <span>Gemini unavailable — Switched to Local Offline Mode</span>
                  <span className="px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/30">
                    Offline Fallback Active
                  </span>
                </div>
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  {state.geminiErrorReason
                    ? `دلیل: ${state.geminiErrorReason} • `
                    : 'سهمیه Gemini تمام شده است • '}
                  تولید پادکست بدون وقفه با موتور پردازش محلی ادامه می‌یابد.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-medium text-[11px] flex items-center gap-1 transition-colors"
              >
                <span>تنظیمات آفلاین</span>
                {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => api.resetToPrimary()}
                className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>بررسی مجدد Gemini</span>
              </button>
            </div>
          </div>

          {showDetails && (
            <div className="mt-3 pt-3 border-t border-amber-500/20 space-y-2 text-[11px] text-amber-300/90">
              <div className="flex items-center justify-between">
                <span>موتور صوتی آفلاین فعال:</span>
                <span className="font-mono text-white">{state.localTtsEngine}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-amber-500/20 font-mono text-[10px] text-slate-300 space-y-1">
                <div className="text-amber-400 font-bold">دستور بارگیری مدل‌های آفلاین فارسی (Windows / Linux):</div>
                <div className="flex items-center justify-between bg-slate-900 px-2 py-1 rounded border border-slate-800">
                  <code>python backend/download_models.py</code>
                  <span className="text-[9px] text-slate-500">یا اجرای install.bat</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Primary Mode Subtle Status Bar */
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-medium">موتور اصلی: Google Gemini 3.8 Neural Speech</span>
            <span className="text-slate-500 hidden sm:inline">•</span>
            <span className="text-slate-400 hidden sm:inline">سقوط خودکار به آفلاین در صورت اتمام سهمیه (Zero Interruption)</span>
          </div>

          <button
            type="button"
            onClick={() => api.switchToOffline('تغییر دستی توسط کاربر')}
            className="text-[10px] text-slate-400 hover:text-amber-400 transition-colors underline"
          >
            تغییر به حالت آفلاین محلی
          </button>
        </div>
      )}
    </div>
  );
};
