CREATE TABLE app_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
  account TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled', 'pending')),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
);

CREATE TABLE departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
);

CREATE TABLE model_configs (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  base_url TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  UNIQUE(model, prompt_version)
);

CREATE UNIQUE INDEX one_active_model ON model_configs(status) WHERE status = 'active';

CREATE TABLE consultations (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_doctor_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  model_config_id TEXT REFERENCES model_configs(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'report_generated', 'ended', 'transferred')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'emergency')),
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
);

CREATE INDEX consultations_patient_created ON consultations(patient_id, created_at DESC);
CREATE INDEX consultations_doctor_status ON consultations(assigned_doctor_id, status);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  consultation_id TEXT NOT NULL REFERENCES consultations(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
);

CREATE INDEX messages_consultation_created ON messages(consultation_id, created_at);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  consultation_id TEXT NOT NULL UNIQUE REFERENCES consultations(id) ON DELETE RESTRICT,
  patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'emergency')),
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
);

CREATE INDEX reports_patient_created ON reports(patient_id, created_at DESC);

CREATE TABLE schedules (
  id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  remaining INTEGER NOT NULL CHECK (remaining >= 0 AND remaining <= capacity),
  status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'cancelled')),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  CHECK (start_at < end_at)
);

CREATE INDEX schedules_doctor_start ON schedules(doctor_id, start_at);
CREATE INDEX schedules_open_start ON schedules(status, start_at);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  consultation_id TEXT NOT NULL REFERENCES consultations(id) ON DELETE RESTRICT,
  patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  doctor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE RESTRICT,
  appointment_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('created', 'confirmed', 'cancelled', 'completed')),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  UNIQUE(consultation_id, doctor_id, appointment_at)
);

CREATE INDEX bookings_patient_time ON bookings(patient_id, appointment_at);
CREATE INDEX bookings_doctor_status_time ON bookings(doctor_id, status, appointment_at);

CREATE TABLE dispositions (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  doctor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  consultation_id TEXT REFERENCES consultations(id) ON DELETE RESTRICT,
  submitted_at TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
);

CREATE INDEX dispositions_patient_time ON dispositions(patient_id, submitted_at DESC);

CREATE TABLE followups (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  doctor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  due_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'cancelled')),
  abnormal INTEGER NOT NULL CHECK (abnormal IN (0, 1)),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
);

CREATE INDEX followups_patient_status_due ON followups(patient_id, status, due_at);
CREATE INDEX followups_doctor_status_due ON followups(doctor_id, status, due_at);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type TEXT NOT NULL,
  read INTEGER NOT NULL CHECK (read IN (0, 1)),
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
);

CREATE INDEX notifications_user_read_time ON notifications(user_id, read, created_at DESC);

CREATE TABLE uploads (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  consultation_id TEXT REFERENCES consultations(id) ON DELETE RESTRICT,
  stored_name TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
);

CREATE INDEX uploads_patient_time ON uploads(patient_id, created_at DESC);

CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
);

CREATE TABLE risk_rules (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  updated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
);

CREATE TABLE knowledge (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'inactive')),
  updated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
);

CREATE INDEX knowledge_status_category ON knowledge(status, category);

CREATE TABLE model_calls (
  id TEXT PRIMARY KEY,
  consultation_id TEXT REFERENCES consultations(id) ON DELETE RESTRICT,
  user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  model TEXT NOT NULL,
  success INTEGER NOT NULL CHECK (success IN (0, 1)),
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
);

CREATE INDEX model_calls_time_success ON model_calls(created_at DESC, success);

CREATE TABLE audits (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
);

CREATE INDEX audits_time ON audits(created_at DESC);
CREATE INDEX audits_action_time ON audits(action, created_at DESC);

CREATE TRIGGER audits_prevent_update
BEFORE UPDATE ON audits
BEGIN
  SELECT RAISE(ABORT, 'audit records are immutable');
END;

CREATE TRIGGER audits_prevent_delete
BEFORE DELETE ON audits
BEGIN
  SELECT RAISE(ABORT, 'audit records are immutable');
END;
