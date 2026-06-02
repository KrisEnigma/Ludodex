/**
 * Streak Freeze system.
 *
 * Players earn a freeze token after every 5 consecutive daily wins. A freeze
 * auto-applies the next time the player misses exactly one day, silently
 * extending the streak as if they hadn't missed.
 *
 * Rules:
 *  - Max 2 tokens held at once.
 *  - Earn 1 token every 5 consecutive wins (counter resets after each grant).
 *  - The 5-win counter also resets when the streak breaks (no free-riding on
 *    a recovered streak to immediately re-earn).
 *  - A freeze only covers a single-day gap (diff === 2). Multi-day gaps are
 *    not covered — that would feel like cheating, not forgiveness.
 *  - Freeze consumption is recorded (for display and debugging).
 */

import { Preferences } from '@capacitor/preferences';

const FREEZE_COUNT_KEY = 'ludodex.streak_freezes';
const FREEZE_USED_DATES_KEY = 'ludodex.freeze_used_dates';
const FREEZE_WIN_PROGRESS_KEY = 'ludodex.freeze_win_progress';

/** Maximum freeze tokens a player can hold at once. */
export const FREEZE_MAX = 2;

/** Consecutive wins required to earn one freeze token. */
export const FREEZE_EARN_THRESHOLD = 5;

export async function getFreezeCount(): Promise<number> {
  const { value } = await Preferences.get({ key: FREEZE_COUNT_KEY });
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/** How many consecutive wins the player has banked toward the next freeze (0–4). */
export async function getFreezeWinProgress(): Promise<number> {
  const { value } = await Preferences.get({ key: FREEZE_WIN_PROGRESS_KEY });
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/** Grant one freeze token if the player is under the cap. Returns true if granted. */
export async function grantFreeze(): Promise<boolean> {
  const current = await getFreezeCount();
  if (current >= FREEZE_MAX) return false;
  await Preferences.set({ key: FREEZE_COUNT_KEY, value: String(current + 1) });
  return true;
}

/**
 * Called after every successful consecutive daily win (diff === 0 same-day replay
 * excluded — only real new-day wins count). Increments the earn counter and grants
 * a freeze if the threshold is hit. Returns true if a freeze was granted this call.
 */
export async function recordWinForFreeze(): Promise<boolean> {
  const progress = await getFreezeWinProgress();
  const next = progress + 1;

  if (next >= FREEZE_EARN_THRESHOLD) {
    // Threshold hit — reset progress and attempt to grant a token.
    await Preferences.set({ key: FREEZE_WIN_PROGRESS_KEY, value: '0' });
    return grantFreeze();
  }

  await Preferences.set({ key: FREEZE_WIN_PROGRESS_KEY, value: String(next) });
  return false;
}

/**
 * Called when the streak breaks (no freeze available to save it).
 * Resets the earn counter so the player starts fresh toward the next freeze.
 */
export async function resetFreezeProgress(): Promise<void> {
  await Preferences.set({ key: FREEZE_WIN_PROGRESS_KEY, value: '0' });
}

/**
 * Consume one freeze token, recording the date string it covered.
 * Returns true if a token was available and consumed, false otherwise.
 */
export async function consumeFreeze(coveredDate: string): Promise<boolean> {
  const current = await getFreezeCount();
  if (current <= 0) return false;
  const usedDates = await getFreezeUsedDates();
  await Promise.all([
    Preferences.set({ key: FREEZE_COUNT_KEY, value: String(current - 1) }),
    Preferences.set({ key: FREEZE_USED_DATES_KEY, value: JSON.stringify([...usedDates, coveredDate]) })
  ]);
  return true;
}

export async function getFreezeUsedDates(): Promise<string[]> {
  const { value } = await Preferences.get({ key: FREEZE_USED_DATES_KEY });
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as unknown[]).filter((d): d is string => typeof d === 'string');
  } catch {
    return [];
  }
}

/** Reset all freeze data. Called from resetAllProgress. */
export async function resetFreezeData(): Promise<void> {
  await Promise.all([
    Preferences.remove({ key: FREEZE_COUNT_KEY }),
    Preferences.remove({ key: FREEZE_USED_DATES_KEY }),
    Preferences.remove({ key: FREEZE_WIN_PROGRESS_KEY })
  ]);
}
