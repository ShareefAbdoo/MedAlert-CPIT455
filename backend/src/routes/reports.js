const router = require('express').Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/reportController');

// Doctors and admins may export reports; nurses have no access
router.use(verifyToken, requireRole('doctor', 'admin'));

router.get('/patients/:patientId',      ctrl.getReportJson);
router.get('/patients/:patientId/csv',  ctrl.getReportCsv);
router.get('/patients/:patientId/pdf',  ctrl.getReportPdf);

module.exports = router;
