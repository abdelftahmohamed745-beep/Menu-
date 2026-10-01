import crypto from 'crypto';
import { serverGetDoc, serverSetDoc, serverDeleteDoc } from './db';

export interface RateLimitStatus {
  allowed: boolean;
  remainingLockoutSeconds?: number;
  remainingMinutes?: number;
  arabicMessage?: string;
}

export function hashIp(ip: string): string {
  return crypto.createHash('sha256').update((ip || '127.0.0.1').trim()).digest('hex');
}

/**
 * Check if the IP is currently locked out or allowed to attempt login.
 * Window: 1 minute (60,000 ms)
 * Max failed attempts: 5
 * Lockout duration: 15 minutes (900,000 ms)
 */
export async function checkBruteForceFirestore(ip: string): Promise<RateLimitStatus> {
  const ipHash = hashIp(ip);

  try {
    const data = await serverGetDoc('rate_limits', ipHash);
    if (!data) {
      return { allowed: true };
    }

    const now = Date.now();
    const lockedUntil = Number(data.lockedUntil || 0);
    const firstAttemptAt = Number(data.firstAttemptAt || 0);
    const attempts = Number(data.attempts || 0);

    // 1. Check if currently in lockout period
    if (lockedUntil > now) {
      const remainingLockoutSeconds = Math.max(1, Math.ceil((lockedUntil - now) / 1000));
      const remainingMinutes = Math.max(1, Math.ceil(remainingLockoutSeconds / 60));
      return {
        allowed: false,
        remainingLockoutSeconds,
        remainingMinutes,
        arabicMessage: `تم إيقاف المحاولات مؤقتًا لتكرار المحاولات غير الصحيحة. يرجى الانتظار ${remainingMinutes} دقيقة قبل المحاولة مرة أخرى.`,
      };
    }

    // 2. Check if 1-minute window expired since first attempt
    if (now - firstAttemptAt > 60 * 1000) {
      // Window expired, clean up and allow
      await serverDeleteDoc('rate_limits', ipHash).catch(() => {});
      return { allowed: true };
    }

    // 3. If attempts reached 5 in this window, enforce 15-minute lockout
    if (attempts >= 5) {
      const newLockedUntil = now + 15 * 60 * 1000;
      await serverSetDoc(
        'rate_limits',
        ipHash,
        {
          lockedUntil: newLockedUntil,
          updatedAt: now,
        },
        true
      ).catch(() => {});
      return {
        allowed: false,
        remainingLockoutSeconds: 15 * 60,
        remainingMinutes: 15,
        arabicMessage: 'تم إيقاف المحاولات مؤقتًا لتكرار المحاولات غير الصحيحة. يرجى الانتظار 15 دقيقة قبل المحاولة مرة أخرى.',
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error('[RateLimiter] Error checking rate limit in Firestore:', err);
    // In case of transient Firestore error, default to allowed to prevent accidental lockout
    return { allowed: true };
  }
}

/**
 * Record a failed login attempt in Firestore.
 */
export async function recordFailedLoginFirestore(ip: string): Promise<void> {
  const ipHash = hashIp(ip);
  const now = Date.now();

  try {
    const data = await serverGetDoc('rate_limits', ipHash);
    if (!data) {
      await serverSetDoc('rate_limits', ipHash, {
        ipHash,
        attempts: 1,
        firstAttemptAt: now,
        lockedUntil: 0,
        updatedAt: now,
      });
      return;
    }

    const firstAttemptAt = Number(data.firstAttemptAt || 0);

    if (now - firstAttemptAt > 60 * 1000) {
      // Start a fresh 1-minute window
      await serverSetDoc('rate_limits', ipHash, {
        ipHash,
        attempts: 1,
        firstAttemptAt: now,
        lockedUntil: 0,
        updatedAt: now,
      });
    } else {
      const newAttempts = Number(data.attempts || 0) + 1;
      const lockedUntil = newAttempts >= 5 ? now + 15 * 60 * 1000 : 0;
      await serverSetDoc(
        'rate_limits',
        ipHash,
        {
          attempts: newAttempts,
          lockedUntil,
          updatedAt: now,
        },
        true
      );
    }
  } catch (err) {
    console.error('[RateLimiter] Error recording failed login:', err);
  }
}

/**
 * Reset failed login attempts on successful login.
 */
export async function resetFailedLoginFirestore(ip: string): Promise<void> {
  const ipHash = hashIp(ip);
  try {
    await serverDeleteDoc('rate_limits', ipHash);
  } catch (err) {
    console.error('[RateLimiter] Error resetting rate limit after successful login:', err);
  }
}
