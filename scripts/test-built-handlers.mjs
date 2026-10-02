// Verification script: imports built handlers and tests them in plain Node
import pingHandler from '../api/ping.ts';
import healthHandler from '../api/health.ts';
import app from '../api/_server.mjs';

function mockReqRes(options) {
  const req = {
    method: options.method || 'GET',
    url: options.url || '/',
    headers: options.headers || {},
    body: options.body || {},
    cookies: {},
    socket: { remoteAddress: '127.0.0.1' },
    is: (type) => (options.headers?.['content-type']?.includes('json') ? true : false),
  };

  let statusCode = 200;
  let headers = {};
  let responseData = '';

  const res = {
    statusCode: 200,
    setHeader(k, v) {
      headers[k.toLowerCase()] = v;
    },
    status(code) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    json(data) {
      headers['content-type'] = 'application/json';
      responseData = JSON.stringify(data);
      return this;
    },
    end(data) {
      if (data) responseData = data;
      return this;
    },
    cookie() {},
    clearCookie() {},
  };

  return { req, res, getResult: () => ({ statusCode: res.statusCode || statusCode, headers, responseData }) };
}

async function run() {
  console.log('--- TEST 1: Calling GET /api/ping ---');
  const t1 = mockReqRes({ method: 'GET', url: '/api/ping' });
  await pingHandler(t1.req, t1.res);
  console.log('Result 1:', t1.getResult());

  console.log('\n--- TEST 2: Calling GET /api/health ---');
  const t2 = mockReqRes({ method: 'GET', url: '/api/health' });
  await healthHandler(t2.req, t2.res);
  console.log('Result 2:', t2.getResult());

  console.log('\n--- TEST 3: Calling POST /api/super-admin/login on Express app ---');
  const t3 = mockReqRes({
    method: 'POST',
    url: '/api/super-admin/login',
    headers: { 'content-type': 'application/json', 'x-requested-with': 'XMLHttpRequest' },
    body: { password: 'fake_test_password_123' },
  });

  await new Promise((resolve) => {
    app(t3.req, t3.res, () => {
      resolve();
    });
    // Wait briefly in case handled asynchronously
    setTimeout(resolve, 1000);
  });
  console.log('Result 3:', t3.getResult());
}

run().catch((err) => {
  console.error('Test script thrown error:', err);
  process.exit(1);
});
