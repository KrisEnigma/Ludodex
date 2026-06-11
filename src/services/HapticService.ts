import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Duration (ms) for the confetti/pristine-win celebration buzz.
// Android: maps to VibrationEffect.createOneShot(duration) — a sustained rumble.
// iOS: Haptics.vibrate() ignores duration and always fires one standard pulse.
// NOTE: Do NOT chain a second vibrate/impact call after this — starting a new
//       vibration on Android cancels the in-progress one, producing two short
//       buzzes instead of one long rumble.
const CELEBRATE_DURATION_MS = 600;

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

  /**
   * Sustained celebration buzz — used in sync with confetti on a pristine win.
   *
   * Android: `vibrate({ duration })` maps to `VibrationEffect.createOneShot`,
   * giving a solid CELEBRATE_DURATION_MS rumble.
   *
   * iOS: `vibrate()` ignores duration and fires a single standard pulse, so we
   * chain a second heavy impact ~100 ms later to give it more physical weight
   * without relying on the unsupported duration parameter.
   */
  static celebrate(): void {
    if (!Capacitor.isNativePlatform()) return;
    void Haptics.vibrate({ duration: CELEBRATE_DURATION_MS }).catch(() => {});
  }
}
