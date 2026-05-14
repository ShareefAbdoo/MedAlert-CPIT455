const db = require('../config/database');
const audit = require('../services/auditService');
const crypto = require('crypto');

// Simple HMAC token for delete confirmation (avoids full JWT dependency)
function makeDeleteToken(medicationId, userId) {
  const payload = `${medicationId}:${userId}:${Date.now()}`;
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function verifyDeleteToken(token, medicationId, userId) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const parts = decoded.split(':');
    if (parts.length !== 4) return false;
    const [mid, uid, ts, sig] = parts;
    if (Number(mid) !== medicationId || Number(uid) !== userId) return false;
    if (Date.now() - Number(ts) > 5 * 60 * 1000) return false; // 5-minute window
    const expected = crypto.createHmac('sha256', process.env.JWT_SECRET)
      .update(`${mid}:${uid}:${ts}`).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function listMedications(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT m.*, p.full_name AS patient_name, u.full_name AS created_by_name
       FROM medications m
       JOIN patients p ON p.id = m.patient_id
       LEFT JOIN users u ON u.id = m.created_by
       ORDER BY m.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getMedication(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT m.*, p.full_name AS patient_name FROM medications m
       JOIN patients p ON p.id = m.patient_id WHERE m.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Medication not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function createMedication(req, res, next) {
  try {
    const { patientId, name, dosage, unit, frequency, maxDose, route, startDate, endDate, instructions } = req.body;

    if (parseFloat(dosage) > parseFloat(maxDose)) {
      return res.status(422).json({ error: `Dosage (${dosage}) exceeds MaxDose (${maxDose})` });
    }

    const { rows } = await db.query(
      `INSERT INTO medications (patient_id, name, dosage, unit, frequency, max_dose, route, start_date, end_date, instructions, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [patientId, name, dosage, unit, frequency, maxDose, route, startDate, endDate || null, instructions || null, req.user.id]
    );

    await audit.log({
      userId: req.user.id,
      action: 'MEDICATION_CREATED',
      entityType: 'medications',
      entityId: rows[0].id,
      details: { name, dosage, unit, maxDose, patientId },
      ipAddress: req.ip,
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function updateMedication(req, res, next) {
  try {
    const { id } = req.params;
    const { name, dosage, unit, frequency, maxDose, route, startDate, endDate, instructions, isActive } = req.body;

    if (dosage !== undefined && maxDose !== undefined && parseFloat(dosage) > parseFloat(maxDose)) {
      return res.status(422).json({ error: `Dosage (${dosage}) exceeds MaxDose (${maxDose})` });
    }

    const { rows } = await db.query(
      `UPDATE medications SET
         name         = COALESCE($1, name),
         dosage       = COALESCE($2, dosage),
         unit         = COALESCE($3, unit),
         frequency    = COALESCE($4, frequency),
         max_dose     = COALESCE($5, max_dose),
         route        = COALESCE($6, route),
         start_date   = COALESCE($7, start_date),
         end_date     = COALESCE($8, end_date),
         instructions = COALESCE($9, instructions),
         is_active    = COALESCE($10, is_active),
         updated_at   = NOW()
       WHERE id = $11 RETURNING *`,
      [name, dosage, unit, frequency, maxDose, route, startDate, endDate, instructions, isActive, id]
    );

    if (!rows.length) return res.status(404).json({ error: 'Medication not found' });

    await audit.log({
      userId: req.user.id, action: 'MEDICATION_UPDATED',
      entityType: 'medications', entityId: Number(id),
      details: req.body, ipAddress: req.ip,
    });

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function requestDeleteToken(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await db.query('SELECT id, name FROM medications WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Medication not found' });

    const token = makeDeleteToken(Number(id), req.user.id);
    res.json({
      message: 'Confirm deletion by sending DELETE with this token within 5 minutes.',
      medicationName: rows[0].name,
      confirmToken: token,
    });
  } catch (err) {
    next(err);
  }
}

async function deleteMedication(req, res, next) {
  try {
    const { id } = req.params;
    const { confirmToken } = req.body;

    if (!confirmToken) {
      return res.status(422).json({
        error: 'Double-confirmation required. First call GET /api/medications/:id/delete-token, then include confirmToken.',
      });
    }

    if (!verifyDeleteToken(confirmToken, Number(id), req.user.id)) {
      return res.status(403).json({ error: 'Invalid or expired confirmation token' });
    }

    const { rows } = await db.query(
      'UPDATE medications SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Medication not found' });

    await audit.log({
      userId: req.user.id, action: 'MEDICATION_DELETED',
      entityType: 'medications', entityId: Number(id),
      ipAddress: req.ip,
    });

    res.json({ message: 'Medication deactivated' });
  } catch (err) {
    next(err);
  }
}

async function createDoseSchedule(req, res, next) {
  try {
    const { id } = req.params;
    const { scheduledTime } = req.body;

    const { rows: med } = await db.query('SELECT id FROM medications WHERE id = $1 AND is_active = TRUE', [id]);
    if (!med.length) return res.status(404).json({ error: 'Active medication not found' });

    const { rows } = await db.query(
      `INSERT INTO dose_schedules (medication_id, scheduled_time) VALUES ($1, $2) RETURNING *`,
      [id, scheduledTime]
    );

    await audit.log({
      userId: req.user.id, action: 'DOSE_SCHEDULE_CREATED',
      entityType: 'dose_schedules', entityId: rows[0].id,
      details: { medicationId: id, scheduledTime }, ipAddress: req.ip,
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function getDoseSchedules(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT ds.*, m.name AS medication_name, p.full_name AS patient_name
       FROM dose_schedules ds
       JOIN medications m ON m.id = ds.medication_id
       JOIN patients    p ON p.id = m.patient_id
       WHERE ds.medication_id = $1
       ORDER BY ds.scheduled_time DESC`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listMedications, getMedication, createMedication, updateMedication,
  requestDeleteToken, deleteMedication, createDoseSchedule, getDoseSchedules,
};
