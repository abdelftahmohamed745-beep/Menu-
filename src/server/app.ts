import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import dotenv from 'dotenv';
import {
  getAdminDb,
  isFirebaseAdminConfigured,
  getMissingAdminEnv,
  testAdminFirestoreDiagnostics,
} from './db';
import {
  cleanString,
  normalizeDigits,
} from './config';
import {
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
} from './rateLimiter';
import {
  changeRestaurantSlugTransaction,
  toggleAliasStatus,
  getSlugAuditLogs,
} from './slugManager';
import {
  hashPassword,
  verifyPassword,
  executeDummyHash,
  generateRandomPassword,
  getOrMigrateRestaurantPassword,
  setRestaurantPassword,
} from './passwordManager';
import {
  verifySuperAdminPassword,
  parseSignedToken,
  setSessionCookie,
  clearSessionCookie,
  getCookieName,
  getRestaurantSessionVersion,
  bumpRestaurantSessionVersion,
  bumpGlobalSessionVersion,
  getGlobalSessionVersion,
  mintFirebaseCustomToken,
  SessionPayload,
} from './session';

dotenv.config();

export const app = express();

// ---------------------------------------------------------------------------
// Helpers & Validation
// ---------------------------------------------------------------------------
export function getClientIp(req: Request): string {
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  const vercelIp = req.headers['x-vercel-forwarded-for'];
  if (typeof vercelIp === 'string' && vercelIp.trim()) {
    return vercelIp.split(',')[0].trim();
  }
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

const ID_REGEX = /^[A-Za-z0-9_-]{1,128}$/;
export function isValidId(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  return ID_REGEX.test(id.trim());
}

// ---------------------------------------------------------------------------
// Security & CORS Middleware
// ---------------------------------------------------------------------------
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  const origin = req.headers.origin;
  const appUrl = cleanString(process.env.APP_URL);
  const isAiStudio = Boolean(process.env.AIS_DEV || req.headers['sec-fetch-dest'] === 'iframe');

  if (isAiStudio) {
    // In AI Studio preview iframe, allow frame embedding and reflect preview origin
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } else {
    // In production, same-origin only (or explicit APP_URL match)
    if (origin && appUrl && (origin === appUrl || origin.endsWith('.vercel.app'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Cookie, X-Requested-With'
  );

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// If body was already parsed by Vercel Serverless Function helper, mark req._body = true
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    (req as any)._body = true;
  }
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// CSRF check on state-changing API routes
function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  const requestedWith = req.headers['x-requested-with'];
  const contentType = (req.headers['content-type'] || '') as string;
  const isJsonHeader = contentType.toLowerCase().includes('application/json');
  const hasContentType = typeof req.is === 'function' ? Boolean(req.is('application/json')) : isJsonHeader;
  if (requestedWith || isJsonHeader || hasContentType) {
    return next();
  }
  res.status(403).json({ error: 'طلب غير مصرح به (CSRF)', code: 'CSRF_INVALID' });
}

// ---------------------------------------------------------------------------
// Session & Role Middlewares
// ---------------------------------------------------------------------------
export async function authenticateSession(
  req: Request
): Promise<SessionPayload | null> {
  const cookieName = getCookieName(req);
  const token = req.cookies?.[cookieName] || req.cookies?.['app_session_token'];
  const session = parseSignedToken(token);
  if (!session) return null;

  // Check global session version
  const globalVer = await getGlobalSessionVersion();
  if (globalVer !== 'v1' && session.sessionVersion !== globalVer) {
    return null;
  }

  // If restaurant owner, verify restaurant session version
  if (session.role === 'restaurant_owner' && session.restaurantId) {
    const currentVer = await getRestaurantSessionVersion(session.restaurantId);
    if (session.sessionVersion && session.sessionVersion !== currentVer) {
      return null;
    }
  }

  return session;
}

export async function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const session = await authenticateSession(req);
  if (!session || session.role !== 'super_admin') {
    res.status(401).json({
      error: 'غير مصرح لك بالوصول (يتطلب صلاحية Super Admin)',
      code: 'UNAUTHORIZED_SUPER_ADMIN',
    });
    return;
  }
  (req as any).session = session;
  next();
}

export async function requireRestaurantOwner(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const session = await authenticateSession(req);
  if (!session) {
    res.status(401).json({
      error: 'يجب تسجيل الدخول أولاً',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  if (session.role === 'super_admin') {
    (req as any).session = session;
    return next();
  }

  const requestedVenueId = req.params.venueId || req.params.restaurantId;
  if (!session.restaurantId || (requestedVenueId && session.restaurantId !== requestedVenueId)) {
    res.status(403).json({
      error: 'غير مصرح لك بإدارة هذا المطعم',
      code: 'FORBIDDEN_RESTAURANT_MISMATCH',
    });
    return;
  }

  (req as any).session = session;
  next();
}

// ---------------------------------------------------------------------------
// API Router Mounted strictly under /api
// ---------------------------------------------------------------------------
const api = express.Router();
api.use(requireCsrf);

// 1. Public Health Endpoints
api.get('/health', (req: Request, res: Response) => {
  const adminOk = isFirebaseAdminConfigured();
  res.json({
    ok: true,
    databaseMode: adminOk ? 'firebase-admin' : 'missing',
    time: new Date().toISOString(),
  });
});

api.get('/super-admin/config-status', (req: Request, res: Response) => {
  const missing = getMissingAdminEnv();
  if (!cleanString(process.env.SUPER_ADMIN_PASSWORD) && !process.env.SUPER_ADMIN_PASSWORD_HASH) {
    missing.push('SUPER_ADMIN_PASSWORD');
  }
  const secret = cleanString(process.env.SESSION_SECRET);
  if (!secret || secret.length < 32) {
    missing.push('SESSION_SECRET');
  }
  res.json({
    isConfigured: missing.length === 0,
    missingVariables: missing,
  });
});

api.get('/super-admin/health', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const missing: string[] = [];
    if (!cleanString(process.env.SUPER_ADMIN_PASSWORD) && !process.env.SUPER_ADMIN_PASSWORD_HASH) {
      missing.push('SUPER_ADMIN_PASSWORD');
    }
    const secret = cleanString(process.env.SESSION_SECRET);
    if (!secret || secret.length < 32) {
      missing.push('SESSION_SECRET');
    }

    const firestoreDiag = await testAdminFirestoreDiagnostics();
    const db = getAdminDb();

    let countRestaurants = 0;
    let countWithPassword = 0;
    let countMissingSlug = 0;

    const venuesSnap = await db.collection('venues').get();
    countRestaurants = venuesSnap.size;

    for (const doc of venuesSnap.docs) {
      const v = doc.data();
      if (!v.slug) countMissingSlug++;
      const cred = await db.collection('restaurant_credentials').doc(doc.id).get();
      if (cred.exists && cred.data()?.passwordHash) {
        countWithPassword++;
      } else if (v.adminPassword) {
        countWithPassword++;
      }
    }

    res.json({
      ok: missing.length === 0 && firestoreDiag.connected,
      missingVariables: missing,
      sessionSecretLengthValid: Boolean(secret && secret.length >= 32),
      firestore: firestoreDiag,
      stats: {
        countRestaurants,
        countWithPassword,
        countMissingSlug,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error running super admin health check:', err);
    res.status(500).json({ error: 'تعذر إجراء فحص النظام', code: 'HEALTH_CHECK_FAILED' });
  }
});

// 2. Authentication & Sessions
api.get('/auth/session', async (req: Request, res: Response) => {
  try {
    const session = await authenticateSession(req);
    if (!session) {
      return res.json({ isAuthenticated: false, role: null, restaurantId: null });
    }
    // Mint fresh custom token for client SDK
    const customToken = await mintFirebaseCustomToken({
      role: session.role,
      venueId: session.restaurantId,
    }).catch(() => null);

    res.json({
      isAuthenticated: true,
      role: session.role,
      restaurantId: session.restaurantId || null,
      customToken,
    });
  } catch (err: any) {
    console.error('Session verify error:', err);
    res.json({ isAuthenticated: false, role: null, restaurantId: null });
  }
});

api.post('/auth/logout', (req: Request, res: Response) => {
  clearSessionCookie(req, res);
  res.json({ success: true });
});

// Super Admin Login
api.post('/super-admin/login', async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const scope = `super-admin:${ip}`;

  try {
    const rateCheck = await checkRateLimit(scope, 3, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: rateCheck.arabicMessage || 'تم إيقاف المحاولات مؤقتًا',
        code: 'RATE_LIMITED',
        remainingSeconds: rateCheck.remainingLockoutSeconds,
      });
    }

    const { password } = req.body || {};
    if (!password || typeof password !== 'string') {
      await recordFailedAttempt(scope, 3, 15 * 60 * 1000);
      return res.status(400).json({ error: 'يرجى إدخال كلمة المرور', code: 'BAD_DATA' });
    }

    let isMatch = false;
    try {
      isMatch = verifySuperAdminPassword(password);
    } catch (envErr: any) {
      return res.status(500).json({
        error: 'إعدادات كلمة المرور غير مكتملة في الخادم',
        code: envErr.message || 'MISSING_ENV:SUPER_ADMIN_PASSWORD',
      });
    }

    if (!isMatch) {
      await recordFailedAttempt(scope, 3, 15 * 60 * 1000);
      if (isFirebaseAdminConfigured()) {
        try {
          const db = getAdminDb();
          await db.collection('restaurant_slug_audit_logs').doc(`login_${Date.now()}`).set({
            type: 'super_admin_login',
            success: false,
            ipHash: crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16),
            timestamp: new Date().toISOString(),
          });
        } catch {}
      }
      return res.status(401).json({
        success: false,
        error: 'كلمة مرور الإدارة العامة غير صحيحة',
        code: 'BAD_PASSWORD',
      });
    }

    // Success
    await resetRateLimit(scope);
    if (isFirebaseAdminConfigured()) {
      try {
        const db = getAdminDb();
        await db.collection('restaurant_slug_audit_logs').doc(`login_${Date.now()}`).set({
          type: 'super_admin_login',
          success: true,
          ipHash: crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16),
          timestamp: new Date().toISOString(),
        });
      } catch {}
    }

    try {
      setSessionCookie(req, res, { role: 'super_admin' });
    } catch (cookieErr: any) {
      console.error('Failed to set session cookie:', cookieErr);
      return res.status(500).json({
        error: 'تعذر إنشاء جلسة الدخول (تحقق من إعدادات الجلسة في الخادم)',
        code: cookieErr?.message || 'SESSION_ERROR',
      });
    }
    const customToken = await mintFirebaseCustomToken({ role: 'super_admin' });

    res.json({
      success: true,
      role: 'super_admin',
      customToken,
    });
  } catch (err: any) {
    console.error('Super Admin login error:', err);
    if (err.message === 'FIRESTORE_UNAVAILABLE') {
      return res.status(503).json({
        error: 'تعذر الاتصال بقاعدة بيانات الخادم',
        code: 'FIRESTORE_UNAVAILABLE',
      });
    }
    res.status(500).json({
      error: 'حدث خطأ أثناء معالجة تسجيل الدخول',
      code: err.message || 'INTERNAL_ERROR',
    });
  }
});

