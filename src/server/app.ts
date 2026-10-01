import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import dotenv from 'dotenv';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  deleteField,
} from 'firebase/firestore';
import { serverDb, getDatabaseMode } from './db';
import {
  checkBruteForceFirestore,
  recordFailedLoginFirestore,
  resetFailedLoginFirestore,
} from './rateLimiter';
import {
  changeRestaurantSlugTransaction,
  toggleAliasStatus,
  getSlugAuditLogs,
} from './slugManager';

dotenv.config();

export const COOKIE_NAME = 'app_session_token';
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const RESTAURANT_OLD_PASSWORD = '2002500';

export function getSuperAdminPassword(): string {
  return (process.env.SUPER_ADMIN_PASSWORD || '').trim();
}

export function getSessionSecret(): string {
  return (process.env.SESSION_SECRET || 'restaurant_menu_super_admin_session_key_2026_xyz').trim();
}

export interface SessionPayload {
  role: 'super_admin' | 'restaurant_owner';
  restaurantId?: string;
  exp: number;
}

// ---------------------------------------------------------------------------
// IP Detection
// ---------------------------------------------------------------------------
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

// ---------------------------------------------------------------------------
// Timing-safe password verification
// ---------------------------------------------------------------------------
export function verifySuperAdminPassword(input: string): boolean {
  const secret = getSuperAdminPassword();
  if (!secret) return false;
  if (typeof input !== 'string') return false;
  const hashA = crypto.createHash('sha256').update(input).digest();
  const hashB = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

// ---------------------------------------------------------------------------
// HMAC-signed Session Token Helper
// ---------------------------------------------------------------------------
export function createSessionToken(data: Omit<SessionPayload, 'exp'>): string {
  const secret = getSessionSecret();
  const exp = Date.now() + SEVEN_DAYS_MS;
  const payload: SessionPayload = { ...data, exp };
  const str = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(str).digest('base64url');
  return `${str}.${signature}`;
}

export function parseSessionToken(token?: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [str, signature] = parts;
  const secret = getSessionSecret();
  const expectedSig = crypto.createHmac('sha256', secret).update(str).digest('base64url');

  const bufA = Buffer.from(signature);
  const bufB = Buffer.from(expectedSig);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(str, 'base64url').toString('utf-8')) as SessionPayload;
    if (Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, payload: Omit<SessionPayload, 'exp'>): void {
  const token = createSessionToken(payload);
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: SEVEN_DAYS_MS,
    path: '/',
  });
}

// Middleware: Require Super Admin Session
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  const session = parseSessionToken(token);
  if (!session || session.role !== 'super_admin') {
    res.status(401).json({ error: 'غير مصرح لك بالوصول (يتطلب صلاحية Super Admin)' });
    return;
  }
  (req as any).session = session;
  next();
}

// ---------------------------------------------------------------------------
// Create & Configure Express Application & Router
// ---------------------------------------------------------------------------
export const app = express();

app.use(express.json());
app.use(cookieParser());

// Create an API Router to mount under both /api and / to prevent rewrite issues
const apiRouter = express.Router();

