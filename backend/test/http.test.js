const http = require('http');
const assert = require('assert');
const app = require('../src/app');

async function testHttpEndpoints() {
  console.log('--- Starting HTTP Integration Tests ---');
  let server;
  let baseUrl;
  let passed = 0;
  let failed = 0;

  function makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const req = http.request(url, {
        method: options.method || 'GET',
        headers: options.headers || {}
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const body = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode, body, headers: res.headers });
          } catch (e) {
            resolve({ status: res.statusCode, body: data, headers: res.headers });
          }
        });
      });

      req.on('error', reject);
      if (options.body) {
        req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }
      req.end();
    });
  }

  // Start temporary test server
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}:`, err.message);
      failed++;
    }
  }

  try {
    // 1. GET /
    await test('GET / returns welcome message', async () => {
      const res = await makeRequest('/');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.message, "BYJU'S Streak & Leaderboard Engine API");
    });

    // 2. GET /health
    await test('GET /health returns healthy status', async () => {
      const res = await makeRequest('/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.status, 'healthy');
    });

    // 3. POST /auth/sync without token -> 401
    await test('POST /auth/sync without auth token returns 401', async () => {
      const res = await makeRequest('/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { name: 'Test User' }
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
      assert(res.body.message.includes('missing'));
    });

    // 4. GET /profile without token -> 401
    await test('GET /profile without auth token returns 401', async () => {
      const res = await makeRequest('/profile');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
      assert(res.body.message.includes('missing'));
    });

    // 5. GET /auth/profile without token -> 401
    await test('GET /auth/profile without auth token returns 401', async () => {
      const res = await makeRequest('/auth/profile');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    // 6. Unknown route -> 404
    await test('GET /unknown-endpoint returns 404 with standard error shape', async () => {
      const res = await makeRequest('/unknown-endpoint');
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Route not found: GET /unknown-endpoint');
    });

  } finally {
    server.close();
    const redis = require('../src/config/redis');
    await redis.disconnect();
  }

  console.log(`\nHTTP Tests completed: ${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

testHttpEndpoints();
