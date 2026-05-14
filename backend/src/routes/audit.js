const router = require('express').Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/auditController');

router.use(verifyToken, requireRole('admin'));
router.get('/', ctrl.getAuditLogs);

module.exports = router;
