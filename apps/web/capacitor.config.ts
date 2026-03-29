import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.siliba.app',
  appName: 'Siliba',
  webDir: 'out',
  server: {
    // En desarrollo: apuntar al servidor Next.js local
    // 10.0.2.2 es la IP especial del emulador Android para acceder a localhost del host
    url: 'http://192.168.3.33:3000/marketplace',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#008080',
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#008080',
      showSpinner: false,
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
