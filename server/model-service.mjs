const MEDICAL_GUARDRAIL = `你是眩衡平台的眩晕专病预问诊助手。你的职责是采集信息、识别危险信号和建议就医方向，不能确诊或替代医生。
请使用简洁、温和、患者易懂的中文，每次只追问一个最关键问题。
优先询问：发作方式和持续时间、体位诱发、听力/耳鸣、恶心呕吐、行走能力、复视/言语不清/单侧无力、既往病史与用药。
如发现突发严重头痛、言语不清、单侧肢体无力或麻木、复视、意识异常、无法站立行走等危险信号，必须明确建议立即前往急诊或呼叫 120，并停止普通健康建议。
禁止使用“已确诊、可以排除、一定没问题、无需就医、绝对安全”等确定性表述。始终注明内容仅供辅助筛查。`;

const PATIENT_TURN_PROMPT = `${MEDICAL_GUARDRAIL}
只输出 JSON，不要输出 Markdown。字段必须为：
question（下一条给患者的简短追问或安全提示）、riskLevel（low/medium/high/emergency）、dangerSignals（字符串数组）、possibleDirections（字符串数组）、recommendedDepartment（字符串）、careTimeframe（字符串）、immediateCare（布尔值）、readyToComplete（布尔值）、collectedFields（字符串数组）。
collectedFields 只能使用 symptom、onset、duration、trigger、associated、danger、history、medication。
信息不足时继续追问且 readyToComplete=false。禁止输出确定性诊断。`;

const PATIENT_REPORT_PROMPT = `${MEDICAL_GUARDRAIL}
请将完整问诊整理为患者可读的结构化报告。只输出 JSON，不要输出 Markdown。字段必须为：
chiefComplaint、episodeFeatures、triggers、accompanyingSymptoms、history、medications、aiRiskNote、recommendedDepartment、careTimeframe（字符串），dangerSignals、possibleDirections（字符串数组），riskLevel（low/medium/high/emergency），immediateCare（布尔值）。
缺失信息填写“未采集”，疾病方向必须使用“可能涉及/需进一步评估”等非确定性表述。`;

const riskLevels = new Set(['low', 'medium', 'high', 'emergency']);
const collectedFieldNames = new Set(['symptom', 'onset', 'duration', 'trigger', 'associated', 'danger', 'history', 'medication']);

let runtimeModelConfig = null;
export function configureRuntimeModel(config) { runtimeModelConfig = config || null; }

const signalRules = [
  ['言语不清', /言语不清|说话不清|口角歪/],
  ['单侧肢体无力或麻木', /单侧.{0,8}(无力|麻木|没.{0,2}力)|一边.{0,8}(无力|麻木|没.{0,2}力)/],
  ['复视', /复视|看东西重影/],
  ['意识异常', /意识.{0,4}(不清|异常)|昏迷|晕厥/],
  ['无法站立或行走', /无法.{0,5}(站立|行走)|站不起来|走不了|需要扶墙/],
  ['突发严重头痛', /突发.{0,5}(严重|剧烈).{0,3}头痛|剧烈头痛/],
];

const negationPrefix = /(?:没有|并无|并未|无|未见|未出现|否认|不伴有|不伴|没出现|不是)(?:任何|明显|上述|这些)?\s*$/;
const clauseBoundary = /[。！？；;，,]|但是|但|然而|不过|却/g;

function isNegated(content, matchIndex) {
  const beforeMatch = content.slice(0, matchIndex);
  const immediatePrefix = beforeMatch.slice(-12);
  if (negationPrefix.test(immediatePrefix)) return true;

  let boundaryEnd = 0;
  for (const match of beforeMatch.matchAll(clauseBoundary)) boundaryEnd = match.index + match[0].length;
  const clausePrefix = beforeMatch.slice(boundaryEnd).trim();
  return /^(?:没有|并无|并未|无|未见|未出现|否认|不伴有|不伴|没出现)/.test(clausePrefix);
}

function hasNonNegatedMatch(content, pattern) {
  const matcher = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  for (const match of content.matchAll(matcher)) {
    if (!isNegated(content, match.index)) return true;
  }
  return false;
}

