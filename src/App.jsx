import React, { useEffect, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, BarChart3, Bell, BookOpen, Bot, Brain,
  CalendarDays, Check, ChevronDown, ChevronRight, CircleUserRound, ClipboardCheck, Clock3,
  Database, FileClock, FileText, HeartPulse, HelpCircle, History, Hospital, LayoutDashboard,
  LockKeyhole, Menu, MessageCircleMore, MoreHorizontal, Network, Plus, Search, Send, Settings,
  ShieldCheck, Sparkles, Stethoscope, TableProperties, Users, UserRound, UserRoundCog, X, Zap,
} from 'lucide-react';
import { auditRows, followups, patients } from './data';
import Login from './Login';
import { api, getAuthToken, setAuthToken } from './api/client';

const DISCLAIMER = '本系统仅用于辅助筛查和健康信息参考，不能替代医生面诊和临床诊断。';
const ROLE_LABELS = { patient: '患者端', doctor: '医生端', admin: '管理端' };
const dangerPatterns = [
  /言语不清|说话不清|口角歪/, /单侧.*(无力|麻木|没.{0,2}力)|一边.*(无力|麻木|没.{0,2}力)/, /复视|看东西重影/,
  /意识.*(不清|异常)|昏迷|晕厥/, /无法.*(站立|行走)|站不起来|走不了/, /突发.*严重.*头痛|剧烈头痛/,
];

const patientNav = [
  ['overview', LayoutDashboard, '健康首页'], ['consult', MessageCircleMore, '智能问诊'],
  ['reports', FileText, '问诊报告'], ['appointments', CalendarDays, '我的挂号'],
  ['followup', Activity, '康复随访'], ['documents', FileClock, '健康资料'], ['education', BookOpen, '健康科普'],
];
const doctorNav = [
  ['workspace', LayoutDashboard, '接诊工作台'], ['patients', Users, '我的患者'],
  ['followups', ClipboardCheck, '随访任务'], ['schedule', CalendarDays, '我的排班'],
];
const adminNav = [
  ['dashboard', BarChart3, '运营总览'], ['users', UserRoundCog, '用户与角色'],
  ['schedules', CalendarDays, '医生与排班'], ['models', Brain, '模型管理'],
  ['knowledge', Database, '知识库'], ['audit', ShieldCheck, '审计与安全'],
];

function Brand({ compact = false }) {
  return <div className="brand">
    <div className="brand-mark"><Activity size={22} strokeWidth={2.4} /></div>
    {!compact && <div><strong>眩衡</strong><span>VertiBalance</span></div>}
  </div>;
}

function RoleDisplay({ role }) {
  return <div className="role-display" aria-label={`当前工作空间：${ROLE_LABELS[role]}`}>
    <span className={`role-dot ${role}`} />
    <span>{ROLE_LABELS[role]}</span>
  </div>;
}

function ProfileMenu({ role, user, onLogout }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const subtitle = role === 'patient' ? '患者' : role === 'doctor' ? `${user.department || '临床科室'} · ${user.title || '医生'}` : '平台管理员';
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!menuRef.current?.contains(event.target)) setOpen(false); };
    const closeOnEscape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', closeOnEscape); };
  }, [open]);
  return <div className="profile-menu-wrap" ref={menuRef}>
    <button type="button" className="profile" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
      <div className="avatar">{user.name.slice(0, 1)}</div><div><strong>{user.name}</strong><span>{subtitle}</span></div><ChevronDown className={open ? 'rotated' : ''} size={15}/>
    </button>
    {open && <div className="account-menu" role="menu">
      <div className="account-summary"><div className="avatar">{user.name.slice(0, 1)}</div><div><strong>{user.name}</strong><span>{user.account}</span></div></div>
      <button type="button" role="menuitem" onClick={onLogout}><CircleUserRound size={16}/><span>退出并切换账号</span><ArrowRight size={14}/></button>
      <small>如需使用其他身份，请退出后选择相应账号重新登录。</small>
    </div>}
  </div>;
}

function Shell({ role, user, onLogout, active, setActive, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [notices, setNotices] = useState({ notifications: [], unread: 0 });
  const [feedbackOpen,setFeedbackOpen]=useState(false); const [feedback,setFeedback]=useState({rating:5,content:''}); const [feedbackMessage,setFeedbackMessage]=useState('');
  useEffect(() => { api.notifications().then(setNotices).catch(() => undefined); }, [active]);
  async function readNotice(item) { if (!item.read) { await api.readNotification(item.id); setNotices((current) => ({ notifications: current.notifications.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry), unread: Math.max(0, current.unread - 1) })); } }
  async function submitFeedback(){try{await api.feedback(feedback);setFeedbackMessage('感谢反馈，我们已记录你的意见。');setFeedback({...feedback,content:''})}catch(error){setFeedbackMessage(error.message)}}
  const nav = role === 'patient' ? patientNav : role === 'doctor' ? doctorNav : adminNav;
  return <div className={`app-shell role-${role}`}>
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-top"><Brand /><button className="close-mobile" onClick={() => setMobileOpen(false)}><X size={20} /></button></div>
      <div className="nav-label">工作空间</div>
       <nav>{nav.map(([key, Icon, label]) => <button key={key} className={(role === 'doctor' && key === 'patients' && active.startsWith('patients')) || active === key ? 'active' : ''} onClick={() => { setActive(key); setMobileOpen(false); }}>
        <Icon size={19} /><span>{label}</span>{active === key && <span className="nav-indicator" />}
      </button>)}</nav>
      <div className="sidebar-foot">
        <div className="privacy-chip"><ShieldCheck size={17} /><div><strong>隐私安全保护</strong><span>数据加密传输与存储</span></div></div>
        <button className="help-link" onClick={()=>setFeedbackOpen(true)}><HelpCircle size={18} />帮助与反馈</button>
      </div>
    </aside>
    <div className="main-frame">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={22} /></button>
        <div className="topbar-context"><span>{role === 'patient' ? '患者健康中心' : role === 'doctor' ? '临床协作中心' : '平台运营中心'}</span><small>今日 {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}</small></div>
        <div className="top-actions">
          <RoleDisplay role={role} />
          <div className="notification-wrap"><button className="icon-button notification" onClick={() => setNoticeOpen(!noticeOpen)}><Bell size={19} />{notices.unread > 0 && <i />}</button>{noticeOpen && <div className="notification-panel"><div><strong>站内通知</strong><span>{notices.unread} 条未读</span></div>{notices.notifications.length ? notices.notifications.slice(0,8).map((item)=><button className={item.read?'read':''} key={item.id} onClick={()=>readNotice(item)}><i/><div><strong>{item.title}</strong><p>{item.content}</p><time>{new Date(item.createdAt).toLocaleString('zh-CN')}</time></div></button>) : <p className="empty-notice">暂无通知</p>}</div>}</div>
          <ProfileMenu role={role} user={user} onLogout={onLogout}/>
        </div>
      </header>
      <main>{children}</main>
      {role === 'patient' && <div className="global-disclaimer"><ShieldCheck size={15} /><span>{DISCLAIMER}</span></div>}
    </div>
    {mobileOpen && <div className="scrim" onClick={() => setMobileOpen(false)} />}
    {feedbackOpen&&<div className="modal-backdrop" onClick={()=>setFeedbackOpen(false)}><div className="knowledge-modal feedback-modal" onClick={(event)=>event.stopPropagation()}><button className="modal-close" onClick={()=>setFeedbackOpen(false)}><X size={19}/></button><span className="eyebrow"><HelpCircle size={15}/>平台反馈</span><h2>告诉我们哪里可以做得更好</h2><label>体验评分<select value={feedback.rating} onChange={(e)=>setFeedback({...feedback,rating:Number(e.target.value)})}><option value="5">5 分 · 很满意</option><option value="4">4 分 · 满意</option><option value="3">3 分 · 一般</option><option value="2">2 分 · 待改进</option><option value="1">1 分 · 不满意</option></select></label><label>反馈内容<textarea value={feedback.content} onChange={(e)=>setFeedback({...feedback,content:e.target.value})} placeholder="请勿在反馈中填写完整病历或敏感个人信息…"/></label>{feedbackMessage&&<div className="inline-feedback success">{feedbackMessage}</div>}<button className="primary-button full" onClick={submitFeedback}>提交反馈</button></div></div>}
  </div>;
}

function StatCard({ icon: Icon, tone, label, value, detail, trend, onClick }) {
  return <div className={`stat-card ${onClick ? 'is-clickable' : ''}`} onClick={onClick} onKeyDown={(event) => { if (onClick && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onClick(); } }} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
    <div className={`stat-icon ${tone}`}><Icon size={21} /></div>
    <div className="stat-copy"><span>{label}</span><strong>{value}</strong><small className={trend ? 'positive' : ''}>{detail}</small></div>
  </div>;
}

function PatientOverview({ setActive }) {
  return <div className="page patient-home">
    <section className="patient-hero">
      <div className="hero-copy"><span className="eyebrow"><Sparkles size={15} />AI 眩晕专病助手</span><h1>上午好，苏晴</h1><p>今天感觉怎么样？如果出现眩晕、头昏或失衡，眩衡助手可以帮你梳理症状并评估就医紧迫程度。</p>
        <div className="hero-actions"><button className="primary-button" onClick={() => setActive('consult')}><MessageCircleMore size={18} />开始智能问诊<ArrowRight size={17} /></button><button className="soft-button" onClick={() => setActive('reports')}><FileText size={18} />查看历史报告</button></div>
      </div>
      <div className="hero-visual" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-pulse"><Activity size={38} /></div><span className="spark s1"/><span className="spark s2"/><span className="spark s3"/></div>
    </section>
    <div className="quick-grid">
      <button className="quick-card indigo" onClick={() => setActive('consult')}><span><MessageCircleMore size={21} /></span><div><strong>症状不舒服？</strong><p>与 AI 助手进行专业预问诊</p></div><ChevronRight size={20} /></button>
      <button className="quick-card mint" onClick={() => setActive('appointments')}><span><CalendarDays size={21} /></span><div><strong>预约专科医生</strong><p>查看推荐医生与可约时段</p></div><ChevronRight size={20} /></button>
      <button className="quick-card amber" onClick={() => setActive('education')}><span><BookOpen size={21} /></span><div><strong>了解眩晕知识</strong><p>专业、易懂的疾病科普</p></div><ChevronRight size={20} /></button>
    </div>
    <div className="two-column">
      <section className="panel"><div className="section-heading"><div><h2>我的健康进程</h2><p>持续记录，有助于医生了解你的恢复情况</p></div><button className="text-button" onClick={() => setActive('followup')}>查看全部<ChevronRight size={15}/></button></div>
        <div className="timeline-list">
          <div className="timeline-row"><div className="timeline-date"><b>23</b><span>八月</span></div><i className="done"><Check size={13}/></i><div><strong>完成首次智能问诊</strong><span>生成中风险评估报告 · 已推荐神经内科</span></div><em>已完成</em></div>
          <div className="timeline-row"><div className="timeline-date"><b>24</b><span>八月</span></div><i className="current"><CalendarDays size={13}/></i><div><strong>张明远医生 · 专科门诊</strong><span>眩晕与平衡障碍门诊 · 门诊楼 3F</span></div><em className="upcoming">明天 09:30</em></div>
          <div className="timeline-row"><div className="timeline-date"><b>26</b><span>八月</span></div><i><ClipboardCheck size={13}/></i><div><strong>诊后恢复随访</strong><span>完成症状变化与用药情况问卷</span></div><em>待开始</em></div>
        </div>
      </section>
      <section className="panel knowledge-preview"><div className="section-heading"><div><h2>为你推荐</h2><p>了解症状，也能减少不必要的担忧</p></div></div>
        <div className="article-feature"><div className="article-art"><div className="ear-shape">◌</div></div><div><span className="tag">就医准备</span><h3>眩晕就诊前，需要准备哪些信息？</h3><p>记住这 5 个要点，帮助医生更快了解你的情况。</p><button className="text-button">阅读 4 分钟<ArrowRight size={15}/></button></div></div>
      </section>
    </div>
  </div>;
}

function LivePatientOverview({ setActive, user }) {
  const [data,setData]=useState(null);useEffect(()=>{api.patientDashboard().then(setData);},[]);
  return <div className="page patient-home"><section className="patient-hero"><div className="hero-copy"><span className="eyebrow"><Sparkles size={15}/>AI 眩晕专病助手</span><h1>你好，{user.name}</h1><p>如果出现眩晕、头昏或失衡，我会先用规则筛查危险信号，再由专业模型进行引导式追问。</p><div className="hero-actions"><button className="primary-button" onClick={()=>setActive('consult')}><MessageCircleMore size={18}/>开始智能问诊<ArrowRight size={17}/></button><button className="soft-button" onClick={()=>setActive('reports')}><FileText size={18}/>我的 {data?.reports.length||0} 份报告</button></div></div><div className="hero-visual" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-pulse"><Activity size={38}/></div></div></section><div className="quick-grid"><button className="quick-card indigo" onClick={()=>setActive('consult')}><span><MessageCircleMore size={21}/></span><div><strong>症状不舒服？</strong><p>开始可自动保存的专业预问诊</p></div><ChevronRight size={20}/></button><button className="quick-card mint" onClick={()=>setActive('appointments')}><span><CalendarDays size={21}/></span><div><strong>{data?.upcomingBooking?'已有预约':'预约专科医生'}</strong><p>{data?.upcomingBooking?new Date(data.upcomingBooking.appointmentAt).toLocaleString('zh-CN'):'查看推荐医生与实时号源'}</p></div><ChevronRight size={20}/></button><button className="quick-card amber" onClick={()=>setActive('documents')}><span><FileClock size={21}/></span><div><strong>补充病史资料</strong><p>安全上传检查单和既往病历</p></div><ChevronRight size={20}/></button></div><div className="two-column"><section className="panel"><div className="section-heading"><div><h2>待办健康任务</h2><p>数据来自医生安排的真实随访计划</p></div><button className="text-button" onClick={()=>setActive('followup')}>查看全部<ChevronRight size={15}/></button></div><div className="timeline-list">{data?.followups.length?data.followups.slice(0,3).map((item,index)=><div className="timeline-row" key={item.id}><div className="timeline-date"><b>{new Date(item.dueAt).getDate()}</b><span>{new Date(item.dueAt).toLocaleDateString('zh-CN',{month:'short'})}</span></div><i className={index===0?'current':''}><ClipboardCheck size={13}/></i><div><strong>{item.title}</strong><span>{item.type} · {item.status}</span></div><em>{item.abnormal?'异常关注':'待完成'}</em></div>):<p className="empty-inline">暂无待办随访任务</p>}</div></section><section className="panel knowledge-preview"><div className="section-heading"><div><h2>为你推荐</h2><p>专业知识库内容，不构成诊断</p></div><button className="text-button" onClick={()=>setActive('education')}>全部科普<ChevronRight size={15}/></button></div>{data?.knowledge[0]&&<div className="article-feature"><div className="article-art"><BookOpen size={32}/></div><div><span className="tag">{data.knowledge[0].category}</span><h3>{data.knowledge[0].title}</h3><p>{data.knowledge[0].summary}</p></div></div>}</section></div></div>;
}

function RiskNotice({ emergency }) {
  return emergency ? <div className="emergency-card"><div className="emergency-icon"><AlertTriangle size={25}/></div><div><strong>检测到需要紧急关注的危险信号</strong><p>请停止自行活动，尽快前往急诊或立即呼叫 120。不要独自驾车，建议由家人陪同。</p></div><button onClick={() => window.alert('请立即拨打 120 或当地急救电话')}>急救指引</button></div> : null;
}