// ---------------------------------------------------------------------------
// Health Check Endpoint (Diagnostics)
// ---------------------------------------------------------------------------
apiRouter.get('/health', async (req: Request, res: Response) => {
  const missing: string[] = [];
  if (!process.env.SUPER_ADMIN_PASSWORD || !process.env.SUPER_ADMIN_PASSWORD.trim()) {
    missing.push('SUPER_ADMIN_PASSWORD');
  }
  if (!process.env.SESSION_SECRET || !process.env.SESSION_SECRET.trim()) {
    missing.push('SESSION_SECRET');
  }

  let firestoreConnected = false;
  let firestoreError: string | null = null;

  try {
    // Quick test read against Firestore
    await getDoc(doc(serverDb, 'venues', 'test_health_connection'));
    firestoreConnected = true;
  } catch (err: any) {
    firestoreError = err?.message || String(err);
  }

  const dbMode = getDatabaseMode();

  const isOk = missing.length === 0 && firestoreConnected;

  res.status(isOk ? 200 : 503).json({
    ok: isOk,
    status: isOk ? 'healthy' : 'degraded',
    missingVariables: missing,
    firestore: {
      connected: firestoreConnected,
      mode: dbMode.mode,
      error: firestoreError,
    },
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Auth & Session Status APIs
// ---------------------------------------------------------------------------
apiRouter.get('/auth/session', (req: Request, res: Response) => {
  const token = req.cookies?.[COOKIE_NAME];
  const session = parseSessionToken(token);
  if (!session) {
    res.json({ isAuthenticated: false, role: null, restaurantId: null });
    return;
  }
  res.json({
    isAuthenticated: true,
    role: session.role,
    restaurantId: session.restaurantId || null,
  });
});

apiRouter.post('/auth/logout', (req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ success: true });
});

// Alternative login with restaurant password
apiRouter.post('/admin/restaurant-login', (req: Request, res: Response) => {
  const { restaurantId, password } = req.body || {};
  if (!restaurantId || typeof password !== 'string') {
    res.status(400).json({ error: 'يرجى تقديم معرف المطعم وكلمة المرور' });
    return;
  }

  if (password.trim() === RESTAURANT_OLD_PASSWORD) {
    setSessionCookie(res, {
      role: 'restaurant_owner',
      restaurantId: String(restaurantId).trim(),
    });
    res.json({ success: true, role: 'restaurant_owner', restaurantId });
    return;
  }

  res.status(401).json({ error: 'كلمة مرور المطعم غير صحيحة' });
});

// Client-side magic link consumption route (reliable across serverless & SPA)
apiRouter.post('/auth/consume-magic-link', async (req: Request, res: Response) => {
  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'رمز الرابط مطلوب' });
    return;
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const linksQuery = query(
      collection(serverDb, 'restaurant_login_links'),
      where('token_hash', '==', tokenHash)
    );
    const snapshot = await getDocs(linksQuery);

    if (snapshot.empty) {
      res.status(404).json({ error: 'الرابط غير صالح أو تم إلغاؤه' });
      return;
    }

    const linkDoc = snapshot.docs[0];
    const linkData = linkDoc.data();

    if (!linkData.is_active) {
      res.status(403).json({ error: 'تم تعطيل هذا الرابط بواسطة الإدارة' });
      return;
    }

    // Update last_used_at
    await updateDoc(doc(serverDb, 'restaurant_login_links', linkDoc.id), {
      last_used_at: new Date().toISOString(),
    });

    // Issue session cookie
    setSessionCookie(res, {
      role: 'restaurant_owner',
      restaurantId: linkData.restaurant_id,
    });

    res.json({
      success: true,
      restaurantId: linkData.restaurant_id,
    });
  } catch (err) {
    console.error('Error consuming magic link:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء معالجة الرابط' });
  }
});

// ---------------------------------------------------------------------------
// Super Admin Endpoints
// ---------------------------------------------------------------------------
apiRouter.get('/super-admin/config-status', (req: Request, res: Response) => {
  const missing: string[] = [];
  if (!process.env.SUPER_ADMIN_PASSWORD || !process.env.SUPER_ADMIN_PASSWORD.trim()) {
    missing.push('SUPER_ADMIN_PASSWORD');
  }
  if (!process.env.SESSION_SECRET || !process.env.SESSION_SECRET.trim()) {
    missing.push('SESSION_SECRET');
  }
  res.json({
    isConfigured: missing.length === 0,
    missingVariables: missing,
  });
});

apiRouter.post('/super-admin/login', async (req: Request, res: Response) => {
  const missing: string[] = [];
  if (!process.env.SUPER_ADMIN_PASSWORD || !process.env.SUPER_ADMIN_PASSWORD.trim()) {
    missing.push('SUPER_ADMIN_PASSWORD');
  }
  if (!process.env.SESSION_SECRET || !process.env.SESSION_SECRET.trim()) {
    missing.push('SESSION_SECRET');
  }

  if (missing.length > 0) {
    res.status(500).json({
      error: `إعداد الخادم ناقص: ${missing.join(', ')}`,
      missingVariables: missing,
    });
    return;
  }

  const ip = getClientIp(req);
  const rateCheck = await checkBruteForceFirestore(ip);

  if (!rateCheck.allowed) {
    res.status(429).json({
      error: 'بيانات الاعتماد غير صالحة',
      retryAfter: rateCheck.remainingLockoutSeconds,
    });
    return;
  }

  const { password } = req.body || {};
  if (!password || !verifySuperAdminPassword(password)) {
    await recordFailedLoginFirestore(ip);
    res.status(401).json({ error: 'بيانات الاعتماد غير صالحة' });
    return;
  }

  await resetFailedLoginFirestore(ip);
  setSessionCookie(res, { role: 'super_admin' });
  res.json({ success: true, role: 'super_admin' });
});

apiRouter.post('/super-admin/logout', (req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ success: true });
});

apiRouter.get('/super-admin/me', requireSuperAdmin, (req: Request, res: Response) => {
  res.json({ isAuthenticated: true, role: 'super_admin' });
});

