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
  /** Fastest FIRST-PLAY solve (replays excluded). Menu BEST + speed records. */
  bestTimeSec: number | null;
  /** True if the solve that produced this snapshot was the puzzle's first play. */
  wasFirstPlay: boolean;
  currentStreak: number;
  bestStreak: number;
  lastPlayedDate: string | null;
  pristineCount: number;
  consecutivePristineCount: number;
  archiveSolvesCount: number;
  /** True if a streak freeze token was auto-consumed to cover a missed day this solve. */
  freezeUsed: boolean;
  /** Number of freeze tokens the player currently holds (after this solve's potential consumption). */
  freezeCount: number;
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

/**
 * Raw stored skin id, or null if the player has never explicitly chosen one.
 * Unlike getActiveSkinId (which collapses "unset" into 'void'), this lets the
 * boot logic tell "never chosen" apart from "chose Void", so a brand-new
 * player on a light-mode device can default to the light skin (Lumen) while a
 * player who deliberately picked Void is always honored. See main.ts.
 */
export async function getStoredSkinId(): Promise<string | null> {
  const { value } = await Preferences.get({ key: ACTIVE_SKIN_KEY });
  return value ?? null;
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
  // Round, not floor: local midnights are 23h/25h apart across DST changes.
  return Math.max(0, Math.round(diffMs / 86_400_000));
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

// ── First-play tracking (docs/audit §6.2) ──────────────────────────────────
//
// Records (menu BEST, NEW BEST, speed achievements) count only a puzzle's
// first attempt, played cold. An attempt stops being a first play if the
// player goes back to the menu, closes the app, or restarts; backgrounding,
// calls, notifications and overlays keep it.
//
//   ATTEMPT_KEY          — marker written when an eligible board is shown.
//                          Still present at the next cold start → the app
//                          was closed mid-attempt → first play lost.
//   FIRST_PLAY_LOST_KEY  — puzzle ids whose first play was forfeited.
//   FIRST_SOLVE_TIMES_KEY — time of the first-play solve, per puzzle.
//                          (SOLVED_TIMES_KEY keeps the best time incl. replays.)

const FIRST_SOLVE_TIMES_KEY = 'ludodex.first_solve_times';
const FIRST_PLAY_LOST_KEY = 'ludodex.first_play_lost';
const ATTEMPT_KEY = 'ludodex.attempt';
/** Local day stamps (YYYY-MM-DD) on which that day's daily was solved. */
const DAILY_SOLVE_DATES_KEY = 'ludodex.daily_solve_dates';
const DAILY_SOLVE_DATES_MAX = 60;

export type RecentDayState = 'solved' | 'frozen' | 'missed' | 'pending';
export type RecentDay = { date: string; state: RecentDayState; isToday: boolean };

async function getDailySolveDates(): Promise<string[]> {
  const { value } = await Preferences.get({ key: DAILY_SOLVE_DATES_KEY });
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * The last `count` local days ending today, for the menu's streak strip.
 * "Solved" = the daily was solved on its own day. Dates are recorded from now
 * on; days before that are backfilled from the live streak (lastPlayedDate
 * back `currentStreak` days), so existing players see their current run.
 * Freeze-covered days show as "frozen". Today unsolved is "pending".
 */
export async function getRecentDays(count = 7, now: Date = new Date()): Promise<RecentDay[]> {
  const [recorded, frozenDates, streak] = await Promise.all([
    getDailySolveDates(),
    getFreezeUsedDates(),
    getStreakStatus(now)
  ]);
  const solved = new Set(recorded);
  const frozen = new Set(frozenDates);

  if (streak.effective > 0) {
    const last = await getLastPlayedDate();
    if (last) {
      const cursor = new Date(`${toDayStamp(last)}T00:00:00`);
      for (let i = 0; i < streak.effective; i++) {
        const stamp = formatDateKey(cursor);
        if (!frozen.has(stamp)) solved.add(stamp);
        cursor.setDate(cursor.getDate() - 1);
      }
    }
  }

  const today = formatDateKey(now);
  const days: RecentDay[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const stamp = formatDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset));
    const isToday = stamp === today;
    const state: RecentDayState = solved.has(stamp)
      ? 'solved'
      : frozen.has(stamp) ? 'frozen' : isToday ? 'pending' : 'missed';
    days.push({ date: stamp, state, isToday });
  }
  return days;
}

type AttemptMarker = { puzzleId: string; startedAt: string };

export async function getFirstSolveTimes(): Promise<SolvedTimesMap> {
  const { value } = await Preferences.get({ key: FIRST_SOLVE_TIMES_KEY });
  return safeParse<SolvedTimesMap>(value, {});
}

async function getFirstPlayLost(): Promise<string[]> {
  const { value } = await Preferences.get({ key: FIRST_PLAY_LOST_KEY });
  const parsed = safeParse<unknown>(value, []);
  return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
}

async function readAttempt(): Promise<AttemptMarker | null> {
  const { value } = await Preferences.get({ key: ATTEMPT_KEY });
  const parsed = safeParse<Partial<AttemptMarker> | null>(value, null);
  return parsed && typeof parsed.puzzleId === 'string'
    ? { puzzleId: parsed.puzzleId, startedAt: String(parsed.startedAt ?? '') }
    : null;
}