// Restaurant Password Login
api.post('/admin/restaurant-login', async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const { restaurantId, password } = req.body || {};

  if (!isValidId(restaurantId) || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'بيانات غير صالحة', code: 'BAD_ID' });
  }

  const rawId = restaurantId.trim();
  const cleanId = rawId.toLowerCase();
  const scope = `restaurant-login:${cleanId}:${ip}`;

  try {
    const rateCheck = await checkRateLimit(scope, 5, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: rateCheck.arabicMessage || 'تم إيقاف المحاولات مؤقتًا',
        code: 'RATE_LIMITED',
        remainingSeconds: rateCheck.remainingLockoutSeconds,
      });
    }

    const db = getAdminDb();

    // 1. Resolve canonical venueId
    let canonicalVenueId: string | null = null;
    let venueSnap = await db.collection('venues').doc(rawId).get();
    if (!venueSnap.exists && cleanId !== rawId) {
      venueSnap = await db.collection('venues').doc(cleanId).get();
    }

    if (venueSnap.exists) {
      canonicalVenueId = venueSnap.id;
    } else {
      // Check slug_registry
      const regSnap = await db.collection('slug_registry').doc(cleanId).get();
      if (regSnap.exists && regSnap.data()?.isActive !== false && regSnap.data()?.venueId) {
        canonicalVenueId = regSnap.data()!.venueId;
      }
    }

    if (!canonicalVenueId) {
      executeDummyHash();
      await recordFailedAttempt(scope, 5, 15 * 60 * 1000);
      return res.status(404).json({
        error: 'المطعم غير موجود، يرجى التأكد من المعرّف',
        code: 'RESTAURANT_NOT_FOUND',
      });
    }

    // 2. Verify password
    const creds = await getOrMigrateRestaurantPassword(canonicalVenueId);
    const { isMatch, needsRehash } = verifyPassword(password, creds.passwordHash);

    if (!isMatch) {
      await recordFailedAttempt(scope, 5, 15 * 60 * 1000);
      return res.status(401).json({
        error: 'كلمة مرور المطعم غير صحيحة',
        code: 'BAD_PASSWORD',
      });
    }

    // Automatic on-the-fly rehash to upgrade iterations
    if (needsRehash) {
      const upgraded = hashPassword(password);
      await db
        .collection('restaurant_credentials')
        .doc(canonicalVenueId)
        .set({ passwordHash: upgraded, updatedAt: new Date().toISOString() }, { merge: true })
        .catch(() => {});
    }

    // Success: reset rate limiter for this restaurant+IP
    await resetRateLimit(scope);

    const sessionVer = await getRestaurantSessionVersion(canonicalVenueId);
    setSessionCookie(req, res, {
      role: 'restaurant_owner',
      restaurantId: canonicalVenueId,
      sessionVersion: sessionVer,
    });

    const customToken = await mintFirebaseCustomToken({
      role: 'restaurant_owner',
      venueId: canonicalVenueId,
    });

    res.json({
      success: true,
      role: 'restaurant_owner',
      restaurantId: canonicalVenueId,
      customToken,
      mustChangePassword: creds.mustChangePassword,
    });
  } catch (err: any) {
    console.error('Restaurant login error:', err);
    if (err.message === 'FIRESTORE_UNAVAILABLE') {
      return res.status(503).json({
        error: 'تعذر الاتصال بقاعدة بيانات الخادم',
        code: 'FIRESTORE_UNAVAILABLE',
      });
    }
    res.status(500).json({
      error: 'تعذر تسجيل الدخول للمطعم',
      code: err.message || 'INTERNAL_ERROR',
    });
  }
});

