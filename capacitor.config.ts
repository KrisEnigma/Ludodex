import type { CapacitorConfig } from '@capacitor/cli';

interface ExtendedCapacitorConfig extends CapacitorConfig {
  // Allow passing explicit plugin package class names for iOS
  packageClassList?: string[];
}

const config: ExtendedCapacitorConfig = {
  appId: 'app.ludodex.game',
  appName: 'Ludodex',
  webDir: 'dist',
  ios: {
    contentInset: 'always'
  },
  android: {},

  packageClassList: [
    'AdMobPlugin',
    'AppPlugin',
    'HapticsPlugin',
    'LocalNotificationsPlugin',
    'PreferencesPlugin',
    'SharePlugin',
    'SplashScreenPlugin',
    'StatusBarPlugin',
    'PurchasesPlugin',
    'SentryCapacitor',
    'AlternateIconPlugin'
  ],

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
