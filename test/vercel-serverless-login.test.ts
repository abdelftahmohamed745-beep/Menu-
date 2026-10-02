import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';

function createMockReqRes(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
}) {
  const req: any = new Readable({
    read() {},
  });
  req.method = options.method || 'GET';
  req.url = options.url || '/';
  req.headers = options.headers || {};
  if (options.body) {
    req.body = options.body;
  }

  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    setHeader(key: string, val: string | string[]) {
      this.headers[key.toLowerCase()] = val;
    },
    getHeader(key: string) {
      return this.headers[key.toLowerCase()];
    },
    removeHeader(key: string) {
      delete this.headers[key.toLowerCase()];
    },
    end(data?: string) {
      this.ended = true;
      if (data !== undefined) this.body = data;
      this.emit('finish');
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.setHeader('content-type', 'application/json; charset=utf-8');
      this.body = JSON.stringify(data);
      this.ended = true;
      this.emit('finish');
      return this;
    },
    send(data: any) {
      this.body = data;
      this.ended = true;
      this.emit('finish');
      return this;
    },
    cookie(name: string, val: string, opts: any) {
      this.setHeader('set-cookie', `${name}=${val}; Path=${opts?.path || '/'}`);
      return this;
    },
  };
  Object.setPrototypeOf(res, EventEmitter.prototype);
  EventEmitter.call(res);

  return { req, res };
}

test('Vercel handler processes POST /api/super-admin/login with pre-parsed body and wrong password', async () => {
  const { default: handler } = await import('../api/index.ts');
  const { req, res } = createMockReqRes({
    method: 'POST',
    url: '/api/super-admin/login',
    headers: {
      'content-type': 'application/json',
      'x-requested-with': 'XMLHttpRequest',
    },
    body: { password: 'wrong_super_secret_test_password_999' },
  });

  await new Promise<void>((resolve) => {
    res.on('finish', resolve);
    handler(req, res);
  });

  assert.equal(res.statusCode, 401);
  const json = JSON.parse(res.body);
  assert.equal(json.success, false);
  assert.equal(json.code, 'BAD_PASSWORD');
});

test('Vercel handler processes POST /api with x-matched-path rewrite and correct password', async () => {
  process.env.SUPER_ADMIN_PASSWORD = 'my_super_production_pass_2026';
  // Note: SESSION_SECRET is intentionally NOT set here to verify deterministic fallback
  delete process.env.SESSION_SECRET;

  const { default: handler } = await import('../api/index.ts');
  const { req, res } = createMockReqRes({
    method: 'POST',
    url: '/api', // Vercel rewrote destination to /api
    headers: {
      'content-type': 'application/json',
      'x-requested-with': 'XMLHttpRequest',
      'x-matched-path': '/api/super-admin/login', // Vercel sets this header
    },
    body: { password: 'my_super_production_pass_2026' },
  });

  await new Promise<void>((resolve) => {
    res.on('finish', resolve);
    handler(req, res);
  });

  assert.equal(res.statusCode, 200);
  const json = JSON.parse(res.body);
  assert.equal(json.success, true);
  assert.equal(json.role, 'super_admin');
  assert.ok(res.headers['set-cookie'], 'Session cookie must be set');
});

test('Protected routes reject unauthenticated requests', async () => {
  const { default: handler } = await import('../api/index.ts');
  const { req, res } = createMockReqRes({
    method: 'GET',
    url: '/api/super-admin/restaurants',
    headers: {},
  });

  await new Promise<void>((resolve) => {
    res.on('finish', resolve);
    handler(req, res);
  });

  assert.equal(res.statusCode, 401);
  const json = JSON.parse(res.body);
  assert.equal(json.code, 'UNAUTHORIZED_SUPER_ADMIN');
});
