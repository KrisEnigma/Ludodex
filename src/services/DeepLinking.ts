/**
 * Deep-linking helpers.
 *
 * Handles parsing inbound URLs (web boot, native appUrlOpen) into an initial
 * route, and computing the path segment for outbound URLs (history.pushState,
 * share text).
 *
 * URL shape: `{VITE_SHARE_BASE_URL}/{dayNumber}` — e.g. `https://ludodex.krisenigma.com/123`.
 *   - `/` (or no path) → menu
 *   - `/N` where N is a positive integer → puzzle for day N
 *   - Anything else → menu (graceful fallback, no error toast)
 *
 * Out-of-archive handling: web players cap at WEB_FREE_DAYS (= 7, see
 * ArchiveView.ts). When an inbound URL targets a puzzle older than that
 * on web, we send the player to the archive view instead of silently
 * dropping them on today's puzzle — the archive view already renders a
 * "install the app" gate for locked rows.
 */

import { getMonetizationContext } from './MonetizationContext';
import { getDayNumberSinceLaunch, getPuzzleForDay, parseRawPuzzleToPuzzle } from '../game/PuzzleLoader';
import { decodePuzzleToken } from './PuzzleCodec';
import type { Puzzle } from '../types/puzzle';

/** Must match the constant in ArchiveView.ts. */
const WEB_FREE_DAYS = 7;

export type ParsedDeepLink =
  | { kind: 'menu' }
  | { kind: 'puzzle'; puzzle: Puzzle; dayNumber: number; isTodaysDaily: boolean }
  | { kind: 'archive-locked'; dayNumber: number }
  | { kind: 'preview-puzzle'; puzzle: Puzzle; token: string };

/**
 * Parse a URL path (e.g. `/123`, `/`, `/menu`) into a deep-link intent.
 * Pure function — does not touch window.location or invoke router methods.
 */
export function parseDeepLinkPath(pathname: string): ParsedDeepLink {
  // Strip leading/trailing slashes and split.
  const trimmed = pathname.replace(/^\/+|\/+$/g, '');

  // Root → menu.
  if (trimmed === '') return { kind: 'menu' };

  const segments = trimmed.split('/');
  const firstSegment = segments[0];

  // Preview link: `/p/<token>` carries a whole puzzle encoded in the URL
  // (editor "test in game" / share-to-tester). Decode + validate; any failure
  // falls through to menu. Preview puzzles are standalone and never persist
  // (see GameView isPreview).
  if (firstSegment === 'p' && segments[1]) {
    const raw = decodePuzzleToken(segments[1]);
    if (!raw) return { kind: 'menu' };
    const puzzle = parseRawPuzzleToPuzzle(raw);
    if (!puzzle) return { kind: 'menu' };
    return { kind: 'preview-puzzle', puzzle, token: segments[1] };
  }

  // Try to parse as a positive integer day number.
  if (!/^\d+$/.test(firstSegment)) return { kind: 'menu' };
  const dayNumber = parseInt(firstSegment, 10);
  if (!Number.isFinite(dayNumber) || dayNumber < 1) return { kind: 'menu' };

  // Bound check: don't allow navigating to a future puzzle.
  const today = getDayNumberSinceLaunch();
  if (dayNumber > today) return { kind: 'menu' };

  // Try to resolve the puzzle.
  const entry = getPuzzleForDay(dayNumber);
  if (!entry) return { kind: 'menu' };

  const isTodaysDaily = dayNumber === today;

  // Out-of-archive gate for web players.
  // Native players can play any archived puzzle freely.
  // Web players can only play within the WEB_FREE_DAYS window.
  const ctx = getMonetizationContext();
  if (!ctx.isNative && !isTodaysDaily) {
    const oldestPlayableDay = today - WEB_FREE_DAYS;
    if (dayNumber < oldestPlayableDay) {
      return { kind: 'archive-locked', dayNumber };
    }
  }

  return { kind: 'puzzle', puzzle: entry.puzzle, dayNumber, isTodaysDaily };
}

/**
 * Parse the current window.location into a deep-link intent.
 */
export function parseCurrentUrl(): ParsedDeepLink {
  return parseDeepLinkPath(window.location.pathname);
}

/**
 * Parse a full URL (e.g. from Capacitor appUrlOpen) into a deep-link intent.
 * Strips host and protocol; only the path matters.
 */
export function parseDeepLinkUrl(url: string): ParsedDeepLink {
  try {
    const parsed = new URL(url);
    return parseDeepLinkPath(parsed.pathname);
  } catch {
    // Not a parseable URL; treat as menu.
    return { kind: 'menu' };
  }
}

/**
 * Compute the path segment for a given route. Returns null if the route
 * doesn't have a meaningful path (overlays like settings, archive, etc.
 * don't change the URL).
 *
 * Used by Router to keep the URL bar in sync with the current view.
 */
export function pathForRoute(routeName: string, payload: unknown): string | null {
  if (routeName === 'menu') return '/';
  if (routeName === 'game') {
    const p = payload as { dayNumber?: number; isPreview?: boolean; previewToken?: string } | undefined;
    // Preview games keep their `/p/<token>` URL so the address bar stays
    // shareable and a refresh reloads the same encoded puzzle.
    if (p?.isPreview && p.previewToken) {
      return `/p/${p.previewToken}`;
    }
    if (typeof p?.dayNumber === 'number' && p.dayNumber >= 1) {
      return `/${p.dayNumber}`;
    }
    return null;
  }
  if (routeName === 'win') {
    // Win is a celebration screen for a puzzle the player just solved.
    // Keep the puzzle number in the URL so a refresh lands them back on it.
    const p = payload as { dayNumber?: number } | undefined;
    if (typeof p?.dayNumber === 'number' && p.dayNumber >= 1) {
      return `/${p.dayNumber}`;
    }
    return null;
  }
  // Overlay routes (settings, archive, how-to-play, achievements) don't
  // get their own URL — they're transient and not meant to be linkable.
  return null;
}
