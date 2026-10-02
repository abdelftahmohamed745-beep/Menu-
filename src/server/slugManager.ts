import { getAdminDb } from './db';
import { VenueSlugAlias } from '../types';

export const RESERVED_PUBLIC_IDS = new Set([
  'super-admin',
  'admin',
  'r',
  'menu',
  'api',
  'login',
  'logout',
  'static',
  'assets',
  'public',
  'auth',
  'magic-link-error',
  'dashboard',
  'settings',
  'venue',
  'categories',
  'products',
  'filters',
  'qr',
  'test',
  'home',
  'default',
  'app',
  'health',
  'ping',
]);

export interface SlugValidationResult {
  isValid: boolean;
  error?: string;
  cleanedSlug?: string;
}

export function validatePublicId(rawSlug: string): SlugValidationResult {
  if (!rawSlug || typeof rawSlug !== 'string') {
    return { isValid: false, error: 'معرّف المطعم مطلوب ولا يمكن تركه فارغاً' };
  }

  const cleaned = rawSlug.trim().toLowerCase();

  if (cleaned.length < 4 || cleaned.length > 32) {
    return {
      isValid: false,
      error: 'طول معرّف المطعم يجب أن يكون بين 4 و 32 حرفاً أو رقماً',
    };
  }

  if (RESERVED_PUBLIC_IDS.has(cleaned)) {
    return {
      isValid: false,
      error: 'هذا المعرّف محجوز للنظام ولا يمكن استخدامه، يرجى اختيار معرّف آخر',
    };
  }

  // Must start and end with alphanumeric, hyphens allowed in between
  const regex = /^[a-z0-9](?:[a-z0-9-]{2,30}[a-z0-9])?$/;
  if (!regex.test(cleaned)) {
    return {
      isValid: false,
      error:
        'معرّف المطعم يجب أن يحتوي على أحرف إنجليزية وأرقام وشرطة (-) فقط، وبدون مسافات أو رموز خاصة',
    };
  }

  return { isValid: true, cleanedSlug: cleaned };
}

export interface SlugAuditLogEntry {
  id?: string;
  venueId: string;
  venueName?: string;
  oldSlug: string;
  newSlug: string;
  changedBy: 'super_admin' | 'restaurant_owner';
  timestamp: string;
}

/**
 * Atomically change a restaurant's public ID in a race-condition-safe Firestore transaction using Admin SDK.
 */
