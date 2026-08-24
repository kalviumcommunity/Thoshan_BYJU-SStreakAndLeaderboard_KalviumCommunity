const http = require('http');
const assert = require('assert');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

async function testLocalAuthEndpoints() {
  console.log('--- Starting Local Auth (Bcrypt + JWT) Test Suite ---');
  let server;
  let baseUrl;
  let passed = 0;
  let failed = 0;

  function makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const req = http.request(
        url,
        {
          method: options.method || 'GET',
          headers: options.headers || {},
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const body = data ? JSON.parse(data) : {};
              resolve({ status: res.statusCode, body, headers: res.headers });
            } catch (e) {
              resolve({ status: res.statusCode, body: data, headers: res.headers });
            }
          });
        }
      );

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

  const testEmail = `student_${Date.now()}@byjus.com`;
  const testPassword = 'SecurePassword123!';
  let authToken = '';
  let createdUserId = '';

  try {
    // 1. Register a new user
    await test('POST /auth/register creates user with bcrypt hash & returns JWT', async () => {
      const res = await makeRequest('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          email: testEmail,
          password: testPassword,
          name: 'Aakash Student',
        },
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert(res.body.token, 'Should return JWT token');
      assert.strictEqual(res.body.user.email, testEmail.toLowerCase());
      assert.strictEqual(res.body.user.name, 'Aakash Student');
      assert.strictEqual(res.body.user.passwordHash, undefined, 'passwordHash must NEVER be returned');

      authToken = res.body.token;
      createdUserId = res.body.user.id;

      // Verify bcrypt hash in DB
      const dbUser = await prisma.user.findUnique({ where: { id: createdUserId } });
      assert(dbUser.passwordHash.startsWith('$2'), 'Stored password must be a valid bcrypt hash');
      const matches = await bcrypt.compare(testPassword, dbUser.passwordHash);
      assert.strictEqual(matches, true, 'Bcrypt compare must succeed against stored hash');
    });

    // 2. Reject duplicate registration
    await test('POST /auth/register rejects duplicate email with 409 Conflict', async () => {
      const res = await makeRequest('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          email: testEmail,
          password: testPassword,
          name: 'Duplicate Student',
        },
      });

      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.body.success, false);
      assert(res.body.message.includes('already exists'));
    });

    // 3. Reject short password
    await test('POST /auth/register rejects password shorter than 6 characters with 400 Bad Request', async () => {
      const res = await makeRequest('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          email: 'shortpass@byjus.com',
          password: '123',
        },
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert(res.body.message.includes('at least 6 characters'));
    });

    // 4. Reject invalid email format
    await test('POST /auth/register rejects invalid email with 400 Bad Request', async () => {
      const res = await makeRequest('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          email: 'not-an-email',
          password: 'ValidPassword123!',
        },
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    // 5. Successful Login
    await test('POST /auth/login with valid credentials returns 200 & JWT token', async () => {
      const res = await makeRequest('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          email: testEmail,
          password: testPassword,
        },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert(res.body.token, 'Should return JWT token');
      assert.strictEqual(res.body.user.email, testEmail.toLowerCase());
      assert.strictEqual(res.body.user.passwordHash, undefined, 'passwordHash must NEVER be returned');
      authToken = res.body.token;
    });

    // 6. Login with wrong password
    await test('POST /auth/login with wrong password returns 401 Unauthorized', async () => {
      const res = await makeRequest('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          email: testEmail,
          password: 'WrongPassword999!',
        },
      });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Invalid email or password');
    });

    // 7. Login with non-existent email
    await test('POST /auth/login with non-existent email returns 401 Unauthorized', async () => {
      const res = await makeRequest('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          email: 'doesnotexist@byjus.com',
          password: 'SomePassword123!',
        },
      });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    // 8. GET /auth/me with valid Bearer JWT
    await test('GET /auth/me with valid Bearer JWT returns current logged-in user profile', async () => {
      const res = await makeRequest('/auth/me', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.user.id, createdUserId);
      assert.strictEqual(res.body.user.email, testEmail.toLowerCase());
      assert.strictEqual(res.body.user.passwordHash, undefined);
    });

    // 9. GET /auth/me without token -> 401
    await test('GET /auth/me without Authorization header returns 401 Unauthorized', async () => {
      const res = await makeRequest('/auth/me', {
        method: 'GET',
      });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    // 10. POST /auth/logout
    await test('POST /auth/logout with valid token returns 200 OK', async () => {
      const res = await makeRequest('/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
    });
  } finally {
    server.close();
    await prisma.$disconnect();
  }

  console.log(`\nLocal Auth Tests completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

testLocalAuthEndpoints();
