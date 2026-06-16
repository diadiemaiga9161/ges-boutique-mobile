import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ges.lafia',
  appName: 'Ges Lafia',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    cleartext: false
  }
};

export default config;
