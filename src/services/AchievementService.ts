import { Preferences } from '@capacitor/preferences';
import { ACHIEVEMENTS, type SnapshotContext, type SolveContext } from '../data/achievements';
import { track } from './AnalyticsService';
import { getMonetizationContext } from './MonetizationContext';

const EARNED_KEY = 'ludodex.achievements_earned';

export type EarnedRecord = {
  id: string;
  earnedAt: string; // ISO timestamp
};

async function readEarned(): Promise<EarnedRecord[]> {
  const { value } = await Preferences.get({ key: EARNED_KEY });
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is EarnedRecord =>
      typeof entry === 'object' && entry !== null &&
      typeof (entry as Record<string, unknown>).id === 'string' &&
      typeof (entry as Record<string, unknown>).earnedAt === 'string'
    );
  } catch {
    return [];
  }
}

async function writeEarned(records: EarnedRecord[]): Promise<void> {
  await Preferences.set({ key: EARNED_KEY, value: JSON.stringify(records) });
}

export async function getEarnedAchievements(): Promise<EarnedRecord[]> {
  return readEarned();
}

export async function isEarned(id: string): Promise<boolean> {
  const earned = await readEarned();
  return earned.some((r) => r.id === id);
}

/**
 * Real-time detection. Called after `recordPuzzleCompletion` for every non-tutorial solve.
 * Returns IDs of achievements newly unlocked by this solve (for toast rendering).
 * Persists the unlock and fires the native unlock stub.
 */
export async function detectAndUnlockAchievements(ctx: SolveContext): Promise<string[]> {
  const earned = await readEarned();
  const earnedIds = new Set(earned.map((r) => r.id));
  const newlyUnlocked: string[] = [];
  const now = new Date().toISOString();

  for (const def of ACHIEVEMENTS) {
    if (earnedIds.has(def.id)) continue;
    if (!def.checkOnSolve(ctx)) continue;
    earned.push({ id: def.id, earnedAt: now });
    earnedIds.add(def.id);
    newlyUnlocked.push(def.id);
    track('achievement_unlocked', {
      achievement_id: def.id,
      category: def.category,
      current_streak: ctx.currentStreak,
      solved_count: ctx.solvedCount,
      pristine_count: ctx.pristineCount
    });
    void unlockNative(def.id);
  }

  if (newlyUnlocked.length > 0) {
    await writeEarned(earned);
  }

  return newlyUnlocked;
}

/**
 * Retroactive scan. Called on app startup. Silently unlocks any achievement whose
 * snapshot-based criteria are currently met. No toast — these are catch-up unlocks
 * for players who upgraded from a version before the system existed.
 */
export async function retroactivelyUnlockEarnedAchievements(ctx: SnapshotContext): Promise<void> {
  const earned = await readEarned();
  const earnedIds = new Set(earned.map((r) => r.id));
  const now = new Date().toISOString();
  let added = false;

  for (const def of ACHIEVEMENTS) {
    if (earnedIds.has(def.id)) continue;
    if (def.checkRetroactive === null) continue;
    if (!def.checkRetroactive(ctx)) continue;
    earned.push({ id: def.id, earnedAt: now });
    earnedIds.add(def.id);
    added = true;
    void unlockNative(def.id);
  }

  if (added) {
    await writeEarned(earned);
  }
}

/**
 * Clears all earned achievements locally. Called from `resetAllProgress`.
 * Does NOT clear native achievements — the player can do that from system settings.
 */
export async function resetEarnedAchievements(): Promise<void> {
  await Preferences.remove({ key: EARNED_KEY });
}

/**
 * Stub for native unlock. Fires alongside local storage so that when the operational
 * pass wires Game Center / Play Games, the call site is already in place.
 *
 * No-ops on web and on native-without-plugin. Failures are swallowed because native
 * achievements are non-critical — the local record is the source of truth.
 */
async function unlockNative(achievementId: string): Promise<void> {
  const ctx = getMonetizationContext();
  if (!ctx.isNative) return;

  // TODO(native): wire @openforge/capacitor-game-connect (or chosen plugin) here.
  //   const def = ACHIEVEMENTS.find((d) => d.id === achievementId);
  //   if (!def) return;
  //   try {
  //     if (ctx.platform === 'ios' && def.gameCenterId) {
  //       await GameConnect.submitAchievement({ achievementID: def.gameCenterId, percentComplete: 100 });
  //     } else if (ctx.platform === 'android' && def.playGamesId) {
  //       await GameConnect.unlockAchievement({ achievementID: def.playGamesId });
  //     }
  //   } catch {
  //     // Native achievement unlock is best-effort; local persistence is authoritative.
  //   }
  void achievementId;
}
