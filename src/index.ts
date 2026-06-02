const PUZZLES_KEY = 'puzzles.json';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, If-None-Match',
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
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
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
          ...CORS_HEADERS,
        },
      });
    }
    return new Response(JSON.stringify([]), {
      headers: {
        'Content-Type': 'application/json',
        ETag: emptyEtag,
        'Cache-Control': 'no-cache',
        ...CORS_HEADERS,
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
        ...CORS_HEADERS,
      },
    });
  }

  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/json',
      ETag: etag,
      'Cache-Control': 'no-cache',
      ...CORS_HEADERS,
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
      if (url.pathname === '/privacy') {
        return env.ASSETS.fetch(new Request(new URL('/privacy.html', request.url), request));
      }
      if (url.pathname === '/terms') {
        return env.ASSETS.fetch(new Request(new URL('/terms.html', request.url), request));
      }
      return env.ASSETS.fetch(request);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === 'GET') {
      return readPuzzles(request, env);
    }

    const auth = request.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ') || auth.slice(7) !== env.API_SECRET) {
      return err('Unauthorized: API token does not match the worker secret `API_SECRET`.', 401, 'invalid_api_secret');
    }

    if (request.method === 'PUT') {
      const body = await request.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        return err('Invalid JSON', 400);
      }
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return err('Payload must be a non-empty JSON array', 400);
      }
      await env.PUZZLE_BUCKET.put(PUZZLES_KEY, body, {
        httpMetadata: { contentType: 'application/json' },
        customMetadata: {
          updatedAt: new Date().toISOString(),
          count: String(parsed.length),
        },
      });
      return json({ ok: true, count: parsed.length });
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
      await env.PUZZLE_BUCKET.put(PUZZLES_KEY, JSON.stringify(next, null, 2), {
        httpMetadata: { contentType: 'application/json' },
      });
      return json({ ok: true, deleted: id, remaining: next.length });
    }

    return err('Method Not Allowed', 405);
  },
};
