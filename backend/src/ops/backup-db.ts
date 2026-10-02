import * as fs from 'fs';
import * as path from 'path';

type Sqlite = { backup: (dest: string) => Promise<void>; close: () => void };
const BetterSqlite = require('better-sqlite3') as new (
  filename: string,
  options?: { readonly?: boolean; fileMustExist?: boolean },
) => Sqlite;

/** Sao chép nhất quán, gồm dữ liệu đang nằm trong WAL. */
export async function backupDatabase(sourcePath: string, destPath: string) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const db = new BetterSqlite(sourcePath, { readonly: true, fileMustExist: true });
  try {
    await db.backup(destPath);
  } finally {
    db.close();
  }
}

/** Ghi đè file đang chạy. API phải tắt trước. Xóa WAL cũ để không trộn dữ liệu. */
export function restoreDatabase(backupPath: string, destPath: string) {
  if (!fs.existsSync(backupPath)) throw new Error(`Không thấy bản sao ${backupPath}`);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(backupPath, destPath);
  for (const suffix of ['-wal', '-shm']) {
    const side = destPath + suffix;
    if (fs.existsSync(side)) fs.unlinkSync(side);
  }
}

export function pruneBackups(dir: string, keep: number) {
  if (!fs.existsSync(dir)) return;
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.db'))
    .map((name) => ({ name, mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const old of files.slice(keep)) fs.unlinkSync(path.join(dir, old.name));
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function main() {
  const source = path.resolve(process.argv[2] || process.env.DB_PATH || 'data/app.db');
  const dir = path.resolve(process.argv[3] || process.env.BACKUP_DIR || 'data/backups');
  const dest = path.join(dir, `app-${stamp()}.db`);
  await backupDatabase(source, dest);
  pruneBackups(dir, Number(process.env.BACKUP_KEEP || 14));
  console.log(dest);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
