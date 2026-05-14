const { checkConnection } = require('../config/database');

async function dbGuard(req, res, next) {
  const ok = await checkConnection();
  if (!ok) {
    return res.status(503).json({
      error: 'Database is unreachable. Dose logging halted. Please contact your administrator.',
    });
  }
  next();
}

module.exports = dbGuard;
