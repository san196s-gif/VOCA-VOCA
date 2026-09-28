import React, { useState, useEffect } from 'react';
import { Sparkles, AlertCircle, Radio, PlayCircle } from 'lucide-react';
import { User } from 'firebase/auth';
import { Header } from './components/Header';
import { TextInputArea } from './components/TextInputArea';
import { VoiceSelector } from './components/VoiceSelector';
import { GenerationProgress } from './components/GenerationProgress';
import { AudioPlayer } from './components/AudioPlayer';
import { PrePublishValidation } from './components/PrePublishValidation';
import { GoogleWorkspaceModal } from './components/GoogleWorkspaceModal';
import { PersianVoiceBenchmarkModal } from './components/PersianVoiceBenchmarkModal';
import { ProviderStatusBanner } from './components/ProviderStatusBanner';
import { api } from './services/api';
import { GenerationJob, HardwareInfo, ScriptSegment, VoiceProfile } from './types';
import { VOICES } from './data/voices';
import { initAuthListener } from './services/googleWorkspace';

export default function App() {
  const [text, setText] = useState<string>('');
  // Default to 2 complementary Persian voices (one male, one female for lively conversation)
  const [selectedVoiceIds, setSelectedVoiceIds] = useState<string[]>([
    'fa-warm-male',
    'fa-warm-female',
  ]);
  const [voices, setVoices] = useState<VoiceProfile[]>(VOICES);
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [hardware, setHardware] = useState<HardwareInfo | undefined>(undefined);

  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Google Workspace & Firebase Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState<boolean>(false);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState<boolean>(false);

  // Initial check for backend availability, voices & auth listener
  useEffect(() => {
    let mounted = true;
    const initSystem = async () => {
      const status = await api.checkBackendStatus();
      if (!mounted) return;
      setBackendConnected(status.available);
      if (status.info) setHardware(status.info);

      const loadedVoices = await api.getVoices();
      if (!mounted) return;
      if (loadedVoices && loadedVoices.length > 0) {
        setVoices(loadedVoices);
      }
    };
    initSystem();

    const unsubscribe = initAuthListener(
      (user) => {
        if (mounted) setCurrentUser(user);
      },
      () => {
        if (mounted) setCurrentUser(null);
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const handleToggleVoice = (voiceId: string) => {
    setSelectedVoiceIds((prev) => {
      if (prev.includes(voiceId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== voiceId);
      } else {
        if (prev.length >= 6) return prev;
        return [...prev, voiceId];
      }
    });
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      setErrorMessage('Please enter text or transcribe an audio file first.');
      return;
    }
    if (selectedVoiceIds.length === 0) {
      setErrorMessage('Please select at least 1 voice (up to 6 voices).');
      return;
    }

    setErrorMessage(null);
    setIsGenerating(true);

    try {
      const completedJob = await api.generatePodcast(
        text,
        selectedVoiceIds,
        (updatedJob) => {
          setCurrentJob(updatedJob);
        }
      );
      setCurrentJob(completedJob);
    } catch (err: unknown) {
      console.error('Podcast generation failed:', err);
      const msg = err instanceof Error ? err.message : 'Generation encountered an error.';
      setErrorMessage(msg);
      setCurrentJob(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!currentJob) return;
    await api.publishPodcast(currentJob.id);
    setCurrentJob(prev => prev ? { ...prev, is_published: true } : null);
  };

  const handleUpdateScript = (updatedScript: ScriptSegment[]) => {
    setCurrentJob(prev => prev ? { ...prev, script: updatedScript } : null);
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Header */}
      <Header
        backendConnected={backendConnected}
        hardware={hardware}
        currentUser={currentUser}
        onOpenWorkspace={() => setIsWorkspaceOpen(true)}
        onOpenBenchmark={() => setIsBenchmarkOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 sm:py-10 space-y-6">
        {/* Provider System & Fallback Status Banner */}
        <section>
          <ProviderStatusBanner />
        </section>

        {/* Error notification banner if any */}
        {errorMessage && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <span className="flex-1">{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-xs uppercase font-bold text-rose-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 1. Large Central Input Area */}
        <section>
          <TextInputArea text={text} setText={setText} disabled={isGenerating} />
        </section>

        {/* 2. Voice Selection Section */}
        <section className="pt-2">
          <VoiceSelector
            voices={voices}
            selectedVoiceIds={selectedVoiceIds}
            onToggleVoice={handleToggleVoice}
            onOpenBenchmark={() => setIsBenchmarkOpen(true)}
            disabled={isGenerating}
          />
        </section>

        {/* 3. Primary Action Button */}
        <div className="flex justify-center pt-2">
          <button
            type="button"
            disabled={isGenerating || !text.trim() || selectedVoiceIds.length === 0}
            onClick={handleGenerate}
            className={`w-full sm:w-auto px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 transition-all duration-200 shadow-xl ${
              isGenerating || !text.trim() || selectedVoiceIds.length === 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-amber-500/25 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            {isGenerating ? (
              <>
                <Radio className="w-5 h-5 animate-pulse text-slate-950" />
                <span>Generating Podcast Studio Track...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>
                  Generate Podcast (
                  {selectedVoiceIds.length === 1
                    ? '1 Solo Voice'
                    : `${selectedVoiceIds.length} Speaker Dialogue`}
                  )
                </span>
              </>
            )}
          </button>
        </div>

        {/* 4. Active Progress Bar when running */}
        {isGenerating && currentJob && currentJob.status !== 'completed' && (
          <section className="pt-2 animate-fadeIn">
            <GenerationProgress job={currentJob} />
          </section>
        )}

        {/* 5. Pre-Publish Validation & Quality Control */}
        {currentJob && currentJob.status === 'completed' && (
          <section className="pt-2 animate-fadeIn">
            <PrePublishValidation
              job={currentJob}
              originalText={text}
              onUpdateScript={handleUpdateScript}
              onPublish={handlePublish}
              onExportDrive={() => setIsWorkspaceOpen(true)}
              onShareGmail={() => setIsWorkspaceOpen(true)}
            />
          </section>
        )}

        {/* 6. Master Audio Player & Output */}
        {currentJob && currentJob.status === 'completed' && currentJob.audio_url && (
          <section className="pt-2 animate-fadeIn">
            <AudioPlayer
              audioUrl={currentJob.audio_url}
              durationSec={currentJob.duration_sec}
              script={currentJob.script}
              onExportDrive={() => setIsWorkspaceOpen(true)}
              onShareGmail={() => setIsWorkspaceOpen(true)}
            />
          </section>
        )}
      </main>

      {/* Google Workspace Modal (Drive & Gmail) */}
      <GoogleWorkspaceModal
        isOpen={isWorkspaceOpen}
        onClose={() => setIsWorkspaceOpen(false)}
        currentUser={currentUser}
        onAuthChange={setCurrentUser}
        onImportText={(imported) => {
          setText(prev => (prev.trim() ? `${prev}\n\n${imported}` : imported));
        }}
        currentEpisode={
          currentJob && currentJob.status === 'completed' && currentJob.audio_url
            ? {
                id: currentJob.id,
                title: 'Podcast AI Episode',
                audioUrl: currentJob.audio_url,
                durationSec: currentJob.duration_sec || 60,
                script: currentJob.script || [],
                voices: currentJob.voices || selectedVoiceIds,
              }
            : null
        }
      />

      {/* Persian Voice Quality Benchmark Modal */}
      <PersianVoiceBenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
        voices={voices}
        selectedVoiceId={selectedVoiceIds[0]}
      />

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/80 py-5 px-4 text-center text-xs text-slate-500">
        <p>
          Podcast AI • Local Offline Engine • Native Persian Oratory • Google Drive & Gmail Sync
        </p>
      </footer>
    </div>
  );
}
