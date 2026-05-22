import { Preferences } from '@capacitor/preferences';

export type HintState = {
  hintsRemaining: number;
  lastGrantDate: string;  // 'YYYY-MM-DD' local
};

export type PuzzleHintReveal = {
  partId: string;
  letterIndex: number;
};

const HINT_STATE_KEY = 'glitchsalad.hint_state';
const HINT_REVEALS_PREFIX = 'glitchsalad.hint_reveals.';
const AD_HINT_GRANTS_KEY = 'glitchsalad.ad_hint_grants';

/**
 * Hints granted on first-ever install. Generous onboarding floor.
 */
const STARTING_HINTS = 5;

/**
 * Free hints added per calendar day (additive, not a floor).
 * Rolls over up to HINT_ROLLOVER_CAP.
 */
const DAILY_HINT_GRANT = 1;

/**
 * Maximum free hints a player can accumulate via daily rollover.
 * Keeps hints scarce enough to remain valuable.
 */
const HINT_ROLLOVER_CAP = 7;

/**
 * How many ad-rewarded hints a player can claim per day.
 * 5 is the industry sweet spot — enough to feel generous without
 * undermining the remove-ads or hint-pack value proposition.
 */
export const AD_HINT_DAILY_LIMIT = 5;

type AdHintGrantState = {
  count: number;
  date: string; // 'YYYY-MM-DD' local
};

function todayKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function readState(): Promise<HintState | null> {
  const raw = await Preferences.get({ key: HINT_STATE_KEY });
  if (!raw.value) return null;
  try {
    return JSON.parse(raw.value) as HintState;
  } catch {
    return null;
  }
}

async function writeState(state: HintState): Promise<void> {
  await Preferences.set({ key: HINT_STATE_KEY, value: JSON.stringify(state) });
}

/**
 * Returns the current hint state, applying the daily grant if today's date
 * differs from the last grant date.
 *
 * Grant model (v2):
 *  - New install: STARTING_HINTS (5).
 *  - Each new calendar day: +DAILY_HINT_GRANT (1), capped at HINT_ROLLOVER_CAP (7).
 *  - Purchased or ad-earned hints accumulate above the rollover cap.
 *
 * This replaces the old "always at least FREE_DAILY_HINTS" floor, which
 * felt opaque and undermined scarcity. The additive model is more
 * legible and creates a natural save-up incentive.
 */
export async function ensureDailyGrant(now: Date = new Date()): Promise<HintState> {
  const existing = await readState();
  const today = todayKey(now);

  // First ever launch: grant starting hints.
  if (!existing) {
    const fresh: HintState = { hintsRemaining: STARTING_HINTS, lastGrantDate: today };
    await writeState(fresh);
    return fresh;
  }

  if (existing.lastGrantDate !== today) {
    // Add one hint per day, capped at the rollover cap.
    // Only the free daily portion is capped — hints above the cap from
    // IAP purchases or ad rewards are preserved.
    const freeBalance = Math.min(existing.hintsRemaining + DAILY_HINT_GRANT, HINT_ROLLOVER_CAP);
    existing.hintsRemaining = Math.max(existing.hintsRemaining, freeBalance);
    existing.lastGrantDate = today;
    await writeState(existing);
  }

  return existing;
}

export async function getHintsRemaining(): Promise<number> {
  const state = await ensureDailyGrant();
  return state.hintsRemaining;
}

/**
 * Consumes one hint. Returns the updated state. If hints are exhausted, returns
 * the unchanged state — callers should check `hintsRemaining > 0` before calling.
 */
export async function consumeHint(): Promise<HintState> {
  const state = await ensureDailyGrant();
  if (state.hintsRemaining <= 0) return state;
  state.hintsRemaining -= 1;
  await writeState(state);
  return state;
}

/**
 * Adds hints to the user's pool. Used by ad rewards and IAP hint packs.
 * Purchased hints are NOT capped — they accumulate above the rollover cap.
 */
export async function grantHints(count: number): Promise<HintState> {
  const state = await ensureDailyGrant();
  state.hintsRemaining += count;
  await writeState(state);
  return state;
}

// ─────── Ad-hint daily tracking ───────

async function readAdHintState(now: Date = new Date()): Promise<AdHintGrantState> {
  const raw = await Preferences.get({ key: AD_HINT_GRANTS_KEY });
  const today = todayKey(now);
  if (!raw.value) return { count: 0, date: today };
  try {
    const parsed = JSON.parse(raw.value) as AdHintGrantState;
    if (parsed.date !== today) return { count: 0, date: today };
    return parsed;
  } catch {
    return { count: 0, date: today };
  }
}

/**
 * How many ad-rewarded hints the player can still claim today.
 */
export async function getAdHintsRemainingToday(now: Date = new Date()): Promise<number> {
  const state = await readAdHintState(now);
  return Math.max(0, AD_HINT_DAILY_LIMIT - state.count);
}

/**
 * Consumes one ad-hint slot for today. Returns `true` if the slot was available
 * and consumed, `false` if the daily limit was already reached.
 * Call this AFTER a confirmed rewarded ad, BEFORE granting the hint.
 */
export async function consumeAdHintSlot(now: Date = new Date()): Promise<boolean> {
  const today = todayKey(now);
  const state = await readAdHintState(now);
  if (state.count >= AD_HINT_DAILY_LIMIT) return false;
  state.count += 1;
  state.date = today;
  await Preferences.set({ key: AD_HINT_GRANTS_KEY, value: JSON.stringify(state) });
  return true;
}

// ─────── Per-puzzle reveal persistence ───────

export async function getPuzzleReveals(puzzleId: string): Promise<PuzzleHintReveal[]> {
  const raw = await Preferences.get({ key: `${HINT_REVEALS_PREFIX}${puzzleId}` });
  if (!raw.value) return [];
  try {
    return JSON.parse(raw.value) as PuzzleHintReveal[];
  } catch {
    return [];
  }
}

export async function addPuzzleReveal(puzzleId: string, reveal: PuzzleHintReveal): Promise<void> {
  const reveals = await getPuzzleReveals(puzzleId);
  if (reveals.some(r => r.partId === reveal.partId && r.letterIndex === reveal.letterIndex)) {
    return;
  }
  reveals.push(reveal);
  await Preferences.set({
    key: `${HINT_REVEALS_PREFIX}${puzzleId}`,
    value: JSON.stringify(reveals)
  });
}

export async function clearPuzzleReveals(puzzleId: string): Promise<void> {
  await Preferences.remove({ key: `${HINT_REVEALS_PREFIX}${puzzleId}` });
}

/** Removes all hint state. Called from ProgressService.resetAllProgress. */
export async function resetHintData(): Promise<void> {
  const { keys } = await Preferences.keys();
  const toRemove = keys.filter(
    k => k === HINT_STATE_KEY || k === AD_HINT_GRANTS_KEY || k.startsWith(HINT_REVEALS_PREFIX)
  );
  await Promise.all(toRemove.map(key => Preferences.remove({ key })));
}
