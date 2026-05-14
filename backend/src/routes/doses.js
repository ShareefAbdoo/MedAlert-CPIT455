const router = require('express').Router();
const { body } = require('express-validator');
const { verifyToken, requireRole } = require('../middleware/auth');
const dbGuard = require('../middleware/dbGuard');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/doseController');

router.use(verifyToken);

router.get('/pending',  ctrl.getPendingDoses);
router.get('/upcoming', ctrl.getUpcomingDoses);
router.get('/logs',     ctrl.getDoseLogs);

router.post('/administer',
  requireRole('nurse'),
  dbGuard,
  body('scheduleId').isInt({ min: 1 }),
  body('actualDosage').isFloat({ min: 0.001 }),
  validate,
  ctrl.administerDose
);

module.exports = router;