function includesNonNegatedKeyword(content, keyword) {
  let index = content.indexOf(keyword);
  while (index >= 0) {
    if (!isNegated(content, index)) return true;
    index = content.indexOf(keyword, index + keyword.length);
  }
  return false;
}

export function screenRisk(content = '', customRules = []) {
  const configuredSignals = customRules
    .filter((rule) => rule.enabled && Array.isArray(rule.keywords) && rule.keywords.some((keyword) => keyword && includesNonNegatedKeyword(content, keyword)))
    .map((rule) => rule.label);
  const dangerSignals = [...new Set([
    ...signalRules.filter(([, rule]) => hasNonNegatedMatch(content, rule)).map(([name]) => name),
    ...configuredSignals,
  ])];
  const highRiskHistory = ['房颤', '脑卒中', '高血压', '糖尿病', '冠心病'].some((keyword) => includesNonNegatedKeyword(content, keyword));
  return {
    dangerSignals,
    riskLevel: dangerSignals.length ? 'emergency' : highRiskHistory ? 'high' : 'medium',
  };
}

export function redactUnsafeClaims(text = '') {
  return text
    .replaceAll('已经确诊', '可能涉及').replaceAll('已确诊', '可能涉及')
    .replaceAll('可以排除', '目前信息不足以判断').replaceAll('无需就医', '可结合症状变化咨询医生')
    .replaceAll('绝对安全', '当前未见明确危险信号，但仍需留意变化')
    .replaceAll('一定没问题', '当前信息有限，建议持续观察并按需就医');
}

