import type { IncomingMessage, ServerResponse } from 'http';
import { isFirebaseAdminConfigured } from './_server.mjs';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const adminOk = isFirebaseAdminConfigured();
  res.statusCode = 200;
  res.end(
    JSON.stringify({
      ok: true,
      databaseMode: adminOk ? 'firebase-admin' : 'missing',
      time: new Date().toISOString(),
    })
  );
}
