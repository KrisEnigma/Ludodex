import { parsePuzzle } from './game/PuzzleParser';
import type { RawPuzzle } from './types/puzzle';

const PUZZLES_KEY = 'puzzles.json';
// Every write first copies the current catalog here, so a bad save can be
// rolled back from the R2 dashboard.
const HISTORY_PREFIX = 'history/puzzles-';
// Current catalog is a few KB; 2 MB leaves room for ~thousands of puzzles.
const MAX_BODY_BYTES = 2_000_000;

// CORS is for READS only: the native app (capacitor://localhost etc.) fetches
// the catalog cross-origin. Writes come from the editor on this same origin
// (or via the Vite dev proxy), so PUT/DELETE deliberately send no CORS
// headers — other websites can't write even with a leaked token in a browser.
const READ_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
  'Access-Control-Expose-Headers': 'ETag',
} as const;

type Env = {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  PUZZLE_BUCKET: {
    get(key: string): Promise<{
      body: BodyInit | null;
      etag?: string;
      httpEtag?: string;
      customMetadata?: Record<string, string>;
      json<T = unknown>(): Promise<T>;
      text(): Promise<string>;
    } | null>;
    put(key: string, value: string, options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    }): Promise<unknown>;
  };
  API_SECRET?: string;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Constant-time bearer check (Workers' crypto.subtle.timingSafeEqual). */
function tokenMatches(authHeader: string, secret: string | undefined): boolean {
  if (!secret || !authHeader.startsWith('Bearer ')) return false;
  const enc = new TextEncoder();
  const provided = enc.encode(authHeader.slice(7));
  const expected = enc.encode(secret);
  const subtle = crypto.subtle as unknown as {
    timingSafeEqual(a: ArrayBufferView, b: ArrayBufferView): boolean;
  };
  if (provided.byteLength !== expected.byteLength) {
    subtle.timingSafeEqual(expected, expected); // keep timing independent of length
    return false;
  }
  return subtle.timingSafeEqual(provided, expected);
}

/**
 * Structural validation only — the same parser the game uses. Editorial
 * checks (name, category, Spanish) live in scripts/validate-puzzles.ts,
 * because the editor saves in-progress levels (empty name/category/data).
 */
function validateCatalog(parsed: unknown): string[] {
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return ['Payload must be a non-empty JSON array'];
  }
  const errors: string[] = [];
  const seen = new Set<string>();
  parsed.forEach((item, i) => {
    const tag = `#${i}`;
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      errors.push(`${tag}: not an object`);
      return;
    }
    const p = item as Partial<RawPuzzle>;
    if (typeof p.id !== 'string' || p.id.trim() === '') {
      errors.push(`${tag}: missing id`);
      return;
    }
    if (seen.has(p.id)) errors.push(`${tag} (${p.id}): duplicate id`);
    seen.add(p.id);
    if (typeof p.data !== 'object' || p.data === null || Array.isArray(p.data)) {
      errors.push(`${tag} (${p.id}): "data" must be an object`);
      return;
    }
    try {
      parsePuzzle(p as RawPuzzle);
    } catch (e) {
      errors.push(`${tag} (${p.id}): ${e instanceof Error ? e.message : String(e)}`);
    }
  });
  return errors;
}

async function snapshotCurrent(env: Env): Promise<void> {
  const current = await env.PUZZLE_BUCKET.get(PUZZLES_KEY);
  if (!current) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = crypto.randomUUID().slice(0, 8); // never overwrite a same-ms snapshot
  await env.PUZZLE_BUCKET.put(`${HISTORY_PREFIX}${stamp}-${suffix}.json`, await current.text(), {
    httpMetadata: { contentType: 'application/json' },
  });
}

function err(message: string, status: number, code?: string): Response {
  return json({ error: message, ...(code ? { code } : {}) }, status);
}

function quoteEtag(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '"puzzles-empty"';
  if (trimmed.startsWith('W/"') || trimmed.startsWith('"')) return trimmed;
  return `"${trimmed}"`;
}

function getObjectEtag(
  obj: { etag?: string; httpEtag?: string; customMetadata?: Record<string, string> }
): string {
  if (obj.httpEtag) return quoteEtag(obj.httpEtag);
  if (obj.etag) return quoteEtag(obj.etag);
  const fallback = obj.customMetadata?.updatedAt;
  if (fallback) return quoteEtag(fallback);
  return '"puzzles-unknown"';
}