// List all restaurants with magic link status and public ID aliases
apiRouter.get('/super-admin/restaurants', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const venuesSnapshot = await getDocs(collection(serverDb, 'venues'));
    const linksSnapshot = await getDocs(collection(serverDb, 'restaurant_login_links'));

    const linksByVenueId = new Map<string, any>();
    linksSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.restaurant_id) {
        linksByVenueId.set(data.restaurant_id, {
          id: docSnap.id,
          ...data,
        });
      }
    });

    const restaurants = venuesSnapshot.docs.map((docSnap) => {
      const venue = docSnap.data();
      const link = linksByVenueId.get(docSnap.id);

      return {
        id: docSnap.id, // Internal immutable ID
        name: venue.name || 'بدون اسم',
        slug: venue.slug || docSnap.id, // Current Public ID
        previousSlugs: venue.previousSlugs || [],
        currency: venue.currency || 'SAR',
        createdAt: venue.createdAt || null,
        hasLink: Boolean(link),
        isLinkActive: Boolean(link?.is_active),
        linkCreatedAt: link?.created_at || null,
        lastUsedAt: link?.last_used_at || null,
      };
    });

    restaurants.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    res.json({ restaurants });
  } catch (err: any) {
    console.error('Error fetching restaurants:', err);
    res.status(500).json({ error: 'تعذر تحميل بيانات المطاعم' });
  }
});

// Generate / Get magic link
apiRouter.post('/super-admin/restaurants/:restaurantId/link', requireSuperAdmin, async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  if (!restaurantId) {
    res.status(400).json({ error: 'معرف المطعم مطلوب' });
    return;
  }

  try {
    const linkDocRef = doc(serverDb, 'restaurant_login_links', `link_${restaurantId}`);
    const existingDoc = await getDoc(linkDocRef);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date().toISOString();

    await setDoc(linkDocRef, {
      id: `link_${restaurantId}`,
      restaurant_id: restaurantId,
      token_hash: tokenHash,
      is_active: true,
      created_at: now,
      last_used_at: existingDoc.exists() ? existingDoc.data().last_used_at || null : null,
    });

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const fullUrl = `${protocol}://${host}/r/${rawToken}`;

    res.json({
      success: true,
      token: rawToken,
      fullUrl,
      is_active: true,
      created_at: now,
    });
  } catch (err: any) {
    console.error('Error generating link:', err);
    res.status(500).json({ error: 'تعذر إنشاء الرابط السحري' });
  }
});

// Regenerate magic link
apiRouter.post('/super-admin/restaurants/:restaurantId/regenerate-link', requireSuperAdmin, async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  if (!restaurantId) {
    res.status(400).json({ error: 'معرف المطعم مطلوب' });
    return;
  }

  try {
    const linkDocRef = doc(serverDb, 'restaurant_login_links', `link_${restaurantId}`);
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date().toISOString();

    await setDoc(linkDocRef, {
      id: `link_${restaurantId}`,
      restaurant_id: restaurantId,
      token_hash: tokenHash,
      is_active: true,
      created_at: now,
      last_used_at: null,
    });

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const fullUrl = `${protocol}://${host}/r/${rawToken}`;

    res.json({
      success: true,
      token: rawToken,
      fullUrl,
      is_active: true,
      created_at: now,
    });
  } catch (err: any) {
    console.error('Error regenerating link:', err);
    res.status(500).json({ error: 'تعذر إعادة توليد الرابط' });
  }
});

// Toggle active status of magic link
apiRouter.patch('/super-admin/restaurants/:restaurantId/link/toggle', requireSuperAdmin, async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  if (!restaurantId) {
    res.status(400).json({ error: 'معرف المطعم مطلوب' });
    return;
  }

  try {
    const linkDocRef = doc(serverDb, 'restaurant_login_links', `link_${restaurantId}`);
    const snapshot = await getDoc(linkDocRef);

    if (!snapshot.exists()) {
      res.status(404).json({ error: 'لا يوجد رابط مسجل لهذا المطعم' });
      return;
    }

    const currentStatus = Boolean(snapshot.data().is_active);
    const newStatus = !currentStatus;

    await updateDoc(linkDocRef, {
      is_active: newStatus,
    });

    res.json({ success: true, is_active: newStatus });
  } catch (err: any) {
    console.error('Error toggling link:', err);
    res.status(500).json({ error: 'تعذر تعديل حالة الرابط' });
  }
});

// ---------------------------------------------------------------------------
// Changeable Restaurant Public ID (Slug) Endpoints
// ---------------------------------------------------------------------------
apiRouter.post('/venues/:venueId/change-slug', async (req: Request, res: Response) => {
  const { venueId } = req.params;
  const { newSlug } = req.body || {};

  // Check authorization: Super Admin OR Restaurant Owner of this venueId
  const token = req.cookies?.[COOKIE_NAME];
  const session = parseSessionToken(token);

  if (!session) {
    res.status(401).json({ error: 'يجب تسجيل الدخول أولاً لتغيير معرّف المطعم' });
    return;
  }

  const isSuperAdmin = session.role === 'super_admin';
  const isOwner = session.role === 'restaurant_owner' && session.restaurantId === venueId;

  if (!isSuperAdmin && !isOwner) {
    res.status(403).json({ error: 'غير مصرح لك بتغيير معرّف هذا المطعم' });
    return;
  }

  try {
    const result = await changeRestaurantSlugTransaction({
      venueId,
      newSlugRaw: newSlug,
      changedBy: isSuperAdmin ? 'super_admin' : 'restaurant_owner',
    });

    res.json(result);
  } catch (err: any) {
    console.error('Error changing restaurant slug:', err);
    res.status(400).json({ error: err.message || 'فشل تغيير معرّف المطعم' });
  }
});

