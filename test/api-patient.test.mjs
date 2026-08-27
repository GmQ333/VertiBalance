import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestApi } from './api-test-helpers.mjs';

let context;
let patient;
let otherPatient;
let admin;
let consultation;
let report;
let booking;
let upload;

test.before(async () => {
  context = await createTestApi('patient-api');
  patient = await context.login('patient');
  admin = await context.login('admin');
  const suffix = Date.now();
  const registered = await context.request('/auth/register', { method: 'POST', body: { name: '隔离测试患者', account: `other-${suffix}@example.com`, phone: `135${String(suffix).slice(-8)}`, password: 'Secure123!' } });
  otherPatient = registered.data;
});

test.after(async () => context?.close());

test('PATCH /auth/profile updates only the authenticated patient profile', async () => {
  const result = await context.request('/auth/profile', { token: patient.token, method: 'PATCH', body: { name: '苏晴更新', phone: '13800000001', gender: '女', age: 35 } });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.user.name, '苏晴更新');
  assert.equal(result.data.user.passwordHash, undefined);
  assert.ok(context.store.snapshot(['audits']).audits.some((item) => item.action === 'profile_updated' && item.objectId === patient.user.id));
});

test('GET /patient/dashboard returns only the patient aggregate', async () => {
  const result = await context.request('/patient/dashboard', { token: patient.token });
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.data.reports));
  assert.ok(result.data.followups.every((item) => item.patientId === patient.user.id));
});

test('POST /consultations creates one resumable consultation', async () => {
  const first = await context.request('/consultations', { token: patient.token, method: 'POST', body: {} });
  const second = await context.request('/consultations', { token: patient.token, method: 'POST', body: {} });
  assert.equal(first.response.status, 201);
  assert.equal(second.data.consultation.id, first.data.consultation.id);
  consultation = first.data.consultation;
});

test('GET /consultations lists only owned consultations', async () => {
  const result = await context.request('/consultations', { token: patient.token });
  assert.equal(result.response.status, 200);
  assert.ok(result.data.consultations.some((item) => item.id === consultation.id));
  assert.ok(result.data.consultations.every((item) => item.patientId === patient.user.id));
});

test('GET /consultations/:id enforces object ownership', async () => {
  const own = await context.request(`/consultations/${consultation.id}`, { token: patient.token });
  assert.equal(own.response.status, 200);
  assert.ok(context.store.snapshot(['audits']).audits.some((item) => item.action === 'consultation_record_accessed' && item.objectId === consultation.id));
  const foreignConsultation = await context.request('/consultations', { token: otherPatient.token, method: 'POST', body: {} });
  const forbidden = await context.request(`/consultations/${foreignConsultation.data.consultation.id}`, { token: patient.token });
  assert.equal(forbidden.response.status, 403);
  assert.ok(context.store.snapshot().audits.some((item) => item.action === 'permission_denied' && item.objectId.includes(foreignConsultation.data.consultation.id)));
});

test('support requests persist, notify administrators and expose patient status', async () => {
  const created = await context.request('/support-requests', { token: patient.token, method: 'POST', body: { consultationId: consultation.id, category: '问诊流程', contact: '13800138000', summary: '希望健康顾问协助说明后续问诊流程' } });
  assert.equal(created.response.status, 201);
  assert.equal(created.data.request.status, 'pending');
  assert.equal(created.data.request.priority, 'normal');
  const patientList = await context.request('/support-requests', { token: patient.token });
  assert.ok(patientList.data.requests.some((item) => item.id === created.data.request.id));
  const foreignList = await context.request('/support-requests', { token: otherPatient.token });
  assert.equal(foreignList.data.requests.some((item) => item.id === created.data.request.id), false);
  const adminList = await context.request('/admin/support-requests', { token: admin.token });
  assert.ok(adminList.data.requests.some((item) => item.id === created.data.request.id && item.patient.id === patient.user.id));
  assert.ok(context.store.snapshot(['notifications']).notifications.some((item) => item.objectId === created.data.request.id && item.userId === admin.user.id));
  const updated = await context.request(`/admin/support-requests/${created.data.request.id}`, { token: admin.token, method: 'PATCH', body: { status: 'contacted', responseMessage: '健康顾问已通过预留电话联系。' } });
  assert.equal(updated.data.request.status, 'contacted');
  const notices = await context.request('/notifications', { token: patient.token });
  assert.ok(notices.data.notifications.some((item) => item.objectId === created.data.request.id && item.type === 'support_update'));
  const urgent = await context.request('/support-requests', { token: patient.token, method: 'POST', body: { consultationId: consultation.id, category: '其他', contact: '13800138000', summary: '我突然说话不清，而且一侧手臂没有力气' } });
  assert.equal(urgent.data.request.priority, 'urgent');
  assert.match(urgent.data.message, /立即前往急诊|120/);
});

