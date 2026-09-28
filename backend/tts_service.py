import os
import json
import shutil
import subprocess
import urllib.request
import urllib.error
import base64
import numpy as np
import soundfile as sf
from pathlib import Path
from typing import Dict, Any, Optional
from backend.config import config
from backend.persian_normalizer import persian_normalizer

class TTSService:
    def __init__(self):
        self.sample_rate = config.settings["tts"].get("sample_rate", 24000)
        self.models_dir = Path(config.settings["tts"].get("models_dir", "data/models/piper"))
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.piper_bin = shutil.which("piper")
        self.gemini_key = os.environ.get("GEMINI_API_KEY", "")

    def synthesize_segment(self, text: str, voice_id: str, output_path: str) -> str:
        """
        Synthesizes a single dialogue line using the selected voice profile.
        Prioritizes:
        1. Node/Express Gemini TTS Service (http://127.0.0.1:3000/api/tts)
        2. Gemini API REST endpoint directly if GEMINI_API_KEY exists
        3. Local Piper model if installed
        """
        out_p = Path(output_path)
        out_p.parent.mkdir(parents=True, exist_ok=True)

        voice = config.get_voice(voice_id)
        if not voice:
            voice = config.voices[0] if config.voices else {
                "id": "default", "speed": 1.0, "pitch": 0.0, "base_freq": 120.0, "gender": "male"
            }

        normalized_text, metadata = persian_normalizer.prepare_for_tts(text)

        # 1. Try local full-stack server TTS endpoint
        try:
            req_data = json.dumps({
                "text": normalized_text,
                "voiceId": voice_id,
                "language": "fa" if any("\u0600" <= c <= "\u06FF" for c in text) else "en"
            }).encode("utf-8")

            req = urllib.request.Request(
                "http://127.0.0.1:3000/api/tts",
                data=req_data,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=12) as response:
                if response.status == 200:
                    resp_json = json.loads(response.read().decode("utf-8"))
                    audio_b64 = resp_json.get("audioBase64")
                    if audio_b64:
                        wav_bytes = base64.b64decode(audio_b64)
                        out_p.write_bytes(wav_bytes)
                        return str(out_p)
        except Exception as e:
            # Server not reached, try next
            pass

        # 2. Try Gemini REST API directly if GEMINI_API_KEY exists
        if self.gemini_key:
            try:
                gemini_voice = "Puck" if voice.get("gender") == "male" else "Kore"
                payload = {
                    "contents": [{
                        "role": "user",
                        "parts": [{
                            "text": normalized_text,
                            "speechMetadata": {
                                "speaker": voice.get("name", "Speaker"),
                                "style": "Clear, fluent native Persian speaker"
                            }
                        }]
                    }],
                    "generationConfig": {
                        "responseModalities": ["AUDIO"],
                        "speechConfig": {
                            "voiceConfig": {
                                "prebuiltVoiceConfig": {"voiceName": gemini_voice}
                            }
                        }
                    }
                }
                api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-lite-tts:generateContent?key={self.gemini_key}"
                req = urllib.request.Request(
                    api_url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json", "User-Agent": "aistudio-build"}
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    if resp.status == 200:
                        res_body = json.loads(resp.read().decode("utf-8"))
                        part = res_body.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0]
                        b64 = part.get("inlineData", {}).get("data")
                        if b64:
                            out_p.write_bytes(base64.b64decode(b64))
                            return str(out_p)
            except Exception as e:
                print(f"[TTSService] Gemini direct call error: {e}")

        # 3. Local Piper TTS check
        model_file = self.models_dir / f"{voice.get('model', 'model')}.onnx"
        if self.piper_bin and model_file.exists():
            try:
                cmd = [
                    self.piper_bin,
                    "--model", str(model_file),
                    "--output_file", str(out_p)
                ]
                subprocess.run(
                    cmd,
                    input=normalized_text.encode("utf-8"),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=True
                )
                if out_p.exists() and out_p.stat().st_size > 500:
                    return str(out_p)
            except Exception as e:
                print(f"[TTSService] Piper invocation failed: {e}")

        # Fallback: Write valid clean silence WAV instead of buzzing/screeching noise
        sr = self.sample_rate
        duration_sec = max(1.0, len(normalized_text.split()) * 0.4)
        silence = np.zeros(int(duration_sec * sr), dtype=np.float32)
        sf.write(str(out_p), silence, sr, subtype="PCM_16")
        return str(out_p)

tts_service = TTSService()
