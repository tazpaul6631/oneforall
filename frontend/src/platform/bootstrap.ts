import { updatePrimaryPalette } from '@primeuix/themes';
import type { Router, RouteRecordRaw } from 'vue-router';
import { useSession } from '@/stores/session';

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

export function applyTheme(color: string) {
  updatePrimaryPalette(Object.fromEntries(SHADES.map((s) => [s, `{${color}.${s}}`])));
}

// Mỗi thư mục verticals/<key>/routes.ts chỉ được tải khi tenant có feature bắt đầu bằng "<key>."
const loaders = import.meta.glob('../verticals/*/routes.ts');
const registered = new Set<string>();

export async function registerVerticalRoutes(router: Router, features: string[]) {
  for (const [file, load] of Object.entries(loaders)) {
    const key = file.split('/')[2];
    if (registered.has(key) || !features.some((f) => f.startsWith(`${key}.`))) continue;
    const mod = (await load()) as { default: RouteRecordRaw[] };
    mod.default.forEach((r) => router.addRoute('shell', r));
    registered.add(key);
  }
}

/** Gọi sau khi có bootstrap (đăng nhập xong hoặc tải lại trang). */
export async function activateSession(router: Router) {
  const s = useSession();
  if (!s.boot) return;
  applyTheme(s.boot.theme.primary);
  await registerVerticalRoutes(router, s.boot.features);
}
