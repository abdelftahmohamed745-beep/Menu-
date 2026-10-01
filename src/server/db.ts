import { initializeApp as initClientApp, getApps as getClientApps, getApp as getClientApp } from 'firebase/app';
import {
  getFirestore as getClientFirestore,
  Firestore as ClientFirestore,
  doc as clientDoc,
  getDoc as clientGetDoc,
  setDoc as clientSetDoc,
  updateDoc as clientUpdateDoc,
  deleteDoc as clientDeleteDoc,
  collection as clientCollection,
  getDocs as clientGetDocs,
  query as clientQuery,
  where as clientWhere,
} from 'firebase/firestore';
import {
  initializeApp as initAdminApp,
  cert,
  getApps as getAdminApps,
  App as AdminApp,
} from 'firebase-admin/app';
import {
  getFirestore as getAdminFirestore,
  Firestore as AdminFirestore,
} from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Embedded guaranteed fallback configuration
export const DEFAULT_FIREBASE_CONFIG = {
  projectId: 'keen-flame-j53bd',
  appId: '1:517049151189:web:44f8985b1bb60664d27c5c',
  apiKey: 'AIzaSyDK6aErcKxY1aL_8gMsqQnGcBUUS9wN_uw',
  authDomain: 'keen-flame-j53bd.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-6515c201-ec9e-4f37-b01d-e3683d1a8c6e',
  storageBucket: 'keen-flame-j53bd.firebasestorage.app',
};

// ---------------------------------------------------------------------------
// Helpers to sanitize environment strings
// ---------------------------------------------------------------------------
export function cleanEnvString(val?: string): string {
  if (!val) return '';
  let str = val.trim();
  if (
    (str.startsWith('"') && str.endsWith('"')) ||
    (str.startsWith("'") && str.endsWith("'"))
  ) {
    str = str.slice(1, -1).trim();
  }
  return str;
}

export function cleanPrivateKey(raw?: string): string {
  if (!raw) return '';
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  // Replace literal '\n' characters with actual newlines
  key = key.replace(/\\n/g, '\n');
  return key.trim();
}

function resolveClientConfig() {
  const possiblePaths = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(__dirname, '..', '..', 'firebase-applet-config.json'),
    path.resolve(__dirname, 'firebase-applet-config.json'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.projectId && parsed.apiKey) {
          return parsed;
        }
      } catch {
        // ignore
      }
    }
  }

  return {
    projectId: cleanEnvString(process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID) || DEFAULT_FIREBASE_CONFIG.projectId,
    apiKey: cleanEnvString(process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY) || DEFAULT_FIREBASE_CONFIG.apiKey,
    authDomain: cleanEnvString(process.env.VITE_FIREBASE_AUTH_DOMAIN) || DEFAULT_FIREBASE_CONFIG.authDomain,
    firestoreDatabaseId: cleanEnvString(process.env.VITE_FIREBASE_DATABASE_ID) || DEFAULT_FIREBASE_CONFIG.firestoreDatabaseId,
    appId: DEFAULT_FIREBASE_CONFIG.appId,
  };
}

export const activeClientConfig = resolveClientConfig();

// Initialize Client SDK
export const serverFirebaseApp =
  getClientApps().length === 0 ? initClientApp(activeClientConfig) : getClientApp();

export const serverDb: ClientFirestore = getClientFirestore(
  serverFirebaseApp,
  activeClientConfig.firestoreDatabaseId || undefined
);

// ---------------------------------------------------------------------------
// Firebase Admin SDK (Privileged Server-Side SDK - Bypasses Security Rules)
// ---------------------------------------------------------------------------
let adminAppInstance: AdminApp | null = null;
let adminDbInstance: AdminFirestore | null = null;
let adminInitError: string | null = null;

export function initFirebaseAdmin(): { app: AdminApp | null; db: AdminFirestore | null; error: string | null } {
  if (adminDbInstance) {
    return { app: adminAppInstance, db: adminDbInstance, error: null };
  }

  try {
    const rawKey = process.env.FIREBASE_PRIVATE_KEY;
    const rawEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const rawProjectId = process.env.FIREBASE_PROJECT_ID;
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (serviceAccountJson || (rawKey && rawEmail)) {
      const existingApps = getAdminApps();
      if (existingApps.length === 0) {
        let certObj: any;
        if (serviceAccountJson) {
          certObj = JSON.parse(serviceAccountJson);
        } else {
          certObj = {
            projectId: cleanEnvString(rawProjectId) || activeClientConfig.projectId,
            clientEmail: cleanEnvString(rawEmail),
            privateKey: cleanPrivateKey(rawKey),
          };
        }

        adminAppInstance = initAdminApp({
          credential: cert(certObj),
          projectId: certObj.projectId,
        });
      } else {
        adminAppInstance = existingApps[0];
      }

      if (adminAppInstance) {
        const dbId = activeClientConfig.firestoreDatabaseId;
        if (dbId) {
          try {
            adminDbInstance = getAdminFirestore(adminAppInstance, dbId);
          } catch {
            adminDbInstance = getAdminFirestore(adminAppInstance);
          }
        } else {
          adminDbInstance = getAdminFirestore(adminAppInstance);
        }
      }
    }
  } catch (err: any) {
    adminInitError = err?.message || String(err);
    console.warn('[FirebaseAdmin] Failed to initialize Admin SDK:', adminInitError);
  }

  return { app: adminAppInstance, db: adminDbInstance, error: adminInitError };
}

