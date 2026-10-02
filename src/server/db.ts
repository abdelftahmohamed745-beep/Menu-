import crypto from 'crypto';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import {
  FIRESTORE_DATABASE_ID,
  FIREBASE_PROJECT_ID_DEFAULT,
  cleanString,
  cleanPrivateKey,
} from './config';

let cachedApp: App | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;

export function getMissingAdminEnv(): string[] {
  const missing: string[] = [];
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    if (!cleanString(process.env.FIREBASE_CLIENT_EMAIL)) {
      missing.push('FIREBASE_CLIENT_EMAIL');
    }
    if (!cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY)) {
      missing.push('FIREBASE_PRIVATE_KEY');
    }
  }
  return missing;
}

export function isFirebaseAdminConfigured(): boolean {
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

export function getAdminApp(): App {
  if (cachedApp) return cachedApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    cachedApp = existingApps[0];
    return cachedApp;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  let certObj: any;

  if (serviceAccountJson) {
    try {
      certObj = JSON.parse(serviceAccountJson);
    } catch (err: any) {
      throw new Error(`BAD_SERVICE_ACCOUNT_JSON: ${err.message}`);
    }
  } else {
    const clientEmail = cleanString(process.env.FIREBASE_CLIENT_EMAIL);
    const privateKey = cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY);
    const projectId =
      cleanString(process.env.FIREBASE_PROJECT_ID) || FIREBASE_PROJECT_ID_DEFAULT;

    if (!clientEmail || !privateKey) {
      throw new Error(
        `MISSING_ENV:${!clientEmail ? 'FIREBASE_CLIENT_EMAIL' : 'FIREBASE_PRIVATE_KEY'}`
      );
    }

    certObj = {
      projectId,
      clientEmail,
      privateKey,
    };
  }

  cachedApp = initializeApp({
    credential: cert(certObj),
    projectId: certObj.projectId,
  });

  return cachedApp;
}

export function getAdminDb(): Firestore {
  if (cachedDb) return cachedDb;
  const app = getAdminApp();
  try {
    cachedDb = getFirestore(app, FIRESTORE_DATABASE_ID);
  } catch (err) {
    // Fallback to default database if named database selector fails
    cachedDb = getFirestore(app);
  }
  return cachedDb;
}

export function getAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  const app = getAdminApp();
  cachedAuth = getAuth(app);
  return cachedAuth;
}

// Cached diagnostics for write test (60s cache to avoid excessive writes)
let lastWriteTestResult: { success: boolean; time: number; error?: string } | null =
  null;

export async function testAdminFirestoreDiagnostics(): Promise<{
  connected: boolean;
  read: boolean;
  write: boolean;
  delete: boolean;
  mode: 'firebase-admin' | 'missing';
  error: string | null;
}> {
  if (!isFirebaseAdminConfigured()) {
    const missing = getMissingAdminEnv();
    return {
      connected: false,
      read: false,
      write: false,
      delete: false,
      mode: 'missing',
      error: `المتغيرات التالية ناقصة لتشغيل Firebase Admin SDK: ${missing.join(', ')}`,
    };
  }

  let db: Firestore;
  try {
    db = getAdminDb();
  } catch (err: any) {
    return {
      connected: false,
      read: false,
      write: false,
      delete: false,
      mode: 'missing',
      error: err.message || 'فشل تهيئة Firebase Admin SDK',
    };
  }

  let readOk = false;
  let writeOk = false;
  let deleteOk = false;
  let failureError: string | null = null;

  try {
    // 1. Read test on venues collection
    await db.collection('venues').limit(1).get();
    readOk = true;

    // 2. Write + Delete test with 60s cache
    const now = Date.now();
    if (lastWriteTestResult && now - lastWriteTestResult.time < 60000) {
      writeOk = lastWriteTestResult.success;
      deleteOk = lastWriteTestResult.success;
      if (lastWriteTestResult.error) failureError = lastWriteTestResult.error;
    } else {
      const testId = `diag_${now}_${Math.random().toString(36).substring(2, 6)}`;
      const testRef = db.collection('system_health').doc(testId);
      await testRef.set({ test: true, time: new Date().toISOString() });
      writeOk = true;

      await testRef.delete();
      deleteOk = true;

      lastWriteTestResult = { success: true, time: now };
    }
  } catch (err: any) {
    failureError = err?.message || String(err);
    lastWriteTestResult = { success: false, time: Date.now(), error: failureError };
  }

  return {
    connected: readOk,
    read: readOk,
    write: writeOk,
    delete: deleteOk,
    mode: 'firebase-admin',
    error: failureError,
  };
}
