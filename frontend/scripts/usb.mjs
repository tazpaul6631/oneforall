import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function sdkDir() {
  const fromEnv = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (fromEnv) return fromEnv;
  const local = join(import.meta.dirname, '..', 'android', 'local.properties');
  if (existsSync(local)) {
    const match = readFileSync(local, 'utf8').match(/^sdk\.dir=(.*)$/m);
    if (match) return match[1].trim().replace(/\\(.)/g, '$1');
  }
  if (process.env.LOCALAPPDATA) return join(process.env.LOCALAPPDATA, 'Android', 'Sdk');
  return '';
}

const adbName = process.platform === 'win32' ? 'adb.exe' : 'adb';
const adb = join(sdkDir(), 'platform-tools', adbName);
if (!existsSync(adb)) {
  console.error('Không thấy adb. Hãy cài Android SDK platform-tools.');
  process.exit(1);
}

const listed = spawnSync(adb, ['devices'], { encoding: 'utf8' });
const serials = (listed.stdout ?? '')
  .split(/\r?\n/)
  .slice(1)
  .map((line) => line.trim())
  .filter((line) => line.endsWith('device'))
  .map((line) => line.split(/\s+/)[0]);

if (!serials.length) {
  console.error('Không có máy Android nào đang cắm. Bật gỡ lỗi USB và chấp nhận hộp thoại trên máy.');
  process.exit(1);
}

let failed = 0;
for (const serial of serials) {
  const result = spawnSync(adb, ['-s', serial, 'reverse', 'tcp:3000', 'tcp:3000'], { encoding: 'utf8' });
  if (result.status === 0) console.log(`Đã chuyển cổng 3000 cho ${serial}`);
  else {
    failed += 1;
    console.error(`Không chuyển được cổng cho ${serial}`);
  }
}

process.exit(failed ? 1 : 0);
