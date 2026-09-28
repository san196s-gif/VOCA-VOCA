# Podcast AI - Technical Architecture & Engineering Specifications

## 1. System Philosophy
Podcast AI is engineered on the principle of **computational sovereignty**:
- Zero dependencies on remote LLM endpoints (OpenAI, Anthropic, Google).
- Zero remote TTS or STT endpoints (ElevenLabs, Azure Speech, etc.).
- Complete local execution and deterministic data retention in SQLite.

## 2. Audio Pipeline Pipeline Details
1. **Source Ingestion**:
   - Spoken audio (WAV, MP3, M4A, WEBM, FLAC) is received via `POST /api/transcribe`.
   - Ingested files are passed to `faster-whisper` with automatic Voice Activity Detection (`vad_filter=True`).
   - Long-form audio is chunked into 300-second windows with overlap, returning aligned timestamps.
2. **Semantic Dialogue Partitioning (`PodcastDialogueEngine`)**:
   - Evaluates linguistic characteristics (Persian RTL vs English LTR).
   - If 1 voice is chosen, constructs structured rhetorical narration.
   - If 2–6 voices are selected:
     - Assigns functional roles (Anchor, Analyst, Inquisitor, Critic, Storyteller, Synthesizer).
     - Inserts conversational connectors, topic shifts, and natural inter-speaker reactions.
     - Preserves 100% of facts, statistics, names, and concepts.
3. **Multi-Speaker Speech Synthesis (`TTSService`)**:
   - Generates individual audio segments for each speaker line.
   - Applies voice parameters: fundamental pitch frequency ($F_0$), formants ($F_1, F_2, F_3$), vocal tract resonance, speed multiplier, and prosodic intonation contours.
4. **Mastering & Concatenation (`AudioProcessor`)**:
   - Concatenates audio segments with calculated inter-speaker pauses (default 650ms).
   - Normalizes audio to broadcast standard **EBU R128 (-16.0 LUFS)**.
   - Soft-knee peak limiting to **-1.0 dBFS** to prevent digital clipping.
   - Encodes continuous MP3 at 192 kbps or 16-bit uncompressed WAV.
