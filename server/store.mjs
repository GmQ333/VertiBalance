import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createSeedData } from './seed.mjs';

const clone = (value) => structuredClone(value);
const migrationsDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

const entityDefinitions = [
  { key: 'users', table: 'users', columns: { role: (v) => v.role, account: (v) => v.account, phone: (v) => v.phone, password_hash: (v) => v.passwordHash, status: (v) => v.status } },
  { key: 'departments', table: 'departments', columns: { name: (v) => v.name, enabled: (v) => Number(v.enabled !== false) } },
  { key: 'modelConfigs', table: 'model_configs', columns: { model: (v) => v.model, base_url: (v) => v.baseUrl, prompt_version: (v) => v.promptVersion, status: (v) => v.status } },
  { key: 'consultations', table: 'consultations', columns: { patient_id: (v) => v.patientId, assigned_doctor_id: (v) => v.assignedDoctorId || null, model_config_id: (v) => v.modelConfigId || null, status: (v) => v.status, risk_level: (v) => v.riskLevel, created_at: (v) => v.createdAt } },
  { key: 'messages', table: 'messages', columns: { consultation_id: (v) => v.consultationId, role: (v) => v.role, created_at: (v) => v.createdAt } },
  { key: 'reports', table: 'reports', columns: { consultation_id: (v) => v.consultationId, patient_id: (v) => v.patientId, risk_level: (v) => v.riskLevel, created_at: (v) => v.createdAt } },
  { key: 'riskAssessments', table: 'risk_assessments', columns: { consultation_id: (v) => v.consultationId, rule_risk_level: (v) => v.ruleRiskLevel, model_risk_level: (v) => v.modelRiskLevel || null, final_risk_level: (v) => v.finalRiskLevel, immediate_care: (v) => Number(Boolean(v.immediateCare)), created_at: (v) => v.createdAt } },
  { key: 'schedules', table: 'schedules', columns: { doctor_id: (v) => v.doctorId, department_id: (v) => v.departmentId, start_at: (v) => v.startAt, end_at: (v) => v.endAt, capacity: (v) => v.capacity, remaining: (v) => v.remaining, status: (v) => v.status } },
  { key: 'bookings', table: 'bookings', columns: { consultation_id: (v) => v.consultationId, patient_id: (v) => v.patientId, doctor_id: (v) => v.doctorId, schedule_id: (v) => v.scheduleId, appointment_at: (v) => v.appointmentAt, status: (v) => v.status } },
  { key: 'dispositions', table: 'dispositions', columns: { patient_id: (v) => v.patientId, doctor_id: (v) => v.doctorId, consultation_id: (v) => v.consultationId || null, submitted_at: (v) => v.submittedAt } },
  { key: 'followups', table: 'followups', columns: { patient_id: (v) => v.patientId, doctor_id: (v) => v.doctorId, due_at: (v) => v.dueAt, status: (v) => v.status, abnormal: (v) => Number(Boolean(v.abnormal)) } },
  { key: 'notifications', table: 'notifications', columns: { user_id: (v) => v.userId, type: (v) => v.type, read: (v) => Number(Boolean(v.read)), created_at: (v) => v.createdAt } },
  { key: 'uploads', table: 'uploads', columns: { patient_id: (v) => v.patientId, consultation_id: (v) => v.consultationId || null, stored_name: (v) => v.storedName, mime_type: (v) => v.mimeType, created_at: (v) => v.createdAt } },
  { key: 'feedback', table: 'feedback', columns: { user_id: (v) => v.userId, role: (v) => v.role, rating: (v) => v.rating, status: (v) => v.status, created_at: (v) => v.createdAt } },
  { key: 'supportRequests', table: 'support_requests', columns: { patient_id: (v) => v.patientId, consultation_id: (v) => v.consultationId || null, category: (v) => v.category, status: (v) => v.status, priority: (v) => v.priority, created_at: (v) => v.createdAt } },
  { key: 'riskRules', table: 'risk_rules', columns: { label: (v) => v.label, enabled: (v) => Number(Boolean(v.enabled)), updated_at: (v) => v.updatedAt } },
  { key: 'knowledge', table: 'knowledge', columns: { category: (v) => v.category, title: (v) => v.title, status: (v) => v.status, updated_at: (v) => v.updatedAt } },
  { key: 'modelCalls', table: 'model_calls', columns: { consultation_id: (v) => v.consultationId || null, user_id: (v) => v.userId || null, model: (v) => v.model, success: (v) => Number(Boolean(v.success)), created_at: (v) => v.createdAt } },
  { key: 'audits', table: 'audits', immutable: true, columns: { actor_id: (v) => v.actorId, action: (v) => v.action, object_type: (v) => v.objectType, object_id: (v) => v.objectId, status: (v) => v.status, created_at: (v) => v.createdAt } },
];

