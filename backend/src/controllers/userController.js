const { getFirebaseAdmin } = require('../config/firebase');
const db = require('../config/database');
const audit = require('../services/auditService');
const logger = require('../utils/logger');

async function listUsers(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT id, firebase_uid, email, full_name, role, is_active, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const { email, password, fullName, role } = req.body;

    if (!['nurse', 'doctor', 'admin'].includes(role)) {
      return res.status(422).json({ error: 'Invalid role' });
    }

    const admin = getFirebaseAdmin();
    const firebaseUser = await admin.auth().createUser({ email, password, displayName: fullName });

    const { rows } = await db.query(
      `INSERT INTO users (firebase_uid, email, full_name, role)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [firebaseUser.uid, email, fullName, role]
    );

    await audit.log({
      userId: req.user.id,
      action: 'USER_CREATED',
      entityType: 'users',
      entityId: rows[0].id,
      details: { email, role },
      ipAddress: req.ip,
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'Email already registered in Firebase' });
    }
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { fullName, isActive, role } = req.body;

    const fields = [];
    const values = [];
    let idx = 1;

    if (fullName !== undefined) { fields.push(`full_name = $${idx++}`); values.push(fullName); }
    if (isActive !== undefined) { fields.push(`is_active = $${idx++}`); values.push(isActive); }
    if (role !== undefined) {
      if (!['nurse', 'doctor', 'admin'].includes(role)) {
        return res.status(422).json({ error: 'Invalid role' });
      }
      fields.push(`role = $${idx++}`);
      values.push(role);
    }

    if (!fields.length) return res.status(422).json({ error: 'No fields to update' });

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    await audit.log({
      userId: req.user.id,
      action: 'USER_UPDATED',
      entityType: 'users',
      entityId: Number(id),
      details: req.body,
      ipAddress: req.ip,
    });

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await db.query('SELECT firebase_uid FROM users WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const admin = getFirebaseAdmin();
    await admin.auth().deleteUser(rows[0].firebase_uid);
    await db.query('DELETE FROM users WHERE id = $1', [id]);

    await audit.log({
      userId: req.user.id,
      action: 'USER_DELETED',
      entityType: 'users',
      entityId: Number(id),
      ipAddress: req.ip,
    });

    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, createUser, updateUser, deleteUser };
