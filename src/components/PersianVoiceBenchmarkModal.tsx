import React, { useState } from 'react';
import { X, Play, Pause, CheckCircle2, ShieldCheck, Sparkles, Volume2, Award, RefreshCw, AlertCircle } from 'lucide-react';
import { VoiceProfile } from '../types';
import { api } from '../services/api';

interface PersianVoiceBenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  voices: VoiceProfile[];
  selectedVoiceId?: string;
}

export const BENCHMARK_SENTENCES = [
  {
    id: 0,
    text: 'سلام، امروز می‌خواهیم درباره آینده فناوری و تأثیر هوش مصنوعی بر زندگی انسان صحبت کنیم.',
    category: 'مقدمه و تعامل (Conversational Opening)',
    focus: 'لحن طبیعی، سلام و احوالپرسی بدون لهجه انگلیسی، تاکید بر «هوش مصنوعی»',
  },
  {
    id: 1,
    text: 'صنعت در سال‌های آینده با تغییرات بسیار بزرگی روبه‌رو خواهد شد.',
    category: 'گزاره خبری و آینده‌پژوهی (Declarative & Future)',
    focus: 'ریتم جمله خبری، تلفظ صحیح «روبه‌رو خواهد شد»، مکث طبیعی قبل از تغییر فاز',
  },
  {
    id: 2,
    text: 'این موضوع فقط به فناوری مربوط نمی‌شود، بلکه اقتصاد، آموزش و زندگی روزمره انسان‌ها را نیز تحت تأثیر قرار می‌دهد.',
    category: 'جمله تحلیلی مرکب (Compound Analytical Statement)',
    focus: 'کشش کلامی حرف ربط «بلکه»، رعایت نیم‌فاصله‌ها، تکیه صوتی بر واژگان کلیدی',
  },
  {
    id: 3,
    text: 'اگر بخواهیم آینده را بهتر بسازیم، ابتدا باید تغییرات امروز را درست بشناسیم.',
    category: 'جمله شرطی و فلسفی (Conditional & Philosophical)',
    focus: 'فراز آهنگ در بند شرط («بسازیم»)، و فرود آرامش‌بخش و متین در بند جواب («بشناسیم»)',
  },
];

export const PersianVoiceBenchmarkModal: React.FC<PersianVoiceBenchmarkModalProps> = ({
  isOpen,
  onClose,
  voices,
  selectedVoiceId,
}) => {
  const [activeVoiceId, setActiveVoiceId] = useState<string>(selectedVoiceId || 'fa-warm-male');
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeVoice = voices.find((v) => v.id === activeVoiceId) || voices[0];

  const handlePlaySentence = async (index: number) => {
    setError(null);
    const cacheKey = `${activeVoiceId}_${index}`;

    // If currently playing this sentence, pause it
    if (playingIndex === index && currentAudio) {
      currentAudio.pause();
      setPlayingIndex(null);
      return;
    }

    // If audio already generated and cached in state
    if (audioUrls[cacheKey]) {
      if (currentAudio) currentAudio.pause();
      const audio = new Audio(audioUrls[cacheKey]);
      setCurrentAudio(audio);
      setPlayingIndex(index);
      audio.onended = () => setPlayingIndex(null);
      audio.onerror = () => setPlayingIndex(null);
      await audio.play();
      return;
    }

    // Generate new neural speech for this benchmark sentence
    setLoading(true);
    try {
      if (currentAudio) currentAudio.pause();
      const res = await api.runBenchmarkSentence(index, activeVoiceId);
      setAudioUrls((prev) => ({ ...prev, [cacheKey]: res.audioUrl }));

      const audio = new Audio(res.audioUrl);
      setCurrentAudio(audio);
      setPlayingIndex(index);
      audio.onended = () => setPlayingIndex(null);
      audio.onerror = () => setPlayingIndex(null);
      await audio.play();
    } catch (err: any) {
      console.error('Benchmark speech generation failed:', err);
      setError(err?.message || 'تولید گفتار با خطا مواجه شد. لطفاً دوباره تلاش کنید.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }
    setPlayingIndex(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl rounded-2xl bg-slate-900 border border-amber-500/30 shadow-2xl shadow-amber-500/10 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>آزمون سنجش کیفیت و وضوح گفتار فارسی</span>
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Google Gemini Neural TTS
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                بررسی تلفظ واژه به واژه، ریتم جملات، وضوح واج‌های فارسی و حفظ هویت صوتی
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Voice Selector for Benchmark */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              انتخاب گوینده برای ارزیابی تلفظ (Select Voice To Audition)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {voices.slice(0, 10).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setActiveVoiceId(v.id);
                    if (currentAudio) currentAudio.pause();
                    setPlayingIndex(null);
                  }}
                  className={`p-2.5 rounded-xl text-right transition-all border text-xs ${
                    activeVoiceId === v.id
                      ? 'bg-amber-500/15 border-amber-500/60 text-amber-200 shadow-sm'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold truncate">{v.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">{v.style}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Active Voice Info Box */}
          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-bold text-slate-200">{activeVoice?.name}</span>
                <span className="text-xs text-slate-400">({activeVoice?.name_en})</span>
              </div>
              <span className="text-xs text-amber-400/90 font-mono">
                مدل: Gemini 3.8 Flash Neural Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {activeVoice?.persianStylePrompt || activeVoice?.description}
            </p>
          </div>

          {/* Mandatory Benchmark Sentences List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-300 font-semibold uppercase tracking-wider">
              <span>جملات استاندارد اعتبارسنجی (Mandatory Test Sentences)</span>
              <span className="text-emerald-400 font-normal">۴ جمله استاندارد تست</span>
            </div>

            {BENCHMARK_SENTENCES.map((item, idx) => {
              const isPlaying = playingIndex === idx;
              const cacheKey = `${activeVoiceId}_${idx}`;
              const hasGenerated = Boolean(audioUrls[cacheKey]);

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isPlaying
                      ? 'bg-amber-500/10 border-amber-500/50 shadow-md'
                      : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          جمله {idx + 1}
                        </span>
                        <span className="text-xs text-amber-400 font-medium">
                          {item.category}
                        </span>
                        {hasGenerated && (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            تولید شده
                          </span>
                        )}
                      </div>

                      {/* Persian Text Display with Right-to-Left styling */}
                      <p
                        dir="rtl"
                        className="text-base text-slate-100 font-medium leading-relaxed font-sans"
                      >
                        «{item.text}»
                      </p>

                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                        <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
                        <span>معیار سنجش: {item.focus}</span>
                      </div>
                    </div>

                    {/* Play/Listen Button */}
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handlePlaySentence(idx)}
                      className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 flex-shrink-0 transition-all ${
                        isPlaying
                          ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/30'
                          : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {loading && playingIndex === idx ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>در حال سنتز...</span>
                        </>
                      ) : isPlaying ? (
                        <>
                          <Pause className="w-4 h-4" />
                          <span>توقف</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-4 h-4" />
                          <span>شنیدن صدا</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Standards & Intelligibility Guarantee Box */}
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-xs text-emerald-300 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>تضمین وضوح کامل برای شنوندگان بومی زبان فارسی (Native Intelligibility)</span>
            </div>
            <p className="text-[11px] text-emerald-300/80 leading-relaxed">
              صدای تولید شده با مدل‌های پیشرفته عصبی، تمام واج‌های زبان فارسی، تکیه هجاها و لحن طبیعی را
              رعایت می‌کند و فاقد هرگونه صدای رباتیک، بوق یا هجاهای مخدوش است.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            گوینده فعال: <strong className="text-slate-200">{activeVoice?.name}</strong>
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  );
};
