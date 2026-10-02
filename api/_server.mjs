// src/server/app.ts
import express from "express";
import cookieParser from "cookie-parser";
import crypto5 from "crypto";
import dotenv from "dotenv";

// src/server/db.ts
import crypto from "crypto";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// src/server/config.ts
var FIRESTORE_DATABASE_ID = process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID || "ai-studio-6515c201-ec9e-4f37-b01d-e3683d1a8c6e";
var FIREBASE_PROJECT_ID_DEFAULT = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "keen-flame-j53bd";
var FIREBASE_STORAGE_BUCKET_DEFAULT = process.env.FIREBASE_STORAGE_BUCKET || "keen-flame-j53bd.firebasestorage.app";
function cleanString(val) {
  if (!val || typeof val !== "string") return "";
  let str = val.trim();
  if (str.startsWith('"') && str.endsWith('"') || str.startsWith("'") && str.endsWith("'")) {
    str = str.slice(1, -1).trim();
  }
  return str;
}
function cleanPrivateKey(raw) {
  if (!raw || typeof raw !== "string") return "";
  let key = raw.trim();
  if (key.startsWith('"') && key.endsWith('"') || key.startsWith("'") && key.endsWith("'")) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\n/g, "\n");
  return key.trim();
}
function normalizeDigits(str) {
  const arabicDigits = ["\u0660", "\u0661", "\u0662", "\u0663", "\u0664", "\u0665", "\u0666", "\u0667", "\u0668", "\u0669"];
  return str.replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)));
}

// src/server/db.ts
var cachedApp = null;
var cachedDb = null;
var cachedAuth = null;
function getMissingAdminEnv() {
  const missing = [];
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    if (!cleanString(process.env.FIREBASE_CLIENT_EMAIL)) {
      missing.push("FIREBASE_CLIENT_EMAIL");
    }
    if (!cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY)) {
      missing.push("FIREBASE_PRIVATE_KEY");
    }
  }
  return missing;
}
function isFirebaseAdminConfigured() {
  if (getMissingAdminEnv().length > 0) return false;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    try {
      JSON.parse(serviceAccountJson);
      return true;
    } catch {
      return false;
    }
  }
  const privateKey = cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  if (!privateKey) return false;
  try {
    crypto.createPrivateKey(privateKey);
    return true;
  } catch {
    return false;
  }
}
function getAdminApp() {
  if (cachedApp) return cachedApp;
  const existingApps = getApps();
  if (existingApps.length > 0) {
    cachedApp = existingApps[0];
    return cachedApp;
  }
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  let certObj;
  if (serviceAccountJson) {
    try {
      certObj = JSON.parse(serviceAccountJson);
    } catch (err) {
      throw new Error(`BAD_SERVICE_ACCOUNT_JSON: ${err.message}`);
    }
  } else {
    const clientEmail = cleanString(process.env.FIREBASE_CLIENT_EMAIL);
    const privateKey = cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY);
    const projectId = cleanString(process.env.FIREBASE_PROJECT_ID) || FIREBASE_PROJECT_ID_DEFAULT;
    if (!clientEmail || !privateKey) {
      throw new Error(
        `MISSING_ENV:${!clientEmail ? "FIREBASE_CLIENT_EMAIL" : "FIREBASE_PRIVATE_KEY"}`
      );
    }
    certObj = {
      projectId,
      clientEmail,
      privateKey
    };
  }
  cachedApp = initializeApp({
    credential: cert(certObj),
    projectId: certObj.projectId
  });
  return cachedApp;
}
function getAdminDb() {
  if (cachedDb) return cachedDb;
  const app2 = getAdminApp();
  try {
    cachedDb = getFirestore(app2, FIRESTORE_DATABASE_ID);
  } catch (err) {
    cachedDb = getFirestore(app2);
  }
  return cachedDb;
}
function getAdminAuth() {
  if (cachedAuth) return cachedAuth;
  const app2 = getAdminApp();
  cachedAuth = getAuth(app2);
  return cachedAuth;
}
var lastWriteTestResult = null;
async function testAdminFirestoreDiagnostics() {
  if (!isFirebaseAdminConfigured()) {
    const missing = getMissingAdminEnv();
    return {
      connected: false,
      read: false,
      write: false,
      delete: false,
      mode: "missing",
      error: `\u0627\u0644\u0645\u062A\u063A\u064A\u0631\u0627\u062A \u0627\u0644\u062A\u0627\u0644\u064A\u0629 \u0646\u0627\u0642\u0635\u0629 \u0644\u062A\u0634\u063A\u064A\u0644 Firebase Admin SDK: ${missing.join(", ")}`
    };
  }
  let db;
  try {
    db = getAdminDb();
  } catch (err) {
    return {
      connected: false,
      read: false,
      write: false,
      delete: false,
      mode: "missing",
      error: err.message || "\u0641\u0634\u0644 \u062A\u0647\u064A\u0626\u0629 Firebase Admin SDK"
    };
  }
  let readOk = false;
  let writeOk = false;
  let deleteOk = false;
  let failureError = null;
  try {
    await db.collection("venues").limit(1).get();
    readOk = true;
    const now = Date.now();
    if (lastWriteTestResult && now - lastWriteTestResult.time < 6e4) {
      writeOk = lastWriteTestResult.success;
      deleteOk = lastWriteTestResult.success;
      if (lastWriteTestResult.error) failureError = lastWriteTestResult.error;
    } else {
      const testId = `diag_${now}_${Math.random().toString(36).substring(2, 6)}`;
      const testRef = db.collection("system_health").doc(testId);
      await testRef.set({ test: true, time: (/* @__PURE__ */ new Date()).toISOString() });
      writeOk = true;
      await testRef.delete();
      deleteOk = true;
      lastWriteTestResult = { success: true, time: now };
    }
  } catch (err) {
    failureError = err?.message || String(err);
    lastWriteTestResult = { success: false, time: Date.now(), error: failureError };
  }
  return {
    connected: readOk,
    read: readOk,
    write: writeOk,
    delete: deleteOk,
    mode: "firebase-admin",
    error: failureError
  };
}