// Magic link consumption
api.post('/auth/consume-magic-link', async (req: Request, res: Response) => {
  const { token } = req.body || {};
  if (!token || typeof token !== 'string' || token.length > 256) {
    return res.status(400).json({ error: 'رمز الرابط مطلوب وصالح', code: 'BAD_DATA' });
  }

  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
  const db = getAdminDb();

  try {
    const snap = await db
      .collection('restaurant_login_links')
      .where('token_hash', '==', tokenHash)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({ error: 'الرابط غير صالح أو تم إلغاؤه', code: 'INVALID_LINK' });
    }

    const docSnap = snap.docs[0];
    const linkData = docSnap.data();

    if (!linkData.is_active) {
      return res.status(403).json({ error: 'تم تعطيل هذا الرابط بواسطة الإدارة', code: 'LINK_DISABLED' });
    }

    // Check optional expiration
    if (linkData.expires_at && new Date(linkData.expires_at).getTime() < Date.now()) {
      return res.status(403).json({ error: 'انتهت صلاحية هذا الرابط', code: 'LINK_EXPIRED' });
    }

    // Update last_used_at
    await docSnap.ref.update({
      last_used_at: new Date().toISOString(),
    });

    const restaurantId = linkData.restaurant_id;
    const sessionVer = await getRestaurantSessionVersion(restaurantId);

    setSessionCookie(req, res, {
      role: 'restaurant_owner',
      restaurantId,
      sessionVersion: sessionVer,
    });

    const customToken = await mintFirebaseCustomToken({
      role: 'restaurant_owner',
      venueId: restaurantId,
    });

    res.json({
      success: true,
      restaurantId,
      customToken,
    });
  } catch (err: any) {
    console.error('Consume magic link error:', err);
    res.status(500).json({ error: 'تعذر معالجة الرابط السحري', code: 'INTERNAL_ERROR' });
  }
});