export async function callMedicalModel(messages, systemPrompt = MEDICAL_GUARDRAIL, pinnedConfig = null) {
  if (!process.env.MEDCHAT_API_KEY) {
    const error = new Error('智能问诊服务尚未配置，请联系管理员。');
    error.code = 'MODEL_NOT_CONFIGURED';
    throw error;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const startedAt = Date.now();
  try {
    const config = pinnedConfig || runtimeModelConfig || {};
    const model = config.model || process.env.MEDCHAT_MODEL || 'deepseek-v4-pro';
    const baseUrl = config.baseUrl || process.env.MEDCHAT_API_BASE_URL || 'https://api.modagent-homing.com/v1';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MEDCHAT_API_KEY}` },
      body: JSON.stringify({
        model, temperature: 0.25,
        messages: [{ role: 'system', content: systemPrompt }, ...messages.slice(-20)],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error('智能问诊服务暂时不可用，已保留您的描述。');
      error.code = 'MODEL_UPSTREAM_ERROR'; error.upstreamStatus = response.status;
      throw error;
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) { const error = new Error('智能问诊返回内容异常，请稍后重试。'); error.code = 'INVALID_MODEL_RESPONSE'; throw error; }
    return { content: redactUnsafeClaims(content), latencyMs: Date.now() - startedAt, model };
  } catch (error) {
    if (error.name === 'AbortError') { error.code = 'MODEL_TIMEOUT'; error.message = '问诊服务响应超时，建议稍后重试或直接咨询医生。'; }
    error.latencyMs = Date.now() - startedAt;
    throw error;
  } finally { clearTimeout(timeout); }
}

function parseModelJson(content) {
  return JSON.parse(content.replace(/^```json\s*|\s*```$/g, '').trim());
}

function invalidStructuredResponse(result, message) {
  const error = new Error(message);
  error.code = 'INVALID_MODEL_RESPONSE';
  error.latencyMs = result.latencyMs;
  error.model = result.model;
  return error;
}

function safeText(value, fallback = '未采集') {
  return redactUnsafeClaims(typeof value === 'string' && value.trim() ? value.trim() : fallback);
}

function safeTextArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => safeText(item.trim())).slice(0, 12) : [];
}

export async function callPatientTurn(messages, pinnedConfig = null) {
  const result = await callMedicalModel(messages, PATIENT_TURN_PROMPT, pinnedConfig);
  let parsed;
  try { parsed = parseModelJson(result.content); }
  catch { throw invalidStructuredResponse(result, '智能问诊返回结构异常，请稍后重试。'); }
  if (!parsed || typeof parsed !== 'object' || !riskLevels.has(parsed.riskLevel) || typeof parsed.question !== 'string' || typeof parsed.immediateCare !== 'boolean' || typeof parsed.readyToComplete !== 'boolean') {
    throw invalidStructuredResponse(result, '智能问诊返回字段不完整，请稍后重试。');
  }
  return {
    ...result,
    turn: {
      question: safeText(parsed.question, '请继续描述症状变化。'),
      riskLevel: parsed.riskLevel,
      dangerSignals: safeTextArray(parsed.dangerSignals),
      possibleDirections: safeTextArray(parsed.possibleDirections),
      recommendedDepartment: safeText(parsed.recommendedDepartment, '眩晕专病门诊'),
      careTimeframe: safeText(parsed.careTimeframe, '建议咨询医生'),
      immediateCare: parsed.immediateCare,
      readyToComplete: parsed.readyToComplete,
      collectedFields: Array.isArray(parsed.collectedFields) ? [...new Set(parsed.collectedFields.filter((item) => collectedFieldNames.has(item)))] : [],
    },
  };
}

export async function callPatientReport({ consultation, messages }, pinnedConfig = null) {
  const payload = JSON.stringify({
    riskLevel: consultation.riskLevel,
    dangerSignals: consultation.dangerSignals,
    conversation: messages.map(({ role, content }) => ({ role, content })),
  });
  const result = await callMedicalModel([{ role: 'user', content: payload }], PATIENT_REPORT_PROMPT, pinnedConfig);
  let parsed;
  try { parsed = parseModelJson(result.content); }
  catch { throw invalidStructuredResponse(result, '问诊报告结构异常，已改用保守报告。'); }
  const requiredStrings = ['chiefComplaint', 'episodeFeatures', 'triggers', 'accompanyingSymptoms', 'history', 'medications', 'aiRiskNote', 'recommendedDepartment', 'careTimeframe'];
  if (!parsed || typeof parsed !== 'object' || !riskLevels.has(parsed.riskLevel) || !requiredStrings.every((key) => typeof parsed[key] === 'string') || typeof parsed.immediateCare !== 'boolean') {
    throw invalidStructuredResponse(result, '问诊报告字段不完整，已改用保守报告。');
  }
  return {
    ...result,
    report: {
      ...Object.fromEntries(requiredStrings.map((key) => [key, safeText(parsed[key])])),
      dangerSignals: safeTextArray(parsed.dangerSignals),
      possibleDirections: safeTextArray(parsed.possibleDirections),
      riskLevel: parsed.riskLevel,
      immediateCare: parsed.immediateCare,
      generationSource: 'model',
    },
  };
}

export async function callDoctorAnalysis({ report, messages }) {
  const prompt = `你是眩晕专病临床辅助分析助手，使用中文为已认证医生整理资料。只能提供参考方向，不能替医生作最终判断。
输出严格 JSON，不要 Markdown，字段必须为：symptomHighlights（字符串数组）、followupQuestions（字符串数组）、differentialDirections（字符串数组且必须使用“可能/需鉴别”表述）、dangerSignals（字符串数组）、suggestedExams（字符串数组）、structuredSummary（字符串）。
禁止覆盖医生意见，禁止使用“已确诊、可以排除、一定”等确定性结论。`;
  const context = JSON.stringify({ report, conversation: messages.map(({ role, content }) => ({ role, content })) });
  const response = await callMedicalModel([{ role: 'user', content: `请分析以下已脱敏问诊资料：${context}` }], prompt);
  try {
    const parsed = JSON.parse(response.content.replace(/^```json\s*|\s*```$/g, ''));
    const keys = ['symptomHighlights', 'followupQuestions', 'differentialDirections', 'dangerSignals', 'suggestedExams'];
    if (!keys.every((key) => Array.isArray(parsed[key])) || typeof parsed.structuredSummary !== 'string') throw new Error('invalid structure');
    return { analysis: parsed, ...response };
  } catch {
    return { analysis: { symptomHighlights: [report?.chiefComplaint || '详见原始问诊'], followupQuestions: ['进一步确认眼震特点及神经系统伴随症状', '核对既往病史和当前用药'], differentialDirections: ['可能涉及外周前庭性眩晕方向', '需鉴别中枢性眩晕方向'], dangerSignals: report?.dangerSignals || [], suggestedExams: ['神经系统查体', '眼震及前庭功能评估', '结合风险按需影像学检查'], structuredSummary: redactUnsafeClaims(response.content) }, ...response };
  }
}

export async function callDoctorQuestion({ report, messages, analysis, history = [], question }) {
  const prompt = `你是眩晕专病临床辅助问答助手。医生已经查看了结构化分析，现在需要针对一个具体问题继续整理信息。请只提供鉴别思路、需要补充的证据、建议追问或检查方向，不得替代医生作出最终诊断。若资料提示言语含糊、单侧无力、复视、意识异常或无法站立行走等危险信号，必须优先提醒及时急诊评估。回答使用简洁、清楚的中文，并明确说明不确定性。`;
  const safeAnalysis = analysis && typeof analysis === 'object' ? {
    symptomHighlights: Array.isArray(analysis.symptomHighlights) ? analysis.symptomHighlights.slice(0, 8) : [],
    followupQuestions: Array.isArray(analysis.followupQuestions) ? analysis.followupQuestions.slice(0, 8) : [],
    differentialDirections: Array.isArray(analysis.differentialDirections) ? analysis.differentialDirections.slice(0, 8) : [],
    dangerSignals: Array.isArray(analysis.dangerSignals) ? analysis.dangerSignals.slice(0, 8) : [],
    suggestedExams: Array.isArray(analysis.suggestedExams) ? analysis.suggestedExams.slice(0, 8) : [],
    structuredSummary: typeof analysis.structuredSummary === 'string' ? analysis.structuredSummary.slice(0, 2000) : '',
  } : null;
  const safeHistory = Array.isArray(history) ? history.slice(-8).map(({ role, content }) => ({ role, content: String(content || '').slice(0, 1000) })) : [];
  const context = JSON.stringify({ report, conversation: messages.map(({ role, content }) => ({ role, content })), structuredAnalysis: safeAnalysis, followup: safeHistory, question });
  const response = await callMedicalModel([{ role: 'user', content: `请基于以下已脱敏资料回答医生追问：${context}` }], prompt);
  return { answer: response.content, ...response };
}

export function buildReport(consultation, messages) {
  const userText = messages.filter((message) => message.role === 'user').map((message) => message.content).join('；');
  const positional = /翻身|转头|起床|体位/.test(userText);
  const hearing = /耳鸣|听力下降|耳闷/.test(userText);
  const nausea = /恶心|呕吐/.test(userText);
  const signals = consultation.dangerSignals || [];
  const riskLevel = consultation.riskLevel || 'medium';
  return {
    chiefComplaint: userText.slice(0, 160) || '未采集',
    episodeFeatures: /持续/.test(userText) ? userText.slice(0, 120) : '发作持续时长待进一步采集',
    triggers: positional ? '可能与体位变化相关' : '未发现明确体位诱因',
    accompanyingSymptoms: [hearing && '耳部症状', nausea && '恶心或呕吐'].filter(Boolean).join('、') || '未采集',
    dangerSignals: signals,
    history: /高血压|糖尿病|房颤|脑卒中/.test(userText) ? '描述中提及高危基础疾病，详见原始对话' : '未采集或未提及',
    medications: /用药|药/.test(userText) ? '描述中提及用药，详见原始对话' : '未采集',
    possibleDirections: signals.length ? ['可能涉及中枢性眩晕方向，需急诊进一步评估'] : positional ? ['可能涉及位置性眩晕方向'] : hearing ? ['可能涉及外周前庭性眩晕方向'] : ['疾病方向待医生进一步评估'],
    aiRiskNote: signals.length ? '存在需要紧急关注的危险信号，建议立即急诊评估。' : '当前信息未识别到明确危险信号，但仍建议由医生结合查体进一步判断。',
    recommendedDepartment: signals.length ? '急诊/神经内科' : positional || hearing ? '耳鼻喉科/眩晕专病门诊' : '神经内科/眩晕专病门诊',
    riskLevel,
    careTimeframe: riskLevel === 'emergency' ? '立即急诊或呼叫 120' : riskLevel === 'high' ? '24 小时内就医' : riskLevel === 'medium' ? '一周内就医' : '按需就医并留意变化',
    immediateCare: riskLevel === 'emergency',
    generationSource: 'fallback',
  };
}
