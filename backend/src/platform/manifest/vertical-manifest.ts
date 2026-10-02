export interface MenuItem {
  label: string;
  route: string;
  icon: string; // tên icon PrimeIcons
  feature: string;
}

export interface PresetDef {
  label: string;
  description: string;
  color: string; // tên bảng màu PrimeVue: teal, orange, indigo...
  features: string[];
}

/** Mỗi vertical (và core) tự khai báo mình có gì qua manifest này. */
export interface VerticalManifest {
  key: string;
  alwaysOn?: string[]; // feature luôn bật cho mọi tenant (chỉ core dùng)
  features: string[];
  menu: MenuItem[];
  presets?: Record<string, PresetDef>;
}
