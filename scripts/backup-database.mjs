import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabaseBackup, verifyDatabaseBackup } from '../server/backup.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const result = await createDatabaseBackup({
  databasePath: process.env.DATABASE_PATH || path.join(root, 'data', 'vertibalance.sqlite'),
  uploadDirectory: process.env.UPLOAD_DIRECTORY || path.join(root, 'data', 'uploads'),
  backupRoot: process.env.BACKUP_ROOT || path.join(root, 'backups'),
});
await verifyDatabaseBackup(result.directory);
console.log(JSON.stringify({ status: 'ok', backupDirectory: result.directory, files: Object.keys(result.manifest.checksums).length, migrations: result.manifest.migrations.map((item) => item.version) }, null, 2));
