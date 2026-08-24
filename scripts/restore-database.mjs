import { restoreDatabaseBackup } from '../server/backup.mjs';

if (!process.env.RESTORE_FROM || !process.env.RESTORE_DATABASE_PATH || !process.env.RESTORE_UPLOAD_DIRECTORY) {
  throw new Error('恢复操作必须设置 RESTORE_FROM、RESTORE_DATABASE_PATH 和 RESTORE_UPLOAD_DIRECTORY；目标必须不存在。');
}

const result = await restoreDatabaseBackup({
  backupDirectory: process.env.RESTORE_FROM,
  targetDatabasePath: process.env.RESTORE_DATABASE_PATH,
  targetUploadDirectory: process.env.RESTORE_UPLOAD_DIRECTORY,
});
console.log(JSON.stringify({ status: 'ok', databasePath: result.databasePath, uploadDirectory: result.uploadDirectory, migrations: result.manifest.migrations.map((item) => item.version) }, null, 2));
