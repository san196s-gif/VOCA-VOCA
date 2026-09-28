import re
from typing import Dict, Any, List, Tuple

class PersianSpeechNormalizer:
    """
    Persian Speech & Pronunciation Normalization Layer
    Transforms written Persian into natural, phonetically accurate spoken Persian.
    Handles:
    - Character normalization (Arabic to Persian glyphs)
    - Nim-faseleh (Zero-Width Non-Joiner ZWNJ)
    - Number to Persian word conversion (cardinal, ordinal, dates, percentages, currency)
    - Technical terminology & mixed Persian/English handling
    - Contextual register & oratory punctuation adjustments
    """

    # Arabic to Persian character mapping
    CHAR_MAP = {
        'ي': 'ی',
        'ى': 'ی',
        'ك': 'ک',
        'ة': 'ه',
        'ۀ': 'ه‌ی ',
        'ؤ': 'و',
        'إ': 'ا',
        'أ': 'ا',
        'ء': '',
        '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
        '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
    }

    # Number words in Persian
    ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"]
    TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"]
    TENS = ["", "ده", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"]
    HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"]
    THOUSANDS = ["", "هزار", "میلیون", "میلیارد", "تریلیون"]

    # Common English technical terms pronounced naturally in Persian podcasts
    TECH_GLOSSARY = {
        "AI": "اِی آی",
        "ARTIFICIAL INTELLIGENCE": "هوش مصنوعی",
        "MACHINE LEARNING": "یادگیری ماشین",
        "DEEP LEARNING": "یادگیری عمیق",
        "NEURAL NETWORK": "شبکه عصبی",
        "API": "اِی پی آی",
        "LLM": "ال ال ام",
        "GPT": "جی پی تی",
        "CPU": "سی پی یو",
        "GPU": "جی پی یو",
        "RAM": "رم",
        "DATA": "داده‌ها",
        "PODCAST": "پادکست",
        "STUDIO": "استودیو",
        "CLOUD": "ابری",
        "LOCAL": "محلی",
        "OFFLINE": "آفلاین",
    }

    @classmethod
    def normalize_characters(cls, text: str) -> str:
        """Replace Arabic characters with standardized Persian equivalents."""
        result = []
        for ch in text:
            result.append(cls.CHAR_MAP.get(ch, ch))
        return "".join(result)

    @classmethod
    def normalize_zwnj(cls, text: str) -> str:
        """
        Normalize Nim-faseleh (Zero-Width Non-Joiner ZWNJ, \u200c).
        Fixes prefixes (می, نمی) and suffixes (ها, های, تر, ترین, ام, ای, مان, تان, شان).
        """
        # Prefixes
        text = re.sub(r'\b(می|نمی)\s+', r'\1\u200c', text)
        # Suffixes
        text = re.sub(r'\s+(ها|های|تر|ترین|ام|ات|اش|مان|تان|شان|ای)\b', r'\u200c\1', text)
        # Fix multiple ZWNJ or space-ZWNJ
        text = re.sub(r'[\u200c\s]*\u200c+[\u200c\s]*', '\u200c', text)
        return text

    @classmethod
    def number_to_words(cls, num: int) -> str:
        """Convert integer to Persian words."""
        if num == 0:
            return "صفر"
        if num < 0:
            return "منفی " + cls.number_to_words(abs(num))

        groups = []
        n = num
        while n > 0:
            groups.append(n % 1000)
            n //= 1000

        words = []
        for i in reversed(range(len(groups))):
            g = groups[i]
            if g == 0:
                continue

            h = g // 100
            t = (g % 100) // 10
            u = g % 10

            g_words = []
            if h > 0:
                g_words.append(cls.HUNDREDS[h])

            if t == 1:
                g_words.append(cls.TEENS[u])
            else:
                if t > 0:
                    g_words.append(cls.TENS[t])
                if u > 0:
                    g_words.append(cls.ONES[u])

            group_str = " و ".join(g_words)
            if i > 0 and cls.THOUSANDS[i]:
                group_str += " " + cls.THOUSANDS[i]

            words.append(group_str)

        return " و ".join(words)

    @classmethod
    def normalize_numbers_and_currency(cls, text: str) -> str:
        """
        Converts digits, percentages, and currencies into Persian spoken words.
        """
        # Percentages: 25% or %25 or ۲۵٪
        def replace_percent(match):
            val_str = match.group(1) or match.group(2)
            try:
                val = int(val_str)
                return f"{cls.number_to_words(val)} درصد"
            except Exception:
                return match.group(0)

        text = re.sub(r'(\d+)\s*[%٪]', replace_percent, text)
        text = re.sub(r'[%٪]\s*(\d+)', replace_percent, text)

        # Currency: e.g. 50000 تومان / دلار / ریال
        def replace_currency(match):
            num_str = match.group(1).replace(",", "")
            curr = match.group(2)
            try:
                num = int(num_str)
                return f"{cls.number_to_words(num)} {curr}"
            except Exception:
                return match.group(0)

        text = re.sub(r'(\d[\d,]*)\s*(تومان|دلار|یورو|ریال|درهم)', replace_currency, text)

        # Standalone integers
        def replace_number(match):
            num_str = match.group(0).replace(",", "")
            try:
                num = int(num_str)
                # Keep small or special if desirable, but convert for spoken clarity
                return cls.number_to_words(num)
            except Exception:
                return match.group(0)

        text = re.sub(r'\b\d[\d,]*\b', replace_number, text)
        return text

    @classmethod
    def normalize_mixed_english(cls, text: str) -> str:
        """
        Identifies English technical terms inside Persian sentences and prepares pronunciation.
        Common known terms are expanded phonetically if helpful, while preserving original sense.
        """
        words = text.split()
        normalized_words = []
        for w in words:
            clean_w = re.sub(r'[^\w]', '', w).upper()
            if clean_w in cls.TECH_GLOSSARY and len(clean_w) > 1:
                # Replace with natural Persian podcast phonetic pronunciation
                normalized_words.append(cls.TECH_GLOSSARY[clean_w])
            else:
                normalized_words.append(w)
        return " ".join(normalized_words)

    @classmethod
    def detect_context_register(cls, text: str) -> str:
        """
        Detects the linguistic register and oratorical context of the text:
        - 'documentary': Scientific, data-driven, analytical
        - 'literary': Poetic, philosophical, cultural, formal historical
        - 'emotional_story': Narrative, personal, expressive
        - 'casual_podcast': Dynamic, interactive, conversational
        - 'dramatic': Climax, suspense, cinematic
        """
        lower = text.lower()
        # Literary / Historical cues
        if any(k in text for k in ["تاریخ", "فلسفه", "تمدن", "فرهنگ", "ادبیات", "حکمت", "روایت", "کهن", "اندیشه"]):
            return "literary"
        # Scientific / Documentary cues
        if any(k in text for k in ["تحقیق", "آمار", "داده", "بررسی", "شواهد", "پژوهش", "دانشگاه", "سیستم", "فناوری", "درصد"]):
            return "documentary"
        # Dramatic / Cinematic cues
        if any(k in text for k in ["ناگهان", "بحران", "سرنوشت", "نبرد", "راز", "شگفت‌انگیز", "خطر", "سکوت"]):
            return "dramatic"
        # Casual podcast conversational
        return "casual_podcast"

    @classmethod
    def prepare_for_tts(cls, text: str) -> Tuple[str, Dict[str, Any]]:
        """
        Main pipeline: Cleans and prepares Persian text for natural oratory TTS.
        Returns:
            normalized_text: Phonetically and grammatically normalized text.
            context_metadata: Detected register, pauses, and rhetorical hints.
        """
        # Step 1: Characters
        t = cls.normalize_characters(text)
        # Step 2: ZWNJ
        t = cls.normalize_zwnj(t)
        # Step 3: Numbers & Currencies
        t = cls.normalize_numbers_and_currency(t)
        # Step 4: Mixed English technical terminology
        t = cls.normalize_mixed_english(t)

        register = cls.detect_context_register(t)

        # Context-dependent prosody tuning
        if register == "literary":
            pause_factor = 1.2
            pitch_variance = 0.08
            pace = 0.94
        elif register == "documentary":
            pause_factor = 1.05
            pitch_variance = 0.05
            pace = 0.98
        elif register == "dramatic":
            pause_factor = 1.3
            pitch_variance = 0.14
            pace = 0.92
        else:
            pause_factor = 1.0
            pitch_variance = 0.10
            pace = 1.02

        metadata = {
            "register": register,
            "pause_factor": pause_factor,
            "pitch_variance": pitch_variance,
            "pace": pace,
            "has_interrogative": ("؟" in t or "?" in t),
            "sentence_count": len([s for s in re.split(r'[.?!؛\n]+', t) if s.strip()])
        }

        return t, metadata

persian_normalizer = PersianSpeechNormalizer()
