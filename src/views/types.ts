export type WinPayload = {
  puzzleId: string;
  puzzleTitle: string;
  elapsedSeconds: number;
  solvedCount: number;
  currentStreak: number;
  dayNumber: number;
  hintsUsed: number;
  wasPristine: boolean;
  wasNewBest: boolean;
};
