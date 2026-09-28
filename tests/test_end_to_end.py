import pytest
from pathlib import Path
from backend.config import config
from backend.job_queue import job_queue
from backend.database import db

def test_full_end_to_end_pipeline(tmp_path):
    """
    End-to-End Pipeline Verification:
    Text -> Job Queue -> Orchestration -> Multi-speaker TTS -> Audio Mixing -> Output File Verification
    """
    sample_text = (
        "هوش مصنوعی آینده رسانه‌های صوتی را متحول خواهد کرد. "
        "با استفاده از مدل‌های زبانی محلی، امنیت داده‌ها به طور کامل حفظ می‌شود. "
        "این سامانه بدون نیاز به اینترنت پادکست‌های چند گوینده تولید می‌کند."
    )
    voices = ["fa-warm-male", "fa-warm-female"]

    # Start generation job
    job_id = job_queue.start_podcast_generation(sample_text, voices, title="E2E Test Episode")
    assert job_id.startswith("job-")

    # Directly run worker synchronously for deterministic testing
    job_queue._run_podcast_worker(job_id, sample_text, voices, title="E2E Test Episode")

    # Verify database record
    final_job = db.get_job(job_id)
    assert final_job["status"] == "completed"
    assert final_job["progress"] == 100
    assert final_job["audio_url"] is not None

    # Verify rendered audio file
    audio_dir = Path(config.settings["storage"]["audio_dir"])
    rendered_file = audio_dir / f"{job_id}.mp3"
    rendered_wav = audio_dir / f"{job_id}.wav"
    assert rendered_file.exists() or rendered_wav.exists()

    target = rendered_file if rendered_file.exists() else rendered_wav
    assert target.stat().st_size > 2000