// 3. Fast Public Customer Menu API (Direct Lookups, CDN Cached)
api.get('/public/menu/:slug', async (req: Request, res: Response) => {
  const rawSlug = req.params.slug;
  if (!isValidId(rawSlug)) {
    return res.status(400).json({ error: 'معرّف المطعم غير صالح', code: 'BAD_ID' });
  }

  const cleanSlug = rawSlug.trim().toLowerCase();
  if (!isFirebaseAdminConfigured()) {
    return res.status(503).json({ error: 'قاعدة بيانات الخادم غير مفعلة حالياً', code: 'FIRESTORE_UNAVAILABLE' });
  }
  const db = getAdminDb();

  try {
    // 1. Resolve to venue document directly (slug_registry -> venues)
    let venueDocSnap = await db.collection('venues').doc(rawSlug).get();
    if (!venueDocSnap.exists && cleanSlug !== rawSlug) {
      venueDocSnap = await db.collection('venues').doc(cleanSlug).get();
    }

    let resolvedVenueId = venueDocSnap.exists ? venueDocSnap.id : null;

    if (!resolvedVenueId) {
      const regSnap = await db.collection('slug_registry').doc(cleanSlug).get();
      if (regSnap.exists) {
        const regData = regSnap.data();
        if (regData?.isActive === false) {
          return res.status(410).json({
            error: 'تم تعطيل هذا الرابط القديم من قبل إدارة المطعم',
            code: 'ALIAS_DEACTIVATED',
          });
        }
        resolvedVenueId = regData?.venueId || null;
      }
    }

    if (!resolvedVenueId) {
      return res.status(404).json({ error: 'المطعم غير موجود', code: 'RESTAURANT_NOT_FOUND' });
    }

    if (!venueDocSnap.exists) {
      venueDocSnap = await db.collection('venues').doc(resolvedVenueId).get();
    }

    if (!venueDocSnap.exists) {
      return res.status(404).json({ error: 'المطعم غير موجود', code: 'RESTAURANT_NOT_FOUND' });
    }

    const rawVenue = venueDocSnap.data() as any;
    // Strip private fields
    const venue = {
      id: venueDocSnap.id,
      name: rawVenue.name || 'مطعم',
      slug: rawVenue.slug || venueDocSnap.id,
      description: rawVenue.description || '',
      currency: rawVenue.currency || 'SAR',
      currencySymbol: rawVenue.currencySymbol || 'ر.س',
      coverImage: rawVenue.coverImage || '',
      profileImage: rawVenue.profileImage || '',
      phone: rawVenue.phone || '',
      address: rawVenue.address || '',
      openingHours: rawVenue.openingHours || '',
      previousSlugs: rawVenue.previousSlugs || [],
    };

    // Parallel fetch subcollections
    const [catsSnap, prodsSnap, tagsSnap] = await Promise.all([
      db.collection('categories').where('venueId', '==', resolvedVenueId).get(),
      db
        .collection('products')
        .where('venueId', '==', resolvedVenueId)
        .where('isVisible', '==', true)
        .get(),
      db.collection('filterTags').where('venueId', '==', resolvedVenueId).get(),
    ]);

    const categories = catsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0));

    const products = prodsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0));

    const filterTags = tagsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0));

    // Fast CDN edge caching with stale-while-revalidate
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
    res.json({
      venue,
      categories,
      products,
      filterTags,
    });
  } catch (err: any) {
    console.error('Error fetching public menu:', err);
    res.status(500).json({ error: 'تعذر تحميل قائمة الطعام', code: 'INTERNAL_ERROR' });
  }
});

