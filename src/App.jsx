import React, { useEffect, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, BarChart3, Bell, BookOpen, Bot, Brain,
  CalendarDays, Check, ChevronDown, ChevronRight, CircleUserRound, ClipboardCheck, Clock3,
  Database, FileClock, FileText, HeartPulse, HelpCircle, History, Hospital, LayoutDashboard,
  LockKeyhole, Menu, MessageCircleMore, MoreHorizontal, Network, Plus, Search, Send, Settings,
  ShieldCheck, Sparkles, Stethoscope, TableProperties, Users, UserRound, UserRoundCog, X, Zap,
} from 'lucide-react';
import { auditRows, patients } from './data';
import Login from './Login';
import { api, getAuthToken, setAuthToken } from './api/client';
import Consultation from './patient/Consultation';

const DISCLAIMER = '本系统仅用于辅助筛查和健康信息参考，不能替代医生面诊和临床诊断。';
const ROLE_LABELS = { patient: '患者端', doctor: '医生端', admin: '管理端' };
const patientNav = [
  ['overview', LayoutDashboard, '健康首页'], ['consult', MessageCircleMore, '智能问诊'],
  ['reports', FileText, '问诊记录'], ['appointments', CalendarDays, '我的挂号'],
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
      <div className="sidebar-top"><Brand /><button className="close-mobile" aria-label="关闭导航" onClick={() => setMobileOpen(false)}><X size={20} /></button></div>
      <div className="nav-label">工作空间</div>
      <nav>{nav.map(([key, Icon, label]) => <button key={key} className={active === key ? 'active' : ''} onClick={() => { setActive(key); setMobileOpen(false); }}>
        <Icon size={19} /><span>{label}</span>{active === key && <span className="nav-indicator" />}
      </button>)}</nav>
      <div className="sidebar-foot">
        <div className="privacy-chip"><ShieldCheck size={17} /><div><strong>隐私安全保护</strong><span>数据加密传输与存储</span></div></div>
        <button className="help-link" onClick={()=>setFeedbackOpen(true)}><HelpCircle size={18} />帮助与反馈</button>
      </div>
    </aside>
    <div className="main-frame">
      <header className="topbar">
        <button className="mobile-menu" aria-label="打开导航" onClick={() => setMobileOpen(true)}><Menu size={22} /></button>
        <div className="topbar-context"><span>{role === 'patient' ? '患者健康中心' : role === 'doctor' ? '临床协作中心' : '平台运营中心'}</span><small>今日 {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}</small></div>
        <div className="top-actions">
          <RoleDisplay role={role} />
          <div className="notification-wrap"><button className="icon-button notification" aria-label="站内通知" onClick={() => setNoticeOpen(!noticeOpen)}><Bell size={19} />{notices.unread > 0 && <i />}</button>{noticeOpen && <div className="notification-panel"><div><strong>站内通知</strong><span>{notices.unread} 条未读</span></div>{notices.notifications.length ? notices.notifications.slice(0,8).map((item)=><button className={item.read?'read':''} key={item.id} onClick={()=>readNotice(item)}><i/><div><strong>{item.title}</strong><p>{item.content}</p><time>{new Date(item.createdAt).toLocaleString('zh-CN')}</time></div></button>) : <p className="empty-notice">暂无通知</p>}</div>}</div>
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

function StatCard({ icon: Icon, tone, label, value, detail, trend }) {
  return <div className="stat-card">
    <div className={`stat-icon ${tone}`}><Icon size={21} /></div>
    <div className="stat-copy"><span>{label}</span><strong>{value}</strong><small className={trend ? 'positive' : ''}>{detail}</small></div>
  </div>;
}


function LivePatientOverview({ setActive, user }) {
  const [data,setData]=useState(null);useEffect(()=>{api.patientDashboard().then(setData);},[]);
  return <div className="page patient-home"><section className="patient-hero"><div className="hero-copy"><span className="eyebrow"><Sparkles size={15}/>AI 眩晕专病助手</span><h1>你好，{user.name}</h1><p>如果出现眩晕、头昏或失衡，我会先用规则筛查危险信号，再由专业模型进行引导式追问。</p><div className="hero-actions"><button className="primary-button" onClick={()=>setActive('consult')}><MessageCircleMore size={18}/>开始智能问诊<ArrowRight size={17}/></button><button className="soft-button" onClick={()=>setActive('reports')}><FileText size={18}/>我的 {data?.reports.length||0} 份报告</button></div></div><div className="hero-visual" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-pulse"><Activity size={38}/></div></div></section><div className="quick-grid"><button className="quick-card indigo" onClick={()=>setActive('consult')}><span><MessageCircleMore size={21}/></span><div><strong>症状不舒服？</strong><p>开始可自动保存的专业预问诊</p></div><ChevronRight size={20}/></button><button className="quick-card mint" onClick={()=>setActive('appointments')}><span><CalendarDays size={21}/></span><div><strong>{data?.upcomingBooking?'已有预约':'预约专科医生'}</strong><p>{data?.upcomingBooking?new Date(data.upcomingBooking.appointmentAt).toLocaleString('zh-CN'):'查看推荐医生与实时号源'}</p></div><ChevronRight size={20}/></button><button className="quick-card amber" onClick={()=>setActive('documents')}><span><FileClock size={21}/></span><div><strong>补充病史资料</strong><p>安全上传检查单和既往病历</p></div><ChevronRight size={20}/></button></div><div className="two-column"><section className="panel"><div className="section-heading"><div><h2>待办健康任务</h2><p>数据来自医生安排的真实随访计划</p></div><button className="text-button" onClick={()=>setActive('followup')}>查看全部<ChevronRight size={15}/></button></div><div className="timeline-list">{data?.followups.length?data.followups.slice(0,3).map((item,index)=><div className="timeline-row" key={item.id}><div className="timeline-date"><b>{new Date(item.dueAt).getDate()}</b><span>{new Date(item.dueAt).toLocaleDateString('zh-CN',{month:'short'})}</span></div><i className={index===0?'current':''}><ClipboardCheck size={13}/></i><div><strong>{item.title}</strong><span>{item.type} · {item.status}</span></div><em>{item.abnormal?'异常关注':'待完成'}</em></div>):<p className="empty-inline">暂无待办随访任务</p>}</div></section><section className="panel knowledge-preview"><div className="section-heading"><div><h2>为你推荐</h2><p>专业知识库内容，不构成诊断</p></div><button className="text-button" onClick={()=>setActive('education')}>全部科普<ChevronRight size={15}/></button></div>{data?.knowledge[0]&&<div className="article-feature"><div className="article-art"><BookOpen size={32}/></div><div><span className="tag">{data.knowledge[0].category}</span><h3>{data.knowledge[0].title}</h3><p>{data.knowledge[0].summary}</p></div></div>}</section></div></div>;
}



function LivePatientReport({ setActive, latestReport }) {
  const [consultations, setConsultations] = useState([]);
  const [selectedId, setSelectedId] = useState(latestReport?.consultationId || '');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    api.consultations().then((result) => {
      setConsultations(result.consultations);
      setSelectedId((current) => current || result.consultations[0]?.id || '');
    }).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let active = true; setDetailLoading(true); setError('');
    api.consultation(selectedId).then((result) => active && setDetail(result)).catch((requestError) => active && setError(requestError.message)).finally(() => active && setDetailLoading(false));
    return () => { active = false; };
  }, [selectedId]);
  if (loading) return <DataLoading label="正在读取加密问诊记录…"/>;
  if (!consultations.length) return <div className="page records-page"><div className="page-title"><div><span className="eyebrow"><History size={15}/>患者问诊中心</span><h1>问诊记录</h1><p>查看进行中的问诊、完整历史对话和结构化报告。</p></div><button className="primary-button" onClick={() => setActive('consult')}><Plus size={17}/>开始新问诊</button></div><EmptyState embedded icon={FileText} title="暂无问诊记录" message={error || '开始一次智能问诊后，对话和结构化报告会保存在这里。'} action="开始智能问诊" onAction={() => setActive('consult')}/></div>;
  const consultation = detail?.consultation || consultations.find((item) => item.id === selectedId);
  const report = detail?.report || (latestReport?.consultationId === selectedId ? latestReport : null);
  const statusLabels = { in_progress: '进行中', report_generated: '已生成报告', transferred: '已移交医生', ended: '已结束' };
  const statusLabel = statusLabels[consultation?.status] || consultation?.status;
  const messages = detail?.messages || [];
  const directionItems = report?.possibleDirections?.length ? report.possibleDirections : ['疾病方向待医生进一步评估'];
  const riskMeta = report ? ({
    emergency: { label: '紧急', timing: report.careTimeframe || '立即急诊或呼叫 120', tone: 'emergency' },
    high: { label: '高', timing: report.careTimeframe || '24 小时内就医', tone: 'high' },
    medium: { label: '中', timing: report.careTimeframe || '一周内就医', tone: 'moderate' },
    low: { label: '低', timing: report.careTimeframe || '按需就医并留意变化', tone: 'low' },
  }[report.riskLevel] || { label: '待评估', timing: '建议咨询医生', tone: 'moderate' }) : null;
  return <div className="page records-page"><button className="back-button" onClick={() => setActive('overview')}><ArrowLeft size={17}/>返回健康首页</button>
    <div className="page-title"><div><span className="eyebrow"><History size={15}/>患者问诊中心</span><h1>问诊记录</h1><p>查看进行中的问诊、完整历史对话和结构化报告。</p></div><button className="primary-button" onClick={() => setActive('consult')}><Plus size={17}/>开始新问诊</button></div>
    {error && <div className="inline-feedback">{error}</div>}
    <div className="records-layout"><aside className="panel record-index"><div className="section-heading"><div><h2>全部记录</h2><p>{consultations.length} 次问诊</p></div></div>{consultations.map((item) => <button key={item.id} className={selectedId === item.id ? 'active' : ''} onClick={() => setSelectedId(item.id)}><span className={`record-status ${item.status}`}>{statusLabels[item.status] || item.status}</span><strong>{new Date(item.createdAt).toLocaleString('zh-CN')}</strong><small>{item.id.slice(-12).toUpperCase()} · {item.riskLevel === 'emergency' ? '紧急' : item.riskLevel === 'high' ? '高' : item.riskLevel === 'medium' ? '中' : '低'}风险</small><ChevronRight size={16}/></button>)}</aside>
      <section className="record-content">{detailLoading ? <div className="panel record-loading">正在读取问诊详情…</div> : <>
        <div className="panel record-summary"><div><span className={`record-status ${consultation?.status}`}>{statusLabel}</span><h2>问诊编号 {consultation?.id.slice(-12).toUpperCase()}</h2><p>{new Date(consultation?.createdAt).toLocaleString('zh-CN')} · 当前风险：{consultation?.riskLevel === 'emergency' ? '紧急' : consultation?.riskLevel === 'high' ? '高' : consultation?.riskLevel === 'medium' ? '中' : '低'}</p></div>{consultation?.status === 'in_progress' && <button className="primary-button" onClick={() => setActive('consult')}>继续问诊<ArrowRight size={16}/></button>}</div>
        <div className="panel timeline-panel"><div className="section-heading"><div><h2>完整问诊对话</h2><p>{messages.length} 条消息，按发生时间保存</p></div></div><div className="conversation-record patient-conversation">{messages.map((item) => <div className={item.role} key={item.id}><span>{item.role === 'user' ? '我' : '眩衡助手'}</span><p>{item.content}</p><time>{new Date(item.createdAt).toLocaleString('zh-CN')}</time></div>)}</div></div>
        {report ? <div className="record-report"><div className="report-heading"><div><span className="eyebrow"><FileText size={15}/>{report.generationSource === 'fallback' ? '保守降级报告' : 'AI 结构化预问诊报告'}</span><h1>眩晕症状初步评估</h1><p>生成于 {new Date(report.createdAt).toLocaleString('zh-CN')}</p></div><div className={`risk-seal ${riskMeta.tone}`}><span>风险等级</span><strong>{riskMeta.label}</strong><small>{riskMeta.timing}</small></div></div>
          <div className={`report-notice ${report.generationSource === 'fallback' ? 'fallback' : ''}`}><ShieldCheck size={19}/><div><strong>{report.generationSource === 'fallback' ? '模型服务不可用，当前为保守报告' : '这不是一份诊断书'}</strong><p>{report.generationSource === 'fallback' ? '报告依据危险信号规则和已记录信息生成，请由医生进一步评估。' : '报告用于帮助你与医生更高效地沟通，具体诊断和治疗方案需由医生面诊后决定。'}</p></div></div>
          <div className="report-grid"><section className="panel report-main"><h2>症状摘要</h2><p className="summary-text">{report.chiefComplaint}</p><div className="fact-grid"><div><span>发作特点</span><strong>{report.episodeFeatures}</strong></div><div><span>主要诱因</span><strong>{report.triggers}</strong></div><div><span>伴随症状</span><strong>{report.accompanyingSymptoms}</strong></div><div><span>危险信号</span><strong className={report.dangerSignals?.length ? 'danger-text' : 'safe-text'}>{report.dangerSignals?.length ? <AlertTriangle size={15}/> : <Check size={15}/>} {report.dangerSignals?.join('、') || '暂未识别'}</strong></div><div><span>既往史</span><strong>{report.history || '未采集'}</strong></div><div><span>当前用药</span><strong>{report.medications || '未采集'}</strong></div></div><h2>可能涉及的方向</h2><div className="direction-card"><div><Brain size={22}/></div><div><strong>{directionItems.join('；')}</strong><p>{report.aiRiskNote}</p></div></div></section>
            <aside><div className="panel recommendation"><span className="tag">就医建议</span><h3>{report.riskLevel === 'emergency' ? '请立即前往急诊或呼叫 120' : report.riskLevel === 'high' ? '建议 24 小时内就医评估' : `建议预约${report.recommendedDepartment}`}</h3><div><Hospital size={17}/><p><span>推荐科室</span><strong>{report.recommendedDepartment}</strong></p></div><div><Clock3 size={17}/><p><span>建议时效</span><strong>{riskMeta.timing}</strong></p></div><button className="primary-button" onClick={() => setActive('appointments')}>查看可约医生<ArrowRight size={17}/></button></div><button className="download-card" onClick={() => window.print()}><FileText size={20}/><div><strong>保存报告</strong><span>打印或导出为 PDF</span></div><ChevronRight size={18}/></button></aside></div></div> : <div className="panel report-pending"><FileClock size={24}/><div><strong>尚未生成报告</strong><p>{consultation?.status === 'in_progress' ? '继续完成症状采集后即可生成结构化报告。' : '报告暂不可用，请稍后重试。'}</p></div></div>}
      </>}</section>
    </div>
  </div>;
}

