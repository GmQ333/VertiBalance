CREATE TABLE risk_assessments (
  id TEXT PRIMARY KEY,
  consultation_id TEXT NOT NULL REFERENCES consultations(id) ON DELETE RESTRICT,
  rule_risk_level TEXT NOT NULL CHECK (rule_risk_level IN ('low', 'medium', 'high', 'emergency')),
  model_risk_level TEXT CHECK (model_risk_level IS NULL OR model_risk_level IN ('low', 'medium', 'high', 'emergency')),
  final_risk_level TEXT NOT NULL CHECK (final_risk_level IN ('low', 'medium', 'high', 'emergency')),
  immediate_care INTEGER NOT NULL CHECK (immediate_care IN (0, 1)),
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
);

CREATE INDEX risk_assessments_consultation_time ON risk_assessments(consultation_id, created_at DESC);
CREATE INDEX risk_assessments_final_time ON risk_assessments(final_risk_level, created_at DESC);
