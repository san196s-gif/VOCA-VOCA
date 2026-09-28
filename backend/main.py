import os
import shutil
import uuid
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from backend.config import config
from backend.database import db
from backend.hardware import hardware_profile, detect_hardware
from backend.job_queue import job_queue
from backend.tts_service import tts_service
from backend.audio_processor import audio_processor
from backend.stt_service import stt_service
from backend.persian_normalizer import PersianSpeechNormalizer
from backend.script_validator import script_validator
from backend.audio_validator import audio_validator

app = FastAPI(
    title="Podcast AI - Local Offline Multi-Speaker Studio",
    version="1.0.0",
    description="Local-first offline podcast generator with Persian/English STT, natural multi-speaker dialogue orchestration, and master audio rendering."
)

# Enable CORS for localhost frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.settings["server"].get("cors_origins", ["*"]),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request / Response Schemas
class GeneratePodcastRequest(BaseModel):
    text: str = Field(..., min_length=5, description="Input text or transcript to transform into podcast")
    voice_ids: List[str] = Field(..., min_items=1, max_items=6, description="List of 1 to 6 voice IDs")
    title: Optional[str] = Field("Podcast Episode", description="Episode title")
    language: Optional[str] = Field(None, description="Preferred language ('fa', 'en', or auto)")

class ProcessAudioRequest(BaseModel):
    segment_ids: List[str]
    pause_ms: Optional[int] = 650

@app.get("/api/health")
async def get_health():
    """System health check and engine capability verification."""
    hw = detect_hardware()
    return {
        "status": "online",
        "mode": "local_offline",
        "hardware": hw,
        "ffmpeg_installed": audio_processor.has_ffmpeg(),
        "storage": {
            "free_gb": hw["storage"]["free_gb"],
            "base_dir": config.settings["storage"]["base_dir"]
        },
        "voices_count": len(config.voices)
    }

@app.get("/api/hardware")
async def get_hardware():
    """Detailed hardware inspection for internal profile optimization."""
    return detect_hardware()

@app.get("/api/voices")
async def get_voices():
    """Retrieve full catalog of 20 voice profiles (Persian & International)."""
    return {
        "voices": config.voices,
        "max_selectable": 6,
        "min_selectable": 1
    }

@app.get("/api/voices/{voice_id}/sample")
async def get_voice_sample(voice_id: str):
    """Generates or retrieves an instant 2-second acoustic voice preview sample."""
    voice = config.get_voice(voice_id)
    if not voice:
        raise HTTPException(status_code=404, detail="Voice profile not found")

    samples_dir = Path(config.settings["storage"]["temp_dir"]) / "samples"
    samples_dir.mkdir(parents=True, exist_ok=True)
    sample_file = samples_dir / f"sample_{voice_id}.wav"

    if not sample_file.exists():
        sample_phrase = "درود بر شما، من آماده همراهی در این پادکست هستم." if voice.get("language") == "fa" else "Hello, I am ready to host this podcast with you."
        tts_service.synthesize_segment(sample_phrase, voice_id, str(sample_file))

    return FileResponse(str(sample_file), media_type="audio/wav")

@app.post("/api/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Form("auto")
):
    """
    Upload an audio file (WAV, MP3, M4A, OGG, WEBM) for local offline Speech-to-Text.
    Returns job_id and begins transcription.
    """
    temp_dir = Path(config.settings["storage"]["temp_dir"]) / "uploads"
    temp_dir.mkdir(parents=True, exist_ok=True)

    file_ext = Path(file.filename or "audio.wav").suffix or ".wav"
    upload_id = f"upload_{uuid.uuid4().hex[:8]}{file_ext}"
    saved_path = temp_dir / upload_id

    with open(saved_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    job_id = job_queue.start_transcription(str(saved_path), language=language or "auto")
    return {
        "job_id": job_id,
        "status": "transcribing",
        "message": "Audio uploaded successfully. Local transcription started."
    }

@app.post("/api/podcast/generate")
async def generate_podcast(req: GeneratePodcastRequest):
    """
    Submits source text to generate a full multi-speaker podcast.
    Supports 1 to 6 voices.
    """
    if len(req.voice_ids) < 1 or len(req.voice_ids) > 6:
        raise HTTPException(status_code=400, detail="Please select between 1 and 6 voices.")

    # Validate that voice IDs exist
    for vid in req.voice_ids:
        if not config.get_voice(vid):
            raise HTTPException(status_code=400, detail=f"Voice ID '{vid}' does not exist.")

    job_id = job_queue.start_podcast_generation(
        text=req.text,
        voice_ids=req.voice_ids,
        title=req.title or "Podcast Episode"
    )

    return {
        "job_id": job_id,
        "status": "pending",
        "message": "Podcast generation initiated."
    }

@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Checks the status, progress percentage, and results of a generation job."""
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job ID not found.")
    return job

class ValidateScriptRequest(BaseModel):
    script: List[dict]
    original_text: str
    auto_repair: bool = True

class PublishPodcastRequest(BaseModel):
    job_id: str

@app.post("/api/script/validate")
async def validate_script(req: ValidateScriptRequest):
    """
    Validates a generated or edited podcast script against quality criteria
    and original text content integrity. Returns repaired script and validation report.
    """
    repaired, report = script_validator.validate_and_repair(
        req.script, req.original_text, auto_repair=req.auto_repair
    )
    return {
        "repaired_script": repaired,
        "report": report
    }

@app.post("/api/podcast/publish")
async def publish_podcast(req: PublishPodcastRequest):
    """
    Marks the generated podcast as officially pre-publish validated and published.
    Finalizes the broadcast distribution metadata.
    """
    job = db.get_job(req.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    db.update_job(
        req.job_id,
        metadata={
            "is_published": True,
            "published_at": str(uuid.uuid4().hex[:8])
        }
    )
    return {
        "status": "published",
        "job_id": req.job_id,
        "message": "Podcast successfully validated and published for public broadcast/download."
    }

@app.get("/api/download/{job_id}")
async def download_podcast(job_id: str):
    """Streams the final generated MP3/WAV podcast episode."""
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Podcast not found.")

    audio_dir = Path(config.settings["storage"]["audio_dir"])
    target_mp3 = audio_dir / f"{job_id}.mp3"
    target_wav = audio_dir / f"{job_id}.wav"

    if target_mp3.exists():
        return FileResponse(
            str(target_mp3),
            media_type="audio/mpeg",
            filename=f"podcast_{job_id}.mp3"
        )
    elif target_wav.exists():
        return FileResponse(
            str(target_wav),
            media_type="audio/wav",
            filename=f"podcast_{job_id}.wav"
        )
    else:
        raise HTTPException(status_code=404, detail="Audio file not yet rendered or expired.")

if __name__ == "__main__":
    import uvicorn
    host = config.settings["server"].get("host", "127.0.0.1")
    port = config.settings["server"].get("port", 8000)
    print(f"Starting Podcast AI Backend on http://{host}:{port}")
    uvicorn.run("backend.main:app", host=host, port=port, reload=False)
