import rawPuzzles from '../data/puzzles.json';
import type { Puzzle, RawPuzzle } from '../types/puzzle';
import { parsePuzzle } from './PuzzleParser';

const LAUNCH_DATE = new Date('2025-01-01T00:00:00');

let parsedPuzzles: Puzzle[] = [];

export async function loadPuzzles(): Promise<Puzzle[]> {
  parsedPuzzles = (rawPuzzles as unknown as RawPuzzle[]).map(parsePuzzle);
  return parsedPuzzles;
}

export function getPuzzleCount(puzzles = parsedPuzzles): number {
  return puzzles.length;
}

export function getPuzzleAtIndex(index: number, puzzles = parsedPuzzles): Puzzle {
  if (puzzles.length === 0) {
    throw new Error('No puzzles loaded. Call loadPuzzles() first.');
  }

  const normalized = ((index % puzzles.length) + puzzles.length) % puzzles.length;
  return puzzles[normalized];
}

export function getDailyPuzzle(puzzles = parsedPuzzles): Puzzle {
  if (puzzles.length === 0) {
    throw new Error('No puzzles loaded. Call loadPuzzles() first.');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayIndex = Math.floor(
    (today.getTime() - LAUNCH_DATE.getTime()) / 86400000
  );

  return puzzles[dayIndex % puzzles.length];
}

export function getDailyPuzzleIndex(puzzles = parsedPuzzles): number {
  if (puzzles.length === 0) {
    throw new Error('No puzzles loaded. Call loadPuzzles() first.');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayIndex = Math.floor(
    (today.getTime() - LAUNCH_DATE.getTime()) / 86400000
  );

  return dayIndex % puzzles.length;
}
