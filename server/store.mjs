import fs from 'node:fs/promises';
import path from 'node:path';
import { createSeedData } from './seed.mjs';

const clone = (value) => structuredClone(value);

export class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = null;
    this.queue = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      this.data = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.data = createSeedData();
      await this.persist();
    }
    let migrated = false;
    for (const collection of ['notifications', 'uploads', 'feedback']) {
      if (!Array.isArray(this.data[collection])) { this.data[collection] = []; migrated = true; }
    }
    if (!Array.isArray(this.data.riskRules)) { this.data.riskRules = createSeedData().riskRules; migrated = true; }
    if ((this.data.meta.schemaVersion || 1) < 3) { this.data.meta.schemaVersion = 3; migrated = true; }
    if (migrated) await this.persist();
    return this;
  }

  snapshot() {
    if (!this.data) throw new Error('Store has not been initialized');
    return clone(this.data);
  }

  async transaction(mutator) {
    const operation = this.queue.then(async () => {
      const draft = clone(this.data);
      const result = await mutator(draft);
      this.data = draft;
      await this.persist();
      return clone(result);
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  async persist() {
    const temporaryPath = `${this.filePath}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(this.data, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temporaryPath, this.filePath);
  }
}