// 4. Server-Owned Operations (Protected)
api.post('/venues/:venueId/change-slug', requireRestaurantOwner, async (req: Request, res: Response) => {
  const { venueId } = req.params;
  const { newSlug } = req.body || {};
  const session = (req as any).session as SessionPayload;

  if (!isValidId(venueId)) {
    return res.status(400).json({ error: 'معرّف المطعم غير صالح', code: 'BAD_ID' });
  }

  try {
    const result = await changeRestaurantSlugTransaction({
      venueId,
      newSlugRaw: newSlug,
      changedBy: session.role === 'super_admin' ? 'super_admin' : 'restaurant_owner',
    });
    res.json(result);
  } catch (err: any) {
    console.error('Change slug error:', err);
    res.status(400).json({ error: err.message || 'فشل تغيير المعرّف', code: 'SLUG_CHANGE_FAILED' });
  }
});

api.patch(
  '/venues/:venueId/aliases/:aliasSlug/toggle',
  requireRestaurantOwner,
  async (req: Request, res: Response) => {
    const { venueId, aliasSlug } = req.params;
    if (!isValidId(venueId) || !isValidId(aliasSlug)) {
      return res.status(400).json({ error: 'معرّف غير صالح', code: 'BAD_ID' });
    }

    try {
      const result = await toggleAliasStatus(venueId, aliasSlug);
      res.json(result);
    } catch (err: any) {
      console.error('Toggle alias error:', err);
      res.status(400).json({ error: err.message || 'تعذر تعديل التحويل', code: 'ALIAS_TOGGLE_FAILED' });
    }
  }
);

