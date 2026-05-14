const { getFirebaseAdmin } = require('../config/firebase');
const db = require('../config/database');
const logger = require('../utils/logger');

async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const idToken = authHeader.slice(7);
  try {
    const admin = getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.firebaseUid = decoded.uid;
    req.userEmail = decoded.email;

    const { rows } = await db.query(
      'SELECT id, firebase_uid, email, full_name, role, is_active FROM users WHERE firebase_uid = $1',
      [decoded.uid]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'User not registered in MedAlert' });
    }

    const user = rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    req.user = user;
    next();
  } catch (err) {
    logger.warn('Token verification failed', { error: err.message });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };
