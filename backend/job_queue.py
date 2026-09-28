import uuid
import threading
from typing import Dict, Any, Callable
from pathlib import Path
from backend.database import db
from backend.config import config
from backend.podcast_engine import podcast_engine
from backend.tts_service import tts_service
from backend.audio_processor import audio_processor
from backend.stt_service import stt_service
from backend.persian_normalizer import PersianSpeechNormalizer
from backend.script_validator import script_validator
from backend.audio_validator import audio_validator

class JobQueue:
    def __init__(self):
        self._lock = threading.Lock()

    def start_podcast_generation(self, text: str, voice_ids: list, title: str = "Podcast Episode") -> str:
        job_id = f"job-{uuid.uuid4().hex[:12]}"
        db.create_job(job_id, "podcast_generation", {
            "title": title,
            "voice_ids": voice_ids,
            "char_count": len(text)
        })

        thread = threading.Thread(
            target=self._run_podcast_worker,
            args=(job_id, text, voice_ids, title),
            daemon=True
        )
        thread.start()
        return job_id

    def start_transcription(self, audio_path: str, language: str = "auto") -> str:
        job_id = f"trans-{uuid.uuid4().hex[:12]}"
        db.create_job(job_id, "audio_transcription", {
            "audio_path": audio_path,
            "language": language
        })

        thread = threading.Thread(
            target=self._run_transcription_worker,
            args=(job_id, audio_path, language),
            daemon=True
        )
        thread.start()
        return job_id

    def _run_transcription_worker(self, job_id: str, audio_path: str, language: str):
        try:
            db.update_job(job_id, status="transcribing", progress=25, message="Transcribing speech locally...")
            res = stt_service.transcribe(audio_path, language=language)

            db.update_job(
                job_id,
                status="completed",
                progress=100,
                message="Transcription completed successfully.",
                transcript=res.get("text", "")
            )
            # Store in db transcriptions table
            db.save_transcription(
                job_id,
                Path(audio_path).name,
                res.get("text", ""),
                res.get("language", language),
                res.get("duration_sec", 0.0)
            )
        except Exception as e:
            db.update_job(job_id, status="failed", progress=0, error=str(e), message="Transcription failed.")

    def _run_podcast_worker(self, job_id: str, text: str, voice_ids: list, title: str):
        temp_dir = Path(config.settings["storage"]["temp_dir"]) / job_id
        temp_dir.mkdir(parents=True, exist_ok=True)
        segment_files = []

        try:
            # Step 1: Text Normalization (Persian Unicode, Nim-faseleh, Number Verbalization)
            db.update_job(
                job_id,
                status="normalizing",
                progress=10,
                message="Normalizing Persian orthography, Nim-faseleh (ZWNJ), and numbers..."
            )
            is_fa = any(ord(c) >= 0x0600 and ord(c) <= 0x06FF for c in text)
            normalized_text = PersianSpeechNormalizer.prepare_for_tts(text)["normalized_text"] if is_fa else text

            # Step 2: Semantic Dialogue Script Generation
            db.update_job(
                job_id,
                status="analyzing",
                progress=20,
                message="Analyzing semantic structure and assigning speaker turns..."
            )
            raw_script = podcast_engine.orchestrate_script(normalized_text, voice_ids)
            if not raw_script:
                raise ValueError("Failed to generate dialogue segments from provided text.")

            # Step 3: Script Quality Check & Content Integrity Validation
            db.update_job(
                job_id,
                status="validating_script",
                progress=30,
                message="Checking script quality, factual integrity, and dialogue naturalness..."
            )
            script_segments, script_val_report = script_validator.validate_and_repair(
                raw_script, original_text=text, auto_repair=True
            )

            db.update_job(
                job_id,
                status="generating_voice",
                progress=40,
                message=f"Synthesizing {len(script_segments)} multi-speaker segments (Score: {script_val_report['score']}/100)...",
                script_json=script_segments,
                metadata={"script_validation": script_val_report}
            )

            # Step 4: Multi-Speaker Voice Generation
            total_segs = len(script_segments)
            for idx, seg in enumerate(script_segments):
                seg_file = temp_dir / f"seg_{idx:04d}_{seg['speaker_id']}.wav"
                tts_service.synthesize_segment(seg["text"], seg["speaker_id"], str(seg_file))
                segment_files.append(str(seg_file))

                # Update progress smoothly between 40% and 80%
                seg_prog = 40 + int((idx + 1) / total_segs * 40)
                db.update_job(
                    job_id,
                    status="generating_voice",
                    progress=seg_prog,
                    message=f"Generating voice {idx+1}/{total_segs} ({seg.get('speaker_name', 'Speaker')})..."
                )

            # Step 5: Mixing Audio & Loudness Normalization
            db.update_job(
                job_id,
                status="mixing_audio",
                progress=85,
                message="Mastering continuous multi-speaker track and matching loudness (-16 LUFS)..."
            )
            output_dir = Path(config.settings["storage"]["audio_dir"])
            output_file = output_dir / f"{job_id}.mp3"

            mix_res = audio_processor.concatenate_segments(
                segment_files,
                str(output_file),
                pause_ms=config.settings["audio"].get("speaker_pause_ms", 650)
            )

            # Step 6: Audio Quality Validation (Clipping, Dynamic Range, Silence Gaps)
            db.update_job(
                job_id,
                status="validating_audio",
                progress=92,
                message="Validating audio quality, peak headroom, and speaker level balance..."
            )
            audio_val_report = audio_validator.validate_audio_file(str(output_file), script_segments)

            # Step 7: Pre-Publish Finalization
            db.update_job(
                job_id,
                status="finalizing",
                progress=96,
                message="Finalizing pre-publish validation certificate..."
            )

            duration_sec = mix_res.get("duration_sec", 0.0)
            audio_url = f"/api/download/{job_id}"

            db.save_podcast(
                podcast_id=job_id,
                title=title,
                language="fa" if "fa" in voice_ids[0] else "en",
                voices=voice_ids,
                duration_sec=duration_sec,
                file_path=str(output_file),
                script=script_segments
            )

            db.update_job(
                job_id,
                status="completed",
                progress=100,
                message="Podcast generated and pre-publish validated successfully.",
                audio_url=audio_url,
                metadata={
                    "script_validation": script_val_report,
                    "audio_validation": audio_val_report,
                    "is_published": False
                }
            )

        except Exception as e:
            print(f"[JobQueue] Job {job_id} encountered error: {e}")
            db.update_job(
                job_id,
                status="failed",
                progress=0,
                error=str(e),
                message=f"Generation failed: {str(e)}"
            )
        finally:
            # Clean temporary individual segment files
            try:
                for f in segment_files:
                    p = Path(f)
                    if p.exists():
                        p.unlink()
                if temp_dir.exists():
                    temp_dir.rmdir()
            except Exception:
                pass

job_queue = JobQueue()
