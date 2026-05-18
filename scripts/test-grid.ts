import assert from 'node:assert/strict';
import puzzles from '../src/data/puzzles.json';
import { parsePuzzle } from '../src/game/PuzzleParser';
import { buildGridTiles } from '../src/game/Grid';
import type { RawPuzzle } from '../src/types/puzzle';

function rowString(grid: ReturnType<typeof buildGridTiles>, row: number): string {
  return grid[row].map((tile) => tile.letter || '.').join('');
}

function colString(grid: ReturnType<typeof buildGridTiles>, col: number): string {
  let out = '';
  for (let row = 0; row < 4; row++) {
    out += grid[row][col].letter || '.';
  }
  return out;
}

function run(): void {
  const raw = (puzzles as unknown as RawPuzzle[])[0];
  assert.ok(raw, 'Expected at least one puzzle in puzzles.json');

  const puzzle = parsePuzzle(raw);
  const grid = buildGridTiles(puzzle.grid);

  // Expected orientation for current puzzle:
  // first row: STLO
  // first col: SONI
  assert.equal(rowString(grid, 0), 'STLO', 'Top row should be STLO');
  assert.equal(colString(grid, 0), 'SONI', 'First column should be SONI');

  // Sanity check coordinates are consistent with tile placement.
  assert.equal(grid[0][0].coord, 'a1', 'Top-left tile should be a1');
  assert.equal(grid[0][3].coord, 'd1', 'Top-right tile should be d1');
  assert.equal(grid[3][0].coord, 'a4', 'Bottom-left tile should be a4');
  assert.equal(grid[3][3].coord, 'd4', 'Bottom-right tile should be d4');

  console.log('Grid tests passed.');
  console.log(`row0=${rowString(grid, 0)} col0=${colString(grid, 0)}`);
}

run();