// Attempt initialization on module load
initFirebaseAdmin();

export function getDatabaseMode(): {
  mode: 'firebase-admin' | 'firebase-web';
  adminInitialized: boolean;
  error?: string | null;
} {
  if (adminDbInstance) {
    return { mode: 'firebase-admin', adminInitialized: true };
  }
  return {
    mode: 'firebase-web',
    adminInitialized: false,
    error: adminInitError,
  };
}

// ---------------------------------------------------------------------------
// Unified Server Database Operations (Uses Admin SDK if available, else Client SDK)
// ---------------------------------------------------------------------------

export async function serverGetDoc(collectionName: string, docId: string): Promise<any | null> {
  if (adminDbInstance) {
    const snap = await adminDbInstance.collection(collectionName).doc(docId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  }

  const snap = await clientGetDoc(clientDoc(serverDb, collectionName, docId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function serverSetDoc(
  collectionName: string,
  docId: string,
  data: any,
  merge: boolean = false
): Promise<void> {
  if (adminDbInstance) {
    await adminDbInstance.collection(collectionName).doc(docId).set(data, { merge });
    return;
  }

  await clientSetDoc(clientDoc(serverDb, collectionName, docId), data, { merge });
}

export async function serverUpdateDoc(
  collectionName: string,
  docId: string,
  data: any
): Promise<void> {
  if (adminDbInstance) {
    await adminDbInstance.collection(collectionName).doc(docId).update(data);
    return;
  }

  await clientUpdateDoc(clientDoc(serverDb, collectionName, docId), data);
}

export async function serverDeleteDoc(
  collectionName: string,
  docId: string
): Promise<void> {
  if (adminDbInstance) {
    await adminDbInstance.collection(collectionName).doc(docId).delete();
    return;
  }

  await clientDeleteDoc(clientDoc(serverDb, collectionName, docId));
}

export async function serverGetDocs(
  collectionName: string,
  filter?: { field: string; op: '==' | '<=' | '>='; value: any }
): Promise<Array<{ id: string; [key: string]: any }>> {
  if (adminDbInstance) {
    let ref: any = adminDbInstance.collection(collectionName);
    if (filter) {
      ref = ref.where(filter.field, filter.op, filter.value);
    }
    const snap = await ref.get();
    return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
  }

  let q: any = clientCollection(serverDb, collectionName);
  if (filter) {
    q = clientQuery(q, clientWhere(filter.field, filter.op, filter.value));
  }
  const snap = await clientGetDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }));
}

// ---------------------------------------------------------------------------
// Comprehensive Health Diagnostics (Read + Write + Delete check on temp doc)
// ---------------------------------------------------------------------------
export async function testFirestoreDiagnostics(): Promise<{
  connected: boolean;
  read: boolean;
  write: boolean;
  delete: boolean;
  mode: 'firebase-admin' | 'firebase-web';
  error: string | null;
}> {
  const modeInfo = getDatabaseMode();
  const testDocId = `health_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const testData = {
    test: true,
    timestamp: new Date().toISOString(),
  };

  let writeSuccess = false;
  let readSuccess = false;
  let deleteSuccess = false;
  let failureError: string | null = null;

  try {
    // 1. Write test
    await serverSetDoc('system_health', testDocId, testData);
    writeSuccess = true;

    // 2. Read test
    const readDoc = await serverGetDoc('system_health', testDocId);
    if (readDoc && readDoc.test === true) {
      readSuccess = true;
    }

    // 3. Delete test
    await serverDeleteDoc('system_health', testDocId);
    deleteSuccess = true;
  } catch (err: any) {
    failureError = err?.message || String(err);
    console.error('[FirestoreDiagnostics] Error performing test read/write/delete:', failureError);

    // Fallback: try reading an existing venues collection just to verify basic read connectivity
    if (!readSuccess) {
      try {
        await serverGetDocs('venues');
        readSuccess = true;
      } catch (readErr: any) {
        if (!failureError) failureError = readErr?.message || String(readErr);
      }
    }
  }

  const isConnected = readSuccess || (writeSuccess && deleteSuccess);

  return {
    connected: isConnected,
    read: readSuccess,
    write: writeSuccess,
    delete: deleteSuccess,
    mode: modeInfo.mode,
    error: failureError,
  };
}
