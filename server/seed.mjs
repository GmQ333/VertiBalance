import { hashPassword } from './security.mjs';

const now = new Date();
const iso = (offsetHours = 0) => new Date(now.getTime() + offsetHours * 3600000).toISOString();

export function createSeedData() {
  const commonPassword = hashPassword('Verti123!');
  return {
    meta: { schemaVersion: 3, createdAt: iso() },
    users: [
      { id: 'usr_patient_demo', role: 'patient', name: '苏晴', account: 'patient@demo.com', phone: '13800000001', passwordHash: commonPassword, status: 'active', gender: '女', age: 34, createdAt: iso(-720), lastLoginAt: null },
      { id: 'usr_patient_lin', role: 'patient', name: '林晓雯', account: 'lin@demo.com', phone: '13800000011', passwordHash: commonPassword, status: 'active', gender: '女', age: 56, createdAt: iso(-1000), lastLoginAt: null },
      { id: 'usr_patient_zhou', role: 'patient', name: '周建国', account: 'zhou@demo.com', phone: '13800000012', passwordHash: commonPassword, status: 'active', gender: '男', age: 68, createdAt: iso(-980), lastLoginAt: null },
      { id: 'usr_patient_zhao', role: 'patient', name: '赵敏', account: 'zhao@demo.com', phone: '13800000013', passwordHash: commonPassword, status: 'active', gender: '女', age: 39, createdAt: iso(-960), lastLoginAt: null },
      { id: 'usr_doctor_demo', role: 'doctor', name: '张明远', account: 'doctor@demo.com', phone: '13900000001', passwordHash: commonPassword, status: 'active', department: '神经内科', title: '主任医师', licenseNo: '110110101000001', createdAt: iso(-2000), lastLoginAt: null },
      { id: 'usr_doctor_li', role: 'doctor', name: '李若安', account: 'li.doctor@demo.com', phone: '13900000002', passwordHash: commonPassword, status: 'active', department: '耳鼻喉科', title: '副主任医师', licenseNo: '110110101000002', createdAt: iso(-1800), lastLoginAt: null },
      { id: 'usr_admin_demo', role: 'admin', name: '陈琳', account: 'admin@demo.com', phone: '13700000001', passwordHash: commonPassword, status: 'active', createdAt: iso(-3000), lastLoginAt: null },
    ],
    departments: [
      { id: 'dept_neuro', name: '神经内科', campus: '滨江院区', enabled: true },
      { id: 'dept_ent', name: '耳鼻喉科', campus: '滨江院区', enabled: true },
      { id: 'dept_vertigo', name: '眩晕专病门诊', campus: '中心院区', enabled: true },
    ],
    consultations: [
      { id: 'con_lin_001', patientId: 'usr_patient_lin', status: 'transferred', riskLevel: 'high', dangerSignals: ['无法独立行走'], createdAt: iso(-2), endedAt: iso(-1.4), assignedDoctorId: 'usr_doctor_demo' },
      { id: 'con_zhou_001', patientId: 'usr_patient_zhou', status: 'transferred', riskLevel: 'medium', dangerSignals: [], createdAt: iso(-26), endedAt: iso(-25.5), assignedDoctorId: 'usr_doctor_demo' },
      { id: 'con_zhao_001', patientId: 'usr_patient_zhao', status: 'transferred', riskLevel: 'low', dangerSignals: [], createdAt: iso(-18), endedAt: iso(-17.5), assignedDoctorId: 'usr_doctor_demo' },
    ],
    messages: [
      { id: 'msg_1', consultationId: 'con_lin_001', role: 'assistant', content: '请描述这次眩晕是如何发生的。', createdAt: iso(-2) },
      { id: 'msg_2', consultationId: 'con_lin_001', role: 'user', content: '今早突然天旋地转，持续四十分钟，现在走路需要扶墙。', createdAt: iso(-1.9) },
      { id: 'msg_3', consultationId: 'con_lin_001', role: 'assistant', content: '描述中包含需要紧急关注的信号，建议立即前往急诊并由家人陪同。', createdAt: iso(-1.8) },
      { id: 'msg_4', consultationId: 'con_zhou_001', role: 'user', content: '晨起翻身时会短暂旋转，大约二十秒，伴轻微恶心。', createdAt: iso(-26) },
      { id: 'msg_5', consultationId: 'con_zhao_001', role: 'user', content: '前庭性偏头痛复诊后症状稳定，偶尔有轻微头昏。', createdAt: iso(-18) },
    ],
    reports: [
      { id: 'rpt_lin_001', consultationId: 'con_lin_001', patientId: 'usr_patient_lin', chiefComplaint: '突发持续性旋转感伴行走不稳', episodeFeatures: '突然发作，持续约 40 分钟', triggers: '无明确体位诱因', accompanyingSymptoms: '恶心、明显行走不稳', dangerSignals: ['无法独立行走'], history: '高血压 8 年', medications: '降压药，具体药名待补充', aiRiskNote: '存在中枢性眩晕相关危险信号，建议立即急诊评估。', recommendedDepartment: '神经内科/急诊', riskLevel: 'high', createdAt: iso(-1.4) },
      { id: 'rpt_zhou_001', consultationId: 'con_zhou_001', patientId: 'usr_patient_zhou', chiefComplaint: '体位变化诱发短暂旋转感', episodeFeatures: '反复发作，每次约 20 秒', triggers: '晨起、翻身', accompanyingSymptoms: '轻微恶心', dangerSignals: [], history: '未采集', medications: '未采集', aiRiskNote: '症状可能与位置性眩晕方向相关，建议专科进一步检查。', recommendedDepartment: '耳鼻喉科/眩晕门诊', riskLevel: 'medium', createdAt: iso(-25.5) },
      { id: 'rpt_zhao_001', consultationId: 'con_zhao_001', patientId: 'usr_patient_zhao', chiefComplaint: '复诊后症状稳定，偶有轻微头昏', episodeFeatures: '偶发，每次数分钟', triggers: '熬夜后明显', accompanyingSymptoms: '无明显恶心', dangerSignals: [], history: '前庭性偏头痛', medications: '按医嘱用药', aiRiskNote: '当前未发现危险信号，建议继续观察并按计划复诊。', recommendedDepartment: '眩晕专病门诊', riskLevel: 'low', createdAt: iso(-17.5) },
    ],
    riskAssessments: [
      { id: 'rsk_lin_001', consultationId: 'con_lin_001', ruleRiskLevel: 'high', modelRiskLevel: null, finalRiskLevel: 'high', recommendedDepartment: '神经内科/急诊', careTimeframe: '立即急诊', immediateCare: true, possibleDirections: ['可能涉及中枢性眩晕方向'], dangerSignals: ['无法独立行走'], createdAt: iso(-1.9) },
      { id: 'rsk_zhou_001', consultationId: 'con_zhou_001', ruleRiskLevel: 'medium', modelRiskLevel: null, finalRiskLevel: 'medium', recommendedDepartment: '耳鼻喉科/眩晕门诊', careTimeframe: '一周内', immediateCare: false, possibleDirections: ['可能涉及外周前庭性眩晕方向'], dangerSignals: [], createdAt: iso(-25.9) },
      { id: 'rsk_zhao_001', consultationId: 'con_zhao_001', ruleRiskLevel: 'low', modelRiskLevel: null, finalRiskLevel: 'low', recommendedDepartment: '眩晕专病门诊', careTimeframe: '按计划复诊', immediateCare: false, possibleDirections: ['前庭性偏头痛恢复期'], dangerSignals: [], createdAt: iso(-17.9) },
    ],
    schedules: [
      { id: 'sch_zhang_1', doctorId: 'usr_doctor_demo', departmentId: 'dept_neuro', campus: '滨江院区', startAt: iso(20), endAt: iso(24), capacity: 12, remaining: 10, status: 'open', createdAt: iso(-200) },
      { id: 'sch_li_1', doctorId: 'usr_doctor_li', departmentId: 'dept_ent', campus: '滨江院区', startAt: iso(28), endAt: iso(32), capacity: 10, remaining: 8, status: 'open', createdAt: iso(-190) },
      { id: 'sch_zhang_2', doctorId: 'usr_doctor_demo', departmentId: 'dept_vertigo', campus: '中心院区', startAt: iso(68), endAt: iso(72), capacity: 8, remaining: 8, status: 'open', createdAt: iso(-180) },
    ],
    bookings: [
      { id: 'bok_lin_001', consultationId: 'con_lin_001', patientId: 'usr_patient_lin', doctorId: 'usr_doctor_demo', scheduleId: 'sch_zhang_1', department: '神经内科', campus: '滨江院区', appointmentAt: iso(20), status: 'confirmed', createdAt: iso(-1.3) },
      { id: 'bok_zhou_001', consultationId: 'con_zhou_001', patientId: 'usr_patient_zhou', doctorId: 'usr_doctor_demo', scheduleId: 'sch_zhang_1', department: '神经内科', campus: '滨江院区', appointmentAt: iso(-25), status: 'completed', createdAt: iso(-26) },
      { id: 'bok_zhao_001', consultationId: 'con_zhao_001', patientId: 'usr_patient_zhao', doctorId: 'usr_doctor_demo', scheduleId: 'sch_zhang_1', department: '神经内科', campus: '滨江院区', appointmentAt: iso(22), status: 'confirmed', createdAt: iso(-17) },
    ],
    dispositions: [],
    followups: [
      { id: 'fol_demo_1', patientId: 'usr_patient_demo', doctorId: 'usr_doctor_demo', title: '症状恢复随访', type: 'questionnaire', dueAt: iso(48), status: 'pending', abnormal: false, feedback: null, createdAt: iso(-20) },
      { id: 'fol_demo_2', patientId: 'usr_patient_demo', doctorId: 'usr_doctor_demo', title: '前庭康复训练', type: 'rehabilitation', dueAt: iso(72), status: 'pending', abnormal: false, feedback: null, createdAt: iso(-20) },
      { id: 'fol_lin_1', patientId: 'usr_patient_lin', doctorId: 'usr_doctor_demo', title: '急诊后症状复核', type: 'questionnaire', dueAt: iso(24), status: 'pending', abnormal: true, feedback: null, createdAt: iso(-1) },
    ],
    notifications: [],
    uploads: [],
    feedback: [],
    riskRules: [
      { id: 'rule_speech', label: '言语不清', keywords: ['说话不清', '言语不清', '口角歪'], enabled: true, updatedAt: iso(-500) },
      { id: 'rule_weakness', label: '单侧肢体无力或麻木', keywords: ['一边手臂没有力气', '单侧无力', '单侧麻木'], enabled: true, updatedAt: iso(-500) },
      { id: 'rule_walking', label: '无法站立或行走', keywords: ['站不起来', '走不了', '需要扶墙'], enabled: true, updatedAt: iso(-500) },
    ],
    knowledge: [
      { id: 'kb_1', category: '就医准备', title: '眩晕就诊前，需要准备哪些信息？', summary: '记录发作时间、持续时长、诱因、伴随症状和用药，有助于医生快速判断。', content: '建议记录首次发作时间、单次持续时长、是否由转头或翻身诱发，以及有无耳鸣、听力变化、复视、言语不清和肢体无力。', status: 'published', updatedAt: iso(-72) },
      { id: 'kb_2', category: '危险信号', title: '什么样的头晕需要立即去急诊？', summary: '出现言语不清、单侧无力、复视或无法站立时应立即就医。', content: '如眩晕同时伴有言语不清、单侧肢体无力或麻木、复视、意识异常、无法站立行走或突发剧烈头痛，应立即前往急诊或呼叫 120。', status: 'published', updatedAt: iso(-96) },
      { id: 'kb_3', category: '康复训练', title: '前庭康复训练注意事项', summary: '训练应循序渐进，并在安全环境或专业指导下进行。', content: '训练前确保周围无障碍物，初次训练建议家人陪同。症状明显加重或出现新的危险信号时停止训练并就医。', status: 'published', updatedAt: iso(-120) },
    ],
    modelConfigs: [
      { id: 'mdl_deepseek_v4', model: 'deepseek-v4-pro', baseUrl: 'https://api.modagent-homing.com/v1', promptVersion: 'v1.3', status: 'active', createdAt: iso(-500) },
    ],
    modelCalls: [],
    audits: [
      { id: 'aud_seed_1', actorId: 'system', actorName: '系统', action: 'system_initialized', objectType: 'platform', objectId: 'vertibalance', detail: '平台数据存储初始化', status: 'success', createdAt: iso(-3000) },
    ],
  };
}