// src/server/rateLimiter.ts
import crypto2 from "crypto";
function hashString(str) {
  return crypto2.createHash("sha256").update(str.trim()).digest("hex");
}
var memoryLimits = /* @__PURE__ */ new Map();
function checkMemoryLimit(scopeHash, maxAttempts, lockoutDurationMs) {
  const now = Date.now();
  const entry = memoryLimits.get(scopeHash);
  if (!entry) return { allowed: true };
  if (entry.lockedUntil > now) {
    const remainingSeconds = Math.max(1, Math.ceil((entry.lockedUntil - now) / 1e3));
    const remainingMinutes = Math.max(1, Math.ceil(remainingSeconds / 60));
    return {
      allowed: false,
      remainingLockoutSeconds: remainingSeconds,
      remainingMinutes,
      arabicMessage: `\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0645\u0624\u0642\u062A\u064B\u0627 \u0644\u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u063A\u064A\u0631 \u0627\u0644\u0635\u062D\u064A\u062D\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 ${remainingMinutes} \u062F\u0642\u064A\u0642\u0629 \u0642\u0628\u0644 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.`
    };
  }
  if (now - entry.firstAttemptAt > 60 * 1e3) {
    memoryLimits.delete(scopeHash);
    return { allowed: true };
  }
  if (entry.attempts >= maxAttempts) {
    entry.lockedUntil = now + lockoutDurationMs;
    const remainingMinutes = Math.ceil(lockoutDurationMs / 6e4);
    return {
      allowed: false,
      remainingLockoutSeconds: Math.ceil(lockoutDurationMs / 1e3),
      remainingMinutes,
      arabicMessage: `\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0645\u0624\u0642\u062A\u064B\u0627 \u0644\u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u063A\u064A\u0631 \u0627\u0644\u0635\u062D\u064A\u062D\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 ${remainingMinutes} \u062F\u0642\u064A\u0642\u0629 \u0642\u0628\u0644 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.`
    };
  }
  return { allowed: true };
}
function recordMemoryAttempt(scopeHash, maxAttempts, lockoutDurationMs) {
  const now = Date.now();
  const entry = memoryLimits.get(scopeHash);
  if (!entry || now - entry.firstAttemptAt > 60 * 1e3) {
    memoryLimits.set(scopeHash, {
      attempts: 1,
      firstAttemptAt: now,
      lockedUntil: 0
    });
    return;
  }
  entry.attempts += 1;
  if (entry.attempts >= maxAttempts) {
    entry.lockedUntil = now + lockoutDurationMs;
  }
}
async function checkRateLimit(scope, maxAttempts = 5, lockoutDurationMs = 15 * 60 * 1e3) {
  const scopeHash = hashString(scope);
  if (!isFirebaseAdminConfigured()) {
    return checkMemoryLimit(scopeHash, maxAttempts, lockoutDurationMs);
  }
  try {
    const db = getAdminDb();
    const docRef = db.collection("rate_limits").doc(scopeHash);
    const now = Date.now();
    const snap = await docRef.get();
    if (!snap.exists) {
      return { allowed: true };
    }
    const data = snap.data() || {};
    const lockedUntil = Number(data.lockedUntil || 0);
    if (lockedUntil > now) {
      const remainingSeconds = Math.max(1, Math.ceil((lockedUntil - now) / 1e3));
      const remainingMinutes = Math.max(1, Math.ceil(remainingSeconds / 60));
      return {
        allowed: false,
        remainingLockoutSeconds: remainingSeconds,
        remainingMinutes,
        arabicMessage: `\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0645\u0624\u0642\u062A\u064B\u0627 \u0644\u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u063A\u064A\u0631 \u0627\u0644\u0635\u062D\u064A\u062D\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 ${remainingMinutes} \u062F\u0642\u064A\u0642\u0629 \u0642\u0628\u0644 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.`
      };
    }
    const firstAttemptAt = Number(data.firstAttemptAt || 0);
    if (now - firstAttemptAt > 60 * 1e3) {
      await docRef.delete().catch(() => {
      });
      return { allowed: true };
    }
    const attempts = Number(data.attempts || 0);
    if (attempts >= maxAttempts) {
      const newLockedUntil = now + lockoutDurationMs;
      await docRef.set(
        {
          lockedUntil: newLockedUntil,
          updatedAt: now,
          expiresAt: new Date(newLockedUntil + 24 * 60 * 60 * 1e3)
        },
        { merge: true }
      );
      const remainingMinutes = Math.ceil(lockoutDurationMs / 6e4);
      return {
        allowed: false,
        remainingLockoutSeconds: Math.ceil(lockoutDurationMs / 1e3),
        remainingMinutes,
        arabicMessage: `\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0645\u0624\u0642\u062A\u064B\u0627 \u0644\u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u063A\u064A\u0631 \u0627\u0644\u0635\u062D\u064A\u062D\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 ${remainingMinutes} \u062F\u0642\u064A\u0642\u0629 \u0642\u0628\u0644 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.`
      };
    }
    return { allowed: true };
  } catch (err) {
    console.warn("[RateLimiter] Firestore read failed, falling back to memory:", err?.message);
    return checkMemoryLimit(scopeHash, maxAttempts, lockoutDurationMs);
  }
}
async function recordFailedAttempt(scope, maxAttempts = 5, lockoutDurationMs = 15 * 60 * 1e3) {
  const scopeHash = hashString(scope);
  if (!isFirebaseAdminConfigured()) {
    recordMemoryAttempt(scopeHash, maxAttempts, lockoutDurationMs);
    return;
  }
  try {
    const db = getAdminDb();
    const docRef = db.collection("rate_limits").doc(scopeHash);
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
          expiresAt: new Date(now + 24 * 60 * 60 * 1e3)
        });
        return;
      }
      const data = snap.data() || {};
      const firstAttemptAt = Number(data.firstAttemptAt || 0);
      if (now - firstAttemptAt > 60 * 1e3) {
        transaction.set(docRef, {
          scope,
          attempts: 1,
          firstAttemptAt: now,
          lockedUntil: 0,
          updatedAt: now,
          expiresAt: new Date(now + 24 * 60 * 60 * 1e3)
        });
      } else {
        const newAttempts = Number(data.attempts || 0) + 1;
        const lockedUntil = newAttempts >= maxAttempts ? now + lockoutDurationMs : 0;
        transaction.update(docRef, {
          attempts: newAttempts,
          lockedUntil,
          updatedAt: now,
          expiresAt: new Date(now + (lockedUntil > 0 ? lockoutDurationMs : 6e4) + 24 * 60 * 60 * 1e3)
        });
      }
    });
  } catch (err) {
    console.warn("[RateLimiter] Firestore transaction failed, falling back to memory:", err?.message);
    recordMemoryAttempt(scopeHash, maxAttempts, lockoutDurationMs);
  }
}
async function resetRateLimit(scope) {
  const scopeHash = hashString(scope);
  memoryLimits.delete(scopeHash);
  if (!isFirebaseAdminConfigured()) return;
  try {
    const db = getAdminDb();
    await db.collection("rate_limits").doc(scopeHash).delete();
  } catch (err) {
    console.warn("[RateLimiter] Error resetting rate limit in Firestore:", err);
  }
}

