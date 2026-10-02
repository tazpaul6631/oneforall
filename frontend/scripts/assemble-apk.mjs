import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const javaExe = process.platform === 'win32' ? 'java.exe' : 'java';

function majorOf(javaHome) {
  const exe = join(javaHome, 'bin', javaExe);
  if (!existsSync(exe)) return 0;
  const result = spawnSync(exe, ['-version'], { encoding: 'utf8' });
  const text = `${result.stderr ?? ''}${result.stdout ?? ''}`;
  const match = text.match(/version "(?:1\.)?(\d+)/);
  return match ? Number(match[1]) : 0;
}

function jdkHomes() {
  const homes = [];
  if (process.env.JAVA_HOME) homes.push(process.env.JAVA_HOME);
  if (process.platform !== 'win32') return homes;
  const roots = [
    'C:\\Program Files\\Java',
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Microsoft',
    'C:\\Program Files\\Android\\Android Studio\\jbr',
  ];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    if (existsSync(join(root, 'bin', javaExe))) homes.push(root);
    else {
      for (const name of readdirSync(root)) homes.push(join(root, name));
    }
  }
  return homes;
}

const home = jdkHomes()
  .map((dir) => ({ dir, major: majorOf(dir) }))
  .filter((item) => item.major >= 21)
  .sort((a, b) => b.major - a.major)[0]?.dir;

if (!home) {
  console.error('Cần JDK 21 trở lên. Java trên PATH hiện không biên dịch được source release 21.');
  process.exit(1);
}

const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const result = spawnSync(gradle, ['assembleDebug'], {
  cwd: join(import.meta.dirname, '..', 'android'),
  env: { ...process.env, JAVA_HOME: home },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
