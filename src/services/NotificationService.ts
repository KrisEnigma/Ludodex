import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export async function scheduleDailyNotification() {
  if (!Capacitor.isNativePlatform()) return;

  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return;

  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) return;

  await LocalNotifications.schedule({
    notifications: [
      {
        id: 1,
        title: 'New puzzle unlocked',
        body: "Today's challenge is live. How fast can you solve it?",
        schedule: {
          on: { hour: 9, minute: 0 },
          repeats: true,
          allowWhileIdle: true
        }
      }
    ]
  });
}
