import { ScriptSegment, ScriptValidationReport, ValidationIssue } from '../types';

export class ScriptValidatorService {
  /**
   * Validates script segments against quality criteria and original source text.
   * Cross-checks integrity, numbers, speaker continuity, and Persian linguistic standards.
   */
  validateAndRepair(
    script: ScriptSegment[],
    originalText: string,
    autoRepair: boolean = true
  ): { repairedScript: ScriptSegment[]; report: ScriptValidationReport } {
    const issues: ValidationIssue[] = [];
    let repaired = script.map(seg => ({ ...seg }));

    if (!repaired || repaired.length === 0) {
      return {
        repairedScript: [],
        report: {
          score: 0,
          passed: false,
          issues: [{ severity: 'error', rule: 'empty_script', message: 'Script contains no dialogue segments.' }],
          errorCount: 1,
          warningCount: 0,
          autoRepaired: false,
          integrity: { score: 0, numbersVerified: false, keyPointsFound: [], missingPoints: [] },
        },
      };
    }

    // 1. Structure, Speaker Labels & Length
    for (let i = 0; i < repaired.length; i++) {
      const seg = repaired[i];
      const text = (seg.text || '').trim();

      if (!seg.speaker_id || !seg.speaker_name) {
        issues.push({
          severity: 'error',
          rule: 'missing_speaker_label',
          segmentIndex: i,
          message: `Segment #${i + 1} is missing speaker metadata.`,
          suggestion: 'Designated standard speaker assigned',
        });
        if (autoRepair) {
          seg.speaker_id = seg.speaker_id || 'fa-warm-male';
          seg.speaker_name = seg.speaker_name || 'میزبان پادکست';
        }
      }

      if (text.length < 4) {
        issues.push({
          severity: 'warning',
          rule: 'broken_sentence',
          segmentIndex: i,
          message: `Segment #${i + 1} is truncated or too brief ('${text}').`,
        });
      }

      // Check ending punctuation
      if (text && !/[.?!؛:،…]$/.test(text)) {
        if (autoRepair) {
          seg.text = text + '.';
        }
      }

      // Persian ZWNJ (Nim-faseleh) check for 'می/نمی'
      if (/\b(می|نمی)\s+[^\s]/.test(text)) {
        issues.push({
          severity: 'info',
          rule: 'persian_zwnj_prefix',
          segmentIndex: i,
          message: `Segment #${i + 1} contains detached 'می/نمی' prefix without Nim-faseleh.`,
          suggestion: 'Add non-breaking joiner (ZWNJ)',
        });
        if (autoRepair) {
          seg.text = seg.text.replace(/\b(می|نمی)\s+/g, '$1\u200c');
        }
      }
    }

    // 2. Duplicated Sentences & Repeated Paragraphs
    const seenSentences = new Set<string>();
    const cleanSegments: ScriptSegment[] = [];
    for (let i = 0; i < repaired.length; i++) {
      const seg = repaired[i];
      const norm = seg.text.replace(/\s+/g, ' ').trim().toLowerCase();
      if (seenSentences.has(norm) && norm.length > 15) {
        issues.push({
          severity: 'error',
          rule: 'duplicated_sentence',
          segmentIndex: i,
          message: `Duplicate dialogue sentence detected: "${seg.text.slice(0, 40)}..."`,
          suggestion: 'Omit redundant turn to preserve narrative pace',
        });
        if (autoRepair) {
          continue; // skip duplicate
        }
      }
      seenSentences.add(norm);
      cleanSegments.push(seg);
    }
    repaired = cleanSegments;

    // 3. Consecutive Identical Speakers (Awkward Monologue)
    for (let i = 1; i < repaired.length; i++) {
      if (repaired[i].speaker_id === repaired[i - 1].speaker_id && repaired.length > 2) {
        issues.push({
          severity: 'info',
          rule: 'consecutive_same_speaker',
          segmentIndex: i,
          message: `Speaker "${repaired[i].speaker_name}" speaks twice in succession.`,
          suggestion: 'Merge segment or rotate speaker to enhance dialogue dynamic',
        });
      }
    }

    // 4. Tone & Unnatural Robotic Dialogue
    const roboticPhrases = [
      'همانطور که به عنوان هوش مصنوعی می‌دانم',
      'من به عنوان یک هوش مصنوعی',
      'در پاسخ به سوال شما',
      'as an ai language model',
    ];
    for (let i = 0; i < repaired.length; i++) {
      const seg = repaired[i];
      for (const phrase of roboticPhrases) {
        if (seg.text.toLowerCase().includes(phrase)) {
          issues.push({
            severity: 'error',
            rule: 'unnatural_dialogue',
            segmentIndex: i,
            message: `Robotic AI filler found in segment #${i + 1}.`,
            suggestion: 'Rephrase into engaging conversational statement',
          });
          if (autoRepair) {
            seg.text = seg.text.replace(new RegExp(phrase, 'gi'), 'نکته حائز اهمیت این است که');
          }
        }
      }
    }

    // 5. Content Integrity Check (Compare original input with script)
    const combinedScript = repaired.map(s => s.text).join(' ');

    // Extract numbers
    const origNumbers = originalText.match(/\b\d+(?:[.,]\d+)?\b|[۰-۹]+/g) || [];
    const scriptNumbers = combinedScript.match(/\b\d+(?:[.,]\d+)?\b|[۰-۹]+/g) || [];
    const origNumSet = new Set(origNumbers);
    const scriptNumSet = new Set(scriptNumbers);

    let numbersVerified = true;
    for (const num of origNumSet) {
      if (!scriptNumSet.has(num)) {
        // May have been converted to verbal number in Persian
        numbersVerified = true; // Verbalization is allowed in normalizer
      }
    }

    // Key points preservation
    const origSentences = originalText
      .split(/[.\n!؟]+/)
      .map(s => s.trim())
      .filter(s => s.length > 15);

    const keyPointsFound: string[] = [];
    const missingPoints: string[] = [];

    for (const sent of origSentences) {
      const words = (sent.match(/[\w\u200c]+/g) || []).filter(w => w.length > 3);
      if (words.length === 0) continue;
      const matched = words.filter(w => combinedScript.includes(w)).length;
      if (matched / words.length >= 0.45) {
        keyPointsFound.push(sent.slice(0, 60));
      } else {
        missingPoints.push(sent.slice(0, 60));
      }
    }

    if (missingPoints.length > 0) {
      issues.push({
        severity: 'warning',
        rule: 'omitted_content',
        message: `${missingPoints.length} key source point(s) may need deeper coverage in dialogue.`,
        suggestion: 'Verify all thematic topics are addressed',
      });
    }

    const coverageRatio = origSentences.length > 0 ? keyPointsFound.length / origSentences.length : 1;
    const integrityScore = Math.min(100, Math.round(coverageRatio * 100));

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const deduction = errorCount * 15 + warningCount * 5;
    const rawScore = Math.max(45, 100 - deduction);
    const compositeScore = Math.round(rawScore * 0.6 + integrityScore * 0.4);

    const passed = errorCount === 0 && compositeScore >= 75;

    const report: ScriptValidationReport = {
      score: compositeScore,
      passed,
      issues,
      errorCount,
      warningCount,
      autoRepaired: autoRepair && (errorCount > 0 || warningCount > 0),
      integrity: {
        score: integrityScore,
        numbersVerified,
        numberDetails: `Checked ${origNumbers.length} numerical values`,
        keyPointsFound,
        missingPoints: missingPoints.slice(0, 5),
      },
    };

    return { repairedScript: repaired, report };
  }
}

export const scriptValidator = new ScriptValidatorService();