// src/server/slugManager.ts
var RESERVED_PUBLIC_IDS = /* @__PURE__ */ new Set([
  "super-admin",
  "admin",
  "r",
  "menu",
  "api",
  "login",
  "logout",
  "static",
  "assets",
  "public",
  "auth",
  "magic-link-error",
  "dashboard",
  "settings",
  "venue",
  "categories",
  "products",
  "filters",
  "qr",
  "test",
  "home",
  "default",
  "app",
  "health",
  "ping"
]);
function validatePublicId(rawSlug) {
  if (!rawSlug || typeof rawSlug !== "string") {
    return { isValid: false, error: "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u0637\u0639\u0645 \u0645\u0637\u0644\u0648\u0628 \u0648\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0631\u0643\u0647 \u0641\u0627\u0631\u063A\u0627\u064B" };
  }
  const cleaned = rawSlug.trim().toLowerCase();
  if (cleaned.length < 4 || cleaned.length > 32) {
    return {
      isValid: false,
      error: "\u0637\u0648\u0644 \u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u0637\u0639\u0645 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0628\u064A\u0646 4 \u0648 32 \u062D\u0631\u0641\u0627\u064B \u0623\u0648 \u0631\u0642\u0645\u0627\u064B"
    };
  }
  if (RESERVED_PUBLIC_IDS.has(cleaned)) {
    return {
      isValid: false,
      error: "\u0647\u0630\u0627 \u0627\u0644\u0645\u0639\u0631\u0651\u0641 \u0645\u062D\u062C\u0648\u0632 \u0644\u0644\u0646\u0638\u0627\u0645 \u0648\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0633\u062A\u062E\u062F\u0627\u0645\u0647\u060C \u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0645\u0639\u0631\u0651\u0641 \u0622\u062E\u0631"
    };
  }
  const regex = /^[a-z0-9](?:[a-z0-9-]{2,30}[a-z0-9])?$/;
  if (!regex.test(cleaned)) {
    return {
      isValid: false,
      error: "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u0637\u0639\u0645 \u064A\u062C\u0628 \u0623\u0646 \u064A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u0623\u062D\u0631\u0641 \u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 \u0648\u0623\u0631\u0642\u0627\u0645 \u0648\u0634\u0631\u0637\u0629 (-) \u0641\u0642\u0637\u060C \u0648\u0628\u062F\u0648\u0646 \u0645\u0633\u0627\u0641\u0627\u062A \u0623\u0648 \u0631\u0645\u0648\u0632 \u062E\u0627\u0635\u0629"
    };
  }
  return { isValid: true, cleanedSlug: cleaned };
}
async function changeRestaurantSlugTransaction(params) {
  const { venueId, newSlugRaw, changedBy } = params;
  const validation = validatePublicId(newSlugRaw);
  if (!validation.isValid || !validation.cleanedSlug) {
    throw new Error(validation.error || "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u0637\u0639\u0645 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D");
  }
  const newSlug = validation.cleanedSlug;
  const db = getAdminDb();
  return await db.runTransaction(async (transaction) => {
    const registryDocRef = db.collection("slug_registry").doc(newSlug);
    const registrySnap = await transaction.get(registryDocRef);
    if (registrySnap.exists) {
      const regData = registrySnap.data();
      if (regData.venueId !== venueId && regData.isActive !== false) {
        throw new Error("\u0647\u0630\u0627 \u0627\u0644\u0645\u0639\u0631\u0651\u0641 \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644 \u0644\u0645\u0637\u0639\u0645 \u0622\u062E\u0631\u060C \u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0645\u0639\u0631\u0651\u0641 \u0645\u062E\u062A\u0644\u0641");
      }
    }
    const venueDocRef = db.collection("venues").doc(venueId);
    const venueSnap = await transaction.get(venueDocRef);
    if (!venueSnap.exists) {
      throw new Error("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0645\u0637\u0639\u0645 \u0627\u0644\u0645\u062D\u062F\u062F");
    }
    const venueData = venueSnap.data();
    const oldSlug = (venueData.slug || venueId).trim().toLowerCase();
    if (oldSlug === newSlug) {
      return {
        success: true,
        oldSlug,
        newSlug,
        previousSlugs: venueData.previousSlugs || []
      };
    }
    const previousSlugs = Array.isArray(venueData.previousSlugs) ? [...venueData.previousSlugs] : [];
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existingAliasIndex = previousSlugs.findIndex(
      (p) => p.slug.toLowerCase() === oldSlug
    );
    if (existingAliasIndex >= 0) {
      previousSlugs[existingAliasIndex].isActive = true;
    } else {
      previousSlugs.unshift({
        slug: oldSlug,
        isActive: true,
        createdAt: now
      });
    }
    const newInAliasIdx = previousSlugs.findIndex(
      (p) => p.slug.toLowerCase() === newSlug
    );
    if (newInAliasIdx >= 0) {
      previousSlugs.splice(newInAliasIdx, 1);
    }
    transaction.set(registryDocRef, {
      slug: newSlug,
      venueId,
      type: "primary",
      isActive: true,
      updatedAt: now
    });
    const oldRegistryDocRef = db.collection("slug_registry").doc(oldSlug);
    transaction.set(oldRegistryDocRef, {
      slug: oldSlug,
      venueId,
      type: "alias",
      isActive: true,
      updatedAt: now
    });
    transaction.update(venueDocRef, {
      slug: newSlug,
      previousSlugs,
      updatedAt: now
    });
    const auditDocRef = db.collection("restaurant_slug_audit_logs").doc(`${venueId}_${Date.now()}`);
    transaction.set(auditDocRef, {
      venueId,
      venueName: venueData.name || "\u0645\u0637\u0639\u0645",
      oldSlug,
      newSlug,
      changedBy,
      timestamp: now
    });
    return {
      success: true,
      oldSlug,
      newSlug,
      previousSlugs
    };
  });
}
async function toggleAliasStatus(venueId, aliasSlugRaw) {
  const aliasSlug = aliasSlugRaw.trim().toLowerCase();
  const db = getAdminDb();
  return await db.runTransaction(async (transaction) => {
    const venueDocRef = db.collection("venues").doc(venueId);
    const venueSnap = await transaction.get(venueDocRef);
    if (!venueSnap.exists) {
      throw new Error("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0645\u0637\u0639\u0645");
    }
    const venueData = venueSnap.data();
    const previousSlugs = Array.isArray(venueData.previousSlugs) ? [...venueData.previousSlugs] : [];
    const aliasIdx = previousSlugs.findIndex((p) => p.slug.toLowerCase() === aliasSlug);
    if (aliasIdx === -1) {
      throw new Error("\u0627\u0644\u0631\u0627\u0628\u0637 \u0627\u0644\u0642\u062F\u064A\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0642\u0627\u0626\u0645\u0629 \u062A\u062D\u0648\u064A\u0644\u0627\u062A \u0647\u0630\u0627 \u0627\u0644\u0645\u0637\u0639\u0645");
    }
    const newStatus = !previousSlugs[aliasIdx].isActive;
    previousSlugs[aliasIdx].isActive = newStatus;
    transaction.update(venueDocRef, {
      previousSlugs,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    const regDocRef = db.collection("slug_registry").doc(aliasSlug);
    transaction.set(
      regDocRef,
      {
        slug: aliasSlug,
        venueId,
        type: "alias",
        isActive: newStatus,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      { merge: true }
    );
    return {
      success: true,
      aliasSlug,
      isActive: newStatus
    };
  });
}
async function getSlugAuditLogs(venueId) {
  const db = getAdminDb();
  let queryRef = db.collection("restaurant_slug_audit_logs");
  if (venueId) {
    queryRef = queryRef.where("venueId", "==", venueId);
  }
  queryRef = queryRef.orderBy("timestamp", "desc").limit(100);
  const snapshot = await queryRef.get();
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data()
  }));
}