function etagMatches(ifNoneMatch: string | null, currentEtag: string): boolean {
  if (!ifNoneMatch) return false;
  const normalizedCurrent = currentEtag.replace(/^W\//, '');
  const tokens = ifNoneMatch.split(',').map((value) => value.trim());
  return tokens.some((token) => {
    if (!token) return false;
    if (token === '*') return true;
    return token.replace(/^W\//, '') === normalizedCurrent;
  });
}

async function readPuzzles(request: Request, env: Env): Promise<Response> {
  const obj = await env.PUZZLE_BUCKET.get(PUZZLES_KEY);
  if (!obj) {
    const emptyEtag = '"puzzles-empty"';
    if (etagMatches(request.headers.get('If-None-Match'), emptyEtag)) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: emptyEtag,
          'Cache-Control': 'no-cache',
          ...READ_CORS_HEADERS,
        },
      });
    }
    return new Response(JSON.stringify([]), {
      headers: {
        'Content-Type': 'application/json',
        ETag: emptyEtag,
        'Cache-Control': 'no-cache',
        ...READ_CORS_HEADERS,
      },
    });
  }

  const etag = getObjectEtag(obj);
  if (etagMatches(request.headers.get('If-None-Match'), etag)) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'no-cache',
        ...READ_CORS_HEADERS,
      },
    });
  }

  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/json',
      ETag: etag,
      'Cache-Control': 'no-cache',
      ...READ_CORS_HEADERS,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== '/api/puzzles') {
      if (url.pathname === '/editor' || url.pathname === '/editor/' || url.pathname === '/editor.html') {
        return env.ASSETS.fetch(new Request(new URL('/editor/index.html', request.url), request));
      }
      if (url.pathname === '/.well-known/apple-app-site-association') {
        // Extensionless file: Apple expects it served as JSON, no redirects.
        const res = await env.ASSETS.fetch(request);
        if (!res.ok) return res;
        return new Response(res.body, { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.pathname === '/privacy') {
        return env.ASSETS.fetch(new Request(new URL('/privacy.html', request.url), request));
      }
      if (url.pathname === '/terms') {
        return env.ASSETS.fetch(new Request(new URL('/terms.html', request.url), request));
      }
      return env.ASSETS.fetch(request);
    }

    if (request.method === 'OPTIONS') {
      // Preflight advertises GET only, so cross-origin PUT/DELETE are refused.
      return new Response(null, { status: 204, headers: READ_CORS_HEADERS });
    }

    if (request.method === 'GET') {
      return readPuzzles(request, env);
    }

    const auth = request.headers.get('Authorization') ?? '';
    if (!tokenMatches(auth, env.API_SECRET)) {
      return err('Unauthorized: API token does not match the worker secret `API_SECRET`.', 401, 'invalid_api_secret');
    }

    if (request.method === 'PUT') {
      const declared = Number(request.headers.get('Content-Length') ?? '0');
      if (declared > MAX_BODY_BYTES) return err('Payload too large', 413);
      const body = await request.text();
      if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
        return err('Payload too large', 413);
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        return err('Invalid JSON', 400);
      }
      const problems = validateCatalog(parsed);
      if (problems.length > 0) {
        return json({ error: 'Invalid puzzle catalog', code: 'invalid_catalog', problems: problems.slice(0, 20) }, 400);
      }
      const puzzleCount = (parsed as unknown[]).length;
      await snapshotCurrent(env);
      await env.PUZZLE_BUCKET.put(PUZZLES_KEY, body, {
        httpMetadata: { contentType: 'application/json' },
        customMetadata: {
          updatedAt: new Date().toISOString(),
          count: String(puzzleCount),
        },
      });
      return json({ ok: true, count: puzzleCount });
    }

    if (request.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return err('Missing ?id= param', 400);
      const obj = await env.PUZZLE_BUCKET.get(PUZZLES_KEY);
      if (!obj) return err('No puzzles found', 404);
      const puzzles = await obj.json<unknown[]>();
      const next = puzzles.filter((p: unknown) => {
        return typeof p === 'object' && p !== null && (p as { id?: unknown }).id !== id;
      });
      if (next.length === puzzles.length) return err(`Puzzle "${id}" not found`, 404);
      if (next.length === 0) return err('Cannot delete last puzzle', 400);
      await snapshotCurrent(env);
      await env.PUZZLE_BUCKET.put(PUZZLES_KEY, JSON.stringify(next, null, 2), {
        httpMetadata: { contentType: 'application/json' },
      });
      return json({ ok: true, deleted: id, remaining: next.length });
    }

    return err('Method Not Allowed', 405);
  },
};
