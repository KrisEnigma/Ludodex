/**
 * Dev overlay — floating badge + dev tools (day stepper, notification tester).
 *
 * Only imported in dev builds (import.meta.env.DEV gate in IAPService.ts).
 * Zero bytes in production bundles.
 *
 *   🔓 DEV  — all skins + levels unlocked (default dev state)
 *   🌐 WEB  — simulates the web player experience (limited skin set)
 *
 * Tap the badge to toggle sim mode. Page reloads to apply the change.
 *
 * +1D button
 *   Increments localStorage['ludodex.devday'] by 1 (seeding from the real
 *   computed day if no override exists yet) then reloads. Lets you walk
 *   forward through daily puzzles, archive growth, countdown timers, and
 *   streak logic without waiting real days.
 *
 * 🔔 button
 *   Fires a local notification with the same title/body as the real daily
 *   reminder, but scheduled 5 s from now instead of 09:00.
 *   • Native  — uses @capacitor/local-notifications (works in live-reload
 *               on device; notification appears in the Android shade).
 *   • Web     — falls back to the browser Notification API (requests
 *               permission if needed). No-ops gracefully if denied.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { t } from '../i18n';

// ─── Constants ───────────────────────────────────────────────────────────────

const SIM_KEY = 'dev_sim_platform';
const DEV_DAY_KEY = 'ludodex.devday';
const TEST_NOTIF_ID = 9001; // distinct from the production NOTIFICATION_ID (1)

// Mirror PuzzleLoader's LAUNCH_DATE logic so +1D can seed from the real day
// without importing from PuzzleLoader (keeps dev tooling self-contained).
const DEV_LAUNCH_DATE = (() => {
  const raw = (import.meta.env.VITE_LAUNCH_DATE as string | undefined)?.trim();
  if (raw) {
    const parsed = new Date(`${raw}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date('2026-06-22T00:00:00');
})();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSimulating(): boolean {
  return sessionStorage.getItem(SIM_KEY) === 'web';
}

/** Compute the real day number using the same formula as PuzzleLoader. */
function getRealDayNumber(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const launch = new Date(DEV_LAUNCH_DATE);
  launch.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - launch.getTime()) / 86400000);
  return Math.max(1, days + 1);
}

