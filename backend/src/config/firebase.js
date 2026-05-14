const admin = require('firebase-admin');
const path = require('path');
const logger = require('../utils/logger');

let app;

function initFirebase() {
  if (app) return app;

  try {
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      // Hosting env: full JSON stored as an env var
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      credential = admin.credential.cert(serviceAccount);
    } else {
      // Local dev: path to the JSON file
      const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(require(serviceAccountPath));
    }
    app = admin.initializeApp({ credential });
    logger.info('Firebase Admin SDK initialized');
  } catch (err) {
    logger.error('Failed to initialize Firebase Admin SDK', { error: err.message });
    throw err;
  }

  return app;
}

function getFirebaseAdmin() {
  if (!app) initFirebase();
  return admin;
}

module.exports = { initFirebase, getFirebaseAdmin };
