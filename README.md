# PODCAST AI 🎙️
### Production-Ready, 100% Offline Local Multi-Speaker Podcast Generation Studio

**Podcast AI** transforms raw text, documents, or spoken audio into rich, dynamic multi-speaker podcasts entirely on your local computer. It operates with **zero cloud dependencies**—no OpenAI, Google, or remote servers are contacted. Your data, transcripts, and audio never leave your device.

---

## ⚡ Key Highlights

- **100% Local & Offline**: Operates fully disconnected from the internet after initial setup.
- **Native Persian Voice Quality & Oratory Architecture**:
  - **Distinctive Vocal Identity**: Each voice preserves its depth, timbre, resonance, age impression, and personality across both Persian and English. A "Deep Cinematic Male" remains deep and authoritative in Persian; a "Warm Female Narrator" remains warm and expressive.
  - **Persian Speech Normalization Layer (`backend/persian_normalizer.py`, `src/services/persianNormalizer.ts`)**:
    - Converts digits, dates, currencies, and percentages into natural Persian spoken words (e.g. 1403 -> یک هزار و چهارصد و سه, 25% -> بیست و پنج درصد).
    - Cleans Arabic glyphs into standard Persian and normalizes Nim-faseleh (ZWNJ `\u200c`) for prefixes and suffixes.
    - Preserves accurate English technical terms (AI, LLM, Machine Learning) inside Persian sentences.
    - Context-aware oratorical register detection (Documentary, Literary, Dramatic, Casual Podcast) adjusting sentence stress, cadence, and rhetorical pauses.
- **Google Workspace Integration**:
  - **Google Drive**: Import text documents or audio directly from Google Drive; export and save generated podcast masters (MP3/WAV) to Drive.
  - **Gmail**: Share podcast episodes, audio links, and transcript summaries via Gmail with user confirmation.
- **Cloud Database Options (Hybrid Local & Cloud Sync)**:
  - **Local SQLite**: Default offline database in `data/podcast.db`.
  - **Firebase Firestore**: Cloud sync for user projects, saved episodes, and transcriptions with hardened security rules.
  - **Cloud SQL (PostgreSQL)**: Scalable relational database in `asia-southeast1` configured via Drizzle ORM (`src/db/schema.ts`).
- **Local Speech-to-Text (STT)**: Integrated with `faster-whisper` (CTranslate2) for high-speed transcription of long audio with timestamp alignment.
- **Intelligent Multi-Speaker Dialogue Engine**:
  - **1 Voice**: Generates cohesive, professional narration.
  - **2 to 6 Voices**: Semantically assigns conversational roles (Host, Technical Specialist, Inquisitor, Critic, Storyteller, Synthesizer).
  - **Zero Information Distortion**: Guarantees that all facts, numbers, names, and original ideas are strictly preserved without hallucination or arbitrary truncation.
- **20 Specialized Voice Profiles**: 10 Persian voices + 10 International English voices (Deep Cinematic, Warm Narrator, Documentary, Serious, Young, Mature, Contralto, etc.).
- **Pro Audio Mastering Engine**: Inter-speaker pause calculation (400–800ms), EBU R128 loudness normalization (-16.0 LUFS), sample rate alignment (44.1kHz stereo), peak clipping prevention, and MP3/WAV export.
- **Minimal, Zero-Clutter Interface**: One central page with input, voice selector, generation progress, audio waveform player, and instant download.

---

## 🖥️ System Requirements

| Component | Minimum | Recommended |
| :--- | :--- | :--- |
| **Operating System** | Windows 10 / 11 (64-bit), Linux, macOS | Windows 11 (64-bit) |
| **Processor (CPU)** | 4-Core x86_64 / Apple Silicon | 8-Core Intel / AMD Ryzen |
| **Memory (RAM)** | 8 GB | 16 GB or 32 GB |
| **Graphics (GPU)** | Not required (CPU fallback automatic) | NVIDIA GPU with 4GB+ VRAM (CUDA) |
| **Disk Space** | 4 GB free disk space | 15 GB (for large Whisper/LLM models) |
| **Software** | Python 3.10+, Node.js 18+, FFmpeg | Python 3.11, Node.js 20, FFmpeg |

---

## 🚀 Quick Start (Windows 10 / 11)

### 1. Installation
Double-click `install.bat` or run in terminal:
```cmd
install.bat
```
The installer automatically:
1. Verifies Windows environment, Python 3.10+, and Node.js.
2. Detects or installs FFmpeg via `winget`.
3. Creates the Python virtual environment (`venv`).
4. Installs backend dependencies (`backend/requirements.txt`).
5. Installs frontend UI packages (`npm install`).
6. Creates local storage directories (`data/audio`, `data/transcripts`, `data/models`, `data/temp`).

### 2. Starting the Studio
Double-click `start.bat` or run:
```cmd
start.bat
```
This boots:
- The FastAPI Python Backend on `http://127.0.0.1:8000`
- The React Frontend Studio on `http://localhost:3000`
- Opens your default web browser automatically.