/** Read the current override, falling back to the real day number. */
function getCurrentDevDay(): number {
  try {
    const stored = window.localStorage.getItem(DEV_DAY_KEY);
    if (stored && /^\d+$/.test(stored)) return Math.max(1, parseInt(stored, 10));
  } catch {
    // localStorage unavailable — ignore.
  }
  return getRealDayNumber();
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const CSS = `
  /* Fixed anchor — children stack vertically, bottom-aligned to the right edge */
  #dev-overlay-wrap {
    position: fixed;
    bottom: 20px;
    right: 14px;
    z-index: 99999;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    /* Pointer events pass through the transparent wrapper gap */
    pointer-events: none;
  }
  #dev-overlay-wrap > * {
    pointer-events: auto;
  }

  /* ── Sim-mode toggle (original pill, now a child of the wrapper) ── */
  #dev-overlay {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px 6px 9px;
    border-radius: 999px;
    border: 1.5px solid rgba(255, 255, 255, 0.25);
    font-family: ui-monospace, 'Space Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #fff;
    cursor: pointer;
    user-select: none;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    transition: transform 0.1s, opacity 0.15s;
    -webkit-tap-highlight-color: transparent;
  }
  #dev-overlay:active { transform: scale(0.94); }
  #dev-overlay[data-sim="false"] { background: rgba(220, 80, 20, 0.88); }
  #dev-overlay[data-sim="true"]  { background: rgba(30, 100, 230, 0.88); }

  #dev-overlay-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.7);
    animation: dev-pulse 2s infinite;
  }
  @keyframes dev-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.35; }
  }

  /* ── Dev-tools pill (day stepper + notification tester) ── */
  #dev-overlay-tools {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 8px;
    border-radius: 999px;
    border: 1.5px solid rgba(255, 255, 255, 0.18);
    background: rgba(10, 10, 10, 0.72);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  .dev-tool-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.10);
    font-family: ui-monospace, 'Space Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #fff;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.1s, background 0.12s;
    white-space: nowrap;
  }
  .dev-tool-btn:active {
    transform: scale(0.88);
    background: rgba(255, 255, 255, 0.22);
  }

  /* Divider between the two tool buttons */
  .dev-tool-sep {
    width: 1px;
    height: 14px;
    background: rgba(255, 255, 255, 0.18);
    flex-shrink: 0;
  }
`;

// ─── Mount ───────────────────────────────────────────────────────────────────

function mount(): void {
  // Inject styles
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // ── Wrapper ──────────────────────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.id = 'dev-overlay-wrap';

  // ── Dev-tools pill ───────────────────────────────────────────────────────
  const toolsPill = document.createElement('div');
  toolsPill.id = 'dev-overlay-tools';

  // +1D button — advance the dev day override by one and reload
  const dayBtn = document.createElement('button');
  dayBtn.type = 'button';
  dayBtn.className = 'dev-tool-btn';
  dayBtn.textContent = '+1 Day';
  dayBtn.title = 'Advance dev day override by 1 and reload';
  dayBtn.setAttribute('aria-label', 'Advance dev day by 1');
  dayBtn.addEventListener('click', () => {
    const next = getCurrentDevDay() + 1;
    try {
      window.localStorage.setItem(DEV_DAY_KEY, String(next));
    } catch {
      console.warn('[DevOverlay] Could not write to localStorage');
      return;
    }
    location.reload();
  });

  const sep = document.createElement('div');
  sep.className = 'dev-tool-sep';
  sep.setAttribute('aria-hidden', 'true');

  // 🔔 button — fire a test notification 5 s from now
  const notifBtn = document.createElement('button');
  notifBtn.type = 'button';
  notifBtn.className = 'dev-tool-btn';
  notifBtn.textContent = '🔔 Notify';
  notifBtn.title = 'Fire a test daily notification in 5 s';
  notifBtn.setAttribute('aria-label', 'Test daily notification');
  notifBtn.addEventListener('click', () => void fireTestNotification());

  toolsPill.appendChild(dayBtn);
  toolsPill.appendChild(sep);
  toolsPill.appendChild(notifBtn);

  // ── Sim-mode toggle badge (existing) ─────────────────────────────────────
  const badge = document.createElement('button');
  badge.id = 'dev-overlay';
  badge.type = 'button';
  badge.setAttribute('aria-label', 'Dev mode toggle');

  const dot = document.createElement('span');
  dot.id = 'dev-overlay-dot';

  const label = document.createElement('span');

  badge.appendChild(dot);
  badge.appendChild(label);

  function updateBadge(): void {
    const sim = isSimulating();
    label.textContent = sim ? '🌐 Web player' : '🔓 Dev';
    badge.title = sim
      ? 'Simulating web player — tap to restore full dev access'
      : 'Full dev access — tap to simulate web player';
    badge.dataset.sim = sim ? 'true' : 'false';
  }

  badge.addEventListener('click', () => {
    if (isSimulating()) {
      sessionStorage.removeItem(SIM_KEY);
    } else {
      sessionStorage.setItem(SIM_KEY, 'web');
    }
    location.reload();
  });

  // ── Assemble — tools pill above the main badge ────────────────────────────
  wrap.appendChild(toolsPill);
  wrap.appendChild(badge);
  document.body.appendChild(wrap);

  updateBadge();
}

// ─── Notification test ───────────────────────────────────────────────────────

async function fireTestNotification(): Promise<void> {
  const title = t('notification.daily_title');
  const body = t('notification.daily_body');
  const fireAt = new Date(Date.now() + 5_000);

  if (Capacitor.isNativePlatform()) {
    // ── Native path: @capacitor/local-notifications ──────────────────────
    try {
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') {
        console.warn('[DevOverlay] Notification permission denied');
        return;
      }
      // Cancel any previous test notification so retaps don't stack.
      try {
        await LocalNotifications.cancel({ notifications: [{ id: TEST_NOTIF_ID }] });
      } catch {
        // Nothing pending — fine.
      }
      await LocalNotifications.schedule({
        notifications: [
          {
            id: TEST_NOTIF_ID,
            title,
            body,
            schedule: { at: fireAt, allowWhileIdle: true }
          }
        ]
      });
      console.log(`[DevOverlay] Test notification scheduled for ${fireAt.toISOString()}`);
    } catch (err) {
      console.error('[DevOverlay] Failed to schedule test notification:', err);
    }
  } else {
    // ── Web fallback: browser Notification API ────────────────────────────
    if (!('Notification' in window)) {
      console.warn('[DevOverlay] Browser Notification API unavailable');
      return;
    }
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      console.warn('[DevOverlay] Notification permission denied');
      return;
    }
    const delay = fireAt.getTime() - Date.now();
    setTimeout(() => {
      new Notification(title, { body });
    }, Math.max(0, delay));
    console.log(`[DevOverlay] Test browser notification fires in ~5 s`);
  }
}

// ─── Export ──────────────────────────────────────────────────────────────────

export function initDevOverlay(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
}
