import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const coveredRoutes = new Set([
  'GET /health', 'POST /auth/register', 'POST /auth/login', 'GET /auth/me',
  'GET /notifications', 'PATCH /notifications/:id/read', 'POST /feedback', 'GET /patient/dashboard',
  'POST /consultations', 'GET /consultations', 'GET /consultations/:id', 'POST /consultations/:id/messages',
  'POST /consultations/:id/complete', 'GET /reports', 'GET /schedules', 'GET /departments',
  'POST /bookings', 'GET /bookings', 'PATCH /bookings/:id/cancel', 'GET /followups',
  'POST /followups/:id/feedback', 'GET /knowledge', 'GET /uploads', 'POST /uploads',
  'GET /uploads/:id/download', 'GET /doctor/workbench', 'GET /doctor/patients', 'GET /doctor/patients/:id',
  'POST /doctor/patients/:id/ai-analysis', 'POST /doctor/patients/:id/ai-question', 'POST /doctor/dispositions', 'POST /doctor/followups',
  'GET /admin/dashboard', 'GET /admin/users', 'POST /admin/users', 'PATCH /admin/users/:id/status',
  'POST /admin/schedules', 'PATCH /admin/schedules/:id', 'POST /admin/knowledge',
  'PATCH /admin/knowledge/:id', 'GET /admin/risk-rules', 'POST /admin/risk-rules',
  'PATCH /admin/risk-rules/:id', 'GET /admin/models', 'POST /admin/models',
  'PATCH /admin/models/:id/activate', 'GET /admin/audits',
]);

test('every declared API route is represented in the integration-test inventory', async () => {
  const source = await fs.readFile(new URL('../server/api.mjs', import.meta.url), 'utf8');
  const declared = new Set([...source.matchAll(/router\.(get|post|patch|put|delete)\('([^']+)'/g)].map(([, method, route]) => `${method.toUpperCase()} ${route}`));
  assert.deepEqual([...declared].sort(), [...coveredRoutes].sort());
});