async function clearAttemptFor(puzzleId: string): Promise<void> {
  const attempt = await readAttempt();
  if (attempt?.puzzleId === puzzleId) await Preferences.remove({ key: ATTEMPT_KEY });
}

/** True if solving this puzzle now would count as its first play. */
export async function isFirstPlayAvailable(puzzleId: string): Promise<boolean> {
  const [solvedIds, lost] = await Promise.all([getSolvedIds(), getFirstPlayLost()]);
  return !solvedIds.includes(puzzleId) && !lost.includes(puzzleId);
}

/** The board of an eligible first play is on screen. */
export async function beginFirstPlayAttempt(puzzleId: string): Promise<void> {
  const marker: AttemptMarker = { puzzleId, startedAt: new Date().toISOString() };
  await Preferences.set({ key: ATTEMPT_KEY, value: JSON.stringify(marker) });
}

/** Player left the puzzle (menu / back / restart) before solving it. */
export async function forfeitFirstPlay(puzzleId: string): Promise<void> {
  const lost = await getFirstPlayLost();
  if (!lost.includes(puzzleId)) {
    lost.push(puzzleId);
    await Preferences.set({ key: FIRST_PLAY_LOST_KEY, value: JSON.stringify(lost) });
  }
  await clearAttemptFor(puzzleId);
}

/**
 * Cold start: a leftover attempt marker means the app was closed (or killed
 * by the OS — indistinguishable) mid-attempt. Call before any game can open.
 */
export async function reconcileAbandonedAttempt(): Promise<void> {
  const attempt = await readAttempt();
  if (!attempt) return;
  const solvedIds = await getSolvedIds();
  if (solvedIds.includes(attempt.puzzleId)) {
    await Preferences.remove({ key: ATTEMPT_KEY });
    return;
  }
  await forfeitFirstPlay(attempt.puzzleId);
}

export async function getProgressSnapshot(): Promise<ProgressSnapshot> {
  const [
    solvedIds,
    totalSolveAttempts,
    firstSolveTimes,
    currentStreak,
    bestStreak,
    lastPlayedDate,
    pristineCount,
    consecutivePristineCount,
    archiveSolvesCount,
    freezeCount
  ] = await Promise.all([
    getSolvedIds(),
    getPuzzlesSolvedCount(),
    getFirstSolveTimes(),
    getCurrentStreak(),
    getBestStreak(),
    getLastPlayedDate(),
    getPristineCount(),
    getConsecutivePristineCount(),
    getArchiveSolvesCount(),
    getFreezeCount()
  ]);

  return {
    solvedCount: solvedIds.length,
    totalSolveAttempts,
    bestTimeSec: getBestTimeSec(firstSolveTimes),
    wasFirstPlay: false,
    currentStreak,
    bestStreak,
    lastPlayedDate: lastPlayedDate ? toDayStamp(lastPlayedDate) : null,
    pristineCount,
    consecutivePristineCount,
    archiveSolvesCount,
    freezeUsed: false,
    freezeCount
  };
}

export async function getStreakStatus(now: Date = new Date()): Promise<StreakStatus> {
  const snapshot = await getProgressSnapshot();
  if (snapshot.currentStreak <= 0 || !snapshot.lastPlayedDate) {
    return { effective: 0, brokenAt: null };
  }

  const today = formatDateKey(now);
  // Calendar arithmetic, not "now − 24h": after a 23h DST day, 24h back from
  // just past midnight lands two calendar days earlier.
  const yesterday = formatDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

  if (snapshot.lastPlayedDate === today || snapshot.lastPlayedDate === yesterday) {
    return { effective: snapshot.currentStreak, brokenAt: null };
  }

  return { effective: 0, brokenAt: snapshot.currentStreak };
}

