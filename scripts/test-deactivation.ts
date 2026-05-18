import assert from 'node:assert/strict';
import puzzles from '../src/data/puzzles.json';
import { parsePuzzle } from '../src/game/PuzzleParser';
import { buildTileOwnership, applySolvedPart, isFoundPending } from '../src/game/tileOwnership';
import { puzzleCoordToGridCoord } from '../src/game/coordMap';
import type { RawPuzzle } from '../src/types/puzzle';

function run(): void {
  const raw = (puzzles as unknown as RawPuzzle[])[0];
  const puzzle = parsePuzzle(raw);

  const entries = puzzle.answers.flatMap((answer) =>
    answer.parts.map((part, idx) => ({
      id: `${answer.display}::${idx}`,
      path: part.path.map((coord) => puzzleCoordToGridCoord(coord))
    }))
  );

  const state = buildTileOwnership(entries);
  const sonic = entries.find((e) => e.id.startsWith('SONIC::'));
  assert.ok(sonic, 'SONIC part entry should exist');

  const deactivated = applySolvedPart(state, sonic!);

  // SONIC path after coord normalization should remove first column except shared tile b3.
  assert.deepEqual(deactivated.sort(), ['a1', 'a2', 'a3', 'a4']);
  assert.equal(isFoundPending(state, 'b3'), true);

  console.log('Deactivation integration tests passed.');
}

run();
