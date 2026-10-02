import crypto from 'crypto';
import { getAdminDb, isFirebaseAdminConfigured } from './db';

export interface RateLimitResult {
  allowed: boolean;
  remainingLockoutSeconds?: number;
  remainingMinutes?: number;
  arabicMessage?: string;
}

export function hashString(str: string): string {
  return crypto.createHash('sha256').update(str.trim()).digest('hex');
}

// In-memory fallback if Admin SDK is not yet configured or Firestore has temporary connectivity issue
const memoryLimits = new Map<
  string,
  { attempts: number; firstAttemptAt: number; lockedUntil: number }
>();

function checkMemoryLimit(
  scopeHash: string,
  maxAttempts: number,
  lockoutDurationMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = memoryLimits.get(scopeHash);
  if (!entry) return { allowed: true };

  if (entry.lockedUntil > now) {
    const remainingSeconds = Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000));
    const remainingMinutes = Math.max(1, Math.ceil(remainingSeconds / 60));
    return {
      allowed: false,
      remainingLockoutSeconds: remainingSeconds,
      remainingMinutes,
      arabicMessage: `تم إيقاف المحاولات مؤقتًا لتكرار المحاولات غير الصحيحة. يرجى الانتظار ${remainingMinutes} دقيقة قبل المحاولة مرة أخرى.`,
    };
  }

  if (now - entry.firstAttemptAt > 60 * 1000) {
    memoryLimits.delete(scopeHash);
    return { allowed: true };
  }

  if (entry.attempts >= maxAttempts) {
    entry.lockedUntil = now + lockoutDurationMs;
    const remainingMinutes = Math.ceil(lockoutDurationMs / 60000);
    return {
      allowed: false,
      remainingLockoutSeconds: Math.ceil(lockoutDurationMs / 1000),
      remainingMinutes,
      arabicMessage: `تم إيقاف المحاولات مؤقتًا لتكرار المحاولات غير الصحيحة. يرجى الانتظار ${remainingMinutes} دقيقة قبل المحاولة مرة أخرى.`,
    };
  }

  return { allowed: true };
}

function recordMemoryAttempt(
  scopeHash: string,
  maxAttempts: number,
  lockoutDurationMs: number
): void {
  const now = Date.now();
  const entry = memoryLimits.get(scopeHash);
  if (!entry || now - entry.firstAttemptAt > 60 * 1000) {
    memoryLimits.set(scopeHash, {
      attempts: 1,
      firstAttemptAt: now,
      lockedUntil: 0,
    });
    return;
  }

  entry.attempts += 1;
  if (entry.attempts >= maxAttempts) {
    entry.lockedUntil = now + lockoutDurationMs;
  }
}

/**
 * Check rate limit attempt atomically.
 */
export async function checkRateLimit(
  scope: string,
  maxAttempts: number = 5,
  lockoutDurationMs: number = 15 * 60 * 1000
): Promise<RateLimitResult> {
  const scopeHash = hashString(scope);

  if (!isFirebaseAdminConfigured()) {
    return checkMemoryLimit(scopeHash, maxAttempts, lockoutDurationMs);
  }

  try {
    const db = getAdminDb();
    const docRef = db.collection('rate_limits').doc(scopeHash);
    const now = Date.now();

    const snap = await docRef.get();
    if (!snap.exists) {
      return { allowed: true };
    }

    const data = snap.data() || {};
    const lockedUntil = Number(data.lockedUntil || 0);

    if (lockedUntil > now) {
      const remainingSeconds = Math.max(1, Math.ceil((lockedUntil - now) / 1000));
      const remainingMinutes = Math.max(1, Math.ceil(remainingSeconds / 60));
      return {
        allowed: false,
        remainingLockoutSeconds: remainingSeconds,
        remainingMinutes,
        arabicMessage: `تم إيقاف المحاولات مؤقتًا لتكرار المحاولات غير الصحيحة. يرجى الانتظار ${remainingMinutes} دقيقة قبل المحاولة مرة أخرى.`,
      };
    }

    const firstAttemptAt = Number(data.firstAttemptAt || 0);
    if (now - firstAttemptAt > 60 * 1000) {
      await docRef.delete().catch(() => {});
      return { allowed: true };
    }

    const attempts = Number(data.attempts || 0);
    if (attempts >= maxAttempts) {
      const newLockedUntil = now + lockoutDurationMs;
      await docRef.set(
        {
          lockedUntil: newLockedUntil,
          updatedAt: now,
          expiresAt: new Date(newLockedUntil + 24 * 60 * 60 * 1000),
        },
        { merge: true }
      );
      const remainingMinutes = Math.ceil(lockoutDurationMs / 60000);
      return {
        allowed: false,
        remainingLockoutSeconds: Math.ceil(lockoutDurationMs / 1000),
        remainingMinutes,
        arabicMessage: `تم إيقاف المحاولات مؤقتًا لتكرار المحاولات غير الصحيحة. يرجى الانتظار ${remainingMinutes} دقيقة قبل المحاولة مرة أخرى.`,
      };
    }

    return { allowed: true };
  } catch (err: any) {
    console.warn('[RateLimiter] Firestore read failed, falling back to memory:', err?.message);
    return checkMemoryLimit(scopeHash, maxAttempts, lockoutDurationMs);
  }
}

/**
 * Record a failed attempt atomically.
 */
export async function recordFailedAttempt(
  scope: string,
  maxAttempts: number = 5,
  lockoutDurationMs: number = 15 * 60 * 1000
): Promise<void> {
  const scopeHash = hashString(scope);

  if (!isFirebaseAdminConfigured()) {
    recordMemoryAttempt(scopeHash, maxAttempts, lockoutDurationMs);
    return;
  }

  try {
    const db = getAdminDb();
    const docRef = db.collection('rate_limits').doc(scopeHash);
    const now = Date.now();

    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists) {
        transaction.set(docRef, {
          scope,
          attempts: 1,
          firstAttemptAt: now,
          lockedUntil: 0,
          updatedAt: now,
          expiresAt: new Date(now + 24 * 60 * 60 * 1000),
        });
        return;
      }

      const data = snap.data() || {};
      const firstAttemptAt = Number(data.firstAttemptAt || 0);

      if (now - firstAttemptAt > 60 * 1000) {
        transaction.set(docRef, {
          scope,
          attempts: 1,
          firstAttemptAt: now,
          lockedUntil: 0,
          updatedAt: now,
          expiresAt: new Date(now + 24 * 60 * 60 * 1000),
        });
      } else {
        const newAttempts = Number(data.attempts || 0) + 1;
        const lockedUntil = newAttempts >= maxAttempts ? now + lockoutDurationMs : 0;
        transaction.update(docRef, {
          attempts: newAttempts,
          lockedUntil,
          updatedAt: now,
          expiresAt: new Date(now + (lockedUntil > 0 ? lockoutDurationMs : 60000) + 24 * 60 * 60 * 1000),
        });
      }
    });
  } catch (err: any) {
    console.warn('[RateLimiter] Firestore transaction failed, falling back to memory:', err?.message);
    recordMemoryAttempt(scopeHash, maxAttempts, lockoutDurationMs);
  }
}

/**
 * Reset failed attempts for a specific scope on successful login.
 */
export async function resetRateLimit(scope: string): Promise<void> {
  const scopeHash = hashString(scope);
  memoryLimits.delete(scopeHash);

  if (!isFirebaseAdminConfigured()) return;

  try {
    const db = getAdminDb();
    await db.collection('rate_limits').doc(scopeHash).delete();
  } catch (err) {
    console.warn('[RateLimiter] Error resetting rate limit in Firestore:', err);
  }
}
