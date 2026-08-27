const admin = require('firebase-admin');

/**
 * Initialize Firebase Admin SDK using the best available credential source:
 * 1. Full JSON string in FIREBASE_SERVICE_ACCOUNT_KEY (env var)
 * 2. Individual environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
 * 3. File path specified by FIREBASE_SERVICE_ACCOUNT_PATH (local dev only)
 * 4. Application Default Credentials (GCP/Firebase hosting environment)
 *
 * In Docker, FIREBASE_SERVICE_ACCOUNT_PATH is set to "" so file strategy is skipped.
 * If no credentials are found in production, an error is thrown at startup.
 */
function initFirebase() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  try {
    // Strategy 1: Check for raw JSON string in environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      let keyData = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
      // Handle potential base64 encoded JSON
      if (!keyData.startsWith('{')) {
        keyData = Buffer.from(keyData, 'base64').toString('utf8');
      }
      const serviceAccount = JSON.parse(keyData);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('[Firebase Admin] Initialized with FIREBASE_SERVICE_ACCOUNT_KEY JSON string');
      return admin.app();
    }

    // Strategy 2: Individual credential environment variables (preferred for Docker/cloud)
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey
        })
      });
      console.log('[Firebase Admin] Initialized with discrete environment variables');
      return admin.app();
    }

    // Strategy 3: File path (local development only — skipped when path is empty)
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (serviceAccountPath && serviceAccountPath.trim() !== '') {
      const path = require('path');
      const fs = require('fs');
      const resolvedPath = path.isAbsolute(serviceAccountPath)
        ? serviceAccountPath
        : path.resolve(process.cwd(), serviceAccountPath);

      if (fs.existsSync(resolvedPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log(`[Firebase Admin] Initialized with service account file: ${resolvedPath}`);
        return admin.app();
      } else {
        console.warn(`[Firebase Admin] Service account file not found at: ${resolvedPath}`);
      }
    }

    // Strategy 4: Application Default Credentials (GCP environments)
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
    console.log('[Firebase Admin] Initialized with Application Default Credentials');
    return admin.app();

  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[Firebase Admin] FATAL: Could not initialize Firebase Admin SDK.',
        'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.',
        `Error: ${error.message}`
      );
    } else {
      console.warn(
        '[Firebase Admin] Could not initialize Firebase Admin SDK.',
        'Firebase-authenticated routes will not work.',
        `Error: ${error.message}`
      );
    }

    // Graceful degradation: initialize with project ID only so server starts
    try {
      if (admin.apps.length === 0) {
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID || 'byjus-streak-engine'
        });
      }
    } catch {
      // Ignore secondary errors
    }
    return admin.app();
  }
}

initFirebase();

const auth = admin.auth();

module.exports = {
  admin,
  auth
};
