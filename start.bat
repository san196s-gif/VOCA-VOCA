@echo off
setlocal enabledelayedexpansion
title Podcast AI - Starting Local Services

echo =====================================================================
echo                    STARTING PODCAST AI STUDIO
echo                     (Local Offline Services)
echo =====================================================================
echo.

:: Check for virtual environment
if not exist "venv\Scripts\activate.bat" (
    echo [ERROR] Virtual environment not found. Please run install.bat first!
    pause
    exit /b 1
)

:: 1. Start Python Backend in background
echo [1/3] Starting Local Python FastAPI Backend on port 8000...
start "Podcast AI - Backend API" cmd /k "call venv\Scripts\activate.bat && python -m backend.main"

:: Small delay to let backend bind port
timeout /t 2 /nobreak >nul

:: 2. Start Frontend Dev Server
echo [2/3] Starting Local Frontend on port 3000...
start "Podcast AI - Frontend UI" cmd /k "npm run dev"

:: Small delay to let frontend start
timeout /t 3 /nobreak >nul

:: 3. Launch Local Browser
echo [3/3] Opening Podcast AI in your browser...
start http://localhost:3000

echo.
echo =====================================================================
echo           PODCAST AI IS NOW RUNNING ON YOUR COMPUTER!
echo =====================================================================
echo   Frontend:  http://localhost:3000
echo   Backend:   http://127.0.0.1:8000
echo   API Docs:  http://127.0.0.1:8000/docs
echo.
echo To stop all services, close the terminal windows or run: stop.bat
echo =====================================================================
