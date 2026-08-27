import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { screenRisk, redactUnsafeClaims, buildReport, callDoctorAnalysis } from '../server/model-service.mjs';
import { createToken, hashPassword, verifyPassword, verifyToken } from '../server/security.mjs';
import { SqliteStore } from '../server/store.mjs';

test('passwords use salted scrypt hashes and verify safely', () => {
  const encoded = hashPassword('Verti123!');
  assert.match(encoded, /^scrypt\$/);
  assert.equal(verifyPassword('Verti123!', encoded), true);
  assert.equal(verifyPassword('wrong-password', encoded), false);
});

test('signed session token rejects tampering', () => {
  const token = createToken({ id: 'usr_test', role: 'patient' }, 'test-secret');
  assert.equal(verifyToken(token, 'test-secret').sub, 'usr_test');
  assert.equal(verifyToken(`${token.slice(0, -2)}xx`, 'test-secret'), null);
});

test('danger signal rules take priority and unsafe claims are rewritten', () => {
  const risk = screenRisk('我突然眩晕而且说话不清，一边手臂没有力气');
  assert.equal(risk.riskLevel, 'emergency');
  assert.deepEqual(risk.dangerSignals, ['言语不清', '单侧肢体无力或麻木']);
  assert.doesNotMatch(redactUnsafeClaims('已经确诊，可以排除卒中，无需就医，绝对安全'), /已经确诊|可以排除|无需就医|绝对安全/);
});

test('administrator-configured risk keywords take effect immediately', () => {
  const risk = screenRisk('今天喝水呛咳并感觉天旋地转', [{ label: '吞咽困难', keywords: ['喝水呛咳'], enabled: true }]);
  assert.equal(risk.riskLevel, 'emergency');
  assert.deepEqual(risk.dangerSignals, ['吞咽困难']);
});

test('danger and history rules ignore explicitly negated symptoms', () => {
  const negated = screenRisk('我没有说话不清，无复视，也没有高血压，但有一点头晕');
  assert.equal(negated.riskLevel, 'medium');
  assert.deepEqual(negated.dangerSignals, []);

  const mixed = screenRisk('我没有高血压，但突然说话不清');
  assert.equal(mixed.riskLevel, 'emergency');
  assert.deepEqual(mixed.dangerSignals, ['言语不清']);

  const custom = screenRisk('没有喝水呛咳', [{ label: '吞咽困难', keywords: ['喝水呛咳'], enabled: true }]);
  assert.deepEqual(custom.dangerSignals, []);
});

test('report generation preserves risk signals and non-diagnostic wording', () => {
  const report = buildReport({ riskLevel: 'emergency', dangerSignals: ['无法站立或行走'] }, [{ role: 'user', content: '突然旋转，无法站立，伴恶心' }]);
  assert.equal(report.riskLevel, 'emergency');
  assert.deepEqual(report.dangerSignals, ['无法站立或行走']);
  assert.match(report.aiRiskNote, /建议立即急诊/);
});

test('doctor model analysis validates structured output without external network', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.MEDCHAT_API_KEY;
  process.env.MEDCHAT_API_KEY = 'local-test-key';
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ symptomHighlights: ['体位诱发短暂眩晕'], followupQuestions: ['是否伴听力变化？'], differentialDirections: ['可能涉及外周前庭方向'], dangerSignals: [], suggestedExams: ['眼震检查'], structuredSummary: '症状需由医生结合查体进一步判断。' }) } }] }) });
  try {
    const result = await callDoctorAnalysis({ report: { chiefComplaint: '测试摘要', dangerSignals: [] }, messages: [] });
    assert.deepEqual(result.analysis.followupQuestions, ['是否伴听力变化？']);
    assert.match(result.analysis.differentialDirections[0], /可能/);
  } finally { globalThis.fetch = originalFetch; process.env.MEDCHAT_API_KEY = originalKey; }
});

test('SQLite store serializes transactions and writes durable data', async () => {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'vertibalance-test-'));
  const file = path.join(tempDirectory, 'data.sqlite');
  let store;
  let reloaded;
  try {
    store = await new SqliteStore(file).init();
    await Promise.all(Array.from({ length: 5 }, (_, index) => store.transaction((data) => { data.meta.counter = (data.meta.counter || 0) + 1; return index; })));
    assert.equal(store.snapshot().meta.counter, 5);
    reloaded = await new SqliteStore(file).init();
    assert.equal(reloaded.snapshot().meta.counter, 5);
  } finally {
    reloaded?.close(); store?.close();
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
});
