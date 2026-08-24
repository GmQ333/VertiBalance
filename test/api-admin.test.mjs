import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestApi } from './api-test-helpers.mjs';

let context;
let admin;

test.before(async () => {
  context = await createTestApi('admin-api');
  admin = await context.login('admin');
});

test.after(async () => context?.close());

test('GET /admin/dashboard returns persisted operating metrics', async () => {
  const result = await context.request('/admin/dashboard', { token: admin.token });
  assert.equal(result.response.status, 200);
  for (const key of ['consultations', 'bookingConversion', 'highRisk', 'modelSuccessRate', 'users']) assert.equal(typeof result.data.metrics[key], 'number');
  assert.equal(result.data.model.config.status, 'active');
});

test('GET /admin/users and POST /admin/users manage public user records', async () => {
  const list = await context.request('/admin/users', { token: admin.token });
  assert.equal(list.response.status, 200);
  assert.ok(list.data.users.length >= 6);
  assert.ok(list.data.users.every((item) => !('passwordHash' in item)));
  const suffix = Date.now();
  const created = await context.request('/admin/users', { token: admin.token, method: 'POST', body: { role: 'doctor', name: '接口测试医生', account: `doctor-${suffix}@example.com`, phone: `134${String(suffix).slice(-8)}`, password: 'Secure123!', department: '神经内科', title: '主治医师', licenseNo: `LIC-${suffix}` } });
  assert.equal(created.response.status, 201);
  assert.equal(created.data.user.status, 'pending');
  context.createdDoctor = created.data.user;
});

test('PATCH /admin/users/:id/status reviews and activates a doctor', async () => {
  const result = await context.request(`/admin/users/${context.createdDoctor.id}/status`, { token: admin.token, method: 'PATCH', body: { status: 'active' } });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.user.status, 'active');
  assert.ok(context.store.snapshot().audits.some((item) => item.action === 'user_status_changed' && item.objectId === context.createdDoctor.id));
});

test('POST /admin/schedules validates relational doctor/department links', async () => {
  const startAt = new Date(Date.now() + 10 * 86400000).toISOString();
  const endAt = new Date(Date.now() + 10 * 86400000 + 4 * 3600000).toISOString();
  const created = await context.request('/admin/schedules', { token: admin.token, method: 'POST', body: { doctorId: context.createdDoctor.id, departmentId: 'dept_neuro', campus: '滨江院区', startAt, endAt, capacity: 6 } });
  assert.equal(created.response.status, 201);
  assert.equal(created.data.schedule.remaining, 6);
  context.createdSchedule = created.data.schedule;
  const conflict = await context.request('/admin/schedules', { token: admin.token, method: 'POST', body: { doctorId: context.createdDoctor.id, departmentId: 'dept_neuro', campus: '滨江院区', startAt, endAt, capacity: 4 } });
  assert.equal(conflict.response.status, 409);
  const invalidDepartment = await context.request('/admin/schedules', { token: admin.token, method: 'POST', body: { doctorId: context.createdDoctor.id, departmentId: 'dept_missing', campus: '滨江院区', startAt: new Date(Date.now() + 20 * 86400000).toISOString(), endAt: new Date(Date.now() + 20 * 86400000 + 3600000).toISOString(), capacity: 4 } });
  assert.equal(invalidDepartment.response.status, 400);
  assert.equal(invalidDepartment.data.error, 'INVALID_DEPARTMENT');
});

test('PATCH /admin/schedules/:id changes capacity and status safely', async () => {
  const result = await context.request(`/admin/schedules/${context.createdSchedule.id}`, { token: admin.token, method: 'PATCH', body: { capacity: 8, status: 'closed' } });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.schedule.capacity, 8);
  assert.equal(result.data.schedule.status, 'closed');
});

test('POST /admin/knowledge and PATCH /admin/knowledge/:id version content state', async () => {
  const created = await context.request('/admin/knowledge', { token: admin.token, method: 'POST', body: { category: '数据库测试', title: '眩晕就医资料准备', summary: '接口测试摘要', content: '接口测试正文', status: 'draft' } });
  assert.equal(created.response.status, 201);
  assert.equal(created.data.item.status, 'draft');
  const updated = await context.request(`/admin/knowledge/${created.data.item.id}`, { token: admin.token, method: 'PATCH', body: { status: 'published', summary: '已审核摘要' } });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.data.item.status, 'published');
  const invalid = await context.request(`/admin/knowledge/${created.data.item.id}`, { token: admin.token, method: 'PATCH', body: { status: 'deleted' } });
  assert.equal(invalid.response.status, 400);
});

test('GET /knowledge lets administrators query draft and published records', async () => {
  const result = await context.request('/knowledge', { token: admin.token });
  assert.equal(result.response.status, 200);
  assert.ok(result.data.items.length >= 4);
});

test('GET, POST and PATCH /admin/risk-rules persist immediately effective safety rules', async () => {
  const initial = await context.request('/admin/risk-rules', { token: admin.token });
  assert.equal(initial.response.status, 200);
  const created = await context.request('/admin/risk-rules', { token: admin.token, method: 'POST', body: { label: '接口测试危险信号', keywords: ['测试危险关键词'] } });
  assert.equal(created.response.status, 201);
  const updated = await context.request(`/admin/risk-rules/${created.data.rule.id}`, { token: admin.token, method: 'PATCH', body: { enabled: false, keywords: ['更新后的危险关键词'] } });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.data.rule.enabled, false);
});

test('GET and POST /admin/models enforce unique model versions without storing API keys', async () => {
  const initial = await context.request('/admin/models', { token: admin.token });
  assert.equal(initial.response.status, 200);
  const promptVersion = `integration-${Date.now()}`;
  const created = await context.request('/admin/models', { token: admin.token, method: 'POST', body: { model: 'deepseek-v4-pro', baseUrl: 'https://api.modagent-homing.com/v1', promptVersion } });
  assert.equal(created.response.status, 201);
  assert.equal(created.data.config.status, 'inactive');
  assert.equal('apiKey' in created.data.config, false);
  context.createdModel = created.data.config;
  const duplicate = await context.request('/admin/models', { token: admin.token, method: 'POST', body: { model: 'deepseek-v4-pro', baseUrl: 'https://api.modagent-homing.com/v1', promptVersion } });
  assert.equal(duplicate.response.status, 409);
});

test('PATCH /admin/models/:id/activate checks connectivity before atomic activation', async () => {
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    if (String(input).endsWith('/models')) return new Response(JSON.stringify({ data: [{ id: 'deepseek-v4-pro' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    return nativeFetch(input, options);
  };
  try {
    const result = await context.request(`/admin/models/${context.createdModel.id}/activate`, { token: admin.token, method: 'PATCH', body: {} });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.config.status, 'active');
    assert.equal(context.store.snapshot().modelConfigs.filter((item) => item.status === 'active').length, 1);
  } finally { globalThis.fetch = nativeFetch; }
});

test('GET /admin/audits queries append-only records newest first', async () => {
  const result = await context.request('/admin/audits?limit=500', { token: admin.token });
  assert.equal(result.response.status, 200);
  assert.ok(result.data.audits.some((item) => item.action === 'model_activated'));
  for (let index = 1; index < result.data.audits.length; index += 1) assert.ok(result.data.audits[index - 1].createdAt >= result.data.audits[index].createdAt);
});
