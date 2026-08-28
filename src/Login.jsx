import React, { useState } from 'react';
import { Activity, ArrowRight, Brain, Check, Eye, EyeOff, LockKeyhole, ShieldCheck, Stethoscope, UserRound, Users } from 'lucide-react';
import { api, setAuthToken } from './api/client';

const accounts = {
  patient: { account: 'patient@demo.com', password: 'Verti123!', label: '患者', icon: UserRound },
  doctor: { account: 'doctor@demo.com', password: 'Verti123!', label: '医生', icon: Stethoscope },
  admin: { account: 'admin@demo.com', password: 'Verti123!', label: '管理员', icon: Users },
};

export default function Login({ onLogin }) {
  const [role, setRole] = useState('patient');
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(accounts.patient);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function selectRole(nextRole) { setRole(nextRole); setMode('login'); setForm(accounts[nextRole]); setError(''); }
  async function submit(event) {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const result = mode === 'register' ? await api.register(form) : await api.login({ account: form.account, password: form.password, role });
      setAuthToken(result.token); onLogin(result);
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }

  return <div className="login-page">
    <section className="login-story">
      <div className="login-brand"><div className="brand-mark"><Activity size={23}/></div><div><strong>眩衡</strong><span>VertiBalance</span></div></div>
      <div className="story-content"><span className="story-eyebrow"><Brain size={16}/>眩晕专病智能辅助诊疗平台</span><h1>让每一次眩晕就医，<br/>都更清晰、更及时。</h1><p>连接患者、医生与医疗服务，以智能预问诊和危险信号筛查，构建诊前到诊后的医患协同闭环。</p><ul><li><Check size={16}/>眩晕专病引导式预问诊</li><li><Check size={16}/>高风险信号规则优先筛查</li><li><Check size={16}/>问诊资料安全移交医生</li></ul></div>
      <div className="story-security"><ShieldCheck size={18}/><span>医疗数据加密传输 · 角色权限隔离 · 关键访问留痕</span></div>
      <div className="login-orbit"><i/><i/><div><Activity size={42}/></div></div>
    </section>
    <section className="login-form-side"><div className="login-box"><div className="mobile-login-logo"><div className="brand-mark"><Activity size={21}/></div><strong>眩衡</strong></div><div className="login-heading"><h2>欢迎回来</h2><p>请选择身份并登录对应工作空间</p></div>
      <div className="login-role-tabs">{Object.entries(accounts).map(([key, item]) => { const Icon = item.icon; return <button key={key} className={role === key ? 'active' : ''} onClick={() => selectRole(key)}><Icon size={17}/><span>{item.label}端</span></button>; })}</div>
      <form onSubmit={submit}>{mode === 'register' && <div className="register-fields"><label>姓名<div className="login-input"><UserRound size={18}/><input value={form.name || ''} onChange={(event)=>setForm({...form,name:event.target.value})} placeholder="真实姓名"/></div></label><label>手机号<div className="login-input"><Activity size={18}/><input value={form.phone || ''} onChange={(event)=>setForm({...form,phone:event.target.value})} placeholder="用于账号验证"/></div></label></div>}<label>账号<div className="login-input"><UserRound size={18}/><input value={form.account} onChange={(event) => setForm({ ...form, account: event.target.value })} autoComplete="username" placeholder="手机号或邮箱"/></div></label><label>密码<div className="login-input"><LockKeyhole size={18}/><input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete={mode==='register'?'new-password':'current-password'} placeholder="至少 8 位，包含字母和数字"/><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
        {mode==='login'&&<div className="login-options"><label><input type="checkbox" defaultChecked/>保持登录</label><button type="button">忘记密码？</button></div>}{error && <div className="login-error">{error}</div>}<button className="login-submit" disabled={loading}>{loading ? '正在安全处理…' : mode==='register'?'创建患者账号':`进入${accounts[role].label}端`}<ArrowRight size={18}/></button></form>
      {role==='patient'&&<button className="register-toggle" onClick={()=>{setMode(mode==='login'?'register':'login');setForm(mode==='login'?{name:'',phone:'',account:'',password:''}:accounts.patient);setError('')}}>{mode==='login'?'还没有账号？注册患者端':'已有账号？返回登录'}</button>}
      <div className="demo-note"><ShieldCheck size={16}/><div><strong>演示账号已自动填充</strong><span>三种身份统一演示密码：Verti123!</span></div></div><p className="login-disclaimer">登录即表示你已阅读并同意隐私保护规则。平台仅用于辅助筛查和健康信息参考，不能替代医生诊断。</p></div></section>
  </div>;
}
