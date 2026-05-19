export type WinPayload = {
  puzzleId: string;
  puzzleTitle: string;
  elapsedSeconds: number;
  solvedCount: number;
  currentStreak: number;
  dayNumber: number;
  hintsUsed: number;
  isTodaysDaily: boolean;
  starRating: 1 | 2 | 3;
  wasNewBest: boolean;
  wasNewRating: boolean;
};
