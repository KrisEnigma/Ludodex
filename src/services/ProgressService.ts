import { Preferences } from '@capacitor/preferences';

const SOLVED_IDS_KEY = 'solved_ids';
const SOLVED_TIMES_KEY = 'solved_times';
const PUZZLES_SOLVED_COUNT_KEY = 'puzzles_solved_count';
const LAST_PLAYED_DATE_KEY = 'last_played_date';
const CURRENT_STREAK_KEY = 'current_streak';
const BEST_STREAK_KEY = 'best_streak';
const ACTIVE_SKIN_KEY = 'active_skin';

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
  solvedCount: number;
  bestTimeSec: number | null;
  currentStreak: number;
  bestStreak: number;
  lastPlayedDate: string | null;
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
  const [solvedCount, solvedTimes, currentStreak, bestStreak, lastPlayedDate] = await Promise.all([
    getPuzzlesSolvedCount(),
    getSolvedTimes(),
    getCurrentStreak(),
    getBestStreak(),
    getLastPlayedDate()
  ]);

  return {
    solvedCount,
    bestTimeSec: getBestTimeSec(solvedTimes),
    currentStreak,
    bestStreak,
    lastPlayedDate: lastPlayedDate ? toDayStamp(lastPlayedDate) : null
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

export async function recordPuzzleCompletion(
  puzzleId: string,
  elapsedSeconds: number,
  options: { isTodaysDaily: boolean; starRating: 1 | 2 | 3; nowIso?: string }
): Promise<ProgressSnapshot> {
  const nowIso = options.nowIso ?? new Date().toISOString();

  const solvedSet = new Set(await getSolvedIds());
  solvedSet.add(puzzleId);

  const [solvedTimes, previousCount, lastPlayedDate, previousStreak, previousBestStreak, ratings] = await Promise.all([
    getSolvedTimes(),
    getPuzzlesSolvedCount(),
    getLastPlayedDate(),
    getCurrentStreak(),
    getBestStreak(),
    getSolvedRatings()
  ]);

  const existing = solvedTimes[puzzleId];
  solvedTimes[puzzleId] = (typeof existing === 'number' && Number.isFinite(existing))
    ? Math.min(existing, elapsedSeconds)
    : elapsedSeconds;

  // Ratings: store best ever (higher is better)
  const existingRating = ratings[puzzleId];
  ratings[puzzleId] = (typeof existingRating === 'number' && existingRating > options.starRating)
    ? existingRating
    : options.starRating;

  const solvedCount = previousCount + 1;
  let currentStreak = previousStreak;
  let bestStreak = previousBestStreak;

  if (options.isTodaysDaily) {
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

  const bestTimeSec = getBestTimeSec(solvedTimes);

  const writes: Array<Promise<void>> = [
    Preferences.set({ key: SOLVED_IDS_KEY, value: JSON.stringify(Array.from(solvedSet)) }),
    Preferences.set({ key: SOLVED_TIMES_KEY, value: JSON.stringify(solvedTimes) }),
    Preferences.set({ key: PUZZLES_SOLVED_COUNT_KEY, value: String(solvedCount) }),
    Preferences.set({ key: SOLVED_RATINGS_KEY, value: JSON.stringify(ratings) })
  ];

  if (options.isTodaysDaily) {
    writes.push(
      Preferences.set({ key: LAST_PLAYED_DATE_KEY, value: nowIso }),
      Preferences.set({ key: CURRENT_STREAK_KEY, value: String(currentStreak) }),
      Preferences.set({ key: BEST_STREAK_KEY, value: String(bestStreak) })
    );
  }

  await Promise.all(writes);

  return {
    solvedCount,
    bestTimeSec,
    currentStreak,
    bestStreak,
    lastPlayedDate: options.isTodaysDaily ? toDayStamp(nowIso) : (lastPlayedDate ? toDayStamp(lastPlayedDate) : null)
  };
}

export async function resetAllProgress(): Promise<void> {
  await Promise.all(PROGRESS_KEYS.map(key => Preferences.remove({ key })));
  await Preferences.remove({ key: SOLVED_RATINGS_KEY });
  await resetHintData();
}
