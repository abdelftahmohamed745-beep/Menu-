import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

// Mock request / response helper for Vercel Serverless Function testing
function createMockReqRes(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
}) {
  const req: any = new EventEmitter();
  req.method = options.method || 'GET';
  req.url = options.url || '/';
  req.headers = options.headers || {};
  if (options.body) {
    req.body = options.body;
  }

  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    setHeader(key: string, val: string) {
      this.headers[key.toLowerCase()] = val;
    },
    getHeader(key: string) {
      return this.headers[key.toLowerCase()];
    },
    end(data?: string) {
      this.ended = true;
      this.body = data;
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
    cookie() {
      return this;
    },
  };
  Object.setPrototypeOf(res, EventEmitter.prototype);
  EventEmitter.call(res);

  return { req, res };
}

test('GET /api/ping handler returns ok:true and build id', async () => {
  const { default: pingHandler } = await import('../api/ping.ts');
  const { req, res } = createMockReqRes({ method: 'GET', url: '/api/ping' });

  await new Promise<void>((resolve) => {
    res.on('finish', resolve);
    pingHandler(req, res);
  });

  assert.equal(res.statusCode, 200);
  const json = JSON.parse(res.body);
  assert.equal(json.ok, true);
  assert.ok(json.build, 'build id must exist');
  assert.ok(json.time, 'time must exist');
  console.log('✅ GET /api/ping result:', json);
});

test('GET /api/health handler returns ok:true and databaseMode', async () => {
  const { default: healthHandler } = await import('../api/health.ts');
  const { req, res } = createMockReqRes({ method: 'GET', url: '/api/health' });

  await new Promise<void>((resolve) => {
    res.on('finish', resolve);
    healthHandler(req, res);
  });

  assert.equal(res.statusCode, 200);
  const json = JSON.parse(res.body);
  assert.equal(json.ok, true);
  assert.ok(typeof json.databaseMode === 'string', 'databaseMode must be a string');
  console.log('✅ GET /api/health result:', json);
});

test('Express app handles POST /api/super-admin/login with bad password', async () => {
  process.env.SUPER_ADMIN_PASSWORD = 'super_secret_test_123';
  process.env.SESSION_SECRET = 'session_secret_for_test_purposes_only';

  const { default: app } = await import('../api/_server.mjs');

  const { req, res } = createMockReqRes({
    method: 'POST',
    url: '/api/super-admin/login',
    headers: {
      'content-type': 'application/json',
      'x-requested-with': 'XMLHttpRequest',
    },
    body: { password: 'wrong_password_999' },
  });

  await new Promise<void>((resolve) => {
    res.on('finish', resolve);
    app(req, res);
    // Simulate req data emission if express body parser needs stream
    req.emit('data', Buffer.from(JSON.stringify({ password: 'wrong_password_999' })));
    req.emit('end');
  });

  console.log('DEBUG TEST 3 STATUS:', res.statusCode, 'BODY:', res.body);
  const json = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
  assert.equal(res.statusCode, 401);
  assert.equal(json.success, false);
  assert.equal(json.code, 'BAD_PASSWORD');
  assert.ok(json.error.includes('كلمة مرور'));
  console.log('✅ POST /api/super-admin/login (bad password) result:', json);
});

test('Express app handles POST /api/super-admin/login with correct password and Arabic digits', async () => {
  process.env.SUPER_ADMIN_PASSWORD = '123456';
  process.env.SESSION_SECRET = 'session_secret_for_test_purposes_only';

  const { default: app } = await import('../api/_server.mjs');

  // Send Arabic digits ١٢٣٤٥٦ equivalent to 123456
  const { req, res } = createMockReqRes({
    method: 'POST',
    url: '/api/super-admin/login',
    headers: {
      'content-type': 'application/json',
      'x-requested-with': 'XMLHttpRequest',
    },
    body: { password: '١٢٣٤٥٦' },
  });

  await new Promise<void>((resolve) => {
    res.on('finish', resolve);
    app(req, res);
    req.emit('data', Buffer.from(JSON.stringify({ password: '١٢٣٤٥٦' })));
    req.emit('end');
  });

  const json = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
  assert.equal(res.statusCode, 200);
  assert.equal(json.success, true);
  assert.equal(json.role, 'super_admin');
  console.log('✅ POST /api/super-admin/login (Arabic digits) result:', json);
});
