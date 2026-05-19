// Add Haptics type to window for TS
declare global {
  interface Window {
    Haptics?: {
      impact?: (opts: { style: 'light' | 'medium' | 'heavy' }) => void;
      selectionChanged?: () => void;
      notification?: (opts: { type: 'success' | 'warning' | 'error' }) => void;
    };
  }
}
import { Capacitor } from '@capacitor/core';

// Defensive haptics abstraction for both web and native
export class HapticService {
  static impactLight() {
    if (Capacitor.isNativePlatform() && window.Haptics?.impact) {
      window.Haptics.impact({ style: 'light' });
    }
  }

  static impactMedium() {
    if (Capacitor.isNativePlatform() && window.Haptics?.impact) {
      window.Haptics.impact({ style: 'medium' });
    }
  }

  static impactHeavy() {
    if (Capacitor.isNativePlatform() && window.Haptics?.impact) {
      window.Haptics.impact({ style: 'heavy' });
    }
  }

  static selection() {
    if (Capacitor.isNativePlatform() && window.Haptics?.selectionChanged) {
      window.Haptics.selectionChanged();
    }
  }

  static notification(type: 'success' | 'warning' | 'error') {
    if (Capacitor.isNativePlatform() && window.Haptics?.notification) {
      window.Haptics.notification({ type });
    }
  }
}
