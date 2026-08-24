import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const sqlLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`;

async function hashFile(filePath) {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function listFiles(directory, prefix = '') {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile() && entry.name !== 'manifest.json') files.push(relative);
  }
  return files.sort();
}

export async function createDatabaseBackup({ databasePath, uploadDirectory, backupRoot }) {
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const root = path.resolve(backupRoot);
  const targetDirectory = path.join(root, `vertibalance-${stamp}`);
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  await fs.mkdir(targetDirectory, { recursive: false, mode: 0o700 });
  const targetDatabase = path.join(targetDirectory, 'vertibalance.sqlite');
  const database = new DatabaseSync(path.resolve(databasePath));
  try {
    const integrity = database.prepare('PRAGMA integrity_check').get().integrity_check;
    if (integrity !== 'ok') throw new Error(`Source database integrity check failed: ${integrity}`);
    database.exec(`VACUUM INTO ${sqlLiteral(targetDatabase)};`);
  } finally { database.close(); }
  await fs.chmod(targetDatabase, 0o600);

  const sourceUploads = path.resolve(uploadDirectory);
  const targetUploads = path.join(targetDirectory, 'uploads');
  try { await fs.access(sourceUploads); await fs.cp(sourceUploads, targetUploads, { recursive: true, force: false, errorOnExist: true }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }

  const files = await listFiles(targetDirectory);
  const checksums = Object.fromEntries(await Promise.all(files.map(async (relative) => [relative, await hashFile(path.join(targetDirectory, relative))])));
  const backupDatabase = new DatabaseSync(targetDatabase, { readOnly: true });
  let migrations;
  try { migrations = backupDatabase.prepare('SELECT version, applied_at FROM schema_migrations ORDER BY version').all(); }
  finally { backupDatabase.close(); }
  const manifest = { format: 'vertibalance-sqlite-backup-v1', createdAt: new Date().toISOString(), database: 'vertibalance.sqlite', migrations, checksums };
  await fs.writeFile(path.join(targetDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return { directory: targetDirectory, manifest };
}

export async function verifyDatabaseBackup(backupDirectory) {
  const directory = path.resolve(backupDirectory);
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
  if (manifest.format !== 'vertibalance-sqlite-backup-v1') throw new Error('Unsupported backup format');
  for (const [relative, expected] of Object.entries(manifest.checksums)) {
    const actual = await hashFile(path.join(directory, relative));
    if (actual !== expected) throw new Error(`Backup checksum mismatch: ${relative}`);
  }
  const database = new DatabaseSync(path.join(directory, manifest.database), { readOnly: true });
  try {
    const integrity = database.prepare('PRAGMA integrity_check').get().integrity_check;
    if (integrity !== 'ok') throw new Error(`Backup database integrity check failed: ${integrity}`);
  } finally { database.close(); }
  return { valid: true, manifest };
}

export async function restoreDatabaseBackup({ backupDirectory, targetDatabasePath, targetUploadDirectory }) {
  const verified = await verifyDatabaseBackup(backupDirectory);
  const sourceDirectory = path.resolve(backupDirectory);
  const databaseTarget = path.resolve(targetDatabasePath);
  const uploadTarget = path.resolve(targetUploadDirectory);
  for (const target of [databaseTarget, uploadTarget]) {
    try { await fs.access(target); const error = new Error(`Restore target already exists: ${target}`); error.code = 'EEXIST'; throw error; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await fs.mkdir(path.dirname(databaseTarget), { recursive: true, mode: 0o700 });
  await fs.chmod(path.dirname(databaseTarget), 0o700);
  await fs.copyFile(path.join(sourceDirectory, verified.manifest.database), databaseTarget, fsConstants.COPYFILE_EXCL);
  await fs.chmod(databaseTarget, 0o600);
  const sourceUploads = path.join(sourceDirectory, 'uploads');
  try {
    await fs.access(sourceUploads);
    await fs.cp(sourceUploads, uploadTarget, { recursive: true, force: false, errorOnExist: true });
    await fs.chmod(uploadTarget, 0o700);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return { databasePath: databaseTarget, uploadDirectory: uploadTarget, manifest: verified.manifest };
}
