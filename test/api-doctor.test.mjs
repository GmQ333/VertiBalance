import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestApi } from './api-test-helpers.mjs';

let context;
let doctor;

test.before(async () => {
  context = await createTestApi('doctor-api');
  doctor = await context.login('doctor');
});

test.after(async () => context?.close());

test('GET /doctor/workbench returns only the assigned clinical queue', async () => {
  const result = await context.request('/doctor/workbench', { token: doctor.token });
  assert.equal(result.response.status, 200);
  assert.ok(result.data.queue.length > 0);
  assert.ok(result.data.queue.every((item) => item.booking.doctorId === doctor.user.id));
  assert.equal(typeof result.data.summary.highRisk, 'number');
});

test('GET /doctor/patients/:id enforces assignment and records access audit', async () => {
  const assigned = await context.request('/doctor/patients/usr_patient_lin', { token: doctor.token });
  assert.equal(assigned.response.status, 200);
  assert.equal(assigned.data.patient.id, 'usr_patient_lin');
  assert.ok(Array.isArray(assigned.data.messages));
  assert.ok(Array.isArray(assigned.data.riskAssessments));
  const unassigned = await context.request('/doctor/patients/usr_patient_demo', { token: doctor.token });
  assert.equal(unassigned.response.status, 403);
  assert.ok(context.store.snapshot().audits.some((item) => item.action === 'patient_record_accessed' && item.objectId === 'usr_patient_lin'));
  assert.ok(context.store.snapshot().audits.some((item) => item.action === 'permission_denied' && item.objectId.includes('usr_patient_demo')));
});

test('POST /doctor/patients/:id/ai-analysis stores only structured model metadata', async () => {
  const nativeFetch = globalThis.fetch;
  const originalApiKey = process.env.MEDCHAT_API_KEY;
  process.env.MEDCHAT_API_KEY = 'integration-test-key';
  globalThis.fetch = async (input, options) => {
    if (String(input).startsWith('https://api.modagent-homing.com/')) {
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ symptomHighlights: ['持续性眩晕伴行走不稳'], followupQuestions: ['是否出现复视？'], differentialDirections: ['可能涉及中枢前庭方向'], dangerSignals: ['无法独立行走'], suggestedExams: ['神经系统查体'], structuredSummary: '需要结合查体进一步判断。' }) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return nativeFetch(input, options);
  };
  try {
    const result = await context.request('/doctor/patients/usr_patient_lin/ai-analysis', { token: doctor.token, method: 'POST', body: {} });
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.data.analysis.followupQuestions, ['是否出现复视？']);
    const call = context.store.snapshot().modelCalls.find((item) => item.purpose === 'doctor_analysis');
    assert.ok(call);
    assert.equal('messages' in call, false);
  } finally {
    globalThis.fetch = nativeFetch;
    if (originalApiKey === undefined) delete process.env.MEDCHAT_API_KEY;
    else process.env.MEDCHAT_API_KEY = originalApiKey;
  }
});

test('POST /doctor/patients/:id/ai-analysis persists a sanitized failure record', async () => {
  const originalApiKey = process.env.MEDCHAT_API_KEY;
  delete process.env.MEDCHAT_API_KEY;
  try {
    const result = await context.request('/doctor/patients/usr_patient_lin/ai-analysis', { token: doctor.token, method: 'POST', body: {} });
    assert.equal(result.response.status, 503);
    const failed = context.store.snapshot(['modelCalls']).modelCalls.find((item) => item.purpose === 'doctor_analysis' && !item.success);
    assert.equal(failed.error, 'MODEL_NOT_CONFIGURED');
    assert.equal('messages' in failed, false);
    assert.ok(context.store.snapshot(['audits']).audits.some((item) => item.action === 'doctor_ai_analysis_failed' && item.status === 'failed'));
  } finally {
    if (originalApiKey === undefined) delete process.env.MEDCHAT_API_KEY;
    else process.env.MEDCHAT_API_KEY = originalApiKey;
  }
});

test('GET /consultations, /reports, /bookings and /followups apply doctor scope', async () => {
  const consultations = await context.request('/consultations', { token: doctor.token });
  const reports = await context.request('/reports', { token: doctor.token });
  const bookings = await context.request('/bookings', { token: doctor.token });
  const followups = await context.request('/followups', { token: doctor.token });
  assert.equal(consultations.response.status, 200);
  assert.ok(consultations.data.consultations.every((item) => item.assignedDoctorId === doctor.user.id));
  assert.ok(reports.data.reports.length > 0);
  assert.ok(bookings.data.bookings.every((item) => item.doctorId === doctor.user.id));
  assert.ok(followups.data.followups.every((item) => item.doctorId === doctor.user.id));
});

test('POST /doctor/dispositions writes clinical opinion separately and completes booking', async () => {
  const result = await context.request('/doctor/dispositions', { token: doctor.token, method: 'POST', body: { patientId: 'usr_patient_lin', consultationId: 'con_lin_001', diagnosis: '眩晕原因待进一步检查明确', examination: '完善神经系统查体与影像检查', treatment: '根据检查结果制定治疗方案', medication: '暂不调整既往用药', rehabilitation: '注意防跌倒', revisitAt: new Date(Date.now() + 86400000).toISOString(), followupPlan: '一周内复诊' } });
  assert.equal(result.response.status, 201);
  assert.equal(result.data.disposition.doctorId, doctor.user.id);
  const data = context.store.snapshot();
  assert.ok(data.dispositions.some((item) => item.id === result.data.disposition.id));
  assert.equal(data.bookings.find((item) => item.consultationId === 'con_lin_001').status, 'completed');
});

test('POST /doctor/followups creates an assigned patient task and notification', async () => {
  const result = await context.request('/doctor/followups', { token: doctor.token, method: 'POST', body: { patientId: 'usr_patient_lin', title: '数据库接口随访', type: 'questionnaire', dueAt: new Date(Date.now() + 172800000).toISOString() } });
  assert.equal(result.response.status, 201);
  assert.equal(result.data.followup.doctorId, doctor.user.id);
  assert.ok(context.store.snapshot().notifications.some((item) => item.objectId === result.data.followup.id && item.userId === 'usr_patient_lin'));
  const forbidden = await context.request('/doctor/followups', { token: doctor.token, method: 'POST', body: { patientId: 'usr_patient_demo', title: '越权随访', type: 'questionnaire', dueAt: new Date(Date.now() + 172800000).toISOString() } });
  assert.equal(forbidden.response.status, 403);
  const invalidType = await context.request('/doctor/followups', { token: doctor.token, method: 'POST', body: { patientId: 'usr_patient_lin', title: '无效类型', type: 'arbitrary', dueAt: new Date(Date.now() + 172800000).toISOString() } });
  assert.equal(invalidType.response.status, 400);
});
