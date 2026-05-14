-- MedAlert Database Schema
-- PostgreSQL

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id           SERIAL PRIMARY KEY,
  firebase_uid VARCHAR(128) UNIQUE NOT NULL,
  email        VARCHAR(255) UNIQUE NOT NULL,
  full_name    VARCHAR(255) NOT NULL,
  role         VARCHAR(20) NOT NULL CHECK (role IN ('nurse', 'doctor', 'admin')),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  totp_secret  VARCHAR(64),               -- Admin 2FA secret (encrypted at app layer)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Patients ─────────────────────────────────────────────────────────────────
CREATE TABLE patients (
  id                  SERIAL PRIMARY KEY,
  full_name           VARCHAR(255) NOT NULL,
  date_of_birth       DATE NOT NULL,
  medical_record_no   VARCHAR(64) UNIQUE NOT NULL,
  diagnosis           TEXT,
  assigned_nurse_id   INT REFERENCES users(id) ON DELETE SET NULL,
  created_by          INT REFERENCES users(id) ON DELETE SET NULL,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Medications ──────────────────────────────────────────────────────────────
CREATE TABLE medications (
  id           SERIAL PRIMARY KEY,
  patient_id   INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  dosage       NUMERIC(10,3) NOT NULL CHECK (dosage > 0),
  unit         VARCHAR(30) NOT NULL,              -- mg, ml, tablets …
  frequency    VARCHAR(64) NOT NULL,              -- human-readable: "every 8 hours"
  max_dose     NUMERIC(10,3) NOT NULL CHECK (max_dose > 0),
  route        VARCHAR(64) NOT NULL,              -- oral, IV, IM …
  start_date   DATE NOT NULL,
  end_date     DATE,
  instructions TEXT,
  created_by   INT REFERENCES users(id) ON DELETE SET NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dosage_le_max CHECK (dosage <= max_dose)
);

-- ─── Dose Schedules ───────────────────────────────────────────────────────────
CREATE TABLE dose_schedules (
  id             SERIAL PRIMARY KEY,
  medication_id  INT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'administered', 'missed', 'skipped')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dose_schedules_medication ON dose_schedules(medication_id);
CREATE INDEX idx_dose_schedules_scheduled  ON dose_schedules(scheduled_time);
CREATE INDEX idx_dose_schedules_status     ON dose_schedules(status);

-- ─── Dose Logs ────────────────────────────────────────────────────────────────
CREATE TABLE dose_logs (
  id               SERIAL PRIMARY KEY,
  dose_schedule_id INT NOT NULL REFERENCES dose_schedules(id) ON DELETE RESTRICT,
  medication_id    INT NOT NULL REFERENCES medications(id)    ON DELETE RESTRICT,
  patient_id       INT NOT NULL REFERENCES patients(id)       ON DELETE RESTRICT,
  nurse_id         INT NOT NULL REFERENCES users(id)          ON DELETE RESTRICT,
  administered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actual_dosage    NUMERIC(10,3) NOT NULL CHECK (actual_dosage > 0),
  status           VARCHAR(20) NOT NULL CHECK (status IN ('administered', 'missed', 'skipped')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dose_logs_patient    ON dose_logs(patient_id);
CREATE INDEX idx_dose_logs_nurse      ON dose_logs(nurse_id);
CREATE INDEX idx_dose_logs_scheduled  ON dose_logs(dose_schedule_id);

-- ─── Alert Logs ───────────────────────────────────────────────────────────────
CREATE TABLE alert_logs (
  id               SERIAL PRIMARY KEY,
  dose_schedule_id INT REFERENCES dose_schedules(id) ON DELETE SET NULL,
  patient_id       INT REFERENCES patients(id)       ON DELETE SET NULL,
  alert_type       VARCHAR(30) NOT NULL CHECK (alert_type IN ('missed_dose', 'overdue_dose', 'system')),
  channel          VARCHAR(20) NOT NULL CHECK (channel IN ('push', 'email', 'both')),
  recipient_id     INT REFERENCES users(id) ON DELETE SET NULL,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success          BOOLEAN NOT NULL DEFAULT TRUE,
  error_message    TEXT
);

-- ─── Audit Trail ──────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(64) NOT NULL,        -- e.g. DOSE_ADMINISTERED, PATIENT_CREATED
  entity_type VARCHAR(64),                 -- patients, medications, dose_schedules …
  entity_id   INT,
  details     JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user   ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_ts     ON audit_logs(created_at);

-- ─── FCM Tokens ───────────────────────────────────────────────────────────────
CREATE TABLE fcm_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

-- ─── Seed: default admin user (Firebase UID must be updated after first login) ─
INSERT INTO users (firebase_uid, email, full_name, role)
VALUES ('REPLACE_WITH_FIREBASE_UID', 'admin@medalert.local', 'System Admin', 'admin');
