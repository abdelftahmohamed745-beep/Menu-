import crypto from 'crypto';
import type { Request, Response } from 'express';
import { getAdminDb, getAdminAuth, isFirebaseAdminConfigured } from './db';
import { cleanString, normalizeDigits } from './config';

export const SUPER_ADMIN_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours
export const RESTAURANT_OWNER_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function getSessionSecret(): string {
  const secret = cleanString(process.env.SESSION_SECRET);
  if (secret) {
    return secret;
  }
  // Deterministic fallback derived from SUPER_ADMIN_PASSWORD
  const pass = cleanString(process.env.SUPER_ADMIN_PASSWORD);
  if (pass) {
    return crypto.createHash('sha256').update(`menu-session-salt:${pass}`).digest('hex');
  }
  return 'app_session_secret_default_hmac_key_min_32_chars';
}

export function getSuperAdminPassword(): string {
  const pass = cleanString(process.env.SUPER_ADMIN_PASSWORD);
  if (!pass && !process.env.SUPER_ADMIN_PASSWORD_HASH) {
    throw new Error('MISSING_ENV:SUPER_ADMIN_PASSWORD');
  }
  return pass;
}

export function verifySuperAdminPassword(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const normalizedInput = normalizeDigits(cleanString(input));

  // 1. Check against hash if configured
  const envHash = cleanString(process.env.SUPER_ADMIN_PASSWORD_HASH);
  if (envHash) {
    const computed = crypto.createHash('sha256').update(normalizedInput).digest('hex');
    const bufA = Buffer.from(computed);
    const bufB = Buffer.from(envHash);
    if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
      return true;
    }
  }

  // 2. Check against plain env var
  const envPass = getSuperAdminPassword();
  if (!envPass) return false;
  const hashA = crypto.createHash('sha256').update(normalizedInput).digest();
  const hashB = crypto.createHash('sha256').update(normalizeDigits(envPass)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export interface SessionPayload {
  role: 'super_admin' | 'restaurant_owner';
  restaurantId?: string;
  sessionVersion?: string;
  jti: string;
  exp: number;
}

export function isRequestHttps(req: Request): boolean {
  try {
    if (req.secure) return true;
  } catch {}
  return req.headers?.['x-forwarded-proto'] === 'https';
}

export function getCookieName(req: Request): string {
  const isHttps = isRequestHttps(req);
  const isProduction = process.env.NODE_ENV === 'production' && !process.env.AIS_DEV;
  // __Host- prefix requires HTTPS and path=/ with no Domain
  if (isProduction && isHttps) {
    return '__Host-app_session_token';
  }
  return 'app_session_token';
}

export function createSignedToken(payload: SessionPayload): string {
  const secret = getSessionSecret();
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function parseSignedToken(token?: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;

  let secret: string;
  try {
    secret = getSessionSecret();
  } catch {
    return null;
  }

  const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const bufA = Buffer.from(sig);
  const bufB = Buffer.from(expectedSig);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as SessionPayload;
    if (Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Fetch or initialize the session version for a restaurant.
 */
export async function getRestaurantSessionVersion(restaurantId: string): Promise<string> {
  if (!isFirebaseAdminConfigured()) return 'v1';
  try {
    const db = getAdminDb();
    const docRef = db.collection('sessions').doc(restaurantId);
    const snap = await docRef.get();
    if (snap.exists && snap.data()?.sessionVersion) {
      return snap.data()!.sessionVersion;
    }
    const newVer = crypto.randomBytes(8).toString('hex');
    await docRef.set({ sessionVersion: newVer, updatedAt: new Date().toISOString() }, { merge: true });
    return newVer;
  } catch {
    return 'v1';
  }
}

export async function bumpRestaurantSessionVersion(restaurantId: string): Promise<void> {
  if (!isFirebaseAdminConfigured()) return;
  try {
    const db = getAdminDb();
    const newVer = crypto.randomBytes(8).toString('hex');
    await db
      .collection('sessions')
      .doc(restaurantId)
      .set({ sessionVersion: newVer, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn('Failed to bump restaurant session version:', err);
  }
}

export async function bumpGlobalSessionVersion(): Promise<void> {
  if (!isFirebaseAdminConfigured()) return;
  try {
    const db = getAdminDb();
    const newVer = crypto.randomBytes(8).toString('hex');
    await db
      .collection('sessions')
      .doc('_global_super_admin')
      .set({ sessionVersion: newVer, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn('Failed to bump global session version:', err);
  }
}

export async function getGlobalSessionVersion(): Promise<string> {
  if (!isFirebaseAdminConfigured()) return 'v1';
  try {
    const db = getAdminDb();
    const snap = await db.collection('sessions').doc('_global_super_admin').get();
    if (snap.exists && snap.data()?.sessionVersion) {
      return snap.data()!.sessionVersion;
    }
  } catch {
    // fallback
  }
  return 'v1';
}

/**
 * Issue session cookie with environment-safe SameSite/Secure attributes.
 */
export function setSessionCookie(
  req: Request,
  res: Response,
  data: { role: 'super_admin' | 'restaurant_owner'; restaurantId?: string; sessionVersion?: string }
): void {
  const maxAge =
    data.role === 'super_admin' ? SUPER_ADMIN_MAX_AGE_MS : RESTAURANT_OWNER_MAX_AGE_MS;
  const exp = Date.now() + maxAge;
  const jti = crypto.randomBytes(12).toString('hex');

  const payload: SessionPayload = {
    role: data.role,
    restaurantId: data.restaurantId,
    sessionVersion: data.sessionVersion || 'v1',
    jti,
    exp,
  };

  const token = createSignedToken(payload);
  const isHttps = isRequestHttps(req);
  const isAiStudio = Boolean(process.env.AIS_DEV || req.headers?.['sec-fetch-dest'] === 'iframe');
  const cookieName = getCookieName(req);

  if (typeof (res as any).cookie === 'function') {
    res.cookie(cookieName, token, {
      httpOnly: true,
      secure: isHttps || isAiStudio,
      sameSite: isAiStudio ? 'none' : 'lax',
      maxAge,
      path: '/',
    });
  } else {
    const sameSite = isAiStudio ? 'None' : 'Lax';
    const secureFlag = isHttps || isAiStudio ? '; Secure' : '';
    const cookieHeader = `${cookieName}=${token}; Path=/; Max-Age=${Math.floor(maxAge / 1000)}; HttpOnly; SameSite=${sameSite}${secureFlag}`;
    res.setHeader('Set-Cookie', cookieHeader);
  }
}

export function clearSessionCookie(req: Request, res: Response): void {
  const names = [getCookieName(req), '__Host-app_session_token', 'app_session_token'];
  for (const name of names) {
    res.clearCookie(name, { path: '/' });
  }
}

/**
 * Mint a Firebase Custom Token so client SDK can authenticate against Firestore rules.
 */
export async function mintFirebaseCustomToken(claims: {
  role: 'super_admin' | 'restaurant_owner';
  venueId?: string;
}): Promise<string | null> {
  if (!isFirebaseAdminConfigured()) {
    return null;
  }
  try {
    const auth = getAdminAuth();
    const uid =
      claims.role === 'super_admin'
        ? `admin_${Date.now()}`
        : `owner_${claims.venueId}_${Date.now()}`;
    return await auth.createCustomToken(uid, claims);
  } catch (err) {
    console.warn('[Session] Failed to mint Firebase Custom Token:', err);
    return null;
  }
}
