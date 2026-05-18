import { Preferences } from '@capacitor/preferences';

const SOLVED_IDS_KEY = 'solved_ids';
const SOLVED_TIMES_KEY = 'solved_times';
const PUZZLES_SOLVED_COUNT_KEY = 'puzzles_solved_count';
const LAST_PLAYED_DATE_KEY = 'last_played_date';
const CURRENT_STREAK_KEY = 'current_streak';
const BEST_STREAK_KEY = 'best_streak';
const ACTIVE_SKIN_KEY = 'active_skin';

type SolvedTimesMap = Record<string, number>;

export type ProgressSnapshot = {
  solvedCount: number;
  bestTimeSec: number | null;
  currentStreak: number;
  bestStreak: number;
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
  const [solvedCount, solvedTimes, currentStreak, bestStreak] = await Promise.all([
    getPuzzlesSolvedCount(),
    getSolvedTimes(),
    getCurrentStreak(),
    getBestStreak()
  ]);

  return {
    solvedCount,
    bestTimeSec: getBestTimeSec(solvedTimes),
    currentStreak,
    bestStreak
  };
}

export async function recordPuzzleCompletion(
  puzzleId: string,
  elapsedSeconds: number,
  nowIso: string = new Date().toISOString()
): Promise<ProgressSnapshot> {
  const solvedSet = new Set(await getSolvedIds());
  solvedSet.add(puzzleId);

  const [solvedTimes, previousCount, lastPlayedDate, previousStreak, previousBestStreak] = await Promise.all([
    getSolvedTimes(),
    getPuzzlesSolvedCount(),
    getLastPlayedDate(),
    getCurrentStreak(),
    getBestStreak()
  ]);

  solvedTimes[puzzleId] = elapsedSeconds;

  const solvedCount = previousCount + 1;

  const todayStamp = toDayStamp(nowIso);
  const lastStamp = lastPlayedDate ? toDayStamp(lastPlayedDate) : null;

  let currentStreak = 1;
  if (lastStamp) {
    const diff = dayDiff(lastStamp, todayStamp);
    if (diff === 0) {
      currentStreak = Math.max(1, previousStreak);
    } else if (diff === 1) {
      currentStreak = Math.max(1, previousStreak + 1);
    }
  }

  const bestStreak = Math.max(previousBestStreak, currentStreak);
  const bestTimeSec = getBestTimeSec(solvedTimes);

  await Promise.all([
    Preferences.set({ key: SOLVED_IDS_KEY, value: JSON.stringify(Array.from(solvedSet)) }),
    Preferences.set({ key: SOLVED_TIMES_KEY, value: JSON.stringify(solvedTimes) }),
    Preferences.set({ key: PUZZLES_SOLVED_COUNT_KEY, value: String(solvedCount) }),
    Preferences.set({ key: LAST_PLAYED_DATE_KEY, value: nowIso }),
    Preferences.set({ key: CURRENT_STREAK_KEY, value: String(currentStreak) }),
    Preferences.set({ key: BEST_STREAK_KEY, value: String(bestStreak) })
  ]);

  return {
    solvedCount,
    bestTimeSec,
    currentStreak,
    bestStreak
  };
}