test('POST /consultations/:id/messages persists danger signals without external model access', async () => {
  const result = await context.request(`/consultations/${consultation.id}/messages`, { token: patient.token, method: 'POST', body: { content: '我突然说话不清，而且一侧手臂没有力气' } });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.riskLevel, 'emergency');
  assert.ok(result.data.dangerSignals.length > 0);
  assert.ok(context.store.snapshot().messages.some((item) => item.consultationId === consultation.id && item.role === 'user'));
  const assessment = context.store.snapshot(['riskAssessments']).riskAssessments.find((item) => item.consultationId === consultation.id);
  assert.equal(assessment.finalRiskLevel, 'emergency');
  assert.equal(assessment.immediateCare, true);
});

test('POST /consultations/:id/complete atomically closes the consultation and creates one report', async () => {
  const first = await context.request(`/consultations/${consultation.id}/complete`, { token: patient.token, method: 'POST', body: {} });
  const second = await context.request(`/consultations/${consultation.id}/complete`, { token: patient.token, method: 'POST', body: {} });
  assert.equal(first.response.status, 201);
  assert.equal(second.response.status, 200);
  assert.equal(second.data.report.id, first.data.report.id);
  report = first.data.report;
});

test('GET /reports isolates patient report history', async () => {
  const result = await context.request('/reports', { token: patient.token });
  assert.equal(result.response.status, 200);
  assert.ok(result.data.reports.some((item) => item.id === report.id));
  assert.ok(result.data.reports.every((item) => item.patientId === patient.user.id));
  assert.ok(context.store.snapshot(['audits']).audits.some((item) => item.action === 'report_list_accessed'));
});

test('GET /departments returns enabled departments', async () => {
  const result = await context.request('/departments', { token: patient.token });
  assert.equal(result.response.status, 200);
  assert.ok(result.data.departments.length > 0);
  assert.ok(result.data.departments.every((item) => item.enabled));
});

test('GET /schedules returns future available capacity', async () => {
  const result = await context.request('/schedules', { token: patient.token });
  assert.equal(result.response.status, 200);
  assert.ok(result.data.schedules.length > 0);
  assert.ok(result.data.schedules.every((item) => item.status === 'open' && item.remaining > 0));
});

test('POST /bookings transfers the report and decrements capacity in one transaction', async () => {
  const schedules = await context.request('/schedules', { token: patient.token });
  const schedule = schedules.data.schedules[0];
  const result = await context.request('/bookings', { token: patient.token, method: 'POST', body: { consultationId: consultation.id, scheduleId: schedule.id } });
  assert.equal(result.response.status, 201);
  assert.equal(result.data.booking.status, 'confirmed');
  booking = result.data.booking;
  const data = context.store.snapshot();
  assert.equal(data.consultations.find((item) => item.id === consultation.id).assignedDoctorId, booking.doctorId);
  assert.equal(data.schedules.find((item) => item.id === schedule.id).remaining, schedule.remaining - 1);
});

test('GET /bookings returns only owned booking records', async () => {
  const result = await context.request('/bookings', { token: patient.token });
  assert.equal(result.response.status, 200);
  assert.ok(result.data.bookings.some((item) => item.id === booking.id));
  assert.ok(result.data.bookings.every((item) => item.patientId === patient.user.id));
});

test('POST /uploads and GET /uploads persist private medical file metadata', async () => {
  const form = new FormData();
  form.append('file', new Blob(['%PDF-1.4\npatient-api-test'], { type: 'application/pdf' }), '检查报告.pdf');
  form.append('category', '检查资料');
  form.append('consultationId', consultation.id);
  const response = await fetch(`${context.baseUrl}/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${patient.token}` }, body: form });
  const data = await response.json();
  assert.equal(response.status, 201);
  assert.equal('storedName' in data.upload, false);
  upload = data.upload;
  const list = await context.request('/uploads', { token: patient.token });
  assert.ok(list.data.uploads.some((item) => item.id === upload.id));
});

