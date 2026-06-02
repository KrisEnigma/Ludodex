export type Locale = 'en' | 'es';

export type LocalizedString = {
  en: string;
  es?: string;
};

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Series = {
  id: string;
  part: number;
};

export type RawPuzzle = {
  id: string;
  name: LocalizedString;
  category: string;
  difficulty: Difficulty;
  date: string | null;
  series: Series | null;
  hint: LocalizedString | null;
  filler?: Record<string, string>;
  data: Record<string, string>;
};

export type PuzzlePart = {
  word: string;
  path: string[];
};

export type Answer = {
  display: string;
  parts: PuzzlePart[];
};

export type Puzzle = {
  id: string;
  name: LocalizedString;
  category: string;
  difficulty: Difficulty;
  date: string | null;
  series: Series | null;
  hint: LocalizedString | null;
  grid: Record<string, string>;
  answers: Answer[];
};
