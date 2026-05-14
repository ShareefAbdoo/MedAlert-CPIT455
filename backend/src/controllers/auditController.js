const db = require('../config/database');

async function getAuditLogs(req, res, next) {
  try {
    const { userId, action, entityType, from, to, limit = 100, offset = 0 } = req.query;

    const conditions = [];
    const values = [];
    let idx = 1;

    if (userId)     { conditions.push(`al.user_id = $${idx++}`);     values.push(userId); }
    if (action)     { conditions.push(`al.action ILIKE $${idx++}`);  values.push(`%${action}%`); }
    if (entityType) { conditions.push(`al.entity_type = $${idx++}`); values.push(entityType); }
    if (from)       { conditions.push(`al.created_at >= $${idx++}`); values.push(from); }
    if (to)         { conditions.push(`al.created_at <= $${idx++}`); values.push(to); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    values.push(Math.min(parseInt(limit, 10), 500));
    values.push(parseInt(offset, 10));

    const { rows } = await db.query(
      `SELECT al.*, u.full_name AS user_name, u.role AS user_role
       FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      values
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAuditLogs };
