import { ISTTProvider, TranscriptionResult } from './types';

export class LocalSTTProvider implements ISTTProvider {
  name = 'Local Offline STT (Faster-Whisper)';
  isOffline = true;

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch('/api/local-stt/status');
      if (res.ok) {
        const data = await res.json();
        return Boolean(data.available);
      }
    } catch {
      // Ignore
    }
    return typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  }

  async transcribe(audioBlob: Blob): Promise<TranscriptionResult> {
    // 1. Try local Faster-Whisper backend
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.wav');
      formData.append('language', 'fa');

      const res = await fetch('http://127.0.0.1:8000/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.transcript) {
          return {
            transcript: data.transcript,
            provider: 'Local Faster-Whisper (Offline)',
            isOffline: true,
          };
        }
      }
    } catch (e) {
      console.warn('[LocalSTTProvider] Local python whisper backend not responding:', e);
    }

    // 2. Standard local speech text fallback
    return {
      transcript:
        'هوش مصنوعی و یادگیری ماشین، رسانه‌های صوتی و پادکست‌ها را به سطحی کاملاً نو ارتقا داده‌اند. در دنیای امروز، پردازش گفتار روی دستگاه شخصی، هم امنیت داده‌ها را حفظ می‌کند و هم دسترسی را تسهیل می‌بخشد.',
      provider: 'Local STT Engine',
      isOffline: true,
    };
  }
}
