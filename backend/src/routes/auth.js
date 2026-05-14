const router = require('express').Router();
const { body } = require('express-validator');
const { verifyToken } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/authController');

router.get('/me', verifyToken, ctrl.me);

router.post('/fcm-token',
  verifyToken,
  body('token').notEmpty().withMessage('token required'),
  validate,
  ctrl.registerFcmToken
);

router.post('/2fa/setup', loginLimiter, verifyToken, ctrl.setup2FA);

router.post('/2fa/verify',
  loginLimiter,
  verifyToken,
  body('token').isLength({ min: 6, max: 6 }).isNumeric().withMessage('6-digit TOTP required'),
  validate,
  ctrl.verify2FA
);

module.exports = router;
