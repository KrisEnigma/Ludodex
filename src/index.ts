const PUZZLES_KEY = 'puzzles.json';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
} as const;

type Env = {
  PUZZLE_BUCKET: {
    get(key: string): Promise<{
      body: BodyInit | null;
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

function err(message: string, status: number): Response {
  return json({ error: message }, status);
}

async function readPuzzles(env: Env): Promise<Response> {
  const obj = await env.PUZZLE_BUCKET.get(PUZZLES_KEY);
  if (!obj) return json([]);
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...CORS_HEADERS,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== '/api/puzzles') {
      return new Response('Not Found', { status: 404 });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === 'GET') {
      return readPuzzles(env);
    }

    const auth = request.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ') || auth.slice(7) !== env.API_SECRET) {
      return err('Unauthorized', 401);
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
