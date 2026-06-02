export type WinPayload = {
  puzzleId: string;
  puzzleTitle: string;
  elapsedSeconds: number;
  solvedCount: number;
  currentStreak: number;
  dayNumber: number;
  hintsUsed: number;
  mistakes: number;
  isTodaysDaily: boolean;
  starRating: 1 | 2 | 3;
  wasNewBest: boolean;
  wasNewRating: boolean;
  /** Achievement IDs unlocked by the solve that produced this WinPayload. */
  unlockedAchievements: string[];
  /** True if a streak freeze token was auto-consumed to cover a missed day this solve. */
  freezeUsed: boolean;
};
