import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '../src');

function tsFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tsFiles(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : [],
  );
}

function importsOf(file: string): string[] {
  const src = fs.readFileSync(file, 'utf8');
  return [...src.matchAll(/from\s+'(\.[^']*)'/g)].map((m) => path.resolve(path.dirname(file), m[1]));
}

/** Quy tắc phụ thuộc: platform ← core ← verticals (mũi tên = "được phép import"). */
describe('Ranh giới kiến trúc', () => {
  const rule = (from: string, forbidden: (target: string, file: string) => boolean, msg: string) =>
    it(msg, () => {
      const bad: string[] = [];
      for (const f of tsFiles(path.join(SRC, from))) {
        for (const t of importsOf(f)) if (forbidden(t, f)) bad.push(`${path.relative(SRC, f)} → ${path.relative(SRC, t)}`);
      }
      expect(bad).toEqual([]);
    });
  const inside = (t: string, d: string) => t.startsWith(path.join(SRC, d));

  rule('platform', (t) => inside(t, 'core') || inside(t, 'verticals'), 'platform không import core/verticals');
  rule('core', (t) => inside(t, 'verticals'), 'core không import verticals');
  rule('verticals', (t, f) => {
    const own = path.relative(path.join(SRC, 'verticals'), f).split(path.sep)[0];
    return inside(t, 'verticals') && !inside(t, `verticals/${own}`);
  }, 'vertical không import vertical khác');
});