// 5. Super Admin Protected Routes
api.get('/super-admin/restaurants', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const db = getAdminDb();
    const [venuesSnap, linksSnap] = await Promise.all([
      db.collection('venues').get(),
      db.collection('restaurant_login_links').get(),
    ]);

    const linksMap = new Map<string, any>();
    linksSnap.forEach((d) => {
      const l = d.data();
      if (l.restaurant_id) linksMap.set(l.restaurant_id, l);
    });

    const restaurants = await Promise.all(
      venuesSnap.docs.map(async (doc) => {
        const v = doc.data();
        const link = linksMap.get(doc.id);
        const credSnap = await db.collection('restaurant_credentials').doc(doc.id).get();
        const cred = credSnap.data();

        return {
          id: doc.id,
          name: v.name || 'بدون اسم',
          slug: v.slug || doc.id,
          previousSlugs: v.previousSlugs || [],
          currency: v.currency || 'SAR',
          createdAt: v.createdAt || null,
          hasLink: Boolean(link),
          isLinkActive: Boolean(link?.is_active),
          linkCreatedAt: link?.created_at || null,
          lastUsedAt: link?.last_used_at || null,
          mustChangePassword: Boolean(cred?.mustChangePassword),
          hasCustomPassword: Boolean(cred?.isCustom),
        };
      })
    );

    restaurants.sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    res.json({ restaurants });
  } catch (err: any) {
    console.error('Super Admin fetch restaurants error:', err);
    res.status(500).json({ error: 'تعذر تحميل بيانات المطاعم', code: 'INTERNAL_ERROR' });
  }
});

