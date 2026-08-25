-- ============================================================
-- ESSL ATTENDANCE MONITOR - DATABASE SCHEMA
-- Independent database. Does NOT touch eSSL TimeTrack Lite DB.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Devices ----------
CREATE TABLE IF NOT EXISTS devices (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  ip_address    VARCHAR(50) NOT NULL UNIQUE,
  port          INTEGER NOT NULL DEFAULT 4370,
  location      VARCHAR(150),
  status        VARCHAR(20) NOT NULL DEFAULT 'unknown', -- online / offline / unknown
  last_seen_at  TIMESTAMPTZ,
  last_error    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Employees ----------
CREATE TABLE IF NOT EXISTS employees (
  id                SERIAL PRIMARY KEY,
  device_user_id    VARCHAR(50) NOT NULL, -- the "uid"/enrollment id as stored on the biometric device
  employee_code     VARCHAR(50) UNIQUE,
  full_name         VARCHAR(150) NOT NULL,
  department        VARCHAR(100),
  designation       VARCHAR(100),
  email             VARCHAR(150),
  phone             VARCHAR(30),
  photo_url         TEXT,
  date_joined       DATE,
  status            VARCHAR(20) NOT NULL DEFAULT 'active', -- active / inactive
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_user_id)
);

-- ---------- Raw punch logs (as pulled from devices) ----------
CREATE TABLE IF NOT EXISTS punch_logs (
  id              BIGSERIAL PRIMARY KEY,
  device_id       INTEGER NOT NULL REFERENCES devices(id),
  device_user_id  VARCHAR(50) NOT NULL,
  employee_id     INTEGER REFERENCES employees(id),
  punch_time      TIMESTAMPTZ NOT NULL,
  punch_type      VARCHAR(10), -- IN / OUT / UNKNOWN (device dependent)
  verify_mode     VARCHAR(30), -- fingerprint / face / card / password etc (if provided)
  raw_payload     JSONB,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, device_user_id, punch_time)
);

CREATE INDEX IF NOT EXISTS idx_punch_logs_employee_time ON punch_logs (employee_id, punch_time);
CREATE INDEX IF NOT EXISTS idx_punch_logs_device_time ON punch_logs (device_id, punch_time);

-- ---------- Daily attendance summary (derived: first IN, last OUT, duration) ----------
CREATE TABLE IF NOT EXISTS daily_attendance (
  id                 BIGSERIAL PRIMARY KEY,
  employee_id        INTEGER NOT NULL REFERENCES employees(id),
  attendance_date    DATE NOT NULL,
  first_punch_in     TIMESTAMPTZ,
  last_punch_out     TIMESTAMPTZ,
  total_seconds      INTEGER NOT NULL DEFAULT 0,
  status             VARCHAR(20) NOT NULL DEFAULT 'ABSENT', -- PRESENT / ABSENT / HALF_DAY / ON_LEAVE
  is_late            BOOLEAN NOT NULL DEFAULT FALSE,
  late_by_minutes    INTEGER NOT NULL DEFAULT 0,
  is_early_departure BOOLEAN NOT NULL DEFAULT FALSE,
  early_by_minutes   INTEGER NOT NULL DEFAULT 0,
  overtime_seconds   INTEGER NOT NULL DEFAULT 0,
  late_email_sent    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_attendance_date ON daily_attendance (attendance_date);

-- ---------- Users (portal login accounts - separate from biometric employees) ----------
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'user', -- admin / manager / user
  employee_id   INTEGER REFERENCES employees(id), -- link a portal user to their own attendance record
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- System settings (feature toggles editable from Admin Portal) ----------
CREATE TABLE IF NOT EXISTS settings (
  key         VARCHAR(100) PRIMARY KEY,
  value       TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO settings (key, value) VALUES
  ('late_email_enabled', 'true'),
  ('daily_report_email_enabled', 'true'),
  ('office_start_time', '09:30'),
  ('late_grace_minutes', '10'),
  ('standard_work_hours', '8'),
  ('daily_report_send_time', '18:30'),
  ('daily_report_recipients', 'hr@example.com')
ON CONFLICT (key) DO NOTHING;

-- ---------- Email log (audit trail of notifications sent) ----------
CREATE TABLE IF NOT EXISTS email_log (
  id          BIGSERIAL PRIMARY KEY,
  type        VARCHAR(30) NOT NULL, -- LATE_ALERT / DAILY_REPORT
  recipient   VARCHAR(200) NOT NULL,
  subject     TEXT,
  employee_id INTEGER REFERENCES employees(id),
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  success     BOOLEAN NOT NULL DEFAULT TRUE,
  error       TEXT
);
