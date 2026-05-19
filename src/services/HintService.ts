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
const FREE_DAILY_HINTS = 3;

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
 * Returns the current hint state, granting the daily allowance if today's date
 * differs from the last grant date. Top-up semantics: hintsRemaining is set to
 * max(hintsRemaining, FREE_DAILY_HINTS) — bought hints accumulate above the floor
 * but don't earn additional daily grants on top.
 */
export async function ensureDailyGrant(now: Date = new Date()): Promise<HintState> {
  const existing = await readState();
  const today = todayKey(now);

  if (!existing) {
    const fresh: HintState = { hintsRemaining: FREE_DAILY_HINTS, lastGrantDate: today };
    await writeState(fresh);
    return fresh;
  }

  if (existing.lastGrantDate !== today) {
    existing.hintsRemaining = Math.max(existing.hintsRemaining, FREE_DAILY_HINTS);
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
 * Adds hints to the user's pool. Reserved for ad rewards and pack purchases.
 * Wired in the next commit.
 */
export async function grantHints(count: number): Promise<HintState> {
  const state = await ensureDailyGrant();
  state.hintsRemaining += count;
  await writeState(state);
  return state;
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
    k => k === HINT_STATE_KEY || k.startsWith(HINT_REVEALS_PREFIX)
  );
  await Promise.all(toRemove.map(key => Preferences.remove({ key })));
}
