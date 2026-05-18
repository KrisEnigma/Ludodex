import { Tile } from './Tile';

export function buildGridTiles(grid: Record<string, string>): Tile[][] {
  const tiles: Tile[][] = [];

  for (let row = 0; row < 4; row++) {
    const rowTiles: Tile[] = [];
    for (let col = 0; col < 4; col++) {
      const coord = `${String.fromCharCode(97 + row)}${col + 1}`;
      const letter = grid[coord] ?? '';
      rowTiles.push(new Tile(row, col, letter));
    }
    tiles.push(rowTiles);
  }

  // Debug: print grid by row
  let debugRows = '';
  for (let row = 0; row < 4; row++) {
    let line = '';
    for (let col = 0; col < 4; col++) {
      line += tiles[row][col].letter || '.';
      line += ' ';
    }
    debugRows += line + '\n';
  }
  console.log('Grid by row (y):\n' + debugRows);

  // Debug: print grid by column
  let debugCols = '';
  for (let col = 0; col < 4; col++) {
    let line = '';
    for (let row = 0; row < 4; row++) {
      line += tiles[row][col].letter || '.';
      line += ' ';
    }
    debugCols += line + '\n';
  }
  console.log('Grid by column (x):\n' + debugCols);

  return tiles;
}
