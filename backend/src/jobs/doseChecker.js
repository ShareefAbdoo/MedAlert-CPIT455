const cron = require('node-cron');
const db = require('../config/database');
const { dispatchOrQueueAlert, isClinicOpen } = require('../services/alertService');
const logger = require('../utils/logger');

async function checkMissedDoses() {
  const graceMinutes = parseInt(process.env.ALERT_GRACE_MINUTES || '15', 10);

  try {
    const { rows: overdue } = await db.query(
      `SELECT
         ds.id           AS schedule_id,
         ds.scheduled_time,
         ds.medication_id,
         m.name          AS medication_name,
         m.patient_id,
         p.full_name     AS patient_name,
         p.assigned_nurse_id AS nurse_id,
         u.email         AS nurse_email
       FROM dose_schedules ds
       JOIN medications m  ON m.id = ds.medication_id
       JOIN patients    p  ON p.id = m.patient_id
       LEFT JOIN users  u  ON u.id = p.assigned_nurse_id
       WHERE ds.status = 'pending'
         AND ds.scheduled_time < NOW() - ($1 || ' minutes')::INTERVAL`,
      [graceMinutes]
    );

    if (!overdue.length) return;

    const clinicOpen = isClinicOpen();
    logger.info(`Dose checker: ${overdue.length} overdue dose(s) — clinic ${clinicOpen ? 'OPEN (alerting now)' : 'CLOSED (queueing)'}`);

    for (const row of overdue) {
      await db.query(
        "UPDATE dose_schedules SET status = 'missed' WHERE id = $1",
        [row.schedule_id]
      );

      if (row.nurse_id) {
        await dispatchOrQueueAlert({
          scheduleId:     row.schedule_id,
          patientId:      row.patient_id,
          patientName:    row.patient_name,
          medicationName: row.medication_name,
          scheduledTime:  row.scheduled_time,
          nurseId:        row.nurse_id,
          nurseEmail:     row.nurse_email,
        });
      }
    }
  } catch (err) {
    logger.error('Dose checker error', { error: err.message });
  }
}

function startDoseChecker() {
  cron.schedule('* * * * *', checkMissedDoses);
  logger.info('Dose checker cron registered (every minute)');
}

module.exports = { startDoseChecker, checkMissedDoses };
