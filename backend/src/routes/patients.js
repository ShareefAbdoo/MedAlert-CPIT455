const router = require('express').Router();
const { body } = require('express-validator');
const { verifyToken, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/patientController');

router.use(verifyToken);

router.get('/', ctrl.listPatients);
router.get('/:id', ctrl.getPatient);
router.get('/:id/medications', ctrl.getPatientMedications);
router.get('/:id/dose-logs', ctrl.getPatientDoseLogs);

router.post('/',
  requireRole('admin'),
  body('fullName').notEmpty(),
  body('dateOfBirth').isISO8601(),
  body('medicalRecordNo').notEmpty(),
  validate,
  ctrl.createPatient
);

router.patch('/:id', requireRole('admin'), ctrl.updatePatient);

module.exports = router;
