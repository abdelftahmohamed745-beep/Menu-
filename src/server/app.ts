import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import dotenv from 'dotenv';
import {
  serverDb,
  getDatabaseMode,
  serverGetDoc,
  serverSetDoc,
  serverUpdateDoc,
  serverDeleteDoc,
  serverGetDocs,
  testFirestoreDiagnostics,
} from './db';
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
import {
  cleanSecretString,
  normalizeDigits,
  verifyPasswordHash,
  verifyRestaurantPassword,
  updateRestaurantPassword,
  getOrSeedRestaurantPassword,
} from './passwordManager';

dotenv.config();

export const COOKIE_NAME = 'app_session_token';
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function getSuperAdminPassword(): string {
  return cleanSecretString(process.env.SUPER_ADMIN_PASSWORD);
}

export function getSessionSecret(): string {
  const envVal = cleanSecretString(process.env.SESSION_SECRET);
  return envVal || 'restaurant_menu_super_admin_session_key_2026_xyz_default_secret_seed';
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
// Timing-safe Super Admin Password Verification
// ---------------------------------------------------------------------------
export function verifySuperAdminPassword(input: string): boolean {
  const secret = getSuperAdminPassword();
  if (!secret) return false;
  if (typeof input !== 'string') return false;

  const normalizedInput = cleanSecretString(input);
  const hashA = crypto.createHash('sha256').update(normalizedInput).digest();
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
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
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
// Create & Configure Express Application
// ---------------------------------------------------------------------------
export const app = express();

// Full CORS with credentials support (essential for Vercel preview & subdomains)
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json());
app.use(cookieParser());

// Create API Router
const apiRouter = express.Router();

// ---------------------------------------------------------------------------
// Comprehensive Health Check Endpoint (Diagnostics)
// ---------------------------------------------------------------------------
apiRouter.get('/health', async (req: Request, res: Response) => {
  const missing: string[] = [];
  if (!process.env.SUPER_ADMIN_PASSWORD || !process.env.SUPER_ADMIN_PASSWORD.trim()) {
    missing.push('SUPER_ADMIN_PASSWORD');
  }
  if (!process.env.SESSION_SECRET || !process.env.SESSION_SECRET.trim()) {
    missing.push('SESSION_SECRET');
  }

  // Test Firestore Read/Write/Delete
  const firestoreDiag = await testFirestoreDiagnostics();

  // Audit restaurants stats
  let countRestaurants = 0;
  let countWithPassword = 0;
  let countMissingSlug = 0;

  try {
    const venues = await serverGetDocs('venues');
    countRestaurants = venues.length;

    for (const v of venues) {
      if (!v.slug) {
        countMissingSlug++;
      }
      // Check if credentials doc or field exists
      const cred = await serverGetDoc('restaurant_credentials', v.id);
      if (cred && cred.passwordHash) {
        countWithPassword++;
      } else if (v.adminPassword) {
        countWithPassword++;
      }
    }
  } catch (err) {
    console.warn('[HealthCheck] Error calculating restaurant stats:', err);
  }

  const rawSecret = cleanSecretString(process.env.SESSION_SECRET);
  const sessionSecretLengthValid = rawSecret.length >= 32;

  const isOk = missing.length === 0 && firestoreDiag.connected;

  res.status(isOk ? 200 : 503).json({
    ok: isOk,
    status: isOk ? 'healthy' : 'degraded',
    missingVariables: missing,
    sessionSecretLengthValid,
    firestore: firestoreDiag,
    stats: {
      countRestaurants,
      countWithPassword,
      countMissingSlug,
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

// ---------------------------------------------------------------------------
// Restaurant Password Login (Brute-Force Protected, Per-Restaurant Hashed)
// ---------------------------------------------------------------------------
apiRouter.post('/admin/restaurant-login', async (req: Request, res: Response) => {
  const { restaurantId, password } = req.body || {};
  if (!restaurantId || typeof password !== 'string') {
    res.status(400).json({ error: 'يرجى إدخال معرف المطعم وكلمة المرور' });
    return;
  }

  const ip = getClientIp(req);
  const rateCheck = await checkBruteForceFirestore(ip);
  if (!rateCheck.allowed) {
    res.status(429).json({
      error: rateCheck.arabicMessage || 'تم إيقاف المحاولات مؤقتًا، يرجى المحاولة لاحقاً',
      retryAfter: rateCheck.remainingLockoutSeconds,
      remainingMinutes: rateCheck.remainingMinutes,
    });
    return;
  }

  const rawLookup = String(restaurantId).trim();
  const cleanLookup = rawLookup.toLowerCase();

  // 1. Resolve canonical venue ID (supports internal ID, primary slug, or active alias)
  let canonicalVenueId: string | null = null;

  // Direct ID check (raw case first, then lower)
  const venueById = (await serverGetDoc('venues', rawLookup)) || (await serverGetDoc('venues', cleanLookup));
  if (venueById) {
    canonicalVenueId = venueById.id;
  } else {
    // Check slug_registry
    const regDoc = await serverGetDoc('slug_registry', cleanLookup);
    if (regDoc && regDoc.isActive !== false && regDoc.venueId) {
      canonicalVenueId = regDoc.venueId;
    } else {
      // Query venues by slug
      const venuesBySlug = await serverGetDocs('venues', { field: 'slug', op: '==', value: cleanLookup });
      if (venuesBySlug.length > 0) {
        canonicalVenueId = venuesBySlug[0].id;
      }
    }
  }

  if (!canonicalVenueId) {
    await recordFailedLoginFirestore(ip);
    res.status(404).json({ error: 'المطعم غير موجود، يرجى التأكد من المعرّف أو الرابط' });
    return;
  }

  // 2. Verify password against hashed credentials
  const verifyResult = await verifyRestaurantPassword(canonicalVenueId, password);

  if (!verifyResult.success) {
    await recordFailedLoginFirestore(ip);
    res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
    return;
  }

  // 3. Login success: reset rate limit and issue scoped session cookie
  await resetFailedLoginFirestore(ip);
  setSessionCookie(res, {
    role: 'restaurant_owner',
    restaurantId: canonicalVenueId,
  });

  res.json({
    success: true,
    role: 'restaurant_owner',
    restaurantId: canonicalVenueId,
  });
});

// ---------------------------------------------------------------------------
// Magic Link Handling
// ---------------------------------------------------------------------------
apiRouter.post('/auth/consume-magic-link', async (req: Request, res: Response) => {
  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'رمز الرابط مطلوب' });
    return;
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const links = await serverGetDocs('restaurant_login_links', {
      field: 'token_hash',
      op: '==',
      value: tokenHash,
    });

    if (links.length === 0) {
      res.status(404).json({ error: 'الرابط غير صالح أو تم إلغاؤه' });
      return;
    }

    const linkData = links[0];
    if (!linkData.is_active) {
      res.status(403).json({ error: 'تم تعطيل هذا الرابط بواسطة الإدارة' });
      return;
    }

    // Update last_used_at
    await serverUpdateDoc('restaurant_login_links', linkData.id, {
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
      error: `إعداد الخادم ناقص: ناقص متغيرات (${missing.join(', ')})`,
      missingVariables: missing,
    });
    return;
  }

  const ip = getClientIp(req);
  const rateCheck = await checkBruteForceFirestore(ip);

  if (!rateCheck.allowed) {
    res.status(429).json({
      error: rateCheck.arabicMessage || 'تم إيقاف المحاولات مؤقتًا لتكرار المحاولات غير الصحيحة',
      retryAfter: rateCheck.remainingLockoutSeconds,
      remainingMinutes: rateCheck.remainingMinutes,
    });
    return;
  }

  const { password } = req.body || {};
  if (!password || !verifySuperAdminPassword(password)) {
    await recordFailedLoginFirestore(ip);
    res.status(401).json({ error: 'كلمة مرور الإدارة العامة غير صحيحة' });
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

// List all restaurants with password status & magic link status
apiRouter.get('/super-admin/restaurants', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const venues = await serverGetDocs('venues');
    const links = await serverGetDocs('restaurant_login_links');

    const linksByVenueId = new Map<string, any>();
    links.forEach((l) => {
      if (l.restaurant_id) {
        linksByVenueId.set(l.restaurant_id, l);
      }
    });

    const restaurants = await Promise.all(
      venues.map(async (venue) => {
        const link = linksByVenueId.get(venue.id);
        const cred = await serverGetDoc('restaurant_credentials', venue.id);

        return {
          id: venue.id, // Internal immutable ID
          name: venue.name || 'بدون اسم',
          slug: venue.slug || venue.id, // Current Public ID
          previousSlugs: venue.previousSlugs || [],
          currency: venue.currency || 'SAR',
          createdAt: venue.createdAt || null,
          hasLink: Boolean(link),
          isLinkActive: Boolean(link?.is_active),
          linkCreatedAt: link?.created_at || null,
          lastUsedAt: link?.last_used_at || null,
          hasCustomPassword: Boolean(cred?.isCustom || venue.adminPassword),
        };
      })
    );

    restaurants.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    res.json({ restaurants });
  } catch (err: any) {
    console.error('Error fetching restaurants:', err);
    res.status(500).json({ error: 'تعذر تحميل بيانات المطاعم' });
  }
});

// Super Admin Action: Set/Reset Restaurant Password
apiRouter.post(
  '/super-admin/restaurants/:restaurantId/password',
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    const { restaurantId } = req.params;
    const { newPassword } = req.body || {};

    if (!restaurantId || !newPassword) {
      res.status(400).json({ error: 'يرجى تقديم معرّف المطعم وكلمة المرور الجديدة' });
      return;
    }

    try {
      await updateRestaurantPassword(restaurantId, newPassword);
      res.json({ success: true, message: 'تم تحديث كلمة مرور المطعم بنجاح' });
    } catch (err: any) {
      console.error('Error updating restaurant password:', err);
      res.status(400).json({ error: err?.message || 'فشل تحديث كلمة مرور المطعم' });
    }
  }
);

// Generate / Get magic link
apiRouter.post(
  '/super-admin/restaurants/:restaurantId/link',
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    const { restaurantId } = req.params;
    if (!restaurantId) {
      res.status(400).json({ error: 'معرف المطعم مطلوب' });
      return;
    }

    try {
      const existingDoc = await serverGetDoc('restaurant_login_links', `link_${restaurantId}`);
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const now = new Date().toISOString();

      await serverSetDoc('restaurant_login_links', `link_${restaurantId}`, {
        id: `link_${restaurantId}`,
        restaurant_id: restaurantId,
        token_hash: tokenHash,
        is_active: true,
        created_at: now,
        last_used_at: existingDoc ? existingDoc.last_used_at || null : null,
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
  }
);

// Regenerate magic link
apiRouter.post(
  '/super-admin/restaurants/:restaurantId/regenerate-link',
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    const { restaurantId } = req.params;
    if (!restaurantId) {
      res.status(400).json({ error: 'معرف المطعم مطلوب' });
      return;
    }

    try {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const now = new Date().toISOString();

      await serverSetDoc('restaurant_login_links', `link_${restaurantId}`, {
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
  }
);

// Toggle active status of magic link
apiRouter.patch(
  '/super-admin/restaurants/:restaurantId/link/toggle',
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    const { restaurantId } = req.params;
    if (!restaurantId) {
      res.status(400).json({ error: 'معرف المطعم مطلوب' });
      return;
    }

    try {
      const snapshot = await serverGetDoc('restaurant_login_links', `link_${restaurantId}`);
      if (!snapshot) {
        res.status(404).json({ error: 'لا يوجد رابط مسجل لهذا المطعم' });
        return;
      }

      const currentStatus = Boolean(snapshot.is_active);
      const newStatus = !currentStatus;

      await serverUpdateDoc('restaurant_login_links', `link_${restaurantId}`, {
        is_active: newStatus,
      });

      res.json({ success: true, is_active: newStatus });
    } catch (err: any) {
      console.error('Error toggling link:', err);
      res.status(500).json({ error: 'تعذر تعديل حالة الرابط' });
    }
  }
);

// Changeable Restaurant Public ID (Slug)
apiRouter.post('/venues/:venueId/change-slug', async (req: Request, res: Response) => {
  const { venueId } = req.params;
  const { newSlug } = req.body || {};

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

// Magic link direct redirect handler
const magicLinkHandler = async (req: Request, res: Response) => {
  const { token } = req.params;
  if (!token || typeof token !== 'string') {
    res.redirect('/magic-link-error');
    return;
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const links = await serverGetDocs('restaurant_login_links', {
      field: 'token_hash',
      op: '==',
      value: tokenHash,
    });

    if (links.length === 0) {
      res.redirect('/magic-link-error');
      return;
    }

    const linkData = links[0];
    if (!linkData.is_active) {
      res.redirect('/magic-link-error');
      return;
    }

    // Update last_used_at
    await serverUpdateDoc('restaurant_login_links', linkData.id, {
      last_used_at: new Date().toISOString(),
    });

    // Issue session cookie
    setSessionCookie(res, {
      role: 'restaurant_owner',
      restaurantId: linkData.restaurant_id,
    });

    res.redirect(`/admin/${linkData.restaurant_id}`);
  } catch (err) {
    console.error('Error handling magic link redirect:', err);
    res.redirect('/magic-link-error');
  }
};

apiRouter.get('/r/:token', magicLinkHandler);
app.get('/r/:token', magicLinkHandler);

// Mount router under BOTH /api and / so it works regardless of Vercel rewrite stripping
app.use('/api', apiRouter);
app.use(apiRouter);

export default app;
