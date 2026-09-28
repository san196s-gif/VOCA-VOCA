# Windows 10 & 11 Installation & Operation Guide

## 1. Prerequisites Checklist
Before executing `install.bat`, ensure:
- **Windows 10 (Version 2004+) or Windows 11 (64-bit)**
- **Python 3.10+**:
  - Download installer from [python.org](https://www.python.org/downloads/)
  - **CRITICAL**: Check the box **"Add Python to PATH"** in the installer wizard.
- **Node.js (LTS version 18 or 20)**:
  - Download installer from [nodejs.org](https://nodejs.org/)
- **FFmpeg (Audio processor)**:
  - `install.bat` will attempt auto-installation using `winget install Gyan.FFmpeg`.
  - Alternatively, download essentials build from [gyan.dev/ffmpeg/builds](https://www.gyan.dev/ffmpeg/builds/) and place `ffmpeg.exe` in your Windows PATH.

## 2. One-Click Setup
1. Extract the `podcast-ai` folder to your desired directory (e.g., `C:\PodcastAI`).
2. Double-click `install.bat`.
3. Wait for the terminal to configure the virtual environment and install packages.
4. When installation reports `[OK] INSTALLATION COMPLETED SUCCESSFULLY!`, press any key to finish.

## 3. Starting the Studio
Double-click `start.bat`:
- It activates the Python virtual environment and starts the FastAPI server on port 8000.
- It starts the React Studio on port 3000.
- It opens your web browser to `http://localhost:3000`.

## 4. Hardware Optimization & GPU Acceleration (NVIDIA CUDA)
If your computer has an NVIDIA GPU:
1. Open terminal in the project directory.
2. Activate venv:
   ```cmd
   venv\Scripts\activate.bat
   ```
3. Install PyTorch with CUDA 12.1:
   ```cmd
   pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
   ```
4. Podcast AI will automatically detect CUDA and enable GPU acceleration for `faster-whisper`.

## 5. Offline Ollama Setup (Local LLM)
If you wish to use a local LLM for conversational dialogue orchestration:
1. Download Ollama for Windows from [ollama.com](https://ollama.com).
2. Open terminal and run:
   ```cmd
   ollama pull llama3.2
   ```
3. Podcast AI automatically communicates with Ollama at `http://localhost:11434` if active. If Ollama is closed, Podcast AI immediately uses its built-in offline semantic dialogue orchestrator.
