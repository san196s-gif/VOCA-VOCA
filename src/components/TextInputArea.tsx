import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Mic, Square, Sparkles, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

interface TextInputAreaProps {
  text: string;
  setText: React.Dispatch<React.SetStateAction<string>>;
  disabled?: boolean;
}

export const TextInputArea: React.FC<TextInputAreaProps> = ({ text, setText, disabled }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [audioFeedback, setAudioFeedback] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Auto-detect direction (Persian / Arabic RTL vs English LTR)
  const isRtl = /[\u0600-\u06FF]/.test(text.slice(0, 100));

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleAudioUpload = async (file: File) => {
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(wav|mp3|m4a|ogg|webm|flac)$/i)) {
      setAudioFeedback('Please provide a valid audio file (WAV, MP3, M4A, OGG).');
      return;
    }

    setIsTranscribing(true);
    setAudioFeedback(`Transcribing ${file.name}...`);
    try {
      const transcript = await api.transcribeAudio(file);
      setText(prev => (prev.trim() ? `${prev}\n\n${transcript}` : transcript));
      setAudioFeedback('Audio transcribed successfully! You can now edit the text below.');
    } catch {
      setAudioFeedback('Transcription error. Please verify the audio file.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsTranscribing(true);
        setAudioFeedback('Transcribing microphone recording...');
        try {
          const transcript = await api.transcribeAudio(audioBlob);
          setText(prev => (prev.trim() ? `${prev}\n\n${transcript}` : transcript));
          setAudioFeedback('Voice recording transcribed successfully!');
        } catch {
          setAudioFeedback('Could not transcribe audio.');
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordDuration(0);
      timerRef.current = window.setInterval(() => {
        setRecordDuration(d => d + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      setAudioFeedback('Microphone permission required for voice recording.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleAudioUpload(e.dataTransfer.files[0]);
    }
  };

  const loadSamplePersian = () => {
    setText(
      `هوش مصنوعی و یادگیری ماشین تحولی بنیادین در دنیای فناوری و ارتباطات به وجود آورده‌اند.\n` +
      `امروزه مدل‌های زبانی محلی می‌توانند بدون نیاز به اینترنت و بدون ارسال داده‌ها به سرورهای خارجی، تحلیل‌های عمیق و تخصصی انجام دهند.\n` +
      `این امر نه تنها امنیت اطلاعات و حریم خصوصی را تضمین می‌کند، بلکه سرعت و پایداری پردازش‌ها را به شکل چشمگیری افزایش می‌دهد.\n` +
      `در این پادکست، ما به بررسی ابعاد گوناگون این انقلاب تکنولوژیک، چالش‌های پیش‌رو و فرصت‌های بی‌نظیر آن برای پژوهشگران و توسعه‌دهندگان می‌پردازیم.`
    );
    setAudioFeedback(null);
  };

  const loadSampleEnglish = () => {
    setText(
      `Artificial intelligence and on-device machine learning represent a monumental leap in software architecture.\n` +
      `By deploying speech models and inference engines directly on local hardware, users gain absolute privacy and real-time responsiveness.\n` +
      `Data is no longer routed through third-party cloud infrastructure, eliminating both telemetry risks and recurring subscription overhead.\n` +
      `Throughout this episode, we unpack how open-source weights, optimized quantizations, and neural audio synthesis are shaping the future of autonomous media.`
    );
    setAudioFeedback(null);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="w-full space-y-3">
      {/* Top action bar: Samples & Tools */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-300">Input Source</span>
          <span className="text-slate-600">•</span>
          <button
            type="button"
            onClick={loadSamplePersian}
            className="hover:text-amber-400 transition-colors underline decoration-slate-700 underline-offset-4"
          >
            Persian Sample (نمونه فارسی)
          </button>
          <span className="text-slate-600">•</span>
          <button
            type="button"
            onClick={loadSampleEnglish}
            className="hover:text-amber-400 transition-colors underline decoration-slate-700 underline-offset-4"
          >
            English Sample
          </button>
        </div>

        {text.length > 0 && (
          <button
            type="button"
            onClick={() => { setText(''); setAudioFeedback(null); }}
            className="hover:text-rose-400 transition-colors"
          >
            Clear Text
          </button>
        )}
      </div>

      {/* Main Central Input Area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`relative rounded-2xl border transition-all duration-200 overflow-hidden bg-slate-900/60 backdrop-blur-sm ${
          isDragOver
            ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-950/20'
            : 'border-slate-800 focus-within:border-amber-500/70 focus-within:ring-2 focus-within:ring-amber-500/10'
        }`}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled || isTranscribing}
          dir={isRtl ? 'rtl' : 'ltr'}
          placeholder="Enter or paste your text here, drop an audio file, or record from your microphone to generate your multi-speaker podcast..."
          className={`w-full h-56 p-4 sm:p-5 bg-transparent resize-y text-slate-100 placeholder-slate-500 focus:outline-none text-base leading-relaxed ${
            isRtl ? 'font-[\'Vazirmatn\',sans-serif]' : 'font-sans'
          }`}
        />

        {/* Bottom Toolbar inside Input Area */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-800/80 bg-slate-950/40">
          {/* Audio Input Actions */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm,.flac"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleAudioUpload(e.target.files[0]);
                }
              }}
            />

            <button
              type="button"
              disabled={disabled || isTranscribing || isRecording}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/70 hover:bg-slate-700 border border-slate-700/60 transition-all hover:text-white disabled:opacity-50"
              title="Upload Audio for Speech-to-Text"
            >
              <UploadCloud className="w-4 h-4 text-amber-400" />
              <span>Upload Audio</span>
            </button>

            {!isRecording ? (
              <button
                type="button"
                disabled={disabled || isTranscribing}
                onClick={startRecording}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/70 hover:bg-slate-700 border border-slate-700/60 transition-all hover:text-white disabled:opacity-50"
                title="Record Speech from Microphone"
              >
                <Mic className="w-4 h-4 text-emerald-400" />
                <span>Record Voice</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 bg-rose-950/50 border border-rose-800 animate-pulse"
              >
                <Square className="w-3.5 h-3.5 text-rose-400 fill-current" />
                <span>Stop ({formatTimer(recordDuration)})</span>
              </button>
            )}

            {isTranscribing && (
              <div className="flex items-center gap-2 text-xs text-amber-400 font-medium px-2 py-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Transcribing Speech...</span>
              </div>
            )}
          </div>

          {/* Counts */}
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>{wordCount.toLocaleString()} words</span>
            <span className="text-slate-700">•</span>
            <span>{charCount.toLocaleString()} characters</span>
          </div>
        </div>
      </div>

      {/* Transcription / Audio Feedback Notice */}
      {audioFeedback && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{audioFeedback}</span>
        </div>
      )}
    </div>
  );
};
