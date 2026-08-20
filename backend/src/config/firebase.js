const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

/**
 * Initialize Firebase Admin SDK using the best available credential source:
 * 1. File path specified by FIREBASE_SERVICE_ACCOUNT_PATH or default ./serviceAccountKey.json
 * 2. Full JSON string in FIREBASE_SERVICE_ACCOUNT_KEY
 * 3. Individual environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
 * 4. Application Default Credentials (GCP/Firebase hosting environment)
 */
function initFirebase() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  try {
    // Strategy 1: Check for service account JSON file
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.resolve(process.cwd(), 'serviceAccountKey.json');
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
    }

    // Strategy 2: Check for raw JSON string in environment variable
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

    // Strategy 3: Check for individual credential variables
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

    // Strategy 4: Fallback to Application Default Credentials (ADC)
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
    console.log('[Firebase Admin] Initialized with Application Default Credentials');
    return admin.app();
  } catch (error) {
    console.warn(
      '[Firebase Admin Warning] Could not initialize Firebase Admin SDK automatically.',
      'Please ensure you have placed your serviceAccountKey.json in the backend directory or configured .env variables.',
      `Error details: ${error.message}`
    );
    // Initialize with empty project config as fallback to prevent crash on startup if credentials are yet to be supplied
    try {
      if (admin.apps.length === 0) {
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID || 'byjus-streak-engine'
        });
      }
    } catch {
      // Ignore fallback errors
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
