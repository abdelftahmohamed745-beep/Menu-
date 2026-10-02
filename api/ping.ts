import type { IncomingMessage, ServerResponse } from 'http';
import { BUILD_ID, BUILD_TIME } from './_buildInfo.mjs';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.statusCode = 200;
  res.end(
    JSON.stringify({
      ok: true,
      build: BUILD_ID,
      builtAt: BUILD_TIME,
      time: new Date().toISOString(),
    })
  );
}
