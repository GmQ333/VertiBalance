const API_BASE = '/api/v1';
let token = localStorage.getItem('vertibalance_token') || '';

export function setAuthToken(nextToken) {
  token = nextToken || '';
  if (token) localStorage.setItem('vertibalance_token', token);
  else localStorage.removeItem('vertibalance_token');
}

export function getAuthToken() { return token; }

export async function apiRequest(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = { ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}), ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers, body: options.body && typeof options.body !== 'string' && !isFormData ? JSON.stringify(options.body) : options.body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || '请求失败，请稍后重试');
    error.code = data.error; error.status = response.status;
    if (response.status === 401) window.dispatchEvent(new CustomEvent('auth-expired'));
    throw error;
  }
  return data;
}

export const api = {
  health: () => apiRequest('/health'),
  login: (body) => apiRequest('/auth/login', { method: 'POST', body }),
  register: (body) => apiRequest('/auth/register', { method: 'POST', body }),
  me: () => apiRequest('/auth/me'),
  notifications: () => apiRequest('/notifications'),
  readNotification: (id) => apiRequest(`/notifications/${id}/read`, { method: 'PATCH', body: {} }),
  feedback: (body) => apiRequest('/feedback', { method: 'POST', body }),
  patientDashboard: () => apiRequest('/patient/dashboard'),
  startConsultation: () => apiRequest('/consultations', { method: 'POST', body: {} }),
  consultations: () => apiRequest('/consultations'),
  consultation: (id) => apiRequest(`/consultations/${id}`),
  sendConsultationMessage: (id, content) => apiRequest(`/consultations/${id}/messages`, { method: 'POST', body: { content } }),
  completeConsultation: (id) => apiRequest(`/consultations/${id}/complete`, { method: 'POST', body: {} }),
  reports: () => apiRequest('/reports'),
  schedules: () => apiRequest('/schedules'),
  bookings: () => apiRequest('/bookings'),
  createBooking: (consultationId, scheduleId) => apiRequest('/bookings', { method: 'POST', body: { consultationId, scheduleId } }),
  cancelBooking: (id) => apiRequest(`/bookings/${id}/cancel`, { method: 'PATCH', body: {} }),
  followups: () => apiRequest('/followups'),
  submitFollowup: (id, body) => apiRequest(`/followups/${id}/feedback`, { method: 'POST', body }),
  knowledge: () => apiRequest('/knowledge'),
  uploads: () => apiRequest('/uploads'),
  upload: (formData) => apiRequest('/uploads', { method: 'POST', body: formData }),
  doctorWorkbench: () => apiRequest('/doctor/workbench'),
  doctorSchedules: (doctorId) => apiRequest(`/schedules?doctorId=${encodeURIComponent(doctorId)}`),
  doctorPatient: (id) => apiRequest(`/doctor/patients/${id}`),
  doctorAnalysis: (id) => apiRequest(`/doctor/patients/${id}/ai-analysis`, { method: 'POST', body: {} }),
  createDisposition: (body) => apiRequest('/doctor/dispositions', { method: 'POST', body }),
  createFollowup: (body) => apiRequest('/doctor/followups', { method: 'POST', body }),
  adminDashboard: () => apiRequest('/admin/dashboard'),
  adminUsers: () => apiRequest('/admin/users'),
  createAdminUser: (body) => apiRequest('/admin/users', { method: 'POST', body }),
  updateUserStatus: (id, status) => apiRequest(`/admin/users/${id}/status`, { method: 'PATCH', body: { status } }),
  adminSchedules: () => apiRequest('/schedules'),
  departments: () => apiRequest('/departments'),
  createSchedule: (body) => apiRequest('/admin/schedules', { method: 'POST', body }),
  updateSchedule: (id, body) => apiRequest(`/admin/schedules/${id}`, { method: 'PATCH', body }),
  adminKnowledge: () => apiRequest('/knowledge'),
  createKnowledge: (body) => apiRequest('/admin/knowledge', { method: 'POST', body }),
  updateKnowledge: (id, body) => apiRequest(`/admin/knowledge/${id}`, { method: 'PATCH', body }),
  riskRules: () => apiRequest('/admin/risk-rules'),
  createRiskRule: (body) => apiRequest('/admin/risk-rules', { method: 'POST', body }),
  updateRiskRule: (id, body) => apiRequest(`/admin/risk-rules/${id}`, { method: 'PATCH', body }),
  adminModels: () => apiRequest('/admin/models'),
  createModel: (body) => apiRequest('/admin/models', { method: 'POST', body }),
  activateModel: (id) => apiRequest(`/admin/models/${id}/activate`, { method: 'PATCH', body: {} }),
  adminAudits: () => apiRequest('/admin/audits'),
};