// Create new restaurant from server API (Super Admin)
api.post('/super-admin/restaurants', requireSuperAdmin, async (req: Request, res: Response) => {
  const { name, currency } = req.body || {};
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'اسم المطعم مطلوب', code: 'BAD_DATA' });
  }

  const db = getAdminDb();
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let randomSlug = 'r-';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    randomSlug += chars[bytes[i] % chars.length];
  }

  try {
    const venueRef = db.collection('venues').doc();
    const venueId = venueRef.id;
    const now = new Date().toISOString();

    await venueRef.set({
      id: venueId,
      name: name.trim(),
      slug: randomSlug,
      currency: currency || 'SAR',
      currencySymbol: 'ر.س',
      description: 'مرحباً بكم في قائمتنا الرقمية',
      createdAt: now,
      updatedAt: now,
    });

    // Register slug
    await db.collection('slug_registry').doc(randomSlug).set({
      slug: randomSlug,
      venueId,
      type: 'primary',
      isActive: true,
      updatedAt: now,
    });

    // Generate random one-time password
    const generatedPassword = generateRandomPassword();
    await setRestaurantPassword(venueId, generatedPassword);

    res.json({
      success: true,
      venue: { id: venueId, name: name.trim(), slug: randomSlug },
      generatedPassword,
    });
  } catch (err: any) {
    console.error('Create restaurant error:', err);
    res.status(500).json({ error: 'تعذر إنشاء المطعم', code: 'INTERNAL_ERROR' });
  }
});

// Change restaurant password
api.post(
  '/super-admin/restaurants/:restaurantId/password',
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    const { restaurantId } = req.params;
    const { newPassword } = req.body || {};

    if (!isValidId(restaurantId) || !newPassword) {
      return res.status(400).json({ error: 'بيانات غير صالحة', code: 'BAD_DATA' });
    }

    try {
      await setRestaurantPassword(restaurantId, newPassword);
      res.json({ success: true, message: 'تم تحديث كلمة المرور بنجاح' });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'فشل تحديث كلمة المرور', code: 'PASSWORD_UPDATE_FAILED' });
    }
  }
);

// Revoke sessions for a restaurant
api.post(
  '/super-admin/restaurants/:restaurantId/revoke-sessions',
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    const { restaurantId } = req.params;
    if (!isValidId(restaurantId)) {
      return res.status(400).json({ error: 'معرّف غير صالح', code: 'BAD_ID' });
    }

    try {
      await bumpRestaurantSessionVersion(restaurantId);
      res.json({ success: true, message: 'تم إنهاء جميع الجلسات لهذا المطعم بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر إنهاء الجلسات', code: 'INTERNAL_ERROR' });
    }
  }
);

// Revoke all sessions globally
api.post(
  '/super-admin/revoke-all-sessions',
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      await bumpGlobalSessionVersion();
      res.json({ success: true, message: 'تم إنهاء جميع الجلسات في المنصة بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر إنهاء الجلسات العامة', code: 'INTERNAL_ERROR' });
    }
  }
);

// Delete restaurant completely (chunks of 400)
api.delete(
  '/super-admin/restaurants/:restaurantId',
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    const { restaurantId } = req.params;
    if (!isValidId(restaurantId)) {
      return res.status(400).json({ error: 'معرّف غير صالح', code: 'BAD_ID' });
    }

    const db = getAdminDb();
    try {
      const collectionsToDelete = ['categories', 'products', 'filterTags'];
      for (const colName of collectionsToDelete) {
        const snap = await db.collection(colName).where('venueId', '==', restaurantId).get();
        const batch = db.batch();
        snap.docs.slice(0, 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      await db.collection('venues').doc(restaurantId).delete();
      await db.collection('restaurant_credentials').doc(restaurantId).delete().catch(() => {});
      await db.collection('restaurant_login_links').doc(`link_${restaurantId}`).delete().catch(() => {});

      res.json({ success: true, message: 'تم حذف المطعم وبياناته بالكامل' });
    } catch (err: any) {
      console.error('Delete restaurant error:', err);
      res.status(500).json({ error: 'تعذر حذف المطعم', code: 'INTERNAL_ERROR' });
    }
  }
);

// Magic link generation/regeneration
api.post(
  '/super-admin/restaurants/:restaurantId/link',
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    const { restaurantId } = req.params;
    if (!isValidId(restaurantId)) {
      return res.status(400).json({ error: 'معرّف غير صالح', code: 'BAD_ID' });
    }

    try {
      const db = getAdminDb();
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const now = new Date().toISOString();

      await db
        .collection('restaurant_login_links')
        .doc(`link_${restaurantId}`)
        .set({
          id: `link_${restaurantId}`,
          restaurant_id: restaurantId,
          token_hash: tokenHash,
          is_active: true,
          created_at: now,
          last_used_at: null,
        });

      const appUrl = cleanString(process.env.APP_URL) || `${req.protocol}://${req.get('host')}`;
      const fullUrl = `${appUrl}/r/${rawToken}`;

      res.json({
        success: true,
        token: rawToken,
        fullUrl,
        is_active: true,
      });
    } catch (err: any) {
      console.error('Generate magic link error:', err);
      res.status(500).json({ error: 'تعذر توليد الرابط', code: 'INTERNAL_ERROR' });
    }
  }
);

