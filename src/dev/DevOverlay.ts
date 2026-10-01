/**
 * Dev overlay — floating badge + dev tools (day stepper, notification tester).
 *
 * Only imported in dev builds (import.meta.env.DEV gate in IAPService.ts).
 * Zero bytes in production bundles.
 *
 *   🔓 DEV     — all skins + levels unlocked (default dev state)
 *   🌐 WEB     — simulates the web player experience (limited skin set)
 *   📱 NATIVE  — simulates a native (Android) player: real entitlement
 *                rules (achievement / IAP gating), native Settings UI.
 *                Plugins stay inert: purchases fail with
 *                'dev-sim-no-billing', nothing counts as purchased.
 *
 * Tap the badge to cycle DEV → WEB → NATIVE. Page reloads to apply.
 *
 * 🎨 button
 *   Skin gallery: every skin side by side as a mini screen (also ?skins).
 *
 * 🏆 button
 *   Opens a panel to grant / revoke individual achievements (writes the real
 *   `ludodex.achievements_earned` store). Reload to apply everywhere.
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
import { ACHIEVEMENTS } from '../data/achievements';
import { devSetEarned, getEarnedAchievements } from '../services/AchievementService';
import { resetAllProgress } from '../services/ProgressService';
import { showConfirmModal } from '../components/Modal';
import { openSkinGallery } from './SkinGallery';

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

type SimMode = 'full' | 'web' | 'native';

function getSimMode(): SimMode {
  const v = sessionStorage.getItem(SIM_KEY);
  return v === 'web' || v === 'native' ? v : 'full';
}

const NEXT_SIM: Record<SimMode, SimMode> = { full: 'web', web: 'native', native: 'full' };

/** Compute the real day number using the same formula as PuzzleLoader. */
function getRealDayNumber(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const launch = new Date(DEV_LAUNCH_DATE);
  launch.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - launch.getTime()) / 86400000); // round: DST-safe, mirrors PuzzleLoader
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
    transition: transform 0.1s, opacity 0.15s;
    -webkit-tap-highlight-color: transparent;
  }
  #dev-overlay:active { transform: scale(0.94); }
  /* Opaque, no backdrop-filter: blur over a constantly repainting page
     (timer, ribbon, view fades) caused intermittent flicker in Chromium. */
  #dev-overlay[data-sim="full"]   { background: rgb(205, 78, 24); }
  #dev-overlay[data-sim="web"]    { background: rgb(32, 96, 214); }
  #dev-overlay[data-sim="native"] { background: rgb(22, 140, 76); }

  /* ── Achievements panel ── */
  #dev-ach-panel {
    position: fixed;
    right: 14px;
    bottom: 110px;
    z-index: 99999;
    width: min(320px, calc(100vw - 28px));
    max-height: 60vh;
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    border: 1.5px solid rgba(255, 255, 255, 0.18);
    background: rgba(10, 10, 10, 0.92);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5);
    font-family: ui-monospace, 'Space Mono', monospace;
    font-size: 11px;
    color: #fff;
  }
  #dev-ach-panel[hidden] { display: none; }
  .dev-ach-head {
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  }
  .dev-ach-head span { flex: 1; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
  .dev-ach-list { overflow-y: auto; padding: 4px 8px 8px; }
  .dev-ach-row { display: flex; gap: 8px; align-items: center; padding: 4px 0; cursor: pointer; }
  .dev-ach-row input { margin: 0; }
  .dev-ach-id { opacity: 0.55; margin-left: auto; font-size: 10px; }

  #dev-overlay-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.7);
  }

  /* ── Dev-tools pill (day stepper + notification tester) ── */
  #dev-overlay-tools {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: 4px;
    max-width: calc(100vw - 28px);
    padding: 5px 8px;
    border-radius: 16px;
    border: 1.5px solid rgba(255, 255, 255, 0.18);
    background: rgba(10, 10, 10, 0.94);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
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

  const sep2 = document.createElement('div');
  sep2.className = 'dev-tool-sep';
  sep2.setAttribute('aria-hidden', 'true');

  // 🏆 button — toggle the grant/revoke achievements panel
  const achPanel = buildAchievementsPanel();
  const achBtn = document.createElement('button');
  achBtn.type = 'button';
  achBtn.className = 'dev-tool-btn';
  achBtn.textContent = '🏆';
  achBtn.title = 'Grant / revoke achievements';
  achBtn.setAttribute('aria-label', 'Grant or revoke achievements');
  achBtn.addEventListener('click', () => {
    achPanel.hidden = !achPanel.hidden;
    if (!achPanel.hidden) void refreshAchievementsPanel(achPanel);
  });

  toolsPill.appendChild(dayBtn);
  toolsPill.appendChild(sep);
  toolsPill.appendChild(notifBtn);
  toolsPill.appendChild(sep2);
  toolsPill.appendChild(achBtn);

  // 🎨 button — all skins side by side (also opens with ?skins in the URL)
  const skinsBtn = document.createElement('button');
  skinsBtn.type = 'button';
  skinsBtn.className = 'dev-tool-btn';
  skinsBtn.textContent = '🎨';
  skinsBtn.title = 'Skin gallery: every skin side by side';
  skinsBtn.setAttribute('aria-label', 'Open skin gallery');
  skinsBtn.addEventListener('click', openSkinGallery);
  toolsPill.appendChild(skinsBtn);
  if (new URLSearchParams(window.location.search).has('skins')) {
    // After boot has applied the saved skin (the gallery swaps <html> to Void).
    window.setTimeout(openSkinGallery, 1200);
  }

  const sep3 = document.createElement('div');
  sep3.className = 'dev-tool-sep';
  sep3.setAttribute('aria-hidden', 'true');

  // ◀ Back — simulate the Android hardware back button (same Router handler).
  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'dev-tool-btn';
  backBtn.textContent = '◀ Back';
  backBtn.title = 'Simulate the Android hardware back button';
  backBtn.setAttribute('aria-label', 'Simulate Android back button');
  backBtn.addEventListener('click', (e) => {
    // Don't let this click count as an outside-grid tap in the game.
    e.stopPropagation();
    window.dispatchEvent(new Event('ludodex:dev-hardware-back'));
  });

  toolsPill.appendChild(sep3);
  toolsPill.appendChild(backBtn);

  const sep4 = document.createElement('div');
  sep4.className = 'dev-tool-sep';
  sep4.setAttribute('aria-hidden', 'true');

  // ⟲ Reset — same wipe as the hidden Settings gesture (resetAllProgress),
  // then reload. Keeps language, skin, tutorial-seen and dev settings.
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'dev-tool-btn';
  resetBtn.textContent = '⟲ Reset';
  resetBtn.title = 'Reset all progress (solves, times, streaks, achievements, hints, first-play data)';
  resetBtn.setAttribute('aria-label', 'Reset all progress');
  resetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // App modal, not window.confirm(): some embedded browsers (e.g. the
    // Claude app's browser pane) auto-cancel native dialogs.
    void showConfirmModal({
      title: 'Reset all progress? (dev)',
      body: 'Clears solves, times, streaks, achievements, hints and first-play data, then reloads.',
      confirmLabel: 'Reset',
      cancelLabel: 'Cancel',
      destructive: true
    }).then(async (confirmed) => {
      if (!confirmed) return;
      await resetAllProgress();
      location.reload();
    });
  });

  toolsPill.appendChild(sep4);
  toolsPill.appendChild(resetBtn);

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

  const SIM_LABELS: Record<SimMode, { label: string; title: string }> = {
    full: { label: '🔓 Dev', title: 'Full dev access — tap to simulate web player' },
    web: { label: '🌐 Web player', title: 'Simulating web player — tap to simulate native player' },
    native: { label: '📱 Native player', title: 'Simulating native player — tap to restore full dev access' }
  };

  function updateBadge(): void {
    const sim = getSimMode();
    label.textContent = SIM_LABELS[sim].label;
    badge.title = SIM_LABELS[sim].title;
    badge.dataset.sim = sim;
  }

  badge.addEventListener('click', () => {
    const next = NEXT_SIM[getSimMode()];
    if (next === 'full') sessionStorage.removeItem(SIM_KEY);
    else sessionStorage.setItem(SIM_KEY, next);
    location.reload();
  });

  // ── Assemble — tools pill above the main badge ────────────────────────────
  wrap.appendChild(toolsPill);
  wrap.appendChild(badge);
  document.body.appendChild(wrap);
  document.body.appendChild(achPanel);

  updateBadge();
}

