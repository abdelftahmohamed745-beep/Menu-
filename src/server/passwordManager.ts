import crypto from 'crypto';
import { getAdminDb } from './db';
import { normalizeDigits, cleanString } from './config';

export const PBKDF2_ITERATIONS = 210000;
export const PBKDF2_KEYLEN = 64;
export const PBKDF2_DIGEST = 'sha512';
export const LEGACY_DEFAULT_PASSWORD = '2002500';

const DISALLOWED_PASSWORDS = new Set([
  '2002500',
  '123456',
  '12345678',
  'password',
  '000000',
  '111111',
  'admin123',
]);

/**
 * Hash a password using PBKDF2 with 210,000 iterations and random 16-byte salt.
 * Format: pbkdf2:210000:<saltHex>:<hashHex>
 */
export function hashPassword(plainPassword: string): string {
  const normalized = normalizeDigits(cleanString(plainPassword));
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(normalized, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString('hex');
  return `pbkdf2:${PBKDF2_ITERATIONS}:${salt}:${hash}`;
}

/**
 * Constant-time dummy hash to prevent timing attacks / user enumeration.
 */
export function executeDummyHash(): void {
  const dummySalt = '0123456789abcdef0123456789abcdef';
  crypto.pbkdf2Sync('dummy_password_timing_check', dummySalt, 10000, 32, 'sha256');
}

/**
 * Verify a plain password against stored hash.
 */
export function verifyPassword(
  plainInput: string,
  storedHashOrPlain: string
): { isMatch: boolean; needsRehash: boolean } {
  if (!plainInput || !storedHashOrPlain) return { isMatch: false, needsRehash: false };
  const normalized = normalizeDigits(cleanString(plainInput));

  // 1. Current standard: pbkdf2:iterations:salt:hash
  if (storedHashOrPlain.startsWith('pbkdf2:')) {
    const parts = storedHashOrPlain.split(':');
    if (parts.length === 4) {
      const iters = parseInt(parts[1], 10);
      const salt = parts[2];
      const expectedHash = parts[3];
      const computedHash = crypto
        .pbkdf2Sync(normalized, salt, iters, expectedHash.length / 2, PBKDF2_DIGEST)
        .toString('hex');

      const bufA = Buffer.from(computedHash, 'hex');
      const bufB = Buffer.from(expectedHash, 'hex');
      const isMatch = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
      const needsRehash = isMatch && iters < PBKDF2_ITERATIONS;
      return { isMatch, needsRehash };
    }
  }

  // 2. Legacy salt:hash format
  if (storedHashOrPlain.includes(':') && storedHashOrPlain.split(':').length === 2) {
    const [salt, expectedHash] = storedHashOrPlain.split(':');
    const computedHash = crypto
      .pbkdf2Sync(normalized, salt, 100000, 64, PBKDF2_DIGEST)
      .toString('hex');
    const bufA = Buffer.from(computedHash, 'hex');
    const bufB = Buffer.from(expectedHash, 'hex');
    const isMatch = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
    return { isMatch, needsRehash: isMatch };
  }

  // 3. Plain text legacy fallback (e.g. '2002500')
  const cleanStored = normalizeDigits(cleanString(storedHashOrPlain));
  const hashA = crypto.createHash('sha256').update(normalized).digest();
  const hashB = crypto.createHash('sha256').update(cleanStored).digest();
  const isMatch = crypto.timingSafeEqual(hashA, hashB);
  return { isMatch, needsRehash: isMatch };
}

/**
 * Generate a strong random temporary password for a newly created restaurant.
 */
export function generateRandomPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let res = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    res += chars[bytes[i] % chars.length];
  }
  return res;
}

export interface RestaurantCredentials {
  restaurantId: string;
  passwordHash: string;
  mustChangePassword: boolean;
  isCustom: boolean;
  updatedAt: string;
}

/**
 * Get or initialize credentials for an existing restaurant (transition rule).
 */
export async function getOrMigrateRestaurantPassword(
  restaurantId: string
): Promise<RestaurantCredentials> {
  const db = getAdminDb();
  const docRef = db.collection('restaurant_credentials').doc(restaurantId);
  const snap = await docRef.get();

  if (snap.exists) {
    const data = snap.data() as any;
    return {
      restaurantId,
      passwordHash: data.passwordHash,
      mustChangePassword: Boolean(data.mustChangePassword),
      isCustom: Boolean(data.isCustom),
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  }

  // Check legacy field in venues collection
  const venueDoc = await db.collection('venues').doc(restaurantId).get();
  if (venueDoc.exists) {
    const venueData = venueDoc.data() as any;
    if (venueData.adminPassword) {
      const rawOld = String(venueData.adminPassword);
      const newHash = hashPassword(rawOld);
      const isLegacyDefault = rawOld.trim() === LEGACY_DEFAULT_PASSWORD;
      const creds: RestaurantCredentials = {
        restaurantId,
        passwordHash: newHash,
        mustChangePassword: isLegacyDefault,
        isCustom: !isLegacyDefault,
        updatedAt: new Date().toISOString(),
      };
      await docRef.set(creds, { merge: true });
      return creds;
    }
  }

  // Transition Rule: Existing restaurant with no custom password gets hashed 2002500 with mustChangePassword=true
  const defaultHash = hashPassword(LEGACY_DEFAULT_PASSWORD);
  const creds: RestaurantCredentials = {
    restaurantId,
    passwordHash: defaultHash,
    mustChangePassword: true,
    isCustom: false,
    updatedAt: new Date().toISOString(),
  };

  await docRef.set(creds, { merge: true }).catch((err) => {
    console.warn('[PasswordManager] Could not save initial credentials:', err);
  });

  return creds;
}

/**
 * Set a new password for a restaurant.
 */
export async function setRestaurantPassword(
  restaurantId: string,
  newPlainPassword: string
): Promise<void> {
  const cleaned = cleanString(newPlainPassword);
  if (!cleaned || cleaned.length < 6) {
    throw new Error('كلمة المرور يجب ألا تقل عن 6 خانات');
  }

  if (DISALLOWED_PASSWORDS.has(cleaned.toLowerCase())) {
    throw new Error('كلمة المرور هذه شائعة أو افتراضية وغير مسموح بها لأسباب أمنية');
  }

  const newHash = hashPassword(cleaned);
  const db = getAdminDb();
  await db.collection('restaurant_credentials').doc(restaurantId).set(
    {
      restaurantId,
      passwordHash: newHash,
      mustChangePassword: false,
      isCustom: true,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  // Increment session version so all existing logins are revoked
  await db
    .collection('sessions')
    .doc(restaurantId)
    .set(
      {
        sessionVersion: crypto.randomBytes(8).toString('hex'),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    )
    .catch(() => {});
}