api.patch(
  '/super-admin/restaurants/:restaurantId/link/toggle',
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    const { restaurantId } = req.params;
    if (!isValidId(restaurantId)) {
      return res.status(400).json({ error: 'معرّف غير صالح', code: 'BAD_ID' });
    }

    try {
      const db = getAdminDb();
      const ref = db.collection('restaurant_login_links').doc(`link_${restaurantId}`);
      const snap = await ref.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'الرابط غير موجود', code: 'NOT_FOUND' });
      }

      const newStatus = !Boolean(snap.data()?.is_active);
      await ref.update({ is_active: newStatus });
      // Invalidate sessions on disable
      if (!newStatus) {
        await bumpRestaurantSessionVersion(restaurantId);
      }

      res.json({ success: true, is_active: newStatus });
    } catch (err: any) {
      res.status(500).json({ error: 'تعذر تغيير حالة الرابط', code: 'INTERNAL_ERROR' });
    }
  }
);

// Audit logs
api.get('/super-admin/slug-audit-logs', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const venueId = typeof req.query.venueId === 'string' ? req.query.venueId : undefined;
    const logs = await getSlugAuditLogs(venueId);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: 'تعذر جلب سجل التغييرات', code: 'INTERNAL_ERROR' });
  }
});

// Idempotent migration to remove legacy access codes and admin passwords
api.post(
  '/migrations/remove-access-codes',
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const db = getAdminDb();
      const venuesSnap = await db.collection('venues').get();
      let cleanedCount = 0;
      let registeredSlugs = 0;

      const batch = db.batch();
      let batchCount = 0;

      for (const doc of venuesSnap.docs) {
        const data = doc.data();
        const updates: any = {};
        if ('accessCode' in data) updates.accessCode = null;
        if ('access_code' in data) updates.access_code = null;
        if ('adminCode' in data) updates.adminCode = null;
        if ('code' in data && typeof data.code === 'string' && data.code.length <= 12) {
          updates.code = null;
        }
        if ('adminPassword' in data) updates.adminPassword = null;

        // Register slug in slug_registry
        const slugVal = (data.slug || doc.id).toLowerCase();
        const regRef = db.collection('slug_registry').doc(slugVal);
        batch.set(
          regRef,
          {
            slug: slugVal,
            venueId: doc.id,
            type: 'primary',
            isActive: true,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        registeredSlugs++;
        batchCount++;

        if (Object.keys(updates).length > 0) {
          batch.update(doc.ref, updates);
          cleanedCount++;
          batchCount++;
        }

        if (batchCount >= 380) {
          await batch.commit();
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      res.json({
        success: true,
        scannedVenues: venuesSnap.size,
        cleanedVenues: cleanedCount,
        registeredSlugs,
        message: `اكتمل التطهير بنجاح: تم فحص ${venuesSnap.size} مطعم وتطهير ${cleanedCount} وتسجيل ${registeredSlugs} معرّف.`,
      });
    } catch (err: any) {
      console.error('Migration error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء تنفيذ التطهير', code: 'MIGRATION_FAILED' });
    }
  }
);

// Mount router under /api and also at root / so all rewrite variations match seamlessly
app.use('/api', api);
app.use('/', api);

export {
  isFirebaseAdminConfigured,
  getMissingAdminEnv,
  testAdminFirestoreDiagnostics,
} from './db';

export default app;
