import rawPuzzles from '../data/puzzles.json';
import { Preferences } from '@capacitor/preferences';
import type { Puzzle, RawPuzzle } from '../types/puzzle';
import { parsePuzzle } from './PuzzleParser';

const LAUNCH_DATE = new Date('2025-01-01T00:00:00');
const REMOTE_PUZZLES_URL = 'https://cdn.glitchsalad.app/puzzles.json';
const PUZZLES_REMOTE_KEY = 'puzzles_remote';

let parsedPuzzles: Puzzle[] = [];
let puzzleSource: 'remote' | 'cache' | 'bundled' = 'bundled';

export async function loadPuzzles(): Promise<Puzzle[]> {
  const bundledRaw = rawPuzzles as unknown as RawPuzzle[];

  let selectedRaw: RawPuzzle[] | null = null;

  const remoteRaw = await fetchRemoteRawPuzzles();
  if (remoteRaw) {
    selectedRaw = remoteRaw;
    puzzleSource = 'remote';
    await cacheRemoteRawPuzzles(remoteRaw);
  } else {
    const cachedRaw = await getCachedRemoteRawPuzzles();
    if (cachedRaw) {
      selectedRaw = cachedRaw;
      puzzleSource = 'cache';
    }
  }

  if (!selectedRaw) {
    selectedRaw = bundledRaw;
    puzzleSource = 'bundled';
  }

  try {
    parsedPuzzles = parseRawPuzzles(selectedRaw);
  } catch (error) {
    console.warn('Failed to parse selected puzzle source, falling back to bundled puzzles', error);
    puzzleSource = 'bundled';
    parsedPuzzles = parseRawPuzzles(bundledRaw);
  }

  return parsedPuzzles;
}

export function getLoadedPuzzleSource(): 'remote' | 'cache' | 'bundled' {
  return puzzleSource;
}

function parseRawPuzzles(raw: RawPuzzle[]): Puzzle[] {
  const parsed = raw.map(parsePuzzle);
  if (parsed.length === 0) {
    throw new Error('Puzzle source was empty');
  }
  return parsed;
}

async function fetchRemoteRawPuzzles(): Promise<RawPuzzle[] | null> {
  try {
    const response = await fetch(REMOTE_PUZZLES_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return null;
    }

    return data as RawPuzzle[];
  } catch {
    return null;
  }
}

async function cacheRemoteRawPuzzles(raw: RawPuzzle[]): Promise<void> {
  try {
    await Preferences.set({
      key: PUZZLES_REMOTE_KEY,
      value: JSON.stringify(raw)
    });
  } catch (error) {
    console.warn('Failed to cache remote puzzles', error);
  }
}

async function getCachedRemoteRawPuzzles(): Promise<RawPuzzle[] | null> {
  try {
    const { value } = await Preferences.get({ key: PUZZLES_REMOTE_KEY });
    if (!value) return null;

    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as RawPuzzle[];
  } catch {
    return null;
  }
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
