DROP TRIGGER IF EXISTS audits_prevent_update;
DROP TRIGGER IF EXISTS audits_prevent_delete;

ALTER TABLE audits ADD COLUMN previous_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE audits ADD COLUMN entry_hash TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX audits_entry_hash_unique ON audits(entry_hash) WHERE entry_hash <> '';
