export const patients = [
  { id: 'VB-24082301', name: '林晓雯', age: 56, gender: '女', risk: '高', status: '待接诊', symptom: '突发旋转感，伴行走不稳', time: '10 分钟前', avatar: '林', tone: 'rose' },
  { id: 'VB-24082302', name: '周建国', age: 68, gender: '男', risk: '中', status: '已挂号', symptom: '晨起翻身诱发短暂眩晕', time: '32 分钟前', avatar: '周', tone: 'blue' },
  { id: 'VB-24082218', name: '陈雨桐', age: 31, gender: '女', risk: '中', status: '待接诊', symptom: '头昏伴恶心，持续约 2 小时', time: '1 小时前', avatar: '陈', tone: 'violet' },
  { id: 'VB-24082109', name: '王海峰', age: 45, gender: '男', risk: '低', status: '随访中', symptom: '耳石症复位后第 7 天随访', time: '昨天', avatar: '王', tone: 'green' },
  { id: 'VB-24082027', name: '赵敏', age: 39, gender: '女', risk: '低', status: '已完成', symptom: '前庭性偏头痛复诊咨询', time: '2 天前', avatar: '赵', tone: 'amber' },
];

export const auditRows = [
  { time: '今天 14:26', actor: '张医生', action: '查看患者资料', object: 'VB-24082301', status: '正常' },
  { time: '今天 14:18', actor: '系统', action: '模型调用', object: '问诊摘要生成', status: '成功' },
  { time: '今天 13:52', actor: '管理员 陈琳', action: '更新号源', object: '神经内科 · 周一上午', status: '正常' },
  { time: '今天 11:09', actor: '未知账号', action: '权限异常', object: '审计日志访问', status: '已拦截' },
];

export const followups = [
  { title: '症状恢复随访', date: '8 月 26 日', type: '问卷', status: '待完成' },
  { title: '前庭康复训练', date: '每天 20:00', type: '提醒', status: '进行中' },
  { title: '专科复诊', date: '9 月 06 日', type: '复诊', status: '已安排' },
];
