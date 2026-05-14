const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    user: req.user?.id,
  });

  if (err.code === 'ECONNREFUSED' || err.code === '57P03') {
    return res.status(503).json({
      error: 'Database unavailable. Dose logging is halted. Please contact support.',
    });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
