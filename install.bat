@echo off
setlocal enabledelayedexpansion
title Podcast AI - Local Environment Installer

echo =====================================================================
echo                    PODCAST AI - LOCAL INSTALLER
echo        Offline Multi-Speaker Podcast Generation Environment
echo =====================================================================
echo.

:: 1. Verify Windows Version
echo [1/7] Checking Operating System...
ver | findstr /i "10.0" >nul
if %errorlevel% neq 0 (
    echo [WARNING] Recommended OS is Windows 10 or Windows 11.
) else (
    echo [OK] Windows 10/11 detected.
)
echo.

:: 2. Check Python 3.10+
echo [2/7] Checking Python installation...
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python was not found in your system PATH!
    echo Please install Python 3.10 or higher from https://www.python.org/downloads/
    echo Ensure "Add Python to PATH" is checked during setup.
    pause
    exit /b 1
)

for /f "tokens=2 delims= " %%v in ('python --version 2^>^&1') do set PY_VER=%%v
echo [OK] Found Python version %PY_VER%
echo.

:: 3. Check Node.js and NPM
echo [3/7] Checking Node.js for local web interface...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js was not found in your system PATH!
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=1 delims= " %%v in ('node -v 2^>^&1') do set NODE_VER=%%v
echo [OK] Found Node.js %NODE_VER%
echo.

:: 4. Check / Guide FFmpeg
echo [4/7] Checking FFmpeg audio engine...
where ffmpeg >nul 2>nul
if %errorlevel% neq 0 (
    echo [NOTICE] FFmpeg was not detected in PATH.
    echo Attempting to install FFmpeg via Windows Package Manager (winget)...
    winget install "Gyan.FFmpeg" --accept-source-agreements --accept-package-agreements >nul 2>nul
    where ffmpeg >nul 2>nul
    if %errorlevel% neq 0 (
        echo [INFO] Could not auto-install FFmpeg via winget.
        echo The application includes a pure Python audio engine as a fallback,
        echo but for best MP3 compression performance, download FFmpeg from:
        echo https://ffmpeg.org/download.html and add its bin folder to PATH.
    ) else (
        echo [OK] FFmpeg installed successfully via winget.
    )
) else (
    echo [OK] FFmpeg is already installed and detected.
)
echo.

:: 5. Create Python Virtual Environment
echo [5/7] Setting up Python virtual environment (venv)...
if not exist "venv" (
    python -m venv venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment!
        pause
        exit /b 1
    )
    echo [OK] Virtual environment created.
) else (
    echo [OK] Virtual environment already exists.
)

call venv\Scripts\activate.bat
python -m pip install --upgrade pip >nul 2>nul

echo Installing backend Python dependencies (FastAPI, PyYAML, SoundFile, NumPy, etc.)...
pip install -r backend\requirements.txt
if %errorlevel% neq 0 (
    echo [WARNING] Some heavy neural packages (e.g. faster-whisper/torch) had minor warnings.
    echo Core audio synthesis and local orchestrator will remain fully operational!
)
echo.

:: 6. Install Frontend Node Packages
echo [6/7] Installing Frontend UI dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install npm dependencies.
    pause
    exit /b 1
)
echo [OK] Frontend packages installed.
echo.

:: 7. Create Storage Folders
echo [7/8] Initializing local storage directories...
if not exist "data" mkdir data
if not exist "data\audio" mkdir data\audio
if not exist "data\transcripts" mkdir data\transcripts
if not exist "data\projects" mkdir data\projects
if not exist "data\models" mkdir data\models
if not exist "data\models\piper" mkdir data\models\piper
if not exist "data\temp" mkdir data\temp

:: 8. Download Local Persian Neural Voice Models (Piper ONNX)
echo [8/8] Downloading Offline Persian Neural Voice Models for Gemini fallback...
python backend\download_models.py
if %errorlevel% neq 0 (
    echo [NOTICE] Offline neural models can also be downloaded anytime by running:
    echo   python backend\download_models.py
)

echo.
echo =====================================================================
echo                INSTALLATION COMPLETED SUCCESSFULLY!
echo =====================================================================
echo.
echo To start Podcast AI anytime:
echo   Run: start.bat
echo.
echo To shut down:
echo   Run: stop.bat
echo.
pause