// ─── Achievements panel ──────────────────────────────────────────────────────

function buildAchievementsPanel(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = 'dev-ach-panel';
  panel.hidden = true;

  const head = document.createElement('div');
  head.className = 'dev-ach-head';
  const title = document.createElement('span');
  title.textContent = 'Achievements';

  const mkBtn = (text: string, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dev-tool-btn';
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  };

  const setAll = async (earned: boolean): Promise<void> => {
    for (const def of ACHIEVEMENTS) await devSetEarned(def.id, earned);
    await refreshAchievementsPanel(panel);
  };

  head.append(
    title,
    mkBtn('All', () => void setAll(true)),
    mkBtn('None', () => void setAll(false)),
    mkBtn('Reload', () => location.reload()),
    mkBtn('✕', () => { panel.hidden = true; })
  );

  const list = document.createElement('div');
  list.className = 'dev-ach-list';

  panel.append(head, list);
  return panel;
}

async function refreshAchievementsPanel(panel: HTMLDivElement): Promise<void> {
  const list = panel.querySelector<HTMLDivElement>('.dev-ach-list');
  if (!list) return;
  const earned = new Set((await getEarnedAchievements()).map((r) => r.id));
  list.replaceChildren();

  for (const def of ACHIEVEMENTS) {
    const row = document.createElement('label');
    row.className = 'dev-ach-row';

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = earned.has(def.id);
    box.addEventListener('change', () => void devSetEarned(def.id, box.checked));

    const name = document.createElement('span');
    name.textContent = t(def.nameKey as Parameters<typeof t>[0]);

    const id = document.createElement('span');
    id.className = 'dev-ach-id';
    id.textContent = def.id;

    row.append(box, name, id);
    list.append(row);
  }
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
