import { Injectable } from '@nestjs/common';
import { MenuItem, VerticalManifest } from './vertical-manifest';

@Injectable()
export class ManifestRegistry {
  private readonly manifests = new Map<string, VerticalManifest>();

  register(m: VerticalManifest) {
    this.manifests.set(m.key, m);
  }

  private ordered(): VerticalManifest[] {
    return [...this.manifests.values()].sort((a, b) =>
      a.key === 'core' ? -1 : b.key === 'core' ? 1 : a.key.localeCompare(b.key),
    );
  }

  presets() {
    return this.ordered().flatMap((m) =>
      Object.entries(m.presets ?? {}).map(([key, p]) => ({
        key,
        label: p.label,
        description: p.description,
        color: p.color,
      })),
    );
  }

  presetLabel(key: string): string {
    return this.presets().find((p) => p.key === key)?.label ?? key;
  }

  alwaysOn(): string[] {
    return this.ordered().flatMap((m) => m.alwaysOn ?? []);
  }

  /** Feature của preset = feature luôn bật của core + feature riêng của preset. */
  resolvePreset(key: string): { color: string; features: string[] } | null {
    const all = this.ordered();
    const def = all.map((m) => m.presets?.[key]).find(Boolean);
    if (!def) return null;
    const base = all.flatMap((m) => m.alwaysOn ?? []);
    return { color: def.color, features: [...new Set([...base, ...def.features])] };
  }

  menuFor(features: Iterable<string>): MenuItem[] {
    const set = new Set(features);
    return this.ordered().flatMap((m) => m.menu.filter((i) => set.has(i.feature)));
  }
}
