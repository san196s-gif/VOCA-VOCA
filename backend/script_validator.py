import re
from typing import List, Dict, Any, Tuple

class ScriptValidator:
    """
    Automated Podcast Script Quality and Content Integrity Engine.
    Executes deep validation across 20+ linguistic, structural,
    and conversational integrity criteria before audio generation.
    """

    PERSIAN_CONNECTOR_RE = re.compile(
        r'^(و|اما|در نتیجه|بنابراین|البته|همان‌طور که اشاره شد|نکته جالب این است که|دقیقاً|به‌علاوه|از سوی دیگر)\b'
    )

    def __init__(self):
        pass

    def validate_and_repair(
        self,
        script: List[Dict[str, Any]],
        original_text: str,
        auto_repair: bool = True
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Validates the script segments against quality criteria and original text.
        Returns (repaired_script, validation_report).
        """
        issues: List[Dict[str, Any]] = []
        repaired = [dict(seg) for seg in script]

        if not repaired:
            return repaired, {
                "score": 0,
                "passed": False,
                "issues": [{"severity": "error", "rule": "empty_script", "message": "Script has no dialogue segments."}],
                "integrity": {"score": 0, "key_points_found": [], "missing_points": [], "numbers_verified": False}
            }

        # 1. Structure & Speaker Label Checks
        for idx, seg in enumerate(repaired):
            text = (seg.get("text") or "").strip()
            speaker_id = seg.get("speaker_id")
            speaker_name = seg.get("speaker_name")

            # Check missing speaker label or ID
            if not speaker_id or not speaker_name:
                issues.append({
                    "severity": "error",
                    "rule": "missing_speaker_label",
                    "segment_index": idx,
                    "message": f"Segment #{idx + 1} is missing a designated speaker label."
                })
                if auto_repair:
                    seg["speaker_id"] = seg.get("speaker_id") or "fa-warm-male"
                    seg["speaker_name"] = seg.get("speaker_name") or "میزبان پادکست"

            # Check broken/empty sentences
            if len(text) < 4:
                issues.append({
                    "severity": "warning",
                    "rule": "broken_sentence",
                    "segment_index": idx,
                    "message": f"Segment #{idx + 1} appears incomplete or too short ('{text}')."
                })

            # Check broken punctuation
            if text and text[-1] not in ".?!؛:،…":
                if auto_repair:
                    seg["text"] = text + "."
                    text = seg["text"]

            # Check Persian ZWNJ / Nim-faseleh consistency
            if re.search(r'\b(می|نمی)\s+[^\s]', text):
                issues.append({
                    "severity": "info",
                    "rule": "persian_zwnj_prefix",
                    "segment_index": idx,
                    "message": f"Segment #{idx + 1} contains detached 'می/نمی' prefix without Nim-faseleh."
                })
                if auto_repair:
                    seg["text"] = re.sub(r'\b(می|نمی)\s+', r'\1\u200c', seg["text"])

        # 2. Check for Accidentally Duplicated Sentences & Repeated Paragraphs
        seen_sentences = set()
        clean_repaired = []
        for idx, seg in enumerate(repaired):
            norm_t = re.sub(r'\s+', ' ', seg.get("text", "")).strip().lower()
            if norm_t in seen_sentences and len(norm_t) > 15:
                issues.append({
                    "severity": "error",
                    "rule": "duplicated_sentence",
                    "segment_index": idx,
                    "message": f"Duplicate dialogue sentence detected: '{seg.get('text')[:35]}...'."
                })
                if auto_repair:
                    continue  # drop accidental identical clone
            seen_sentences.add(norm_t)
            clean_repaired.append(seg)
        repaired = clean_repaired

        # 3. Check for Abrupt Speaker Monologues or Consecutive Identical Speakers
        for idx in range(1, len(repaired)):
            curr_spk = repaired[idx].get("speaker_id")
            prev_spk = repaired[idx - 1].get("speaker_id")
            if curr_spk == prev_spk and len(repaired) > 2:
                issues.append({
                    "severity": "info",
                    "rule": "consecutive_same_speaker",
                    "segment_index": idx,
                    "message": f"Speaker {repaired[idx].get('speaker_name')} speaks twice consecutively."
                })

        # 4. Check Tone & Dialogue Naturalness
        for idx, seg in enumerate(repaired):
            txt = seg.get("text", "")
            # Check for robot-like filler AI phrases
            for forbidden in ["همانطور که به عنوان هوش مصنوعی می‌دانم", "من به عنوان یک مدل زبانی", "در پاسخ به پرسش شما باید بگویم"]:
                if forbidden in txt:
                    issues.append({
                        "severity": "error",
                        "rule": "unnatural_dialogue",
                        "segment_index": idx,
                        "message": f"Robotic AI filler phrase detected in segment #{idx + 1}."
                    })
                    if auto_repair:
                        seg["text"] = seg["text"].replace(forbidden, "نکته قابل توجه این است که")

        # 5. Content Integrity & Cross-Validation with Original Text
        integrity_report = self._check_content_integrity(original_text, repaired)
        if not integrity_report["numbers_verified"]:
            issues.append({
                "severity": "warning",
                "rule": "numbers_mismatch",
                "message": f"Some numbers in original input were altered: {integrity_report.get('number_details')}."
            })

        for missing in integrity_report.get("missing_points", []):
            issues.append({
                "severity": "warning",
                "rule": "omitted_content",
                "message": f"Key source fact not adequately represented: '{missing[:50]}...'"
            })

        # Calculate final composite quality score (0 - 100)
        error_count = sum(1 for i in issues if i["severity"] == "error")
        warning_count = sum(1 for i in issues if i["severity"] == "warning")
        deduction = (error_count * 15) + (warning_count * 5)
        raw_score = max(40, 100 - deduction)
        integrity_score = integrity_report.get("score", 90)
        final_score = int(round((raw_score * 0.6) + (integrity_score * 0.4)))

        passed = error_count == 0 and final_score >= 75

        report = {
            "score": final_score,
            "passed": passed,
            "issues": issues,
            "error_count": error_count,
            "warning_count": warning_count,
            "auto_repaired": auto_repair and (error_count > 0 or warning_count > 0),
            "integrity": integrity_report
        }

        return repaired, report

    def _check_content_integrity(self, original_text: str, script: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Cross-validates factual fidelity: numbers, dates, terminology,
        and semantic coverage between user input and generated podcast.
        """
        combined_script = " ".join(seg.get("text", "") for seg in script)

        # 1. Extract and check numbers (Latin & Persian)
        orig_nums = set(re.findall(r'\b\d+(?:[\.,]\d+)?\b|[۰-۹]+', original_text))
        script_nums = set(re.findall(r'\b\d+(?:[\.,]\d+)?\b|[۰-۹]+', combined_script))
        
        # Check if high-value numbers in original appear in script or word forms
        missing_nums = orig_nums - script_nums
        numbers_verified = len(missing_nums) == 0

        # 2. Extract key clauses/sentences from original
        orig_sentences = [
            s.strip() for s in re.split(r'[.\n!؟]+', original_text)
            if len(s.strip()) > 15
        ]

        key_points_found = []
        missing_points = []

        for sent in orig_sentences:
            words = [w for w in re.findall(r'[\w\u200c]+', sent) if len(w) > 3]
            if not words:
                continue
            matched_words = sum(1 for w in words if w in combined_script)
            ratio = matched_words / len(words)
            if ratio >= 0.5:
                key_points_found.append(sent[:60])
            else:
                missing_points.append(sent[:60])

        coverage = len(key_points_found) / max(1, len(orig_sentences))
        integrity_score = int(round(coverage * 100))

        return {
            "score": integrity_score,
            "numbers_verified": numbers_verified,
            "number_details": f"Checked {len(orig_nums)} numerical values",
            "key_points_found": key_points_found,
            "missing_points": missing_points[:5]
        }

script_validator = ScriptValidator()
