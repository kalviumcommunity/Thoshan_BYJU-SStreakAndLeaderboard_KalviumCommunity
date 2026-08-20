const assert = require('assert');
const { verifyFirebaseToken } = require('../src/middlewares/auth.middleware');
const { errorHandler, notFoundHandler } = require('../src/middlewares/error.middleware');
const { auth } = require('../src/config/firebase');

async function runTests() {
  console.log('--- Starting Auth & Middleware Unit Tests ---');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}:`, err.message);
      failed++;
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Test notFoundHandler
  test('notFoundHandler returns 404 with standard shape', () => {
    let statusCode = null;
    let jsonBody = null;
    const req = { method: 'GET', originalUrl: '/unknown-route' };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      }
    };

    notFoundHandler(req, res, () => {});
    assert.strictEqual(statusCode, 404);
    assert.strictEqual(jsonBody.success, false);
    assert.strictEqual(jsonBody.message, 'Route not found: GET /unknown-route');
  });

  // 2. Test errorHandler
  test('errorHandler returns standard shape with correct status code', () => {
    let statusCode = null;
    let jsonBody = null;
    const err = new Error('Custom validation failed');
    err.statusCode = 400;

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      }
    };

    errorHandler(err, {}, res, () => {});
    assert.strictEqual(statusCode, 400);
    assert.strictEqual(jsonBody.success, false);
    assert.strictEqual(jsonBody.message, 'Custom validation failed');
  });

  // 3. Test verifyFirebaseToken - missing header
  await asyncTest('verifyFirebaseToken returns 401 when Authorization header is missing', async () => {
    let statusCode = null;
    let jsonBody = null;
    const req = { headers: {} };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      }
    };

    await verifyFirebaseToken(req, res, () => {});
    assert.strictEqual(statusCode, 401);
    assert.strictEqual(jsonBody.success, false);
    assert(jsonBody.message.includes('missing'));
  });

  // 4. Test verifyFirebaseToken - malformed header
  await asyncTest('verifyFirebaseToken returns 401 when header format is not Bearer', async () => {
    let statusCode = null;
    let jsonBody = null;
    const req = { headers: { authorization: 'Basic 12345' } };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      }
    };

    await verifyFirebaseToken(req, res, () => {});
    assert.strictEqual(statusCode, 401);
    assert.strictEqual(jsonBody.success, false);
    assert(jsonBody.message.includes('malformed'));
  });

  // 5. Test verifyFirebaseToken - empty token
  await asyncTest('verifyFirebaseToken returns 401 when Bearer token is empty', async () => {
    let statusCode = null;
    let jsonBody = null;
    const req = { headers: { authorization: 'Bearer   ' } };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      }
    };

    await verifyFirebaseToken(req, res, () => {});
    assert.strictEqual(statusCode, 401);
    assert.strictEqual(jsonBody.success, false);
    assert(jsonBody.message.includes('empty'));
  });

  // 6. Test verifyFirebaseToken - expired token simulation
  await asyncTest('verifyFirebaseToken handles auth/id-token-expired with TOKEN_EXPIRED code', async () => {
    let statusCode = null;
    let jsonBody = null;
    const req = { headers: { authorization: 'Bearer expired-token-sample' } };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      }
    };

    // Temporarily stub verifyIdToken to throw expired error
    const originalVerify = auth.verifyIdToken;
    auth.verifyIdToken = async () => {
      const error = new Error('Firebase ID token has expired');
      error.code = 'auth/id-token-expired';
      throw error;
    };

    try {
      await verifyFirebaseToken(req, res, () => {});
      assert.strictEqual(statusCode, 401);
      assert.strictEqual(jsonBody.success, false);
      assert.strictEqual(jsonBody.code, 'TOKEN_EXPIRED');
    } finally {
      auth.verifyIdToken = originalVerify;
    }
  });

  // 7. Test verifyFirebaseToken - revoked token simulation
  await asyncTest('verifyFirebaseToken handles auth/id-token-revoked with TOKEN_REVOKED code', async () => {
    let statusCode = null;
    let jsonBody = null;
    const req = { headers: { authorization: 'Bearer revoked-token-sample' } };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      }
    };

    const originalVerify = auth.verifyIdToken;
    auth.verifyIdToken = async () => {
      const error = new Error('Firebase ID token has been revoked');
      error.code = 'auth/id-token-revoked';
      throw error;
    };

    try {
      await verifyFirebaseToken(req, res, () => {});
      assert.strictEqual(statusCode, 401);
      assert.strictEqual(jsonBody.success, false);
      assert.strictEqual(jsonBody.code, 'TOKEN_REVOKED');
    } finally {
      auth.verifyIdToken = originalVerify;
    }
  });

  // 8. Test verifyFirebaseToken - successful verification and attachment
  await asyncTest('verifyFirebaseToken attaches user to req on success', async () => {
    const req = { headers: { authorization: 'Bearer valid-test-token' } };
    const res = {};
    let nextCalled = false;

    const originalVerify = auth.verifyIdToken;
    auth.verifyIdToken = async (token) => {
      return {
        uid: 'firebase-uid-12345',
        email: 'student@byjus.com',
        name: 'Test Student',
        email_verified: true
      };
    };

    try {
      await verifyFirebaseToken(req, res, () => {
        nextCalled = true;
      });
      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.user.uid, 'firebase-uid-12345');
      assert.strictEqual(req.user.email, 'student@byjus.com');
      assert.strictEqual(req.user.name, 'Test Student');
    } finally {
      auth.verifyIdToken = originalVerify;
    }
  });

  console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
