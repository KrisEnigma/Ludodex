// --- Monotonic day-stamp defense ---
const LAST_SEEN_DAY_STAMP_KEY = 'ludodex.last_seen_day_stamp';

function getTodayDayStamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function readLastSeenDayStamp(): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key: LAST_SEEN_DAY_STAMP_KEY });
    return value;
  } catch {
    return null;
  }
}

async function writeLastSeenDayStamp(stamp: string): Promise<void> {
  try {
    await Preferences.set({ key: LAST_SEEN_DAY_STAMP_KEY, value: stamp });
  } catch {
    // Storage failures degrade gracefully.
  }
}

/**
 * Advances the watermark to today if today is later than the stored value.
 * Never moves the watermark backward — that's the whole point.
 * Safe to call on every app open and every solve.
 */
async function advanceLastSeenWatermark(): Promise<void> {
  const today = getTodayDayStamp();
  const stored = await readLastSeenDayStamp();
  if (stored === null || today > stored) {
    await writeLastSeenDayStamp(today);
  }
}

/**
 * Returns true iff the clock has been rolled backward relative to the highest
 * day this device has ever seen. Used to suppress streak credit on solves
 * that happened during apparent backward time travel.
 */
async function isClockBackwardFromWatermark(): Promise<boolean> {
  const today = getTodayDayStamp();
  const stored = await readLastSeenDayStamp();
  return stored !== null && today < stored;
}
const PRISTINE_COUNT_KEY = 'ludodex.pristine_count';
const CONSECUTIVE_PRISTINE_COUNT_KEY = 'ludodex.consecutive_pristine_count';
const ARCHIVE_SOLVES_COUNT_KEY = 'ludodex.archive_solves_count';
export async function getPristineCount(): Promise<number> {
  const { value } = await Preferences.get({ key: PRISTINE_COUNT_KEY });
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getConsecutivePristineCount(): Promise<number> {
  const { value } = await Preferences.get({ key: CONSECUTIVE_PRISTINE_COUNT_KEY });
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getArchiveSolvesCount(): Promise<number> {
  const { value } = await Preferences.get({ key: ARCHIVE_SOLVES_COUNT_KEY });
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
// Normalize legacy/invalid star ratings to 0-3 integer
export function normalizeStarRating(rating: unknown): 0 | 1 | 2 | 3 {
  const n = typeof rating === 'number' && Number.isFinite(rating) ? Math.round(rating) : 0;
  if (n < 1) return 0;
  if (n > 3) return 3;
  return n as 1 | 2 | 3;
}
import { Preferences } from '@capacitor/preferences';

const SOLVED_IDS_KEY = 'solved_ids';
const SOLVED_TIMES_KEY = 'solved_times';
const PUZZLES_SOLVED_COUNT_KEY = 'puzzles_solved_count';
const LAST_PLAYED_DATE_KEY = 'last_played_date';
const CURRENT_STREAK_KEY = 'current_streak';
const BEST_STREAK_KEY = 'best_streak';
const ACTIVE_SKIN_KEY = 'active_skin';
const INSTALL_DATE_KEY = 'ludodex.install_date';

type SolvedTimesMap = Record<string, number>;


const PROGRESS_KEYS = [
  'solved_ids',
  'solved_times',
  'puzzles_solved_count',
  'current_streak',
  'best_streak',
  'last_played_date'
] as const;

const SOLVED_RATINGS_KEY = 'solved_ratings';

export async function getSolvedRatings(): Promise<Record<string, number>> {
  const raw = await Preferences.get({ key: SOLVED_RATINGS_KEY });
  if (!raw.value) return {};
  try {
    return JSON.parse(raw.value) as Record<string, number>;
  } catch {
    return {};
  }
}

export type ProgressSnapshot = {
  /** Unique puzzles solved (solved_ids.length). Used by Volume achievements and the Menu's "Solved" card. */
  solvedCount: number;
  /** Total solve attempts including replays (puzzles_solved_count). Used by ad cadence only. */
  totalSolveAttempts: number;
  bestTimeSec: number | null;
  currentStreak: number;
  bestStreak: number;
  lastPlayedDate: string | null;
  pristineCount: number;
  consecutivePristineCount: number;
  archiveSolvesCount: number;
};

export type StreakStatus = {
  effective: number;
  brokenAt: number | null;
};

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function getSolvedIds(): Promise<string[]> {
  const { value } = await Preferences.get({ key: SOLVED_IDS_KEY });
  return safeParse<string[]>(value, []);
}

export async function markSolved(id: string) {
  const solved = new Set(await getSolvedIds());
  solved.add(id);
  await Preferences.set({
    key: SOLVED_IDS_KEY,
    value: JSON.stringify(Array.from(solved))
  });
}

export async function getSolvedTimes(): Promise<SolvedTimesMap> {
  const { value } = await Preferences.get({ key: SOLVED_TIMES_KEY });
  return safeParse<SolvedTimesMap>(value, {});
}

export async function getPuzzlesSolvedCount(): Promise<number> {
  const { value } = await Preferences.get({ key: PUZZLES_SOLVED_COUNT_KEY });
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getLastPlayedDate(): Promise<string | null> {
  const { value } = await Preferences.get({ key: LAST_PLAYED_DATE_KEY });
  return value ?? null;
}

export async function getCurrentStreak(): Promise<number> {
  const { value } = await Preferences.get({ key: CURRENT_STREAK_KEY });
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getBestStreak(): Promise<number> {
  const { value } = await Preferences.get({ key: BEST_STREAK_KEY });
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getActiveSkinId(): Promise<string> {
  const { value } = await Preferences.get({ key: ACTIVE_SKIN_KEY });
  return value || 'void';
}

export async function setActiveSkinId(skinId: string): Promise<void> {
  await Preferences.set({ key: ACTIVE_SKIN_KEY, value: skinId });
}

/**
 * Returns the install date as a 'YYYY-MM-DD' string. This is set on the
 * first ever `bootstrapProgress()` call and never overwritten. Returns null
 * only if storage has never been written (should not happen after first launch).
 */
export async function getInstallDate(): Promise<string | null> {
  const { value } = await Preferences.get({ key: INSTALL_DATE_KEY });
  return value ?? null;
}

/**
 * Returns the number of whole days since the install date, or 0 if the
 * install date is not yet set (first launch, before bootstrapProgress runs).
 */
export async function getDaysSinceInstall(now: Date = new Date()): Promise<number> {
  const installDate = await getInstallDate();
  if (!installDate) return 0;
  const install = new Date(`${installDate}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = today.getTime() - install.getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

function toDayStamp(isoLike: string): string {
  const d = new Date(isoLike);
  return formatDateKey(d);
}

function formatDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayDiff(fromStamp: string, toStamp: string): number {
  const from = new Date(`${fromStamp}T00:00:00`);
  const to = new Date(`${toStamp}T00:00:00`);
  const diffMs = to.getTime() - from.getTime();
  return Math.round(diffMs / 86400000);
}

function getBestTimeSec(solvedTimes: SolvedTimesMap): number | null {
  const values = Object.values(solvedTimes).filter((value) => Number.isFinite(value));
  if (values.length === 0) return null;
  return Math.min(...values);
}

export async function getProgressSnapshot(): Promise<ProgressSnapshot> {
  const [
    solvedIds,
    totalSolveAttempts,
    solvedTimes,
    currentStreak,
    bestStreak,
    lastPlayedDate,
    pristineCount,
    consecutivePristineCount,
    archiveSolvesCount
  ] = await Promise.all([
    getSolvedIds(),
    getPuzzlesSolvedCount(),
    getSolvedTimes(),
    getCurrentStreak(),
    getBestStreak(),
    getLastPlayedDate(),
    getPristineCount(),
    getConsecutivePristineCount(),
    getArchiveSolvesCount()
  ]);

  return {
    solvedCount: solvedIds.length,
    totalSolveAttempts,
    bestTimeSec: getBestTimeSec(solvedTimes),
    currentStreak,
    bestStreak,
    lastPlayedDate: lastPlayedDate ? toDayStamp(lastPlayedDate) : null,
    pristineCount,
    consecutivePristineCount,
    archiveSolvesCount
  };
}

export async function getStreakStatus(now: Date = new Date()): Promise<StreakStatus> {
  const snapshot = await getProgressSnapshot();
  if (snapshot.currentStreak <= 0 || !snapshot.lastPlayedDate) {
    return { effective: 0, brokenAt: null };
  }

  const today = formatDateKey(now);
  const yesterday = formatDateKey(new Date(now.getTime() - 86_400_000));

  if (snapshot.lastPlayedDate === today || snapshot.lastPlayedDate === yesterday) {
    return { effective: snapshot.currentStreak, brokenAt: null };
  }

  return { effective: 0, brokenAt: snapshot.currentStreak };
}

import { resetHintData } from './HintService';
import { resetEarnedAchievements } from './AchievementService';

export async function recordPuzzleCompletion(
  puzzleId: string,
  elapsedSeconds: number,
  options: { isTodaysDaily: boolean; starRating: 1 | 2 | 3; isTutorial?: boolean; nowIso?: string }
): Promise<ProgressSnapshot> {
  // Tutorial solves bypass all stat writes. Return a snapshot from current state.
  if (options.isTutorial) {
    return getProgressSnapshot();
  }

  // Defense check: capture before any mutations.
  const streakSuspect = await isClockBackwardFromWatermark();

  // Advance the watermark — no-op if today <= stored, else updates to today.
  await advanceLastSeenWatermark();

  const nowIso = options.nowIso ?? new Date().toISOString();

  const solvedSet = new Set(await getSolvedIds());
  const wasNewlySolved = !solvedSet.has(puzzleId);
  solvedSet.add(puzzleId);

  const [
    solvedTimes,
    previousCount,
    lastPlayedDate,
    previousStreak,
    previousBestStreak,
    ratings,
    previousPristineCount,
    previousConsecutivePristineCount,
    previousArchiveSolvesCount
  ] = await Promise.all([
    getSolvedTimes(),
    getPuzzlesSolvedCount(),
    getLastPlayedDate(),
    getCurrentStreak(),
    getBestStreak(),
    getSolvedRatings(),
    getPristineCount(),
    getConsecutivePristineCount(),
    getArchiveSolvesCount()
  ]);

  const existing = solvedTimes[puzzleId];
  solvedTimes[puzzleId] = (typeof existing === 'number' && Number.isFinite(existing))
    ? Math.min(existing, elapsedSeconds)
    : elapsedSeconds;

  // Ratings: store best ever (higher is better).
  const existingRating = ratings[puzzleId];
  const previousRating = (typeof existingRating === 'number' && existingRating > 0) ? existingRating : 0;
  const wasNewRating = options.starRating > previousRating;
  ratings[puzzleId] = wasNewRating ? options.starRating : previousRating;

  const totalSolveAttempts = previousCount + 1;
  let currentStreak = previousStreak;
  let bestStreak = previousBestStreak;

  // Streak update — gated by suspect flag.
  if (options.isTodaysDaily && !streakSuspect) {
    const todayStamp = toDayStamp(nowIso);
    const lastStamp = lastPlayedDate ? toDayStamp(lastPlayedDate) : null;

    currentStreak = 1;
    if (lastStamp) {
      const diff = dayDiff(lastStamp, todayStamp);
      if (diff === 0) {
        currentStreak = Math.max(1, previousStreak);
      } else if (diff === 1) {
        currentStreak = Math.max(1, previousStreak + 1);
      }
    }

    bestStreak = Math.max(previousBestStreak, currentStreak);
  }
  // If suspect, streak and last_solved_date are not updated (remain as before).

  // Pristine count: increment only when this solve produced a puzzle's first-ever pristine.
  const isFirstTimePristineForThisPuzzle = wasNewRating && options.starRating === 3;
  const pristineCount = previousPristineCount + (isFirstTimePristineForThisPuzzle ? 1 : 0);

  // Consecutive pristine count:
  // - First-time pristine on a puzzle: +1
  // - Non-pristine first-time solve OR non-pristine first-time-better-rating: reset to 0
  //   (i.e., wasNewRating && starRating < 3 — the player WAS attempting and failed to pristine)
  // - Anything else (replays of already-rated puzzles): neutral, no change
  let consecutivePristineCount = previousConsecutivePristineCount;
  if (isFirstTimePristineForThisPuzzle) {
    consecutivePristineCount = previousConsecutivePristineCount + 1;
  } else if (wasNewRating && options.starRating < 3) {
    consecutivePristineCount = 0;
  }
  // else: neutral.

  // Archive solves count: increment on every non-daily solve (does not require uniqueness — a replay of an archive puzzle still represents archive engagement).
  const archiveSolvesCount = previousArchiveSolvesCount + (options.isTodaysDaily ? 0 : 1);

  const bestTimeSec = getBestTimeSec(solvedTimes);

  const writes: Array<Promise<void>> = [
    Preferences.set({ key: SOLVED_IDS_KEY, value: JSON.stringify(Array.from(solvedSet)) }),
    Preferences.set({ key: SOLVED_TIMES_KEY, value: JSON.stringify(solvedTimes) }),
    Preferences.set({ key: PUZZLES_SOLVED_COUNT_KEY, value: String(totalSolveAttempts) }),
    Preferences.set({ key: SOLVED_RATINGS_KEY, value: JSON.stringify(ratings) }),
    Preferences.set({ key: PRISTINE_COUNT_KEY, value: String(pristineCount) }),
    Preferences.set({ key: CONSECUTIVE_PRISTINE_COUNT_KEY, value: String(consecutivePristineCount) }),
    Preferences.set({ key: ARCHIVE_SOLVES_COUNT_KEY, value: String(archiveSolvesCount) })
  ];

  if (options.isTodaysDaily && !streakSuspect) {
    writes.push(
      Preferences.set({ key: LAST_PLAYED_DATE_KEY, value: nowIso }),
      Preferences.set({ key: CURRENT_STREAK_KEY, value: String(currentStreak) }),
      Preferences.set({ key: BEST_STREAK_KEY, value: String(bestStreak) })
    );
  }

  await Promise.all(writes);

  return {
    solvedCount: solvedSet.size,
    totalSolveAttempts,
    bestTimeSec,
    currentStreak,
    bestStreak,
    lastPlayedDate: options.isTodaysDaily && !streakSuspect ? toDayStamp(nowIso) : (lastPlayedDate ? toDayStamp(lastPlayedDate) : null),
    pristineCount,
    consecutivePristineCount,
    archiveSolvesCount
  };
}

export async function resetAllProgress(): Promise<void> {
  await Promise.all(PROGRESS_KEYS.map((key) => Preferences.remove({ key })));
  await Preferences.remove({ key: SOLVED_RATINGS_KEY });
  await Preferences.remove({ key: PRISTINE_COUNT_KEY });
  await Preferences.remove({ key: CONSECUTIVE_PRISTINE_COUNT_KEY });
  await Preferences.remove({ key: ARCHIVE_SOLVES_COUNT_KEY });
  await Preferences.remove({ key: LAST_SEEN_DAY_STAMP_KEY });
  // Note: install date is intentionally NOT reset — it reflects when the
  // app was first installed and should survive a progress wipe.
  await resetHintData();
  await resetEarnedAchievements();
}

/**
 * Called on app start. Backfills `pristine_count` from `solved_ratings` for users
 * who upgraded from a version before pristine_count was tracked. Returns a fresh
 * snapshot for the caller to use.
 */
export async function bootstrapProgress(): Promise<ProgressSnapshot> {
  const currentPristineCount = await getPristineCount();
  if (currentPristineCount === 0) {
    const ratings = await getSolvedRatings();
    const computedCount = Object.values(ratings).filter((r) => r === 3).length;
    if (computedCount > 0) {
      await Preferences.set({ key: PRISTINE_COUNT_KEY, value: String(computedCount) });
    }
  }

  // Monotonic day-stamp defense: advance the watermark on every app open.
  await advanceLastSeenWatermark();

  // Install date: set once on first ever launch, never overwritten.
  const existingInstallDate = await getInstallDate();
  if (!existingInstallDate) {
    const today = getTodayDayStamp();
    await Preferences.set({ key: INSTALL_DATE_KEY, value: today });
  }

  return getProgressSnapshot();
}
