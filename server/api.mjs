import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { buildReport, callDoctorAnalysis, callPatientReport, callPatientTurn, configureRuntimeModel, screenRisk } from './model-service.mjs';
import { createId, createToken, hashPassword, publicUser, verifyPassword, verifyToken } from './security.mjs';

const riskWeight = { low: 1, medium: 2, high: 3, emergency: 4 };
const careByRisk = {
  low: { careTimeframe: '按需就医并留意变化', immediateCare: false },
  medium: { careTimeframe: '一周内就医', immediateCare: false },
  high: { careTimeframe: '24 小时内就医', immediateCare: false },
  emergency: { careTimeframe: '立即急诊或呼叫 120', immediateCare: true },
};
const now = () => new Date().toISOString();
const strongPassword = (value) => typeof value === 'string' && value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
const followupTypes = new Set(['medication', 'revisit', 'rehabilitation', 'questionnaire', 'warning']);

function parseDate(value, fieldName) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw httpError(400, 'INVALID_DATE', `${fieldName}格式不正确`);
  return date.toISOString();
}

function httpError(status, code, message) {
  const error = new Error(message); error.status = status; error.code = code; return error;
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function auditEntry(actor, action, objectType, objectId, detail, status = 'success') {
  return { id: createId('aud'), actorId: actor?.id || 'system', actorName: actor?.name || '系统', action, objectType, objectId, detail, status, createdAt: now() };
}

function notification(userId, type, title, content, objectId = null) {
  return { id: createId('ntf'), userId, type, title, content, objectId, read: false, createdAt: now() };
}

function hasAllowedFileSignature(file) {
  const bytes = file?.buffer;
  if (!bytes) return false;
  if (file.mimetype === 'application/pdf') return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  if (file.mimetype === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (file.mimetype === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return false;
}

function canAccessConsultation(user, consultation, data) {
  if (user.role === 'admin') return true;
  if (user.role === 'patient') return consultation.patientId === user.id;
  if (user.role === 'doctor') return consultation.assignedDoctorId === user.id || data.bookings.some((booking) => booking.consultationId === consultation.id && booking.doctorId === user.id && booking.status !== 'cancelled');
  return false;
}

function joinSchedule(data, schedule) {
  const doctor = data.users.find((user) => user.id === schedule.doctorId);
  const department = data.departments.find((item) => item.id === schedule.departmentId);
  return { ...schedule, doctor: doctor ? { id: doctor.id, name: doctor.name, title: doctor.title, department: doctor.department } : null, department: department?.name || '未配置' };
}

function higherRisk(first = 'low', second = 'low') {
  return riskWeight[second] > riskWeight[first] ? second : first;
}

function normalizeReportRisk(report, consultation) {
  const dangerSignals = [...new Set([...(consultation.dangerSignals || []), ...(report.dangerSignals || [])])];
  let riskLevel = higherRisk(consultation.riskLevel, report.riskLevel);
  if (dangerSignals.length) riskLevel = 'emergency';
  const care = careByRisk[riskLevel];
  return {
    ...report,
    dangerSignals,
    riskLevel,
    careTimeframe: care.careTimeframe,
    immediateCare: care.immediateCare,
    recommendedDepartment: riskLevel === 'emergency' ? '急诊/神经内科' : report.recommendedDepartment,
  };
}

export function createApiRouter(store, options = {}) {
  const router = express.Router();
  const consultationQueues = new Map();
  const uploadDirectory = options.uploadDirectory || path.resolve('data', 'uploads');
  const allowedFileTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, callback) => callback(allowedFileTypes.has(file.mimetype) ? null : httpError(400, 'INVALID_FILE_TYPE', '仅支持 PDF、JPG 和 PNG 文件'), allowedFileTypes.has(file.mimetype)) });

  const authenticate = asyncRoute(async (req, _res, next) => {
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
    const payload = verifyToken(token);
    const user = payload ? store.snapshot(['users']).users.find((item) => item.id === payload.sub) : null;
    if (!user || user.status !== 'active') throw httpError(401, 'UNAUTHORIZED', '登录状态已失效，请重新登录');
    req.user = user; next();
  });

  const requireRole = (...roles) => asyncRoute(async (req, _res, next) => {
    if (!roles.includes(req.user.role)) {
      await store.transaction(['audits'], (data) => { data.audits.push(auditEntry(req.user, 'permission_denied', 'route', req.path, `角色 ${req.user.role} 尝试访问 ${req.method} ${req.originalUrl}`, 'blocked')); });
      const error = httpError(403, 'FORBIDDEN', '当前账号无权执行此操作'); error.auditRecorded = true; throw error;
    }
    next();
  });

  const serializeConsultation = asyncRoute(async (req, res, next) => {
    const id = req.params.id; const previous = consultationQueues.get(id) || Promise.resolve();
    let release; const current = new Promise((resolve) => { release = resolve; });
    const queued = previous.catch(() => undefined).then(() => current); consultationQueues.set(id, queued);
    await previous.catch(() => undefined);
    let released = false; const done = () => { if (released) return; released = true; release(); if (consultationQueues.get(id) === queued) consultationQueues.delete(id); };
    res.once('finish', done); res.once('close', done); next();
  });

  router.get('/health', (_req, res) => {
    const data = store.snapshot([]);
    res.json({ status: 'ok', storage: 'ready', database: { engine: store.engine || 'unknown' }, modelConfigured: Boolean(process.env.MEDCHAT_API_KEY), model: process.env.MEDCHAT_MODEL || 'deepseek-v4-pro', schemaVersion: data.meta.schemaVersion });
  });

  router.post('/auth/register', asyncRoute(async (req, res) => {
    const { name, account, phone, password } = req.body || {};
    if (!name || !account || !phone || !password) throw httpError(400, 'INVALID_INPUT', '姓名、账号、手机号和密码均为必填项');
    if (!strongPassword(password)) throw httpError(400, 'WEAK_PASSWORD', '密码至少 8 位，且必须包含字母和数字');
    const user = await store.transaction(['users', 'audits'], (data) => {
      if (data.users.some((item) => item.account === account || item.phone === phone)) throw httpError(409, 'ACCOUNT_EXISTS', '该账号或手机号已存在');
      const created = { id: createId('usr'), role: 'patient', name, account, phone, passwordHash: hashPassword(password), status: 'active', gender: req.body.gender || '未设置', age: Number(req.body.age) || null, createdAt: now(), lastLoginAt: now() };
      data.users.push(created);
      data.audits.push(auditEntry(created, 'patient_registered', 'user', created.id, '患者完成自助注册'));
      return created;
    });
    res.status(201).json({ token: createToken(user), user: publicUser(user) });
  }));

  router.post('/auth/login', asyncRoute(async (req, res) => {
    const { account, password, role } = req.body || {};
    const data = store.snapshot(['users']);
    const user = data.users.find((item) => (item.account === account || item.phone === account) && (!role || item.role === role));
    if (!user || !verifyPassword(password || '', user.passwordHash)) { await store.transaction(['audits'], (draft) => { draft.audits.push(auditEntry(null, 'login_failed', 'authentication', 'redacted', `登录失败，申报角色 ${role || 'unknown'}`, 'blocked')); }); throw httpError(401, 'INVALID_CREDENTIALS', '账号或密码错误'); }
    if (user.status === 'disabled') { await store.transaction(['audits'], (draft) => { draft.audits.push(auditEntry(user, 'disabled_account_login', 'user', user.id, '被禁用账号尝试登录', 'blocked')); }); throw httpError(403, 'ACCOUNT_DISABLED', '账号已被禁用，请联系管理员'); }
    if (user.status === 'pending') { await store.transaction(['audits'], (draft) => { draft.audits.push(auditEntry(user, 'pending_account_login', 'user', user.id, '待审核账号尝试登录', 'blocked')); }); throw httpError(403, 'ACCOUNT_PENDING', '账号待审核，请等待管理员确认'); }
    const updated = await store.transaction(['users', 'audits'], (draft) => {
      const target = draft.users.find((item) => item.id === user.id); target.lastLoginAt = now();
      draft.audits.push(auditEntry(target, 'login', 'user', target.id, `${target.role}账号登录`)); return target;
    });
    res.json({ token: createToken(updated), user: publicUser(updated) });
  }));

  router.get('/auth/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));

  router.use(authenticate);

  router.get('/notifications', (req, res) => {
    const items = store.snapshot(['notifications']).notifications.filter((item) => item.userId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ notifications: items.slice(0, 50), unread: items.filter((item) => !item.read).length });
  });

  router.patch('/notifications/:id/read', asyncRoute(async (req, res) => {
    const item = await store.transaction(['notifications'], (data) => {
      const target = data.notifications.find((entry) => entry.id === req.params.id && entry.userId === req.user.id);
      if (!target) throw httpError(404, 'NOT_FOUND', '通知不存在'); target.read = true; return target;
    });
    res.json({ notification: item });
  }));

  router.post('/feedback', asyncRoute(async (req, res) => {
    const rating = Number(req.body?.rating); const content = String(req.body?.content || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !content) throw httpError(400, 'INVALID_FEEDBACK', '请选择 1–5 分并填写反馈内容');
    const item = await store.transaction(['feedback', 'audits'], (data) => {
      const created = { id: createId('fbk'), userId: req.user.id, role: req.user.role, rating, content: content.slice(0, 1000), status: 'open', createdAt: now() };
      data.feedback.push(created); data.audits.push(auditEntry(req.user, 'feedback_submitted', 'feedback', created.id, `用户提交 ${rating} 分反馈`)); return created;
    });
    res.status(201).json({ feedback: item });
  }));

  router.get('/patient/dashboard', requireRole('patient'), (req, res) => {
    const data = store.snapshot(['reports', 'bookings', 'followups', 'knowledge']);
    const reports = data.reports.filter((item) => item.patientId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const bookings = data.bookings.filter((item) => item.patientId === req.user.id && item.status === 'confirmed').sort((a, b) => a.appointmentAt.localeCompare(b.appointmentAt));
    const followups = data.followups.filter((item) => item.patientId === req.user.id && item.status === 'pending').sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    res.json({ reports, upcomingBooking: bookings.find((item) => item.appointmentAt > now()) || null, followups, knowledge: data.knowledge.filter((item) => item.status === 'published').slice(0, 3) });
  });

  router.post('/consultations', requireRole('patient'), asyncRoute(async (req, res) => {
    const consultation = await store.transaction(['consultations', 'modelConfigs', 'messages', 'audits'], (data) => {
      const existing = data.consultations.find((item) => item.patientId === req.user.id && item.status === 'in_progress');
      if (existing) return existing;
      const activeModel = data.modelConfigs.find((item) => item.status === 'active');
      const created = { id: createId('con'), patientId: req.user.id, status: 'in_progress', riskLevel: 'low', dangerSignals: [], modelConfigId: activeModel?.id || null, model: activeModel?.model || process.env.MEDCHAT_MODEL || 'deepseek-v4-pro', createdAt: now(), endedAt: null, assignedDoctorId: null };
      data.consultations.push(created);
      data.messages.push({ id: createId('msg'), consultationId: created.id, role: 'assistant', content: '你好，我是眩衡智能助手。我会先排查危险信号。请问这次主要是不停旋转、头昏，还是走路不稳？', createdAt: now() });
      data.audits.push(auditEntry(req.user, 'consultation_created', 'consultation', created.id, '患者创建智能问诊'));
      return created;
    });
    const data = store.snapshot(['messages']);
    res.status(201).json({ consultation, messages: data.messages.filter((item) => item.consultationId === consultation.id) });
  }));

  router.get('/consultations', (req, res) => {
    const data = store.snapshot(['consultations']);
    let consultations = data.consultations;
    if (req.user.role === 'patient') consultations = consultations.filter((item) => item.patientId === req.user.id);
    if (req.user.role === 'doctor') consultations = consultations.filter((item) => item.assignedDoctorId === req.user.id);
    res.json({ consultations: consultations.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  });

  router.get('/consultations/:id', asyncRoute(async (req, res) => {
    const data = store.snapshot(['consultations', 'messages', 'reports', 'riskAssessments', 'bookings']);
    const consultation = data.consultations.find((item) => item.id === req.params.id);
    if (!consultation) throw httpError(404, 'NOT_FOUND', '问诊记录不存在');
    if (!canAccessConsultation(req.user, consultation, data)) throw httpError(403, 'FORBIDDEN', '无权访问该问诊记录');
    await store.transaction(['audits'], (draft) => { draft.audits.push(auditEntry(req.user, 'consultation_record_accessed', 'consultation', consultation.id, '授权用户查看问诊记录')); });
    res.json({ consultation, messages: data.messages.filter((item) => item.consultationId === consultation.id), report: data.reports.find((item) => item.consultationId === consultation.id) || null, riskAssessments: data.riskAssessments.filter((item) => item.consultationId === consultation.id) });
  }));

  router.post('/consultations/:id/messages', serializeConsultation, requireRole('patient'), asyncRoute(async (req, res) => {
    const content = String(req.body?.content || '').trim();
    if (!content || content.length > 2000) throw httpError(400, 'INVALID_MESSAGE', '消息不能为空且不能超过 2000 字');
    const risk = screenRisk(content, store.snapshot(['riskRules']).riskRules);
    const consultation = await store.transaction(['consultations', 'messages'], (data) => {
      const target = data.consultations.find((item) => item.id === req.params.id && item.patientId === req.user.id);
      if (!target) throw httpError(404, 'NOT_FOUND', '问诊会话不存在');
      if (target.status !== 'in_progress') throw httpError(409, 'CONSULTATION_CLOSED', '该问诊已经结束');
      data.messages.push({ id: createId('msg'), consultationId: target.id, role: 'user', content, createdAt: now() });
      target.dangerSignals = [...new Set([...target.dangerSignals, ...risk.dangerSignals])];
      if (riskWeight[risk.riskLevel] > riskWeight[target.riskLevel]) target.riskLevel = risk.riskLevel;
      return target;
    });

    let assistantContent; let modelMeta = null; let modelTurn = null;
    if (consultation.dangerSignals.length) {
      assistantContent = '你的描述中包含需要立即关注的危险信号。请停止自行活动，立即前往急诊或呼叫 120，不要独自驾车，建议由家人陪同。';
    } else {
      const data = store.snapshot(['messages', 'modelConfigs']);
      const context = data.messages.filter((item) => item.consultationId === consultation.id).map(({ role, content: text }) => ({ role, content: text }));
      const pinnedConfig = data.modelConfigs.find((item) => item.id === consultation.modelConfigId) || null;
      try {
        const structured = await callPatientTurn(context, pinnedConfig);
        modelTurn = structured.turn;
        modelMeta = { latencyMs: structured.latencyMs, model: structured.model };
        assistantContent = structured.turn.question;
      } catch (error) {
        assistantContent = `${error.message || '智能问诊服务暂时不可用'} 已保存你的描述，建议稍后重试或直接咨询医生。`;
        modelMeta = { error: error.code || 'MODEL_UNAVAILABLE', latencyMs: error.latencyMs || 0, model: error.model || process.env.MEDCHAT_MODEL || 'deepseek-v4-pro' };
        modelTurn = { riskLevel: 'medium', dangerSignals: [], possibleDirections: [], recommendedDepartment: '眩晕专病门诊', careTimeframe: '一周内就医', immediateCare: false, readyToComplete: false, collectedFields: [] };
      }
    }
    const result = await store.transaction(['consultations', 'messages', 'riskAssessments', 'modelCalls', 'audits'], (data) => {
      const target = data.consultations.find((item) => item.id === consultation.id);
      const modelRiskLevel = modelTurn?.riskLevel || null;
      target.dangerSignals = [...new Set([...(target.dangerSignals || []), ...(modelTurn?.dangerSignals || [])])];
      target.riskLevel = higherRisk(target.riskLevel, modelRiskLevel || 'low');
      if (target.dangerSignals.length) target.riskLevel = 'emergency';
      target.collectedFields = [...new Set([...(target.collectedFields || []), ...(modelTurn?.collectedFields || [])])];
      target.readyToComplete = Boolean(modelTurn?.readyToComplete);
      const care = careByRisk[target.riskLevel];
      const recommendedDepartment = target.riskLevel === 'emergency' ? '急诊/神经内科' : modelTurn?.recommendedDepartment || '神经内科/眩晕专病门诊';
      if (target.riskLevel === 'emergency') assistantContent = '你的描述中包含需要立即关注的危险信号。请停止自行活动，立即前往急诊或呼叫 120，不要独自驾车，建议由家人陪同。';
      else if (target.riskLevel === 'high') assistantContent = `当前信息提示较高风险，建议 24 小时内前往${recommendedDepartment}就医评估。你可以继续补充信息，但不要延误就医。`;
      const assessment = { id: createId('rsk'), consultationId: target.id, ruleRiskLevel: risk.riskLevel, modelRiskLevel, finalRiskLevel: target.riskLevel, recommendedDepartment, careTimeframe: care.careTimeframe, immediateCare: care.immediateCare, possibleDirections: modelTurn?.possibleDirections || [], dangerSignals: target.dangerSignals, createdAt: now() };
      data.riskAssessments.push(assessment);
      const message = { id: createId('msg'), consultationId: consultation.id, role: 'assistant', content: assistantContent, createdAt: now(), model: modelMeta?.model || null };
      data.messages.push(message);
      if (modelMeta) data.modelCalls.push({ id: createId('call'), consultationId: consultation.id, userId: req.user.id, model: modelMeta.model, success: !modelMeta.error, error: modelMeta.error || null, latencyMs: modelMeta.latencyMs, createdAt: now() });
      data.audits.push(auditEntry(req.user, 'consultation_message', 'consultation', consultation.id, `提交问诊消息，最终风险等级 ${target.riskLevel}`));
      return { message, consultation: target, assessment };
    });
    res.json({ message: result.message, consultation: result.consultation, triage: result.assessment, riskLevel: result.consultation.riskLevel, dangerSignals: result.consultation.dangerSignals });
  }));

  router.post('/consultations/:id/complete', serializeConsultation, requireRole('patient'), asyncRoute(async (req, res) => {
    const data = store.snapshot(['consultations', 'reports', 'messages', 'modelConfigs']);
    const consultation = data.consultations.find((item) => item.id === req.params.id && item.patientId === req.user.id);
    if (!consultation) throw httpError(404, 'NOT_FOUND', '问诊会话不存在');
    const existing = data.reports.find((item) => item.consultationId === consultation.id);
    if (existing) return res.json({ report: existing });
    if (consultation.status !== 'in_progress') throw httpError(409, 'CONSULTATION_CLOSED', '该问诊已经结束');
    const messages = data.messages.filter((item) => item.consultationId === consultation.id);
    const userMessages = messages.filter((item) => item.role === 'user');
    if (userMessages.length < 3 && !(consultation.dangerSignals || []).length) throw httpError(409, 'INSUFFICIENT_INFORMATION', '当前信息不足，请至少完成三轮症状采集后再生成报告');
    const pinnedConfig = data.modelConfigs.find((item) => item.id === consultation.modelConfigId) || null;
    let generated; let modelMeta;
    try {
      const structured = await callPatientReport({ consultation, messages }, pinnedConfig);
      generated = structured.report;
      modelMeta = { model: structured.model, latencyMs: structured.latencyMs };
    } catch (error) {
      generated = buildReport(consultation, messages);
      modelMeta = { model: error.model || process.env.MEDCHAT_MODEL || 'deepseek-v4-pro', latencyMs: error.latencyMs || 0, error: error.code || 'MODEL_UNAVAILABLE' };
    }
    const reportFields = normalizeReportRisk(generated, consultation);
    const report = await store.transaction(['consultations', 'reports', 'modelCalls', 'audits'], (draft) => {
      const target = draft.consultations.find((item) => item.id === consultation.id);
      target.status = 'report_generated'; target.endedAt = now();
      const created = { id: createId('rpt'), consultationId: target.id, patientId: req.user.id, ...reportFields, createdAt: now() };
      draft.reports.push(created);
      draft.modelCalls.push({ id: createId('call'), consultationId: target.id, userId: req.user.id, model: modelMeta.model, success: !modelMeta.error, error: modelMeta.error || null, latencyMs: modelMeta.latencyMs, createdAt: now() });
      draft.audits.push(auditEntry(req.user, 'report_generated', 'report', created.id, `问诊结束并生成${created.generationSource === 'model' ? '模型结构化' : '保守降级'}报告`));
      return created;
    });
    res.status(201).json({ report });
  }));

  router.get('/reports', asyncRoute(async (req, res) => {
    const data = store.snapshot(['reports', 'bookings']);
    let reports = data.reports;
    if (req.user.role === 'patient') reports = reports.filter((item) => item.patientId === req.user.id);
    if (req.user.role === 'doctor') { const patientIds = new Set(data.bookings.filter((item) => item.doctorId === req.user.id && item.status !== 'cancelled').map((item) => item.patientId)); reports = reports.filter((item) => patientIds.has(item.patientId)); }
    const visible = reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    await store.transaction(['audits'], (draft) => { draft.audits.push(auditEntry(req.user, 'report_list_accessed', 'report', req.user.id, `授权用户查看报告列表，共 ${visible.length} 条`)); });
    res.json({ reports: visible });
  }));

  router.get('/schedules', (req, res) => {
    const data = store.snapshot(['schedules', 'users', 'departments']);
    let schedules = data.schedules;
    if (req.user.role !== 'admin') schedules = schedules.filter((item) => item.status === 'open' && item.remaining > 0 && item.startAt > now());
    if (req.query.doctorId) schedules = schedules.filter((item) => item.doctorId === req.query.doctorId);
    res.json({ schedules: schedules.map((item) => joinSchedule(data, item)).sort((a, b) => a.startAt.localeCompare(b.startAt)) });
  });

  router.get('/departments', (_req, res) => {
    res.json({ departments: store.snapshot(['departments']).departments.filter((item) => item.enabled) });
  });

  router.post('/bookings', requireRole('patient'), asyncRoute(async (req, res) => {
    const { consultationId, scheduleId } = req.body || {};
    const booking = await store.transaction(['consultations', 'schedules', 'users', 'departments', 'bookings', 'notifications', 'audits'], (data) => {
      const consultation = data.consultations.find((item) => item.id === consultationId && item.patientId === req.user.id);
      if (!consultation || !['report_generated', 'ended'].includes(consultation.status)) throw httpError(409, 'REPORT_REQUIRED', '请先完成问诊并生成报告');
      const schedule = data.schedules.find((item) => item.id === scheduleId);
      if (!schedule || schedule.status !== 'open' || schedule.remaining < 1) throw httpError(409, 'SCHEDULE_FULL', '该时段号源已满，请选择其他时间');
      if (data.bookings.some((item) => item.consultationId === consultationId && item.scheduleId === scheduleId && item.status !== 'cancelled')) throw httpError(409, 'DUPLICATE_BOOKING', '该问诊已预约此时段，请勿重复操作');
      const doctor = data.users.find((item) => item.id === schedule.doctorId);
      const department = data.departments.find((item) => item.id === schedule.departmentId);
      const created = { id: createId('bok'), consultationId, patientId: req.user.id, doctorId: schedule.doctorId, scheduleId, department: department?.name || doctor?.department, campus: schedule.campus, appointmentAt: schedule.startAt, status: 'confirmed', createdAt: now() };
      data.bookings.push(created); schedule.remaining -= 1; consultation.status = 'transferred'; consultation.assignedDoctorId = schedule.doctorId;
      data.notifications.push(notification(req.user.id, 'booking', '挂号已确认', `已预约${doctor?.name || '医生'}，问诊资料已安全移交。`, created.id));
      data.notifications.push(notification(schedule.doctorId, 'patient_assigned', '新患者资料已移交', `${req.user.name}的问诊报告已进入接诊队列。`, created.id));
      data.audits.push(auditEntry(req.user, 'booking_created', 'booking', created.id, `预约${doctor?.name || '医生'}，问诊资料已移交`)); return created;
    });
    res.status(201).json({ booking });
  }));

  router.get('/bookings', (req, res) => {
    const data = store.snapshot(['bookings', 'users']); let bookings = data.bookings;
    if (req.user.role === 'patient') bookings = bookings.filter((item) => item.patientId === req.user.id);
    if (req.user.role === 'doctor') bookings = bookings.filter((item) => item.doctorId === req.user.id);
    res.json({ bookings: bookings.sort((a, b) => a.appointmentAt.localeCompare(b.appointmentAt)).map((booking) => ({ ...booking, patient: publicUser(data.users.find((item) => item.id === booking.patientId)), doctor: publicUser(data.users.find((item) => item.id === booking.doctorId)) })) });
  });

  router.patch('/bookings/:id/cancel', requireRole('patient'), asyncRoute(async (req, res) => {
    const booking = await store.transaction(['bookings', 'schedules', 'consultations', 'notifications', 'audits'], (data) => {
      const target = data.bookings.find((item) => item.id === req.params.id && item.patientId === req.user.id);
      if (!target) throw httpError(404, 'NOT_FOUND', '挂号记录不存在');
      if (target.status !== 'confirmed') throw httpError(409, 'BOOKING_NOT_CANCELLABLE', '当前挂号状态不能取消');
      if (new Date(target.appointmentAt).getTime() <= Date.now()) throw httpError(409, 'BOOKING_STARTED', '就诊时间已开始，不能在线取消');
      target.status = 'cancelled'; const schedule = data.schedules.find((item) => item.id === target.scheduleId); if (schedule) schedule.remaining = Math.min(schedule.capacity, schedule.remaining + 1);
      const consultation = data.consultations.find((item) => item.id === target.consultationId); if (consultation) { consultation.status = 'report_generated'; consultation.assignedDoctorId = null; }
      data.notifications.push(notification(req.user.id, 'booking_cancelled', '挂号已取消', `已取消${target.department}预约，号源已释放。`, target.id));
      data.audits.push(auditEntry(req.user, 'booking_cancelled', 'booking', target.id, '患者取消挂号并释放号源')); return target;
    });
    res.json({ booking });
  }));

  router.get('/followups', (req, res) => {
    const data = store.snapshot(['followups', 'users']); let followups = data.followups;
    if (req.user.role === 'patient') followups = followups.filter((item) => item.patientId === req.user.id);
    if (req.user.role === 'doctor') followups = followups.filter((item) => item.doctorId === req.user.id);
    res.json({ followups: followups.sort((a, b) => a.dueAt.localeCompare(b.dueAt)).map((item) => ({ ...item, patient: publicUser(data.users.find((user) => user.id === item.patientId)), doctor: publicUser(data.users.find((user) => user.id === item.doctorId)) })) });
  });

  router.post('/followups/:id/feedback', requireRole('patient'), asyncRoute(async (req, res) => {
    const severity = Number(req.body?.severity);
    const frequency = Number(req.body?.frequency ?? 0);
    if (!Number.isInteger(severity) || severity < 0 || severity > 10) throw httpError(400, 'INVALID_SEVERITY', '症状评分必须为 0 到 10 的整数');
    if (!Number.isInteger(frequency) || frequency < 0 || frequency > 1000) throw httpError(400, 'INVALID_FREQUENCY', '过去 24 小时发作次数必须为 0 到 1000 的整数');
    const followup = await store.transaction(['followups', 'riskRules', 'notifications', 'audits'], (data) => {
      const target = data.followups.find((item) => item.id === req.params.id && item.patientId === req.user.id);
      if (!target) throw httpError(404, 'NOT_FOUND', '随访任务不存在');
      if (target.status !== 'pending') throw httpError(409, 'FOLLOWUP_COMPLETED', '该随访任务已经提交过，不能重复提交');
      const text = String(req.body?.text || '').slice(0, 1000); const risk = screenRisk(text, data.riskRules);
      target.feedback = { severity, frequency, text, medicationTaken: Boolean(req.body?.medicationTaken), submittedAt: now() };
      target.status = 'completed'; target.abnormal = severity >= 8 || frequency >= 10 || risk.dangerSignals.length > 0;
      data.notifications.push(notification(target.doctorId, target.abnormal ? 'warning' : 'followup', target.abnormal ? '随访反馈异常' : '患者完成随访', `${req.user.name}已提交“${target.title}”反馈。`, target.id));
      data.audits.push(auditEntry(req.user, 'followup_feedback', 'followup', target.id, target.abnormal ? '随访反馈异常，已标记医生关注' : '患者完成随访反馈'));
      return target;
    });
    res.json({ followup, message: followup.abnormal ? '反馈提示异常，请尽快就医，医生端已标记关注。' : '随访反馈已提交。' });
  }));

  router.get('/knowledge', (req, res) => {
    let items = store.snapshot(['knowledge']).knowledge;
    if (req.user.role !== 'admin') items = items.filter((item) => item.status === 'published');
    if (req.query.category) items = items.filter((item) => item.category === req.query.category);
    res.json({ items: items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
  });

  router.get('/uploads', asyncRoute(async (req, res) => {
    const data = store.snapshot(['uploads', 'bookings']); let uploads = data.uploads;
    if (req.user.role === 'patient') uploads = uploads.filter((item) => item.patientId === req.user.id);
    if (req.user.role === 'doctor') { const patientIds = new Set(data.bookings.filter((item) => item.doctorId === req.user.id && item.status !== 'cancelled').map((item) => item.patientId)); uploads = uploads.filter((item) => patientIds.has(item.patientId)); }
    const visible = uploads.map(({ storedName: _storedName, ...item }) => item).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    await store.transaction(['audits'], (draft) => { draft.audits.push(auditEntry(req.user, 'medical_file_list_accessed', 'upload', req.user.id, `授权用户查看医疗资料列表，共 ${visible.length} 条`)); });
    res.json({ uploads: visible });
  }));

  router.post('/uploads', requireRole('patient'), upload.single('file'), asyncRoute(async (req, res) => {
    if (!req.file) throw httpError(400, 'FILE_REQUIRED', '请选择需要上传的资料');
    if (!hasAllowedFileSignature(req.file)) throw httpError(400, 'INVALID_FILE_CONTENT', '文件内容与声明类型不一致');
    const consultationId = req.body?.consultationId || null;
    if (consultationId && !store.snapshot(['consultations']).consultations.some((item) => item.id === consultationId && item.patientId === req.user.id)) throw httpError(400, 'INVALID_CONSULTATION', '关联问诊记录不存在或不属于当前患者');
    const extension = req.file.mimetype === 'application/pdf' ? '.pdf' : req.file.mimetype === 'image/png' ? '.png' : '.jpg';
    const storedName = `${createId('doc')}${extension}`;
    await fs.mkdir(uploadDirectory, { recursive: true, mode: 0o700 });
    await fs.chmod(uploadDirectory, 0o700);
    await fs.writeFile(path.join(uploadDirectory, storedName), req.file.buffer, { mode: 0o600 });
    let item;
    try {
      item = await store.transaction(['uploads', 'audits'], (data) => {
        const created = { id: createId('upl'), patientId: req.user.id, consultationId, name: req.file.originalname.slice(0, 180), mimeType: req.file.mimetype, size: req.file.size, storedName, category: String(req.body?.category || '检查资料').slice(0, 30), createdAt: now() };
        data.uploads.push(created); data.audits.push(auditEntry(req.user, 'medical_file_uploaded', 'upload', created.id, `患者上传${created.category}，${Math.round(created.size / 1024)}KB`)); return created;
      });
    } catch (error) {
      await fs.unlink(path.join(uploadDirectory, storedName)).catch(() => undefined);
      throw error;
    }
    const { storedName: _storedName, ...safe } = item; res.status(201).json({ upload: safe });
  }));

  router.get('/uploads/:id/download', asyncRoute(async (req, res) => {
    const data = store.snapshot(['uploads', 'bookings']); const item = data.uploads.find((entry) => entry.id === req.params.id);
    if (!item) throw httpError(404, 'NOT_FOUND', '资料不存在');
    const allowed = req.user.role === 'admin' || item.patientId === req.user.id || (req.user.role === 'doctor' && data.bookings.some((booking) => booking.doctorId === req.user.id && booking.patientId === item.patientId && booking.status !== 'cancelled'));
    if (!allowed) throw httpError(403, 'FORBIDDEN', '无权下载该资料');
    await store.transaction(['audits'], (draft) => { draft.audits.push(auditEntry(req.user, 'medical_file_downloaded', 'upload', item.id, '授权用户下载患者资料')); });
    res.download(path.join(uploadDirectory, item.storedName), item.name);
  }));

  router.get('/doctor/workbench', requireRole('doctor'), asyncRoute(async (req, res) => {
    const data = store.snapshot(['bookings', 'users', 'consultations', 'reports', 'followups']);
    const bookings = data.bookings.filter((item) => item.doctorId === req.user.id && item.status === 'confirmed');
    const queue = bookings.map((booking) => {
      const patient = data.users.find((item) => item.id === booking.patientId);
      const consultation = data.consultations.find((item) => item.id === booking.consultationId);
      const report = data.reports.find((item) => item.consultationId === booking.consultationId);
      return { booking, patient: publicUser(patient), consultation, report };
    }).sort((a, b) => riskWeight[b.consultation?.riskLevel] - riskWeight[a.consultation?.riskLevel] || a.booking.appointmentAt.localeCompare(b.booking.appointmentAt));
    const followups = data.followups.filter((item) => item.doctorId === req.user.id && item.status === 'pending');
    res.json({ queue, summary: { pending: queue.length, highRisk: queue.filter((item) => ['emergency', 'high'].includes(item.consultation?.riskLevel)).length, followups: followups.length, abnormalFollowups: followups.filter((item) => item.abnormal).length } });
  }));

  router.get('/doctor/patients/:id', requireRole('doctor'), asyncRoute(async (req, res) => {
    const data = store.snapshot(['bookings', 'users', 'consultations', 'reports', 'riskAssessments', 'messages', 'dispositions', 'followups', 'uploads']);
    if (!data.bookings.some((item) => item.doctorId === req.user.id && item.patientId === req.params.id && item.status !== 'cancelled')) throw httpError(403, 'PATIENT_NOT_ASSIGNED', '该患者尚未分配给当前医生');
    const patient = data.users.find((item) => item.id === req.params.id);
    if (!patient) throw httpError(404, 'NOT_FOUND', '患者不存在');
    await store.transaction(['audits'], (draft) => { draft.audits.push(auditEntry(req.user, 'patient_record_accessed', 'user', patient.id, '医生查看患者完整资料')); });
    const patientConsultationIds = new Set(data.consultations.filter((item) => item.patientId === patient.id).map((item) => item.id));
    res.json({ patient: publicUser(patient), consultations: data.consultations.filter((item) => item.patientId === patient.id), reports: data.reports.filter((item) => item.patientId === patient.id), riskAssessments: data.riskAssessments.filter((item) => patientConsultationIds.has(item.consultationId)), messages: data.messages.filter((item) => patientConsultationIds.has(item.consultationId)), dispositions: data.dispositions.filter((item) => item.patientId === patient.id), followups: data.followups.filter((item) => item.patientId === patient.id), uploads: data.uploads.filter((item) => item.patientId === patient.id).map(({ storedName: _storedName, ...item }) => item) });
  }));

  router.post('/doctor/patients/:id/ai-analysis', requireRole('doctor'), asyncRoute(async (req, res) => {
    const data = store.snapshot(['bookings', 'consultations', 'reports', 'messages']);
    if (!data.bookings.some((item) => item.doctorId === req.user.id && item.patientId === req.params.id && item.status !== 'cancelled')) throw httpError(403, 'PATIENT_NOT_ASSIGNED', '该患者尚未分配给当前医生');
    const consultation = data.consultations.filter((item) => item.patientId === req.params.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!consultation) throw httpError(404, 'NOT_FOUND', '患者暂无问诊资料');
    const report = data.reports.find((item) => item.consultationId === consultation.id) || null;
    const messages = data.messages.filter((item) => item.consultationId === consultation.id);
    let result;
    try { result = await callDoctorAnalysis({ report, messages }); }
    catch (error) {
      await store.transaction(['modelCalls', 'audits'], (draft) => {
        draft.modelCalls.push({ id: createId('call'), consultationId: consultation.id, userId: req.user.id, model: process.env.MEDCHAT_MODEL || 'deepseek-v4-pro', success: false, error: error.code || 'MODEL_UNAVAILABLE', latencyMs: error.latencyMs || 0, purpose: 'doctor_analysis', createdAt: now() });
        draft.audits.push(auditEntry(req.user, 'doctor_ai_analysis_failed', 'consultation', consultation.id, `医生辅助分析失败：${error.code || 'MODEL_UNAVAILABLE'}`, 'failed'));
      });
      throw error;
    }
    await store.transaction(['modelCalls', 'audits'], (draft) => {
      draft.modelCalls.push({ id: createId('call'), consultationId: consultation.id, userId: req.user.id, model: result.model, success: true, error: null, latencyMs: result.latencyMs, purpose: 'doctor_analysis', createdAt: now() });
      draft.audits.push(auditEntry(req.user, 'doctor_ai_analysis', 'consultation', consultation.id, '医生请求结构化 AI 辅助分析'));
    });
    res.json({ analysis: result.analysis, model: result.model, disclaimer: '仅供参考，最终判断与处置由医生完成。' });
  }));

  router.post('/doctor/dispositions', requireRole('doctor'), asyncRoute(async (req, res) => {
    const { patientId, consultationId, diagnosis, examination, treatment, medication, rehabilitation, revisitAt, followupPlan } = req.body || {};
    if (!patientId || !diagnosis) throw httpError(400, 'INVALID_INPUT', '患者和临床诊断为必填项');
    const disposition = await store.transaction(['bookings', 'dispositions', 'audits'], (data) => {
      if (!data.bookings.some((item) => item.doctorId === req.user.id && item.patientId === patientId && item.status !== 'cancelled')) throw httpError(403, 'PATIENT_NOT_ASSIGNED', '无权为该患者提交处置');
      const created = { id: createId('dsp'), patientId, doctorId: req.user.id, consultationId: consultationId || null, diagnosis, examination: examination || '', treatment: treatment || '', medication: medication || '', rehabilitation: rehabilitation || '', revisitAt: revisitAt ? parseDate(revisitAt, '复诊时间') : null, followupPlan: followupPlan || '', submittedAt: now() };
      data.dispositions.push(created); const booking = data.bookings.find((item) => item.consultationId === consultationId && item.doctorId === req.user.id && item.status === 'confirmed'); if (booking) booking.status = 'completed'; data.audits.push(auditEntry(req.user, 'disposition_created', 'disposition', created.id, '医生提交临床处置记录')); return created;
    });
    res.status(201).json({ disposition });
  }));

  router.post('/doctor/followups', requireRole('doctor'), asyncRoute(async (req, res) => {
    const { patientId, title, type, dueAt } = req.body || {};
    if (!patientId || !title || !type || !dueAt) throw httpError(400, 'INVALID_INPUT', '患者、标题、类型和随访时间均为必填项');
    if (!followupTypes.has(type)) throw httpError(400, 'INVALID_FOLLOWUP_TYPE', '随访类型不合法');
    const normalizedDueAt = parseDate(dueAt, '随访时间');
    const followup = await store.transaction(['bookings', 'followups', 'notifications', 'audits'], (data) => {
      if (!data.bookings.some((item) => item.doctorId === req.user.id && item.patientId === patientId && item.status !== 'cancelled')) throw httpError(403, 'PATIENT_NOT_ASSIGNED', '无权为该患者创建随访');
      const created = { id: createId('fol'), patientId, doctorId: req.user.id, title, type, dueAt: normalizedDueAt, status: 'pending', abnormal: false, feedback: null, createdAt: now() };
      data.followups.push(created);
      data.notifications.push(notification(patientId, 'followup', '新的随访任务', `${req.user.name}医生安排了“${title}”，请按时完成。`, created.id));
      data.audits.push(auditEntry(req.user, 'followup_created', 'followup', created.id, '医生创建随访任务')); return created;
    });
    res.status(201).json({ followup });
  }));

  router.get('/admin/dashboard', requireRole('admin'), (req, res) => {
    const data = store.snapshot(['consultations', 'bookings', 'followups', 'modelCalls', 'users', 'feedback', 'modelConfigs']);
    const completedConsultations = data.consultations.filter((item) => item.status !== 'in_progress');
    const successfulCalls = data.modelCalls.filter((item) => item.success);
    const durations = completedConsultations.filter((item) => item.endedAt).map((item) => (new Date(item.endedAt) - new Date(item.createdAt)) / 60000);
    res.json({
      metrics: {
        consultations: data.consultations.length, bookingConversion: completedConsultations.length ? Number((data.bookings.length / completedConsultations.length * 100).toFixed(1)) : 0,
        highRisk: data.consultations.filter((item) => ['emergency', 'high'].includes(item.riskLevel)).length,
        followupCompletion: data.followups.length ? Number((data.followups.filter((item) => item.status === 'completed').length / data.followups.length * 100).toFixed(1)) : 0,
        modelSuccessRate: data.modelCalls.length ? Number((successfulCalls.length / data.modelCalls.length * 100).toFixed(1)) : 100,
        users: data.users.length, averageConsultationMinutes: durations.length ? Number((durations.reduce((sum, value) => sum + value, 0) / durations.length).toFixed(1)) : 0,
        doctorVisits: data.bookings.length, feedbackCount: data.feedback.length, feedbackAverage: data.feedback.length ? Number((data.feedback.reduce((sum, item) => sum + item.rating, 0) / data.feedback.length).toFixed(1)) : 0,
      },
      model: { config: data.modelConfigs.find((item) => item.status === 'active'), callsToday: data.modelCalls.filter((item) => item.createdAt.slice(0, 10) === now().slice(0, 10)).length, failures: data.modelCalls.filter((item) => !item.success).length, averageLatencyMs: data.modelCalls.length ? Math.round(data.modelCalls.reduce((sum, item) => sum + item.latencyMs, 0) / data.modelCalls.length) : 0 },
    });
  });

  router.get('/admin/users', requireRole('admin'), asyncRoute(async (req, res) => {
    let users = store.snapshot(['users']).users.map(publicUser);
    if (req.query.role) users = users.filter((item) => item.role === req.query.role);
    await store.transaction(['audits'], (data) => { data.audits.push(auditEntry(req.user, 'admin_user_list_accessed', 'user', 'list', `管理员查看用户列表，共 ${users.length} 条`)); });
    res.json({ users });
  }));

  router.post('/admin/users', requireRole('admin'), asyncRoute(async (req, res) => {
    const { role, name, account, phone, password } = req.body || {};
    if (!['doctor', 'admin'].includes(role) || !name || !account || !phone || !password) throw httpError(400, 'INVALID_INPUT', '仅可创建医生或管理员，必填资料不能为空');
    if (!strongPassword(password)) throw httpError(400, 'WEAK_PASSWORD', '密码至少 8 位，且必须包含字母和数字');
    const user = await store.transaction(['users', 'audits'], (data) => {
      if (data.users.some((item) => item.account === account || item.phone === phone)) throw httpError(409, 'ACCOUNT_EXISTS', '账号或手机号已存在');
      const created = { id: createId('usr'), role, name, account, phone, passwordHash: hashPassword(password), status: role === 'doctor' ? 'pending' : 'active', department: req.body.department || '', title: req.body.title || '', licenseNo: req.body.licenseNo || '', createdAt: now(), lastLoginAt: null };
      if (role === 'doctor' && !created.licenseNo) throw httpError(400, 'LICENSE_REQUIRED', '创建医生必须填写执业证书编号');
      data.users.push(created); data.audits.push(auditEntry(req.user, 'user_created', 'user', created.id, `管理员创建${role}账号`)); return created;
    });
    res.status(201).json({ user: publicUser(user) });
  }));

  router.patch('/admin/users/:id/status', requireRole('admin'), asyncRoute(async (req, res) => {
    if (!['active', 'disabled', 'pending'].includes(req.body?.status)) throw httpError(400, 'INVALID_STATUS', '账号状态不合法');
    const user = await store.transaction(['users', 'audits'], (data) => {
      const target = data.users.find((item) => item.id === req.params.id); if (!target) throw httpError(404, 'NOT_FOUND', '用户不存在');
      if (target.id === req.user.id && req.body.status === 'disabled') throw httpError(409, 'CANNOT_DISABLE_SELF', '不能禁用当前登录账号');
      target.status = req.body.status; data.audits.push(auditEntry(req.user, 'user_status_changed', 'user', target.id, `账号状态修改为 ${target.status}`)); return target;
    });
    res.json({ user: publicUser(user) });
  }));

  router.post('/admin/schedules', requireRole('admin'), asyncRoute(async (req, res) => {
    const { doctorId, departmentId, campus, startAt, endAt, capacity } = req.body || {};
    if (!doctorId || !departmentId || !campus || !startAt || !endAt || !Number.isInteger(Number(capacity)) || Number(capacity) < 1) throw httpError(400, 'INVALID_INPUT', '排班资料不完整');
    const normalizedStartAt = parseDate(startAt, '开始时间'); const normalizedEndAt = parseDate(endAt, '结束时间');
    const schedule = await store.transaction(['users', 'departments', 'schedules', 'audits'], (data) => {
      if (!data.users.some((item) => item.id === doctorId && item.role === 'doctor' && item.status === 'active')) throw httpError(400, 'INVALID_DOCTOR', '医生不存在或尚未审核');
      if (!data.departments.some((item) => item.id === departmentId && item.enabled)) throw httpError(400, 'INVALID_DEPARTMENT', '科室不存在或已停用');
      const start = normalizedStartAt; const end = normalizedEndAt;
      if (start >= end) throw httpError(400, 'INVALID_TIME_RANGE', '结束时间必须晚于开始时间');
      if (data.schedules.some((item) => item.doctorId === doctorId && item.status !== 'cancelled' && start < item.endAt && end > item.startAt)) throw httpError(409, 'SCHEDULE_CONFLICT', '该医生此时段已有排班');
      const created = { id: createId('sch'), doctorId, departmentId, campus, startAt: start, endAt: end, capacity: Number(capacity), remaining: Number(capacity), status: 'open', createdAt: now() };
      data.schedules.push(created); data.audits.push(auditEntry(req.user, 'schedule_created', 'schedule', created.id, '管理员创建医生排班')); return created;
    });
    res.status(201).json({ schedule });
  }));

  router.patch('/admin/schedules/:id', requireRole('admin'), asyncRoute(async (req, res) => {
    const schedule = await store.transaction(['schedules', 'audits'], (data) => {
      const target = data.schedules.find((item) => item.id === req.params.id); if (!target) throw httpError(404, 'NOT_FOUND', '排班不存在');
      if (req.body.status && !['open', 'closed', 'cancelled'].includes(req.body.status)) throw httpError(400, 'INVALID_STATUS', '排班状态不合法');
      if (req.body.status) target.status = req.body.status;
      if (Number.isInteger(Number(req.body.capacity)) && Number(req.body.capacity) >= target.capacity - target.remaining) { const booked = target.capacity - target.remaining; target.capacity = Number(req.body.capacity); target.remaining = target.capacity - booked; }
      data.audits.push(auditEntry(req.user, 'schedule_updated', 'schedule', target.id, '管理员更新排班')); return target;
    });
    res.json({ schedule });
  }));

  router.post('/admin/knowledge', requireRole('admin'), asyncRoute(async (req, res) => {
    const { category, title, summary, content } = req.body || {};
    if (!category || !title || !summary || !content) throw httpError(400, 'INVALID_INPUT', '知识内容字段不能为空');
    const item = await store.transaction(['knowledge', 'audits'], (data) => {
      const created = { id: createId('kb'), category, title, summary, content, status: req.body.status === 'draft' ? 'draft' : 'published', updatedAt: now() };
      data.knowledge.push(created); data.audits.push(auditEntry(req.user, 'knowledge_created', 'knowledge', created.id, '管理员新增知识内容')); return created;
    });
    res.status(201).json({ item });
  }));

  router.patch('/admin/knowledge/:id', requireRole('admin'), asyncRoute(async (req, res) => {
    if (req.body.status !== undefined && !['draft', 'published', 'inactive'].includes(req.body.status)) throw httpError(400, 'INVALID_STATUS', '知识内容状态不合法');
    const item = await store.transaction(['knowledge', 'audits'], (data) => {
      const target = data.knowledge.find((entry) => entry.id === req.params.id); if (!target) throw httpError(404, 'NOT_FOUND', '知识内容不存在');
      for (const key of ['category', 'title', 'summary', 'content', 'status']) if (req.body[key] !== undefined) target[key] = req.body[key];
      target.updatedAt = now(); data.audits.push(auditEntry(req.user, 'knowledge_updated', 'knowledge', target.id, '管理员更新知识内容')); return target;
    });
    res.json({ item });
  }));

  router.get('/admin/risk-rules', requireRole('admin'), (_req, res) => res.json({ rules: store.snapshot(['riskRules']).riskRules }));

  router.post('/admin/risk-rules', requireRole('admin'), asyncRoute(async (req, res) => {
    const label = String(req.body?.label || '').trim(); const keywords = Array.isArray(req.body?.keywords) ? req.body.keywords.map((item) => String(item).trim()).filter(Boolean) : [];
    if (!label || !keywords.length) throw httpError(400, 'INVALID_RULE', '规则名称和至少一个关键词为必填项');
    const rule = await store.transaction(['riskRules', 'audits'], (data) => {
      const created = { id: createId('rule'), label, keywords: [...new Set(keywords)].slice(0, 30), enabled: true, updatedAt: now() };
      data.riskRules.push(created); data.audits.push(auditEntry(req.user, 'risk_rule_created', 'risk_rule', created.id, `新增危险信号规则 ${label}，立即生效`)); return created;
    });
    res.status(201).json({ rule });
  }));

  router.patch('/admin/risk-rules/:id', requireRole('admin'), asyncRoute(async (req, res) => {
    const rule = await store.transaction(['riskRules', 'audits'], (data) => {
      const target = data.riskRules.find((item) => item.id === req.params.id); if (!target) throw httpError(404, 'NOT_FOUND', '危险信号规则不存在');
      if (typeof req.body.enabled === 'boolean') target.enabled = req.body.enabled;
      if (Array.isArray(req.body.keywords) && req.body.keywords.length) target.keywords = [...new Set(req.body.keywords.map((item) => String(item).trim()).filter(Boolean))].slice(0, 30);
      target.updatedAt = now(); data.audits.push(auditEntry(req.user, 'risk_rule_updated', 'risk_rule', target.id, `危险信号规则 ${target.label} 已更新并立即生效`)); return target;
    });
    res.json({ rule });
  }));

  router.get('/admin/models', requireRole('admin'), (req, res) => {
    const data = store.snapshot(['modelConfigs', 'modelCalls']);
    res.json({ configs: data.modelConfigs, calls: data.modelCalls.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100) });
  });

  router.post('/admin/models', requireRole('admin'), asyncRoute(async (req, res) => {
    const { model, baseUrl, promptVersion } = req.body || {};
    let parsedUrl; try { parsedUrl = new URL(baseUrl); } catch { throw httpError(400, 'INVALID_URL', '模型服务地址格式不正确'); }
    if (parsedUrl.protocol !== 'https:' || /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/.test(parsedUrl.hostname)) throw httpError(400, 'UNSAFE_MODEL_URL', '模型服务必须使用公网 HTTPS 地址');
    if (!model || !promptVersion) throw httpError(400, 'INVALID_INPUT', '模型名和提示词版本不能为空');
    const config = await store.transaction(['modelConfigs', 'audits'], (data) => {
      if (data.modelConfigs.some((item) => item.model === model && item.promptVersion === promptVersion)) throw httpError(409, 'MODEL_VERSION_EXISTS', '相同模型和提示词版本已存在');
      const created = { id: createId('mdl'), model, baseUrl: baseUrl.replace(/\/$/, ''), promptVersion, status: 'inactive', createdAt: now() };
      data.modelConfigs.push(created); data.audits.push(auditEntry(req.user, 'model_config_created', 'model', created.id, `新增模型配置 ${model}/${promptVersion}`)); return created;
    });
    res.status(201).json({ config });
  }));

  router.patch('/admin/models/:id/activate', requireRole('admin'), asyncRoute(async (req, res) => {
    const data = store.snapshot(['modelConfigs']); const target = data.modelConfigs.find((item) => item.id === req.params.id);
    if (!target) throw httpError(404, 'NOT_FOUND', '模型配置不存在');
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${target.baseUrl}/models`, { headers: { Authorization: `Bearer ${process.env.MEDCHAT_API_KEY}` }, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch { throw httpError(409, 'MODEL_UNREACHABLE', '新模型服务不可达，已保留原生效版本'); }
    finally { clearTimeout(timeout); }
    const config = await store.transaction(['modelConfigs', 'audits'], (draft) => {
      for (const item of draft.modelConfigs) item.status = item.id === target.id ? 'active' : 'inactive';
      const activated = draft.modelConfigs.find((item) => item.id === target.id);
      draft.audits.push(auditEntry(req.user, 'model_activated', 'model', activated.id, `切换生效模型为 ${activated.model}/${activated.promptVersion}`)); return activated;
    });
    configureRuntimeModel(config); res.json({ config });
  }));

  router.get('/admin/audits', requireRole('admin'), (req, res) => {
    let audits = store.snapshot(['audits']).audits.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (req.query.action) audits = audits.filter((item) => item.action === req.query.action);
    res.json({ audits: audits.slice(0, Math.min(Number(req.query.limit) || 100, 500)) });
  });

  router.use(async (error, req, res, _next) => {
    const modelStatus = error.code === 'MODEL_TIMEOUT' ? 504 : error.code === 'MODEL_NOT_CONFIGURED' ? 503 : ['MODEL_UPSTREAM_ERROR', 'INVALID_MODEL_RESPONSE'].includes(error.code) ? 502 : null;
    const status = error.status || (error instanceof multer.MulterError ? 400 : modelStatus || 500);
    if (status === 403 && req.user && !error.auditRecorded) {
      try { await store.transaction(['audits'], (data) => { data.audits.push(auditEntry(req.user, 'permission_denied', 'route', req.path, `对象级权限拒绝：${req.method} ${req.originalUrl}`, 'blocked')); }); }
      catch (auditError) { console.error('Permission audit failed:', auditError); }
    }
    if (status >= 500) console.error(error);
    res.status(status).json({ error: error.code || 'INTERNAL_ERROR', message: status >= 500 ? '服务暂时不可用，请稍后重试' : error.message, requestId: req.headers['x-request-id'] || null });
  });

  return router;
}
