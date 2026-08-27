import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const runtimeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vertibalance-e2e-'));

process.env.NODE_ENV = 'development';
process.env.PORT = process.env.E2E_PORT || '4180';
process.env.AUTH_SECRET = 'vertibalance-e2e-auth-secret-at-least-32-characters';
process.env.DATABASE_PATH = path.join(runtimeDirectory, 'vertibalance.sqlite');
process.env.UPLOAD_DIRECTORY = path.join(runtimeDirectory, 'uploads');
delete process.env.MEDCHAT_API_KEY;

process.on('exit', () => fs.rmSync(runtimeDirectory, { recursive: true, force: true }));

await import('../server.mjs');
