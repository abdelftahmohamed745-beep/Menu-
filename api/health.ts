import type { IncomingMessage, ServerResponse } from 'http';
import {
  testFirestoreDiagnostics,
  serverGetDocs,
  serverGetDoc,
  cleanEnvString,
} from '../src/server/db';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const missing: string[] = [];
  if (!process.env.SUPER_ADMIN_PASSWORD || !process.env.SUPER_ADMIN_PASSWORD.trim()) {
    missing.push('SUPER_ADMIN_PASSWORD');
  }
  if (!process.env.SESSION_SECRET || !process.env.SESSION_SECRET.trim()) {
    missing.push('SESSION_SECRET');
  }

  // Diagnostics
  const firestoreDiag = await testFirestoreDiagnostics();

  // Audit restaurant stats
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
      const cred = await serverGetDoc('restaurant_credentials', v.id);
      if (cred && cred.passwordHash) {
        countWithPassword++;
      } else if (v.adminPassword) {
        countWithPassword++;
      }
    }
  } catch (err) {
    console.warn('[api/health] Error counting restaurants:', err);
  }

  const rawSecret = cleanEnvString(process.env.SESSION_SECRET);
  const sessionSecretLengthValid = rawSecret.length >= 32;

  const isOk = missing.length === 0 && firestoreDiag.connected;

  res.statusCode = isOk ? 200 : 503;
  res.end(
    JSON.stringify(
      {
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
      },
      null,
      2
    )
  );
}