// Toggle alias redirect status
apiRouter.patch('/venues/:venueId/aliases/:aliasSlug/toggle', async (req: Request, res: Response) => {
  const { venueId, aliasSlug } = req.params;

  const token = req.cookies?.[COOKIE_NAME];
  const session = parseSessionToken(token);

  if (!session) {
    res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
    return;
  }

  const isSuperAdmin = session.role === 'super_admin';
  const isOwner = session.role === 'restaurant_owner' && session.restaurantId === venueId;

  if (!isSuperAdmin && !isOwner) {
    res.status(403).json({ error: 'غير مصرح لك بتعديل تحويلات هذا المطعم' });
    return;
  }

  try {
    const result = await toggleAliasStatus(venueId, aliasSlug);
    res.json(result);
  } catch (err: any) {
    console.error('Error toggling alias:', err);
    res.status(400).json({ error: err.message || 'فشل تعديل حالة التحويل' });
  }
});

// Get Audit Logs for Public ID Changes
apiRouter.get('/super-admin/slug-audit-logs', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const venueId = typeof req.query.venueId === 'string' ? req.query.venueId : undefined;
    const logs = await getSlugAuditLogs(venueId);
    res.json({ logs });
  } catch (err: any) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ error: 'تعذر تحميل سجل التغييرات' });
  }
});

// DB Migration Endpoint: Remove Access Codes & Seed Slugs
apiRouter.post('/migrations/remove-access-codes', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const venuesRef = collection(serverDb, 'venues');
    const snapshot = await getDocs(venuesRef);
    let cleaned = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const fieldsToDelete: Record<string, any> = {};
      if ('accessCode' in data) fieldsToDelete.accessCode = deleteField();
      if ('access_code' in data) fieldsToDelete.access_code = deleteField();
      if ('adminCode' in data) fieldsToDelete.adminCode = deleteField();
      if ('code' in data && typeof data.code === 'string' && data.code.length <= 12) {
        fieldsToDelete.code = deleteField();
      }

      // Ensure slug is registered in slug_registry
      const slugVal = (data.slug || docSnap.id).toLowerCase();
      const regDocRef = doc(serverDb, 'slug_registry', slugVal);
      await setDoc(
        regDocRef,
        {
          slug: slugVal,
          venueId: docSnap.id,
          type: 'primary',
          isActive: true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      if (Object.keys(fieldsToDelete).length > 0) {
        await updateDoc(doc(serverDb, 'venues', docSnap.id), fieldsToDelete);
        cleaned++;
      }
    }

    res.json({
      success: true,
      scannedVenues: snapshot.size,
      cleanedVenues: cleaned,
      message: 'تم تنظيف كافة حقول الأكواد القديمة وتأمين معرّفات المطاعم بنجاح',
    });
  } catch (err: any) {
    console.error('Migration error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تنفيذ الترحيل' });
  }
});

// Magic link redirect handler
const magicLinkHandler = async (req: Request, res: Response) => {
  const { token } = req.params;
  if (!token || typeof token !== 'string') {
    res.redirect('/magic-link-error');
    return;
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const linksQuery = query(
      collection(serverDb, 'restaurant_login_links'),
      where('token_hash', '==', tokenHash)
    );
    const snapshot = await getDocs(linksQuery);

    if (snapshot.empty) {
      res.redirect('/magic-link-error');
      return;
    }

    const linkDoc = snapshot.docs[0];
    const linkData = linkDoc.data();

    if (!linkData.is_active) {
      res.redirect('/magic-link-error');
      return;
    }

    // Update last_used_at
    await updateDoc(doc(serverDb, 'restaurant_login_links', linkDoc.id), {
      last_used_at: new Date().toISOString(),
    });

    // Issue session cookie
    setSessionCookie(res, {
      role: 'restaurant_owner',
      restaurantId: linkData.restaurant_id,
    });

    res.redirect(`/admin/${linkData.restaurant_id}`);
  } catch (err) {
    console.error('Error handling magic link:', err);
    res.redirect('/magic-link-error');
  }
};

apiRouter.get('/r/:token', magicLinkHandler);
app.get('/r/:token', magicLinkHandler);

// Mount router under BOTH /api and / so it works regardless of Vercel rewrite stripping
app.use('/api', apiRouter);
app.use(apiRouter);

export default app;
