import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export class HapticService {
  static impactLight(): void {
    if (!Capacitor.isNativePlatform()) return;
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  }

  static impactMedium(): void {
    if (!Capacitor.isNativePlatform()) return;
    void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
  }

  static impactHeavy(): void {
    if (!Capacitor.isNativePlatform()) return;
    void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
  }

  static selection(): void {
    if (!Capacitor.isNativePlatform()) return;
    void Haptics.selectionChanged().catch(() => {});
  }

  static notification(type: 'success' | 'warning' | 'error'): void {
    if (!Capacitor.isNativePlatform()) return;
    const ntype =
      type === 'success'
        ? NotificationType.Success
        : type === 'warning'
          ? NotificationType.Warning
          : NotificationType.Error;
    void Haptics.notification({ type: ntype }).catch(() => {});
  }
}
