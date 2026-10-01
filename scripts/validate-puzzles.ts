import puzzles from '../src/data/puzzles.json';
import { parsePuzzle } from '../src/game/PuzzleParser';
import type { RawPuzzle } from '../src/types/puzzle';

const VALID_CATEGORIES = [
  'characters', 'enemies', 'items', 'locations',
  'mechanics', 'series', 'people', 'studios',
  'hardware', 'culture'
];

const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];

let errors = 0;
let warnings = 0;

for (const raw of puzzles as unknown as RawPuzzle[]) {
  const tag = `[${raw.id}]`;

  try {
    if (!raw.id) throw new Error('Missing id');
    if (!raw.name?.en) throw new Error('Missing name.en');
    if (!VALID_CATEGORIES.includes(raw.category)) {
      throw new Error(`Invalid category: \"${raw.category}\"`);
    }
    if (!VALID_DIFFICULTIES.includes(raw.difficulty)) {
      throw new Error(`Invalid difficulty: \"${raw.difficulty}\"`);
    }
    if (raw.date && !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
      throw new Error(`Invalid date format: \"${raw.date}\"`);
    }

    parsePuzzle(raw);

    // Spanish is a warning for now (demo content lacks it); make it an error
    // before launch by moving these into the throw checks above.
    const missingEs: string[] = [];
    if (!raw.name?.es) missingEs.push('name.es');
    if (raw.hint && !raw.hint.es) missingEs.push('hint.es');
    if (missingEs.length > 0) {
      console.warn(`WARN ${tag} missing ${missingEs.join(', ')}`);
      warnings++;
    }

    console.log(`OK ${tag} ${raw.name.en}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`ERROR ${tag} ${message}`);
    errors++;
  }
}

console.log(`\n${puzzles.length - errors}/${puzzles.length} puzzles valid${warnings ? `, ${warnings} with warnings` : ''}`);
if (errors > 0) process.exit(1);
