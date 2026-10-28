/**
 * Integration tests: HTTP layer verification (no live database required)
 *
 * NODE_ENV=test causes server.js to skip connectDB, so no MongoDB connection
 * is needed. Tests verify:
 *   - Health endpoint structure
 *   - Input validation 400s that trigger before any DB lookup
 *   - Authentication middleware 401s on protected routes
 *   - Route 404 for unknown paths
 *
 * Run: node --test tests/api.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// Simple HTTP helper
function req(path, { method = 'GET', body, token } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const options = {
      hostname: '127.0.0.1',
      port: 5099,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const r = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

let srv;

test.before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '5099';
  process.env.JWT_SECRET = 'test_secret_that_is_at_least_32_chars_long!!';
  process.env.JWT_EXPIRES_IN = '1h';
  const mod = await import('../server.js');
  srv = mod.server;
  await new Promise((res) => srv.listen(5099, '127.0.0.1', res));
});

test.after(async () => {
  await new Promise((res) => srv.close(res));
});

// ── Health ─────────────────────────────────────────────────────────────
test('GET /api/health → 200 with expected shape', async () => {
  const r = await req('/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
  assert.equal(r.body.status, 'ok');
  assert.equal(r.body.service, 'hospital-opd-api');
  assert.ok(typeof r.body.timestamp === 'string', 'timestamp should be a string');
});

// ── Auth input validation (no DB call needed for these) ────────────────
test('POST /api/auth/login with empty body → 400', async () => {
  const r = await req('/api/auth/login', { method: 'POST', body: {} });
  assert.equal(r.status, 400);
  assert.equal(r.body.success, false);
});

test('POST /api/auth/register with missing name → 400', async () => {
  const r = await req('/api/auth/register', {
    method: 'POST',
    body: { email: 'test@example.com', password: 'ValidPass1!' },
  });
  assert.equal(r.status, 400);
  assert.equal(r.body.success, false);
});

test('POST /api/auth/register with invalid email → 400', async () => {
  const r = await req('/api/auth/register', {
    method: 'POST',
    body: { name: 'Test', email: 'bad-email', password: 'ValidPass1!' },
  });
  assert.equal(r.status, 400);
  assert.equal(r.body.success, false);
});

test('POST /api/auth/register with short password → 400', async () => {
  const r = await req('/api/auth/register', {
    method: 'POST',
    body: { name: 'Test', email: 'test@example.com', password: 'abc' },
  });
  assert.equal(r.status, 400);
  assert.equal(r.body.success, false);
});

// ── Auth middleware: protected routes return 401 without token ─────────
const protectedRoutes = [
  '/api/queue',
  '/api/departments',
  '/api/patients',
  '/api/beds',
  '/api/wards',
  '/api/staff',
  '/api/notifications',
  '/api/auth/me',
  '/api/dashboard/admin',
];

for (const route of protectedRoutes) {
  test(`GET ${route} without token → 401`, async () => {
    const r = await req(route);
    assert.equal(r.status, 401, `Expected 401 for ${route}, got ${r.status}`);
    assert.equal(r.body.success, false);
  });
}

test('GET /api/auth/me with malformed token → 401', async () => {
  const r = await req('/api/auth/me', { token: 'bad.token.here' });
  assert.equal(r.status, 401);
  assert.equal(r.body.success, false);
});

// ── 404 for unknown routes ─────────────────────────────────────────────
test('GET /api/unknown-route → 404', async () => {
  const r = await req('/api/unknown-route-xyz');
  assert.equal(r.status, 404);
  assert.equal(r.body.success, false);
});
