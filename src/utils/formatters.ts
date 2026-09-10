/**
 * Formatting utilities for currency and numbers
 */

const CURRENCY_NAME_MAP: Record<string, string> = {
  SAR: 'ر.س',
  AED: 'د.إ',
  KWD: 'د.ك',
  BHD: 'د.ب',
  QAR: 'ر.ق',
  OMR: 'ر.ع',
  EGP: 'ج.م',
  JOD: 'د.أ',
  USD: '$',
  EUR: '€',
};

/**
 * Formats a price using venue currency and Arabic numerals or standardized symbols
 */
export function formatCurrency(amount: number, currencyCode: string = 'SAR'): string {
  try {
    // Attempt standard Intl format in Arabic locale
    const formatter = new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    });
    return formatter.format(amount);
  } catch {
    // Fallback if the currency code is non-standard
    const symbol = CURRENCY_NAME_MAP[currencyCode.toUpperCase()] || currencyCode;
    return `${amount} ${symbol}`;
  }
}
