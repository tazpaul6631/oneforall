/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
  }
}
import 'vue-router';

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean;
    feature?: string; // feature backend phải bật mới vào được
    title?: string;
    stage?: string; // dùng cho màn hình chưa làm
  }
}