import { resetHintData } from './HintService';
import { resetEarnedAchievements } from './AchievementService';
import { consumeFreeze, getFreezeCount, getFreezeUsedDates, recordWinForFreeze, resetFreezeData, resetFreezeProgress } from './FreezeService';

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

  // First play = never solved before AND first play not forfeited.
  const [firstPlayLost, firstSolveTimes] = await Promise.all([getFirstPlayLost(), getFirstSolveTimes()]);
  const wasFirstPlay = wasNewlySolved && !firstPlayLost.includes(puzzleId);
  if (wasFirstPlay) firstSolveTimes[puzzleId] = elapsedSeconds;

  const [
    solvedTimes,
    previousCount,
    lastPlayedDate,
    previousStreak,
    previousBestStreak,
    ratings,
    previousPristineCount,
    previousConsecutivePristineCount,
    previousArchiveSolvesCount,
    previousFreezeCount
  ] = await Promise.all([
    getSolvedTimes(),
    getPuzzlesSolvedCount(),
    getLastPlayedDate(),
    getCurrentStreak(),
    getBestStreak(),
    getSolvedRatings(),
    getPristineCount(),
    getConsecutivePristineCount(),
    getArchiveSolvesCount(),
    getFreezeCount()
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
  let freezeUsed = false;
  let freezeCount = previousFreezeCount;

  // Streak update — gated by suspect flag.
  if (options.isTodaysDaily && !streakSuspect) {
    const todayStamp = toDayStamp(nowIso);
    const lastStamp = lastPlayedDate ? toDayStamp(lastPlayedDate) : null;

    currentStreak = 1;
    if (lastStamp) {
      const diff = dayDiff(lastStamp, todayStamp);
      if (diff === 0) {
        // Same-day replay — preserve streak, don't count toward freeze earn.
        currentStreak = Math.max(1, previousStreak);
      } else if (diff === 1) {
        // Perfect consecutive day — count toward next freeze token.
        currentStreak = Math.max(1, previousStreak + 1);
        void recordWinForFreeze();
      } else if (diff === 2 && previousFreezeCount > 0) {
        // Missed exactly one day and the player has a freeze token.
        // Cover the gap: extend streak as if they hadn't missed.
        // Win progress is NOT advanced — freeze was needed, not earned.
        // Calendar arithmetic, not "+24h": after a 25h DST day, midnight + 24h
        // is still the same calendar date.
        const missedDate = new Date(`${lastStamp}T00:00:00`);
        missedDate.setDate(missedDate.getDate() + 1);
        const missedStamp = formatDateKey(missedDate);
        const consumed = await consumeFreeze(missedStamp);
        if (consumed) {
          currentStreak = Math.max(1, previousStreak + 1);
          freezeUsed = true;
          freezeCount = previousFreezeCount - 1;
        }
        // If consumeFreeze unexpectedly returned false, currentStreak stays 1 (reset).
        // Either way the streak broke or was barely saved — reset earn progress.
        void resetFreezeProgress();
      } else {
        // Streak broke with no freeze to save it — reset earn progress.
        void resetFreezeProgress();
      }
      // diff >= 3 with no freeze: currentStreak already set to 1 above.
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

  const bestTimeSec = getBestTimeSec(firstSolveTimes);

  const writes: Array<Promise<void>> = [
    Preferences.set({ key: FIRST_SOLVE_TIMES_KEY, value: JSON.stringify(firstSolveTimes) }),
    clearAttemptFor(puzzleId),
    Preferences.set({ key: SOLVED_IDS_KEY, value: JSON.stringify(Array.from(solvedSet)) }),
    Preferences.set({ key: SOLVED_TIMES_KEY, value: JSON.stringify(solvedTimes) }),
    Preferences.set({ key: PUZZLES_SOLVED_COUNT_KEY, value: String(totalSolveAttempts) }),
    Preferences.set({ key: SOLVED_RATINGS_KEY, value: JSON.stringify(ratings) }),
    Preferences.set({ key: PRISTINE_COUNT_KEY, value: String(pristineCount) }),
    Preferences.set({ key: CONSECUTIVE_PRISTINE_COUNT_KEY, value: String(consecutivePristineCount) }),
    Preferences.set({ key: ARCHIVE_SOLVES_COUNT_KEY, value: String(archiveSolvesCount) })
  ];

  if (options.isTodaysDaily && !streakSuspect) {
    const solveDates = await getDailySolveDates();
    const todayStamp = toDayStamp(nowIso);
    if (!solveDates.includes(todayStamp)) solveDates.push(todayStamp);
    writes.push(
      Preferences.set({ key: DAILY_SOLVE_DATES_KEY, value: JSON.stringify(solveDates.slice(-DAILY_SOLVE_DATES_MAX)) }),
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
    wasFirstPlay,
    currentStreak,
    bestStreak,
    lastPlayedDate: options.isTodaysDaily && !streakSuspect ? toDayStamp(nowIso) : (lastPlayedDate ? toDayStamp(lastPlayedDate) : null),
    pristineCount,
    consecutivePristineCount,
    archiveSolvesCount,
    freezeUsed,
    freezeCount
  };
}

export async function resetAllProgress(): Promise<void> {
  await Promise.all(PROGRESS_KEYS.map((key) => Preferences.remove({ key })));
  await Preferences.remove({ key: SOLVED_RATINGS_KEY });
  await Preferences.remove({ key: PRISTINE_COUNT_KEY });
  await Preferences.remove({ key: CONSECUTIVE_PRISTINE_COUNT_KEY });
  await Preferences.remove({ key: ARCHIVE_SOLVES_COUNT_KEY });
  await Preferences.remove({ key: LAST_SEEN_DAY_STAMP_KEY });
  await Preferences.remove({ key: FIRST_SOLVE_TIMES_KEY });
  await Preferences.remove({ key: FIRST_PLAY_LOST_KEY });
  await Preferences.remove({ key: ATTEMPT_KEY });
  await Preferences.remove({ key: DAILY_SOLVE_DATES_KEY });
  // Note: install date is intentionally NOT reset — it reflects when the
  // app was first installed and should survive a progress wipe.
  await resetHintData();
  await resetEarnedAchievements();
  await resetFreezeData();
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
