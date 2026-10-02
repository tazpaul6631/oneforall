import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'vn.onestore.app',
  appName: 'OneStore',
  webDir: 'dist',
  android: { allowMixedContent: true },
  server: { cleartext: true },
};

export default config;
