import assert from 'node:assert/strict';
import puzzles from '../src/data/puzzles.json';
import { parsePuzzle } from '../src/game/PuzzleParser';
import { buildTileOwnership, applySolvedPart } from '../src/game/tileOwnership';
import type { RawPuzzle } from '../src/types/puzzle';

function run(): void {
  const raw = (puzzles as unknown as RawPuzzle[])[0];
  const puzzle = parsePuzzle(raw);

  const entries = puzzle.answers.flatMap((answer) =>
    answer.parts.map((part, idx) => ({
      id: `${answer.display}::${idx}`,
      path: part.path
    }))
  );

  const state = buildTileOwnership(entries);
  const sonic = entries.find((e) => e.id.startsWith('SONIC::'));
  assert.ok(sonic, 'SONIC part entry should exist');

  const deactivated = applySolvedPart(state, sonic!);

  // SONIC deactivates only non-shared tiles; c2 remains active because CROFT still owns it.
  assert.deepEqual(deactivated.sort(), ['a1', 'b1', 'c1', 'd1']);
  assert.equal(state.ownership.get('c2')?.size, 1);

  console.log('Deactivation integration tests passed.');
}

run();
