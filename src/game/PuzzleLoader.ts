import rawPuzzles from '../data/puzzles.json';
import { Preferences } from '@capacitor/preferences';
import type { Puzzle, RawPuzzle } from '../types/puzzle';
import { parsePuzzle } from './PuzzleParser';

/**
 * Daily puzzle releases at device-local midnight, the same model used by Wordle,
 * NYT Connections, Mini, and Strands. The puzzle becomes available the moment the
 * calendar date rolls over in the player's timezone. Streak math and the WinView /
 * Menu countdown timers are anchored to the same boundary.
 *
 * Players who want a morning ritual should rely on the daily notification (default
 * 9:00 local, configurable in future Settings additions) rather than a non-midnight
 * release time. See AGENTS.md or the design discussion for the full rationale.
 */
/**
 * Day-1 anchor for the daily sequence (device-local midnight). Public launch is
 * 2026-06-29; the anchor is set 7 days earlier so launch day computes to day 8,
 * which leaves a 7-puzzle starter archive available on launch. Override with
 * VITE_LAUNCH_DATE (YYYY-MM-DD) to move the launch without a code change; the
 * default below is used if it's unset or unparseable.
 */
const LAUNCH_DATE = (() => {
  const raw = import.meta.env.VITE_LAUNCH_DATE?.trim();
  if (raw) {
    const parsed = new Date(`${raw}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date('2026-06-22T00:00:00');
})();

/**
 * DEV-only override of "today's" day number, for testing the daily + archive
 * without waiting real days. Set `?day=N` in the URL or
 * `localStorage['ludodex.devday'] = 'N'`. Compiled out of production builds
 * (import.meta.env.DEV is false there), so it can't be used to peek at future
 * puzzles in the shipped app.
 */
function getDevDayOverride(): number | null {
  if (!import.meta.env.DEV) return null;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('day');
    const value = fromUrl ?? window.localStorage.getItem('ludodex.devday');
    if (value && /^\d+$/.test(value)) return Math.max(1, parseInt(value, 10));
  } catch {
    // window/localStorage unavailable — ignore.
  }
  return null;
}

/**
 * Remote puzzle catalog. The editor saves the catalog to `PUT /api/puzzles`
 * (Worker → R2) on the app's own domain, and the game reads it back from the
 * same place by default — derived from VITE_SHARE_BASE_URL so there's a single
 * source of truth for the domain. Set VITE_PUZZLES_URL to override (e.g. a CDN).
 * The GET is public, read-only game content; the authenticated PUT stays in the
 * editor. fetchRemoteRawPuzzles + loadPuzzles fall back to cache then the
 * bundled set on any failure, so a bad/empty response can't break startup.
 */
const REMOTE_PUZZLES_URL = (() => {
  const explicit = import.meta.env.VITE_PUZZLES_URL?.trim();
  if (explicit) return explicit;
  const base = import.meta.env.VITE_SHARE_BASE_URL?.trim();
  if (base) return `${base.replace(/\/+$/, '')}/api/puzzles`;
  return 'https://ludodex.krisenigma.com/api/puzzles';
})();
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

/**
 * Parse a single RawPuzzle (e.g. decoded from a preview link) into a Puzzle
 * using the exact same transform as bundled/remote puzzles. Returns null if
 * the raw puzzle can't be parsed, so callers can fall back gracefully.
 */
export function parseRawPuzzleToPuzzle(raw: RawPuzzle): Puzzle | null {
  try {
    const [puzzle] = parseRawPuzzles([raw]);
    return puzzle ?? null;
  } catch {
    return null;
  }
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

export function getPuzzleById(
  puzzleId: string,
  puzzles: Puzzle[] = parsedPuzzles
): Puzzle | null {
  return puzzles.find((p) => p.id === puzzleId) ?? null;
}

/**
 * Returns the puzzle for today, or null if the catalog has been exhausted.
 * Puzzles are served positionally: day 1 → index 0, day 2 → index 1, etc.
 * A puzzle with an explicit `date` field matching today is served first regardless
 * of its position — this lets individual entries be pinned to a calendar date
 * without breaking the overall sequence.
 */
export function getDailyPuzzle(puzzles = parsedPuzzles): Puzzle | null {
  if (puzzles.length === 0) return null;
  const idx = getDailyPuzzleIndex(puzzles);
  if (idx < 0 || idx >= puzzles.length) return null;
  return puzzles[idx] ?? null;
}

/**
 * Returns the array index of today's puzzle, or -1 if no puzzle is available today.
 * -1 means the catalog is exhausted for this day number — callers must handle null.
 */
export function getDailyPuzzleIndex(puzzles = parsedPuzzles): number {
  if (puzzles.length === 0) {
    throw new Error('No puzzles loaded. Call loadPuzzles() first.');
  }

  // Explicit date-mapped puzzle takes priority.
  const todayDate = toLocalDateString(new Date());
  const datedIndex = puzzles.findIndex((puzzle) => puzzle.date === todayDate);
  if (datedIndex >= 0) return datedIndex;

  // Positional: derive from the day number so the DEV override (and the launch
  // anchor) flow through consistently. Day number is 1-based; index is 0-based.
  const dayIndex = getDayNumberSinceLaunch() - 1;

  if (dayIndex < 0 || dayIndex >= puzzles.length) return -1;
  return dayIndex;
}

/**
 * Returns the puzzle for a given 1-based day number, or null if that day is
 * beyond the current catalog. Puzzles never repeat — once the catalog is
 * exhausted, subsequent day numbers return null.
 */
export function getPuzzleForDay(
  dayNumber: number,
  puzzles: Puzzle[] = parsedPuzzles
): { puzzle: Puzzle; index: number } | null {
  if (dayNumber < 1) return null;
  if (puzzles.length === 0) return null;

  // Explicit date-mapped puzzle takes priority.
  const targetDate = getDateForDayNumber(dayNumber);
  const targetDateString = toLocalDateString(targetDate);
  const datedIndex = puzzles.findIndex((puzzle) => puzzle.date === targetDateString);
  if (datedIndex >= 0) {
    return { puzzle: puzzles[datedIndex], index: datedIndex };
  }

  // Positional — no modular wrap. Return null when out of catalog range.
  const idx = dayNumber - 1;
  if (idx >= puzzles.length) return null;
  const puzzle = puzzles[idx];
  if (!puzzle) return null;

  return { puzzle, index: idx };
}

export function getDayNumberSinceLaunch(now: Date = new Date()): number {
  const override = getDevDayOverride();
  if (override !== null) return override;

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
