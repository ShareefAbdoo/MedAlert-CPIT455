const router = require('express').Router();
const { body } = require('express-validator');
const { verifyToken, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/userController');

router.use(verifyToken, requireRole('admin'));

router.get('/', ctrl.listUsers);

router.post('/',
  body('email').isEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('fullName').notEmpty(),
  body('role').isIn(['nurse', 'doctor', 'admin']),
  validate,
  ctrl.createUser
);

router.patch('/:id',
  body('role').optional().isIn(['nurse', 'doctor', 'admin']),
  body('isActive').optional().isBoolean(),
  validate,
  ctrl.updateUser
);

router.delete('/:id', ctrl.deleteUser);

module.exports = router;
