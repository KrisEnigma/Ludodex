import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.ludodex.game',
  appName: 'Ludodex',
  webDir: 'dist',
  ios: {
    contentInset: 'always'
  },
  android: {
    allowMixedContent: false
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#00D4E8'
    },
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#07090e',
      showSpinner: false
    }
  }
};

export default config;
