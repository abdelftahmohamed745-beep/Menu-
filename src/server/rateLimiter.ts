import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './db';

export interface RateLimitResult {
  allowed: boolean;
  remainingLockoutSeconds?: number;
  remainingMinutes?: number;
  arabicMessage?: string;
}

export function hashString(str: string): string {
  return crypto.createHash('sha256').update(str.trim()).digest('hex');
}

/**
 * Check and record a rate limit attempt atomically.
 * @param scope Unique key for the attempt, e.g. "super-admin:ipHash" or "restaurant:restaurantId:ipHash"
 * @param maxAttempts Max allowed failed attempts within 1 minute (e.g. 3 for super admin, 5 for restaurant)
 * @param lockoutDurationMs Lockout duration in milliseconds (default 15 minutes)
 */
export async function checkRateLimit(
  scope: string,
  maxAttempts: number = 5,
  lockoutDurationMs: number = 15 * 60 * 1000
): Promise<RateLimitResult> {
  const scopeHash = hashString(scope);
  const db = getAdminDb();
  const docRef = db.collection('rate_limits').doc(scopeHash);
  const now = Date.now();

  try {
    const snap = await docRef.get();
    if (!snap.exists) {
      return { allowed: true };
    }

    const data = snap.data() || {};
    const lockedUntil = Number(data.lockedUntil || 0);

    // 1. Currently locked out
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
    // 2. Window expired
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
          expiresAt: new Date(newLockedUntil + 24 * 60 * 60 * 1000), // Firestore TTL
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
    console.error('[RateLimiter] Error reading rate limit:', err);
    // Fail closed if Firestore unreachable for auth routes
    throw new Error('FIRESTORE_UNAVAILABLE');
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
  const db = getAdminDb();
  const docRef = db.collection('rate_limits').doc(scopeHash);
  const now = Date.now();

  try {
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
        // Reset 1-minute window
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
  } catch (err) {
    console.error('[RateLimiter] Error recording failed attempt:', err);
  }
}

/**
 * Reset failed attempts for a specific scope on successful login.
 */
export async function resetRateLimit(scope: string): Promise<void> {
  const scopeHash = hashString(scope);
  const db = getAdminDb();
  try {
    await db.collection('rate_limits').doc(scopeHash).delete();
  } catch (err) {
    console.error('[RateLimiter] Error resetting rate limit:', err);
  }
}
