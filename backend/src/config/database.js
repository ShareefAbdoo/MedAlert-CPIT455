const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // Supabase (and most hosted Postgres providers) require SSL
  ssl: process.env.DATABASE_URL?.includes('supabase')
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { error: err.message });
});

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    logger.debug('DB query', { duration: Date.now() - start, rows: res.rowCount });
    return res;
  } catch (err) {
    logger.error('DB query error', { error: err.message, query: text });
    throw err;
  }
}

async function checkConnection() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

module.exports = { query, pool, checkConnection };
