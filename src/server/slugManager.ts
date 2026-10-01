import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  runTransaction,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { serverDb } from './db';
import { Venue, VenueSlugAlias } from '../types';

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
]);

export interface SlugValidationResult {
  isValid: boolean;
  error?: string;
  cleanedSlug?: string;
}

/**
 * Validate a candidate public ID (slug)
 * Rules:
 * - 4 to 32 characters
 * - Only a-z, 0-9, and hyphen
 * - Cannot start or end with hyphen
 * - Case-insensitive (normalized to lowercase)
 * - Cannot be in reserved words list
 */
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
      error: 'معرّف المطعم يجب أن يحتوي على أحرف إنجليزية وأرقام وشرطة (-) فقط، وبدون مسافات أو رموز خاصة',
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
 * Atomically change a restaurant's public ID in a race-condition-safe Firestore transaction.
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

  // 2. Perform atomic transaction
  return await runTransaction(serverDb, async (transaction) => {
    // Check if newSlug is already claimed in slug_registry
    const registryDocRef = doc(serverDb, 'slug_registry', newSlug);
    const registrySnap = await transaction.get(registryDocRef);

    if (registrySnap.exists()) {
      const regData = registrySnap.data();
      // If it belongs to another venue and is active, reject
      if (regData.venueId !== venueId && regData.isActive !== false) {
        throw new Error('هذا المعرّف مستخدم بالفعل لمطعم آخر، يرجى اختيار معرّف مختلف');
      }
    }

    // Read the venue document
    const venueDocRef = doc(serverDb, 'venues', venueId);
    const venueSnap = await transaction.get(venueDocRef);

    if (!venueSnap.exists()) {
      throw new Error('لم يتم العثور على المطعم المحدد');
    }

    const venueData = venueSnap.data() as Venue;
    const oldSlug = (venueData.slug || venueData.id).trim().toLowerCase();

    // If newSlug is identical to current slug, nothing to change
    if (oldSlug === newSlug) {
      return {
        success: true,
        oldSlug,
        newSlug,
        previousSlugs: venueData.previousSlugs || [],
      };
    }

    // Prepare previousSlugs list for venue document
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
    const oldRegistryDocRef = doc(serverDb, 'slug_registry', oldSlug);
    transaction.set(oldRegistryDocRef, {
      slug: oldSlug,
      venueId,
      type: 'alias',
      isActive: true,
      updatedAt: now,
    });

    // 3. Update venue document
    transaction.update(venueDocRef, {
      slug: newSlug,
      previousSlugs,
      updatedAt: now,
    });

    // 4. Record audit log
    const auditDocRef = doc(
      serverDb,
      'restaurant_slug_audit_logs',
      `${venueId}_${Date.now()}`
    );
    transaction.set(auditDocRef, {
      venueId,
      venueName: venueData.name || 'بدون اسم',
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
 * Toggle an alias redirect status (active/inactive) in both venue document and slug_registry.
 */
export async function toggleAliasStatus(
  venueId: string,
  aliasSlug: string
): Promise<{ success: boolean; isActive: boolean }> {
  const cleanAlias = aliasSlug.trim().toLowerCase();

  return await runTransaction(serverDb, async (transaction) => {
    const venueDocRef = doc(serverDb, 'venues', venueId);
    const venueSnap = await transaction.get(venueDocRef);

    if (!venueSnap.exists()) {
      throw new Error('المطعم غير موجود');
    }

    const venueData = venueSnap.data() as Venue;
    const previousSlugs: VenueSlugAlias[] = Array.isArray(venueData.previousSlugs)
      ? [...venueData.previousSlugs]
      : [];

    const aliasItem = previousSlugs.find(
      (p) => p.slug.toLowerCase() === cleanAlias
    );

    if (!aliasItem) {
      throw new Error('الرابط القديم غير موجود في قائمة التحويلات لهذا المطعم');
    }

    const newStatus = !aliasItem.isActive;
    aliasItem.isActive = newStatus;

    // Update in slug_registry
    const registryDocRef = doc(serverDb, 'slug_registry', cleanAlias);
    transaction.set(
      registryDocRef,
      {
        slug: cleanAlias,
        venueId,
        type: 'alias',
        isActive: newStatus,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Update in venue document
    transaction.update(venueDocRef, {
      previousSlugs,
      updatedAt: new Date().toISOString(),
    });

    return { success: true, isActive: newStatus };
  });
}

/**
 * Get audit logs for slug changes.
 */
export async function getSlugAuditLogs(venueId?: string): Promise<SlugAuditLogEntry[]> {
  try {
    let q;
    if (venueId) {
      q = query(
        collection(serverDb, 'restaurant_slug_audit_logs'),
        where('venueId', '==', venueId)
      );
    } else {
      q = collection(serverDb, 'restaurant_slug_audit_logs');
    }

    const snapshot = await getDocs(q);
    const logs: SlugAuditLogEntry[] = [];
    snapshot.forEach((d) => {
      logs.push({ id: d.id, ...(d.data() as SlugAuditLogEntry) });
    });

    return logs.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (err) {
    console.error('Error fetching slug audit logs:', err);
    return [];
  }
}
