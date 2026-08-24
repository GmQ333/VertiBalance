import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createApiApplication } from '../server/app.mjs';
import { SqliteStore } from '../server/store.mjs';

export async function createTestApi(name) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), `vertibalance-${name}-`));
  const store = await new SqliteStore(path.join(directory, 'database.sqlite')).init();
  const uploadDirectory = path.join(directory, 'uploads');
  const app = createApiApplication(store, { uploadDirectory });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;

  async function request(route, { token, method = 'GET', body } = {}) {
    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  }

  async function login(role) {
    const accounts = { patient: 'patient@demo.com', doctor: 'doctor@demo.com', admin: 'admin@demo.com' };
    const result = await request('/auth/login', { method: 'POST', body: { account: accounts[role], password: 'Verti123!', role } });
    if (!result.response.ok) throw new Error(`Unable to create ${role} test session: ${JSON.stringify(result.data)}`);
    return result.data;
  }

  async function close() {
    server.close();
    await once(server, 'close');
    store.close();
    await fs.rm(directory, { recursive: true, force: true });
  }

  return { baseUrl, close, directory, login, request, store, uploadDirectory };
}
