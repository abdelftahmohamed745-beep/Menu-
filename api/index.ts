import type { IncomingMessage, ServerResponse } from 'http';
import app from './_server.mjs';

// Vercel Serverless Function entry point
export default function handler(req: any, res: any) {
  try {
    // 1. If body is pre-parsed by Vercel Node runtime, mark it to prevent body-parser from hanging
    if (req.body && typeof req.body === 'object') {
      req._body = true;
    } else if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
      try {
        req.body = JSON.parse(req.body);
        req._body = true;
      } catch {}
    }

    // 2. Normalize req.url if rewritten by Vercel
    const matchedPath =
      req.headers?.['x-matched-path'] ||
      req.headers?.['x-vercel-matched-path'] ||
      req.headers?.['x-forwarded-uri'];

    if (typeof matchedPath === 'string' && matchedPath.startsWith('/api/')) {
      req.url = matchedPath;
    }

    // 3. Forward to Express
    return app(req, res);
  } catch (err: any) {
    console.error('[API Serverless Error]', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          success: false,
          error: 'حدث خطأ في معالجة طلب الخادم',
          code: err?.message || 'SERVERLESS_HANDLER_ERROR',
        })
      );
    }
  }
}
