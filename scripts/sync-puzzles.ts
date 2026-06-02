import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function readEnvFileVars(rootDir: string): Record<string, string> {
  const envPath = resolve(rootDir, '.env');
  if (!existsSync(envPath)) return {};

  const content = readFileSync(envPath, 'utf8');
  const vars: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }

  return vars;
}

function resolvePuzzlesUrl(rootDir: string): string {
  const fileVars = readEnvFileVars(rootDir);

  const explicit =
    process.env.PUZZLES_SYNC_URL?.trim() ||
    process.env.VITE_PUZZLES_URL?.trim() ||
    fileVars.VITE_PUZZLES_URL?.trim();
  if (explicit) return explicit;

  const shareBase =
    process.env.VITE_SHARE_BASE_URL?.trim() ||
    fileVars.VITE_SHARE_BASE_URL?.trim();
  if (shareBase) return `${shareBase.replace(/\/+$/, '')}/api/puzzles`;

  return 'https://ludodex.krisenigma.com/api/puzzles';
}

async function main(): Promise<void> {
  const scriptDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
  const rootDir = resolve(scriptDir, '..');
  const targetPath = resolve(rootDir, 'src/data/puzzles.json');
  const url = resolvePuzzlesUrl(rootDir);

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch puzzles (${response.status}) from ${url}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error(`Invalid payload from ${url}: expected JSON array`);
  }
  if (data.length === 0) {
    throw new Error(`Refusing to overwrite with empty puzzles array from ${url}`);
  }

  const nextJson = `${JSON.stringify(data, null, 2)}\n`;
  const prevJson = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : '';

  if (prevJson === nextJson) {
    console.log(`puzzles sync: up-to-date (${data.length} puzzles)`);
    return;
  }

  writeFileSync(targetPath, nextJson, 'utf8');
  console.log(`puzzles sync: updated ${targetPath} (${data.length} puzzles)`);
}

main().catch((error) => {
  console.error(`puzzles sync error: ${(error as Error).message}`);
  process.exitCode = 1;
});
