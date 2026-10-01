import crypto from 'crypto';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { serverDb } from './db';

export interface RateLimitStatus {
  allowed: boolean;
  remainingLockoutSeconds?: number;
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
  const docRef = doc(serverDb, 'rate_limits', ipHash);

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return { allowed: true };
    }

    const data = snap.data();
    const now = Date.now();
    const lockedUntil = Number(data.lockedUntil || 0);
    const firstAttemptAt = Number(data.firstAttemptAt || 0);
    const attempts = Number(data.attempts || 0);

    // 1. Check if currently in lockout period
    if (lockedUntil > now) {
      const remainingSeconds = Math.ceil((lockedUntil - now) / 1000);
      return { allowed: false, remainingLockoutSeconds: remainingSeconds };
    }

    // 2. Check if 1-minute window expired since first attempt
    if (now - firstAttemptAt > 60 * 1000) {
      // Window expired, clean up and allow
      await deleteDoc(docRef).catch(() => {});
      return { allowed: true };
    }

    // 3. If attempts reached 5 in this window, enforce 15-minute lockout
    if (attempts >= 5) {
      const newLockedUntil = now + 15 * 60 * 1000;
      await setDoc(
        docRef,
        {
          lockedUntil: newLockedUntil,
          updatedAt: now,
        },
        { merge: true }
      ).catch(() => {});
      return { allowed: false, remainingLockoutSeconds: 15 * 60 };
    }

    return { allowed: true };
  } catch (err) {
    console.error('[RateLimiter] Error checking rate limit in Firestore:', err);
    // In case of transient Firestore error, default to allowed
    return { allowed: true };
  }
}

/**
 * Record a failed login attempt in Firestore.
 */
export async function recordFailedLoginFirestore(ip: string): Promise<void> {
  const ipHash = hashIp(ip);
  const docRef = doc(serverDb, 'rate_limits', ipHash);
  const now = Date.now();

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, {
        ipHash,
        attempts: 1,
        firstAttemptAt: now,
        lockedUntil: 0,
        updatedAt: now,
      });
      return;
    }

    const data = snap.data();
    const firstAttemptAt = Number(data.firstAttemptAt || 0);

    if (now - firstAttemptAt > 60 * 1000) {
      // Start a fresh 1-minute window
      await setDoc(docRef, {
        ipHash,
        attempts: 1,
        firstAttemptAt: now,
        lockedUntil: 0,
        updatedAt: now,
      });
    } else {
      const newAttempts = Number(data.attempts || 0) + 1;
      const lockedUntil = newAttempts >= 5 ? now + 15 * 60 * 1000 : 0;
      await setDoc(
        docRef,
        {
          attempts: newAttempts,
          lockedUntil,
          updatedAt: now,
        },
        { merge: true }
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
  const docRef = doc(serverDb, 'rate_limits', ipHash);
  try {
    await deleteDoc(docRef);
  } catch (err) {
    console.error('[RateLimiter] Error resetting failed login:', err);
  }
}
