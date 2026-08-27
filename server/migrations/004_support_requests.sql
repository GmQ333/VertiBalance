CREATE TABLE support_requests (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  consultation_id TEXT REFERENCES consultations(id) ON DELETE RESTRICT,
  category TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'contacted', 'closed')),
  priority TEXT NOT NULL CHECK (priority IN ('normal', 'urgent')),
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
);

CREATE INDEX support_requests_patient_time ON support_requests(patient_id, created_at DESC);
CREATE INDEX support_requests_status_priority_time ON support_requests(status, priority, created_at DESC);

UPDATE app_meta SET payload_json = json_set(payload_json, '$.schemaVersion', 4) WHERE id = 1;