function Consultation({ onReport }) {
  const [consultationId, setConsultationId] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [startupError, setStartupError] = useState('');
  const scrollRef = useRef(null);
  const progress = Math.min(20 + Math.max(0, messages.length - 1) * 12, 88);
  const quickPrompts = messages.length < 3 ? ['周围在旋转', '感觉头昏沉', '走路不稳'] : ['有恶心或呕吐', '转头时更明显', '没有以上情况'];

  useEffect(() => {
    let active = true;
    api.startConsultation().then((result) => {
      if (!active) return;
      setConsultationId(result.consultation.id); setMessages(result.messages);
      setEmergency(result.consultation.dangerSignals.length > 0);
    }).catch((error) => active && setStartupError(error.message));
    return () => { active = false; };
  }, []);

  async function sendMessage(text = input) {
    const content = text.trim();
    if (!content || loading || !consultationId) return;
    const hasDanger = dangerPatterns.some((rule) => rule.test(content));
    const next = [...messages, { role: 'user', content }];
    setMessages(next); setInput('');
    if (hasDanger) setEmergency(true);
    setLoading(true);
    try {
      const data = await api.sendConsultationMessage(consultationId, content);
      setMessages((current) => [...current, data.message]);
      if (data.dangerSignals.length) setEmergency(true);
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: error.message || '智能问诊服务暂时不可用，已保留你的描述。建议稍后重试或直接咨询医生。', error: true }]);
    } finally { setLoading(false); setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 50); }
  }

  async function completeConsultation() {
    if (!consultationId || loading) return;
    setLoading(true);
    try { const result = await api.completeConsultation(consultationId); onReport(result.report); }
    catch (error) { setMessages((current) => [...current, { role: 'assistant', content: error.message, error: true }]); }
    finally { setLoading(false); }
  }

  return <div className="consult-page">
    <div className="consult-header"><div><span className="live-dot" />智能问诊进行中</div><div className="consult-progress"><span>信息采集 {progress}%</span><i><b style={{ width: `${progress}%` }} /></i></div><button className="outline-button" disabled={!consultationId || loading} onClick={completeConsultation}>结束并生成报告</button></div>
    {startupError && <div className="emergency-card"><div className="emergency-icon"><AlertTriangle size={22}/></div><div><strong>无法创建问诊会话</strong><p>{startupError}</p></div><button onClick={() => window.location.reload()}>重试</button></div>}
    <RiskNotice emergency={emergency} />
    <div className="consult-layout">
      <section className="chat-panel">
        <div className="chat-context"><div className="ai-avatar"><Bot size={21}/></div><div><strong>眩衡智能助手</strong><span><i /> DeepSeek 医疗推理服务已连接</span></div></div>
        <div className="messages">
          <div className="day-divider"><span>今天 {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span></div>
          {messages.map((message, index) => <div className={`message-row ${message.role}`} key={index}>
            {message.role === 'assistant' && <div className="mini-ai"><Sparkles size={15}/></div>}
            <div className={`bubble ${message.error ? 'error' : ''}`}>{message.content}</div>
          </div>)}
          {loading && <div className="message-row assistant"><div className="mini-ai"><Sparkles size={15}/></div><div className="bubble typing"><i/><i/><i/></div></div>}
          <div ref={scrollRef}/>
        </div>
        {!emergency && <div className="composer-wrap">
          <div className="quick-prompts">{quickPrompts.map((item) => <button key={item} onClick={() => sendMessage(item)}>{item}</button>)}</div>
          <div className="composer"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="请描述你的感受…" rows="1"/><button disabled={!input.trim() || loading} onClick={() => sendMessage()}><Send size={18}/></button></div>
          <p><LockKeyhole size={13}/>你的问诊内容将被加密保护，仅在挂号确认后移交医生</p>
        </div>}
      </section>
      <aside className="consult-side">
        <div className="side-card"><div className="side-title"><span>本次问诊</span><em>自动保存</em></div><div className="session-id">问诊编号 <b>{consultationId ? consultationId.slice(-12).toUpperCase() : '创建中…'}</b></div>
          <div className="collection-list"><div className="checked"><Check size={14}/><span>主要症状</span><b>已采集</b></div><div className={messages.length > 2 ? 'checked' : ''}><Clock3 size={14}/><span>发作特点</span><b>{messages.length > 2 ? '已采集' : '采集中'}</b></div><div><Activity size={14}/><span>伴随症状</span><b>待询问</b></div><div><AlertTriangle size={14}/><span>危险信号</span><b>{emergency ? '已触发' : '持续筛查'}</b></div><div><FileClock size={14}/><span>既往史与用药</span><b>待询问</b></div></div>
        </div>
        <div className="side-card safety-card"><div className="safety-head"><ShieldCheck size={18}/><strong>危险信号持续筛查中</strong></div><p>如果你现在出现以下任一情况，请直接告诉我：</p><ul><li>单侧肢体无力或麻木</li><li>说话不清或看东西重影</li><li>无法站立、突然剧烈头痛</li></ul></div>
        <div className="human-help"><CircleUserRound size={20}/><div><strong>需要人工帮助？</strong><span>可联系平台健康顾问</span></div><button>联系</button></div>
      </aside>
    </div>
  </div>;
}

function PatientReport({ setActive }) {
  return <div className="page narrow-page">
    <button className="back-button" onClick={() => setActive('overview')}><ArrowLeft size={17}/>返回健康首页</button>
    <div className="report-heading"><div><span className="eyebrow"><FileText size={15}/>AI 预问诊报告</span><h1>眩晕症状初步评估</h1><p>问诊编号 VB-0824-0931 · 生成于今天 14:32</p></div><div className="risk-seal moderate"><span>风险等级</span><strong>中</strong><small>建议一周内就医</small></div></div>
    <div className="report-notice"><ShieldCheck size={19}/><div><strong>这不是一份诊断书</strong><p>报告用于帮助你与医生更高效地沟通，具体诊断和治疗方案需由医生面诊后决定。</p></div></div>
    <div className="report-grid">
      <section className="panel report-main"><h2>症状摘要</h2><p className="summary-text">近 3 天晨起或翻身时出现短暂旋转感，每次约 20–30 秒，伴轻度恶心，无明显听力下降。当前描述中未发现明确的神经系统危险信号。</p><div className="fact-grid"><div><span>发作特点</span><strong>短暂、反复发作</strong></div><div><span>主要诱因</span><strong>翻身、起床、转头</strong></div><div><span>伴随症状</span><strong>轻度恶心</strong></div><div><span>危险信号</span><strong className="safe-text"><Check size={15}/>暂未识别</strong></div></div><h2>可能涉及的方向</h2><div className="direction-card"><div><Brain size={22}/></div><div><strong>位置性眩晕相关方向</strong><p>症状特点可能与体位变化相关，建议由耳鼻喉科或眩晕专病门诊进一步检查评估。</p></div></div></section>
      <aside><div className="panel recommendation"><span className="tag">就医建议</span><h3>建议预约眩晕专病门诊</h3><div><Hospital size={17}/><p><span>推荐科室</span><strong>耳鼻喉科 · 眩晕门诊</strong></p></div><div><Clock3 size={17}/><p><span>建议时效</span><strong>一周内</strong></p></div><button className="primary-button" onClick={() => setActive('appointments')}>查看可约医生<ArrowRight size={17}/></button></div><button className="download-card" onClick={() => window.print()}><FileText size={20}/><div><strong>保存报告</strong><span>打印或导出为 PDF</span></div><ChevronRight size={18}/></button></aside>
    </div>
  </div>;
}

function PatientSubPage({ active, setActive }) {
  if (active === 'reports') return <PatientReport setActive={setActive}/>;
  const configs = {
    appointments: ['我的挂号', '查看预约信息和医生安排', CalendarDays],
    followup: ['康复随访', '记录恢复变化，按时完成随访任务', Activity],
    education: ['眩晕健康科普', '来自专业知识库的可靠健康内容', BookOpen],
  };
  const [title, subtitle, Icon] = configs[active] || configs.followup;
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><Icon size={15}/>患者健康服务</span><h1>{title}</h1><p>{subtitle}</p></div>{active === 'appointments' && <button className="primary-button"><Plus size={17}/>预约医生</button>}</div>
    {active === 'appointments' ? <div className="appointment-card"><div className="appointment-date"><span>明天</span><strong>09:30</strong><small>8 月 25 日</small></div><div className="appointment-doctor"><div className="avatar large">张</div><div><span className="tag">已确认</span><h3>张明远 · 主任医师</h3><p>眩晕与平衡障碍门诊 · 神经内科</p></div></div><div className="appointment-place"><Hospital size={18}/><div><span>滨江院区 · 门诊楼 3F</span><small>请提前 15 分钟签到</small></div></div><button className="outline-button">查看详情</button></div>
    : active === 'education' ? <div className="article-grid">{[['体位一变就眩晕，可能发生了什么？','耳石症','6 分钟'],['眩晕发作时，如何避免跌倒？','日常防护','4 分钟'],['前庭康复训练的正确打开方式','康复训练','8 分钟'],['什么样的头晕需要立即去急诊？','危险信号','5 分钟']].map(([name, tag, time], i) => <article key={name}><div className={`article-cover cover-${i+1}`}><BookOpen size={30}/></div><span className="tag">{tag}</span><h3>{name}</h3><p>用简单易懂的方式了解眩晕，做好科学应对和就医准备。</p><small>{time}阅读 <ArrowRight size={14}/></small></article>)}</div>
    : <div className="followup-grid">{followups.map((item, index) => <div className="followup-card" key={item.title}><div className={`task-icon t${index}`}><ClipboardCheck size={20}/></div><div><span>{item.type} · {item.date}</span><h3>{item.title}</h3><p>按计划完成记录，异常变化会及时同步给你的医生。</p></div><em>{item.status}</em><button className={index === 0 ? 'primary-button' : 'outline-button'}>{index === 0 ? '开始填写' : '查看详情'}</button></div>)}</div>}
  </div>;
}

function LivePatientReport({ setActive, latestReport }) {
  const [reports, setReports] = useState(latestReport ? [latestReport] : []);
  const [selectedId, setSelectedId] = useState(latestReport?.id || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { api.reports().then((result) => { setReports(result.reports); setSelectedId((current) => current || result.reports[0]?.id || ''); }).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false)); }, []);
  const report = reports.find((item) => item.id === selectedId) || reports[0];
  if (loading && !report) return <DataLoading label="正在读取加密问诊报告…"/>;
  if (!report) return <EmptyState icon={FileText} title="暂无问诊报告" message={error || '完成一次智能问诊后，结构化报告会保存在这里。'} action="开始智能问诊" onAction={() => setActive('consult')}/>;
  const risk = report.riskLevel === 'high' ? '高' : report.riskLevel === 'low' ? '低' : '中';
  const timing = risk === '高' ? '建议立即或 24 小时内就医' : risk === '中' ? '建议一周内就医' : '建议按需就医';
  return <div className="page narrow-page"><button className="back-button" onClick={() => setActive('overview')}><ArrowLeft size={17}/>返回健康首页</button>
    <div className="report-toolbar"><label>历史报告<select value={report.id} onChange={(event) => setSelectedId(event.target.value)}>{reports.map((item) => <option key={item.id} value={item.id}>{new Date(item.createdAt).toLocaleString('zh-CN')} · {item.id.slice(-8)}</option>)}</select></label></div>
    <div className="report-heading"><div><span className="eyebrow"><FileText size={15}/>AI 预问诊报告</span><h1>眩晕症状初步评估</h1><p>问诊编号 {report.consultationId.slice(-12).toUpperCase()} · {new Date(report.createdAt).toLocaleString('zh-CN')}</p></div><div className={`risk-seal ${risk === '高' ? 'high' : 'moderate'}`}><span>风险等级</span><strong>{risk}</strong><small>{timing}</small></div></div>
    <div className="report-notice"><ShieldCheck size={19}/><div><strong>这不是一份诊断书</strong><p>报告用于帮助你与医生更高效地沟通，具体诊断和治疗方案需由医生面诊后决定。</p></div></div>
    <div className="report-grid"><section className="panel report-main"><h2>症状摘要</h2><p className="summary-text">{report.chiefComplaint}</p><div className="fact-grid"><div><span>发作特点</span><strong>{report.episodeFeatures}</strong></div><div><span>主要诱因</span><strong>{report.triggers}</strong></div><div><span>伴随症状</span><strong>{report.accompanyingSymptoms}</strong></div><div><span>危险信号</span><strong className={report.dangerSignals.length ? 'danger-text' : 'safe-text'}>{report.dangerSignals.length ? <AlertTriangle size={15}/> : <Check size={15}/>} {report.dangerSignals.join('、') || '暂未识别'}</strong></div></div><h2>AI 初步风险提示</h2><div className="direction-card"><div><Brain size={22}/></div><div><strong>{report.recommendedDepartment}</strong><p>{report.aiRiskNote}</p></div></div></section>
      <aside><div className="panel recommendation"><span className="tag">就医建议</span><h3>{risk === '高' ? '建议立即前往急诊评估' : `建议预约${report.recommendedDepartment}`}</h3><div><Hospital size={17}/><p><span>推荐科室</span><strong>{report.recommendedDepartment}</strong></p></div><div><Clock3 size={17}/><p><span>建议时效</span><strong>{timing.replace('建议','')}</strong></p></div><button className="primary-button" onClick={() => setActive('appointments')}>查看可约医生<ArrowRight size={17}/></button></div><button className="download-card" onClick={() => window.print()}><FileText size={20}/><div><strong>保存报告</strong><span>打印或导出为 PDF</span></div><ChevronRight size={18}/></button></aside></div>
  </div>;
}

