const sgMail = require('@sendgrid/mail');
const { getFirebaseAdmin } = require('../config/firebase');
const db = require('../config/database');
const logger = require('../utils/logger');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ─── Clinic Hours ─────────────────────────────────────────────────────────────

const OPEN_HOUR  = parseInt(process.env.CLINIC_OPEN_HOUR  || '7',  10);
const CLOSE_HOUR = parseInt(process.env.CLINIC_CLOSE_HOUR || '23', 10);

function isClinicOpen(now = new Date()) {
  const h = now.getHours();
  return h >= OPEN_HOUR && h < CLOSE_HOUR;
}

/**
 * Returns the next 7AM Date. If it's currently before 7AM today, returns
 * today at 7AM; otherwise returns tomorrow at 7AM.
 */
function nextOpeningTime(now = new Date()) {
  const next = new Date(now);
  next.setSeconds(0);
  next.setMilliseconds(0);
  next.setMinutes(0);
  next.setHours(OPEN_HOUR);
  if (now.getHours() >= OPEN_HOUR) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

// ─── Low-level send helpers ───────────────────────────────────────────────────

async function getFcmTokensForUser(userId) {
  const { rows } = await db.query(
    'SELECT token FROM fcm_tokens WHERE user_id = $1',
    [userId]
  );
  return rows.map((r) => r.token);
}

async function sendPushNotification(userId, { title, body, data = {} }) {
  const tokens = await getFcmTokensForUser(userId);
  if (!tokens.length) return { success: false, reason: 'no_tokens' };

  const admin = getFirebaseAdmin();
  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
    });
    logger.info('FCM push sent', { userId, successCount: response.successCount });
    return { success: true, successCount: response.successCount };
  } catch (err) {
    logger.error('FCM push error', { error: err.message, userId });
    return { success: false, reason: err.message };
  }
}

async function sendEmailAlert(toEmail, { subject, text, html }) {
  if (!process.env.SENDGRID_API_KEY || process.env.SENDGRID_API_KEY.startsWith('SG.xxx')) {
    logger.warn('SendGrid not configured — email skipped');
    return { success: false, reason: 'not_configured' };
  }
  try {
    await sgMail.send({
      to: toEmail,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name:  process.env.SENDGRID_FROM_NAME || 'MedAlert',
      },
      subject,
      text,
      html,
    });
    logger.info('Email alert sent', { to: toEmail, subject });
    return { success: true };
  } catch (err) {
    logger.error('SendGrid error', { error: err.message, to: toEmail });
    return { success: false, reason: err.message };
  }
}

// ─── High-level: trigger a missed-dose alert immediately ─────────────────────

async function triggerMissedDoseAlert({
  scheduleId, patientName, medicationName, scheduledTime, nurseId, nurseEmail,
}) {
  const title = 'Missed Dose Alert';
  const body  = `${patientName} missed ${medicationName} scheduled at ${new Date(scheduledTime).toLocaleTimeString()}`;

  const [pushResult, emailResult] = await Promise.all([
    sendPushNotification(nurseId, {
      title, body,
      data: { type: 'missed_dose', scheduleId: String(scheduleId) },
    }),
    sendEmailAlert(nurseEmail, {
      subject: `⚠️ Missed Dose: ${patientName} — ${medicationName}`,
      text:    body,
      html: `
        <h2 style="color:#c0392b;font-family:sans-serif">Missed Dose Alert</h2>
        <p style="font-family:sans-serif"><strong>Patient:</strong> ${patientName}</p>
        <p style="font-family:sans-serif"><strong>Medication:</strong> ${medicationName}</p>
        <p style="font-family:sans-serif"><strong>Scheduled:</strong> ${new Date(scheduledTime).toLocaleString()}</p>
        <p style="font-family:sans-serif">Please review in MedAlert immediately.</p>`,
    }),
  ]);

  await db.query(
    `INSERT INTO alert_logs
       (dose_schedule_id, alert_type, channel, recipient_id, success, error_message)
     VALUES ($1, 'missed_dose', 'both', $2, $3, $4)`,
    [
      scheduleId,
      nurseId,
      pushResult.success || emailResult.success,
      (!pushResult.success ? pushResult.reason : null) ||
      (!emailResult.success ? emailResult.reason : null),
    ]
  );

  return { pushResult, emailResult };
}

// ─── Queue an alert for delivery at next clinic opening ──────────────────────

async function queueAlert({
  scheduleId, patientId, nurseId, nurseEmail,
  patientName, medicationName, scheduledTime,
}) {
  const sendAfter = nextOpeningTime();
  await db.query(
    `INSERT INTO queued_alerts
       (dose_schedule_id, patient_id, nurse_id, nurse_email,
        patient_name, medication_name, scheduled_time, send_after)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      scheduleId, patientId, nurseId, nurseEmail,
      patientName, medicationName, scheduledTime, sendAfter,
    ]
  );
  logger.info('Alert queued (clinic closed)', {
    scheduleId,
    patientName,
    sendAfter: sendAfter.toISOString(),
  });
}

// ─── Dispatch or queue based on clinic hours ──────────────────────────────────

async function dispatchOrQueueAlert(alertPayload) {
  if (isClinicOpen()) {
    return triggerMissedDoseAlert(alertPayload);
  }
  await queueAlert({
    scheduleId:     alertPayload.scheduleId,
    patientId:      alertPayload.patientId,
    nurseId:        alertPayload.nurseId,
    nurseEmail:     alertPayload.nurseEmail,
    patientName:    alertPayload.patientName,
    medicationName: alertPayload.medicationName,
    scheduledTime:  alertPayload.scheduledTime,
  });
  return { queued: true };
}

// ─── Drain the queue (called by the 7AM cron) ─────────────────────────────────

async function sendQueuedAlerts() {
  const { rows: pending } = await db.query(
    `SELECT * FROM queued_alerts
     WHERE status = 'pending' AND send_after <= NOW()
     ORDER BY queued_at ASC`
  );

  if (!pending.length) {
    logger.info('No queued alerts to send');
    return;
  }

  logger.info(`Sending ${pending.length} queued alert(s)`);

  for (const alert of pending) {
    try {
      await triggerMissedDoseAlert({
        scheduleId:     alert.dose_schedule_id,
        patientName:    alert.patient_name,
        medicationName: alert.medication_name,
        scheduledTime:  alert.scheduled_time,
        nurseId:        alert.nurse_id,
        nurseEmail:     alert.nurse_email,
      });

      await db.query(
        `UPDATE queued_alerts SET status = 'sent', sent_at = NOW() WHERE id = $1`,
        [alert.id]
      );
    } catch (err) {
      logger.error('Failed to send queued alert', { alertId: alert.id, error: err.message });
      await db.query(
        `UPDATE queued_alerts SET status = 'failed', error_message = $1 WHERE id = $2`,
        [err.message, alert.id]
      );
    }
  }
}

module.exports = {
  isClinicOpen,
  nextOpeningTime,
  sendPushNotification,
  sendEmailAlert,
  triggerMissedDoseAlert,
  dispatchOrQueueAlert,
  sendQueuedAlerts,
};
