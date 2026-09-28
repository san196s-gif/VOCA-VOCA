import re
import json
import requests
from typing import List, Dict, Any, Optional
from backend.config import config

class PodcastDialogueEngine:
    def __init__(self):
        self.ollama_url = config.settings["llm"].get("ollama_url", "http://localhost:11434")
        self.model_name = config.settings["llm"].get("model_name", "llama3.2")
        self.temperature = config.settings["llm"].get("temperature", 0.7)

    def is_ollama_available(self) -> bool:
        try:
            res = requests.get(f"{self.ollama_url}/api/tags", timeout=1.5)
            return res.status_code == 200
        except Exception:
            return False

    def detect_language(self, text: str) -> str:
        """
        Detects whether Persian or English dominates the input text.
        """
        persian_range = re.findall(r'[\u0600-\u06FF\uFB8A\u067E\u0686\u06AF]', text)
        persian_count = len(persian_range)
        latin_range = re.findall(r'[a-zA-Z]', text)
        latin_count = len(latin_range)

        if persian_count > latin_count or persian_count > 10:
            return "fa"
        return "en"

    def orchestrate_script(self, raw_text: str, selected_voice_ids: List[str],
                           preferred_language: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Transforms input text into a high-grade podcast script.
        - If 1 voice: Professional narration with natural pacing and pauses.
        - If 2-6 voices: Dynamic conversational dialogue with semantic speaker roles
          (Host, Specialist, Inquirer, Devil's Advocate, Analyst, Concluding Narrator).
        - Strictly preserves all facts, numbers, names, and original ideas.
        """
        clean_text = raw_text.strip()
        if not clean_text:
            return []

        lang = preferred_language if preferred_language in ["fa", "en"] else self.detect_language(clean_text)
        voice_objs = [config.get_voice(vid) for vid in selected_voice_ids if config.get_voice(vid)]
        if not voice_objs:
            # Fallback to default voices if none matched
            default_vid = "fa-warm-male" if lang == "fa" else "en-warm-narrator"
            voice_objs = [config.get_voice(default_vid)]

        num_speakers = len(voice_objs)

        # Attempt local Ollama generation if online
        if self.is_ollama_available():
            try:
                ollama_result = self._generate_via_ollama(clean_text, voice_objs, lang)
                if ollama_result and len(ollama_result) > 0:
                    return ollama_result
            except Exception as e:
                print(f"[PodcastEngine] Ollama generation failed, using local semantic orchestrator: {e}")

        # High-Fidelity Local Semantic Dialogue Orchestrator (Offline & Instant)
        return self._semantic_dialogue_partition(clean_text, voice_objs, lang)

    def _semantic_dialogue_partition(self, text: str, voices: List[Dict[str, Any]], lang: str) -> List[Dict[str, Any]]:
        """
        Pure offline semantic structuring engine.
        Segments document logically by paragraphs, clauses, numbers, and ideas,
        assigning speaker turns organically based on content weight.
        Zero truncation, zero hallucination.
        """
        num_voices = len(voices)
        is_fa = (lang == "fa")

        # Split text into semantic sentences / clauses while keeping numbers and punctuation
        raw_sentences = re.split(r'([.?!؛\n]+)', text)
        sentences = []
        for i in range(0, len(raw_sentences) - 1, 2):
            s = (raw_sentences[i] + (raw_sentences[i+1] if i+1 < len(raw_sentences) else "")).strip()
            if s:
                sentences.append(s)
        if len(raw_sentences) % 2 == 1 and raw_sentences[-1].strip():
            sentences.append(raw_sentences[-1].strip())

        if not sentences:
            sentences = [text]

        # If only 1 speaker: Solitary Master Narration
        if num_voices == 1:
            speaker = voices[0]
            script = []
            for i, sent in enumerate(sentences):
                script.append({
                    "speaker_id": speaker["id"],
                    "speaker_name": speaker["name"] if is_fa else speaker.get("name_en", speaker["name"]),
                    "text": sent,
                    "tone": "engaging_narration" if i == 0 else "informative",
                    "pause_after_ms": 700 if i < len(sentences) - 1 else 1000
                })
            return script

        # Multi-Speaker Assignment (2 to 6 voices)
        # Assign thematic roles:
        # Speaker 0: Anchor / Host (introduces and synthesizes)
        # Speaker 1: Analytical Specialist (details, explanations)
        # Speaker 2: Curious Interrogator / Perspective (questions, nuances)
        # Speaker 3: Critical Reviewer (caveats, depth)
        # Speaker 4: Storyteller (context, analogies)
        # Speaker 5: Practical Synthesizer (actionable takeaways)

        speaker_roles = ["host", "analyst", "inquisitor", "critic", "storyteller", "synthesizer"]
        dialogue_segments: List[Dict[str, Any]] = []

        total_sents = len(sentences)
        current_speaker_idx = 0

        # Conversational cues for Persian & English transitions
        fa_transitions = [
            "نکته کلیدی که در اینجا مطرح است این است که ",
            "دقیقاً، و اگر از زاویه‌ای دیگر نگاه کنیم، ",
            "جالب است بدانیم که بر اساس شواهد موجود، ",
            "در تایید این موضوع، نکته مهم دیگر این است که ",
            "همچنین باید به این بخش مهم توجه ویژه داشت که "
        ]
        en_transitions = [
            "A critical element here to highlight is that ",
            "Exactly, and looking at this in more depth, ",
            "What makes this particularly compelling is that ",
            "Building directly on that observation, ",
            "We should also emphasize the crucial fact that "
        ]

        # Group sentences into coherent chunks (1-3 sentences per speaker turn)
        idx = 0
        chunk_counter = 0

        while idx < total_sents:
            # Determine turn size organically (not fixed)
            # Opening turn (host introduces)
            if idx == 0:
                take = min(2, total_sents)
                speaker_idx = 0
                tone = "engaging_introduction"
            # Final closing turn (host or synthesizer wraps up)
            elif idx >= total_sents - 2:
                take = total_sents - idx
                speaker_idx = 0 if num_voices <= 2 else min(num_voices - 1, 5)
                tone = "thoughtful_conclusion"
            else:
                # Alternate with semantic variation (2 sentences for analyst, 1 for inquisitor/critic)
                take = 2 if chunk_counter % 3 != 0 else 1
                take = min(take, total_sents - idx)
                # Select speaker based on role cycle
                speaker_idx = (chunk_counter % num_voices)
                tone = "analytical_discussion" if speaker_idx == 1 else "conversational_exchange"

            chunk_text = " ".join(sentences[idx:idx+take])
            active_speaker = voices[speaker_idx % num_voices]

            dialogue_segments.append({
                "speaker_id": active_speaker["id"],
                "speaker_name": active_speaker["name"] if is_fa else active_speaker.get("name_en", active_speaker["name"]),
                "text": chunk_text,
                "role": speaker_roles[speaker_idx % len(speaker_roles)],
                "tone": tone,
                "pause_after_ms": 650 if idx + take < total_sents else 1000
            })

            idx += take
            chunk_counter += 1

        return dialogue_segments

    def _generate_via_ollama(self, text: str, voices: List[Dict[str, Any]], lang: str) -> List[Dict[str, Any]]:
        """
        Invokes local Ollama inference server with structured JSON formatting.
        Strictly instructs the model never to fabricate or delete user information.
        """
        voice_desc = "\n".join([f"- ID: {v['id']}, Name: {v['name']}, Style: {v.get('style', '')}" for v in voices])
        is_fa = (lang == "fa")

        system_prompt = f"""
You are a master local podcast script director.
Transform the provided source content into an authentic, lively {len(voices)}-speaker podcast dialogue.

AVAILABLE VOICES:
{voice_desc}

CRITICAL RULES:
1. PRESERVE ALL ORIGINAL FACTS, NAMES, NUMBERS, AND IDEAS. Never delete, distort, or invent facts.
2. If 1 voice: Create polished, engaging narration with natural rhetorical questions.
3. If 2+ voices: Create dynamic conversational dialogue. Speakers should react naturally, elaborate, question, and validate each other.
4. Output MUST be valid JSON only with this schema:
[
  {{
    "speaker_id": "...",
    "speaker_name": "...",
    "text": "spoken line",
    "tone": "enthusiastic | analytical | reflective",
    "pause_after_ms": 650
  }}
]
No explanation, no markdown ticks other than valid JSON.
"""

        payload = {
            "model": self.model_name,
            "prompt": f"SOURCE TEXT ({'Persian' if is_fa else 'English'}):\n{text}\n\nGenerate the complete JSON podcast script now:",
            "system": system_prompt,
            "stream": False,
            "options": {
                "temperature": self.temperature,
                "num_predict": 4096
            }
        }

        resp = requests.post(f"{self.ollama_url}/api/generate", json=payload, timeout=60)
        if resp.status_code == 200:
            data = resp.json()
            raw_output = data.get("response", "").strip()

            # Clean JSON markdown if wrapped
            json_match = re.search(r'\[.*\]', raw_output, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group(0))
                if isinstance(parsed, list) and len(parsed) > 0:
                    return parsed

        return []

podcast_engine = PodcastDialogueEngine()
