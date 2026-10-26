import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.flicks.hub',
  appName: 'Flicks',
  webDir: 'dist',
  server: {
    // Ensures local bundled assets are served from dist via https://localhost
    androidScheme: 'https',
    hostname: 'localhost',
    // Allow all in-app navigation routes & external API hosts directly inside native WebView
    allowNavigation: ['*'],
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#0F172A',
      style: 'DARK',
    },
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    backgroundColor: '#0F172A',
  },
};

export default config;
