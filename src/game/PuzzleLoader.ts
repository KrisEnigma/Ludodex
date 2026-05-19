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

export function ensureBundledPuzzlesLoaded(): Puzzle[] {
  if (parsedPuzzles.length > 0) {
    return parsedPuzzles;
  }

  const bundledRaw = rawPuzzles as unknown as RawPuzzle[];
  parsedPuzzles = parseRawPuzzles(bundledRaw);
  puzzleSource = 'bundled';
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
  const controller = new AbortController();
  const timeoutMs = 1800;
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(REMOTE_PUZZLES_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      signal: controller.signal
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
  } finally {
    window.clearTimeout(timeoutId);
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

  return getPuzzleAtIndex(getDailyPuzzleIndex(puzzles), puzzles);
}

export function getDailyPuzzleIndex(puzzles = parsedPuzzles): number {
  if (puzzles.length === 0) {
    throw new Error('No puzzles loaded. Call loadPuzzles() first.');
  }

  const todayDate = toLocalDateString(new Date());
  const datedIndex = puzzles.findIndex((puzzle) => puzzle.date === todayDate);
  if (datedIndex >= 0) {
    return datedIndex;
  }

  const rotationIndices = getRotationIndices(puzzles);

  if (rotationIndices.length === 0) {
    return 0;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayIndex = Math.floor(
    (today.getTime() - LAUNCH_DATE.getTime()) / 86400000
  );

  const poolIndex = ((dayIndex % rotationIndices.length) + rotationIndices.length) % rotationIndices.length;
  return rotationIndices[poolIndex];
}

export function getPuzzleForDay(
  dayNumber: number,
  puzzles: Puzzle[] = parsedPuzzles
): { puzzle: Puzzle; index: number } | null {
  if (dayNumber < 1) return null;
  if (puzzles.length === 0) return null;

  const targetDate = getDateForDayNumber(dayNumber);
  const targetDateString = toLocalDateString(targetDate);
  const datedIndex = puzzles.findIndex((puzzle) => puzzle.date === targetDateString);
  if (datedIndex >= 0) {
    return { puzzle: puzzles[datedIndex], index: datedIndex };
  }

  const rotationIndices = getRotationIndices(puzzles);
  if (rotationIndices.length === 0) return null;

  const poolIndex = (dayNumber - 1) % rotationIndices.length;
  const puzzleIndex = rotationIndices[poolIndex];
  const puzzle = puzzles[puzzleIndex];
  if (!puzzle) return null;

  return { puzzle, index: puzzleIndex };
}

export function getDayNumberSinceLaunch(now: Date = new Date()): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const launch = new Date(LAUNCH_DATE);
  launch.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - launch.getTime()) / 86400000);
  return Math.max(1, days + 1);
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRotationIndices(puzzles: Puzzle[]): number[] {
  return puzzles
    .map((puzzle, index) => ({ puzzle, index }))
    .filter(({ puzzle }) => puzzle.date === null)
    .map(({ index }) => index);
}

function getDateForDayNumber(dayNumber: number): Date {
  const date = new Date(LAUNCH_DATE);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + (dayNumber - 1));
  return date;
}
