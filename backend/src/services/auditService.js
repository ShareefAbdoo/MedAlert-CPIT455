const db = require('../config/database');
const logger = require('../utils/logger');

async function log({ userId, action, entityType, entityId, details, ipAddress }) {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId ?? null, action, entityType ?? null, entityId ?? null, details ? JSON.stringify(details) : null, ipAddress ?? null]
    );
  } catch (err) {
    logger.error('Failed to write audit log', { error: err.message, action, entityType, entityId });
  }
}

module.exports = { log };