### 3. Shutting Down
To stop all local processes cleanly:
```cmd
stop.bat
```

*(On Linux / macOS, use `./install.sh`, `./start.sh`, and `./stop.sh`)*

---

## 🎧 Voice Profiles (20 Included)

### Persian Voices (فارسی)
1. **آرش (سینمایی بم)** - `fa-deep-cinematic-male`: بم و طنین‌انداز، مناسب برای مقدمه‌های حماسی و فلسفی.
2. **امید (گرم و صمیمی)** - `fa-warm-male`: صدای دوستانه و آرامش‌بخش، عالی برای میزبان اصلی گفتگو.
3. **بهرام (مستند علمی)** - `fa-documentary-male`: دقیق و مقتدر، طراحی شده برای تحلیل داده‌ها و مستند.
4. **کامران (جدی و تحلیلی)** - `fa-serious-male`: قاطع و رسمی، برای نقد، تحلیل اقتصادی و دیدگاه‌های موشکافانه.
5. **نیما (جوان و پرانرژی)** - `fa-young-male`: ریتم پویا و کنجکاو، ایده‌آل برای پرسش‌گری و فناوری.
6. **پرویز (باتجربه و خردمند)** - `fa-mature-male`: پخته با طمأنینه و وقار، نمایانگر تجربه تاریخی و کارشناسی ارشد.
7. **سارا (گرم و شنیدنی)** - `fa-warm-female`: لطیف و دلنشین، فوق‌العاده برای ارتباط نزدیک با مخاطب.
8. **رویا (سینمایی عمیق)** - `fa-cinematic-female`: دراماتیک و رازآلود، مناسب برای داستان‌سرایی و لحظات عمیق.
9. **مریم (مستند و گزارشگر)** - `fa-documentary-female`: روشن و دانشگاهی، برای تبیین مفاهیم علمی.
10. **نگار (جوان و پویا)** - `fa-young-female`: شاداب و پرحرارت، برای گفتگوهای استارتاپی و اجتماعی.

### International Voices (English)
1. **Marcus (Deep Cinematic Male)** - `en-deep-cinematic-male`: Baritone gravitas for atmospheric narratives.
2. **Arthur (Warm Narrator)** - `en-warm-narrator`: Classic storytelling warmth with broadcast polish.
3. **David (Documentary Male)** - `en-documentary-male`: Objective, articulate pacing for nonfiction.
4. **Victor (Dramatic Male)** - `en-dramatic-male`: Intense emotional delivery with calculated pauses.
5. **Leo (Young Male)** - `en-young-male`: Modern upbeat podcast co-host voice.
6. **Sterling (Mature Male)** - `en-mature-male`: Professorial authority with rich acoustic texture.
7. **Helena (Deep Female)** - `en-deep-female`: Contralto range, grounded and commanding.
8. **Elena (Warm Female)** - `en-warm-female`: Inviting, conversational anchor tone.
9. **Claire (Cinematic Female)** - `en-cinematic-female`: Nuanced, expressive delivery with cinematic intimacy.
10. **Rachel (Documentary Female)** - `en-documentary-female`: Precise, investigative scientific cadence.

---

## 🏗️ Architecture & Data Flow

```
                      LOCAL WORKSTATION (Offline)
                                   │
                                   ▼
                      React UI (Vite / TS / Tailwind)
                            [http://localhost:3000]
                                   │
                                   ▼
                      FastAPI Local REST API (Python)
                           [http://127.0.0.1:8000]
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
   Speech-to-Text           Podcast Engine             Text-to-Speech
  (faster-whisper)         (Semantic / Ollama)       (Piper / Acoustic)
         │                         │                         │
         │ (Persian/English)       │ (Dialogue script)       │ (WAV segments)
         └─────────────────────────┼─────────────────────────┘
                                   ▼
                         FFmpeg Audio Mastering
                     (Loudness EBU R128 -16 LUFS)
                     (Stereo 44.1kHz / Limiter)
                                   │
                                   ▼
                         Local Storage (SQLite)
                       `data/audio/job-xxxx.mp3`
```

---

## ⚙️ Configuration Files

- `config/config.yaml`: Core system parameters (ports, storage paths, STT model size, audio normalization, Ollama URL).
- `config/voices.yaml`: Detailed acoustic profiles, fundamental frequencies, formant frequencies, speeds, and pitch adjustments for all 20 voices.

---

## 🧪 Automated Testing

Run the included automated tests:
```bash
pytest tests/
```
Tests cover:
- Configuration validation (20 voice profiles)
- Semantic speaker assignment (Persian and English)
- Acoustic voice synthesis
- Multi-segment audio concatenation and normalization
- Job queue lifecycle in SQLite
- Complete End-to-End pipeline (`tests/test_end_to_end.py`)

---

## 🔒 Security & Privacy Guarantee

- Binds to `127.0.0.1` by default (no external network ports opened).
- No external analytics, telemetry, or remote API calls.
- Pure local file storage in the `data/` directory.
