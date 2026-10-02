export const FIRESTORE_DATABASE_ID =
  process.env.FIREBASE_DATABASE_ID ||
  process.env.VITE_FIREBASE_DATABASE_ID ||
  'ai-studio-6515c201-ec9e-4f37-b01d-e3683d1a8c6e';

export const FIREBASE_PROJECT_ID_DEFAULT =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  'keen-flame-j53bd';

export const FIREBASE_STORAGE_BUCKET_DEFAULT =
  process.env.FIREBASE_STORAGE_BUCKET ||
  'keen-flame-j53bd.firebasestorage.app';

export function cleanString(val?: string | null): string {
  if (!val || typeof val !== 'string') return '';
  let str = val.trim();
  if (
    (str.startsWith('"') && str.endsWith('"')) ||
    (str.startsWith("'") && str.endsWith("'"))
  ) {
    str = str.slice(1, -1).trim();
  }
  return str;
}

export function cleanPrivateKey(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  // Replace literal '\n' characters with actual newlines
  key = key.replace(/\\n/g, '\n');
  return key.trim();
}

export function normalizeDigits(str: string): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)));
}
