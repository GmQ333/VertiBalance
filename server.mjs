import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createApiApplication } from './server/app.mjs';
import { SqliteStore } from './server/store.mjs';
import { configureRuntimeModel } from './server/model-service.mjs';
import { createId } from './server/security.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
if (process.env.NODE_ENV === 'production' && !process.env.AUTH_SECRET) throw new Error('AUTH_SECRET is required in production');

const databasePath = process.env.DATABASE_PATH || path.join(root, 'data', 'vertibalance.sqlite');
const store = await new SqliteStore(databasePath, { legacyFilePath: path.join(root, 'data', 'vertibalance.json') }).init();
configureRuntimeModel(store.snapshot(['modelConfigs']).modelConfigs.find((item) => item.status === 'active'));
const uploadDirectory = process.env.UPLOAD_DIRECTORY || path.join(root, 'data', 'uploads');
await fs.mkdir(uploadDirectory, { recursive: true, mode: 0o700 });
await fs.chmod(uploadDirectory, 0o700);
const app = createApiApplication(store, { uploadDirectory });

async function dispatchDueReminders() {
  const current = Date.now(); const within24Hours = current + 24 * 3600000;
  await store.transaction(['followups', 'bookings', 'notifications'], (data) => {
    for (const task of data.followups.filter((item) => item.status === 'pending' && new Date(item.dueAt).getTime() <= within24Hours)) {
      if (!data.notifications.some((item) => item.userId === task.patientId && item.type === 'followup_due' && item.objectId === task.id)) data.notifications.push({ id: createId('ntf'), userId: task.patientId, type: 'followup_due', title: '随访任务即将到期', content: `“${task.title}”将在 24 小时内到期，请及时完成。`, objectId: task.id, read: false, createdAt: new Date().toISOString() });
    }
    for (const booking of data.bookings.filter((item) => item.status === 'confirmed' && new Date(item.appointmentAt).getTime() >= current && new Date(item.appointmentAt).getTime() <= within24Hours)) {
      if (!data.notifications.some((item) => item.userId === booking.patientId && item.type === 'booking_due' && item.objectId === booking.id)) data.notifications.push({ id: createId('ntf'), userId: booking.patientId, type: 'booking_due', title: '就诊提醒', content: `你预约的${booking.department}将在 24 小时内开始，请提前准备。`, objectId: booking.id, read: false, createdAt: new Date().toISOString() });
    }
  });
}
await dispatchDueReminders();
setInterval(() => dispatchDueReminders().catch((error) => console.error('Reminder dispatch failed:', error)), 60000).unref();

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(root, 'dist')));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.listen(port, '0.0.0.0', () => {
  console.log(`VertiBalance is running at http://localhost:${port}`);
});