export async function changeRestaurantSlugTransaction(params: {
  venueId: string;
  newSlugRaw: string;
  changedBy: 'super_admin' | 'restaurant_owner';
}): Promise<{
  success: boolean;
  oldSlug: string;
  newSlug: string;
  previousSlugs: VenueSlugAlias[];
}> {
  const { venueId, newSlugRaw, changedBy } = params;

  // 1. Validate candidate format & reserved words
  const validation = validatePublicId(newSlugRaw);
  if (!validation.isValid || !validation.cleanedSlug) {
    throw new Error(validation.error || 'معرّف المطعم غير صالح');
  }
  const newSlug = validation.cleanedSlug;

  const db = getAdminDb();

  return await db.runTransaction(async (transaction) => {
    // Check if newSlug is already claimed in slug_registry
    const registryDocRef = db.collection('slug_registry').doc(newSlug);
    const registrySnap = await transaction.get(registryDocRef);

    if (registrySnap.exists) {
      const regData = registrySnap.data() as any;
      if (regData.venueId !== venueId && regData.isActive !== false) {
        throw new Error('هذا المعرّف مستخدم بالفعل لمطعم آخر، يرجى اختيار معرّف مختلف');
      }
    }

    // Read the venue document
    const venueDocRef = db.collection('venues').doc(venueId);
    const venueSnap = await transaction.get(venueDocRef);

    if (!venueSnap.exists) {
      throw new Error('لم يتم العثور على المطعم المحدد');
    }

    const venueData = venueSnap.data() as any;
    const oldSlug = (venueData.slug || venueId).trim().toLowerCase();

    // If newSlug is identical to current slug, nothing to change
    if (oldSlug === newSlug) {
      return {
        success: true,
        oldSlug,
        newSlug,
        previousSlugs: venueData.previousSlugs || [],
      };
    }

    const previousSlugs: VenueSlugAlias[] = Array.isArray(venueData.previousSlugs)
      ? [...venueData.previousSlugs]
      : [];

    const now = new Date().toISOString();

    // Add oldSlug as alias if not already in previousSlugs
    const existingAliasIndex = previousSlugs.findIndex(
      (p) => p.slug.toLowerCase() === oldSlug
    );
    if (existingAliasIndex >= 0) {
      previousSlugs[existingAliasIndex].isActive = true;
    } else {
      previousSlugs.unshift({
        slug: oldSlug,
        isActive: true,
        createdAt: now,
      });
    }

    // If newSlug was in previousSlugs, remove it from aliases
    const newInAliasIdx = previousSlugs.findIndex(
      (p) => p.slug.toLowerCase() === newSlug
    );
    if (newInAliasIdx >= 0) {
      previousSlugs.splice(newInAliasIdx, 1);
    }

    // 1. Set new slug in slug_registry as primary
    transaction.set(registryDocRef, {
      slug: newSlug,
      venueId,
      type: 'primary',
      isActive: true,
      updatedAt: now,
    });

    // 2. Set old slug in slug_registry as redirect alias
    const oldRegistryDocRef = db.collection('slug_registry').doc(oldSlug);
    transaction.set(oldRegistryDocRef, {
      slug: oldSlug,
      venueId,
      type: 'alias',
      isActive: true,
      updatedAt: now,
    });

    // 3. Update venue doc with new slug and updated aliases list
    transaction.update(venueDocRef, {
      slug: newSlug,
      previousSlugs,
      updatedAt: now,
    });

    // 4. Log audit entry
    const auditDocRef = db.collection('restaurant_slug_audit_logs').doc(`${venueId}_${Date.now()}`);
    transaction.set(auditDocRef, {
      venueId,
      venueName: venueData.name || 'مطعم',
      oldSlug,
      newSlug,
      changedBy,
      timestamp: now,
    });

    return {
      success: true,
      oldSlug,
      newSlug,
      previousSlugs,
    };
  });
}

/**
 * Toggle whether an old redirect alias is actively forwarding or deactivated.
 */
export async function toggleAliasStatus(
  venueId: string,
  aliasSlugRaw: string
): Promise<{ success: boolean; aliasSlug: string; isActive: boolean }> {
  const aliasSlug = aliasSlugRaw.trim().toLowerCase();
  const db = getAdminDb();

  return await db.runTransaction(async (transaction) => {
    const venueDocRef = db.collection('venues').doc(venueId);
    const venueSnap = await transaction.get(venueDocRef);

    if (!venueSnap.exists) {
      throw new Error('لم يتم العثور على المطعم');
    }

    const venueData = venueSnap.data() as any;
    const previousSlugs: VenueSlugAlias[] = Array.isArray(venueData.previousSlugs)
      ? [...venueData.previousSlugs]
      : [];

    const aliasIdx = previousSlugs.findIndex((p) => p.slug.toLowerCase() === aliasSlug);
    if (aliasIdx === -1) {
      throw new Error('الرابط القديم غير موجود في قائمة تحويلات هذا المطعم');
    }

    const newStatus = !previousSlugs[aliasIdx].isActive;
    previousSlugs[aliasIdx].isActive = newStatus;

    // Update venue doc
    transaction.update(venueDocRef, {
      previousSlugs,
      updatedAt: new Date().toISOString(),
    });

    // Update slug_registry doc
    const regDocRef = db.collection('slug_registry').doc(aliasSlug);
    transaction.set(
      regDocRef,
      {
        slug: aliasSlug,
        venueId,
        type: 'alias',
        isActive: newStatus,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return {
      success: true,
      aliasSlug,
      isActive: newStatus,
    };
  });
}

/**
 * Fetch slug change audit logs for a venue or all venues (Super Admin).
 */
export async function getSlugAuditLogs(venueId?: string): Promise<SlugAuditLogEntry[]> {
  const db = getAdminDb();
  let queryRef: any = db.collection('restaurant_slug_audit_logs');

  if (venueId) {
    queryRef = queryRef.where('venueId', '==', venueId);
  }

  queryRef = queryRef.orderBy('timestamp', 'desc').limit(100);

  const snapshot = await queryRef.get();
  return snapshot.docs.map((d: any) => ({
    id: d.id,
    ...(d.data() as any),
  }));
}
