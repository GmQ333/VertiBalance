import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { SqliteStore } from '../server/store.mjs';
import { createDatabaseBackup, restoreDatabaseBackup, verifyDatabaseBackup } from '../server/backup.mjs';

test('database migrations create all required relational tables', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vertibalance-schema-'));
  const store = await new SqliteStore(path.join(directory, 'database.sqlite')).init();
  try {
    const tables = store.database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
    for (const table of ['users', 'consultations', 'messages', 'reports', 'risk_assessments', 'bookings', 'followups', 'support_requests', 'uploads', 'model_calls', 'audits', 'schema_migrations']) assert.ok(tables.includes(table), `missing table ${table}`);
    assert.equal(store.database.prepare('SELECT COUNT(*) count FROM schema_migrations').get().count, 4);
    assert.equal(store.database.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    assert.equal(store.snapshot(['consultations']).consultations.find((item) => item.id === 'con_lin_001').riskLevel, 'emergency');
    assert.equal(store.snapshot(['reports']).reports.find((item) => item.id === 'rpt_lin_001').riskLevel, 'emergency');
    assert.equal(store.snapshot(['riskAssessments']).riskAssessments.find((item) => item.id === 'rsk_lin_001').finalRiskLevel, 'emergency');
    const databaseStat = await fs.stat(path.join(directory, 'database.sqlite'));
    const directoryStat = await fs.stat(directory);
    if (process.platform === 'win32') {
      assert.ok(databaseStat.isFile());
      assert.ok(directoryStat.isDirectory());
    } else {
      assert.equal(databaseStat.mode & 0o777, 0o600);
      assert.equal(directoryStat.mode & 0o777, 0o700);
    }
  } finally {
    store.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('startup restores previously downgraded emergency risk records', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vertibalance-risk-restore-'));
  const databasePath = path.join(directory, 'database.sqlite');
  let store = await new SqliteStore(databasePath).init();
  try {
    await store.transaction(['consultations', 'reports', 'riskAssessments'], (data) => {
      data.consultations.find((item) => item.id === 'con_lin_001').riskLevel = 'high';
      data.reports.find((item) => item.id === 'rpt_lin_001').riskLevel = 'high';
      const assessment = data.riskAssessments.find((item) => item.id === 'rsk_lin_001');
      assessment.ruleRiskLevel = 'high';
      assessment.finalRiskLevel = 'high';
    });
    store.close();
    store = await new SqliteStore(databasePath).init();
    assert.equal(store.snapshot(['consultations']).consultations.find((item) => item.id === 'con_lin_001').riskLevel, 'emergency');
    assert.equal(store.snapshot(['reports']).reports.find((item) => item.id === 'rpt_lin_001').riskLevel, 'emergency');
    const restored = store.snapshot(['riskAssessments']).riskAssessments.find((item) => item.id === 'rsk_lin_001');
    assert.equal(restored.ruleRiskLevel, 'emergency');
    assert.equal(restored.finalRiskLevel, 'emergency');
  } finally {
    store.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('relational constraints roll back the whole business transaction', async () => {
  const store = await new SqliteStore(':memory:').init();
  try {
    const before = store.snapshot();
    await assert.rejects(store.transaction((data) => {
      data.users.push({ ...data.users[0], id: 'usr_duplicate_account', phone: '13899999999' });
      data.audits.push({ id: 'aud_should_rollback', actorId: 'system', actorName: '系统', action: 'invalid_write', objectType: 'user', objectId: 'usr_duplicate_account', detail: '应整体回滚', status: 'blocked', createdAt: new Date().toISOString() });
    }), /UNIQUE constraint failed/);
    const after = store.snapshot();
    assert.equal(after.users.length, before.users.length);
    assert.equal(after.audits.some((item) => item.id === 'aud_should_rollback'), false);
  } finally { store.close(); }
});

test('audit records are append-only through both store and database protections', async () => {
  const store = await new SqliteStore(':memory:').init();
  try {
    const audit = store.snapshot().audits[0];
    await assert.rejects(store.transaction((data) => { data.audits[0].detail = 'tampered'; }), /Immutable audits entry cannot be modified/);
    assert.equal(store.snapshot().audits[0].detail, audit.detail);
    assert.throws(() => store.database.prepare('DELETE FROM audits WHERE id = ?').run(audit.id), /audit records are immutable/);
    const chain = store.database.prepare('SELECT previous_hash, entry_hash FROM audits ORDER BY rowid').all();
    assert.ok(chain.every((row) => /^[a-f0-9]{64}$/.test(row.entry_hash)));
    assert.equal(chain[0].previous_hash, '');
    for (let index = 1; index < chain.length; index += 1) assert.equal(chain[index].previous_hash, chain[index - 1].entry_hash);
  } finally { store.close(); }
});

test('startup rejects an audit payload changed outside the application', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vertibalance-audit-chain-'));
  const file = path.join(directory, 'database.sqlite');
  const store = await new SqliteStore(file).init();
  try {
    store.database.exec('DROP TRIGGER audits_prevent_update;');
    const audit = store.snapshot().audits[0];
    store.database.prepare('UPDATE audits SET payload_json = ? WHERE id = ?').run(JSON.stringify({ ...audit, detail: 'offline tampering' }), audit.id);
  } finally { store.close(); }
  const reopened = new SqliteStore(file);
  try { await assert.rejects(reopened.init(), /Audit chain verification failed/); }
  finally { reopened.close(); await fs.rm(directory, { recursive: true, force: true }); }
});

test('backup captures a consistent database, uploads and verifiable checksums', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vertibalance-backup-'));
  const databasePath = path.join(directory, 'database.sqlite');
  const uploadDirectory = path.join(directory, 'uploads');
  const backupRoot = path.join(directory, 'backups');
  const store = await new SqliteStore(databasePath).init();
  try {
    await fs.mkdir(uploadDirectory);
    await fs.writeFile(path.join(uploadDirectory, 'sample.pdf'), '%PDF-1.4\nbackup-test', { mode: 0o600 });
    await store.transaction(['feedback'], (data) => { data.feedback.push({ id: 'fbk_backup', userId: 'usr_patient_demo', role: 'patient', rating: 5, content: 'backup', status: 'open', createdAt: new Date().toISOString() }); });
    const backup = await createDatabaseBackup({ databasePath, uploadDirectory, backupRoot });
    const verified = await verifyDatabaseBackup(backup.directory);
    assert.equal(verified.valid, true);
    assert.ok(verified.manifest.checksums['vertibalance.sqlite']);
    assert.ok(verified.manifest.checksums[path.join('uploads', 'sample.pdf')]);
    assert.equal(verified.manifest.migrations.length, 4);
    const restored = await restoreDatabaseBackup({ backupDirectory: backup.directory, targetDatabasePath: path.join(directory, 'restored', 'database.sqlite'), targetUploadDirectory: path.join(directory, 'restored', 'uploads') });
    const reopened = await new SqliteStore(restored.databasePath).init();
    try {
      assert.ok(reopened.snapshot(['feedback']).feedback.some((item) => item.id === 'fbk_backup'));
      assert.match(await fs.readFile(path.join(restored.uploadDirectory, 'sample.pdf'), 'utf8'), /backup-test/);
    } finally { reopened.close(); }
    await assert.rejects(restoreDatabaseBackup({ backupDirectory: backup.directory, targetDatabasePath: restored.databasePath, targetUploadDirectory: restored.uploadDirectory }), (error) => error.code === 'EEXIST');
  } finally { store.close(); await fs.rm(directory, { recursive: true, force: true }); }
});

test('two database connections preserve 200 concurrent scoped writes without loss', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vertibalance-concurrency-'));
  const file = path.join(directory, 'database.sqlite');
  const first = await new SqliteStore(file).init();
  const second = await new SqliteStore(file).init();
  try {
    await Promise.all(Array.from({ length: 200 }, (_, index) => {
      const store = index % 2 ? first : second;
      return store.transaction(['feedback'], (data) => {
        data.feedback.push({ id: `fbk_concurrent_${index}`, userId: 'usr_patient_demo', role: 'patient', rating: 5, content: `concurrent-${index}`, status: 'open', createdAt: new Date().toISOString() });
      });
    }));
    const rows = first.snapshot(['feedback']).feedback.filter((item) => item.id.startsWith('fbk_concurrent_'));
    assert.equal(rows.length, 200);
    assert.equal(new Set(rows.map((item) => item.id)).size, 200);
  } finally {
    second.close(); first.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('database transactions reject asynchronous work and roll it back', async () => {
  const store = await new SqliteStore(':memory:').init();
  try {
    const before = store.snapshot(['feedback']).feedback.length;
    await assert.rejects(store.transaction(['feedback'], async (data) => {
      data.feedback.push({ id: 'fbk_async', userId: 'usr_patient_demo', role: 'patient', rating: 5, content: 'async', status: 'open', createdAt: new Date().toISOString() });
    }), /Async work is not allowed/);
    assert.equal(store.snapshot(['feedback']).feedback.length, before);
  } finally { store.close(); }
});

test('legacy data receives one traceable risk assessment per historical consultation', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vertibalance-legacy-risk-'));
  const legacyFile = path.join(directory, 'legacy.json');
  const databaseFile = path.join(directory, 'database.sqlite');
  const legacy = { meta: { schemaVersion: 3 }, users: [], departments: [], consultations: [], messages: [], reports: [], schedules: [], bookings: [], dispositions: [], followups: [], notifications: [], uploads: [], feedback: [], riskRules: [], knowledge: [], modelConfigs: [], modelCalls: [], audits: [] };
  // Use a minimal valid relational graph to exercise the one-time JSON importer.
  const seeded = await new SqliteStore(':memory:').init();
  const source = seeded.snapshot(); seeded.close();
  delete source.riskAssessments;
  await fs.writeFile(legacyFile, JSON.stringify({ ...legacy, ...source }));
  const store = await new SqliteStore(databaseFile, { legacyFilePath: legacyFile }).init();
  try {
    const data = store.snapshot(['consultations', 'riskAssessments']);
    assert.equal(new Set(data.riskAssessments.map((item) => item.consultationId)).size, data.consultations.length);
  } finally { store.close(); await fs.rm(directory, { recursive: true, force: true }); }
});
