require('dotenv').config();
const app = require('./app');
const { initFirebase } = require('./src/config/firebase');
const { checkConnection } = require('./src/config/database');
const { startDoseChecker } = require('./src/jobs/doseChecker');
const { startQueuedAlertSender } = require('./src/jobs/queuedAlertSender');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  const dbOk = await checkConnection();
  if (!dbOk) {
    logger.error('Cannot connect to PostgreSQL. Aborting startup.');
    process.exit(1);
  }
  logger.info('PostgreSQL connected');

  initFirebase();

  startDoseChecker();
  logger.info('Dose-checker cron started');

  startQueuedAlertSender();
  logger.info('Queued-alert sender cron started');

  const server = app.listen(PORT, () => {
    logger.info(`MedAlert API listening on port ${PORT} [${process.env.NODE_ENV}]`);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    server.close(() => process.exit(1));
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received — shutting down gracefully');
    server.close(() => process.exit(0));
  });
}

bootstrap();
