/**
 * Puzzle codec — encode a puzzle into a URL-safe token and decode (+validate)
 * it back. Powers shareable preview links (`/p/<token>`): "test in game" from
 * the editor and sending a specific puzzle to a tester. No server involved —
 * the whole puzzle rides in the URL.
 *
 * SECURITY: a token comes from an untrusted URL, so `decodePuzzleToken` fully
 * validates the decoded object before returning it. It returns `null` on
 * anything malformed; callers must treat null as "no puzzle". The game renders
 * letters/titles via textContent (never innerHTML), so the remaining risk is
 * malformed data — bounded here.
 */

import type { Difficulty, RawPuzzle } from '../types/puzzle';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

// 4x4 board → valid cell coords are columns a–d, rows 1–4 (e.g. "a1", "d4").
const COORD_RE = /^[a-d][1-4]$/;
const MAX_WORDS = 24;
const MAX_TOKEN_LEN = 4096; // generous ceiling; a real puzzle is well under this.

// ── base64url (UTF-8 safe) ──────────────────────────────────────────────────

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(token: string): string | null {
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

// ── encode ──────────────────────────────────────────────────────────────────

export function encodePuzzleToken(raw: RawPuzzle): string {
  return toBase64Url(JSON.stringify(raw));
}

// ── decode + validate ─────────────────────────────────────────────────────

function isStr(v: unknown): v is string {
  return typeof v === 'string';
}

/** Coerce an unknown into a LocalizedString, or null if it isn't usable. */
function asLocalized(v: unknown): { en: string; es?: string } | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!isStr(o.en)) return null;
  return isStr(o.es) ? { en: o.en, es: o.es } : { en: o.en };
}

/**
 * Decode a token into a validated RawPuzzle, or null if anything is off.
 * Unknown/extra fields are dropped — only the known schema is reconstructed.
 */
export function decodePuzzleToken(token: string): RawPuzzle | null {
  if (!token || token.length > MAX_TOKEN_LEN || !/^[A-Za-z0-9\-_]+$/.test(token)) {
    return null;
  }

  const json = fromBase64Url(token);
  if (json === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;

  // name is required (used as the title); everything else has a safe default.
  const name = asLocalized(o.name);
  if (!name) return null;

  // data: word(display) → path string ("a1b1c1…"). Validate every coord.
  if (!o.data || typeof o.data !== 'object') return null;
  const rawData = o.data as Record<string, unknown>;
  const entries = Object.entries(rawData);
  if (entries.length === 0 || entries.length > MAX_WORDS) return null;

  const data: Record<string, string> = {};
  for (const [display, pathVal] of entries) {
    if (!display || !isStr(pathVal)) return null;
    const path = pathVal;
    // Path is a flat concatenation of 2-char coords, so length must be even.
    if (path.length === 0 || path.length % 2 !== 0) return null;
    const coords = path.match(/.{2}/g) ?? [];
    for (const c of coords) {
      if (!COORD_RE.test(c)) return null;
    }
    data[display] = path;
  }

  const difficulty: Difficulty =
    isStr(o.difficulty) && (DIFFICULTIES as string[]).includes(o.difficulty)
      ? (o.difficulty as Difficulty)
      : 'medium';

  return {
    id: isStr(o.id) && o.id ? o.id : 'preview',
    name,
    category: isStr(o.category) ? o.category : '',
    difficulty,
    date: isStr(o.date) ? o.date : null,
    series: null, // previews are standalone; never carry series linkage
    hint: asLocalized(o.hint),
    data
  };
}
