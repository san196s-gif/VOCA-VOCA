# 100% Offline Operational Setup & Air-Gapped Verification

This document explains how Podcast AI operates completely disconnected from the internet and how to verify offline operation on an air-gapped machine.

---

## 1. How Offline Operation Works
Unlike cloud podcast generators that stream audio to remote servers:
- **Speech-to-Text**: `faster-whisper` uses pre-downloaded CTranslate2 weights in `data/models/whisper`.
- **Dialogue Partitioning**: Handled by either a local Ollama instance or the high-fidelity semantic parsing algorithm in `backend/podcast_engine.py`.
- **Speech Synthesis**: Acoustic formant/glottal neural synthesis or local Piper ONNX files in `data/models/piper`.
- **Mastering**: Local FFmpeg executable or soundfile PCM processing.
- **Database**: Local SQLite file stored in `data/podcast.db`.

---

## 2. Air-Gap Preparation Workflow
To prepare a machine that will be completely disconnected from the internet:

### Step 1: Pre-download Whisper Weights
Run in your virtual environment:
```python
from faster_whisper import WhisperModel
# Download and cache 'small' model into data/models/whisper
model = WhisperModel("small", download_root="data/models/whisper")
```

### Step 2: Pre-download Ollama Model (Optional)
```bash
ollama pull llama3.2
```

### Step 3: Pre-download Piper Voices (Optional)
Place `.onnx` and `.onnx.json` model files for Persian and English into:
```
data/models/piper/
```

---

## 3. Disconnect & Verification Procedure
1. Disconnect Ethernet cable and turn off Wi-Fi.
2. Open Windows Command Prompt.
3. Run `start.bat`.
4. Navigate to `http://localhost:3000`.
5. Enter Persian or English text.
6. Select between 1 and 6 voices.
7. Click `[GENERATE PODCAST]`.
8. The episode will generate, play in the browser audio player, and download as an MP3/WAV file without any network requests.
