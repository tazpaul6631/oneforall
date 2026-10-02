import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { jwtSecret } from '../src/core/auth/jwt';
import { backupDatabase, pruneBackups, restoreDatabase } from '../src/ops/backup-db';
import { corsOrigin } from '../src/setup-app';
import { assertSeedAllowed } from '../src/seed-guard';

const Database = require('better-sqlite3');

describe('production', () => {
  it('CORS production chỉ mở khi khai báo domain', () => {
    expect(corsOrigin({ NODE_ENV: 'production' })).toBe(false);
    expect(corsOrigin({ NODE_ENV: 'development' })).toBe(true);
    expect(corsOrigin({ CORS_ORIGIN: 'https://quan.vn, https://www.quan.vn' })).toEqual([
      'https://quan.vn',
      'https://www.quan.vn',
      'https://localhost',
      'capacitor://localhost',
    ]);
  });

  it('production từ chối JWT_SECRET mẫu hoặc quá ngắn', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'doi-chuoi-nay-truoc-khi-len-production';
    expect(() => jwtSecret()).toThrow(/JWT_SECRET/);
    process.env.JWT_SECRET = 'ngan';
    expect(() => jwtSecret()).toThrow(/JWT_SECRET/);
    process.env.JWT_SECRET = 'x'.repeat(48);
    expect(jwtSecret()).toHaveLength(48);
    if (prevEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevEnv;
    if (prevSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevSecret;
  });

  it('không seed demo khi production', () => {
    expect(() => assertSeedAllowed({ NODE_ENV: 'production' })).toThrow(/demo/);
    expect(() => assertSeedAllowed({ NODE_ENV: 'production', SEED_DEMO: '1' })).not.toThrow();
    expect(() => assertSeedAllowed({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('backup rồi restore đúng dữ liệu, kể cả khi có WAL', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'onestore-bak-'));
    const live = path.join(dir, 'app.db');
    const db = new Database(live);
    db.pragma('journal_mode = WAL');
    db.exec('CREATE TABLE shops (name TEXT)');
    db.prepare('INSERT INTO shops (name) VALUES (?)').run('quán thử');
    db.close();

    const copy = path.join(dir, 'backups', 'app.db');
    await backupDatabase(live, copy);

    const changed = new Database(live);
    changed.prepare('UPDATE shops SET name = ?').run('đã hỏng');
    changed.close();

    restoreDatabase(copy, live);
    const restored = new Database(live, { readonly: true });
    expect(restored.prepare('SELECT name FROM shops').get()).toEqual({ name: 'quán thử' });
    restored.close();

    const older = path.join(dir, 'backups', 'a.db');
    const newer = path.join(dir, 'backups', 'b.db');
    await backupDatabase(live, older);
    await backupDatabase(live, newer);
    const backups = path.join(dir, 'backups');
    fs.utimesSync(copy, new Date(500), new Date(500));
    fs.utimesSync(older, new Date(1_000), new Date(1_000));
    fs.utimesSync(newer, new Date(2_000), new Date(2_000));
    pruneBackups(backups, 1);
    const left = fs.readdirSync(path.join(dir, 'backups')).filter((n) => n.endsWith('.db'));
    expect(left).toEqual(['b.db']);
  });
});
