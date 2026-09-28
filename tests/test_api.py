import pytest
from pathlib import Path
from backend.config import config
from backend.database import db
from backend.podcast_engine import podcast_engine
from backend.audio_processor import audio_processor
from backend.tts_service import tts_service
from backend.stt_service import stt_service

def test_config_and_voices():
    """Verify that configuration loads and includes all 20 voice profiles."""
    assert len(config.voices) >= 20
    persian_voices = [v for v in config.voices if v.get("language") == "fa"]
    intl_voices = [v for v in config.voices if v.get("language") == "en"]
    assert len(persian_voices) >= 10
    assert len(intl_voices) >= 10

def test_semantic_speaker_assignment_persian():
    """Verify semantic speaker dialogue partitioning for Persian text."""
    persian_text = "هوش مصنوعی و یادگیری ماشین تحولی بزرگ در فناوری ایجاد کرده‌اند. این پیشرفت‌ها مدل‌های زبانی را دگرگون ساخته است. ما در این پادکست به بررسی دقیق اثرات آن می‌پردازیم."
    selected_voices = ["fa-deep-cinematic-male", "fa-warm-male", "fa-warm-female"]
    script = podcast_engine.orchestrate_script(persian_text, selected_voices, preferred_language="fa")

    assert len(script) >= 2
    # Verify speaker IDs are in selected voices
    for segment in script:
        assert segment["speaker_id"] in selected_voices
        assert "text" in segment and len(segment["text"]) > 0

def test_semantic_speaker_assignment_single_voice():
    """Verify single voice produces cohesive narration."""
    text = "Welcome to our special technology episode. Today we analyze decentralized computing."
    script = podcast_engine.orchestrate_script(text, ["en-warm-narrator"])
    assert len(script) >= 1
    assert all(seg["speaker_id"] == "en-warm-narrator" for seg in script)

def test_tts_segment_generation(tmp_path):
    """Verify acoustic TTS synthesis outputs valid non-empty audio."""
    test_wav = tmp_path / "test_output.wav"
    result_path = tts_service.synthesize_segment(
        text="تست سنتز صوت فارسی برای پادکست",
        voice_id="fa-warm-male",
        output_path=str(test_wav)
    )
    assert Path(result_path).exists()
    assert Path(result_path).stat().st_size > 1000

def test_audio_processor_concatenation(tmp_path):
    """Verify audio processor concatenates segments with normalization."""
    seg1 = tmp_path / "seg1.wav"
    seg2 = tmp_path / "seg2.wav"
    out_master = tmp_path / "master.wav"

    tts_service.synthesize_segment("بخش اول گفتگو", "fa-warm-male", str(seg1))
    tts_service.synthesize_segment("بخش دوم و تحلیل نهایی", "fa-warm-female", str(seg2))

    res = audio_processor.concatenate_segments([str(seg1), str(seg2)], str(out_master), pause_ms=400)
    assert Path(res["file_path"]).exists()
    assert res["duration_sec"] > 0.5
    assert res["channels"] == 2

def test_database_job_lifecycle():
    """Verify SQLite job creation, state transition, and retrieval."""
    job_id = "test-job-999"
    created = db.create_job(job_id, "test_job", {"test": True})
    assert created["id"] == job_id
    assert created["status"] == "pending"

    updated = db.update_job(job_id, status="generating_voice", progress=50, message="Testing...")
    assert updated["status"] == "generating_voice"
    assert updated["progress"] == 50

    fetched = db.get_job(job_id)
    assert fetched["id"] == job_id

def test_persian_speech_normalizer():
    """Verify Persian speech normalization (ZWNJ, numbers to words, technical glossary)."""
    from backend.persian_normalizer import persian_normalizer

    # Test numbers conversion
    assert "بیست و پنج" in persian_normalizer.number_to_words(25)
    assert "یک هزار و چهارصد و سه" in persian_normalizer.number_to_words(1403)

    # Test ZWNJ and Arabic glyph normalization
    raw_text = "كتاب های من می آیند و ۲۵ درصد رشد داشتیم با AI در سال 1403."
    normalized, meta = persian_normalizer.prepare_for_tts(raw_text)

    # Verify Arabic ک converted to Persian ک
    assert "ك" not in normalized
    # Verify numbers converted
    assert "بیست و پنج درصد" in normalized
    assert "یک هزار و چهارصد و سه" in normalized
    # Verify context detection
    assert meta["register"] in ["documentary", "casual_podcast", "literary", "dramatic"]

def test_script_validator_and_content_integrity():
    """Verify script validation, error detection, auto-repair and content integrity."""
    from backend.script_validator import script_validator

    source_text = "در سال ۱۴۰۳ بیش از ۲۵ شرکت هوش مصنوعی آغاز به کار کردند. امنیت محلی داده‌ها مزیت اصلی است."
    script = [
        {"speaker_id": "fa-warm-male", "speaker_name": "میزبان", "text": "در سال ۱۴۰۳ بیش از ۲۵ شرکت هوش مصنوعی آغاز به کار کردند."},
        {"speaker_id": "fa-warm-male", "speaker_name": "میزبان", "text": "در سال ۱۴۰۳ بیش از ۲۵ شرکت هوش مصنوعی آغاز به کار کردند."}, # Duplicate turn
        {"speaker_id": "fa-warm-female", "speaker_name": "کارشناس", "text": "امنیت محلی داده‌ها مزیت اصلی است"} # Missing punctuation
    ]

    repaired, report = script_validator.validate_and_repair(script, source_text, auto_repair=True)
    assert report["score"] >= 70
    assert report["integrity"]["numbers_verified"] is True
    # Verify duplicate was cleaned
    assert len(repaired) == 2
    # Verify punctuation added
    assert repaired[1]["text"].endswith(".")

def test_audio_quality_validator():
    """Verify acoustic validation, clipping detection, and loudness measurements."""
    import numpy as np
    from backend.audio_validator import audio_validator

    # Generate synthetic safe speech-level sine wave at 44.1kHz
    sr = 44100
    t = np.linspace(0, 1.0, sr, endpoint=False)
    # Peak at 0.5 (~ -6 dBFS, zero clipping)
    samples = (0.5 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)

    val_res = audio_validator.validate_samples(samples, sr)
    assert val_res["passed"] is True
    assert val_res["clipping_detected"] is False
    assert val_res["clipping_samples"] == 0
    assert val_res["score"] >= 80