test('POST /uploads rejects a forged MIME type before writing metadata or files', async () => {
  const before = context.store.snapshot().uploads.length;
  const form = new FormData();
  form.append('file', new Blob(['this-is-not-a-pdf'], { type: 'application/pdf' }), '伪造报告.pdf');
  const response = await fetch(`${context.baseUrl}/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${patient.token}` }, body: form });
  const data = await response.json();
  assert.equal(response.status, 400);
  assert.equal(data.error, 'INVALID_FILE_CONTENT');
  assert.equal(context.store.snapshot().uploads.length, before);
});

test('GET /uploads/:id/download authorizes the owner and audits access', async () => {
  const response = await fetch(`${context.baseUrl}/uploads/${upload.id}/download`, { headers: { Authorization: `Bearer ${patient.token}` } });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /patient-api-test/);
  const foreign = await fetch(`${context.baseUrl}/uploads/${upload.id}/download`, { headers: { Authorization: `Bearer ${otherPatient.token}` } });
  assert.equal(foreign.status, 403);
  assert.ok(context.store.snapshot().audits.some((item) => item.action === 'medical_file_downloaded' && item.objectId === upload.id));
});

test('GET /uploads/:id/preview and DELETE /uploads/:id enforce ownership', async () => {
  const preview = await fetch(`${context.baseUrl}/uploads/${upload.id}/preview`, { headers: { Authorization: `Bearer ${patient.token}` } });
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get('content-type'), 'application/pdf');
  const foreignPreview = await fetch(`${context.baseUrl}/uploads/${upload.id}/preview`, { headers: { Authorization: `Bearer ${otherPatient.token}` } });
  assert.equal(foreignPreview.status, 403);
  const foreignDelete = await context.request(`/uploads/${upload.id}`, { token: otherPatient.token, method: 'DELETE' });
  assert.equal(foreignDelete.response.status, 404);
  const removed = await context.request(`/uploads/${upload.id}`, { token: patient.token, method: 'DELETE' });
  assert.equal(removed.response.status, 200);
  assert.equal(context.store.snapshot().uploads.some((item) => item.id === upload.id), false);
  assert.ok(context.store.snapshot().audits.some((item) => item.action === 'medical_file_deleted' && item.objectId === upload.id));
});

test('GET /followups and POST /followups/:id/feedback maintain patient ownership', async () => {
  const list = await context.request('/followups', { token: patient.token });
  assert.equal(list.response.status, 200);
  const task = list.data.followups.find((item) => item.status === 'pending');
  assert.ok(task);
  const submitted = await context.request(`/followups/${task.id}/feedback`, { token: patient.token, method: 'POST', body: { severity: 8, frequency: 4, text: '仍有明显不适', medicationTaken: true } });
  assert.equal(submitted.response.status, 200);
  assert.equal(submitted.data.followup.status, 'completed');
  assert.equal(submitted.data.followup.abnormal, true);
  assert.equal(submitted.data.followup.feedback.frequency, 4);
  const duplicate = await context.request(`/followups/${task.id}/feedback`, { token: patient.token, method: 'POST', body: { severity: 2, frequency: 0, text: '重复提交' } });
  assert.equal(duplicate.response.status, 409);
  const foreign = await context.request(`/followups/${task.id}/feedback`, { token: otherPatient.token, method: 'POST', body: { severity: 2, text: '越权' } });
  assert.equal(foreign.response.status, 404);
});

test('GET /knowledge exposes only published content to patients', async () => {
  const result = await context.request('/knowledge', { token: patient.token });
  assert.equal(result.response.status, 200);
  assert.ok(result.data.items.length > 0);
  assert.ok(result.data.items.every((item) => item.status === 'published'));
});

test('PATCH /bookings/:id/cancel releases capacity and closes transfer access', async () => {
  const before = context.store.snapshot().schedules.find((item) => item.id === booking.scheduleId).remaining;
  const result = await context.request(`/bookings/${booking.id}/cancel`, { token: patient.token, method: 'PATCH', body: {} });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.booking.status, 'cancelled');
  const after = context.store.snapshot();
  assert.equal(after.schedules.find((item) => item.id === booking.scheduleId).remaining, before + 1);
  assert.ok(after.notifications.some((item) => item.type === 'booking_cancelled' && item.objectId === booking.id && item.userId === booking.doctorId));
});