function LiveAppointments({ setActive }) {
  const [data, setData] = useState({ bookings: [], schedules: [], reports: [] });
  const [loading, setLoading] = useState(true); const [message, setMessage] = useState(''); const [bookingId, setBookingId] = useState('');
  const load = () => Promise.all([api.bookings(), api.schedules(), api.reports()]).then(([bookings, schedules, reports]) => setData({ bookings: bookings.bookings, schedules: schedules.schedules, reports: reports.reports })).finally(() => setLoading(false));
  useEffect(() => { load().catch((error) => { setMessage(error.message); setLoading(false); }); }, []);
  async function book(schedule) {
    const bookedConsultations = new Set(data.bookings.filter((item) => item.status !== 'cancelled').map((item) => item.consultationId));
    const report = data.reports.find((item) => !bookedConsultations.has(item.consultationId));
    if (!report) { setMessage('请先完成一份尚未挂号的问诊报告。'); return; }
    setBookingId(schedule.id); setMessage('');
    try { await api.createBooking(report.consultationId, schedule.id); setMessage('挂号成功，问诊报告已安全移交给对应医生。'); await load(); }
    catch (error) { setMessage(error.message); } finally { setBookingId(''); }
  }
  async function cancel(booking){if(!window.confirm('确认取消这次挂号并释放号源？'))return;try{await api.cancelBooking(booking.id);setMessage('挂号已取消，号源已释放。');await load()}catch(error){setMessage(error.message)}}
  if (loading) return <DataLoading label="正在读取号源与挂号信息…"/>;
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><CalendarDays size={15}/>患者健康服务</span><h1>我的挂号</h1><p>查看已确认预约，或使用问诊报告预约推荐门诊。</p></div><button className="outline-button" onClick={() => setActive('reports')}><FileText size={17}/>查看报告</button></div>{message && <div className={`inline-feedback ${message.includes('成功') ? 'success' : ''}`}>{message}</div>}
    <div className="service-section"><h2>预约记录</h2>{data.bookings.length ? <div className="booking-list">{data.bookings.map((booking) => <div className={`appointment-card ${booking.status}`} key={booking.id}><div className="appointment-date"><span>{new Date(booking.appointmentAt).toLocaleDateString('zh-CN',{weekday:'short'})}</span><strong>{new Date(booking.appointmentAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</strong><small>{new Date(booking.appointmentAt).toLocaleDateString('zh-CN')}</small></div><div className="appointment-doctor"><div className="avatar large">{booking.doctor.name.slice(0,1)}</div><div><span className="tag">{booking.status==='confirmed'?'已确认':booking.status==='completed'?'已完成':'已取消'}</span><h3>{booking.doctor.name} · {booking.doctor.title}</h3><p>{booking.department}</p></div></div><div className="appointment-place"><Hospital size={18}/><div><span>{booking.campus}</span><small>挂号号 {booking.id.slice(-6).toUpperCase()}</small></div></div>{booking.status==='confirmed'?<button className="outline-button" onClick={()=>cancel(booking)}>取消挂号</button>:<span className="muted">{booking.status}</span>}</div>)}</div> : <p className="empty-inline">暂无预约记录</p>}</div>
    <div className="service-section"><h2>可预约号源</h2><div className="schedule-options">{data.schedules.map((schedule) => <div className="panel schedule-option" key={schedule.id}><div className="avatar large">{schedule.doctor.name.slice(0,1)}</div><div><span>{schedule.department} · {schedule.campus}</span><h3>{schedule.doctor.name} · {schedule.doctor.title}</h3><p>{new Date(schedule.startAt).toLocaleString('zh-CN',{month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'})}</p></div><em>余 {schedule.remaining} 号</em><button className="primary-button" disabled={bookingId === schedule.id} onClick={() => book(schedule)}>{bookingId === schedule.id ? '预约中…' : '确认预约'}</button></div>)}</div></div>
  </div>;
}

function LiveFollowups() {
  const [items, setItems] = useState([]); const [activeId, setActiveId] = useState(''); const [form, setForm] = useState({ severity: 3, text: '', medicationTaken: true }); const [message, setMessage] = useState('');
  const load = () => api.followups().then((result) => setItems(result.followups));
  useEffect(() => { load().catch((error) => setMessage(error.message)); }, []);
  async function submit(id) { try { const result = await api.submitFollowup(id, form); setMessage(result.message); setActiveId(''); await load(); } catch (error) { setMessage(error.message); } }
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><Activity size={15}/>诊后健康管理</span><h1>康复随访</h1><p>反馈真实症状变化；异常结果会标记给医生关注。</p></div></div>{message && <div className="inline-feedback">{message}</div>}<div className="followup-grid">{items.map((item,index) => <div className={`followup-card live ${item.abnormal ? 'abnormal' : ''}`} key={item.id}><div className={`task-icon t${index%3}`}><ClipboardCheck size={20}/></div><div><span>{item.type} · 截止 {new Date(item.dueAt).toLocaleString('zh-CN')}</span><h3>{item.title}</h3><p>{item.status === 'completed' ? `已提交 · 症状评分 ${item.feedback?.severity}/10` : '请按计划记录当前症状和用药情况'}</p></div><em>{item.abnormal ? '异常关注' : item.status === 'completed' ? '已完成' : '待完成'}</em>{item.status === 'pending' && <button className="primary-button" onClick={() => setActiveId(activeId === item.id ? '' : item.id)}>开始填写</button>}{activeId === item.id && <div className="followup-form"><label>当前眩晕严重程度 <strong>{form.severity}/10</strong><input type="range" min="0" max="10" value={form.severity} onChange={(event) => setForm({...form,severity:Number(event.target.value)})}/></label><label>症状变化<textarea value={form.text} onChange={(event)=>setForm({...form,text:event.target.value})} placeholder="例如：今天眩晕次数减少，但起床时仍明显…"/></label><label className="check-line"><input type="checkbox" checked={form.medicationTaken} onChange={(event)=>setForm({...form,medicationTaken:event.target.checked})}/>已按医嘱用药</label><button className="dark-button" onClick={() => submit(item.id)}>提交随访反馈</button></div>}</div>)}</div></div>;
}

function LiveKnowledge() {
  const [items, setItems] = useState([]); const [selected, setSelected] = useState(null);
  useEffect(() => { api.knowledge().then((result) => setItems(result.items)); }, []);
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><BookOpen size={15}/>专业健康知识库</span><h1>眩晕健康科普</h1><p>科普内容与诊断结论分开呈现，仅用于健康教育。</p></div></div><div className="article-grid live">{items.map((item,index)=><article key={item.id} onClick={()=>setSelected(item)}><div className={`article-cover cover-${index%4+1}`}><BookOpen size={30}/></div><span className="tag">{item.category}</span><h3>{item.title}</h3><p>{item.summary}</p><small>阅读详情 <ArrowRight size={14}/></small></article>)}</div>{selected && <div className="modal-backdrop" onClick={()=>setSelected(null)}><article className="knowledge-modal" onClick={(event)=>event.stopPropagation()}><button className="modal-close" onClick={()=>setSelected(null)}><X size={19}/></button><span className="tag">{selected.category}</span><h2>{selected.title}</h2><p>{selected.content}</p><div className="report-notice"><ShieldCheck size={17}/><div><strong>健康教育提示</strong><p>本文不构成诊断或治疗建议。如出现危险信号，请立即就医。</p></div></div></article></div>}</div>;
}

function PatientDocuments() {
  const [items,setItems]=useState([]);const [file,setFile]=useState(null);const [category,setCategory]=useState('检查资料');const [message,setMessage]=useState('');const [uploading,setUploading]=useState(false);
  const load=()=>api.uploads().then((result)=>setItems(result.uploads));useEffect(()=>{load().catch((error)=>setMessage(error.message));},[]);
  async function upload(){if(!file){setMessage('请先选择 PDF、JPG 或 PNG 文件');return}setUploading(true);const body=new FormData();body.append('file',file);body.append('category',category);try{await api.upload(body);setMessage('资料已加密保存，挂号移交后对应医生可查看。');setFile(null);await load()}catch(error){setMessage(error.message)}finally{setUploading(false)}}
  async function download(item){const response=await fetch(`/api/v1/uploads/${item.id}/download`,{headers:{Authorization:`Bearer ${getAuthToken()}`}});if(!response.ok){setMessage('下载失败或当前无访问权限');return}const blob=await response.blob();const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=item.name;anchor.click();URL.revokeObjectURL(url)}
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><FileClock size={15}/>患者资料中心</span><h1>健康资料</h1><p>上传检查单或病史图片，挂号后安全移交给对应医生。</p></div></div>{message&&<div className={`inline-feedback ${message.includes('已加密')?'success':''}`}>{message}</div>}<div className="document-layout"><div className="panel upload-box"><div className="placeholder-icon"><FileText size={30}/></div><h2>上传病史资料</h2><p>仅支持 PDF、JPG、PNG，单个文件不超过 5MB；禁止上传可执行文件。</p><label className="file-picker"><input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e)=>setFile(e.target.files?.[0]||null)}/><span>{file?file.name:'选择文件'}</span></label><label>资料类型<select value={category} onChange={(e)=>setCategory(e.target.value)}><option>检查资料</option><option>既往病历</option><option>用药清单</option><option>其他资料</option></select></label><button className="primary-button" disabled={uploading} onClick={upload}>{uploading?'安全上传中…':'确认上传'}</button></div><div className="panel document-list"><div className="section-heading"><div><h2>我的资料</h2><p>{items.length} 个已加密文件</p></div></div>{items.length?items.map((item)=><button key={item.id} onClick={()=>download(item)}><div className="task-icon"><FileText size={19}/></div><div><strong>{item.name}</strong><span>{item.category} · {(item.size/1024).toFixed(1)}KB · {new Date(item.createdAt).toLocaleString('zh-CN')}</span></div><ChevronRight size={17}/></button>):<p className="empty-inline">暂无上传资料</p>}</div></div></div>;
}

function DataLoading({ label }) { return <div className="page"><div className="data-loading"><div className="brand-mark"><Activity size={21}/></div><span>{label}</span></div></div>; }
function EmptyState({ icon: Icon, title, message, action, onAction }) { return <div className="page"><div className="panel placeholder-panel"><div className="placeholder-icon"><Icon size={34}/></div><h2>{title}</h2><p>{message}</p>{action && <button className="primary-button" onClick={onAction}>{action}<ArrowRight size={16}/></button>}</div></div>; }

function RiskBadge({ risk }) { return <span className={`risk-badge risk-${risk}`}>{risk}风险</span>; }

function DoctorWorkspace({ onPatient }) {
  return <div className="page">
    <div className="page-title"><div><span className="eyebrow"><Stethoscope size={15}/>临床工作台</span><h1>上午好，张医生</h1><p>今日共有 8 位待接诊患者，其中 1 位需要优先关注。</p></div><div className="date-control"><CalendarDays size={17}/>2026 年 8 月 24 日<ChevronDown size={15}/></div></div>
    <div className="stats-grid doctor-stats"><StatCard icon={Users} tone="blue" label="今日待接诊" value="8" detail="较昨日 +2" trend/><StatCard icon={AlertTriangle} tone="rose" label="高风险患者" value="1" detail="建议优先处理"/><StatCard icon={ClipboardCheck} tone="violet" label="待办随访" value="12" detail="3 项今日到期"/><StatCard icon={Clock3} tone="green" label="平均接诊时长" value="12m" detail="本周缩短 8%" trend/></div>
    <div className="doctor-layout"><section className="panel patient-list-panel"><div className="section-heading"><div><h2>患者队列</h2><p>按风险等级与预约时间智能排序</p></div><div className="panel-tools"><div className="search-box"><Search size={16}/><input placeholder="搜索患者"/></div><button className="icon-button"><MoreHorizontal size={19}/></button></div></div><div className="tabs"><button className="active">待接诊 <b>8</b></button><button>已挂号 <b>16</b></button><button>高风险 <b>1</b></button><button>随访中 <b>24</b></button></div>
      <div className="patient-table"><div className="table-head"><span>患者</span><span>AI 风险</span><span>症状摘要</span><span>更新时间</span><span/></div>{patients.map((patient) => <button className="table-row" key={patient.id} onClick={() => onPatient(patient)}><span className="patient-cell"><i className={`avatar ${patient.tone}`}>{patient.avatar}</i><span><strong>{patient.name}</strong><small>{patient.gender} · {patient.age} 岁 · {patient.id}</small></span></span><span><RiskBadge risk={patient.risk}/></span><span className="symptom-cell">{patient.symptom}</span><span className="muted">{patient.time}</span><span><ChevronRight size={18}/></span></button>)}</div></section>
      <aside className="doctor-aside"><div className="panel priority-card"><div className="priority-head"><span><Zap size={18}/>优先关注</span><em>AI 提醒</em></div><div className="priority-patient"><div className="avatar rose">林</div><div><strong>林晓雯 · 56 岁</strong><span>10 分钟前完成预问诊</span></div></div><div className="risk-reason"><AlertTriangle size={18}/><p><strong>发现危险信号</strong><span>突发眩晕并伴有无法独立行走，建议优先复核中枢性病变风险。</span></p></div><button className="dark-button" onClick={() => onPatient(patients[0])}>立即查看资料<ArrowRight size={16}/></button></div>
      <div className="panel schedule-card"><div className="section-heading"><div><h2>今日安排</h2><p>下一个号源 10 分钟后</p></div><button className="text-button">全部</button></div>{[['09:30','周建国','初诊'],['10:00','陈雨桐','复诊'],['10:30','刘雅琴','初诊']].map(([time,name,type], i)=><div className={`schedule-row ${i===0?'next':''}`} key={time}><strong>{time}</strong><i/><div><span>{name}</span><small>{type} · 眩晕门诊</small></div>{i===0&&<em>即将开始</em>}</div>)}</div></aside></div>
  </div>;
}

function PatientDetail({ patient, onBack }) {
  return <div className="page patient-detail"><button className="back-button" onClick={onBack}><ArrowLeft size={17}/>返回患者队列</button><div className="detail-head"><div className={`avatar xl ${patient.tone}`}>{patient.avatar}</div><div><div className="name-line"><h1>{patient.name}</h1><RiskBadge risk={patient.risk}/></div><p>{patient.gender} · {patient.age} 岁 · 患者编号 {patient.id}</p></div><div className="detail-actions"><button className="outline-button"><MessageCircleMore size={17}/>联系患者</button><button className="primary-button"><ClipboardCheck size={17}/>开始接诊</button></div></div>
    <div className="detail-grid"><section><div className="panel clinical-summary"><div className="section-heading"><div><span className="eyebrow"><Sparkles size={14}/>AI 问诊摘要</span><h2>症状与风险概览</h2></div><span className="reference-label">仅供辅助参考</span></div><div className="summary-highlight"><p>{patient.symptom}。症状于今晨突然出现，持续约 40 分钟，伴恶心及明显行走不稳。否认耳鸣与听力下降。</p></div><div className="clinical-facts"><div><span>起病方式</span><strong>突然发作</strong></div><div><span>持续时间</span><strong>约 40 分钟</strong></div><div><span>诱发因素</span><strong>无明显体位诱发</strong></div><div><span>既往史</span><strong>高血压 8 年</strong></div></div><div className="danger-box"><AlertTriangle size={20}/><div><strong>规则引擎标记：无法独立行走</strong><p>危险信号优先级高于模型判断，建议优先完成神经系统查体并评估急诊处置。</p></div></div></div>
      <div className="panel timeline-panel"><h2>关键症状时间线</h2><div className="clinical-timeline"><div><i/><span>08:10</span><p><strong>眩晕突然发作</strong><small>起床后出现持续旋转感，无明确体位诱因</small></p></div><div><i/><span>08:25</span><p><strong>出现行走不稳</strong><small>需扶墙行走，伴恶心，无呕吐</small></p></div><div><i/><span>09:04</span><p><strong>完成 AI 预问诊</strong><small>规则筛查标记高风险并推荐优先就医</small></p></div></div></div></section>
      <aside><div className="panel ai-assist"><div className="side-title"><span>AI 辅助分析</span><Bot size={18}/></div><div className="assist-block"><span>建议进一步追问</span><ul><li>是否出现吞咽困难或声音嘶哑？</li><li>发作时是否伴眼球震颤？</li><li>近期血压控制和用药依从性？</li></ul></div><div className="assist-block"><span>建议关注检查</span><div className="check-tags"><b>HINTS 检查</b><b>神经系统查体</b><b>头颅 MRI</b></div></div><button className="soft-button full"><Sparkles size={16}/>重新生成分析</button><p className="assist-note">AI 结果仅供参考，最终判断与处置由医生完成。</p></div><div className="panel record-form"><h2>医生处置记录</h2><label>临床意见<textarea placeholder="记录诊断考虑、检查意见与处置建议…"/></label><div className="form-row"><label>复诊时间<input type="date"/></label><label>随访计划<select><option>暂不安排</option><option>3 天后</option><option>7 天后</option></select></label></div><button className="primary-button full" onClick={() => window.alert('演示数据已在本地会话中保存')}>保存处置记录</button></div></aside></div>
  </div>;
}

function DoctorApp({ active }) {
  const [selected, setSelected] = useState(null);
  if (selected) return <PatientDetail patient={selected} onBack={() => setSelected(null)}/>;
  if (active === 'workspace' || active === 'patients') return <DoctorWorkspace onPatient={setSelected}/>;
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><ClipboardCheck size={15}/>医生工作空间</span><h1>{active === 'followups' ? '随访任务' : '我的排班'}</h1><p>{active === 'followups' ? '创建并跟踪患者诊后恢复计划' : '查看门诊时段与患者预约安排'}</p></div><button className="primary-button"><Plus size={17}/>{active === 'followups' ? '新建随访' : '申请调班'}</button></div>{active === 'followups' ? <div className="followup-grid">{patients.slice(0,4).map((p,i)=><div className="followup-card" key={p.id}><div className={`avatar ${p.tone}`}>{p.avatar}</div><div><span>{i<2?'今天到期':'本周计划'}</span><h3>{p.name} · 症状恢复随访</h3><p>复核眩晕频率、用药情况及康复训练完成度</p></div><em>{i===0?'异常反馈':'待完成'}</em><button className="outline-button">查看任务</button></div>)}</div> : <div className="calendar-placeholder panel"><CalendarDays size={44}/><h2>本周门诊排班</h2><div className="week-strip">{['周一 24','周二 25','周三 26','周四 27','周五 28'].map((d,i)=><div className={i===0?'active':''} key={d}><span>{d}</span><strong>{i===2?'休诊':'08:30–12:00'}</strong><small>{i===2?'—':'眩晕专病门诊'}</small></div>)}</div></div>}</div>;
}

const riskLabel = (risk) => risk === 'high' ? '高' : risk === 'low' ? '低' : '中';
const riskAvatarClass = (risk) => risk === 'high' ? 'rose' : risk === 'medium' ? 'amber' : 'green';

function LiveDoctorWorkspace({ onPatient, onPatientsView, setActive }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');

  useEffect(() => {
    api.doctorWorkbench().then(setData).catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => {
    if (data?.queue?.length && !data.queue.some((item) => item.patient.id === selectedPatientId)) {
      setSelectedPatientId(data.queue[0].patient.id);
    }
  }, [data, selectedPatientId]);

  const consultPatientList = (data?.queue || []).map((item) => {
    const dangerSignals = item.consultation?.dangerSignals || [];
    return {
      id: item.patient.id,
      name: item.patient.name,
      age: item.patient.age,
      gender: item.patient.gender,
      riskLevel: item.consultation?.riskLevel || 'low',
      report: item.report,
      source: item,
      redFlags: {
        labels: dangerSignals,
        description: dangerSignals.join('、') || '当前未发现危险信号',
        warning: item.report?.aiRiskNote || '当前未生成报告，请结合问诊记录继续判断。',
      },
      transferStatus: {
        time: item.booking.appointmentAt,
        name: item.patient.name,
        department: item.booking.department || '未分配科室',
        reportStatus: item.report ? '报告已移交' : '报告待生成',
        accessStatus: item.booking.status === 'confirmed' ? '已授权' : '待授权',
      },
    };
  });

  const currentPatient = consultPatientList.find((p) => p.id === selectedPatientId) || consultPatientList[0];
  if (!data) return error ? <EmptyState icon={AlertTriangle} title="无法读取接诊队列" message={error}/> : <DataLoading label="正在整理今日接诊患者队列"/>;
  if (!currentPatient) return <EmptyState icon={Users} title="暂无今日接诊患者" message="当前工作台还没有可展示的患者。"/>;

  const report = currentPatient.report || {};
  const highRiskPatients = consultPatientList.filter((patient) => patient.riskLevel === 'high');
  const priorityPatient = highRiskPatients[0] || currentPatient;
  const transferPatients = [currentPatient, ...consultPatientList.filter((patient) => patient.id !== currentPatient.id)].slice(0, 3);
  const formatTime = (value) => new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  return <div className="page">
    <div className="page-title"><div><span className="eyebrow"><Stethoscope size={15}/>临床工作台</span><h1>今日接诊工作台</h1><p>共 {data.summary.total} 位我的患者，{data.summary.highRisk} 位需要优先关注。</p></div><div className="date-control"><CalendarDays size={17}/>{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</div></div>
    <section className="work-overview"><div className="subsection-heading"><div><span>今日工作概览</span><small>先处理风险和待办，再进入患者档案</small></div></div><div className="stats-grid doctor-stats"><StatCard icon={Users} tone="blue" label="我的患者" value={data.summary.total} detail={`${data.summary.pending} 位待接诊`} onClick={() => onPatientsView('today')}/><StatCard icon={AlertTriangle} tone="rose" label="高风险患者" value={data.summary.highRisk} detail="规则优先排序" onClick={() => onPatientsView('high')}/><StatCard icon={ClipboardCheck} tone="violet" label="待办随访" value={data.summary.followups} detail={`${data.summary.abnormalFollowups} 项异常关注`} onClick={() => setActive('followups')}/><StatCard icon={ShieldCheck} tone="green" label="资料访问" value="已审计" detail="查看行为自动留痕"/></div></section>
    <div className="doctor-layout workbench-three-column">
      <section className="panel patient-list-panel today-queue">
        <div className="section-heading"><div><h2>今日接诊患者</h2><p>点击患者查看右侧预诊详情</p></div></div>
        <div className="patient-table"><div className="table-head"><span>患者</span><span>风险</span><span>症状摘要</span><span>预约</span><span>状态</span></div>{data.queue.slice(0, 5).map((item) => <button type="button" aria-pressed={item.patient.id === currentPatient.id} className={`table-row ${item.patient.id === currentPatient.id ? 'selected' : ''}`} key={item.booking.id} onClick={() => setSelectedPatientId(item.patient.id)}><span className="patient-cell"><i className={`avatar ${riskAvatarClass(item.consultation?.riskLevel)}`}>{item.patient.name.slice(0, 1)}</i><span><strong>{item.patient.name}</strong><small>{item.patient.gender} · {item.patient.age} 岁</small></span></span><span><RiskBadge risk={riskLabel(item.consultation?.riskLevel)}/></span><span className="symptom-cell">{item.report?.chiefComplaint || '报告摘要待生成'}</span><span className="muted">{new Date(item.booking.appointmentAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span><span className="patient-status">{item.booking.status === 'completed' ? '已完成' : '待接诊'}</span></button>)}</div>
      </section>

      <section className="panel precheck-panel">
        <div className="section-heading"><div><span className="eyebrow"><Sparkles size={14}/>AI 预问诊摘要</span><h2>{currentPatient.name} · 预诊详情</h2></div><RiskBadge risk={riskLabel(currentPatient.riskLevel)}/></div>
        <div className="summary-highlight"><p>{report.chiefComplaint || '暂无结构化预诊主诉'}</p></div>
        <div className="clinical-facts"><div><span>发作特点</span><strong>{report.episodeFeatures || '未采集'}</strong></div><div><span>诱发因素</span><strong>{report.triggers || '未采集'}</strong></div><div><span>伴随症状</span><strong>{report.accompanyingSymptoms || '未采集'}</strong></div><div><span>既往史</span><strong>{report.history || '未采集'}</strong></div></div>
        <div className="danger-box"><AlertTriangle size={20}/><div><strong>{currentPatient.redFlags.labels.length ? `规则引擎标记：${currentPatient.redFlags.labels.join('、')}` : '当前未发现危险信号'}</strong><p>{currentPatient.redFlags.warning}</p></div></div>
        <button type="button" className="dark-button" onClick={() => onPatient(currentPatient.source)}>查看患者资料<ArrowRight size={16}/></button>
      </section>

      <aside className="doctor-aside">
        <div className="panel priority-card"><div className="priority-head"><span><Zap size={18}/>优先关注</span><em>{highRiskPatients.length} 位</em></div><p className="panel-caption">今日接诊队列中的高风险患者</p><div className="priority-list">{highRiskPatients.length ? highRiskPatients.map((patient) => <button type="button" className={`priority-patient priority-patient-button ${patient.id === currentPatient.id ? 'selected' : ''}`} key={patient.id} onClick={() => setSelectedPatientId(patient.id)}><div className={`avatar ${riskAvatarClass(patient.riskLevel)}`}>{patient.name.slice(0, 1)}</div><div><strong>{patient.name} · {patient.age} 岁</strong><span>{patient.redFlags.description}</span></div><time>{formatTime(patient.transferStatus.time)}</time></button>) : <div className="empty-inline">今日暂无高风险患者</div>}</div><div className="risk-reason"><AlertTriangle size={18}/><p><strong>{priorityPatient.redFlags.labels.length ? '发现危险信号' : '当前风险提示'}</strong><span>{priorityPatient.redFlags.warning}</span></p></div><button type="button" className="dark-button" onClick={() => onPatient(priorityPatient.source)}>立即查看资料<ArrowRight size={16}/></button></div>
        <div className="panel schedule-card secondary-panel"><div className="section-heading"><div><h2>资料移交状态</h2><p>当前选中患者及相关资料状态</p></div></div>{transferPatients.map((patient) => <div className="schedule-row" key={patient.id}><strong>{formatTime(patient.transferStatus.time)}</strong><i/><div><span>{patient.transferStatus.name}</span><small>{patient.transferStatus.department} · {patient.transferStatus.reportStatus}</small></div><em>{patient.transferStatus.accessStatus}</em></div>)}</div>
      </aside>
    </div>
  </div>;
}

function LiveDoctorWorkspaceSelection({ onPatient, onPatientsView, setActive }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  useEffect(() => { api.doctorWorkbench().then(setData).catch((requestError) => setError(requestError.message)); }, []);
  useEffect(() => {
    if (data?.queue?.length && !data.queue.some((item) => item.patient.id === selectedPatientId)) setSelectedPatientId(data.queue[0].patient.id);
  }, [data, selectedPatientId]);

  const consultPatientList = (data?.queue || []).map((item) => {
    const dangerSignals = item.consultation?.dangerSignals || [];
    return {
      id: item.patient.id,
      name: item.patient.name,
      age: item.patient.age,
      gender: item.patient.gender,
      riskLevel: item.consultation?.riskLevel || 'low',
      report: item.report,
      source: item,
      redFlags: {
        labels: dangerSignals,
        description: dangerSignals.join('、') || '当前未发现危险信号',
        warning: item.report?.aiRiskNote || '当前未生成报告，请结合问诊记录继续判断。',
      },
      transferStatus: {
        time: item.booking.appointmentAt,
        name: item.patient.name,
        department: item.booking.department || '未分配科室',
        reportStatus: item.report ? '报告已移交' : '报告待生成',
        accessStatus: item.booking.status === 'confirmed' ? '已授权' : '待授权',
      },
    };
  });
  const currentPatient = consultPatientList.find((patient) => patient.id === selectedPatientId) || consultPatientList[0];
  if (!data) return error ? <EmptyState icon={AlertTriangle} title="无法读取接诊队列" message={error}/> : <DataLoading label="正在按风险等级整理患者队列…"/>;
  if (!currentPatient) return <EmptyState icon={Users} title="暂无今日接诊患者" message="当前工作台还没有可展示的患者。"/>;
  const transferPatients = [currentPatient, ...consultPatientList.filter((patient) => patient.id !== currentPatient.id)].slice(0, 3);
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><Stethoscope size={15}/>临床工作台</span><h1>今日接诊工作台</h1><p>共 {data.summary.total} 位我的患者，{data.summary.highRisk} 位需要优先关注。</p></div><div className="date-control"><CalendarDays size={17}/>{new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'})}</div></div>
    <section className="work-overview"><div className="subsection-heading"><div><span>今日工作概览</span><small>先处理风险和待办，再进入患者档案</small></div></div><div className="stats-grid doctor-stats"><StatCard icon={Users} tone="blue" label="我的患者" value={data.summary.total} detail={`${data.summary.pending} 位待接诊`} onClick={() => onPatientsView('today')}/><StatCard icon={AlertTriangle} tone="rose" label="高风险患者" value={data.summary.highRisk} detail="规则优先排序" onClick={() => onPatientsView('high')}/><StatCard icon={ClipboardCheck} tone="violet" label="待办随访" value={data.summary.followups} detail={`${data.summary.abnormalFollowups} 项异常关注`} onClick={() => setActive('followups')}/><StatCard icon={ShieldCheck} tone="green" label="资料访问" value="已审计" detail="查看行为自动留痕"/></div></section>
    <div className="doctor-layout"><section className="panel patient-list-panel today-queue"><div className="section-heading"><div><h2>今日接诊队列</h2><p>今天需要处理的患者，按风险程度和预约时间排序</p></div></div><div className="patient-table"><div className="table-head"><span>患者</span><span>风险</span><span>症状摘要</span><span>预约时间</span><span>状态</span></div>{data.queue.map((item) => <button type="button" className={`table-row ${item.patient.id === currentPatient.id ? 'selected' : ''}`} key={item.booking.id} onClick={() => setSelectedPatientId(item.patient.id)}><span className="patient-cell"><i className={`avatar ${riskAvatarClass(item.consultation?.riskLevel)}`}>{item.patient.name.slice(0,1)}</i><span><strong>{item.patient.name}</strong><small>{item.patient.gender} · {item.patient.age} 岁</small></span></span><span><RiskBadge risk={riskLabel(item.consultation?.riskLevel)}/></span><span className="symptom-cell">{item.report?.chiefComplaint || '报告摘要待生成'}</span><span className="muted">{new Date(item.booking.appointmentAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span><span className="patient-status">{item.booking.status === 'completed' ? '已完成' : '待接诊'}</span></button>)}</div></section><aside className="doctor-aside"><div className="panel priority-card"><div className="priority-head"><span><Zap size={18}/>优先关注</span><em>{riskLabel(currentPatient.riskLevel)}风险</em></div><div className="priority-patient"><div className={`avatar ${riskAvatarClass(currentPatient.riskLevel)}`}>{currentPatient.name.slice(0,1)}</div><div><strong>{currentPatient.name} · {currentPatient.age} 岁</strong><span>{currentPatient.redFlags.description}</span></div></div><div className="risk-reason"><AlertTriangle size={18}/><p><strong>{currentPatient.redFlags.labels.length ? '发现危险信号' : '当前风险提示'}</strong><span>{currentPatient.redFlags.warning}</span></p></div><button type="button" className="dark-button" onClick={() => onPatient(currentPatient.source)}>立即查看资料<ArrowRight size={16}/></button></div><div className="panel schedule-card secondary-panel"><div className="section-heading"><div><h2>资料移交状态</h2><p>当前选中患者及相关资料状态</p></div></div>{transferPatients.map((patient) => <div className="schedule-row" key={patient.id}><strong>{new Date(patient.transferStatus.time).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</strong><i/><div><span>{patient.transferStatus.name}</span><small>{patient.transferStatus.department} · {patient.transferStatus.reportStatus}</small></div><em>{patient.transferStatus.accessStatus}</em></div>)}</div></aside></div>
  </div>;
}

function LiveDoctorWorkspaceLegacy({ onPatient, onPatientsView, setActive }) {
  const [data, setData] = useState(null); const [error, setError] = useState('');
  useEffect(() => { api.doctorWorkbench().then(setData).catch((requestError) => setError(requestError.message)); }, []);
  if (!data) return error ? <EmptyState icon={AlertTriangle} title="无法读取接诊队列" message={error}/> : <DataLoading label="正在按风险等级整理患者队列…"/>;
  const priority = data.queue.find((item) => item.consultation?.riskLevel === 'high');
  const openPatient = (item) => { if (item?.patient?.id) onPatient(item); };
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><Stethoscope size={15}/>临床工作台</span><h1>今日接诊工作台</h1><p>共 {data.summary.total} 位我的患者，{data.summary.highRisk} 位需要优先关注。</p></div><div className="date-control"><CalendarDays size={17}/>{new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'})}</div></div>
        <section className="work-overview"><div className="subsection-heading"><div><span>今日工作概览</span><small>先处理风险和待办，再进入患者档案</small></div></div><div className="stats-grid doctor-stats"><StatCard icon={Users} tone="blue" label="我的患者" value={data.summary.total} detail={`${data.summary.pending} 位待接诊`} onClick={() => onPatientsView('today')}/><StatCard icon={AlertTriangle} tone="rose" label="高风险患者" value={data.summary.highRisk} detail="规则优先排序" onClick={() => onPatientsView('high')}/><StatCard icon={ClipboardCheck} tone="violet" label="待办随访" value={data.summary.followups} detail={`${data.summary.abnormalFollowups} 项异常关注`} onClick={() => setActive('followups')}/><StatCard icon={ShieldCheck} tone="green" label="资料访问" value="已审计" detail="查看行为自动留痕"/></div></section>
      <div className="doctor-layout"><section className="panel patient-list-panel today-queue"><div className="section-heading"><div><h2>今日接诊队列</h2><p>今天需要处理的患者，按风险程度和预约时间排序</p></div></div><div className="patient-table"><div className="table-head"><span>患者</span><span>风险</span><span>症状摘要</span><span>预约时间</span><span>状态</span></div>{data.queue.map((item)=><button type="button" className="table-row" key={item.booking.id} onClick={() => openPatient(item)}><span className="patient-cell"><i className={`avatar ${riskAvatarClass(item.consultation?.riskLevel)}`}>{item.patient.name.slice(0,1)}</i><span><strong>{item.patient.name}</strong><small>{item.patient.gender} · {item.patient.age} 岁</small></span></span><span><RiskBadge risk={riskLabel(item.consultation?.riskLevel)}/></span><span className="symptom-cell">{item.report?.chiefComplaint || '报告摘要待生成'}</span><span className="muted">{new Date(item.booking.appointmentAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span><span className="patient-status">{item.booking.status === 'completed' ? '已完成' : '待接诊'}</span></button>)}</div></section><aside className="doctor-aside"><div className="panel priority-card"><div className="priority-head"><span><Zap size={18}/>优先关注</span><em>规则引擎</em></div><div className="priority-patient"><div className={`avatar ${riskAvatarClass(priority.consultation?.riskLevel)}`}>{priority.patient.name.slice(0,1)}</div><div><strong>{priority.patient.name} · {priority.patient.age} 岁</strong><span>{priority.consultation.dangerSignals.join('、') || '高风险基础病史'}</span></div></div><div className="risk-reason"><AlertTriangle size={18}/><p><strong>危险信号不可被 AI 降级</strong><span>{priority.report?.aiRiskNote}</span></p></div><button type="button" className="dark-button" onClick={() => openPatient(priority)}>立即查看资料<ArrowRight size={16}/></button></div><div className="panel schedule-card secondary-panel"><div className="section-heading"><div><h2>资料移交状态</h2><p>挂号成功后才允许医生访问</p></div></div>{data.queue.slice(0,3).map((item)=><div className="schedule-row" key={item.booking.id}><strong>{new Date(item.booking.appointmentAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</strong><i/><div><span>{item.patient.name}</span><small>{item.booking.department} · 报告已移交</small></div><em>已授权</em></div>)}</div></aside></div></div>;
  }

function LiveDoctorPatient({ queueItem, onBack, backLabel }) {
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [qaMessages, setQaMessages] = useState([]);
  const [qaLoading, setQaLoading] = useState(false);
  const [form, setForm] = useState({ diagnosis: '', examination: '', treatment: '', medication: '', rehabilitation: '', revisitAt: '', followupPlan: '' });

  useEffect(() => { api.doctorPatient(queueItem.patient.id).then(setData).catch((error) => setMessage(error.message)); }, [queueItem.patient.id]);

  async function save() {
    if (!form.diagnosis.trim()) { setMessage('请填写临床诊断或诊断考虑'); return; }
    setSaving(true);
    try {
      await api.createDisposition({ ...form, patientId: queueItem.patient.id, consultationId: queueItem.consultation.id });
      setMessage('处置记录已保存，并与 AI 风险提示分开存储。');
      setData(await api.doctorPatient(queueItem.patient.id));
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  }

  async function downloadUpload(item) {
    const response = await fetch(`/api/v1/uploads/${item.id}/download`, { headers: { Authorization: `Bearer ${getAuthToken()}` } });
    if (!response.ok) { setMessage('资料下载失败'); return; }
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = item.name; anchor.click(); URL.revokeObjectURL(url);
  }

  async function generateAnalysis() {
    setAnalysisLoading(true); setMessage('正在请求 AI 辅助分析…');
    try {
      const result = await api.doctorAnalysis(queueItem.patient.id);
      setAnalysis(result.analysis); setQaMessages([]); setMessage('AI 辅助分析已更新；结果仅供医生参考。');
    } catch (error) { setMessage(error.message || 'AI 辅助分析暂时不可用，请稍后重试。'); }
    finally { setAnalysisLoading(false); }
  }

  async function askQuestion(event) {
    event.preventDefault();
    const nextQuestion = question.trim();
    if (!nextQuestion || qaLoading || !analysis) return;
    const history = qaMessages;
    setQaMessages((current) => [...current, { role: 'doctor', content: nextQuestion }]);
    setQuestion(''); setQaLoading(true); setMessage('正在请求模型回答追问…');
    try {
      const result = await api.doctorQuestion(queueItem.patient.id, nextQuestion, analysis, history);
      setQaMessages((current) => [...current, { role: 'assistant', content: result.answer }]);
      setMessage('追问已完成；请结合查体和检查结果作最终判断。');
    } catch (error) {
      setMessage(error.message || '追问暂时不可用，请稍后重试。');
    } finally { setQaLoading(false); }
  }

  if (!data) return message ? <EmptyState icon={AlertTriangle} title="无法读取患者资料" message={message} action="返回队列" onAction={onBack}/> : <DataLoading label="正在读取患者授权资料并记录审计"/>;
  const report = data.reports.find((item) => item.consultationId === queueItem.consultation.id) || data.reports[0];
  const messages = data.messages.filter((item) => item.consultationId === queueItem.consultation.id);
  const dangerSignals = queueItem.consultation?.dangerSignals || [];
  return <div className="page patient-detail">
    <button className="back-button" onClick={onBack}><ArrowLeft size={17}/>{backLabel}</button>
    <div className="detail-head"><div className={`avatar xl ${riskAvatarClass(queueItem.consultation?.riskLevel)}`}>{data.patient.name.slice(0, 1)}</div><div><div className="name-line"><h1>{data.patient.name}</h1><RiskBadge risk={riskLabel(queueItem.consultation.riskLevel)}/></div><p>{data.patient.gender} · {data.patient.age} 岁 · 患者编号 {data.patient.id}</p></div></div>
    {message && <div className="inline-feedback">{message}</div>}
    <div className="detail-grid">
      <section>
        <div className="panel clinical-summary"><div className="section-heading"><div><span className="eyebrow"><Sparkles size={14}/>AI 问诊摘要</span><h2>症状与风险概览</h2></div><span className="reference-label">仅供辅助参考</span></div><div className="summary-highlight"><p>{report?.chiefComplaint || '暂无结构化摘要'}</p></div><div className="clinical-facts"><div><span>发作特点</span><strong>{report?.episodeFeatures || '未采集'}</strong></div><div><span>诱发因素</span><strong>{report?.triggers || '未采集'}</strong></div><div><span>伴随症状</span><strong>{report?.accompanyingSymptoms || '未采集'}</strong></div><div><span>既往史</span><strong>{report?.history || '未采集'}</strong></div></div>{dangerSignals.length > 0 && <div className="danger-box"><AlertTriangle size={20}/><div><strong>规则引擎标记：{dangerSignals.join('、')}</strong><p>危险信号优先级高于模型判断，请优先完成人工复核与必要检查。</p></div></div>}</div>
        <div className="panel timeline-panel"><h2>原始问诊对话</h2><div className="conversation-record">{messages.map((item) => <div className={item.role} key={item.id}><span>{item.role === 'user' ? data.patient.name : 'AI 助手'}</span><p>{item.content}</p><time>{new Date(item.createdAt).toLocaleString('zh-CN')}</time></div>)}</div></div>
        {data.uploads.length > 0 && <div className="panel timeline-panel"><h2>患者补充资料</h2><div className="mini-documents">{data.uploads.map((item) => <button key={item.id} onClick={() => downloadUpload(item)}><FileText size={17}/><span>{item.name}<small>{item.category} · {(item.size / 1024).toFixed(1)}KB</small></span><ChevronRight size={16}/></button>)}</div></div>}
        {data.dispositions.length > 0 && <div className="panel timeline-panel"><h2>历史处置记录</h2>{data.dispositions.map((item) => <div className="saved-disposition" key={item.id}><strong>{item.diagnosis}</strong><span>{new Date(item.submittedAt).toLocaleString('zh-CN')}</span><p>{item.examination} {item.treatment}</p></div>)}</div>}
      </section>
      <aside>
        <div className="panel ai-assist"><div className="side-title"><span>AI 辅助分析</span><Bot size={18}/></div>{analysis ? <><div className="assist-block"><span>症状要点</span><ul>{analysis.symptomHighlights.map((item) => <li key={item}>{item}</li>)}</ul></div><div className="assist-block"><span>建议进一步追问</span><ul>{analysis.followupQuestions.map((item) => <li key={item}>{item}</li>)}</ul></div><div className="assist-block"><span>鉴别方向</span><div className="check-tags">{analysis.differentialDirections.map((item) => <b key={item}>{item}</b>)}</div></div><div className="assist-block"><span>建议检查</span><div className="check-tags">{analysis.suggestedExams.map((item) => <b key={item}>{item}</b>)}</div></div></> : <div className="assist-block"><span>当前结构化摘要</span><p>{report?.aiRiskNote || '请结合问诊对话人工分析'}</p></div>}<button className="soft-button full" disabled={analysisLoading} onClick={generateAnalysis}><Sparkles size={16}/>{analysisLoading ? '模型分析中…' : analysis ? '重新生成分析' : '生成结构化分析'}</button><p className="assist-note">仅供参考，最终判断由医生完成；不会覆盖医生意见。</p></div>
        {analysis && <div className="panel ai-qa"><div className="side-title"><span>继续追问</span><MessageCircleMore size={18}/></div><div className="qa-messages">{qaMessages.map((item, index) => <div className={`qa-message ${item.role}`} key={`${item.role}-${index}`}><span>{item.role === 'doctor' ? '医生' : 'AI 助手'}</span><p>{item.content}</p></div>)}</div><form className="ai-question-form" onSubmit={askQuestion}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="针对当前患者继续提问，例如：还需要补充哪些查体信息？" disabled={qaLoading}/><button type="submit" className="primary-button full" disabled={qaLoading || !question.trim()}><Send size={16}/>{qaLoading ? '回答中…' : '发送追问'}</button></form><p className="assist-note">问答结果仅供辅助参考，不替代医生诊断。</p></div>}
        <div className="panel record-form"><h2>医生处置记录</h2><label>临床诊断 / 诊断考虑 *<textarea value={form.diagnosis} onChange={(event) => setForm({ ...form, diagnosis: event.target.value })} placeholder="由医生填写，不覆盖 AI 风险提示…"/></label><label>检查意见<textarea value={form.examination} onChange={(event) => setForm({ ...form, examination: event.target.value })}/></label><label>治疗与用药建议<textarea value={`${form.treatment}${form.treatment && form.medication ? '\n' : ''}${form.medication}`} onChange={(event) => setForm({ ...form, treatment: event.target.value })}/></label><div className="form-row"><label>复诊时间<input type="datetime-local" value={form.revisitAt} onChange={(event) => setForm({ ...form, revisitAt: event.target.value })}/></label><label>随访计划<select value={form.followupPlan} onChange={(event) => setForm({ ...form, followupPlan: event.target.value })}><option value="">暂不安排</option><option value="3 天后症状随访">3 天后</option><option value="7 天后症状随访">7 天后</option></select></label></div><button className="primary-button full" disabled={saving} onClick={save}>{saving ? '保存中…' : '保存处置记录'}</button></div>
      </aside>
    </div>
  </div>;
}

function LiveDoctorPatientLegacy({ queueItem, onBack, backLabel }) {
  const [data,setData]=useState(null); const [message,setMessage]=useState(''); const [saving,setSaving]=useState(false);
  const [analysis,setAnalysis]=useState(null); const [analysisLoading,setAnalysisLoading]=useState(false);
  const [form,setForm]=useState({diagnosis:'',examination:'',treatment:'',medication:'',rehabilitation:'',revisitAt:'',followupPlan:''});
  useEffect(()=>{api.doctorPatient(queueItem.patient.id).then(setData).catch((error)=>setMessage(error.message));},[queueItem.patient.id]);
  async function save(){if(!form.diagnosis.trim()){setMessage('请填写临床诊断或诊断考虑');return}setSaving(true);try{await api.createDisposition({...form,patientId:queueItem.patient.id,consultationId:queueItem.consultation.id});setMessage('处置记录已保存，并与 AI 风险提示分开存储。');const next=await api.doctorPatient(queueItem.patient.id);setData(next)}catch(error){setMessage(error.message)}finally{setSaving(false)}}
  async function downloadUpload(item){const response=await fetch(`/api/v1/uploads/${item.id}/download`,{headers:{Authorization:`Bearer ${getAuthToken()}`}});if(!response.ok){setMessage('资料下载失败');return}const blob=await response.blob();const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=item.name;anchor.click();URL.revokeObjectURL(url)}
  async function generateAnalysis(){setAnalysisLoading(true);setMessage('正在请求 AI 辅助分析…');try{const result=await api.doctorAnalysis(queueItem.patient.id);setAnalysis(result.analysis);setMessage('AI 辅助分析已更新；结果仅供医生参考。')}catch(error){const feedback=error.message||'AI 辅助分析暂时不可用，请稍后重试。';setMessage(feedback);window.alert(feedback)}finally{setAnalysisLoading(false)}}
  if(!data)return message?<EmptyState icon={AlertTriangle} title="无法读取患者资料" message={message} action="返回队列" onAction={onBack}/>:<DataLoading label="正在读取患者授权资料并记录审计…"/>;
  const report=data.reports.find((item)=>item.consultationId===queueItem.consultation.id)||data.reports[0];
  const messages=data.messages.filter((item)=>item.consultationId===queueItem.consultation.id);
  return <div className="page patient-detail"><button className="back-button" onClick={onBack}><ArrowLeft size={17}/>{backLabel}</button><div className="detail-head"><div className={`avatar xl ${riskAvatarClass(queueItem.consultation?.riskLevel)}`}>{data.patient.name.slice(0,1)}</div><div><div className="name-line"><h1>{data.patient.name}</h1><RiskBadge risk={riskLabel(queueItem.consultation.riskLevel)}/></div><p>{data.patient.gender} · {data.patient.age} 岁 · 患者编号 {data.patient.id}</p></div></div>
    <div className="detail-grid"><section><div className="panel clinical-summary"><div className="section-heading"><div><span className="eyebrow"><Sparkles size={14}/>AI 问诊摘要</span><h2>症状与风险概览</h2></div><span className="reference-label">仅供辅助参考</span></div><div className="summary-highlight"><p>{report?.chiefComplaint||'暂无结构化摘要'}</p></div><div className="clinical-facts"><div><span>发作特点</span><strong>{report?.episodeFeatures||'未采集'}</strong></div><div><span>诱发因素</span><strong>{report?.triggers||'未采集'}</strong></div><div><span>伴随症状</span><strong>{report?.accompanyingSymptoms||'未采集'}</strong></div><div><span>既往史</span><strong>{report?.history||'未采集'}</strong></div></div>{queueItem.consultation.dangerSignals.length>0&&<div className="danger-box"><AlertTriangle size={20}/><div><strong>规则引擎标记：{queueItem.consultation.dangerSignals.join('、')}</strong><p>危险信号优先级高于模型判断，请优先完成人工复核与必要检查。</p></div></div>}</div>
      <div className="panel timeline-panel"><h2>原始问诊对话</h2><div className="conversation-record">{messages.map((item)=><div className={item.role} key={item.id}><span>{item.role==='user'?data.patient.name:'AI 助手'}</span><p>{item.content}</p><time>{new Date(item.createdAt).toLocaleString('zh-CN')}</time></div>)}</div></div>{data.uploads.length>0&&<div className="panel timeline-panel"><h2>患者补充资料</h2><div className="mini-documents">{data.uploads.map((item)=><button key={item.id} onClick={()=>downloadUpload(item)}><FileText size={17}/><span>{item.name}<small>{item.category} · {(item.size/1024).toFixed(1)}KB</small></span><ChevronRight size={16}/></button>)}</div></div>}{data.dispositions.length>0&&<div className="panel timeline-panel"><h2>历史处置记录</h2>{data.dispositions.map((item)=><div className="saved-disposition" key={item.id}><strong>{item.diagnosis}</strong><span>{new Date(item.submittedAt).toLocaleString('zh-CN')}</span><p>{item.examination} {item.treatment}</p></div>)}</div>}</section>
      <aside><div className="panel ai-assist"><div className="side-title"><span>AI 辅助分析</span><Bot size={18}/></div>{analysis?<><div className="assist-block"><span>症状要点</span><ul>{analysis.symptomHighlights.map((item)=><li key={item}>{item}</li>)}</ul></div><div className="assist-block"><span>建议进一步追问</span><ul>{analysis.followupQuestions.map((item)=><li key={item}>{item}</li>)}</ul></div><div className="assist-block"><span>鉴别方向</span><div className="check-tags">{analysis.differentialDirections.map((item)=><b key={item}>{item}</b>)}</div></div><div className="assist-block"><span>建议检查</span><div className="check-tags">{analysis.suggestedExams.map((item)=><b key={item}>{item}</b>)}</div></div></>:<div className="assist-block"><span>当前结构化摘要</span><p>{report?.aiRiskNote||'请结合问诊对话人工分析'}</p></div>}<button className="soft-button full" disabled={analysisLoading} onClick={generateAnalysis}><Sparkles size={16}/>{analysisLoading?'模型分析中…':analysis?'重新生成分析':'生成结构化分析'}</button><p className="assist-note">仅供参考，最终判断由医生完成；不会覆盖医生意见。</p></div><div className="panel record-form"><h2>医生处置记录</h2><label>临床诊断 / 诊断考虑 *<textarea value={form.diagnosis} onChange={(e)=>setForm({...form,diagnosis:e.target.value})} placeholder="由医生填写，不覆盖 AI 风险提示…"/></label><label>检查意见<textarea value={form.examination} onChange={(e)=>setForm({...form,examination:e.target.value})}/></label><label>治疗与用药建议<textarea value={`${form.treatment}${form.treatment&&form.medication?'\n':''}${form.medication}`} onChange={(e)=>setForm({...form,treatment:e.target.value})}/></label><div className="form-row"><label>复诊时间<input type="datetime-local" value={form.revisitAt} onChange={(e)=>setForm({...form,revisitAt:e.target.value})}/></label><label>随访计划<select value={form.followupPlan} onChange={(e)=>setForm({...form,followupPlan:e.target.value})}><option value="">暂不安排</option><option value="3 天后症状随访">3 天后</option><option value="7 天后症状随访">7 天后</option></select></label></div><button className="primary-button full" disabled={saving} onClick={save}>{saving?'保存中…':'保存处置记录'}</button></div></aside></div>
      </div>;
}

function LiveDoctorFollowupsOverview() {
  const [items, setItems] = useState([]);
  const [focus, setFocus] = useState('all');
  useEffect(() => { api.followups().then((result) => setItems(result.followups)).catch(() => setItems([])); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const counts = {
    pending: items.filter((item) => item.status === 'pending').length,
    dueToday: items.filter((item) => item.status === 'pending' && item.dueAt?.slice(0, 10) === today).length,
    abnormal: items.filter((item) => item.abnormal).length,
    completed: items.filter((item) => item.status === 'completed').length,
  };
  function chooseFocus(nextFocus) {
    setFocus((current) => current === nextFocus ? 'all' : nextFocus);
    requestAnimationFrame(() => document.getElementById('followup-task-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  return <div className="page followup-page">
    <div className="page-title"><div><span className="eyebrow"><ClipboardCheck size={15}/>诊后管理</span><h1>随访任务</h1><p>优先处理今日到期和异常反馈，任务详情沿用现有工作流。</p></div></div>
    <div className="followup-summary">
      <button type="button" className={`followup-summary-card ${focus === 'pending' ? 'active' : ''}`} aria-pressed={focus === 'pending'} onClick={() => chooseFocus('pending')}><span>待处理</span><strong>{counts.pending}</strong></button>
      <button type="button" className={`followup-summary-card ${focus === 'dueToday' ? 'active' : ''}`} aria-pressed={focus === 'dueToday'} onClick={() => chooseFocus('dueToday')}><span>今日到期</span><strong>{counts.dueToday}</strong></button>
      <button type="button" className={`followup-summary-card ${focus === 'abnormal' ? 'active' : ''}`} aria-pressed={focus === 'abnormal'} onClick={() => chooseFocus('abnormal')}><span>异常反馈</span><strong>{counts.abnormal}</strong></button>
      <button type="button" className={`followup-summary-card ${focus === 'completed' ? 'active' : ''}`} aria-pressed={focus === 'completed'} onClick={() => chooseFocus('completed')}><span>已完成</span><strong>{counts.completed}</strong></button>
    </div>
    <LiveDoctorFollowups focus={focus}/>
  </div>;
}

function LiveDoctorFollowupsOverviewLegacy() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.followups().then((result) => setItems(result.followups)).catch(() => setItems([])); }, []);
  const today = new Date().toISOString().slice(0, 10);
  const pending = items.filter((item) => item.status === 'pending');
  const dueToday = pending.filter((item) => item.dueAt?.slice(0, 10) === today);
  const abnormal = items.filter((item) => item.abnormal);
  return <div className="page followup-page"><div className="page-title"><div><span className="eyebrow"><ClipboardCheck size={15}/>诊后管理</span><h1>随访任务</h1><p>优先处理今日到期和异常反馈，任务详情沿用现有工作流。</p></div></div><div className="followup-summary"><div><span>待处理</span><strong>{pending.length}</strong></div><div><span>今日到期</span><strong>{dueToday.length}</strong></div><div><span>异常反馈</span><strong>{abnormal.length}</strong></div><div><span>已完成</span><strong>{items.filter((item) => item.status === 'completed').length}</strong></div></div><LiveDoctorFollowups/></div>;
}

function LiveDoctorFollowups({ focus = 'all' }) {
  const [items, setItems] = useState([]);
  const [queue, setQueue] = useState([]);
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ patientId: '', title: '症状恢复随访', type: 'questionnaire', dueAt: '' });
  const typeLabels = { questionnaire: '随访问卷', medication: '用药提醒', rehabilitation: '康复训练', revisit: '复诊提醒' };

  async function load() {
    const [followupResult, workbench] = await Promise.all([api.followups(), api.doctorWorkbench()]);
    setItems(followupResult.followups);
    setQueue(workbench.queue);
    if (!form.patientId && workbench.queue[0]) setForm((current) => ({ ...current, patientId: workbench.queue[0].patient.id }));
  }

  useEffect(() => { load().catch((error) => setMessage(error.message)); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const visibleItems = items.filter((item) => focus === 'all'
    || (focus === 'pending' && item.status === 'pending')
    || (focus === 'dueToday' && item.status === 'pending' && item.dueAt?.slice(0, 10) === today)
    || (focus === 'abnormal' && item.abnormal)
    || (focus === 'completed' && item.status === 'completed'));

  async function create() {
    try {
      await api.createFollowup(form);
      setShow(false);
      setMessage('随访任务已创建，患者端可立即查看。');
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return <div className="page">
    <div className="page-title">
      <div><span className="eyebrow"><ClipboardCheck size={15}/>诊后管理</span><h1>随访任务</h1><p>创建任务、查看患者反馈并优先处理异常结果。</p></div>
      <button type="button" className="primary-button" onClick={() => setShow((value) => !value)}><Plus size={17}/>新建随访</button>
    </div>
    {message && <div className="inline-feedback success">{message}</div>}
    {show && <div className="panel create-form">
      <label>患者<select value={form.patientId} onChange={(event) => setForm({ ...form, patientId: event.target.value })}>{queue.map((item) => <option value={item.patient.id} key={item.patient.id}>{item.patient.name}</option>)}</select></label>
      <label>任务标题<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })}/></label>
      <label>任务类型<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{Object.entries(typeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label>执行时间<input type="datetime-local" value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })}/></label>
      <button type="button" className="dark-button" onClick={create}>创建随访</button>
    </div>}
    <div className="followup-grid" id="followup-task-list">
      {visibleItems.map((item, index) => {
        const patientName = item.patient?.name || '患者';
        return <div className={`followup-card ${item.abnormal ? 'abnormal' : ''}`} key={item.id}>
          <div className={`avatar ${riskAvatarClass(item.riskLevel)}`}>{patientName.slice(0, 1)}</div>
          <div><span>{new Date(item.dueAt).toLocaleString('zh-CN')} · {typeLabels[item.type] || item.type}</span><h3>{patientName} · {item.title}</h3><p>{item.feedback?.text || '患者尚未提交反馈'}</p></div>
          <em>{item.abnormal ? '异常关注' : item.status === 'completed' ? '已完成' : '待完成'}</em>
          <button type="button" className="outline-button" onClick={() => setSelected(item)}>查看记录</button>
        </div>;
      })}
      {visibleItems.length === 0 && <div className="empty-inline">当前分类暂无随访记录</div>}
    </div>
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}>
      <section className="knowledge-modal followup-record-modal" role="dialog" aria-modal="true" aria-labelledby="followup-record-title" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" aria-label="关闭记录" onClick={() => setSelected(null)}><X size={19}/></button>
        <span className="tag">{selected.abnormal ? '异常反馈' : selected.status === 'completed' ? '已完成' : '待处理'}</span>
        <h2 id="followup-record-title">{selected.patient?.name || '患者'} · {selected.title}</h2>
        <div className="followup-record-meta"><span>随访类型<strong>{typeLabels[selected.type] || selected.type}</strong></span><span>截止时间<strong>{new Date(selected.dueAt).toLocaleString('zh-CN')}</strong></span></div>
        {selected.feedback ? <div className="followup-feedback"><div><span>症状严重程度</span><strong>{selected.feedback.severity}/10</strong></div><div><span>症状变化</span><p>{selected.feedback.text || '患者未填写文字描述'}</p></div><div><span>用药情况</span><p>{selected.feedback.medicationTaken ? '已按医嘱用药' : '未按医嘱用药'}</p></div><small>提交时间：{new Date(selected.feedback.submittedAt).toLocaleString('zh-CN')}</small></div> : <div className="empty-inline">患者尚未提交反馈，暂无随访记录。</div>}
      </section>
    </div>}
  </div>;
}

function LiveDoctorFollowupsEncoded() {
  const [items, setItems] = useState([]);
  const [queue, setQueue] = useState([]);
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ patientId: '', title: '\u75c7\u72b6\u6062\u590d\u968f\u8bbf', type: 'questionnaire', dueAt: '' });
  const typeLabels = { questionnaire: '\u968f\u8bbf\u95ee\u5377', medication: '\u7528\u836f\u63d0\u9192', rehabilitation: '\u5eb7\u590d\u8bad\u7ec3', revisit: '\u590d\u8bca\u63d0\u9192' };

  const load = () => Promise.all([api.followups(), api.doctorWorkbench()]).then(([followupResult, workbench]) => {
    setItems(followupResult.followups);
    setQueue(workbench.queue);
    if (!form.patientId && workbench.queue[0]) setForm((current) => ({ ...current, patientId: workbench.queue[0].patient.id }));
  });

  useEffect(() => { load().catch((error) => setMessage(error.message)); }, []);

  async function create() {
    try {
      await api.createFollowup(form);
      setShow(false);
      setMessage('\u968f\u8bbf\u4efb\u52a1\u5df2\u521b\u5efa\uff0c\u60a3\u8005\u7aef\u53ef\u7acb\u5373\u67e5\u770b\u3002');
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return <div className="page">
    <div className="page-title"><div><span className="eyebrow"><ClipboardCheck size={15}/>诊后管理</span><h1>随访任务</h1><p>创建任务、查看患者反馈并优先处理异常结果。</p></div><button className="primary-button" onClick={() => setShow(!show)}><Plus size={17}/>新建随访</button></div>
    {message && <div className="inline-feedback success">{message}</div>}
    {show && <div className="panel create-form"><label>患者<select value={form.patientId} onChange={(event) => setForm({ ...form, patientId: event.target.value })}>{queue.map((item) => <option value={item.patient.id} key={item.patient.id}>{item.patient.name}</option>)}</select></label><label>任务标题<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })}/></label><label>任务类型<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{Object.entries(typeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>执行时间<input type="datetime-local" value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })}/></label><button className="dark-button" onClick={create}>创建随访</button></div>}
    <div className="followup-grid">{items.map((item, index) => <div className={`followup-card ${item.abnormal ? 'abnormal' : ''}`} key={item.id}><div className={`avatar ${index % 2 ? 'blue' : 'rose'}`}>{item.patient.name.slice(0, 1)}</div><div><span>{new Date(item.dueAt).toLocaleString('zh-CN')} · {typeLabels[item.type] || item.type}</span><h3>{item.patient.name} · {item.title}</h3><p>{item.feedback?.text || '\u60a3\u8005\u5c1a\u672a\u63d0\u4ea4\u53cd\u9988'}</p></div><em>{item.abnormal ? '\u5f02\u5e38\u5173\u6ce8' : item.status === 'completed' ? '\u5df2\u5b8c\u6210' : '\u5f85\u5b8c\u6210'}</em><button className="outline-button" onClick={() => setSelected(item)}>\u67e5\u770b\u8bb0\u5f55</button></div>)}</div>
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><section className="knowledge-modal followup-record-modal" role="dialog" aria-modal="true" aria-labelledby="followup-record-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" aria-label="\u5173\u95ed\u8bb0\u5f55" onClick={() => setSelected(null)}><X size={19}/></button><span className="tag">{selected.abnormal ? '\u5f02\u5e38\u53cd\u9988' : selected.status === 'completed' ? '\u5df2\u5b8c\u6210' : '\u5f85\u5904\u7406'}</span><h2 id="followup-record-title">{selected.patient?.name || '\u60a3\u8005'} · {selected.title}</h2><div className="followup-record-meta"><span>\u968f\u8bbf\u7c7b\u578b<strong>{typeLabels[selected.type] || selected.type}</strong></span><span>\u622a\u6b62\u65f6\u95f4<strong>{new Date(selected.dueAt).toLocaleString('zh-CN')}</strong></span></div>{selected.feedback ? <div className="followup-feedback"><div><span>\u75c7\u72b6\u4e25\u91cd\u7a0b\u5ea6</span><strong>{selected.feedback.severity}/10</strong></div><div><span>\u75c7\u72b6\u53d8\u5316</span><p>{selected.feedback.text || '\u60a3\u8005\u672a\u586b\u5199\u6587\u5b57\u63cf\u8ff0'}</p></div><div><span>\u7528\u836f\u60c5\u51b5</span><p>{selected.feedback.medicationTaken ? '\u5df2\u6309\u533b\u5631\u7528\u836f' : '\u672a\u6309\u533b\u5631\u7528\u836f'}</p></div><small>\u63d0\u4ea4\u65f6\u95f4：{new Date(selected.feedback.submittedAt).toLocaleString('zh-CN')}</small></div> : <div className="empty-inline">\u60a3\u8005\u5c1a\u672a\u63d0\u4ea4\u53cd\u9988\uff0c\u6682\u65e0\u968f\u8bbf\u8bb0\u5f55\u3002</div>}</section></div>}
  </div>;
}

function LiveDoctorFollowupsLegacy() {
  const [items,setItems]=useState([]);const [queue,setQueue]=useState([]);const [show,setShow]=useState(false);const [message,setMessage]=useState('');
  const [form,setForm]=useState({patientId:'',title:'症状恢复随访',type:'questionnaire',dueAt:''});
  const load=()=>Promise.all([api.followups(),api.doctorWorkbench()]).then(([a,b])=>{setItems(a.followups);setQueue(b.queue);if(!form.patientId&&b.queue[0])setForm((current)=>({...current,patientId:b.queue[0].patient.id}))});
  useEffect(()=>{load().catch((error)=>setMessage(error.message));},[]);
  async function create(){try{await api.createFollowup(form);setShow(false);setMessage('随访任务已创建，患者端可立即查看。');await load()}catch(error){setMessage(error.message)}}
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><ClipboardCheck size={15}/>诊后管理</span><h1>随访任务</h1><p>创建任务、查看患者反馈并优先处理异常结果。</p></div><button className="primary-button" onClick={()=>setShow(!show)}><Plus size={17}/>新建随访</button></div>{message&&<div className="inline-feedback success">{message}</div>}{show&&<div className="panel create-form"><label>患者<select value={form.patientId} onChange={(e)=>setForm({...form,patientId:e.target.value})}>{queue.map((item)=><option value={item.patient.id} key={item.patient.id}>{item.patient.name}</option>)}</select></label><label>任务标题<input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/></label><label>任务类型<select value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})}><option value="questionnaire">随访问卷</option><option value="medication">用药提醒</option><option value="rehabilitation">康复训练</option><option value="revisit">复诊提醒</option></select></label><label>执行时间<input type="datetime-local" value={form.dueAt} onChange={(e)=>setForm({...form,dueAt:e.target.value})}/></label><button className="dark-button" onClick={create}>创建任务</button></div>}<div className="followup-grid">{items.map((item,index)=><div className={`followup-card ${item.abnormal?'abnormal':''}`} key={item.id}><div className={`avatar ${index%2?'blue':'rose'}`}>{item.patient.name.slice(0,1)}</div><div><span>{new Date(item.dueAt).toLocaleString('zh-CN')} · {item.type}</span><h3>{item.patient.name} · {item.title}</h3><p>{item.feedback?.text||'患者尚未提交反馈'}</p></div><em>{item.abnormal?'异常关注':item.status==='completed'?'已完成':'待完成'}</em><button className="outline-button">查看记录</button></div>)}</div></div>;
}
function LiveDoctorPatients({ onPatient, scope = 'all' }) {
  const [data, setData] = useState(null); 
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState(scope === 'high' ? 'high' : 'all');
  useEffect(() => { 
    const request = scope === 'all' ? api.doctorPatients() : api.doctorWorkbench(); request.then((result) => { const patients = scope === 'all' ? result.patients : result.queue; setData({ patients, followupPatientIds: new Set(patients.filter((item) => item.latestFollowup?.status === 'pending').map((item) => item.patient.id)) }); setFilter(scope === 'high' ? 'high' : 'all'); }).catch((requestError) => setError(requestError.message)); 
  }, [scope]);
  if (!data) return error ? <EmptyState icon={AlertTriangle} title="无法读取患者列表" message={error}/> : <DataLoading label="正在按风险程度整理患者列表…"/>;
  const filteredQueue = data.patients.filter((item) => {
    const matchesKeyword = !keyword.trim() || `${item.patient.name} ${item.report?.chiefComplaint || ''}`.includes(keyword.trim());
    const isFollowup = data.followupPatientIds.has(item.patient.id);
    const isCompleted = item.booking.status === 'completed' || Boolean(item.latestDisposition);
    const recentVisit = Date.now() - new Date(item.booking.appointmentAt).getTime() < 30 * 24 * 3600000;
    return matchesKeyword && (filter === 'all' || (filter === 'high' && item.consultation?.riskLevel === 'high') || (filter === 'followup' && isFollowup) || (filter === 'recent' && recentVisit) || (filter === 'pending' && !isCompleted));
  });
  const riskGroups = [{ risk: 'high', label: '高风险' }, { risk: 'medium', label: '中风险' }, { risk: 'low', label: '低风险' }].map((group) => ({ ...group, patients: filteredQueue.filter((item) => item.consultation?.riskLevel === group.risk) }));
  const visibleRiskGroups = filter === 'high' ? riskGroups.filter((group) => group.risk === 'high') : riskGroups;
  const viewTitle = scope === 'today' ? '今日患者' : scope === 'high' ? '高风险患者' : '我的患者';
  return <div className="page">
    <div className="page-title">
      <div>
        <span className="eyebrow"><Users size={15}/>患者管理</span>
        <h1>{viewTitle}</h1>
        <p>医生长期负责的患者档案，包含已完成和当前就诊记录。</p>
      </div>
    </div>
    <section className="panel patient-list-panel patients-only-panel">
      <div className="section-heading">
        <div>
          <h2>患者列表</h2>
        </div>
        <div className="patient-list-controls"><div className="search-box"><Search size={16}/><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索姓名或患者编号"/></div><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="患者筛选"><option value="all">全部</option><option value="high">高风险</option><option value="followup">随访中</option><option value="recent">最近就诊</option><option value="pending">待处理</option></select></div>
      </div>
      {visibleRiskGroups.map((group)=>
        <div className="patient-risk-group" key={group.risk}>
          <button className="risk-group-heading" onClick={() => setCollapsed((current) => ({ ...current, [group.risk]: !current[group.risk] }))} aria-expanded={!collapsed[group.risk]}>
            <h3>{group.label}</h3>
            <b>{group.patients.length}</b>
            <ChevronDown className={collapsed[group.risk] ? 'collapsed' : ''} size={17}/>
          </button>
          {!collapsed[group.risk] && <div className="patient-table patient-only-table">
            <div className="table-head patient-management-head">
              <span>患者</span>
              <span>风险</span>
              <span>主要问题</span>
              <span>最近预约</span>
              <span>最近随访</span>
              <span>状态</span>
              <span>操作</span>
            </div>
            {group.patients.map((item, index)=>
              <button className="table-row patient-management-row" key={item.booking.id} onClick={() => onPatient(item)}>
                <span className="patient-cell">
                  <i className={`avatar ${group.risk === 'high' ? 'rose' : group.risk === 'medium' ? 'amber' : 'green'}`}>{item.patient.name.slice(0, 1)}</i>
                  <span>
                    <strong>{item.patient.name}</strong>
                    <small>{item.patient.gender} · {item.patient.age} 岁</small>
                  </span>
                </span>
                <span><RiskBadge risk={riskLabel(item.consultation?.riskLevel)}/></span>
                <span className="symptom-cell">{item.report?.chiefComplaint || '报告摘要待生成'}</span>
                <span className="muted">{new Date(item.booking.appointmentAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="patient-status">{item.latestFollowup?.status === 'pending' ? '随访中' : '暂无'}</span>
                <span className="patient-status">{(item.booking.status === 'completed' || item.latestDisposition) ? '已完成' : item.latestFollowup?.status === 'pending' ? '随访中' : '负责中'}</span>
                <span className="patient-action">查看档案 <ChevronRight size={15}/></span>
              </button>
            )}
          </div>}
        </div>
      )}
    </section>
  </div>;
}

function LiveDoctorSchedule({ user }) {
  const [schedules,setSchedules]=useState([]);useEffect(()=>{api.doctorSchedules(user.id).then((result)=>setSchedules(result.schedules));},[user.id]);
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><CalendarDays size={15}/>门诊安排</span><h1>我的排班</h1><p>由管理员统一配置，号源余量随患者挂号实时更新。</p></div></div><div className="schedule-options">{schedules.map((item)=><div className="panel schedule-option" key={item.id}><div className="task-icon"><CalendarDays size={20}/></div><div><span>{item.department} · {item.campus}</span><h3>{new Date(item.startAt).toLocaleString('zh-CN')}</h3><p>至 {new Date(item.endAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</p></div><em>{item.remaining}/{item.capacity} 号</em><span className="online"><i/>{item.status==='open'?'开放':'关闭'}</span></div>)}</div></div>;
}

function LiveDoctorApp({ active, user, setActive }) {
  const [selected,setSelected]=useState(null);
  useEffect(() => { setSelected(null); }, [active]);
  const openPatient = (queueItem) => setSelected({ queueItem, source: active });
  if(selected)return <LiveDoctorPatient queueItem={selected.queueItem} backLabel={selected.source.startsWith('patients') ? '返回患者列表' : '返回接诊工作台'} onBack={()=>setSelected(null)}/>;
    if(active==='workspace')return <LiveDoctorWorkspace onPatient={openPatient} onPatientsView={(filter)=>setActive(filter==='high'?'patients-high':'patients-today')} setActive={setActive}/>;
  if(active==='patients' || active==='patients-today' || active==='patients-high')return <LiveDoctorPatients onPatient={openPatient} scope={active==='patients-high'?'high':active==='patients-today'?'today':'all'}/>;
  if(active==='followups')return <LiveDoctorFollowupsOverview/>;
  return <LiveDoctorSchedule user={user}/>;
}

function AdminDashboard({ setActive }) {
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><Network size={15}/>平台实时状态</span><h1>运营总览</h1><p>诊疗服务、模型调用和安全态势一览。</p></div><div className="date-control"><CalendarDays size={17}/>最近 7 天<ChevronDown size={15}/></div></div>
    <div className="stats-grid"><StatCard icon={MessageCircleMore} tone="blue" label="问诊人数" value="1,284" detail="较上周 +12.6%" trend/><StatCard icon={CalendarDays} tone="violet" label="挂号转化率" value="38.2%" detail="较上周 +4.1%" trend/><StatCard icon={AlertTriangle} tone="rose" label="高风险识别" value="46" detail="3.6% 的问诊用户"/><StatCard icon={Activity} tone="green" label="随访完成率" value="86.4%" detail="较上周 +2.8%" trend/></div>
    <div className="admin-grid"><section className="panel chart-panel"><div className="section-heading"><div><h2>问诊与挂号趋势</h2><p>过去 7 天平台核心业务变化</p></div><div className="chart-legend"><span><i className="blue"/>问诊量</span><span><i className="violet"/>挂号量</span></div></div><div className="chart"><div className="y-axis"><span>240</span><span>180</span><span>120</span><span>60</span><span>0</span></div><div className="bars">{[[62,28],[75,35],[58,24],[82,43],[72,38],[90,48],[84,45]].map(([a,b],i)=><div className="bar-day" key={i}><div className="bar-pair"><i style={{height:`${a}%`}}/><b style={{height:`${b}%`}}/></div><span>{['周一','周二','周三','周四','周五','周六','周日'][i]}</span></div>)}</div></div></section>
      <section className="panel model-health"><div className="section-heading"><div><h2>模型服务</h2><p>DeepSeek 服务实时监控</p></div><span className="online"><i/>运行正常</span></div><div className="model-name"><div><Brain size={24}/></div><p><strong>deepseek-v4-pro</strong><span>生产版本 · Prompt v1.3</span></p><button className="icon-button" onClick={() => setActive('models')}><ChevronRight size={18}/></button></div><div className="model-metrics"><div><span>调用成功率</span><strong>99.4%</strong><i><b style={{width:'99.4%'}}/></i></div><div><span>平均响应</span><strong>3.8s</strong><small>P95 8.2s</small></div><div><span>今日调用</span><strong>2,860</strong><small>失败 17 次</small></div></div></section></div>
    <div className="admin-lower"><section className="panel"><div className="section-heading"><div><h2>科室接诊分布</h2><p>本周已完成接诊量</p></div><button className="text-button">查看报表<ChevronRight size={15}/></button></div><div className="dept-list">{[['神经内科',426,88],['耳鼻喉科',318,66],['眩晕专病门诊',241,50],['全科医学科',97,20]].map(([name,value,pct],i)=><div key={name}><span><i className={`dept-${i}`}/>{name}</span><div><i><b style={{width:`${pct}%`}}/></i><strong>{value}</strong></div></div>)}</div></section><section className="panel activity-feed"><div className="section-heading"><div><h2>实时动态</h2><p>关键业务与安全事件</p></div><button className="text-button" onClick={()=>setActive('audit')}>审计日志<ChevronRight size={15}/></button></div>{auditRows.slice(0,3).map((row,i)=><div className="activity-row" key={row.time}><div className={`activity-icon a${i}`}>{i===1?<Bot size={16}/>:i===2?<CalendarDays size={16}/>:<UserRound size={16}/>}</div><div><strong>{row.action}</strong><span>{row.actor} · {row.object}</span></div><time>{row.time.replace('今天 ','')}</time></div>)}</section></div>
  </div>;
}

function AdminSection({ active }) {
  const config = {
    users: ['用户与角色', '管理平台账号、医生资质与访问权限', UserRoundCog], schedules: ['医生与排班', '配置科室、出诊时段与可用号源', CalendarDays],
    models: ['模型管理', '管理模型版本、提示词与调用状态', Brain], knowledge: ['知识库', '维护医疗科普、问诊模板和危险信号规则', Database], audit: ['审计与安全', '追踪关键操作、访问记录与安全告警', ShieldCheck],
  };
  const [title, subtitle, Icon] = config[active];
  if (active === 'audit') return <div className="page"><div className="page-title"><div><span className="eyebrow"><Icon size={15}/>平台治理</span><h1>{title}</h1><p>{subtitle}</p></div><button className="outline-button"><FileText size={17}/>导出日志</button></div><div className="panel data-panel"><div className="panel-filter"><div className="search-box"><Search size={16}/><input placeholder="搜索操作人、对象或事件"/></div><button className="outline-button">全部事件<ChevronDown size={15}/></button></div><div className="simple-table"><div className="simple-head"><span>时间</span><span>操作人</span><span>事件</span><span>操作对象</span><span>状态</span></div>{auditRows.map(row=><div className="simple-row" key={row.time}><span>{row.time}</span><span>{row.actor}</span><strong>{row.action}</strong><span>{row.object}</span><em className={row.status==='已拦截'?'blocked':'ok'}>{row.status}</em></div>)}</div></div></div>;
  if (active === 'models') return <div className="page"><div className="page-title"><div><span className="eyebrow"><Icon size={15}/>AI 能力中心</span><h1>{title}</h1><p>{subtitle}</p></div><button className="primary-button"><Plus size={17}/>添加模型版本</button></div><div className="model-page-grid"><div className="panel model-config"><div className="config-head"><div className="brain-box"><Brain size={25}/></div><div><span className="online"><i/>当前生效</span><h2>deepseek-v4-pro</h2><p>通过 OpenAI 兼容协议接入 · Prompt v1.3</p></div><button className="outline-button"><Settings size={16}/>配置</button></div><div className="endpoint-box"><span>服务地址</span><code>https://api.modagent-homing.com/v1</code><ShieldCheck size={17}/><small>API 密钥仅存于服务端环境变量</small></div><div className="model-stats-row"><div><span>成功率</span><strong>99.4%</strong></div><div><span>平均响应</span><strong>3.8 秒</strong></div><div><span>今日请求</span><strong>2,860</strong></div><div><span>失败重试</span><strong>17</strong></div></div></div><div className="panel"><h2>版本切换策略</h2><div className="coming-soon"><TableProperties size={35}/><strong>灰度发布接口已预留</strong><p>正式数据库与任务队列接入后，可支持新会话灰度切换及自动回滚。</p><span>下一阶段</span></div></div></div></div>;
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><Icon size={15}/>平台管理</span><h1>{title}</h1><p>{subtitle}</p></div><button className="primary-button"><Plus size={17}/>新建{title === '知识库' ? '内容' : title === '用户与角色' ? '用户' : '排班'}</button></div><div className="panel placeholder-panel"><div className="placeholder-icon"><Icon size={34}/></div><h2>{title}基础界面已就绪</h2><p>本阶段已完成页面框架与交互入口。真实增删改查、权限验证和数据库事务将在后续服务端迭代接入。</p><div className="interface-list"><span><Check size={15}/>列表查询接口</span><span><Check size={15}/>新增与编辑表单</span><span><Check size={15}/>角色权限校验</span><span><Check size={15}/>审计事件写入</span></div><button className="outline-button">查看接口规划<ChevronRight size={16}/></button></div></div>;
}

function LiveAdminDashboard({ setActive }) {
  const [data,setData]=useState(null);useEffect(()=>{api.adminDashboard().then(setData);},[]);
  if(!data)return <DataLoading label="正在汇总平台实时运营数据…"/>;
  const m=data.metrics,model=data.model;
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><Network size={15}/>平台实时状态</span><h1>运营总览</h1><p>所有指标来自当前持久化业务数据。</p></div><div className="date-control"><Activity size={17}/>实时数据</div></div><div className="stats-grid admin-metrics"><StatCard icon={MessageCircleMore} tone="blue" label="累计问诊" value={m.consultations} detail={`平台用户 ${m.users} 人`}/><StatCard icon={CalendarDays} tone="violet" label="挂号转化率" value={`${m.bookingConversion}%`} detail="已结束问诊转化"/><StatCard icon={AlertTriangle} tone="rose" label="高风险识别" value={m.highRisk} detail="规则引擎优先"/><StatCard icon={Clock3} tone="green" label="平均问诊时长" value={`${m.averageConsultationMinutes}m`} detail="已结束会话"/><StatCard icon={Stethoscope} tone="blue" label="医生接诊量" value={m.doctorVisits} detail="已完成资料移交"/><StatCard icon={Activity} tone="green" label="随访完成率" value={`${m.followupCompletion}%`} detail="患者已提交反馈"/><StatCard icon={Bot} tone="violet" label="模型成功率" value={`${m.modelSuccessRate}%`} detail="脱敏调用统计"/><StatCard icon={HelpCircle} tone="rose" label="用户反馈" value={m.feedbackCount} detail={`平均 ${m.feedbackAverage||'—'} 分`}/></div><div className="admin-grid"><section className="panel model-health"><div className="section-heading"><div><h2>模型服务</h2><p>真实调用记录汇总</p></div><span className="online"><i/>配置有效</span></div><div className="model-name"><div><Brain size={24}/></div><p><strong>{model.config?.model||'未配置'}</strong><span>{model.config?.promptVersion} · {model.config?.status}</span></p><button className="icon-button" onClick={()=>setActive('models')}><ChevronRight size={18}/></button></div><div className="model-metrics"><div><span>调用成功率</span><strong>{m.modelSuccessRate}%</strong><i><b style={{width:`${m.modelSuccessRate}%`}}/></i></div><div><span>平均响应</span><strong>{model.averageLatencyMs?`${(model.averageLatencyMs/1000).toFixed(1)}s`:'—'}</strong><small>真实链路</small></div><div><span>今日调用</span><strong>{model.callsToday}</strong><small>失败 {model.failures} 次</small></div></div></section><section className="panel governance-card"><div className="section-heading"><div><h2>平台治理入口</h2><p>关键配置均记录审计</p></div></div><div className="governance-links">{[['users',UserRoundCog,'用户与角色'],['schedules',CalendarDays,'医生与排班'],['knowledge',Database,'医疗知识库'],['audit',ShieldCheck,'审计与安全']].map(([key,Icon,label])=><button key={key} onClick={()=>setActive(key)}><Icon size={18}/><span>{label}</span><ChevronRight size={16}/></button>)}</div></section></div></div>;
}

function LiveAdminUsers() {
  const [users,setUsers]=useState([]);const [show,setShow]=useState(false);const [message,setMessage]=useState('');const [form,setForm]=useState({role:'doctor',name:'',account:'',phone:'',password:'Verti123!',department:'神经内科',title:'主治医师',licenseNo:''});
  const load=()=>api.adminUsers().then((result)=>setUsers(result.users));useEffect(()=>{load();},[]);
  async function toggle(user){try{await api.updateUserStatus(user.id,user.status==='active'?'disabled':'active');setMessage(`${user.name} 的账号状态已更新`);await load()}catch(error){setMessage(error.message)}}
  async function create(){try{await api.createAdminUser(form);setShow(false);setMessage('账号已创建；医生账号需审核启用。');await load()}catch(error){setMessage(error.message)}}
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><UserRoundCog size={15}/>身份与权限</span><h1>用户与角色</h1><p>患者自助注册；医生和管理员由平台管理员创建。</p></div><button className="primary-button" onClick={()=>setShow(!show)}><Plus size={17}/>新建账号</button></div>{message&&<div className="inline-feedback success">{message}</div>}{show&&<div className="panel create-form user-form"><label>角色<select value={form.role} onChange={(e)=>setForm({...form,role:e.target.value})}><option value="doctor">医生</option><option value="admin">管理员</option></select></label><label>姓名<input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></label><label>登录邮箱<input value={form.account} onChange={(e)=>setForm({...form,account:e.target.value})}/></label><label>手机号<input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})}/></label>{form.role==='doctor'&&<label>执业证书编号<input value={form.licenseNo} onChange={(e)=>setForm({...form,licenseNo:e.target.value})}/></label>}<button className="dark-button" onClick={create}>创建账号</button></div>}<div className="panel data-panel"><div className="simple-table"><div className="simple-head user-table"><span>用户</span><span>角色</span><span>账号</span><span>科室/资质</span><span>状态</span><span>操作</span></div>{users.map((user)=><div className="simple-row user-table" key={user.id}><span className="patient-cell"><i className="avatar blue">{user.name.slice(0,1)}</i><strong>{user.name}</strong></span><span>{user.role}</span><span>{user.account}</span><span>{user.role==='doctor'?`${user.department} · ${user.title}`:'—'}</span><em className={user.status==='active'?'ok':'blocked'}>{user.status}</em><button className="outline-button" onClick={()=>toggle(user)} disabled={user.account==='admin@demo.com'}>{user.status==='active'?'禁用':'启用'}</button></div>)}</div></div></div>;
}

function LiveAdminSchedules() {
  const [schedules,setSchedules]=useState([]);const [doctors,setDoctors]=useState([]);const [departments,setDepartments]=useState([]);const [show,setShow]=useState(false);const [message,setMessage]=useState('');const [form,setForm]=useState({doctorId:'',departmentId:'',campus:'滨江院区',startAt:'',endAt:'',capacity:10});
  const load=()=>Promise.all([api.adminSchedules(),api.adminUsers(),api.departments()]).then(([a,b,c])=>{setSchedules(a.schedules);setDoctors(b.users.filter((u)=>u.role==='doctor'&&u.status==='active'));setDepartments(c.departments);setForm((current)=>({...current,doctorId:current.doctorId||b.users.find((u)=>u.role==='doctor'&&u.status==='active')?.id||'',departmentId:current.departmentId||c.departments[0]?.id||''}))});useEffect(()=>{load();},[]);
  async function create(){try{await api.createSchedule({...form,capacity:Number(form.capacity)});setShow(false);setMessage('排班已创建并立即进入患者端号源列表。');await load()}catch(error){setMessage(error.message)}}
  async function close(item){try{await api.updateSchedule(item.id,{status:item.status==='open'?'closed':'open'});await load()}catch(error){setMessage(error.message)}}
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><CalendarDays size={15}/>医疗资源配置</span><h1>医生与排班</h1><p>配置科室、院区、时段和实时号源。</p></div><button className="primary-button" onClick={()=>setShow(!show)}><Plus size={17}/>新增排班</button></div>{message&&<div className="inline-feedback success">{message}</div>}{show&&<div className="panel create-form schedule-form"><label>医生<select value={form.doctorId} onChange={(e)=>setForm({...form,doctorId:e.target.value})}>{doctors.map((d)=><option value={d.id} key={d.id}>{d.name} · {d.department}</option>)}</select></label><label>科室<select value={form.departmentId} onChange={(e)=>setForm({...form,departmentId:e.target.value})}>{departments.map((d)=><option value={d.id} key={d.id}>{d.name}</option>)}</select></label><label>开始时间<input type="datetime-local" value={form.startAt} onChange={(e)=>setForm({...form,startAt:e.target.value})}/></label><label>结束时间<input type="datetime-local" value={form.endAt} onChange={(e)=>setForm({...form,endAt:e.target.value})}/></label><label>号源<input type="number" min="1" value={form.capacity} onChange={(e)=>setForm({...form,capacity:e.target.value})}/></label><button className="dark-button" onClick={create}>保存排班</button></div>}<div className="schedule-options admin-schedules">{schedules.map((item)=><div className="panel schedule-option" key={item.id}><div className="avatar large">{item.doctor?.name?.slice(0,1)||'医'}</div><div><span>{item.department} · {item.campus}</span><h3>{item.doctor?.name} · {new Date(item.startAt).toLocaleString('zh-CN')}</h3><p>号源 {item.remaining}/{item.capacity}</p></div><em>{item.status}</em><button className="outline-button" onClick={()=>close(item)}>{item.status==='open'?'关闭号源':'重新开放'}</button></div>)}</div></div>;
}

function LiveAdminKnowledge() {
  const [items,setItems]=useState([]);const [rules,setRules]=useState([]);const [show,setShow]=useState(false);const [message,setMessage]=useState('');const [form,setForm]=useState({category:'健康科普',title:'',summary:'',content:'',status:'published'});const [ruleForm,setRuleForm]=useState({label:'',keywords:''});const load=()=>Promise.all([api.adminKnowledge(),api.riskRules()]).then(([a,b])=>{setItems(a.items);setRules(b.rules)});useEffect(()=>{load();},[]);
  async function create(){try{await api.createKnowledge(form);setShow(false);setMessage('知识内容已保存并按状态发布。');await load()}catch(error){setMessage(error.message)}}async function toggle(item){await api.updateKnowledge(item.id,{status:item.status==='published'?'draft':'published'});await load()}async function createRule(){try{await api.createRiskRule({label:ruleForm.label,keywords:ruleForm.keywords.split(/[，,\n]/).map((item)=>item.trim()).filter(Boolean)});setRuleForm({label:'',keywords:''});setMessage('危险信号规则已新增并立即生效。');await load()}catch(error){setMessage(error.message)}}async function toggleRule(rule){await api.updateRiskRule(rule.id,{enabled:!rule.enabled});await load()}
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><Database size={15}/>医学内容治理</span><h1>知识库与筛查规则</h1><p>科普内容与诊断逻辑独立维护，危险规则变更即时生效。</p></div><button className="primary-button" onClick={()=>setShow(!show)}><Plus size={17}/>新增科普</button></div>{message&&<div className="inline-feedback success">{message}</div>}{show&&<div className="panel knowledge-editor"><div><label>分类<input value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})}/></label><label>标题<input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/></label><label>摘要<textarea value={form.summary} onChange={(e)=>setForm({...form,summary:e.target.value})}/></label><label>正文<textarea className="large" value={form.content} onChange={(e)=>setForm({...form,content:e.target.value})}/></label></div><button className="dark-button" onClick={create}>保存并发布</button></div>}<div className="knowledge-admin-list">{items.map((item)=><div className="panel" key={item.id}><div><span className="tag">{item.category}</span><h3>{item.title}</h3><p>{item.summary}</p></div><em className={item.status==='published'?'ok':'blocked'}>{item.status}</em><button className="outline-button" onClick={()=>toggle(item)}>{item.status==='published'?'下线':'发布'}</button></div>)}</div><section className="risk-rule-section"><div className="section-heading"><div><h2>危险信号规则</h2><p>关键词以逗号分隔；启用后对下一条患者消息立即生效</p></div></div><div className="panel create-form risk-form"><label>信号名称<input value={ruleForm.label} onChange={(e)=>setRuleForm({...ruleForm,label:e.target.value})} placeholder="例如：吞咽困难"/></label><label>关键词<input value={ruleForm.keywords} onChange={(e)=>setRuleForm({...ruleForm,keywords:e.target.value})} placeholder="吞咽困难，喝水呛咳"/></label><button className="dark-button" onClick={createRule}>新增规则</button></div><div className="risk-rule-list">{rules.map((rule)=><div className="panel" key={rule.id}><div><strong>{rule.label}</strong><span>{rule.keywords.join(' · ')}</span></div><em className={rule.enabled?'ok':'blocked'}>{rule.enabled?'已启用':'已停用'}</em><button className="outline-button" onClick={()=>toggleRule(rule)}>{rule.enabled?'停用':'启用'}</button></div>)}</div></section></div>;
}

function LiveAdminModels() {
  const [data,setData]=useState(null);const [show,setShow]=useState(false);const [message,setMessage]=useState('');const [switching,setSwitching]=useState('');const [form,setForm]=useState({model:'',baseUrl:'https://api.modagent-homing.com/v1',promptVersion:'v1.4'});const load=()=>api.adminModels().then(setData);useEffect(()=>{load();},[]);if(!data)return <DataLoading label="正在读取模型配置与脱敏调用日志…"/>;const config=data.configs.find((item)=>item.status==='active')||data.configs[0];const success=data.calls.length?Math.round(data.calls.filter((item)=>item.success).length/data.calls.length*100):100;
  async function create(){try{await api.createModel(form);setShow(false);setMessage('模型配置已创建；激活前会检查服务可达性。');await load()}catch(error){setMessage(error.message)}}async function activate(item){setSwitching(item.id);try{await api.activateModel(item.id);setMessage('模型已切换。新问诊使用新版本，进行中的会话保持原版本。');await load()}catch(error){setMessage(error.message)}finally{setSwitching('')}}
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><Brain size={15}/>AI 能力中心</span><h1>模型管理</h1><p>API 密钥不会通过此接口或页面返回。</p></div><button className="primary-button" onClick={()=>setShow(!show)}><Plus size={17}/>添加模型版本</button></div>{message&&<div className="inline-feedback success">{message}</div>}{show&&<div className="panel create-form model-create"><label>模型名<input value={form.model} onChange={(e)=>setForm({...form,model:e.target.value})} placeholder="例如 deepseek-v4-pro"/></label><label>服务地址<input value={form.baseUrl} onChange={(e)=>setForm({...form,baseUrl:e.target.value})}/></label><label>提示词版本<input value={form.promptVersion} onChange={(e)=>setForm({...form,promptVersion:e.target.value})}/></label><button className="dark-button" onClick={create}>保存配置</button></div>}<div className="model-page-grid"><div><div className="panel model-config"><div className="config-head"><div className="brain-box"><Brain size={25}/></div><div><span className="online"><i/>当前生效</span><h2>{config?.model}</h2><p>{config?.promptVersion} · OpenAI 兼容协议</p></div></div><div className="endpoint-box"><span>服务地址</span><code>{config?.baseUrl}</code><ShieldCheck size={17}/><small>API 密钥仅由服务端环境变量读取</small></div><div className="model-stats-row"><div><span>最近成功率</span><strong>{success}%</strong></div><div><span>调用记录</span><strong>{data.calls.length}</strong></div><div><span>成功</span><strong>{data.calls.filter((c)=>c.success).length}</strong></div><div><span>失败</span><strong>{data.calls.filter((c)=>!c.success).length}</strong></div></div></div><div className="model-version-list">{data.configs.map((item)=><div className="panel" key={item.id}><div><strong>{item.model}</strong><span>{item.promptVersion} · {item.baseUrl}</span></div><em className={item.status==='active'?'ok':'blocked'}>{item.status}</em>{item.status!=='active'&&<button className="outline-button" disabled={switching===item.id} onClick={()=>activate(item)}>{switching===item.id?'连通性检查中…':'激活版本'}</button>}</div>)}</div></div><div className="panel model-call-list"><h2>最近调用</h2>{data.calls.length?data.calls.slice(0,8).map((call)=><div key={call.id}><span>{new Date(call.createdAt).toLocaleString('zh-CN')}</span><strong>{call.latencyMs}ms</strong><em className={call.success?'ok':'blocked'}>{call.success?'成功':call.error}</em></div>):<p className="empty-inline">暂无模型调用记录</p>}</div></div></div>;
}

function LiveAdminAudit() {
  const [items,setItems]=useState([]);useEffect(()=>{api.adminAudits().then((result)=>setItems(result.audits));},[]);
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><ShieldCheck size={15}/>平台治理</span><h1>审计与安全</h1><p>日志仅追加写入，业务接口不提供修改或删除能力。</p></div><button className="outline-button" onClick={()=>window.print()}><FileText size={17}/>打印日志</button></div><div className="panel data-panel"><div className="simple-table"><div className="simple-head"><span>时间</span><span>操作人</span><span>事件</span><span>操作对象</span><span>状态</span></div>{items.map((item)=><div className="simple-row" key={item.id}><span>{new Date(item.createdAt).toLocaleString('zh-CN')}</span><span>{item.actorName}</span><strong>{item.action}</strong><span>{item.objectType} · {item.objectId.slice(-10)}</span><em className={item.status==='success'?'ok':'blocked'}>{item.status}</em></div>)}</div></div></div>;
}

function LiveAdminApp({ active,setActive }) {
  if(active==='dashboard')return <LiveAdminDashboard setActive={setActive}/>;
  if(active==='users')return <LiveAdminUsers/>;
  if(active==='schedules')return <LiveAdminSchedules/>;
  if(active==='knowledge')return <LiveAdminKnowledge/>;
  if(active==='models')return <LiveAdminModels/>;
  return <LiveAdminAudit/>;
}

function App() {
  const [session, setSession] = useState(undefined);
  const [active, setActive] = useState('overview');
  const [latestReport, setLatestReport] = useState(null);
  const defaults = { patient: 'overview', doctor: 'workspace', admin: 'dashboard' };

  useEffect(() => {
    const logout = () => { setAuthToken(''); setSession(null); };
    window.addEventListener('auth-expired', logout);
    if (!getAuthToken()) setSession(null);
    else api.me().then((result) => { setSession({ user: result.user }); setActive(defaults[result.user.role]); }).catch(logout);
    return () => window.removeEventListener('auth-expired', logout);
  }, []);

  function handleLogin(result) { setSession({ user: result.user }); setActive(defaults[result.user.role]); }
  function logout() { setAuthToken(''); setSession(null); setLatestReport(null); }
  if (session === undefined) return <div className="app-loading"><div className="brand-mark"><Activity size={23}/></div><span>正在验证安全会话…</span></div>;
  if (!session) return <Login onLogin={handleLogin}/>;
  const role = session.user.role;
  const content = (() => {
    if (role === 'patient') {
      if (active === 'overview') return <LivePatientOverview setActive={setActive} user={session.user}/>;
      if (active === 'consult') return <Consultation onReport={(report) => { setLatestReport(report); setActive('reports'); }}/>
      if (active === 'reports') return <LivePatientReport setActive={setActive} latestReport={latestReport}/>;
      if (active === 'appointments') return <LiveAppointments setActive={setActive}/>;
      if (active === 'followup') return <LiveFollowups/>;
      if (active === 'documents') return <PatientDocuments/>;
      if (active === 'education') return <LiveKnowledge/>;
      return <PatientSubPage active={active} setActive={setActive}/>;
    }
    if (role === 'doctor') return <LiveDoctorApp active={active} user={session.user} setActive={setActive}/>;
    return <LiveAdminApp active={active} setActive={setActive}/>;
  })();
  return <Shell role={role} user={session.user} onLogout={logout} active={active} setActive={setActive}>{content}</Shell>;
}

export default App;
