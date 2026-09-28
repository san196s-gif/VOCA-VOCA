#!/usr/bin/env bash
set -e

echo "====================================================================="
echo "                    PODCAST AI - LOCAL INSTALLER"
echo "====================================================================="

command -v python3 >/dev/null 2>&1 || { echo "[ERROR] python3 is required. Aborting." >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "[ERROR] node is required. Aborting." >&2; exit 1; }

echo "[1/4] Setting up Python virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

echo "[2/4] Installing Frontend dependencies..."
npm install

echo "[3/5] Preparing directories..."
mkdir -p data/audio data/transcripts data/projects data/models data/models/piper data/temp

echo "[4/5] Downloading Local Persian Neural Voice Models (Piper ONNX)..."
python3 backend/download_models.py || echo "[NOTICE] Run 'python3 backend/download_models.py' later to download offline Persian models."

echo "[5/5] Installation complete! Run './start.sh' to launch."
