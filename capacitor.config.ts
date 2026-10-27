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
  android: {
    allowMixedContent: true,
    captureInput: true,
    backgroundColor: '#0F172A',
  },
  plugins: {
    SocialLogin: {
      providers: {
        google: true,
        apple: false,
        facebook: false,
        twitter: false,
      },
    },
  },
};

export default config;
