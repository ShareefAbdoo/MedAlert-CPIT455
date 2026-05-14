const db = require('../config/database');
const { checkConnection, pool } = require('../config/database');
const audit = require('../services/auditService');
const logger = require('../utils/logger');

async function administerDose(req, res, next) {
  const dbOk = await checkConnection();
  if (!dbOk) {
    return res.status(503).json({
      error: 'Database is unreachable. Dose logging halted. Please contact your administrator.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { scheduleId, actualDosage, notes } = req.body;

    const { rows: sched } = await client.query(
      `SELECT ds.*, m.max_dose, m.dosage AS default_dosage, m.name AS medication_name,
              m.patient_id, p.full_name AS patient_name, p.assigned_nurse_id
       FROM dose_schedules ds
       JOIN medications m ON m.id = ds.medication_id
       JOIN patients    p ON p.id = m.patient_id
       WHERE ds.id = $1`,
      [scheduleId]
    );

    if (!sched.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Dose schedule not found' });
    }

    const schedule = sched[0];

    if (schedule.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Dose already ${schedule.status}` });
    }

    if (req.user.role === 'nurse' && schedule.assigned_nurse_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not your patient' });
    }

    const dose = parseFloat(actualDosage);
    if (dose > parseFloat(schedule.max_dose)) {
      await client.query('ROLLBACK');
      return res.status(422).json({
        error: `Dose (${dose} ${schedule.unit}) exceeds patient MaxDose (${schedule.max_dose})`,
      });
    }

    await client.query(
      "UPDATE dose_schedules SET status = 'administered' WHERE id = $1",
      [scheduleId]
    );

    const { rows: log } = await client.query(
      `INSERT INTO dose_logs
         (dose_schedule_id, medication_id, patient_id, nurse_id, actual_dosage, status, notes)
       VALUES ($1, $2, $3, $4, $5, 'administered', $6) RETURNING *`,
      [scheduleId, schedule.medication_id, schedule.patient_id, req.user.id, dose, notes || null]
    );

    await client.query('COMMIT');

    await audit.log({
      userId: req.user.id,
      action: 'DOSE_ADMINISTERED',
      entityType: 'dose_logs',
      entityId: log[0].id,
      details: {
        scheduleId,
        actualDosage: dose,
        patientId: schedule.patient_id,
        medicationId: schedule.medication_id,
      },
      ipAddress: req.ip,
    });

    res.status(201).json(log[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function getPendingDoses(req, res, next) {
  try {
    const { id: nurseId, role } = req.user;

    const baseQuery = `
      SELECT ds.id, ds.scheduled_time, ds.status,
             m.name AS medication_name, m.dosage, m.unit, m.max_dose, m.route,
             p.id AS patient_id, p.full_name AS patient_name, p.medical_record_no
      FROM dose_schedules ds
      JOIN medications m ON m.id = ds.medication_id AND m.is_active = TRUE
      JOIN patients    p ON p.id = m.patient_id AND p.is_active = TRUE
      WHERE ds.status = 'pending'
    `;

    let rows;
    if (role === 'nurse') {
      ({ rows } = await db.query(
        baseQuery + ' AND p.assigned_nurse_id = $1 ORDER BY ds.scheduled_time',
        [nurseId]
      ));
    } else {
      ({ rows } = await db.query(baseQuery + ' ORDER BY ds.scheduled_time'));
    }

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getDoseLogs(req, res, next) {
  try {
    const { patientId, nurseId, from, to } = req.query;

    const conditions = [];
    const values = [];
    let idx = 1;

    if (patientId) { conditions.push(`dl.patient_id = $${idx++}`); values.push(patientId); }
    if (nurseId)   { conditions.push(`dl.nurse_id = $${idx++}`);   values.push(nurseId); }
    if (from)      { conditions.push(`dl.administered_at >= $${idx++}`); values.push(from); }
    if (to)        { conditions.push(`dl.administered_at <= $${idx++}`); values.push(to); }

    if (req.user.role === 'nurse') {
      conditions.push(`p.assigned_nurse_id = $${idx++}`);
      values.push(req.user.id);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await db.query(
      `SELECT dl.*, m.name AS medication_name, p.full_name AS patient_name,
              u.full_name AS nurse_name
       FROM dose_logs dl
       JOIN medications m ON m.id = dl.medication_id
       JOIN patients    p ON p.id = dl.patient_id
       JOIN users       u ON u.id = dl.nurse_id
       ${where}
       ORDER BY dl.administered_at DESC LIMIT 500`,
      values
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getUpcomingDoses(req, res, next) {
  try {
    const { id: nurseId, role } = req.user;
    const hours = parseInt(req.query.hours || '4', 10);

    let rows;
    if (role === 'nurse') {
      ({ rows } = await db.query(
        `SELECT ds.id, ds.scheduled_time, ds.status,
                m.name AS medication_name, m.dosage, m.unit,
                p.id AS patient_id, p.full_name AS patient_name
         FROM dose_schedules ds
         JOIN medications m ON m.id = ds.medication_id AND m.is_active = TRUE
         JOIN patients    p ON p.id = m.patient_id AND p.is_active = TRUE
         WHERE ds.status = 'pending'
           AND p.assigned_nurse_id = $1
           AND ds.scheduled_time BETWEEN NOW() AND NOW() + ($2 || ' hours')::INTERVAL
         ORDER BY ds.scheduled_time`,
        [nurseId, hours]
      ));
    } else {
      ({ rows } = await db.query(
        `SELECT ds.id, ds.scheduled_time, ds.status,
                m.name AS medication_name, m.dosage, m.unit,
                p.id AS patient_id, p.full_name AS patient_name
         FROM dose_schedules ds
         JOIN medications m ON m.id = ds.medication_id AND m.is_active = TRUE
         JOIN patients    p ON p.id = m.patient_id AND p.is_active = TRUE
         WHERE ds.status = 'pending'
           AND ds.scheduled_time BETWEEN NOW() AND NOW() + ($1 || ' hours')::INTERVAL
         ORDER BY ds.scheduled_time`,
        [hours]
      ));
    }

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { administerDose, getPendingDoses, getDoseLogs, getUpcomingDoses };
