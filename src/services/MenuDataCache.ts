/**
 * Stale-while-revalidate cache for MenuView's async data.
 *
 * `getMenuData()` returns the last fetched snapshot immediately (if any), while
 * always kicking off a fresh fetch in the background. This makes re-navigation
 * to the menu feel instant — the stats strip renders with the cached values and
 * silently updates when fresher data arrives while the view is still mounted.
 *
 * Call `invalidateMenuCache()` after recording a puzzle completion so the next
 * menu open forces a foreground fetch instead of returning stale data.
 */

import {
  getProgressSnapshot,
  getSolvedIds,
  getSolvedRatings,
  getSolvedTimes,
  getStreakStatus,
  type StreakStatus
} from './ProgressService';

export type MenuData = {
  snapshot: Awaited<ReturnType<typeof getProgressSnapshot>>;
  solvedIds: string[];
  solvedTimes: Record<string, number | undefined>;
  solvedRatings: Record<string, number | undefined>;
  streakStatus: StreakStatus;
};

let cache: MenuData | null = null;
let inFlight: Promise<MenuData> | null = null;

function fetchFresh(): Promise<MenuData> {
  // Deduplicate concurrent calls — only one network round-trip at a time.
  if (inFlight) return inFlight;

  inFlight = Promise.all([
    getProgressSnapshot(),
    getSolvedIds(),
    getSolvedTimes(),
    getSolvedRatings(),
    getStreakStatus()
  ]).then(([snapshot, solvedIds, solvedTimes, solvedRatings, streakStatus]) => {
    const data: MenuData = { snapshot, solvedIds, solvedTimes, solvedRatings, streakStatus };
    cache = data;
    inFlight = null;
    return data;
  }).catch((err) => {
    inFlight = null;
    throw err;
  });

  return inFlight;
}

/**
 * Returns cached data immediately (if available) and always starts a background
 * refresh. Callers should update their UI if fresh data arrives while still
 * mounted (check `root.isConnected` before mutating DOM).
 */
export function getMenuData(): Promise<MenuData> {
  // Fire a background refresh unconditionally.
  void fetchFresh();
  // Serve cached data right away if we have it; otherwise wait for the fetch.
  return cache !== null ? Promise.resolve(cache) : fetchFresh();
}

/**
 * Drop the cache. Call this after recording a puzzle solve so the next menu
 * open reflects the new solved state without showing stale data.
 */
export function invalidateMenuCache(): void {
  cache = null;
}
