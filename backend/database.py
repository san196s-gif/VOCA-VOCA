import sqlite3
import json
import time
from typing import Dict, Any, Optional, List
from pathlib import Path
from backend.config import config

class Database:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or config.settings["storage"]["database_file"]
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    job_type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    progress INTEGER DEFAULT 0,
                    message TEXT DEFAULT '',
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL,
                    error TEXT,
                    audio_url TEXT,
                    transcript TEXT,
                    script_json TEXT,
                    metadata TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS podcasts (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    language TEXT NOT NULL,
                    voices_json TEXT NOT NULL,
                    duration_sec REAL DEFAULT 0.0,
                    file_path TEXT NOT NULL,
                    script_json TEXT NOT NULL,
                    created_at REAL NOT NULL
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS transcriptions (
                    id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    text TEXT NOT NULL,
                    language TEXT NOT NULL,
                    duration_sec REAL DEFAULT 0.0,
                    created_at REAL NOT NULL
                )
            """)
            conn.commit()

    def create_job(self, job_id: str, job_type: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        now = time.time()
        meta_str = json.dumps(metadata or {})
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO jobs (id, job_type, status, progress, message, created_at, updated_at, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (job_id, job_type, "pending", 0, "Initializing...", now, now, meta_str))
            conn.commit()
        return self.get_job(job_id)

    def update_job(self, job_id: str, status: Optional[str] = None, progress: Optional[int] = None,
                   message: Optional[str] = None, error: Optional[str] = None,
                   audio_url: Optional[str] = None, transcript: Optional[str] = None,
                   script_json: Optional[Any] = None,
                   metadata: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        now = time.time()
        updates = ["updated_at = ?"]
        params: List[Any] = [now]

        if status is not None:
            updates.append("status = ?")
            params.append(status)
        if progress is not None:
            updates.append("progress = ?")
            params.append(progress)
        if message is not None:
            updates.append("message = ?")
            params.append(message)
        if error is not None:
            updates.append("error = ?")
            params.append(error)
        if audio_url is not None:
            updates.append("audio_url = ?")
            params.append(audio_url)
        if transcript is not None:
            updates.append("transcript = ?")
            params.append(transcript)
        if script_json is not None:
            updates.append("script_json = ?")
            params.append(json.dumps(script_json) if isinstance(script_json, (dict, list)) else script_json)
        if metadata is not None:
            # Merge with existing metadata
            existing = self.get_job(job_id)
            existing_meta = existing.get("metadata", {}) if existing else {}
            existing_meta.update(metadata)
            updates.append("metadata = ?")
            params.append(json.dumps(existing_meta))

        params.append(job_id)
        sql = f"UPDATE jobs SET {', '.join(updates)} WHERE id = ?"

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            conn.commit()

        return self.get_job(job_id)

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
            row = cursor.fetchone()
            if row:
                res = dict(row)
                if res.get("script_json"):
                    try:
                        res["script"] = json.loads(res["script_json"])
                    except Exception:
                        res["script"] = []
                if res.get("metadata"):
                    try:
                        meta = json.loads(res["metadata"])
                        res["metadata"] = meta
                        for k, v in meta.items():
                            if k not in res:
                                res[k] = v
                    except Exception:
                        res["metadata"] = {}
                return res
        return None

    def save_podcast(self, podcast_id: str, title: str, language: str, voices: List[str],
                     duration_sec: float, file_path: str, script: List[Dict[str, Any]]):
        now = time.time()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO podcasts (id, title, language, voices_json, duration_sec, file_path, script_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (podcast_id, title, language, json.dumps(voices), duration_sec, file_path, json.dumps(script), now))
            conn.commit()

    def save_transcription(self, trans_id: str, filename: str, text: str, language: str, duration_sec: float):
        now = time.time()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO transcriptions (id, filename, text, language, duration_sec, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (trans_id, filename, text, language, duration_sec, now))
            conn.commit()

db = Database()
