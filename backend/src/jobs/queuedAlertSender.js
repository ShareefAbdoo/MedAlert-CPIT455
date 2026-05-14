const cron = require('node-cron');
const { sendQueuedAlerts } = require('../services/alertService');
const logger = require('../utils/logger');

async function runQueuedAlertSender() {
  logger.info('Queued-alert sender: starting drain');
  try {
    await sendQueuedAlerts();
    logger.info('Queued-alert sender: drain complete');
  } catch (err) {
    logger.error('Queued-alert sender error', { error: err.message });
  }
}

function startQueuedAlertSender() {
  // Fire at 07:00 every day (server local time)
  cron.schedule('0 7 * * *', runQueuedAlertSender);
  logger.info('Queued-alert sender cron registered (daily at 07:00)');
}

module.exports = { startQueuedAlertSender, runQueuedAlertSender };
