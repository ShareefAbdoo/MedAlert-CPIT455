const db = require('../config/database');
const { getFirebaseAdmin } = require('../config/firebase');
const audit = require('../services/auditService');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const logger = require('../utils/logger');

async function registerFcmToken(req, res, next) {
  try {
    const { token } = req.body;
    if (!token) return res.status(422).json({ error: 'FCM token required' });
    await db.query(
      `INSERT INTO fcm_tokens (user_id, token) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user.id, token]
    );
    res.json({ message: 'FCM token registered' });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({
    id: req.user.id,
    email: req.user.email,
    fullName: req.user.full_name,
    role: req.user.role,
  });
}

async function setup2FA(req, res, next) {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

    const secret = authenticator.generateSecret();
    await db.query('UPDATE users SET totp_secret = $1 WHERE id = $2', [secret, req.user.id]);

    const otpAuthUrl = authenticator.keyuri(req.user.email, 'MedAlert', secret);
    const qrDataUrl = await QRCode.toDataURL(otpAuthUrl);

    await audit.log({ userId: req.user.id, action: '2FA_SETUP', ipAddress: req.ip });

    res.json({ secret, qrCode: qrDataUrl });
  } catch (err) {
    next(err);
  }
}

async function verify2FA(req, res, next) {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

    const { token } = req.body;
    if (!token) return res.status(422).json({ error: 'TOTP token required' });

    const { rows } = await db.query('SELECT totp_secret FROM users WHERE id = $1', [req.user.id]);
    if (!rows.length || !rows[0].totp_secret) {
      return res.status(400).json({ error: '2FA not set up. Call /api/auth/2fa/setup first.' });
    }

    const isValid = authenticator.verify({ token, secret: rows[0].totp_secret });
    if (!isValid) return res.status(401).json({ error: 'Invalid TOTP code' });

    await audit.log({ userId: req.user.id, action: '2FA_VERIFIED', ipAddress: req.ip });

    res.json({ verified: true, message: '2FA verified successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = { registerFcmToken, me, setup2FA, verify2FA };
