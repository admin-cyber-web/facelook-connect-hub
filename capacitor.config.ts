import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.flicks.hub',
  appName: 'Flicks',
  webDir: 'dist',
  server: {
    // Required for Capacitor 8 on Android: ensures localStorage, cookies,
    // and HTTPS-gated APIs work correctly in the native WebView.
    androidScheme: 'https',
  },
};

export default config;
