@echo off
title Podcast AI - Stopping Services

echo =====================================================================
echo                   STOPPING PODCAST AI SERVICES
echo =====================================================================
echo.

echo Terminating local backend (Port 8000)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8000" ^| find "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo Terminating local frontend (Port 3000)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [OK] Podcast AI services have been stopped.
timeout /t 2 >nul
exit /b 0
