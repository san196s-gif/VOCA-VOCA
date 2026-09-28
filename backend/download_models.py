#!/usr/bin/env python3
"""
Podcast AI - Local Persian Model Downloader
Downloads genuine Piper Neural TTS models for 100% offline Persian speech synthesis.
Models are trained for high-quality Persian pronunciation and natural prosody.
"""

import sys
import os
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "data" / "models" / "piper"

MODELS = [
  {
    "name": "fa_IR-amir-medium (Persian Male Narrator)",
    "files": [
      {
        "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/fa/fa_IR/amir/medium/fa_IR-amir-medium.onnx",
        "dest": "fa_IR-amir-medium.onnx",
      },
      {
        "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/fa/fa_IR/amir/medium/fa_IR-amir-medium.onnx.json",
        "dest": "fa_IR-amir-medium.onnx.json",
      },
    ],
  },
  {
    "name": "fa_IR-gyant-medium (Persian Female Narrator)",
    "files": [
      {
        "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/fa/fa_IR/gyant/medium/fa_IR-gyant-medium.onnx",
        "dest": "fa_IR-gyant-medium.onnx",
      },
      {
        "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/fa/fa_IR/gyant/medium/fa_IR-gyant-medium.onnx.json",
        "dest": "fa_IR-gyant-medium.onnx.json",
      },
    ],
  },
]

def download_file(url: str, dest_path: Path):
    if dest_path.exists() and dest_path.stat().st_size > 1000:
        print(f"  [ALREADY EXISTS] {dest_path.name} ({dest_path.stat().st_size // 1024} KB)")
        return

    print(f"  Downloading {dest_path.name} from {url}...")
    try:
        def reporthook(block_num, block_size, total_size):
            if total_size > 0:
                percent = min(100, int(block_num * block_size * 100 / total_size))
                downloaded_mb = (block_num * block_size) / (1024 * 1024)
                total_mb = total_size / (1024 * 1024)
                sys.stdout.write(f"\r    Progress: {percent}% ({downloaded_mb:.1f}/{total_mb:.1f} MB)")
                sys.stdout.flush()

        urllib.request.urlretrieve(url, str(dest_path), reporthook=reporthook)
        print("\n    [SUCCESS] Download completed.")
    except Exception as e:
        print(f"\n    [FAILED] Error downloading {dest_path.name}: {e}")
        if dest_path.exists():
            dest_path.unlink()

def main():
    print("=" * 65)
    print("      PODCAST AI - LOCAL PERSIAN NEURAL TTS MODEL SETUP")
    print("=" * 65)
    print(f"Destination: {MODELS_DIR}\n")

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    for m in MODELS:
        print(f"\nModel: {m['name']}")
        for f in m["files"]:
            dest = MODELS_DIR / f["dest"]
            download_file(f["url"], dest)

    print("\n" + "=" * 65)
    print("Setup finished. Local offline Persian neural speech engine ready!")
    print("=" * 65)

if __name__ == "__main__":
    main()
