import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { t } from '../i18n';

/**
 * Daily reminder notifications (native only).
 *
 * Opt-in model: nothing is scheduled and no OS permission is requested until the
 * player explicitly turns it on (Settings toggle / future soft-prompt). This
 * keeps the one-shot iOS permission prompt for a high-intent moment instead of
 * burning it on first launch.
 *
 * v1 ships a single repeating local notification at 09:00 with evergreen,
 * number-less streak-loss copy ("keep your streak alive"). A live streak count
 * is intentionally NOT here — a local notification's payload is fixed at
 * schedule time, so a real number would go stale when the player is away (the
 * exact moment it matters). That needs per-session rescheduling or server push;
 * see docs / the build notes. Evergreen copy carries the loss-aversion hook
 * with zero staleness risk.
 */

const OPT_IN_KEY = 'ludodex.notifications_enabled';
const PROMPTED_KEY = 'ludodex.reminder_prompted';
const NOTIFICATION_ID = 1;

/**
 * Whether to show the one-time soft prompt (e.g. after the first solve). True
 * only on native, when the player hasn't already enabled reminders and hasn't
 * been asked before. The soft prompt is OUR UI; only on accept do we trigger
 * the OS permission prompt via enableDailyNotification().
 */
export async function shouldOfferDailyReminderPrompt(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (await isDailyNotificationEnabled()) return false;
  const { value } = await Preferences.get({ key: PROMPTED_KEY });
  return value !== 'true';
}

/** Record that the soft prompt has been shown, so it never appears again. */
export async function markDailyReminderPrompted(): Promise<void> {
  await Preferences.set({ key: PROMPTED_KEY, value: 'true' });
}

export async function isDailyNotificationEnabled(): Promise<boolean> {
  const { value } = await Preferences.get({ key: OPT_IN_KEY });
  return value === 'true';
}

async function scheduleDaily(): Promise<void> {
  // Cancel first so repeated calls (boot re-arm, locale change) never stack
  // duplicate notifications.
  await cancelDaily();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: NOTIFICATION_ID,
        title: t('notification.daily_title'),
        body: t('notification.daily_body'),
        schedule: {
          on: { hour: 9, minute: 0 },
          repeats: true,
          allowWhileIdle: true
        }
      }
    ]
  });
}

async function cancelDaily(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
  } catch {
    // Nothing pending to cancel — fine.
  }
}

/**
 * Turn the daily reminder on. Requests OS permission (this is the prompt
 * moment), then schedules. Returns false if not native or permission was not
 * granted, so the caller can revert the toggle / show guidance.
 */
export async function enableDailyNotification(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return false;
  await scheduleDaily();
  await Preferences.set({ key: OPT_IN_KEY, value: 'true' });
  return true;
}

/** Turn the daily reminder off and cancel any pending notification. */
export async function disableDailyNotification(): Promise<void> {
  await Preferences.set({ key: OPT_IN_KEY, value: 'false' });
  await cancelDaily();
}

/**
 * Boot re-arm (call once at startup). If the player previously opted in and
 * permission is still granted, refresh the schedule so it reflects the current
 * locale/copy. Never prompts. If permission was revoked in system settings,
 * clears the opt-in so the toggle reflects reality.
 */
export async function initDailyNotification(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!(await isDailyNotificationEnabled())) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'granted') {
      await scheduleDaily();
    } else {
      await Preferences.set({ key: OPT_IN_KEY, value: 'false' });
    }
  } catch {
    // Non-critical — never block startup on notifications.
  }
}
