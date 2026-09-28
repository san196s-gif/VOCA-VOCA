import os
import yaml
from pathlib import Path
from typing import Dict, Any, List

# Locate project base directory
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
CONFIG_DIR = PROJECT_ROOT / "config"
DATA_DIR = PROJECT_ROOT / "data"

def load_yaml(file_path: Path) -> Dict[str, Any]:
    if file_path.exists():
        with open(file_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    return {}

# Default application settings
DEFAULT_CONFIG: Dict[str, Any] = {
    "server": {
        "host": "127.0.0.1",
        "port": 8000,
        "cors_origins": ["http://localhost:3000", "http://127.0.0.1:3000"]
    },
    "storage": {
        "base_dir": str(DATA_DIR),
        "audio_dir": str(DATA_DIR / "audio"),
        "transcripts_dir": str(DATA_DIR / "transcripts"),
        "projects_dir": str(DATA_DIR / "projects"),
        "models_dir": str(DATA_DIR / "models"),
        "temp_dir": str(DATA_DIR / "temp"),
        "database_file": str(DATA_DIR / "podcast.db")
    },
    "hardware": {
        "device": "auto",
        "compute_type": "auto",
        "min_disk_free_gb": 2.0
    },
    "stt": {
        "engine": "faster-whisper",
        "model_size": "small",
        "device": "auto",
        "beam_size": 5,
        "chunk_duration_sec": 300
    },
    "llm": {
        "engine": "ollama",
        "ollama_url": "http://localhost:11434",
        "model_name": "llama3.2",
        "temperature": 0.7,
        "fallback_to_local_orchestrator": True
    },
    "tts": {
        "engine": "piper",
        "models_dir": str(DATA_DIR / "models" / "piper"),
        "sample_rate": 44100,
        "channels": 2,
        "fallback_to_acoustic": True
    },
    "audio": {
        "sample_rate": 44100,
        "channels": 2,
        "target_lufs": -16.0,
        "max_peak_db": -1.0,
        "speaker_pause_ms": 650,
        "sentence_pause_ms": 350,
        "output_format": "mp3",
        "mp3_bitrate": "192k"
    }
}

class AppConfig:
    def __init__(self):
        config_path = CONFIG_DIR / "config.yaml"
        voices_path = CONFIG_DIR / "voices.yaml"

        loaded_config = load_yaml(config_path)
        self.settings = self._merge_dicts(DEFAULT_CONFIG, loaded_config)

        # Ensure directory paths exist
        self.ensure_storage_dirs()

        # Load voices
        loaded_voices = load_yaml(voices_path)
        self.voices: List[Dict[str, Any]] = loaded_voices.get("voices", [])

    def _merge_dicts(self, default: Dict[str, Any], custom: Dict[str, Any]) -> Dict[str, Any]:
        merged = default.copy()
        for k, v in custom.items():
            if isinstance(v, dict) and k in merged and isinstance(merged[k], dict):
                merged[k] = self._merge_dicts(merged[k], v)
            else:
                merged[k] = v
        return merged

    def ensure_storage_dirs(self):
        storage = self.settings.get("storage", {})
        for key in ["audio_dir", "transcripts_dir", "projects_dir", "models_dir", "temp_dir"]:
            path_str = storage.get(key)
            if path_str:
                path = Path(path_str)
                if not path.is_absolute():
                    path = PROJECT_ROOT / path
                path.mkdir(parents=True, exist_ok=True)
                storage[key] = str(path)

        db_path = Path(storage.get("database_file", DATA_DIR / "podcast.db"))
        if not db_path.is_absolute():
            db_path = PROJECT_ROOT / db_path
        db_path.parent.mkdir(parents=True, exist_ok=True)
        storage["database_file"] = str(db_path)

    def get(self, key: str, default: Any = None) -> Any:
        return self.settings.get(key, default)

    def get_voice(self, voice_id: str) -> Dict[str, Any]:
        for v in self.voices:
            if v.get("id") == voice_id:
                return v
        return {}

config = AppConfig()
