import { initializeApp as initClientApp, getApps as getClientApps, getApp as getClientApp } from 'firebase/app';
import { getFirestore as getClientFirestore, Firestore } from 'firebase/firestore';
import { initializeApp as initAdminApp, cert, getApps as getAdminApps, App as AdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, Firestore as AdminFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Embedded, guaranteed default configuration (never empty, never undefined)
export const DEFAULT_FIREBASE_CONFIG = {
  projectId: 'keen-flame-j53bd',
  appId: '1:517049151189:web:44f8985b1bb60664d27c5c',
  apiKey: 'AIzaSyDK6aErcKxY1aL_8gMsqQnGcBUUS9wN_uw',
  authDomain: 'keen-flame-j53bd.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-6515c201-ec9e-4f37-b01d-e3683d1a8c6e',
  storageBucket: 'keen-flame-j53bd.firebasestorage.app',
};

function resolveConfig() {
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
        // Continue to fallback
      }
    }
  }

  // Fallback to environment variables or embedded defaults
  return {
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
    firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID || DEFAULT_FIREBASE_CONFIG.firestoreDatabaseId,
    appId: DEFAULT_FIREBASE_CONFIG.appId,
  };
}

const activeConfig = resolveConfig();

// Initialize Client SDK (works on Node.js & Vercel serverless without credentials)
export const serverFirebaseApp = getClientApps().length === 0 ? initClientApp(activeConfig) : getClientApp();
export const serverDb: Firestore = getClientFirestore(
  serverFirebaseApp,
  activeConfig.firestoreDatabaseId || undefined
);

// Optional Firebase Admin SDK initialization if credentials provided in Vercel
let adminAppInstance: AdminApp | null = null;
let adminDbInstance: AdminFirestore | null = null;
let adminInitError: string | null = null;

try {
  const adminPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  const adminClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccountJson || (adminPrivateKey && adminClientEmail)) {
    const existingApps = getAdminApps();

    if (existingApps.length === 0) {
      let certObj: any;
      if (serviceAccountJson) {
        certObj = JSON.parse(serviceAccountJson);
      } else {
        certObj = {
          projectId: process.env.FIREBASE_PROJECT_ID || activeConfig.projectId,
          clientEmail: adminClientEmail,
          privateKey: adminPrivateKey?.replace(/\\n/g, '\n'),
        };
      }

      adminAppInstance = initAdminApp({
        credential: cert(certObj),
      });
    } else {
      adminAppInstance = existingApps[0];
    }

    if (adminAppInstance) {
      if (activeConfig.firestoreDatabaseId) {
        try {
          adminDbInstance = getAdminFirestore(adminAppInstance, activeConfig.firestoreDatabaseId);
        } catch {
          adminDbInstance = getAdminFirestore(adminAppInstance);
        }
      } else {
        adminDbInstance = getAdminFirestore(adminAppInstance);
      }
    }
  }
} catch (err: any) {
  console.warn('[FirebaseAdmin] Admin SDK init skipped or failed:', err?.message || err);
  adminInitError = err?.message || String(err);
}

export function getDatabaseMode(): { mode: 'firebase-admin' | 'firebase-web'; error?: string | null } {
  if (adminDbInstance) {
    return { mode: 'firebase-admin' };
  }
  return {
    mode: 'firebase-web',
    error: adminInitError,
  };
}
