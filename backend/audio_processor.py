import os
import shutil
import subprocess
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional
import soundfile as sf
from backend.config import config

class AudioProcessor:
    def __init__(self):
        self.sample_rate = config.settings["audio"].get("sample_rate", 44100)
        self.channels = config.settings["audio"].get("channels", 2)
        self.target_lufs = config.settings["audio"].get("target_lufs", -16.0)
        self.max_peak_db = config.settings["audio"].get("max_peak_db", -1.0)
        self.ffmpeg_bin = shutil.which("ffmpeg")

    def has_ffmpeg(self) -> bool:
        return self.ffmpeg_bin is not None

    def create_silence(self, duration_ms: int, sample_rate: Optional[int] = None) -> np.ndarray:
        sr = sample_rate or self.sample_rate
        num_samples = int((duration_ms / 1000.0) * sr)
        if self.channels == 2:
            return np.zeros((num_samples, 2), dtype=np.float32)
        return np.zeros((num_samples,), dtype=np.float32)

    def normalize_loudness(self, audio_data: np.ndarray, target_db: float = -16.0) -> np.ndarray:
        """
        Normalize audio perceived loudness with peak ceiling to prevent digital clipping.
        Uses RMS and peak calculations with smooth limiter curve.
        """
        if len(audio_data) == 0:
            return audio_data

        # Calculate current RMS
        rms = np.sqrt(np.mean(np.square(audio_data)))
        if rms < 1e-6:
            return audio_data

        current_db = 20 * np.log10(rms + 1e-9)
        gain_db = target_db - current_db
        gain = 10 ** (gain_db / 20.0)

        # Apply gain
        normalized = audio_data * gain

        # Peak limiter ceiling (-1.0 dBFS ~= 0.891)
        ceiling = 10 ** (self.max_peak_db / 20.0)
        peak = np.max(np.abs(normalized))
        if peak > ceiling:
            # Soft knee limiting compression to prevent clipping distortion
            normalized = np.tanh(normalized / ceiling) * ceiling

        return normalized.astype(np.float32)

    def concatenate_segments(self, segment_files: List[str], output_path: str,
                             pause_ms: int = 650) -> Dict[str, Any]:
        """
        Concatenates dialogue segment audio files with exact inter-speaker pauses,
        consistent loudness normalization, and export to MP3 or WAV.
        """
        out_path = Path(output_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)

        audio_parts: List[np.ndarray] = []
        silence_segment = self.create_silence(pause_ms)

        total_samples = 0
        for i, fpath in enumerate(segment_files):
            p = Path(fpath)
            if not p.exists():
                continue

            try:
                data, sr = sf.read(str(p), dtype="float32")
                # Ensure 2 channels
                if data.ndim == 1 and self.channels == 2:
                    data = np.column_stack((data, data))
                elif data.ndim == 2 and data.shape[1] == 1 and self.channels == 2:
                    data = np.column_stack((data[:, 0], data[:, 0]))

                # Resample if sample rate differs
                if sr != self.sample_rate:
                    from scipy import signal
                    new_length = int(len(data) * self.sample_rate / sr)
                    data = signal.resample(data, new_length)

                # Normalize segment loudness
                data = self.normalize_loudness(data, target_db=self.target_lufs)

                audio_parts.append(data)
                total_samples += len(data)

                # Insert inter-speaker pause between segments
                if i < len(segment_files) - 1:
                    audio_parts.append(silence_segment)
                    total_samples += len(silence_segment)
            except Exception as e:
                print(f"[AudioProcessor] Warning loading segment {fpath}: {e}")

        if not audio_parts:
            # Generate 1 sec blank audio if empty
            blank = self.create_silence(1000)
            audio_parts = [blank]
            total_samples = len(blank)

        full_audio = np.concatenate(audio_parts, axis=0)

        # Final master normalization
        full_audio = self.normalize_loudness(full_audio, target_db=self.target_lufs)

        duration_sec = len(full_audio) / float(self.sample_rate)

        # Write intermediate WAV master
        temp_wav = out_path.with_suffix(".temp.wav")
        sf.write(str(temp_wav), full_audio, self.sample_rate, subtype="PCM_16")

        # Encode to target format (MP3 if FFmpeg available, otherwise clean WAV)
        if out_path.suffix.lower() == ".mp3" and self.has_ffmpeg():
            try:
                cmd = [
                    self.ffmpeg_bin, "-y",
                    "-i", str(temp_wav),
                    "-codec:a", "libmp3lame",
                    "-b:a", config.settings["audio"].get("mp3_bitrate", "192k"),
                    "-ar", str(self.sample_rate),
                    str(out_path)
                ]
                subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
                if temp_wav.exists():
                    temp_wav.unlink()
            except Exception as e:
                print(f"[AudioProcessor] FFmpeg MP3 encoding fallback: {e}")
                shutil.copy2(str(temp_wav), str(out_path))
                if temp_wav.exists():
                    temp_wav.unlink()
        else:
            if temp_wav.exists():
                shutil.move(str(temp_wav), str(out_path))

        return {
            "file_path": str(out_path),
            "duration_sec": round(duration_sec, 2),
            "sample_rate": self.sample_rate,
            "channels": self.channels,
            "format": out_path.suffix.lstrip(".").lower()
        }

audio_processor = AudioProcessor()
