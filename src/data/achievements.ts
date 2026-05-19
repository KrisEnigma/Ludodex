export type AchievementCategory = 'streak' | 'volume' | 'mastery' | 'speed' | 'consistency' | 'variety';

/** Context passed to a real-time achievement check on every non-tutorial solve. */
export type SolveContext = {
  currentStreak: number;
  solvedCount: number;
  pristineCount: number;
  consecutivePristineCount: number;
  archiveSolvesCount: number;
  bestTimeSec: number | null;
  elapsedSeconds: number;
  starRating: 1 | 2 | 3;
  isTodaysDaily: boolean;
  wasNewRating: boolean;
  hourLocal: number;
  dayNumberSolved: number;
  currentDayNumber: number;
};

/** Context passed to a retroactive check on app startup. Snapshot-only; no this-solve metadata. */
export type SnapshotContext = {
  bestStreak: number;
  solvedCount: number;
  pristineCount: number;
  archiveSolvesCount: number;
  bestTimeSec: number | null;
};

export type AchievementDefinition = {
  id: string;
  category: AchievementCategory;
  /** i18n key for the localized name. */
  nameKey: string;
  /** i18n key for the localized description. */
  descriptionKey: string;
  /** Native Game Center ID (filled during operational pass). Null = not yet configured. */
  gameCenterId: string | null;
  /** Native Play Games ID (filled during operational pass). Null = not yet configured. */
  playGamesId: string | null;
  /** Real-time check fired on every non-tutorial solve. */
  checkOnSolve: (ctx: SolveContext) => boolean;
  /** Retroactive check fired on app start. Null = not retroactively earnable (must be earned live). */
  checkRetroactive: ((ctx: SnapshotContext) => boolean) | null;
};

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // ── Streak ───────────────────────────────────────────
  { id: 'streak_1',   category: 'streak', nameKey: 'achievement.streak_1.name',   descriptionKey: 'achievement.streak_1.description',   gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.currentStreak >= 1,   checkRetroactive: (s) => s.bestStreak >= 1 },
  { id: 'streak_3',   category: 'streak', nameKey: 'achievement.streak_3.name',   descriptionKey: 'achievement.streak_3.description',   gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.currentStreak >= 3,   checkRetroactive: (s) => s.bestStreak >= 3 },
  { id: 'streak_7',   category: 'streak', nameKey: 'achievement.streak_7.name',   descriptionKey: 'achievement.streak_7.description',   gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.currentStreak >= 7,   checkRetroactive: (s) => s.bestStreak >= 7 },
  { id: 'streak_14',  category: 'streak', nameKey: 'achievement.streak_14.name',  descriptionKey: 'achievement.streak_14.description',  gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.currentStreak >= 14,  checkRetroactive: (s) => s.bestStreak >= 14 },
  { id: 'streak_30',  category: 'streak', nameKey: 'achievement.streak_30.name',  descriptionKey: 'achievement.streak_30.description',  gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.currentStreak >= 30,  checkRetroactive: (s) => s.bestStreak >= 30 },
  { id: 'streak_60',  category: 'streak', nameKey: 'achievement.streak_60.name',  descriptionKey: 'achievement.streak_60.description',  gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.currentStreak >= 60,  checkRetroactive: (s) => s.bestStreak >= 60 },
  { id: 'streak_100', category: 'streak', nameKey: 'achievement.streak_100.name', descriptionKey: 'achievement.streak_100.description', gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.currentStreak >= 100, checkRetroactive: (s) => s.bestStreak >= 100 },
  { id: 'streak_200', category: 'streak', nameKey: 'achievement.streak_200.name', descriptionKey: 'achievement.streak_200.description', gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.currentStreak >= 200, checkRetroactive: (s) => s.bestStreak >= 200 },
  { id: 'streak_365', category: 'streak', nameKey: 'achievement.streak_365.name', descriptionKey: 'achievement.streak_365.description', gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.currentStreak >= 365, checkRetroactive: (s) => s.bestStreak >= 365 },

  // ── Volume ───────────────────────────────────────────
  { id: 'solve_1',    category: 'volume', nameKey: 'achievement.solve_1.name',    descriptionKey: 'achievement.solve_1.description',    gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.solvedCount >= 1,    checkRetroactive: (s) => s.solvedCount >= 1 },
  { id: 'solve_5',    category: 'volume', nameKey: 'achievement.solve_5.name',    descriptionKey: 'achievement.solve_5.description',    gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.solvedCount >= 5,    checkRetroactive: (s) => s.solvedCount >= 5 },
  { id: 'solve_10',   category: 'volume', nameKey: 'achievement.solve_10.name',   descriptionKey: 'achievement.solve_10.description',   gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.solvedCount >= 10,   checkRetroactive: (s) => s.solvedCount >= 10 },
  { id: 'solve_25',   category: 'volume', nameKey: 'achievement.solve_25.name',   descriptionKey: 'achievement.solve_25.description',   gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.solvedCount >= 25,   checkRetroactive: (s) => s.solvedCount >= 25 },
  { id: 'solve_50',   category: 'volume', nameKey: 'achievement.solve_50.name',   descriptionKey: 'achievement.solve_50.description',   gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.solvedCount >= 50,   checkRetroactive: (s) => s.solvedCount >= 50 },
  { id: 'solve_100',  category: 'volume', nameKey: 'achievement.solve_100.name',  descriptionKey: 'achievement.solve_100.description',  gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.solvedCount >= 100,  checkRetroactive: (s) => s.solvedCount >= 100 },
  { id: 'solve_250',  category: 'volume', nameKey: 'achievement.solve_250.name',  descriptionKey: 'achievement.solve_250.description',  gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.solvedCount >= 250,  checkRetroactive: (s) => s.solvedCount >= 250 },
  { id: 'solve_500',  category: 'volume', nameKey: 'achievement.solve_500.name',  descriptionKey: 'achievement.solve_500.description',  gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.solvedCount >= 500,  checkRetroactive: (s) => s.solvedCount >= 500 },
  { id: 'solve_1000', category: 'volume', nameKey: 'achievement.solve_1000.name', descriptionKey: 'achievement.solve_1000.description', gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.solvedCount >= 1000, checkRetroactive: (s) => s.solvedCount >= 1000 },

  // ── Mastery ──────────────────────────────────────────
  { id: 'pristine_1',          category: 'mastery', nameKey: 'achievement.pristine_1.name',          descriptionKey: 'achievement.pristine_1.description',          gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.pristineCount >= 1,    checkRetroactive: (s) => s.pristineCount >= 1 },
  { id: 'pristine_5',          category: 'mastery', nameKey: 'achievement.pristine_5.name',          descriptionKey: 'achievement.pristine_5.description',          gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.pristineCount >= 5,    checkRetroactive: (s) => s.pristineCount >= 5 },
  { id: 'pristine_10',         category: 'mastery', nameKey: 'achievement.pristine_10.name',         descriptionKey: 'achievement.pristine_10.description',         gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.pristineCount >= 10,   checkRetroactive: (s) => s.pristineCount >= 10 },
  { id: 'pristine_25',         category: 'mastery', nameKey: 'achievement.pristine_25.name',         descriptionKey: 'achievement.pristine_25.description',         gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.pristineCount >= 25,   checkRetroactive: (s) => s.pristineCount >= 25 },
  { id: 'pristine_50',         category: 'mastery', nameKey: 'achievement.pristine_50.name',         descriptionKey: 'achievement.pristine_50.description',         gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.pristineCount >= 50,   checkRetroactive: (s) => s.pristineCount >= 50 },
  { id: 'pristine_100',        category: 'mastery', nameKey: 'achievement.pristine_100.name',        descriptionKey: 'achievement.pristine_100.description',        gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.pristineCount >= 100,  checkRetroactive: (s) => s.pristineCount >= 100 },
  { id: 'pristine_250',        category: 'mastery', nameKey: 'achievement.pristine_250.name',        descriptionKey: 'achievement.pristine_250.description',        gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.pristineCount >= 250,  checkRetroactive: (s) => s.pristineCount >= 250 },
  { id: 'pristine_lightning',  category: 'mastery', nameKey: 'achievement.pristine_lightning.name',  descriptionKey: 'achievement.pristine_lightning.description',  gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.elapsedSeconds < 10 && c.starRating === 3, checkRetroactive: null },

  // ── Speed ────────────────────────────────────────────
  { id: 'speed_60', category: 'speed', nameKey: 'achievement.speed_60.name', descriptionKey: 'achievement.speed_60.description', gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.elapsedSeconds < 60, checkRetroactive: (s) => s.bestTimeSec !== null && s.bestTimeSec < 60 },
  { id: 'speed_30', category: 'speed', nameKey: 'achievement.speed_30.name', descriptionKey: 'achievement.speed_30.description', gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.elapsedSeconds < 30, checkRetroactive: (s) => s.bestTimeSec !== null && s.bestTimeSec < 30 },
  { id: 'speed_20', category: 'speed', nameKey: 'achievement.speed_20.name', descriptionKey: 'achievement.speed_20.description', gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.elapsedSeconds < 20, checkRetroactive: (s) => s.bestTimeSec !== null && s.bestTimeSec < 20 },
  { id: 'speed_15', category: 'speed', nameKey: 'achievement.speed_15.name', descriptionKey: 'achievement.speed_15.description', gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.elapsedSeconds < 15, checkRetroactive: (s) => s.bestTimeSec !== null && s.bestTimeSec < 15 },
  { id: 'speed_10', category: 'speed', nameKey: 'achievement.speed_10.name', descriptionKey: 'achievement.speed_10.description', gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.elapsedSeconds < 10, checkRetroactive: (s) => s.bestTimeSec !== null && s.bestTimeSec < 10 },

  // ── Consistency ──────────────────────────────────────
  { id: 'pristine_streak_3',  category: 'consistency', nameKey: 'achievement.pristine_streak_3.name',  descriptionKey: 'achievement.pristine_streak_3.description',  gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.consecutivePristineCount >= 3,  checkRetroactive: null },
  { id: 'pristine_streak_5',  category: 'consistency', nameKey: 'achievement.pristine_streak_5.name',  descriptionKey: 'achievement.pristine_streak_5.description',  gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.consecutivePristineCount >= 5,  checkRetroactive: null },
  { id: 'pristine_streak_10', category: 'consistency', nameKey: 'achievement.pristine_streak_10.name', descriptionKey: 'achievement.pristine_streak_10.description', gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.consecutivePristineCount >= 10, checkRetroactive: null },

  // ── Variety ──────────────────────────────────────────
  { id: 'night_owl',    category: 'variety', nameKey: 'achievement.night_owl.name',    descriptionKey: 'achievement.night_owl.description',    gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.hourLocal >= 22 || c.hourLocal < 3, checkRetroactive: null },
  { id: 'early_bird',   category: 'variety', nameKey: 'achievement.early_bird.name',   descriptionKey: 'achievement.early_bird.description',   gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.hourLocal >= 5 && c.hourLocal < 8,  checkRetroactive: null },
  { id: 'archive_5',    category: 'variety', nameKey: 'achievement.archive_5.name',    descriptionKey: 'achievement.archive_5.description',    gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.archiveSolvesCount >= 5,  checkRetroactive: (s) => s.archiveSolvesCount >= 5 },
  { id: 'archive_25',   category: 'variety', nameKey: 'achievement.archive_25.name',   descriptionKey: 'achievement.archive_25.description',   gameCenterId: null, playGamesId: null, checkOnSolve: (c) => c.archiveSolvesCount >= 25, checkRetroactive: (s) => s.archiveSolvesCount >= 25 },
  { id: 'time_capsule', category: 'variety', nameKey: 'achievement.time_capsule.name', descriptionKey: 'achievement.time_capsule.description', gameCenterId: null, playGamesId: null, checkOnSolve: (c) => !c.isTodaysDaily && (c.currentDayNumber - c.dayNumberSolved >= 30), checkRetroactive: null }
];