function LiveAppointments({ setActive }) {
  const [data, setData] = useState({ bookings: [], schedules: [], reports: [] });
  const [selectedConsultationId, setSelectedConsultationId] = useState('');
  const [loading, setLoading] = useState(true); const [message, setMessage] = useState(''); const [bookingId, setBookingId] = useState('');
  const load = () => Promise.all([api.bookings(), api.schedules(), api.reports()]).then(([bookings, schedules, reports]) => setData({ bookings: bookings.bookings, schedules: schedules.schedules, reports: reports.reports })).finally(() => setLoading(false));
  useEffect(() => { load().catch((error) => { setMessage(error.message); setLoading(false); }); }, []);
  const bookedConsultations = new Set(data.bookings.filter((item) => item.status !== 'cancelled').map((item) => item.consultationId));
  const availableReports = data.reports.filter((item) => !bookedConsultations.has(item.consultationId));
  const sortedSchedules = [...data.schedules].sort((a, b) => {
    if (!selectedConsultationId) return a.startAt.localeCompare(b.startAt);
    const report = data.reports.find((item) => item.consultationId === selectedConsultationId);
    const reportDepartment = report?.recommendedDepartment || '';
    const aMatch = reportDepartment && (a.department.includes(reportDepartment.split('/')[0]) || reportDepartment.includes(a.department));
    const bMatch = reportDepartment && (b.department.includes(reportDepartment.split('/')[0]) || reportDepartment.includes(b.department));
    return Number(bMatch) - Number(aMatch) || a.startAt.localeCompare(b.startAt);
  });
  async function book(schedule) {
    const report = data.reports.find((item) => item.consultationId === selectedConsultationId) || availableReports[0];
    if (!report) { setMessage('请先完成一份尚未挂号的问诊报告。'); return; }
    setSelectedConsultationId(report.consultationId);
    setBookingId(schedule.id); setMessage('');
    try { await api.createBooking(report.consultationId, schedule.id); setMessage('挂号成功，问诊报告已安全移交给对应医生。'); await load(); }
    catch (error) { setMessage(error.message); } finally { setBookingId(''); }
  }
  async function cancel(booking){if(!window.confirm('确认取消这次挂号并释放号源？'))return;try{await api.cancelBooking(booking.id);setMessage('挂号已取消，号源已释放。');await load()}catch(error){setMessage(error.message)}}
  if (loading) return <DataLoading label="正在读取号源与挂号信息…"/>;
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><CalendarDays size={15}/>患者健康服务</span><h1>我的挂号</h1><p>查看已确认预约，或使用问诊报告预约推荐门诊。</p></div><button className="outline-button" onClick={() => setActive('reports')}><FileText size={17}/>查看报告</button></div>{message && <div className={`inline-feedback ${message.includes('成功') ? 'success' : ''}`}>{message}</div>}
    <div className="service-section"><h2>预约记录</h2>{data.bookings.length ? <div className="booking-list">{data.bookings.map((booking) => <div className={`appointment-card ${booking.status}`} key={booking.id}><div className="appointment-date"><span>{new Date(booking.appointmentAt).toLocaleDateString('zh-CN',{weekday:'short'})}</span><strong>{new Date(booking.appointmentAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</strong><small>{new Date(booking.appointmentAt).toLocaleDateString('zh-CN')}</small></div><div className="appointment-doctor"><div className="avatar large">{booking.doctor.name.slice(0,1)}</div><div><span className="tag">{booking.status==='confirmed'?'已确认':booking.status==='completed'?'已完成':'已取消'}</span><h3>{booking.doctor.name} · {booking.doctor.title}</h3><p>{booking.department}</p></div></div><div className="appointment-place"><Hospital size={18}/><div><span>{booking.campus}</span><small>挂号号 {booking.id.slice(-6).toUpperCase()}</small></div></div>{booking.status==='confirmed'?<button className="outline-button" onClick={()=>cancel(booking)}>取消挂号</button>:<span className="muted">{booking.status}</span>}</div>)}</div> : <p className="empty-inline">暂无预约记录</p>}</div>
    <div className="service-section"><div className="section-heading"><div><h2>可预约号源</h2><p>请先选择要移交给医生的问诊报告，推荐科室号源会优先显示。</p></div></div>{availableReports.length ? <label className="report-choice">移交问诊报告<select value={selectedConsultationId} onChange={(event) => setSelectedConsultationId(event.target.value)}>{availableReports.map((item) => <option value={item.consultationId} key={item.id}>{new Date(item.createdAt).toLocaleString('zh-CN')} · {item.recommendedDepartment} · {item.riskLevel === 'emergency' ? '紧急' : item.riskLevel === 'high' ? '高' : item.riskLevel === 'medium' ? '中' : '低'}风险</option>)}</select></label> : <div className="empty-inline">暂无未挂号问诊报告，请先完成智能问诊。</div>}<div className="schedule-options">{sortedSchedules.map((schedule) => <div className="panel schedule-option" key={schedule.id}><div className="avatar large">{schedule.doctor.name.slice(0,1)}</div><div><span>{schedule.department} · {schedule.campus}</span><h3>{schedule.doctor.name} · {schedule.doctor.title}</h3><p>{new Date(schedule.startAt).toLocaleString('zh-CN',{month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'})}</p></div><em>余 {schedule.remaining} 号</em><button className="primary-button" disabled={bookingId === schedule.id || !availableReports.length} onClick={() => book(schedule)}>{bookingId === schedule.id ? '预约中…' : '确认预约'}</button></div>)}</div></div>
  </div>;
}

function LiveFollowups() {
  const [items, setItems] = useState([]); const [activeId, setActiveId] = useState(''); const [form, setForm] = useState({ severity: 3, frequency: 0, text: '', medicationTaken: true }); const [message, setMessage] = useState('');
  const load = () => api.followups().then((result) => setItems(result.followups));
  useEffect(() => { load().catch((error) => setMessage(error.message)); }, []);
  async function submit(id) { try { const result = await api.submitFollowup(id, form); setMessage(result.message); setActiveId(''); await load(); } catch (error) { setMessage(error.message); } }
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><Activity size={15}/>诊后健康管理</span><h1>康复随访</h1><p>反馈真实症状变化；异常结果会标记给医生关注。</p></div></div>{message && <div className={`inline-feedback ${message.includes('异常') || message.includes('就医') ? 'warning' : 'success'}`}>{message}</div>}{items.length ? <div className="followup-grid">{items.map((item,index) => <div className={`followup-card live ${item.abnormal ? 'abnormal' : ''}`} key={item.id}><div className={`task-icon t${index%3}`}><ClipboardCheck size={20}/></div><div><span>{item.type} · 截止 {new Date(item.dueAt).toLocaleString('zh-CN')}</span><h3>{item.title}</h3><p>{item.status === 'completed' ? `已提交 · 严重程度 ${item.feedback?.severity}/10 · 过去 24 小时 ${item.feedback?.frequency ?? 0} 次` : '请按计划记录当前症状、发作频率和用药情况'}</p></div><em>{item.abnormal ? '异常关注' : item.status === 'completed' ? '已完成' : '待完成'}</em>{item.status === 'pending' && <button className="primary-button" onClick={() => setActiveId(activeId === item.id ? '' : item.id)}>开始填写</button>}{activeId === item.id && <div className="followup-form"><label>当前眩晕严重程度 <strong>{form.severity}/10</strong><input type="range" min="0" max="10" value={form.severity} onChange={(event) => setForm({...form,severity:Number(event.target.value)})}/></label><label>过去 24 小时发作次数 <input type="number" min="0" max="1000" value={form.frequency} onChange={(event) => setForm({...form,frequency:Number(event.target.value)})}/></label><label>症状变化<textarea value={form.text} onChange={(event)=>setForm({...form,text:event.target.value})} placeholder="例如：今天眩晕次数减少，但起床时仍明显…"/></label><label className="check-line"><input type="checkbox" checked={form.medicationTaken} onChange={(event)=>setForm({...form,medicationTaken:event.target.checked})}/>已按医嘱用药</label><button className="dark-button" onClick={() => submit(item.id)}>提交随访反馈</button></div>}</div>)}</div> : <EmptyState icon={ClipboardCheck} title="暂无随访任务" message="医生安排随访后，任务和提醒会显示在这里。"/>}</div>;
}

function knowledgeCategoryForReport(report) {
  if (!report) return '';
  if (['emergency', 'high'].includes(report.riskLevel)) return '危险信号';
  const direction = `${report.possibleDirections?.join(' ') || ''} ${report.aiRiskNote || ''}`;
  if (direction.includes('耳石') || direction.includes('位置性')) return '耳石症';
  if (direction.includes('梅尼埃')) return '梅尼埃病';
  if (direction.includes('偏头痛')) return '前庭性偏头痛';
  if (direction.includes('前庭神经炎')) return '前庭神经炎';
  return '就医准备';
}

function LiveKnowledge() {
  const [items, setItems] = useState([]); const [reports, setReports] = useState([]); const [selected, setSelected] = useState(null); const [category, setCategory] = useState(''); const [error, setError] = useState('');
  useEffect(() => { let active = true; setError(''); api.knowledge(category).then((result) => active && setItems(result.items)).catch((requestError) => active && setError(requestError.message)); return () => { active = false; }; }, [category]);
  useEffect(() => { let active = true; api.reports().then((result) => active && setReports(result.reports)).catch(() => {}); return () => { active = false; }; }, []);
  const categories = ['全部', '耳石症', '梅尼埃病', '前庭神经炎', '前庭性偏头痛', '日常防护', '就医准备', '危险信号', '康复训练'];
  const latestReport = [...reports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  const inferredCategory = knowledgeCategoryForReport(latestReport);
  const recommendedCategory = items.some((item) => item.category === inferredCategory) ? inferredCategory : items.some((item) => item.category === '就医准备') ? '就医准备' : inferredCategory;
  const visibleItems = category || !recommendedCategory ? items : [...items].sort((a, b) => Number(b.category === recommendedCategory) - Number(a.category === recommendedCategory));
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><BookOpen size={15}/>专业健康知识库</span><h1>眩晕健康科普</h1><p>科普内容与诊断结论分开呈现，仅用于健康教育。</p></div></div>{latestReport && <div className="knowledge-reason"><Sparkles size={18}/><div><strong>已结合最近一次问诊为你排序</strong><span>{['emergency', 'high'].includes(latestReport.riskLevel) ? '报告含较高风险提示，优先了解危险信号和及时就医。' : `报告方向与“${recommendedCategory}”相关，优先展示对应科普和就医准备。`}</span></div><button onClick={() => setCategory(recommendedCategory)}>只看相关推荐</button></div>}<div className="knowledge-filters">{categories.map((item) => <button className={(category || '全部') === item ? 'active' : ''} key={item} onClick={() => setCategory(item === '全部' ? '' : item)}>{item}</button>)}</div>{error && <div className="inline-feedback">{error}</div>}{visibleItems.length ? <div className="article-grid live">{visibleItems.map((item,index)=><article className={!category && item.category === recommendedCategory ? 'recommended-article' : ''} key={item.id} onClick={()=>setSelected(item)}><div className={`article-cover cover-${index%4+1}`}><BookOpen size={30}/></div><span className="tag">{item.category}</span>{!category && item.category === recommendedCategory && <span className="report-match">报告相关</span>}<h3>{item.title}</h3><p>{item.summary}</p><small>阅读详情 <ArrowRight size={14}/></small></article>)}</div> : <EmptyState icon={BookOpen} title="暂无匹配科普" message="当前分类暂无文章，已建议你浏览全部眩晕健康知识。" action="查看全部科普" onAction={() => setCategory('')}/>} {selected && <div className="modal-backdrop" onClick={()=>setSelected(null)}><article className="knowledge-modal" onClick={(event)=>event.stopPropagation()}><button className="modal-close" onClick={()=>setSelected(null)}><X size={19}/></button><span className="tag">{selected.category}</span><h2>{selected.title}</h2><p>{selected.content}</p><div className="report-notice"><ShieldCheck size={17}/><div><strong>健康教育提示</strong><p>本文不构成诊断或治疗建议。如出现危险信号，请立即就医。</p></div></div></article></div>}</div>;
}

function PatientDocuments() {
  const [items,setItems]=useState([]);const [file,setFile]=useState(null);const [category,setCategory]=useState('检查资料');const [message,setMessage]=useState('');const [uploading,setUploading]=useState(false);
  const load=()=>api.uploads().then((result)=>setItems(result.uploads));useEffect(()=>{load().catch((error)=>setMessage(error.message));},[]);
  async function upload(){if(!file){setMessage('请先选择 PDF、JPG 或 PNG 文件');return}setUploading(true);const body=new FormData();body.append('file',file);body.append('category',category);try{await api.upload(body);setMessage('资料已加密保存，挂号移交后对应医生可查看。');setFile(null);await load()}catch(error){setMessage(error.message)}finally{setUploading(false)}}
  async function download(item){const response=await fetch(`/api/v1/uploads/${item.id}/download`,{headers:{Authorization:`Bearer ${getAuthToken()}`}});if(!response.ok){setMessage('下载失败或当前无访问权限');return}const blob=await response.blob();const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=item.name;anchor.click();URL.revokeObjectURL(url)}
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><FileClock size={15}/>患者资料中心</span><h1>健康资料</h1><p>上传检查单或病史图片，挂号后安全移交给对应医生。</p></div></div>{message&&<div className={`inline-feedback ${message.includes('已加密')?'success':''}`}>{message}</div>}<div className="document-layout"><div className="panel upload-box"><div className="placeholder-icon"><FileText size={30}/></div><h2>上传病史资料</h2><p>仅支持 PDF、JPG、PNG，单个文件不超过 5MB；禁止上传可执行文件。</p><label className="file-picker"><input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e)=>setFile(e.target.files?.[0]||null)}/><span>{file?file.name:'选择文件'}</span></label><label>资料类型<select value={category} onChange={(e)=>setCategory(e.target.value)}><option>检查资料</option><option>既往病历</option><option>用药清单</option><option>其他资料</option></select></label><button className="primary-button" disabled={uploading} onClick={upload}>{uploading?'安全上传中…':'确认上传'}</button></div><div className="panel document-list"><div className="section-heading"><div><h2>我的资料</h2><p>{items.length} 个已加密文件</p></div></div>{items.length?items.map((item)=><button key={item.id} onClick={()=>download(item)}><div className="task-icon"><FileText size={19}/></div><div><strong>{item.name}</strong><span>{item.category} · {(item.size/1024).toFixed(1)}KB · {new Date(item.createdAt).toLocaleString('zh-CN')}</span></div><ChevronRight size={17}/></button>):<p className="empty-inline">暂无上传资料</p>}</div></div></div>;
}

function DataLoading({ label }) { return <div className="page"><div className="data-loading"><div className="brand-mark"><Activity size={21}/></div><span>{label}</span></div></div>; }
function EmptyState({ icon: Icon, title, message, action, onAction, embedded = false }) { return <div className={embedded ? '' : 'page'}><div className="panel placeholder-panel"><div className="placeholder-icon"><Icon size={34}/></div><h2>{title}</h2><p>{message}</p>{action && <button className="primary-button" onClick={onAction}>{action}<ArrowRight size={16}/></button>}</div></div>; }

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

const riskLabel = (risk) => risk === 'emergency' ? '紧急' : risk === 'high' ? '高' : risk === 'low' ? '低' : '中';

function LiveDoctorWorkspace({ onPatient }) {
  const [data, setData] = useState(null); const [error, setError] = useState('');
  useEffect(() => { api.doctorWorkbench().then(setData).catch((requestError) => setError(requestError.message)); }, []);
  if (!data) return error ? <EmptyState icon={AlertTriangle} title="无法读取接诊队列" message={error}/> : <DataLoading label="正在按风险等级整理患者队列…"/>;
  const priority = data.queue.find((item) => ['emergency','high'].includes(item.consultation?.riskLevel));
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><Stethoscope size={15}/>临床工作台</span><h1>今日接诊工作台</h1><p>共有 {data.summary.pending} 位已移交患者，{data.summary.highRisk} 位需要优先关注。</p></div><div className="date-control"><CalendarDays size={17}/>{new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'})}</div></div>
    <div className="stats-grid doctor-stats"><StatCard icon={Users} tone="blue" label="待接诊" value={data.summary.pending} detail="已完成挂号移交"/><StatCard icon={AlertTriangle} tone="rose" label="高风险患者" value={data.summary.highRisk} detail="规则优先排序"/><StatCard icon={ClipboardCheck} tone="violet" label="待办随访" value={data.summary.followups} detail={`${data.summary.abnormalFollowups} 项异常关注`}/><StatCard icon={ShieldCheck} tone="green" label="资料访问" value="已审计" detail="查看行为自动留痕"/></div>
    <div className="doctor-layout"><section className="panel patient-list-panel"><div className="section-heading"><div><h2>患者队列</h2><p>只展示已挂号并分配给当前医生的患者</p></div></div><div className="tabs"><button className="active">待接诊 <b>{data.queue.length}</b></button><button>高风险 <b>{data.summary.highRisk}</b></button></div><div className="patient-table"><div className="table-head"><span>患者</span><span>AI 风险</span><span>症状摘要</span><span>预约时间</span><span/></div>{data.queue.map((item,index)=><button className="table-row" key={item.booking.id} onClick={()=>onPatient(item)}><span className="patient-cell"><i className={`avatar ${index%2?'blue':'rose'}`}>{item.patient.name.slice(0,1)}</i><span><strong>{item.patient.name}</strong><small>{item.patient.gender} · {item.patient.age} 岁 · {item.patient.id}</small></span></span><span><RiskBadge risk={riskLabel(item.consultation.riskLevel)}/></span><span className="symptom-cell">{item.report?.chiefComplaint || '报告摘要待生成'}</span><span className="muted">{new Date(item.booking.appointmentAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span><span><ChevronRight size={18}/></span></button>)}</div></section>
      <aside className="doctor-aside">{priority ? <div className="panel priority-card"><div className="priority-head"><span><Zap size={18}/>优先关注</span><em>规则引擎</em></div><div className="priority-patient"><div className="avatar rose">{priority.patient.name.slice(0,1)}</div><div><strong>{priority.patient.name} · {priority.patient.age} 岁</strong><span>{priority.consultation.dangerSignals.join('、') || '高风险基础病史'}</span></div></div><div className="risk-reason"><AlertTriangle size={18}/><p><strong>危险信号不可被 AI 降级</strong><span>{priority.report?.aiRiskNote}</span></p></div><button className="dark-button" onClick={()=>onPatient(priority)}>立即查看资料<ArrowRight size={16}/></button></div> : <div className="panel priority-card"><div className="priority-head"><span><ShieldCheck size={18}/>暂无高风险患者</span></div></div>}<div className="panel schedule-card"><div className="section-heading"><div><h2>资料移交状态</h2><p>挂号成功后才允许医生访问</p></div></div>{data.queue.slice(0,3).map((item)=><div className="schedule-row" key={item.booking.id}><strong>{new Date(item.booking.appointmentAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</strong><i/><div><span>{item.patient.name}</span><small>{item.booking.department} · 报告已移交</small></div><em>已授权</em></div>)}</div></aside></div>
  </div>;
}

function LiveDoctorPatient({ queueItem, onBack }) {
  const [data,setData]=useState(null); const [message,setMessage]=useState(''); const [saving,setSaving]=useState(false);
  const [analysis,setAnalysis]=useState(null); const [analysisLoading,setAnalysisLoading]=useState(false);
  const [form,setForm]=useState({diagnosis:'',examination:'',treatment:'',medication:'',rehabilitation:'',revisitAt:'',followupPlan:''});
  useEffect(()=>{api.doctorPatient(queueItem.patient.id).then(setData).catch((error)=>setMessage(error.message));},[queueItem.patient.id]);
  async function save(){if(!form.diagnosis.trim()){setMessage('请填写临床诊断或诊断考虑');return}setSaving(true);try{await api.createDisposition({...form,patientId:queueItem.patient.id,consultationId:queueItem.consultation.id});setMessage('处置记录已保存，并与 AI 风险提示分开存储。');const next=await api.doctorPatient(queueItem.patient.id);setData(next)}catch(error){setMessage(error.message)}finally{setSaving(false)}}
  async function downloadUpload(item){const response=await fetch(`/api/v1/uploads/${item.id}/download`,{headers:{Authorization:`Bearer ${getAuthToken()}`}});if(!response.ok){setMessage('资料下载失败');return}const blob=await response.blob();const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=item.name;anchor.click();URL.revokeObjectURL(url)}
  async function generateAnalysis(){setAnalysisLoading(true);try{const result=await api.doctorAnalysis(queueItem.patient.id);setAnalysis(result.analysis);setMessage('AI 辅助分析已更新；结果仅供医生参考。')}catch(error){setMessage(error.message)}finally{setAnalysisLoading(false)}}
  if(!data)return message?<EmptyState icon={AlertTriangle} title="无法读取患者资料" message={message} action="返回队列" onAction={onBack}/>:<DataLoading label="正在读取患者授权资料并记录审计…"/>;
  const report=data.reports.find((item)=>item.consultationId===queueItem.consultation.id)||data.reports[0];
  const messages=data.messages.filter((item)=>item.consultationId===queueItem.consultation.id);
  return <div className="page patient-detail"><button className="back-button" onClick={onBack}><ArrowLeft size={17}/>返回患者队列</button><div className="detail-head"><div className="avatar xl rose">{data.patient.name.slice(0,1)}</div><div><div className="name-line"><h1>{data.patient.name}</h1><RiskBadge risk={riskLabel(queueItem.consultation.riskLevel)}/></div><p>{data.patient.gender} · {data.patient.age} 岁 · 患者编号 {data.patient.id}</p></div><div className="detail-actions"><span className="reference-label"><ShieldCheck size={13}/>访问已审计</span></div></div>{message&&<div className={`inline-feedback ${message.includes('已保存')?'success':''}`}>{message}</div>}
    <div className="detail-grid"><section><div className="panel clinical-summary"><div className="section-heading"><div><span className="eyebrow"><Sparkles size={14}/>AI 问诊摘要</span><h2>症状与风险概览</h2></div><span className="reference-label">仅供辅助参考</span></div><div className="summary-highlight"><p>{report?.chiefComplaint||'暂无结构化摘要'}</p></div><div className="clinical-facts"><div><span>发作特点</span><strong>{report?.episodeFeatures||'未采集'}</strong></div><div><span>诱发因素</span><strong>{report?.triggers||'未采集'}</strong></div><div><span>伴随症状</span><strong>{report?.accompanyingSymptoms||'未采集'}</strong></div><div><span>既往史</span><strong>{report?.history||'未采集'}</strong></div></div>{queueItem.consultation.dangerSignals.length>0&&<div className="danger-box"><AlertTriangle size={20}/><div><strong>规则引擎标记：{queueItem.consultation.dangerSignals.join('、')}</strong><p>危险信号优先级高于模型判断，请优先完成人工复核与必要检查。</p></div></div>}</div>
      <div className="panel timeline-panel"><h2>原始问诊对话</h2><div className="conversation-record">{messages.map((item)=><div className={item.role} key={item.id}><span>{item.role==='user'?data.patient.name:'AI 助手'}</span><p>{item.content}</p><time>{new Date(item.createdAt).toLocaleString('zh-CN')}</time></div>)}</div></div>{data.uploads.length>0&&<div className="panel timeline-panel"><h2>患者补充资料</h2><div className="mini-documents">{data.uploads.map((item)=><button key={item.id} onClick={()=>downloadUpload(item)}><FileText size={17}/><span>{item.name}<small>{item.category} · {(item.size/1024).toFixed(1)}KB</small></span><ChevronRight size={16}/></button>)}</div></div>}{data.dispositions.length>0&&<div className="panel timeline-panel"><h2>历史处置记录</h2>{data.dispositions.map((item)=><div className="saved-disposition" key={item.id}><strong>{item.diagnosis}</strong><span>{new Date(item.submittedAt).toLocaleString('zh-CN')}</span><p>{item.examination} {item.treatment}</p></div>)}</div>}</section>
      <aside><div className="panel ai-assist"><div className="side-title"><span>AI 辅助分析</span><Bot size={18}/></div>{analysis?<><div className="assist-block"><span>症状要点</span><ul>{analysis.symptomHighlights.map((item)=><li key={item}>{item}</li>)}</ul></div><div className="assist-block"><span>建议进一步追问</span><ul>{analysis.followupQuestions.map((item)=><li key={item}>{item}</li>)}</ul></div><div className="assist-block"><span>鉴别方向</span><div className="check-tags">{analysis.differentialDirections.map((item)=><b key={item}>{item}</b>)}</div></div><div className="assist-block"><span>建议检查</span><div className="check-tags">{analysis.suggestedExams.map((item)=><b key={item}>{item}</b>)}</div></div></>:<div className="assist-block"><span>当前结构化摘要</span><p>{report?.aiRiskNote||'请结合问诊对话人工分析'}</p></div>}<button className="soft-button full" disabled={analysisLoading} onClick={generateAnalysis}><Sparkles size={16}/>{analysisLoading?'模型分析中…':analysis?'重新生成分析':'生成结构化分析'}</button><p className="assist-note">仅供参考，最终判断由医生完成；不会覆盖医生意见。</p></div><div className="panel record-form"><h2>医生处置记录</h2><label>临床诊断 / 诊断考虑 *<textarea value={form.diagnosis} onChange={(e)=>setForm({...form,diagnosis:e.target.value})} placeholder="由医生填写，不覆盖 AI 风险提示…"/></label><label>检查意见<textarea value={form.examination} onChange={(e)=>setForm({...form,examination:e.target.value})}/></label><label>治疗与用药建议<textarea value={`${form.treatment}${form.treatment&&form.medication?'\n':''}${form.medication}`} onChange={(e)=>setForm({...form,treatment:e.target.value})}/></label><div className="form-row"><label>复诊时间<input type="datetime-local" value={form.revisitAt} onChange={(e)=>setForm({...form,revisitAt:e.target.value})}/></label><label>随访计划<select value={form.followupPlan} onChange={(e)=>setForm({...form,followupPlan:e.target.value})}><option value="">暂不安排</option><option value="3 天后症状随访">3 天后</option><option value="7 天后症状随访">7 天后</option></select></label></div><button className="primary-button full" disabled={saving} onClick={save}>{saving?'保存中…':'保存处置记录'}</button></div></aside></div>
  </div>;
}

function LiveDoctorFollowups() {
  const [items,setItems]=useState([]);const [queue,setQueue]=useState([]);const [show,setShow]=useState(false);const [message,setMessage]=useState('');
  const [form,setForm]=useState({patientId:'',title:'症状恢复随访',type:'questionnaire',dueAt:''});
  const load=()=>Promise.all([api.followups(),api.doctorWorkbench()]).then(([a,b])=>{setItems(a.followups);setQueue(b.queue);if(!form.patientId&&b.queue[0])setForm((current)=>({...current,patientId:b.queue[0].patient.id}))});
  useEffect(()=>{load().catch((error)=>setMessage(error.message));},[]);
  async function create(){try{await api.createFollowup(form);setShow(false);setMessage('随访任务已创建，患者端可立即查看。');await load()}catch(error){setMessage(error.message)}}
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><ClipboardCheck size={15}/>诊后管理</span><h1>随访任务</h1><p>创建任务、查看患者反馈并优先处理异常结果。</p></div><button className="primary-button" onClick={()=>setShow(!show)}><Plus size={17}/>新建随访</button></div>{message&&<div className="inline-feedback success">{message}</div>}{show&&<div className="panel create-form"><label>患者<select value={form.patientId} onChange={(e)=>setForm({...form,patientId:e.target.value})}>{queue.map((item)=><option value={item.patient.id} key={item.patient.id}>{item.patient.name}</option>)}</select></label><label>任务标题<input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/></label><label>任务类型<select value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})}><option value="questionnaire">随访问卷</option><option value="medication">用药提醒</option><option value="rehabilitation">康复训练</option><option value="revisit">复诊提醒</option></select></label><label>执行时间<input type="datetime-local" value={form.dueAt} onChange={(e)=>setForm({...form,dueAt:e.target.value})}/></label><button className="dark-button" onClick={create}>创建任务</button></div>}<div className="followup-grid">{items.map((item,index)=><div className={`followup-card ${item.abnormal?'abnormal':''}`} key={item.id}><div className={`avatar ${index%2?'blue':'rose'}`}>{item.patient.name.slice(0,1)}</div><div><span>{new Date(item.dueAt).toLocaleString('zh-CN')} · {item.type}</span><h3>{item.patient.name} · {item.title}</h3><p>{item.feedback?.text||'患者尚未提交反馈'}</p></div><em>{item.abnormal?'异常关注':item.status==='completed'?'已完成':'待完成'}</em><button className="outline-button">查看记录</button></div>)}</div></div>;
}

function LiveDoctorSchedule({ user }) {
  const [schedules,setSchedules]=useState([]);useEffect(()=>{api.doctorSchedules(user.id).then((result)=>setSchedules(result.schedules));},[user.id]);
  return <div className="page"><div className="page-title"><div><span className="eyebrow"><CalendarDays size={15}/>门诊安排</span><h1>我的排班</h1><p>由管理员统一配置，号源余量随患者挂号实时更新。</p></div></div><div className="schedule-options">{schedules.map((item)=><div className="panel schedule-option" key={item.id}><div className="task-icon"><CalendarDays size={20}/></div><div><span>{item.department} · {item.campus}</span><h3>{new Date(item.startAt).toLocaleString('zh-CN')}</h3><p>至 {new Date(item.endAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</p></div><em>{item.remaining}/{item.capacity} 号</em><span className="online"><i/>{item.status==='open'?'开放':'关闭'}</span></div>)}</div></div>;
}

function LiveDoctorApp({ active, user }) {
  const [selected,setSelected]=useState(null);
  if(selected)return <LiveDoctorPatient queueItem={selected} onBack={()=>setSelected(null)}/>;
  if(active==='workspace'||active==='patients')return <LiveDoctorWorkspace onPatient={setSelected}/>;
  if(active==='followups')return <LiveDoctorFollowups/>;
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
      return <LivePatientOverview setActive={setActive} user={session.user}/>;
    }
    if (role === 'doctor') return <LiveDoctorApp active={active} user={session.user}/>;
    return <LiveAdminApp active={active} setActive={setActive}/>;
  })();
  return <Shell role={role} user={session.user} onLogout={logout} active={active} setActive={setActive}>{content}</Shell>;
}

export default App;
