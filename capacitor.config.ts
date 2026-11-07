import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.flicks.hub',
  appName: 'Flicks',
  webDir: 'dist',
  server: {
    // Ensures local bundled assets are served from dist via https://localhost
    androidScheme: 'https',
    hostname: 'localhost',
    cleartext: true,
    // Allow all in-app navigation routes & external API hosts directly inside native WebView
    allowNavigation: ['*'],
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    backgroundColor: '#0F172A',
  },
  plugins: {
    SocialLogin: {
      providers: {
        google: {
          webClientId: '82961323095-8haq8nrdre1l518p4k8pdlhl6boo21ed.apps.googleusercontent.com',
          mode: 'online',
        },
        apple: false,
        facebook: false,
        twitter: false,
      },
    },
  },
};

export default config;
