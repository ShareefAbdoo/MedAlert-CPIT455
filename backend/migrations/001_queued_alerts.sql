-- Migration 001: Queued Alerts (Clinic Hours Awareness)
-- Run: psql -d medalert -f backend/migrations/001_queued_alerts.sql

CREATE TABLE IF NOT EXISTS queued_alerts (
  id               SERIAL PRIMARY KEY,
  dose_schedule_id INT REFERENCES dose_schedules(id) ON DELETE SET NULL,
  patient_id       INT REFERENCES patients(id)       ON DELETE SET NULL,
  nurse_id         INT REFERENCES users(id)          ON DELETE SET NULL,
  nurse_email      VARCHAR(255),
  patient_name     VARCHAR(255)  NOT NULL,
  medication_name  VARCHAR(255)  NOT NULL,
  scheduled_time   TIMESTAMPTZ   NOT NULL,
  queued_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  send_after       TIMESTAMPTZ   NOT NULL,   -- earliest time this alert may be dispatched
  sent_at          TIMESTAMPTZ,
  status           VARCHAR(20)   NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'sent', 'failed')),
  error_message    TEXT
);

CREATE INDEX IF NOT EXISTS idx_queued_alerts_status   ON queued_alerts(status);
CREATE INDEX IF NOT EXISTS idx_queued_alerts_send_after ON queued_alerts(send_after);
