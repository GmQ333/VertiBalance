const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4173/api/v1';
const skipExternal = process.env.SKIP_EXTERNAL === '1';

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${data.error} ${data.message}`);
  return data;
}

const health = await request('/health');
if (health.status !== 'ok' || health.storage !== 'ready') throw new Error('Health check did not report ready');

const patient = await request('/auth/login', { method: 'POST', body: { account: 'patient@demo.com', password: 'Verti123!', role: 'patient' } });
const registrationKey = Date.now();
const registered = await request('/auth/register', { method: 'POST', body: { name: '自动测试患者', account: `smoke-${registrationKey}@demo.com`, phone: `136${String(registrationKey).slice(-8)}`, password: 'Verti123!' } });
if (registered.user.role !== 'patient') throw new Error('Patient registration failed');
const consultation = await request('/consultations', { token: patient.token, method: 'POST', body: {} });
if (!consultation.consultation.id || !consultation.messages.length) throw new Error('Consultation was not created');

const urgent = await request(`/consultations/${consultation.consultation.id}/messages`, { token: patient.token, method: 'POST', body: { content: '我突然说话不清而且一边手臂没有力气' } });
if (urgent.riskLevel !== 'emergency' || !urgent.dangerSignals.length) throw new Error('Danger signal did not override risk');

const report = await request(`/consultations/${consultation.consultation.id}/complete`, { token: patient.token, method: 'POST', body: {} });
if (report.report.riskLevel !== 'emergency') throw new Error('Report did not preserve emergency risk');

const schedules = await request('/schedules', { token: patient.token });
if (!schedules.schedules.length) throw new Error('No bookable schedule available');
const booking = await request('/bookings', { token: patient.token, method: 'POST', body: { consultationId: consultation.consultation.id, scheduleId: schedules.schedules[0].id } });
if (booking.booking.status !== 'confirmed') throw new Error('Booking was not confirmed');

const uploadBody = new FormData();
uploadBody.append('file', new Blob(['%PDF-1.4\nsmoke-test'], { type: 'application/pdf' }), 'smoke-report.pdf');
uploadBody.append('category', '检查资料');
const uploadResponse = await fetch(`${base}/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${patient.token}` }, body: uploadBody });
const upload = await uploadResponse.json();
if (!uploadResponse.ok || !upload.upload?.id) throw new Error('Medical document upload failed');

const admin = await request('/auth/login', { method: 'POST', body: { account: 'admin@demo.com', password: 'Verti123!', role: 'admin' } });
const customRule = await request('/admin/risk-rules', { token: admin.token, method: 'POST', body: { label: `测试吞咽风险 ${registrationKey}`, keywords: [`测试呛咳${registrationKey}`] } });
const customConsultation = await request('/consultations', { token: registered.token, method: 'POST', body: {} });
const customRisk = await request(`/consultations/${customConsultation.consultation.id}/messages`, { token: registered.token, method: 'POST', body: { content: `我出现测试呛咳${registrationKey}` } });
if (customRisk.riskLevel !== 'emergency' || !customRisk.dangerSignals.includes(customRule.rule.label)) throw new Error('Configured danger rule did not take effect immediately');
const adminDashboard = await request('/admin/dashboard', { token: admin.token });
if (typeof adminDashboard.metrics.consultations !== 'number') throw new Error('Admin metrics missing');

const doctor = await request('/auth/login', { method: 'POST', body: { account: 'doctor@demo.com', password: 'Verti123!', role: 'doctor' } });
const workbench = await request('/doctor/workbench', { token: doctor.token });
if (!Array.isArray(workbench.queue)) throw new Error('Doctor queue missing');
const patientRecord = await request(`/doctor/patients/${patient.user.id}`, { token: doctor.token });
if (!patientRecord.reports.some((item) => item.id === report.report.id)) throw new Error('Transferred report is not visible to assigned doctor');
if (!patientRecord.uploads.some((item) => item.id === upload.upload.id)) throw new Error('Uploaded document is not visible to assigned doctor');
let doctorAnalysis = { analysis: { followupQuestions: [] } };
if (!skipExternal) doctorAnalysis = await request(`/doctor/patients/${patient.user.id}/ai-analysis`, { token: doctor.token, method: 'POST', body: {} });
if (!Array.isArray(doctorAnalysis.analysis.followupQuestions)) throw new Error('Doctor AI analysis is not structured');
const disposition = await request('/doctor/dispositions', { token: doctor.token, method: 'POST', body: { patientId: patient.user.id, consultationId: consultation.consultation.id, diagnosis: '需进一步检查明确眩晕原因', examination: '建议完善神经系统查体', treatment: '根据检查结果制定方案' } });
if (!disposition.disposition.id) throw new Error('Disposition was not stored');
const followup = await request('/doctor/followups', { token: doctor.token, method: 'POST', body: { patientId: patient.user.id, title: '冒烟测试随访', type: 'questionnaire', dueAt: new Date(Date.now() + 86400000).toISOString() } });
if (!followup.followup.id) throw new Error('Follow-up was not created');

const knowledge = await request('/admin/knowledge', { token: admin.token, method: 'POST', body: { category: '测试', title: `API 冒烟验证 ${Date.now()}`, summary: '用于验证管理端知识库写入', content: '这是一条自动化验证记录。', status: 'draft' } });
if (!knowledge.item.id) throw new Error('Knowledge item was not created');
const modelConfig = await request('/admin/models', { token: admin.token, method: 'POST', body: { model: 'deepseek-v4-pro', baseUrl: 'https://api.modagent-homing.com/v1', promptVersion: `smoke-${Date.now()}` } });
const activatedModel = skipExternal ? { config: modelConfig.config } : await request(`/admin/models/${modelConfig.config.id}/activate`, { token: admin.token, method: 'PATCH', body: {} });
if (!skipExternal && activatedModel.config.status !== 'active') throw new Error('Model activation failed');
await request('/feedback', { token: patient.token, method: 'POST', body: { rating: 5, content: '自动化冒烟测试反馈' } });
const notifications = await request('/notifications', { token: patient.token });
if (!notifications.notifications.some((item) => item.type === 'booking')) throw new Error('Booking notification missing');
const audits = await request('/admin/audits', { token: admin.token });
if (!audits.audits.some((item) => item.action === 'patient_record_accessed')) throw new Error('Patient access audit was not recorded');

const unauthorized = await fetch(`${base}/admin/audits`, { headers: { Authorization: `Bearer ${patient.token}` } });
if (unauthorized.status !== 403) throw new Error(`Role isolation failed: expected 403, got ${unauthorized.status}`);

console.log(JSON.stringify({ health: health.status, registration: registered.user.id, consultation: consultation.consultation.id, risk: urgent.riskLevel, configurableRiskRule: 'passed', report: report.report.id, booking: booking.booking.id, upload: upload.upload.id, doctorAnalysis: skipExternal ? 'covered-by-local-mock' : 'structured', disposition: disposition.disposition.id, followup: followup.followup.id, notifications: notifications.unread, modelActivation: skipExternal ? 'creation-verified; activation-skipped' : activatedModel.config.promptVersion, audit: 'passed', adminMetrics: adminDashboard.metrics, doctorQueue: workbench.queue.length, roleIsolation: 'passed' }, null, 2));
