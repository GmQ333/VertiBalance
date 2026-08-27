import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { once } from 'node:events';
import { createApiApplication } from '../server/app.mjs';
import { SqliteStore } from '../server/store.mjs';

let directory;
let store;
let server;
let baseUrl;
let patientToken;
let adminToken;

async function request(route, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  return { response, data };
}

test.before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vertibalance-api-auth-'));
  store = await new SqliteStore(path.join(directory, 'database.sqlite')).init();
  const app = createApiApplication(store, { uploadDirectory: path.join(directory, 'uploads') });
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  patientToken = (await request('/auth/login', { method: 'POST', body: { account: 'patient@demo.com', password: 'Verti123!', role: 'patient' } })).data.token;
  adminToken = (await request('/auth/login', { method: 'POST', body: { account: 'admin@demo.com', password: 'Verti123!', role: 'admin' } })).data.token;
});

test.after(async () => {
  if (server) { server.close(); await once(server, 'close'); }
  store?.close();
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

test('GET /health reports the relational database engine', async () => {
  const { response, data } = await request('/health');
  assert.equal(response.status, 200);
  assert.equal(data.storage, 'ready');
  assert.equal(data.database.engine, 'sqlite');
});

test('POST /auth/register persists a patient and rejects duplicate identity', async () => {
  const body = { name: '接口测试患者', account: 'api-patient@example.com', phone: '13600001234', password: 'Secure123!' };
  const created = await request('/auth/register', { method: 'POST', body });
  assert.equal(created.response.status, 201);
  assert.equal(created.data.user.role, 'patient');
  assert.equal('passwordHash' in created.data.user, false);
  assert.ok(store.snapshot().users.some((user) => user.account === body.account));
  const duplicate = await request('/auth/register', { method: 'POST', body: { ...body, phone: '13600005678' } });
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.data.error, 'ACCOUNT_EXISTS');
});

test('POST /auth/login validates credentials and returns a signed session', async () => {
  const valid = await request('/auth/login', { method: 'POST', body: { account: 'patient@demo.com', password: 'Verti123!', role: 'patient' } });
  assert.equal(valid.response.status, 200);
  assert.ok(valid.data.token.split('.').length === 3);
  const invalid = await request('/auth/login', { method: 'POST', body: { account: 'patient@demo.com', password: 'wrong-password', role: 'patient' } });
  assert.equal(invalid.response.status, 401);
  assert.equal(invalid.data.error, 'INVALID_CREDENTIALS');
});

test('GET /auth/me returns only the authenticated user', async () => {
  const own = await request('/auth/me', { token: patientToken });
  assert.equal(own.response.status, 200);
  assert.equal(own.data.user.account, 'patient@demo.com');
  assert.equal('passwordHash' in own.data.user, false);
  const anonymous = await request('/auth/me');
  assert.equal(anonymous.response.status, 401);
});

test('GET /notifications isolates records by authenticated user', async () => {
  await store.transaction((data) => {
    data.notifications.push({ id: 'ntf_patient_test', userId: 'usr_patient_demo', type: 'test', title: '患者通知', content: '仅患者可见', objectId: null, read: false, createdAt: new Date().toISOString() });
    data.notifications.push({ id: 'ntf_admin_test', userId: 'usr_admin_demo', type: 'test', title: '管理通知', content: '仅管理员可见', objectId: null, read: false, createdAt: new Date().toISOString() });
  });
  const patient = await request('/notifications', { token: patientToken });
  assert.equal(patient.response.status, 200);
  assert.ok(patient.data.notifications.some((item) => item.id === 'ntf_patient_test'));
  assert.equal(patient.data.notifications.some((item) => item.id === 'ntf_admin_test'), false);
});

test('PATCH /notifications/:id/read updates only an owned notification', async () => {
  const own = await request('/notifications/ntf_patient_test/read', { token: patientToken, method: 'PATCH', body: {} });
  assert.equal(own.response.status, 200);
  assert.equal(own.data.notification.read, true);
  const foreign = await request('/notifications/ntf_admin_test/read', { token: patientToken, method: 'PATCH', body: {} });
  assert.equal(foreign.response.status, 404);
});

test('PATCH /notifications/read-all marks only the authenticated user notifications', async () => {
  const result = await request('/notifications/read-all', { token: patientToken, method: 'PATCH', body: {} });
  assert.equal(result.response.status, 200);
  const data = store.snapshot(['notifications']).notifications;
  assert.ok(data.filter((item) => item.userId === 'usr_patient_demo').every((item) => item.read));
  assert.equal(data.find((item) => item.id === 'ntf_admin_test').read, false);
});

test('POST /feedback validates and persists bounded feedback', async () => {
  const created = await request('/feedback', { token: patientToken, method: 'POST', body: { rating: 5, content: '数据库接口验证反馈' } });
  assert.equal(created.response.status, 201);
  assert.equal(created.data.feedback.userId, 'usr_patient_demo');
  const invalid = await request('/feedback', { token: patientToken, method: 'POST', body: { rating: 6, content: '无效评分' } });
  assert.equal(invalid.response.status, 400);
});

test('protected endpoints reject a token with the wrong role', async () => {
  const forbidden = await request('/admin/audits', { token: patientToken });
  assert.equal(forbidden.response.status, 403);
  const allowed = await request('/admin/audits', { token: adminToken });
  assert.equal(allowed.response.status, 200);
  assert.ok(allowed.data.audits.some((item) => item.action === 'permission_denied'));
});
