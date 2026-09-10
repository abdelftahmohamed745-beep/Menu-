/**
 * Arabic text normalization and fuzzy matching helpers
 */

// Arabic diacritics (tashkeel) regex: fathah, dammah, kasrah, sukun, shaddah, tanween, etc.
const TASHKEEL_REGEX = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
// Arabic tatweel / kashida (ـ)
const TATWEEL_REGEX = /\u0640/g;

/**
 * Normalizes an Arabic string for resilient search:
 * - Removes tashkeel (diacritics)
 * - Removes tatweel / kashida
 * - Unifies alef variations (أ, إ, آ, ٱ -> ا)
 * - Unifies teh marbuta and heh (ة -> ه)
 * - Unifies alef maksura and yeh (ى -> ي)
 * - Strips extra white spaces
 * - Lowercases any latin characters
 */
export function normalizeArabicText(text?: string | null): string {
  if (!text) return '';

  return text
    .replace(TASHKEEL_REGEX, '')
    .replace(TATWEEL_REGEX, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Checks if search text matches target text using Arabic normalization
 */
export function arabicTextIncludes(targetText: string, searchQuery: string): boolean {
  const normalizedTarget = normalizeArabicText(targetText);
  const normalizedQuery = normalizeArabicText(searchQuery);

  if (!normalizedQuery) return true;
  return normalizedTarget.includes(normalizedQuery);
}
