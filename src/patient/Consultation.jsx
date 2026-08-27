import React, { useEffect, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, Bot, Check, CircleUserRound, Clock3,
  FileClock, Hospital, LockKeyhole, Send, ShieldCheck, Sparkles, X,
} from 'lucide-react';
import { api } from '../api/client';

function RiskNotice({ riskLevel }) {
  if (!['emergency', 'high'].includes(riskLevel)) return null;
  const emergency = riskLevel === 'emergency';
  return <div className={`emergency-card ${emergency ? '' : 'high-risk'}`}><div className="emergency-icon"><AlertTriangle size={25}/></div><div><strong>{emergency ? '检测到需要紧急关注的危险信号' : '当前信息提示较高风险'}</strong><p>{emergency ? '请停止自行活动，立即前往急诊或呼叫 120。不要独自驾车；你仍可在下方补充信息，但不要因此延误就医。' : '建议在 24 小时内就医评估。你仍可继续补充信息，但不要等待在线问诊结果而延误就医。'}</p></div>{emergency && <button onClick={() => window.alert('请立即拨打 120 或当地急救电话，并请家人陪同。')}>急救指引</button>}</div>;
}

export default function Consultation({ onReport }) {
  const [consultationId, setConsultationId] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [riskLevel, setRiskLevel] = useState('low');
  const [triage, setTriage] = useState(null);
  const [modelConfigured, setModelConfigured] = useState(null);
  const [startupError, setStartupError] = useState('');
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportRequests, setSupportRequests] = useState([]);
  const [supportForm, setSupportForm] = useState({ category: '问诊流程', contact: '', summary: '' });
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const scrollRef = useRef(null);
  const progress = Math.min(20 + Math.max(0, messages.length - 1) * 12, 88);
  const quickPrompts = messages.length < 3 ? ['周围在旋转', '感觉头昏沉', '走路不稳'] : ['有恶心或呕吐', '转头时更明显', '没有以上情况'];
  const urgent = ['emergency', 'high'].includes(riskLevel);
  const userMessageCount = messages.filter((message) => message.role === 'user').length;
  const canComplete = urgent || userMessageCount >= 3;

  useEffect(() => {
    let active = true;
    api.startConsultation().then((result) => {
      if (!active) return;
      setConsultationId(result.consultation.id); setMessages(result.messages);
      setRiskLevel(result.consultation.riskLevel || 'low');
    }).catch((error) => active && setStartupError(error.message));
    api.health().then((result) => active && setModelConfigured(result.modelConfigured)).catch(() => active && setModelConfigured(false));
    return () => { active = false; };
  }, []);

  async function sendMessage(text = input) {
    const content = text.trim();
    if (!content || loading || !consultationId) return;
    const next = [...messages, { role: 'user', content }];
    setMessages(next); setInput('');
    setLoading(true);
    try {
      const data = await api.sendConsultationMessage(consultationId, content);
      setMessages((current) => [...current, data.message]);
      setRiskLevel(data.riskLevel || 'medium');
      setTriage(data.triage || null);
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: error.message || '智能问诊服务暂时不可用，已保留你的描述。建议稍后重试或直接咨询医生。', error: true }]);
    } finally { setLoading(false); setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 50); }
  }

  async function completeConsultation() {
    if (!consultationId || loading || !canComplete) return;
    setLoading(true);
    try { const result = await api.completeConsultation(consultationId); onReport(result.report); }
    catch (error) { setMessages((current) => [...current, { role: 'assistant', content: error.message, error: true }]); }
    finally { setLoading(false); }
  }

  function openSupport() {
    setSupportOpen(true); setSupportMessage('');
    api.supportRequests().then((result) => setSupportRequests(result.requests)).catch((error) => setSupportMessage(error.message));
  }

  async function submitSupport() {
    if (supportSubmitting) return;
    setSupportSubmitting(true); setSupportMessage('');
    try {
      const result = await api.createSupportRequest({ ...supportForm, consultationId });
      setSupportMessage(result.message); setSupportForm((current) => ({ ...current, summary: '' }));
      const list = await api.supportRequests(); setSupportRequests(list.requests);
    } catch (error) { setSupportMessage(error.message); }
    finally { setSupportSubmitting(false); }
  }

  return <div className="consult-page">
    <div className="consult-header"><div><span className="live-dot" />智能问诊进行中</div><div className="consult-progress"><span>信息采集 {progress}%</span><i><b style={{ width: `${progress}%` }} /></i></div><button className="support-entry" aria-label="人工帮助" title="联系平台健康顾问" onClick={openSupport}><CircleUserRound size={16}/><span>人工帮助</span></button><button className="outline-button" title={!canComplete ? '请至少完成三轮症状采集' : ''} disabled={!consultationId || loading || !canComplete} onClick={completeConsultation}>结束并生成报告</button></div>
    {startupError && <div className="emergency-card"><div className="emergency-icon"><AlertTriangle size={22}/></div><div><strong>无法创建问诊会话</strong><p>{startupError}</p></div><button onClick={() => window.location.reload()}>重试</button></div>}
    <RiskNotice riskLevel={riskLevel} />
    <div className="consult-layout">
      <section className="chat-panel">
        <div className="chat-context"><div className="ai-avatar"><Bot size={21}/></div><div><strong>眩衡智能助手</strong><span><i className={modelConfigured === false ? 'offline' : ''}/> {modelConfigured === null ? '正在检查问诊服务' : modelConfigured ? '专业模型服务已连接' : '规则筛查已启用，模型服务未配置'}</span></div></div>
        <div className="messages">
          <div className="day-divider"><span>今天 {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span></div>
          {messages.map((message, index) => <div className={`message-row ${message.role}`} key={index}>
            {message.role === 'assistant' && <div className="mini-ai"><Sparkles size={15}/></div>}
            <div className={`bubble ${message.error ? 'error' : ''}`}>{message.content}</div>
          </div>)}
          {triage && riskLevel !== 'low' && <div className={`chat-guidance ${riskLevel}`}><div className="guidance-icon"><Hospital size={19}/></div><div><span>{riskLevel === 'emergency' ? '紧急就医提示' : '本轮就医建议'}</span><strong>{triage.recommendedDepartment}</strong><p>{triage.careTimeframe}</p></div>{riskLevel === 'emergency' ? <button className="danger-action" onClick={() => window.alert('请立即拨打 120 或当地急救电话，并请家人陪同。')}>查看急救指引</button> : <button className="primary-button" disabled={!canComplete || loading} onClick={completeConsultation}>{canComplete ? '生成报告并继续预约' : '完成三轮问诊后可预约'}<ArrowRight size={15}/></button>}<small>建议来自本轮规则筛查与结构化问诊结果，最终以医生判断为准。</small></div>}
          {loading && <div className="message-row assistant"><div className="mini-ai"><Sparkles size={15}/></div><div className="bubble typing"><i/><i/><i/></div></div>}
          <div ref={scrollRef}/>
        </div>
        <div className={`composer-wrap ${urgent ? 'emergency-mode' : ''}`}>
          {!urgent && <div className="quick-prompts">{quickPrompts.map((item) => <button key={item} onClick={() => sendMessage(item)}>{item}</button>)}</div>}
          <div className="composer"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="请描述你的感受…" rows="1"/><button disabled={!input.trim() || loading} onClick={() => sendMessage()}><Send size={18}/></button></div>
          <p>{urgent ? <><AlertTriangle size={13}/>补充信息不能替代及时就医</> : <><LockKeyhole size={13}/>你的问诊内容将被加密保护，仅在挂号确认后移交医生</>}</p>
        </div>
      </section>
      <aside className="consult-side">
        <div className="side-card"><div className="side-title"><span>本次问诊</span><em>自动保存</em></div><div className="session-id">问诊编号 <b>{consultationId ? consultationId.slice(-12).toUpperCase() : '创建中…'}</b></div>
          <div className="collection-list"><div className="checked"><Check size={14}/><span>主要症状</span><b>已采集</b></div><div className={messages.length > 2 ? 'checked' : ''}><Clock3 size={14}/><span>发作特点</span><b>{messages.length > 2 ? '已采集' : '采集中'}</b></div><div><Activity size={14}/><span>伴随症状</span><b>{userMessageCount >= 2 ? '已记录' : '待询问'}</b></div><div><AlertTriangle size={14}/><span>危险信号</span><b>{urgent ? '已触发' : '持续筛查'}</b></div><div><FileClock size={14}/><span>既往史与用药</span><b>{userMessageCount >= 3 ? '已记录' : '待询问'}</b></div></div>
        </div>
        <div className="side-card safety-card"><div className="safety-head"><ShieldCheck size={18}/><strong>危险信号持续筛查中</strong></div><p>如果你现在出现以下任一情况，请直接告诉我：</p><ul><li>单侧肢体无力或麻木</li><li>说话不清或看东西重影</li><li>无法站立、突然剧烈头痛</li></ul></div>
        <div className="human-help"><CircleUserRound size={20}/><div><strong>需要人工帮助？</strong><span>可提交联系请求并查看进度</span></div><button onClick={openSupport}>联系</button></div>
      </aside>
    </div>
    {supportOpen && <div className="modal-backdrop" onClick={() => setSupportOpen(false)}><section className="knowledge-modal support-modal" role="dialog" aria-modal="true" aria-labelledby="support-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" aria-label="关闭人工帮助" onClick={() => setSupportOpen(false)}><X size={19}/></button><span className="eyebrow"><CircleUserRound size={15}/>人工帮助</span><h2 id="support-title">联系平台健康顾问</h2><p>请留下可用联系方式和需要协助的事项。健康顾问可以协助平台流程，但不能在线诊断或处理急症。</p>{urgent && <div className="support-urgent"><AlertTriangle size={18}/><div><strong>当前问诊含较高或紧急风险</strong><span>如有危险信号，请立即前往急诊或呼叫 120，不要等待平台联系。</span></div></div>}<div className="support-form"><label>帮助类型<select value={supportForm.category} onChange={(event) => setSupportForm({ ...supportForm, category: event.target.value })}><option>问诊流程</option><option>预约协助</option><option>资料上传</option><option>其他</option></select></label><label>联系电话或其他联系方式<input value={supportForm.contact} onChange={(event) => setSupportForm({ ...supportForm, contact: event.target.value })} placeholder="例如：13800138000"/></label><label>问题摘要<textarea value={supportForm.summary} onChange={(event) => setSupportForm({ ...supportForm, summary: event.target.value })} placeholder="请简要描述需要人工协助的事项，不要在此填写完整病历…"/></label><button className="primary-button" disabled={supportSubmitting || supportForm.contact.trim().length < 5 || supportForm.summary.trim().length < 5} onClick={submitSupport}>{supportSubmitting ? '提交中…' : '提交联系请求'}</button></div>{supportMessage && <div className={`inline-feedback ${supportMessage.includes('已提交') ? 'success' : supportMessage.includes('急诊') ? 'warning' : ''}`}>{supportMessage}</div>}{supportRequests[0] && <div className="support-latest"><div><span>最近请求</span><strong>{supportRequests[0].category}</strong></div><em className={supportRequests[0].priority === 'urgent' ? 'urgent' : ''}>{supportRequests[0].status === 'pending' ? '待受理' : supportRequests[0].status === 'contacted' ? '已联系' : '已关闭'}</em><p>{supportRequests[0].responseMessage || supportRequests[0].summary}</p></div>}</section></div>}
  </div>;
}
