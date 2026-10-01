import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Locate firebase-applet-config.json safely
function loadFirebaseConfig() {
  const possiblePaths = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(__dirname, '..', '..', 'firebase-applet-config.json'),
    path.resolve(__dirname, 'firebase-applet-config.json'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        console.error('Failed to parse firebase config at', p, err);
      }
    }
  }

  // Fallback to process.env if available
  return {
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'keen-flame-j53bd',
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'keen-flame-j53bd.firebaseapp.com',
    firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID || 'ai-studio-6515c201-ec9e-4f37-b01d-e3683d1a8c6e',
  };
}

const firebaseConfig = loadFirebaseConfig();

export const serverFirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const serverDb: Firestore = getFirestore(
  serverFirebaseApp,
  firebaseConfig.firestoreDatabaseId || undefined
);