const json = (value) => JSON.stringify(value);
const parseJson = (value) => JSON.parse(value);
const auditHash = (previousHash, payload) => crypto.createHash('sha256').update(`${previousHash}\n${payload}`).digest('hex');
const auditTriggersSql = `
  CREATE TRIGGER IF NOT EXISTS audits_prevent_update
  BEFORE UPDATE ON audits
  BEGIN
    SELECT RAISE(ABORT, 'audit records are immutable');
  END;
  CREATE TRIGGER IF NOT EXISTS audits_prevent_delete
  BEFORE DELETE ON audits
  BEGIN
    SELECT RAISE(ABORT, 'audit records are immutable');
  END;
`;

export class SqliteStore {
  constructor(filePath, { legacyFilePath = null } = {}) {
    this.engine = 'sqlite';
    this.filePath = filePath;
    this.legacyFilePath = legacyFilePath;
    this.database = null;
    this.queue = Promise.resolve();
  }

  async init() {
    if (this.filePath !== ':memory:') {
      const directory = path.dirname(this.filePath);
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      await fs.chmod(directory, 0o700);
    }
    this.database = new DatabaseSync(this.filePath);
    this.database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = FULL;');
    if (this.filePath !== ':memory:') this.database.exec('PRAGMA journal_mode = WAL;');
    if (this.filePath !== ':memory:') {
      await fs.chmod(this.filePath, 0o600);
      await Promise.all(['-wal', '-shm'].map((suffix) => fs.chmod(`${this.filePath}${suffix}`, 0o600).catch((error) => { if (error.code !== 'ENOENT') throw error; })));
    }
    await this.runMigrations();
    if (!this.database.prepare('SELECT 1 AS present FROM app_meta WHERE id = 1').get()) {
      const initial = await this.readLegacyData() || createSeedData();
      this.replaceAll(initial);
    }
    this.backfillRiskAssessments();
    this.restoreEmergencyRiskLevels();
    this.ensureAuditChain();
    return this;
  }

