import { IScriptProvider, ScriptOrchestrationResult } from './types';
import { ScriptSegment, VoiceProfile } from '../../types';
import { VOICES } from '../../data/voices';
import { PersianSpeechNormalizer } from '../persianNormalizer';
import { scriptValidator } from '../scriptValidator';

export class LocalAIProvider implements IScriptProvider {
  name = 'Local Offline Script Orchestrator';
  isOffline = true;

  async isAvailable(): Promise<boolean> {
    return true; // Always available on the user device
  }

  async orchestrateAndValidate(text: string, voiceIds: string[]): Promise<ScriptOrchestrationResult> {
    const cleanText = text.trim();
    if (!cleanText) {
      throw new Error('Input text cannot be empty');
    }

    const activeVoices = (voiceIds || [])
      .map((id) => VOICES.find((v) => v.id === id))
      .filter((v): v is VoiceProfile => Boolean(v));

    const voices = activeVoices.length > 0 ? activeVoices : [VOICES[1]];
    const isFa = /[\u0600-\u06FF]/.test(cleanText);

    // 1. Local Persian Speech Normalization
    const normalizedText = isFa ? PersianSpeechNormalizer.normalizeZwnj(cleanText) : cleanText;

    // 2. Intelligent Sentence Splitting
    const rawSentences = normalizedText.split(/([.?!؛\n]+)/);
    const sentences: string[] = [];
    for (let i = 0; i < rawSentences.length - 1; i += 2) {
      const s = (rawSentences[i] + (rawSentences[i + 1] || '')).trim();
      if (s) sentences.push(s);
    }
    if (rawSentences.length % 2 === 1 && rawSentences[rawSentences.length - 1].trim()) {
      sentences.push(rawSentences[rawSentences.length - 1].trim());
    }
    if (sentences.length === 0) sentences.push(normalizedText);

    // 3. Speaker Assignment & Dialogue Flow
    let rawSegments: ScriptSegment[] = [];

    if (voices.length === 1) {
      const speaker = voices[0];
      rawSegments = sentences.map((sent, i) => {
        const prep = isFa ? PersianSpeechNormalizer.prepareForTTS(sent) : null;
        return {
          speaker_id: speaker.id,
          speaker_name: isFa ? speaker.name : speaker.name_en,
          text: prep ? prep.normalizedText : sent,
          role: 'narrator',
          tone: i === 0 ? 'engaging_intro' : prep ? prep.metadata.register : 'narrative',
          pause_after_ms: Math.round(750 * (prep ? prep.metadata.pauseFactor : 1.0)),
        };
      });
    } else {
      const roles = ['host', 'analyst', 'inquisitor', 'critic', 'storyteller', 'synthesizer'];
      const total = sentences.length;
      let idx = 0;
      let turnCount = 0;

      while (idx < total) {
        let take = 1;
        let speakerIdx = 0;
        let tone = 'conversational';

        if (idx === 0) {
          take = Math.min(2, total);
          speakerIdx = 0;
          tone = 'engaging_introduction';
        } else if (idx >= total - 2) {
          take = total - idx;
          speakerIdx = voices.length <= 2 ? 0 : Math.min(voices.length - 1, 5);
          tone = 'thoughtful_conclusion';
        } else {
          take = turnCount % 3 !== 0 ? Math.min(2, total - idx) : 1;
          speakerIdx = turnCount % voices.length;
          tone = speakerIdx === 1 ? 'analytical_discussion' : 'conversational_exchange';
        }

        const rawChunk = sentences.slice(idx, idx + take).join(' ');
        const spk = voices[speakerIdx % voices.length];

        let finalText = rawChunk;
        let pauseAfter = 650;
        if (isFa) {
          const prep = PersianSpeechNormalizer.prepareForTTS(rawChunk);
          finalText = prep.normalizedText;
          pauseAfter = Math.round(650 * prep.metadata.pauseFactor);
          tone = `${prep.metadata.register}_${tone}`;
        }

        rawSegments.push({
          speaker_id: spk.id,
          speaker_name: isFa ? spk.name : spk.name_en,
          text: finalText,
          role: roles[speakerIdx % roles.length],
          tone,
          pause_after_ms: pauseAfter,
        });

        idx += take;
        turnCount++;
      }
    }

    // 4. Local Script Quality & Content Integrity Validation
    const { repairedScript, report } = scriptValidator.validateAndRepair(rawSegments, text, true);

    return {
      segments: repairedScript,
      validationReport: report,
      provider: this.name,
      isOffline: true,
    };
  }
}
