/**
 * Persian Speech & Pronunciation Normalization Layer
 * Provides high-fidelity Persian text normalization, Nim-faseleh (ZWNJ),
 * numeral conversion, English technical terminology preservation,
 * and oratorical register analysis for native-quality Persian speech synthesis.
 */

export interface PersianContextMetadata {
  register: 'literary' | 'documentary' | 'dramatic' | 'casual_podcast';
  pauseFactor: number;
  pitchVariance: number;
  pace: number;
  hasInterrogative: boolean;
  sentenceCount: number;
}

const CHAR_MAP: Record<string, string> = {
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
};

const ONES = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const TEENS = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
const TENS = ['', 'ده', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const HUNDREDS = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
const THOUSANDS = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'];

const TECH_GLOSSARY: Record<string, string> = {
  'AI': 'اِی آی',
  'ARTIFICIAL INTELLIGENCE': 'هوش مصنوعی',
  'MACHINE LEARNING': 'یادگیری ماشین',
  'DEEP LEARNING': 'یادگیری عمیق',
  'NEURAL NETWORK': 'شبکه عصبی',
  'API': 'اِی پی آی',
  'LLM': 'ال ال ام',
  'GPT': 'جی پی تی',
  'CPU': 'سی پی یو',
  'GPU': 'جی پی یو',
  'RAM': 'رم',
  'DATA': 'داده‌ها',
  'PODCAST': 'پادکست',
  'STUDIO': 'استودیو',
  'CLOUD': 'ابری',
  'LOCAL': 'محلی',
  'OFFLINE': 'آفلاین',
};

export class PersianSpeechNormalizer {
  static normalizeCharacters(text: string): string {
    return text
      .split('')
      .map(ch => CHAR_MAP[ch] || ch)
      .join('');
  }

  static normalizeZwnj(text: string): string {
    // Prefixes
    let t = text.replace(/\b(می|نمی)\s+/g, '$1\u200c');
    // Suffixes
    t = t.replace(/\s+(ها|های|تر|ترین|ام|ات|اش|مان|تان|شان|ای)\b/g, '\u200c$1');
    // Fix multiple ZWNJ or space-ZWNJ
    t = t.replace(/[\u200c\s]*\u200c+[\u200c\s]*/g, '\u200c');
    return t;
  }

  static numberToWords(num: number): string {
    if (num === 0) return 'صفر';
    if (num < 0) return 'منفی ' + this.numberToWords(Math.abs(num));

    const groups: number[] = [];
    let n = Math.floor(num);
    while (n > 0) {
      groups.push(n % 1000);
      n = Math.floor(n / 1000);
    }

    const words: string[] = [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i];
      if (g === 0) continue;

      const h = Math.floor(g / 100);
      const t = Math.floor((g % 100) / 10);
      const u = g % 10;

      const gWords: string[] = [];
      if (h > 0) gWords.push(HUNDREDS[h]);

      if (t === 1) {
        gWords.push(TEENS[u]);
      } else {
        if (t > 0) gWords.push(TENS[t]);
        if (u > 0) gWords.push(ONES[u]);
      }

      let groupStr = gWords.join(' و ');
      if (i > 0 && THOUSANDS[i]) {
        groupStr += ' ' + THOUSANDS[i];
      }
      words.push(groupStr);
    }

    return words.join(' و ');
  }

  static normalizeNumbersAndCurrency(text: string): string {
    // Percentages: 25% or %25 or ۲۵٪
    let t = text.replace(/(\d+)\s*[%٪]/g, (_, val) => {
      const num = parseInt(val, 10);
      return !isNaN(num) ? `${this.numberToWords(num)} درصد` : val;
    });

    // Currency: e.g. 50000 تومان / دلار
    t = t.replace(/(\d[\d,]*)\s*(تومان|دلار|یورو|ریال|درهم)/g, (_, val, curr) => {
      const num = parseInt(val.replace(/,/g, ''), 10);
      return !isNaN(num) ? `${this.numberToWords(num)} ${curr}` : `${val} ${curr}`;
    });

    // Standalone integers
    t = t.replace(/\b\d[\d,]*\b/g, (match) => {
      const num = parseInt(match.replace(/,/g, ''), 10);
      return !isNaN(num) && num < 1000000000 ? this.numberToWords(num) : match;
    });

    return t;
  }

  static normalizeMixedEnglish(text: string): string {
    const words = text.split(/\s+/);
    const normalized = words.map(w => {
      const clean = w.replace(/[^\w]/g, '').toUpperCase();
      if (clean && TECH_GLOSSARY[clean]) {
        return TECH_GLOSSARY[clean];
      }
      return w;
    });
    return normalized.join(' ');
  }

  static detectContextRegister(text: string): PersianContextMetadata['register'] {
    if (/تاریخ|فلسفه|تمدن|فرهنگ|ادبیات|حکمت|روایت|کهن|اندیشه/.test(text)) {
      return 'literary';
    }
    if (/تحقیق|آمار|داده|بررسی|شواهد|پژوهش|دانشگاه|سیستم|فناوری|درصد/.test(text)) {
      return 'documentary';
    }
    if (/ناگهان|بحران|سرنوشت|نبرد|راز|شگفت‌انگیز|خطر|سکوت/.test(text)) {
      return 'dramatic';
    }
    return 'casual_podcast';
  }

  static prepareForTTS(text: string): { normalizedText: string; metadata: PersianContextMetadata } {
    let t = this.normalizeCharacters(text);
    t = this.normalizeZwnj(t);
    t = this.normalizeNumbersAndCurrency(t);
    t = this.normalizeMixedEnglish(t);

    const register = this.detectContextRegister(t);

    let pauseFactor = 1.0;
    let pitchVariance = 0.10;
    let pace = 1.0;

    if (register === 'literary') {
      pauseFactor = 1.25;
      pitchVariance = 0.08;
      pace = 0.94;
    } else if (register === 'documentary') {
      pauseFactor = 1.05;
      pitchVariance = 0.05;
      pace = 0.98;
    } else if (register === 'dramatic') {
      pauseFactor = 1.35;
      pitchVariance = 0.15;
      pace = 0.92;
    }

    const metadata: PersianContextMetadata = {
      register,
      pauseFactor,
      pitchVariance,
      pace,
      hasInterrogative: /[؟?]/.test(t),
      sentenceCount: t.split(/[.?!؛\n]+/).filter(Boolean).length,
    };

    return { normalizedText: t, metadata };
  }
}