  async runMigrations() {
    this.database.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);');
    const applied = new Set(this.database.prepare('SELECT version FROM schema_migrations').all().map((row) => row.version));
    const files = (await fs.readdir(migrationsDirectory)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(migrationsDirectory, file), 'utf8');
      this.database.exec('BEGIN IMMEDIATE;');
      try {
        this.database.exec(sql);
        this.database.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(file, new Date().toISOString());
        this.database.exec('COMMIT;');
      } catch (error) {
        this.database.exec('ROLLBACK;');
        throw error;
      }
    }
  }

  async readLegacyData() {
    if (!this.legacyFilePath) return null;
    try { return JSON.parse(await fs.readFile(this.legacyFilePath, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }

  replaceAll(data) {
    this.database.exec('BEGIN IMMEDIATE;');
    try {
      this.database.prepare('INSERT INTO app_meta(id, payload_json) VALUES (1, ?)').run(json(data.meta || { schemaVersion: 1 }));
      this.persistChanges(Object.fromEntries(entityDefinitions.map(({ key }) => [key, []])), data);
      this.database.exec('COMMIT;');
    } catch (error) {
      this.database.exec('ROLLBACK;');
      throw error;
    }
  }

  snapshot(keys = entityDefinitions.map(({ key }) => key)) {
    if (!this.database) throw new Error('Store has not been initialized');
    return clone(this.readSnapshot(keys));
  }

  readSnapshot(keys = entityDefinitions.map(({ key }) => key)) {
    const metaRow = this.database.prepare('SELECT payload_json FROM app_meta WHERE id = 1').get();
    const data = { meta: metaRow ? parseJson(metaRow.payload_json) : {} };
    const selected = new Set(keys);
    for (const definition of entityDefinitions.filter(({ key }) => selected.has(key))) {
      data[definition.key] = this.database.prepare(`SELECT payload_json FROM ${definition.table} ORDER BY rowid`).all().map((row) => parseJson(row.payload_json));
    }
    return data;
  }

  async transaction(collectionsOrMutator, optionalMutator) {
    const mutator = typeof collectionsOrMutator === 'function' ? collectionsOrMutator : optionalMutator;
    const keys = typeof collectionsOrMutator === 'function' ? entityDefinitions.map(({ key }) => key) : [...new Set(collectionsOrMutator)];
    if (typeof mutator !== 'function') throw new TypeError('A transaction mutator function is required');
    const unknown = keys.filter((key) => !entityDefinitions.some((definition) => definition.key === key));
    if (unknown.length) throw new Error(`Unknown transaction collections: ${unknown.join(', ')}`);
    const operation = this.queue.then(async () => {
      this.database.exec('BEGIN IMMEDIATE;');
      try {
        const before = this.readSnapshot(keys);
        const draft = clone(before);
        const mutation = mutator(draft);
        if (mutation && typeof mutation.then === 'function') { void mutation.catch(() => undefined); throw new Error('Async work is not allowed inside a database transaction'); }
        const result = mutation;
        this.persistChanges(before, draft, keys);
        this.database.exec('COMMIT;');
        return clone(result);
      } catch (error) {
        this.database.exec('ROLLBACK;');
        throw error;
      }
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  persistChanges(before, after, keys = entityDefinitions.map(({ key }) => key)) {
    if (json(before.meta || {}) !== json(after.meta || {})) {
      this.database.prepare('INSERT INTO app_meta(id, payload_json) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json').run(json(after.meta || {}));
    }
    const selected = new Set(keys);
    const definitions = entityDefinitions.filter(({ key }) => selected.has(key));
    for (const definition of definitions) this.upsertChanged(definition, before[definition.key] || [], after[definition.key] || []);
    for (const definition of [...definitions].reverse()) this.deleteRemoved(definition, before[definition.key] || [], after[definition.key] || []);
  }

  upsertChanged(definition, before, after) {
    const previous = new Map(before.map((item) => [item.id, json(item)]));
    const columnNames = Object.keys(definition.columns);
    if (definition.immutable) {
      const statement = this.database.prepare(`INSERT INTO ${definition.table}(id, ${columnNames.join(', ')}, payload_json, previous_hash, entry_hash) VALUES (${['?', ...columnNames.map(() => '?'), '?', '?', '?'].join(', ')})`);
      let previousHash = this.database.prepare('SELECT entry_hash FROM audits ORDER BY rowid DESC LIMIT 1').get()?.entry_hash || '';
      for (const item of after) {
        const payload = json(item);
        if (previous.get(item.id) === payload) continue;
        if (previous.has(item.id)) throw new Error(`Immutable ${definition.key} entry cannot be modified: ${item.id}`);
        const entryHash = auditHash(previousHash, payload);
        statement.run(item.id, ...columnNames.map((column) => definition.columns[column](item)), payload, previousHash, entryHash);
        previousHash = entryHash;
      }
      return;
    }
    const placeholders = ['?', ...columnNames.map(() => '?'), '?'].join(', ');
    const updates = [...columnNames, 'payload_json'].map((column) => `${column} = excluded.${column}`).join(', ');
    const statement = this.database.prepare(`INSERT INTO ${definition.table}(id, ${columnNames.join(', ')}, payload_json) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`);
    for (const item of after) {
      const payload = json(item);
      if (previous.get(item.id) === payload) continue;
      if (definition.immutable && previous.has(item.id)) throw new Error(`Immutable ${definition.key} entry cannot be modified: ${item.id}`);
      statement.run(item.id, ...columnNames.map((column) => definition.columns[column](item)), payload);
    }
  }

  deleteRemoved(definition, before, after) {
    const retained = new Set(after.map((item) => item.id));
    const statement = this.database.prepare(`DELETE FROM ${definition.table} WHERE id = ?`);
    for (const item of before) {
      if (retained.has(item.id)) continue;
      if (definition.immutable) throw new Error(`Immutable ${definition.key} entry cannot be deleted: ${item.id}`);
      statement.run(item.id);
    }
  }

  ensureAuditChain() {
    this.database.exec('BEGIN IMMEDIATE;');
    try {
      this.database.exec('DROP TRIGGER IF EXISTS audits_prevent_update; DROP TRIGGER IF EXISTS audits_prevent_delete;');
      const rows = this.database.prepare('SELECT id, payload_json, previous_hash, entry_hash FROM audits ORDER BY rowid').all();
      const update = this.database.prepare('UPDATE audits SET previous_hash = ?, entry_hash = ? WHERE id = ?');
      let previousHash = '';
      for (const row of rows) {
        const expected = auditHash(previousHash, row.payload_json);
        if ((row.previous_hash && row.previous_hash !== previousHash) || (row.entry_hash && row.entry_hash !== expected)) throw new Error(`Audit chain verification failed at ${row.id}`);
        if (!row.entry_hash) update.run(previousHash, expected, row.id);
        previousHash = expected;
      }
      this.database.exec(auditTriggersSql);
      this.database.exec('COMMIT;');
    } catch (error) {
      this.database.exec('ROLLBACK;');
      throw error;
    }
  }

  backfillRiskAssessments() {
    const before = this.readSnapshot(['consultations', 'riskAssessments']);
    const assessed = new Set(before.riskAssessments.map((item) => item.consultationId));
    const missing = before.consultations.filter((item) => !assessed.has(item.id));
    if (!missing.length) return;
    const after = clone(before);
    for (const consultation of missing) {
      const immediateCare = consultation.riskLevel === 'emergency';
      after.riskAssessments.push({ id: `rsk_migrated_${consultation.id}`, consultationId: consultation.id, ruleRiskLevel: consultation.riskLevel, modelRiskLevel: null, finalRiskLevel: consultation.riskLevel, recommendedDepartment: immediateCare ? '急诊/神经内科' : '神经内科/眩晕专病门诊', careTimeframe: immediateCare ? '立即急诊' : consultation.riskLevel === 'high' ? '24 小时内' : '一周内', immediateCare, possibleDirections: [], dangerSignals: consultation.dangerSignals || [], createdAt: consultation.createdAt });
    }
    this.database.exec('BEGIN IMMEDIATE;');
    try { this.persistChanges(before, after, ['riskAssessments']); this.database.exec('COMMIT;'); }
    catch (error) { this.database.exec('ROLLBACK;'); throw error; }
  }

  restoreEmergencyRiskLevels() {
    const before = this.readSnapshot(['consultations', 'reports', 'riskAssessments']);
    const after = clone(before);
    let changed = false;
    for (const item of after.consultations) {
      if (item.riskLevel === 'high' && item.dangerSignals?.length) { item.riskLevel = 'emergency'; changed = true; }
    }
    for (const item of after.reports) {
      if (item.riskLevel === 'high' && item.dangerSignals?.length) { item.riskLevel = 'emergency'; changed = true; }
    }
    for (const item of after.riskAssessments) {
      if ((item.immediateCare || item.dangerSignals?.length) && item.finalRiskLevel === 'high') { item.finalRiskLevel = 'emergency'; changed = true; }
      if ((item.immediateCare || item.dangerSignals?.length) && item.ruleRiskLevel === 'high') { item.ruleRiskLevel = 'emergency'; changed = true; }
    }
    if (!changed) return;
    this.database.exec('BEGIN IMMEDIATE;');
    try { this.persistChanges(before, after, ['consultations', 'reports', 'riskAssessments']); this.database.exec('COMMIT;'); }
    catch (error) { this.database.exec('ROLLBACK;'); throw error; }
  }

  close() {
    this.database?.close();
    this.database = null;
  }
}