// src/server/passwordManager.ts
import crypto3 from "crypto";
var PBKDF2_ITERATIONS = 21e4;
var PBKDF2_KEYLEN = 64;
var PBKDF2_DIGEST = "sha512";
var LEGACY_DEFAULT_PASSWORD = "2002500";
var DISALLOWED_PASSWORDS = /* @__PURE__ */ new Set([
  "2002500",
  "123456",
  "12345678",
  "password",
  "000000",
  "111111",
  "admin123"
]);
function hashPassword(plainPassword) {
  const normalized = normalizeDigits(cleanString(plainPassword));
  const salt = crypto3.randomBytes(16).toString("hex");
  const hash = crypto3.pbkdf2Sync(normalized, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString("hex");
  return `pbkdf2:${PBKDF2_ITERATIONS}:${salt}:${hash}`;
}
function executeDummyHash() {
  const dummySalt = "0123456789abcdef0123456789abcdef";
  crypto3.pbkdf2Sync("dummy_password_timing_check", dummySalt, 1e4, 32, "sha256");
}
function verifyPassword(plainInput, storedHashOrPlain) {
  if (!plainInput || !storedHashOrPlain) return { isMatch: false, needsRehash: false };
  const normalized = normalizeDigits(cleanString(plainInput));
  if (storedHashOrPlain.startsWith("pbkdf2:")) {
    const parts = storedHashOrPlain.split(":");
    if (parts.length === 4) {
      const iters = parseInt(parts[1], 10);
      const salt = parts[2];
      const expectedHash = parts[3];
      const computedHash = crypto3.pbkdf2Sync(normalized, salt, iters, expectedHash.length / 2, PBKDF2_DIGEST).toString("hex");
      const bufA = Buffer.from(computedHash, "hex");
      const bufB = Buffer.from(expectedHash, "hex");
      const isMatch2 = bufA.length === bufB.length && crypto3.timingSafeEqual(bufA, bufB);
      const needsRehash = isMatch2 && iters < PBKDF2_ITERATIONS;
      return { isMatch: isMatch2, needsRehash };
    }
  }
  if (storedHashOrPlain.includes(":") && storedHashOrPlain.split(":").length === 2) {
    const [salt, expectedHash] = storedHashOrPlain.split(":");
    const computedHash = crypto3.pbkdf2Sync(normalized, salt, 1e5, 64, PBKDF2_DIGEST).toString("hex");
    const bufA = Buffer.from(computedHash, "hex");
    const bufB = Buffer.from(expectedHash, "hex");
    const isMatch2 = bufA.length === bufB.length && crypto3.timingSafeEqual(bufA, bufB);
    return { isMatch: isMatch2, needsRehash: isMatch2 };
  }
  const cleanStored = normalizeDigits(cleanString(storedHashOrPlain));
  const hashA = crypto3.createHash("sha256").update(normalized).digest();
  const hashB = crypto3.createHash("sha256").update(cleanStored).digest();
  const isMatch = crypto3.timingSafeEqual(hashA, hashB);
  return { isMatch, needsRehash: isMatch };
}
function generateRandomPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let res = "";
  const bytes = crypto3.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    res += chars[bytes[i] % chars.length];
  }
  return res;
}
async function getOrMigrateRestaurantPassword(restaurantId) {
  const db = getAdminDb();
  const docRef = db.collection("restaurant_credentials").doc(restaurantId);
  const snap = await docRef.get();
  if (snap.exists) {
    const data = snap.data();
    return {
      restaurantId,
      passwordHash: data.passwordHash,
      mustChangePassword: Boolean(data.mustChangePassword),
      isCustom: Boolean(data.isCustom),
      updatedAt: data.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  const venueDoc = await db.collection("venues").doc(restaurantId).get();
  if (venueDoc.exists) {
    const venueData = venueDoc.data();
    if (venueData.adminPassword) {
      const rawOld = String(venueData.adminPassword);
      const newHash = hashPassword(rawOld);
      const isLegacyDefault = rawOld.trim() === LEGACY_DEFAULT_PASSWORD;
      const creds2 = {
        restaurantId,
        passwordHash: newHash,
        mustChangePassword: isLegacyDefault,
        isCustom: !isLegacyDefault,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await docRef.set(creds2, { merge: true });
      return creds2;
    }
  }
  const defaultHash = hashPassword(LEGACY_DEFAULT_PASSWORD);
  const creds = {
    restaurantId,
    passwordHash: defaultHash,
    mustChangePassword: true,
    isCustom: false,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await docRef.set(creds, { merge: true }).catch((err) => {
    console.warn("[PasswordManager] Could not save initial credentials:", err);
  });
  return creds;
}
async function setRestaurantPassword(restaurantId, newPlainPassword) {
  const cleaned = cleanString(newPlainPassword);
  if (!cleaned || cleaned.length < 6) {
    throw new Error("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u064A\u062C\u0628 \u0623\u0644\u0627 \u062A\u0642\u0644 \u0639\u0646 6 \u062E\u0627\u0646\u0627\u062A");
  }
  if (DISALLOWED_PASSWORDS.has(cleaned.toLowerCase())) {
    throw new Error("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0647\u0630\u0647 \u0634\u0627\u0626\u0639\u0629 \u0623\u0648 \u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629 \u0648\u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D \u0628\u0647\u0627 \u0644\u0623\u0633\u0628\u0627\u0628 \u0623\u0645\u0646\u064A\u0629");
  }
  const newHash = hashPassword(cleaned);
  const db = getAdminDb();
  await db.collection("restaurant_credentials").doc(restaurantId).set(
    {
      restaurantId,
      passwordHash: newHash,
      mustChangePassword: false,
      isCustom: true,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    { merge: true }
  );
  await db.collection("sessions").doc(restaurantId).set(
    {
      sessionVersion: crypto3.randomBytes(8).toString("hex"),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    { merge: true }
  ).catch(() => {
  });
}

// src/server/session.ts
import crypto4 from "crypto";
var SUPER_ADMIN_MAX_AGE_MS = 12 * 60 * 60 * 1e3;
var RESTAURANT_OWNER_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1e3;
function getSessionSecret() {
  const secret = cleanString(process.env.SESSION_SECRET);
  if (secret) {
    return secret;
  }
  const pass = cleanString(process.env.SUPER_ADMIN_PASSWORD);
  if (pass) {
    return crypto4.createHash("sha256").update(`menu-session-salt:${pass}`).digest("hex");
  }
  return "app_session_secret_default_hmac_key_min_32_chars";
}
function getSuperAdminPassword() {
  const pass = cleanString(process.env.SUPER_ADMIN_PASSWORD);
  if (!pass && !process.env.SUPER_ADMIN_PASSWORD_HASH) {
    throw new Error("MISSING_ENV:SUPER_ADMIN_PASSWORD");
  }
  return pass;
}
function verifySuperAdminPassword(input) {
  if (!input || typeof input !== "string") return false;
  const normalizedInput = normalizeDigits(cleanString(input));
  const envHash = cleanString(process.env.SUPER_ADMIN_PASSWORD_HASH);
  if (envHash) {
    const computed = crypto4.createHash("sha256").update(normalizedInput).digest("hex");
    const bufA = Buffer.from(computed);
    const bufB = Buffer.from(envHash);
    if (bufA.length === bufB.length && crypto4.timingSafeEqual(bufA, bufB)) {
      return true;
    }
  }
  const envPass = getSuperAdminPassword();
  if (!envPass) return false;
  const hashA = crypto4.createHash("sha256").update(normalizedInput).digest();
  const hashB = crypto4.createHash("sha256").update(normalizeDigits(envPass)).digest();
  return crypto4.timingSafeEqual(hashA, hashB);
}
function isRequestHttps(req) {
  try {
    if (req.secure) return true;
  } catch {
  }
  return req.headers?.["x-forwarded-proto"] === "https";
}
function getCookieName(req) {
  const isHttps = isRequestHttps(req);
  const isProduction = process.env.NODE_ENV === "production" && !process.env.AIS_DEV;
  if (isProduction && isHttps) {
    return "__Host-app_session_token";
  }
  return "app_session_token";
}
function createSignedToken(payload) {
  const secret = getSessionSecret();
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto4.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function parseSignedToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  let secret;
  try {
    secret = getSessionSecret();
  } catch {
    return null;
  }
  const expectedSig = crypto4.createHmac("sha256", secret).update(body).digest("base64url");
  const bufA = Buffer.from(sig);
  const bufB = Buffer.from(expectedSig);
  if (bufA.length !== bufB.length || !crypto4.timingSafeEqual(bufA, bufB)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
    if (Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
async function getRestaurantSessionVersion(restaurantId) {
  if (!isFirebaseAdminConfigured()) return "v1";
  try {
    const db = getAdminDb();
    const docRef = db.collection("sessions").doc(restaurantId);
    const snap = await docRef.get();
    if (snap.exists && snap.data()?.sessionVersion) {
      return snap.data().sessionVersion;
    }
    const newVer = crypto4.randomBytes(8).toString("hex");
    await docRef.set({ sessionVersion: newVer, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, { merge: true });
    return newVer;
  } catch {
    return "v1";
  }
}
async function bumpRestaurantSessionVersion(restaurantId) {
  if (!isFirebaseAdminConfigured()) return;
  try {
    const db = getAdminDb();
    const newVer = crypto4.randomBytes(8).toString("hex");
    await db.collection("sessions").doc(restaurantId).set({ sessionVersion: newVer, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, { merge: true });
  } catch (err) {
    console.warn("Failed to bump restaurant session version:", err);
  }
}
async function bumpGlobalSessionVersion() {
  if (!isFirebaseAdminConfigured()) return;
  try {
    const db = getAdminDb();
    const newVer = crypto4.randomBytes(8).toString("hex");
    await db.collection("sessions").doc("_global_super_admin").set({ sessionVersion: newVer, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, { merge: true });
  } catch (err) {
    console.warn("Failed to bump global session version:", err);
  }
}
async function getGlobalSessionVersion() {
  if (!isFirebaseAdminConfigured()) return "v1";
  try {
    const db = getAdminDb();
    const snap = await db.collection("sessions").doc("_global_super_admin").get();
    if (snap.exists && snap.data()?.sessionVersion) {
      return snap.data().sessionVersion;
    }
  } catch {
  }
  return "v1";
}
function setSessionCookie(req, res, data) {
  const maxAge = data.role === "super_admin" ? SUPER_ADMIN_MAX_AGE_MS : RESTAURANT_OWNER_MAX_AGE_MS;
  const exp = Date.now() + maxAge;
  const jti = crypto4.randomBytes(12).toString("hex");
  const payload = {
    role: data.role,
    restaurantId: data.restaurantId,
    sessionVersion: data.sessionVersion || "v1",
    jti,
    exp
  };
  const token = createSignedToken(payload);
  const isHttps = isRequestHttps(req);
  const isAiStudio = Boolean(process.env.AIS_DEV || req.headers?.["sec-fetch-dest"] === "iframe");
  const cookieName = getCookieName(req);
  if (typeof res.cookie === "function") {
    res.cookie(cookieName, token, {
      httpOnly: true,
      secure: isHttps || isAiStudio,
      sameSite: isAiStudio ? "none" : "lax",
      maxAge,
      path: "/"
    });
  } else {
    const sameSite = isAiStudio ? "None" : "Lax";
    const secureFlag = isHttps || isAiStudio ? "; Secure" : "";
    const cookieHeader = `${cookieName}=${token}; Path=/; Max-Age=${Math.floor(maxAge / 1e3)}; HttpOnly; SameSite=${sameSite}${secureFlag}`;
    res.setHeader("Set-Cookie", cookieHeader);
  }
}
function clearSessionCookie(req, res) {
  const names = [getCookieName(req), "__Host-app_session_token", "app_session_token"];
  for (const name of names) {
    res.clearCookie(name, { path: "/" });
  }
}
async function mintFirebaseCustomToken(claims) {
  if (!isFirebaseAdminConfigured()) {
    return null;
  }
  try {
    const auth = getAdminAuth();
    const uid = claims.role === "super_admin" ? `admin_${Date.now()}` : `owner_${claims.venueId}_${Date.now()}`;
    return await auth.createCustomToken(uid, claims);
  } catch (err) {
    console.warn("[Session] Failed to mint Firebase Custom Token:", err);
    return null;
  }
}

// src/server/app.ts
dotenv.config();
var app = express();
function getClientIp(req) {
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }
  const vercelIp = req.headers["x-vercel-forwarded-for"];
  if (typeof vercelIp === "string" && vercelIp.trim()) {
    return vercelIp.split(",")[0].trim();
  }
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "127.0.0.1";
}
var ID_REGEX = /^[A-Za-z0-9_-]{1,128}$/;
function isValidId(id) {
  if (!id || typeof id !== "string") return false;
  return ID_REGEX.test(id.trim());
}
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  const origin = req.headers.origin;
  const appUrl = cleanString(process.env.APP_URL);
  const isAiStudio = Boolean(process.env.AIS_DEV || req.headers["sec-fetch-dest"] === "iframe");
  if (isAiStudio) {
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
  } else {
    if (origin && appUrl && (origin === appUrl || origin.endsWith(".vercel.app"))) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Cookie, X-Requested-With"
  );
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});
app.use((req, res, next) => {
  if (req.body && typeof req.body === "object") {
    req._body = true;
  }
  next();
});
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
function requireCsrf(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }
  const requestedWith = req.headers["x-requested-with"];
  const contentType = req.headers["content-type"] || "";
  const isJsonHeader = contentType.toLowerCase().includes("application/json");
  const hasContentType = typeof req.is === "function" ? Boolean(req.is("application/json")) : isJsonHeader;
  if (requestedWith || isJsonHeader || hasContentType) {
    return next();
  }
  res.status(403).json({ error: "\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0647 (CSRF)", code: "CSRF_INVALID" });
}
async function authenticateSession(req) {
  const cookieName = getCookieName(req);
  const token = req.cookies?.[cookieName] || req.cookies?.["app_session_token"];
  const session = parseSignedToken(token);
  if (!session) return null;
  const globalVer = await getGlobalSessionVersion();
  if (globalVer !== "v1" && session.sessionVersion !== globalVer) {
    return null;
  }
  if (session.role === "restaurant_owner" && session.restaurantId) {
    const currentVer = await getRestaurantSessionVersion(session.restaurantId);
    if (session.sessionVersion && session.sessionVersion !== currentVer) {
      return null;
    }
  }
  return session;
}
async function requireSuperAdmin(req, res, next) {
  const session = await authenticateSession(req);
  if (!session || session.role !== "super_admin") {
    res.status(401).json({
      error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0627\u0644\u0648\u0635\u0648\u0644 (\u064A\u062A\u0637\u0644\u0628 \u0635\u0644\u0627\u062D\u064A\u0629 Super Admin)",
      code: "UNAUTHORIZED_SUPER_ADMIN"
    });
    return;
  }
  req.session = session;
  next();
}
async function requireRestaurantOwner(req, res, next) {
  const session = await authenticateSession(req);
  if (!session) {
    res.status(401).json({
      error: "\u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648\u0644\u0627\u064B",
      code: "UNAUTHORIZED"
    });
    return;
  }
  if (session.role === "super_admin") {
    req.session = session;
    return next();
  }
  const requestedVenueId = req.params.venueId || req.params.restaurantId;
  if (!session.restaurantId || requestedVenueId && session.restaurantId !== requestedVenueId) {
    res.status(403).json({
      error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0625\u062F\u0627\u0631\u0629 \u0647\u0630\u0627 \u0627\u0644\u0645\u0637\u0639\u0645",
      code: "FORBIDDEN_RESTAURANT_MISMATCH"
    });
    return;
  }
  req.session = session;
  next();
}
var api = express.Router();
api.use(requireCsrf);
api.get("/health", (req, res) => {
  const adminOk = isFirebaseAdminConfigured();
  res.json({
    ok: true,
    databaseMode: adminOk ? "firebase-admin" : "missing",
    time: (/* @__PURE__ */ new Date()).toISOString()
  });
});
api.get("/super-admin/config-status", (req, res) => {
  const missing = getMissingAdminEnv();
  if (!cleanString(process.env.SUPER_ADMIN_PASSWORD) && !process.env.SUPER_ADMIN_PASSWORD_HASH) {
    missing.push("SUPER_ADMIN_PASSWORD");
  }
  const secret = cleanString(process.env.SESSION_SECRET);
  if (!secret || secret.length < 32) {
    missing.push("SESSION_SECRET");
  }
  res.json({
    isConfigured: missing.length === 0,
    missingVariables: missing
  });
});
api.get("/super-admin/health", requireSuperAdmin, async (req, res) => {
  try {
    const missing = [];
    if (!cleanString(process.env.SUPER_ADMIN_PASSWORD) && !process.env.SUPER_ADMIN_PASSWORD_HASH) {
      missing.push("SUPER_ADMIN_PASSWORD");
    }
    const secret = cleanString(process.env.SESSION_SECRET);
    if (!secret || secret.length < 32) {
      missing.push("SESSION_SECRET");
    }
    const firestoreDiag = await testAdminFirestoreDiagnostics();
    const db = getAdminDb();
    let countRestaurants = 0;
    let countWithPassword = 0;
    let countMissingSlug = 0;
    const venuesSnap = await db.collection("venues").get();
    countRestaurants = venuesSnap.size;
    for (const doc of venuesSnap.docs) {
      const v = doc.data();
      if (!v.slug) countMissingSlug++;
      const cred = await db.collection("restaurant_credentials").doc(doc.id).get();
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
        countMissingSlug
      },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    console.error("Error running super admin health check:", err);
    res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u0625\u062C\u0631\u0627\u0621 \u0641\u062D\u0635 \u0627\u0644\u0646\u0638\u0627\u0645", code: "HEALTH_CHECK_FAILED" });
  }
});
api.get("/auth/session", async (req, res) => {
  try {
    const session = await authenticateSession(req);
    if (!session) {
      return res.json({ isAuthenticated: false, role: null, restaurantId: null });
    }
    const customToken = await mintFirebaseCustomToken({
      role: session.role,
      venueId: session.restaurantId
    }).catch(() => null);
    res.json({
      isAuthenticated: true,
      role: session.role,
      restaurantId: session.restaurantId || null,
      customToken
    });
  } catch (err) {
    console.error("Session verify error:", err);
    res.json({ isAuthenticated: false, role: null, restaurantId: null });
  }
});
api.post("/auth/logout", (req, res) => {
  clearSessionCookie(req, res);
  res.json({ success: true });
});
api.post("/super-admin/login", async (req, res) => {
  const ip = getClientIp(req);
  const scope = `super-admin:${ip}`;
  try {
    const rateCheck = await checkRateLimit(scope, 3, 15 * 60 * 1e3);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: rateCheck.arabicMessage || "\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0645\u0624\u0642\u062A\u064B\u0627",
        code: "RATE_LIMITED",
        remainingSeconds: rateCheck.remainingLockoutSeconds
      });
    }
    const { password } = req.body || {};
    if (!password || typeof password !== "string") {
      await recordFailedAttempt(scope, 3, 15 * 60 * 1e3);
      return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", code: "BAD_DATA" });
    }
    let isMatch = false;
    try {
      isMatch = verifySuperAdminPassword(password);
    } catch (envErr) {
      return res.status(500).json({
        error: "\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645",
        code: envErr.message || "MISSING_ENV:SUPER_ADMIN_PASSWORD"
      });
    }
    if (!isMatch) {
      await recordFailedAttempt(scope, 3, 15 * 60 * 1e3);
      if (isFirebaseAdminConfigured()) {
        try {
          const db = getAdminDb();
          await db.collection("restaurant_slug_audit_logs").doc(`login_${Date.now()}`).set({
            type: "super_admin_login",
            success: false,
            ipHash: crypto5.createHash("sha256").update(ip).digest("hex").substring(0, 16),
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
        } catch {
        }
      }
      return res.status(401).json({
        success: false,
        error: "\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629",
        code: "BAD_PASSWORD"
      });
    }
    await resetRateLimit(scope);
    if (isFirebaseAdminConfigured()) {
      try {
        const db = getAdminDb();
        await db.collection("restaurant_slug_audit_logs").doc(`login_${Date.now()}`).set({
          type: "super_admin_login",
          success: true,
          ipHash: crypto5.createHash("sha256").update(ip).digest("hex").substring(0, 16),
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch {
      }
    }
    try {
      setSessionCookie(req, res, { role: "super_admin" });
    } catch (cookieErr) {
      console.error("Failed to set session cookie:", cookieErr);
      return res.status(500).json({
        error: "\u062A\u0639\u0630\u0631 \u0625\u0646\u0634\u0627\u0621 \u062C\u0644\u0633\u0629 \u0627\u0644\u062F\u062E\u0648\u0644 (\u062A\u062D\u0642\u0642 \u0645\u0646 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062C\u0644\u0633\u0629 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645)",
        code: cookieErr?.message || "SESSION_ERROR"
      });
    }
    const customToken = await mintFirebaseCustomToken({ role: "super_admin" });
    res.json({
      success: true,
      role: "super_admin",
      customToken
    });
  } catch (err) {
    console.error("Super Admin login error:", err);
    if (err.message === "FIRESTORE_UNAVAILABLE") {
      return res.status(503).json({
        error: "\u062A\u0639\u0630\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0642\u0627\u0639\u062F\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062E\u0627\u062F\u0645",
        code: "FIRESTORE_UNAVAILABLE"
      });
    }
    res.status(500).json({
      error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u0645\u0639\u0627\u0644\u062C\u0629 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644",
      code: err.message || "INTERNAL_ERROR"
    });
  }
});
api.post("/admin/restaurant-login", async (req, res) => {
  const ip = getClientIp(req);
  const { restaurantId, password } = req.body || {};
  if (!isValidId(restaurantId) || !password || typeof password !== "string") {
    return res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629", code: "BAD_ID" });
  }
  const rawId = restaurantId.trim();
  const cleanId = rawId.toLowerCase();
  const scope = `restaurant-login:${cleanId}:${ip}`;
  try {
    const rateCheck = await checkRateLimit(scope, 5, 15 * 60 * 1e3);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: rateCheck.arabicMessage || "\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0645\u0624\u0642\u062A\u064B\u0627",
        code: "RATE_LIMITED",
        remainingSeconds: rateCheck.remainingLockoutSeconds
      });
    }
    const db = getAdminDb();
    let canonicalVenueId = null;
    let venueSnap = await db.collection("venues").doc(rawId).get();
    if (!venueSnap.exists && cleanId !== rawId) {
      venueSnap = await db.collection("venues").doc(cleanId).get();
    }
    if (venueSnap.exists) {
      canonicalVenueId = venueSnap.id;
    } else {
      const regSnap = await db.collection("slug_registry").doc(cleanId).get();
      if (regSnap.exists && regSnap.data()?.isActive !== false && regSnap.data()?.venueId) {
        canonicalVenueId = regSnap.data().venueId;
      }
    }
    if (!canonicalVenueId) {
      executeDummyHash();
      await recordFailedAttempt(scope, 5, 15 * 60 * 1e3);
      return res.status(404).json({
        error: "\u0627\u0644\u0645\u0637\u0639\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u0623\u0643\u062F \u0645\u0646 \u0627\u0644\u0645\u0639\u0631\u0651\u0641",
        code: "RESTAURANT_NOT_FOUND"
      });
    }
    const creds = await getOrMigrateRestaurantPassword(canonicalVenueId);
    const { isMatch, needsRehash } = verifyPassword(password, creds.passwordHash);
    if (!isMatch) {
      await recordFailedAttempt(scope, 5, 15 * 60 * 1e3);
      return res.status(401).json({
        error: "\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0627\u0644\u0645\u0637\u0639\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629",
        code: "BAD_PASSWORD"
      });
    }
    if (needsRehash) {
      const upgraded = hashPassword(password);
      await db.collection("restaurant_credentials").doc(canonicalVenueId).set({ passwordHash: upgraded, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, { merge: true }).catch(() => {
      });
    }
    await resetRateLimit(scope);
    const sessionVer = await getRestaurantSessionVersion(canonicalVenueId);
    setSessionCookie(req, res, {
      role: "restaurant_owner",
      restaurantId: canonicalVenueId,
      sessionVersion: sessionVer
    });
    const customToken = await mintFirebaseCustomToken({
      role: "restaurant_owner",
      venueId: canonicalVenueId
    });
    res.json({
      success: true,
      role: "restaurant_owner",
      restaurantId: canonicalVenueId,
      customToken,
      mustChangePassword: creds.mustChangePassword
    });
  } catch (err) {
    console.error("Restaurant login error:", err);
    if (err.message === "FIRESTORE_UNAVAILABLE") {
      return res.status(503).json({
        error: "\u062A\u0639\u0630\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0642\u0627\u0639\u062F\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062E\u0627\u062F\u0645",
        code: "FIRESTORE_UNAVAILABLE"
      });
    }
    res.status(500).json({
      error: "\u062A\u0639\u0630\u0631 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0644\u0645\u0637\u0639\u0645",
      code: err.message || "INTERNAL_ERROR"
    });
  }
});
api.post("/auth/consume-magic-link", async (req, res) => {
  const { token } = req.body || {};
  if (!token || typeof token !== "string" || token.length > 256) {
    return res.status(400).json({ error: "\u0631\u0645\u0632 \u0627\u0644\u0631\u0627\u0628\u0637 \u0645\u0637\u0644\u0648\u0628 \u0648\u0635\u0627\u0644\u062D", code: "BAD_DATA" });
  }
  const tokenHash = crypto5.createHash("sha256").update(token.trim()).digest("hex");
  const db = getAdminDb();
  try {
    const snap = await db.collection("restaurant_login_links").where("token_hash", "==", tokenHash).limit(1).get();
    if (snap.empty) {
      return res.status(404).json({ error: "\u0627\u0644\u0631\u0627\u0628\u0637 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u062A\u0645 \u0625\u0644\u063A\u0627\u0624\u0647", code: "INVALID_LINK" });
    }
    const docSnap = snap.docs[0];
    const linkData = docSnap.data();
    if (!linkData.is_active) {
      return res.status(403).json({ error: "\u062A\u0645 \u062A\u0639\u0637\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u0631\u0627\u0628\u0637 \u0628\u0648\u0627\u0633\u0637\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629", code: "LINK_DISABLED" });
    }
    if (linkData.expires_at && new Date(linkData.expires_at).getTime() < Date.now()) {
      return res.status(403).json({ error: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0647\u0630\u0627 \u0627\u0644\u0631\u0627\u0628\u0637", code: "LINK_EXPIRED" });
    }
    await docSnap.ref.update({
      last_used_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    const restaurantId = linkData.restaurant_id;
    const sessionVer = await getRestaurantSessionVersion(restaurantId);
    setSessionCookie(req, res, {
      role: "restaurant_owner",
      restaurantId,
      sessionVersion: sessionVer
    });
    const customToken = await mintFirebaseCustomToken({
      role: "restaurant_owner",
      venueId: restaurantId
    });
    res.json({
      success: true,
      restaurantId,
      customToken
    });
  } catch (err) {
    console.error("Consume magic link error:", err);
    res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u0645\u0639\u0627\u0644\u062C\u0629 \u0627\u0644\u0631\u0627\u0628\u0637 \u0627\u0644\u0633\u062D\u0631\u064A", code: "INTERNAL_ERROR" });
  }
});
api.get("/public/menu/:slug", async (req, res) => {
  const rawSlug = req.params.slug;
  if (!isValidId(rawSlug)) {
    return res.status(400).json({ error: "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u0637\u0639\u0645 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D", code: "BAD_ID" });
  }
  const cleanSlug = rawSlug.trim().toLowerCase();
  if (!isFirebaseAdminConfigured()) {
    return res.status(503).json({ error: "\u0642\u0627\u0639\u062F\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062E\u0627\u062F\u0645 \u063A\u064A\u0631 \u0645\u0641\u0639\u0644\u0629 \u062D\u0627\u0644\u064A\u0627\u064B", code: "FIRESTORE_UNAVAILABLE" });
  }
  const db = getAdminDb();
  try {
    let venueDocSnap = await db.collection("venues").doc(rawSlug).get();
    if (!venueDocSnap.exists && cleanSlug !== rawSlug) {
      venueDocSnap = await db.collection("venues").doc(cleanSlug).get();
    }
    let resolvedVenueId = venueDocSnap.exists ? venueDocSnap.id : null;
    if (!resolvedVenueId) {
      const regSnap = await db.collection("slug_registry").doc(cleanSlug).get();
      if (regSnap.exists) {
        const regData = regSnap.data();
        if (regData?.isActive === false) {
          return res.status(410).json({
            error: "\u062A\u0645 \u062A\u0639\u0637\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u0631\u0627\u0628\u0637 \u0627\u0644\u0642\u062F\u064A\u0645 \u0645\u0646 \u0642\u0628\u0644 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0637\u0639\u0645",
            code: "ALIAS_DEACTIVATED"
          });
        }
        resolvedVenueId = regData?.venueId || null;
      }
    }
    if (!resolvedVenueId) {
      return res.status(404).json({ error: "\u0627\u0644\u0645\u0637\u0639\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", code: "RESTAURANT_NOT_FOUND" });
    }
    if (!venueDocSnap.exists) {
      venueDocSnap = await db.collection("venues").doc(resolvedVenueId).get();
    }
    if (!venueDocSnap.exists) {
      return res.status(404).json({ error: "\u0627\u0644\u0645\u0637\u0639\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", code: "RESTAURANT_NOT_FOUND" });
    }
    const rawVenue = venueDocSnap.data();
    const venue = {
      id: venueDocSnap.id,
      name: rawVenue.name || "\u0645\u0637\u0639\u0645",
      slug: rawVenue.slug || venueDocSnap.id,
      description: rawVenue.description || "",
      currency: rawVenue.currency || "SAR",
      currencySymbol: rawVenue.currencySymbol || "\u0631.\u0633",
      coverImage: rawVenue.coverImage || "",
      profileImage: rawVenue.profileImage || "",
      phone: rawVenue.phone || "",
      address: rawVenue.address || "",
      openingHours: rawVenue.openingHours || "",
      previousSlugs: rawVenue.previousSlugs || []
    };
    const [catsSnap, prodsSnap, tagsSnap] = await Promise.all([
      db.collection("categories").where("venueId", "==", resolvedVenueId).get(),
      db.collection("products").where("venueId", "==", resolvedVenueId).where("isVisible", "==", true).get(),
      db.collection("filterTags").where("venueId", "==", resolvedVenueId).get()
    ]);
    const categories = catsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const products = prodsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const filterTags = tagsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
    res.json({
      venue,
      categories,
      products,
      filterTags
    });
  } catch (err) {
    console.error("Error fetching public menu:", err);
    res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u062A\u062D\u0645\u064A\u0644 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0637\u0639\u0627\u0645", code: "INTERNAL_ERROR" });
  }
});
api.post("/venues/:venueId/change-slug", requireRestaurantOwner, async (req, res) => {
  const { venueId } = req.params;
  const { newSlug } = req.body || {};
  const session = req.session;
  if (!isValidId(venueId)) {
    return res.status(400).json({ error: "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u0637\u0639\u0645 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D", code: "BAD_ID" });
  }
  try {
    const result = await changeRestaurantSlugTransaction({
      venueId,
      newSlugRaw: newSlug,
      changedBy: session.role === "super_admin" ? "super_admin" : "restaurant_owner"
    });
    res.json(result);
  } catch (err) {
    console.error("Change slug error:", err);
    res.status(400).json({ error: err.message || "\u0641\u0634\u0644 \u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0645\u0639\u0631\u0651\u0641", code: "SLUG_CHANGE_FAILED" });
  }
});
api.patch(
  "/venues/:venueId/aliases/:aliasSlug/toggle",
  requireRestaurantOwner,
  async (req, res) => {
    const { venueId, aliasSlug } = req.params;
    if (!isValidId(venueId) || !isValidId(aliasSlug)) {
      return res.status(400).json({ error: "\u0645\u0639\u0631\u0651\u0641 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D", code: "BAD_ID" });
    }
    try {
      const result = await toggleAliasStatus(venueId, aliasSlug);
      res.json(result);
    } catch (err) {
      console.error("Toggle alias error:", err);
      res.status(400).json({ error: err.message || "\u062A\u0639\u0630\u0631 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u062A\u062D\u0648\u064A\u0644", code: "ALIAS_TOGGLE_FAILED" });
    }
  }
);
api.get("/super-admin/restaurants", requireSuperAdmin, async (req, res) => {
  try {
    const db = getAdminDb();
    const [venuesSnap, linksSnap] = await Promise.all([
      db.collection("venues").get(),
      db.collection("restaurant_login_links").get()
    ]);
    const linksMap = /* @__PURE__ */ new Map();
    linksSnap.forEach((d) => {
      const l = d.data();
      if (l.restaurant_id) linksMap.set(l.restaurant_id, l);
    });
    const restaurants = await Promise.all(
      venuesSnap.docs.map(async (doc) => {
        const v = doc.data();
        const link = linksMap.get(doc.id);
        const credSnap = await db.collection("restaurant_credentials").doc(doc.id).get();
        const cred = credSnap.data();
        return {
          id: doc.id,
          name: v.name || "\u0628\u062F\u0648\u0646 \u0627\u0633\u0645",
          slug: v.slug || doc.id,
          previousSlugs: v.previousSlugs || [],
          currency: v.currency || "SAR",
          createdAt: v.createdAt || null,
          hasLink: Boolean(link),
          isLinkActive: Boolean(link?.is_active),
          linkCreatedAt: link?.created_at || null,
          lastUsedAt: link?.last_used_at || null,
          mustChangePassword: Boolean(cred?.mustChangePassword),
          hasCustomPassword: Boolean(cred?.isCustom)
        };
      })
    );
    restaurants.sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    res.json({ restaurants });
  } catch (err) {
    console.error("Super Admin fetch restaurants error:", err);
    res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u062A\u062D\u0645\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0637\u0627\u0639\u0645", code: "INTERNAL_ERROR" });
  }
});
api.post("/super-admin/restaurants", requireSuperAdmin, async (req, res) => {
  const { name, currency } = req.body || {};
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0637\u0639\u0645 \u0645\u0637\u0644\u0648\u0628", code: "BAD_DATA" });
  }
  const db = getAdminDb();
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let randomSlug = "r-";
  const bytes = crypto5.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    randomSlug += chars[bytes[i] % chars.length];
  }
  try {
    const venueRef = db.collection("venues").doc();
    const venueId = venueRef.id;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await venueRef.set({
      id: venueId,
      name: name.trim(),
      slug: randomSlug,
      currency: currency || "SAR",
      currencySymbol: "\u0631.\u0633",
      description: "\u0645\u0631\u062D\u0628\u0627\u064B \u0628\u0643\u0645 \u0641\u064A \u0642\u0627\u0626\u0645\u062A\u0646\u0627 \u0627\u0644\u0631\u0642\u0645\u064A\u0629",
      createdAt: now,
      updatedAt: now
    });
    await db.collection("slug_registry").doc(randomSlug).set({
      slug: randomSlug,
      venueId,
      type: "primary",
      isActive: true,
      updatedAt: now
    });
    const generatedPassword = generateRandomPassword();
    await setRestaurantPassword(venueId, generatedPassword);
    res.json({
      success: true,
      venue: { id: venueId, name: name.trim(), slug: randomSlug },
      generatedPassword
    });
  } catch (err) {
    console.error("Create restaurant error:", err);
    res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0645\u0637\u0639\u0645", code: "INTERNAL_ERROR" });
  }
});
api.post(
  "/super-admin/restaurants/:restaurantId/password",
  requireSuperAdmin,
  async (req, res) => {
    const { restaurantId } = req.params;
    const { newPassword } = req.body || {};
    if (!isValidId(restaurantId) || !newPassword) {
      return res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629", code: "BAD_DATA" });
    }
    try {
      await setRestaurantPassword(restaurantId, newPassword);
      res.json({ success: true, message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0628\u0646\u062C\u0627\u062D" });
    } catch (err) {
      res.status(400).json({ error: err.message || "\u0641\u0634\u0644 \u062A\u062D\u062F\u064A\u062B \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", code: "PASSWORD_UPDATE_FAILED" });
    }
  }
);
api.post(
  "/super-admin/restaurants/:restaurantId/revoke-sessions",
  requireSuperAdmin,
  async (req, res) => {
    const { restaurantId } = req.params;
    if (!isValidId(restaurantId)) {
      return res.status(400).json({ error: "\u0645\u0639\u0631\u0651\u0641 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D", code: "BAD_ID" });
    }
    try {
      await bumpRestaurantSessionVersion(restaurantId);
      res.json({ success: true, message: "\u062A\u0645 \u0625\u0646\u0647\u0627\u0621 \u062C\u0645\u064A\u0639 \u0627\u0644\u062C\u0644\u0633\u0627\u062A \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0637\u0639\u0645 \u0628\u0646\u062C\u0627\u062D" });
    } catch (err) {
      res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062C\u0644\u0633\u0627\u062A", code: "INTERNAL_ERROR" });
    }
  }
);
api.post(
  "/super-admin/revoke-all-sessions",
  requireSuperAdmin,
  async (req, res) => {
    try {
      await bumpGlobalSessionVersion();
      res.json({ success: true, message: "\u062A\u0645 \u0625\u0646\u0647\u0627\u0621 \u062C\u0645\u064A\u0639 \u0627\u0644\u062C\u0644\u0633\u0627\u062A \u0641\u064A \u0627\u0644\u0645\u0646\u0635\u0629 \u0628\u0646\u062C\u0627\u062D" });
    } catch (err) {
      res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062C\u0644\u0633\u0627\u062A \u0627\u0644\u0639\u0627\u0645\u0629", code: "INTERNAL_ERROR" });
    }
  }
);
api.delete(
  "/super-admin/restaurants/:restaurantId",
  requireSuperAdmin,
  async (req, res) => {
    const { restaurantId } = req.params;
    if (!isValidId(restaurantId)) {
      return res.status(400).json({ error: "\u0645\u0639\u0631\u0651\u0641 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D", code: "BAD_ID" });
    }
    const db = getAdminDb();
    try {
      const collectionsToDelete = ["categories", "products", "filterTags"];
      for (const colName of collectionsToDelete) {
        const snap = await db.collection(colName).where("venueId", "==", restaurantId).get();
        const batch = db.batch();
        snap.docs.slice(0, 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      await db.collection("venues").doc(restaurantId).delete();
      await db.collection("restaurant_credentials").doc(restaurantId).delete().catch(() => {
      });
      await db.collection("restaurant_login_links").doc(`link_${restaurantId}`).delete().catch(() => {
      });
      res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0645\u0637\u0639\u0645 \u0648\u0628\u064A\u0627\u0646\u0627\u062A\u0647 \u0628\u0627\u0644\u0643\u0627\u0645\u0644" });
    } catch (err) {
      console.error("Delete restaurant error:", err);
      res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u062D\u0630\u0641 \u0627\u0644\u0645\u0637\u0639\u0645", code: "INTERNAL_ERROR" });
    }
  }
);
api.post(
  "/super-admin/restaurants/:restaurantId/link",
  requireSuperAdmin,
  async (req, res) => {
    const { restaurantId } = req.params;
    if (!isValidId(restaurantId)) {
      return res.status(400).json({ error: "\u0645\u0639\u0631\u0651\u0641 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D", code: "BAD_ID" });
    }
    try {
      const db = getAdminDb();
      const rawToken = crypto5.randomBytes(32).toString("hex");
      const tokenHash = crypto5.createHash("sha256").update(rawToken).digest("hex");
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await db.collection("restaurant_login_links").doc(`link_${restaurantId}`).set({
        id: `link_${restaurantId}`,
        restaurant_id: restaurantId,
        token_hash: tokenHash,
        is_active: true,
        created_at: now,
        last_used_at: null
      });
      const appUrl = cleanString(process.env.APP_URL) || `${req.protocol}://${req.get("host")}`;
      const fullUrl = `${appUrl}/r/${rawToken}`;
      res.json({
        success: true,
        token: rawToken,
        fullUrl,
        is_active: true
      });
    } catch (err) {
      console.error("Generate magic link error:", err);
      res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u062A\u0648\u0644\u064A\u062F \u0627\u0644\u0631\u0627\u0628\u0637", code: "INTERNAL_ERROR" });
    }
  }
);
api.patch(
  "/super-admin/restaurants/:restaurantId/link/toggle",
  requireSuperAdmin,
  async (req, res) => {
    const { restaurantId } = req.params;
    if (!isValidId(restaurantId)) {
      return res.status(400).json({ error: "\u0645\u0639\u0631\u0651\u0641 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D", code: "BAD_ID" });
    }
    try {
      const db = getAdminDb();
      const ref = db.collection("restaurant_login_links").doc(`link_${restaurantId}`);
      const snap = await ref.get();
      if (!snap.exists) {
        return res.status(404).json({ error: "\u0627\u0644\u0631\u0627\u0628\u0637 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", code: "NOT_FOUND" });
      }
      const newStatus = !Boolean(snap.data()?.is_active);
      await ref.update({ is_active: newStatus });
      if (!newStatus) {
        await bumpRestaurantSessionVersion(restaurantId);
      }
      res.json({ success: true, is_active: newStatus });
    } catch (err) {
      res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u062A\u063A\u064A\u064A\u0631 \u062D\u0627\u0644\u0629 \u0627\u0644\u0631\u0627\u0628\u0637", code: "INTERNAL_ERROR" });
    }
  }
);
api.get("/super-admin/slug-audit-logs", requireSuperAdmin, async (req, res) => {
  try {
    const venueId = typeof req.query.venueId === "string" ? req.query.venueId : void 0;
    const logs = await getSlugAuditLogs(venueId);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u062C\u0644\u0628 \u0633\u062C\u0644 \u0627\u0644\u062A\u063A\u064A\u064A\u0631\u0627\u062A", code: "INTERNAL_ERROR" });
  }
});
api.post(
  "/migrations/remove-access-codes",
  requireSuperAdmin,
  async (req, res) => {
    try {
      const db = getAdminDb();
      const venuesSnap = await db.collection("venues").get();
      let cleanedCount = 0;
      let registeredSlugs = 0;
      const batch = db.batch();
      let batchCount = 0;
      for (const doc of venuesSnap.docs) {
        const data = doc.data();
        const updates = {};
        if ("accessCode" in data) updates.accessCode = null;
        if ("access_code" in data) updates.access_code = null;
        if ("adminCode" in data) updates.adminCode = null;
        if ("code" in data && typeof data.code === "string" && data.code.length <= 12) {
          updates.code = null;
        }
        if ("adminPassword" in data) updates.adminPassword = null;
        const slugVal = (data.slug || doc.id).toLowerCase();
        const regRef = db.collection("slug_registry").doc(slugVal);
        batch.set(
          regRef,
          {
            slug: slugVal,
            venueId: doc.id,
            type: "primary",
            isActive: true,
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
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
        message: `\u0627\u0643\u062A\u0645\u0644 \u0627\u0644\u062A\u0637\u0647\u064A\u0631 \u0628\u0646\u062C\u0627\u062D: \u062A\u0645 \u0641\u062D\u0635 ${venuesSnap.size} \u0645\u0637\u0639\u0645 \u0648\u062A\u0637\u0647\u064A\u0631 ${cleanedCount} \u0648\u062A\u0633\u062C\u064A\u0644 ${registeredSlugs} \u0645\u0639\u0631\u0651\u0641.`
      });
    } catch (err) {
      console.error("Migration error:", err);
      res.status(500).json({ error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u062A\u0637\u0647\u064A\u0631", code: "MIGRATION_FAILED" });
    }
  }
);
app.use("/api", api);
app.use("/", api);
var app_default = app;
export {
  app,
  authenticateSession,
  app_default as default,
  getClientIp,
  getMissingAdminEnv,
  isFirebaseAdminConfigured,
  isValidId,
  requireRestaurantOwner,
  requireSuperAdmin,
  testAdminFirestoreDiagnostics
};
