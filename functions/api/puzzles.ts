/// <reference types="@cloudflare/workers-types" />
import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  PUZZLE_BUCKET: R2Bucket;
  API_SECRET: string;
}

const PUZZLES_KEY = 'puzzles.json';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function err(message: string, status: number): Response {
  return new Response(message, { status, headers: CORS });
}

function isAuthorized(request: Request, env: Env): boolean {
  const auth = request.headers.get('Authorization') ?? '';
  return auth.startsWith('Bearer ') && auth.slice(7) === env.API_SECRET;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  // Restrict write API to your editor page only on production.
  const origin = request.headers.get('Origin') ?? '';
  const isEditor = origin.includes('ludodex') || origin === '';
  if (request.method !== 'GET' && !isEditor) {
    return err('Forbidden', 403);
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (request.method === 'GET') {
    const obj = await env.PUZZLE_BUCKET.get(PUZZLES_KEY);
    if (!obj) return json([]);
    return new Response(obj.body, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        ...CORS,
      },
    });
  }

  if (request.method === 'PUT') {
    if (!isAuthorized(request, env)) return err('Unauthorized', 401);
    const body = await request.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return err('Invalid JSON', 400);
    }
    if (!Array.isArray(parsed)) return err('Payload must be a JSON array', 400);
    if (parsed.length === 0) return err('Refusing to write an empty puzzle list', 400);
    const invalid = parsed.find(
      (p) =>
        typeof p !== 'object' ||
        !p ||
        typeof (p as Record<string, unknown>).id !== 'string' ||
        !(p as Record<string, unknown>).name ||
        typeof (p as Record<string, unknown>).data !== 'object'
    );
    if (invalid) {
      return err(`Puzzle missing required fields: ${JSON.stringify(invalid).slice(0, 120)}`, 400);
    }
    await env.PUZZLE_BUCKET.put(PUZZLES_KEY, body, {
      httpMetadata: { contentType: 'application/json' },
      customMetadata: {
        updatedAt: new Date().toISOString(),
        puzzleCount: String(parsed.length),
      },
    });
    return json({ ok: true, count: parsed.length });
  }

  if (request.method === 'DELETE') {
    if (!isAuthorized(request, env)) return err('Unauthorized', 401);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return err('Missing ?id= param', 400);
    const obj = await env.PUZZLE_BUCKET.get(PUZZLES_KEY);
    if (!obj) return err('No puzzles found', 404);
    const puzzles = (await obj.json()) as Array<{ id: string }>;
    const next = puzzles.filter((p) => p.id !== id);
    if (next.length === puzzles.length) return err(`Puzzle "${id}" not found`, 404);
    if (next.length === 0) return err('Refusing to delete last puzzle', 400);
    await env.PUZZLE_BUCKET.put(PUZZLES_KEY, JSON.stringify(next, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });
    return json({ ok: true, deleted: id, remaining: next.length });
  }

  return err('Method Not Allowed', 405);
};
