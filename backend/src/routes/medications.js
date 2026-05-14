const router = require('express').Router();
const { body } = require('express-validator');
const { verifyToken, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/medicationController');

router.use(verifyToken);

router.get('/', ctrl.listMedications);
router.get('/:id', ctrl.getMedication);
router.get('/:id/schedules', ctrl.getDoseSchedules);

router.post('/',
  requireRole('admin'),
  body('patientId').isInt({ min: 1 }),
  body('name').notEmpty(),
  body('dosage').isFloat({ min: 0.001 }),
  body('unit').notEmpty(),
  body('frequency').notEmpty(),
  body('maxDose').isFloat({ min: 0.001 }),
  body('route').notEmpty(),
  body('startDate').isISO8601(),
  validate,
  ctrl.createMedication
);

router.patch('/:id', requireRole('admin'), ctrl.updateMedication);

router.get('/:id/delete-token', requireRole('admin'), ctrl.requestDeleteToken);

router.delete('/:id',
  requireRole('admin'),
  body('confirmToken').notEmpty().withMessage('confirmToken required for double-confirmation'),
  validate,
  ctrl.deleteMedication
);

router.post('/:id/schedules',
  requireRole('admin'),
  body('scheduledTime').isISO8601(),
  validate,
  ctrl.createDoseSchedule
);

module.exports = router;
