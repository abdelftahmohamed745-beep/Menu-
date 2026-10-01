import crypto from 'crypto';
import {
  serverGetDoc,
  serverSetDoc,
  serverGetDocs,
} from './db';

// ---------------------------------------------------------------------------
// String & Digit Normalization
// ---------------------------------------------------------------------------
export function normalizeDigits(str: string): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)));
}

export function cleanSecretString(val?: string): string {
  if (!val || typeof val !== 'string') return '';
  let cleaned = val.trim();
  // Strip surrounding quotes if entered in Vercel UI
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return normalizeDigits(cleaned);
}

// ---------------------------------------------------------------------------
// Password Hashing (PBKDF2 with SHA-512 and 16-byte random salt)
// ---------------------------------------------------------------------------
export function hashPassword(plainPassword: string): string {
  const normalized = cleanSecretString(plainPassword);
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(normalized, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPasswordHash(plainInput: string, storedHashOrPlain: string): boolean {
  if (!plainInput || !storedHashOrPlain) return false;
  const normalized = cleanSecretString(plainInput);

  // Check if stored in new salt:hash format
  if (storedHashOrPlain.includes(':')) {
    const [salt, expectedHash] = storedHashOrPlain.split(':');
    if (!salt || !expectedHash) return false;
    const computedHash = crypto.pbkdf2Sync(normalized, salt, 100000, 64, 'sha512').toString('hex');
    const bufA = Buffer.from(computedHash, 'hex');
    const bufB = Buffer.from(expectedHash, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  // Legacy plain-text check (e.g. '2002500')
  const cleanStored = cleanSecretString(storedHashOrPlain);
  const hashA = crypto.createHash('sha256').update(normalized).digest();
  const hashB = crypto.createHash('sha256').update(cleanStored).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export const DEFAULT_INITIAL_RESTAURANT_PASSWORD = '2002500';

// ---------------------------------------------------------------------------
// DB Password Management for Restaurants
// ---------------------------------------------------------------------------
export async function getOrSeedRestaurantPassword(restaurantId: string): Promise<{
  passwordHash: string;
  isCustom: boolean;
}> {
  const credDoc = await serverGetDoc('restaurant_credentials', restaurantId);

  if (credDoc && credDoc.passwordHash) {
    return {
      passwordHash: credDoc.passwordHash,
      isCustom: credDoc.isCustom === true,
    };
  }

  // Check legacy fields on venue doc
  const venueDoc = await serverGetDoc('venues', restaurantId);
  if (venueDoc && venueDoc.adminPassword) {
    const rawOld = String(venueDoc.adminPassword);
    const newHash = hashPassword(rawOld);
    await serverSetDoc(
      'restaurant_credentials',
      restaurantId,
      {
        restaurantId,
        passwordHash: newHash,
        isCustom: true,
        updatedAt: new Date().toISOString(),
      },
      true
    );
    return { passwordHash: newHash, isCustom: true };
  }

  // Default seed: 2002500 (hashed)
  const defaultHash = hashPassword(DEFAULT_INITIAL_RESTAURANT_PASSWORD);
  await serverSetDoc(
    'restaurant_credentials',
    restaurantId,
    {
      restaurantId,
      passwordHash: defaultHash,
      isCustom: false,
      seededAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    true
  ).catch((err) => {
    console.warn('[PasswordManager] Could not seed default password to Firestore:', err);
  });

  return { passwordHash: defaultHash, isCustom: false };
}

export async function verifyRestaurantPassword(
  restaurantId: string,
  inputPassword: string
): Promise<{ success: boolean; rehashed?: boolean }> {
  const { passwordHash } = await getOrSeedRestaurantPassword(restaurantId);

  const isMatch = verifyPasswordHash(inputPassword, passwordHash);
  if (!isMatch) {
    return { success: false };
  }

  // If matched against plain text, upgrade to salt:hash format on the fly
  if (!passwordHash.includes(':')) {
    const upgraded = hashPassword(inputPassword);
    await serverSetDoc(
      'restaurant_credentials',
      restaurantId,
      {
        restaurantId,
        passwordHash: upgraded,
        isCustom: true,
        updatedAt: new Date().toISOString(),
      },
      true
    ).catch(() => {});
    return { success: true, rehashed: true };
  }

  return { success: true };
}

export async function updateRestaurantPassword(
  restaurantId: string,
  newPlainPassword: string
): Promise<void> {
  const cleaned = cleanSecretString(newPlainPassword);
  if (!cleaned || cleaned.length < 4) {
    throw new Error('كلمة المرور يجب ألا تقل عن 4 خانات');
  }

  const newHash = hashPassword(cleaned);
  await serverSetDoc(
    'restaurant_credentials',
    restaurantId,
    {
      restaurantId,
      passwordHash: newHash,
      isCustom: true,
      updatedAt: new Date().toISOString(),
    },
    true
  );
}
