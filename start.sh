#!/usr/bin/env bash
echo "Starting Podcast AI Local Backend..."
source venv/bin/activate
python3 -m backend.main &
BACKEND_PID=$!

echo "Starting Frontend..."
npm run dev &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID, Frontend PID: $FRONTEND_PID"
echo "$BACKEND_PID" > .backend.pid
echo "$FRONTEND_PID" > .frontend.pid

echo "Podcast AI is running at http://localhost:3000 (Backend: http://127.0.0.1:8000)"
wait
