const db = require('../config/database');
const audit = require('../services/auditService');

async function listPatients(req, res, next) {
  try {
    const { role, id: userId } = req.user;
    let rows;

    if (role === 'nurse') {
      ({ rows } = await db.query(
        `SELECT p.*, u.full_name AS nurse_name
         FROM patients p LEFT JOIN users u ON u.id = p.assigned_nurse_id
         WHERE p.assigned_nurse_id = $1 AND p.is_active = TRUE
         ORDER BY p.full_name`,
        [userId]
      ));
    } else {
      ({ rows } = await db.query(
        `SELECT p.*, u.full_name AS nurse_name
         FROM patients p LEFT JOIN users u ON u.id = p.assigned_nurse_id
         WHERE p.is_active = TRUE ORDER BY p.full_name`
      ));
    }
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getPatient(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT p.*, u.full_name AS nurse_name
       FROM patients p LEFT JOIN users u ON u.id = p.assigned_nurse_id
       WHERE p.id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Patient not found' });

    if (req.user.role === 'nurse' && rows[0].assigned_nurse_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your patient' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function createPatient(req, res, next) {
  try {
    const { fullName, dateOfBirth, medicalRecordNo, diagnosis, assignedNurseId } = req.body;
    const { rows } = await db.query(
      `INSERT INTO patients (full_name, date_of_birth, medical_record_no, diagnosis, assigned_nurse_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [fullName, dateOfBirth, medicalRecordNo, diagnosis || null, assignedNurseId || null, req.user.id]
    );

    await audit.log({
      userId: req.user.id,
      action: 'PATIENT_CREATED',
      entityType: 'patients',
      entityId: rows[0].id,
      details: { fullName, medicalRecordNo },
      ipAddress: req.ip,
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Medical record number already exists' });
    }
    next(err);
  }
}

async function updatePatient(req, res, next) {
  try {
    const { id } = req.params;
    const { fullName, dateOfBirth, diagnosis, assignedNurseId, isActive } = req.body;

    const { rows } = await db.query(
      `UPDATE patients
       SET full_name = COALESCE($1, full_name),
           date_of_birth = COALESCE($2, date_of_birth),
           diagnosis = COALESCE($3, diagnosis),
           assigned_nurse_id = COALESCE($4, assigned_nurse_id),
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [fullName, dateOfBirth, diagnosis, assignedNurseId, isActive, id]
    );

    if (!rows.length) return res.status(404).json({ error: 'Patient not found' });

    await audit.log({
      userId: req.user.id,
      action: 'PATIENT_UPDATED',
      entityType: 'patients',
      entityId: Number(id),
      details: req.body,
      ipAddress: req.ip,
    });

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function getPatientMedications(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT m.*, u.full_name AS created_by_name
       FROM medications m LEFT JOIN users u ON u.id = m.created_by
       WHERE m.patient_id = $1 AND m.is_active = TRUE
       ORDER BY m.created_at DESC`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getPatientDoseLogs(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT dl.*, m.name AS medication_name, u.full_name AS nurse_name
       FROM dose_logs dl
       JOIN medications m ON m.id = dl.medication_id
       JOIN users      u  ON u.id = dl.nurse_id
       WHERE dl.patient_id = $1
       ORDER BY dl.administered_at DESC
       LIMIT 200`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { listPatients, getPatient, createPatient, updatePatient, getPatientMedications, getPatientDoseLogs };
