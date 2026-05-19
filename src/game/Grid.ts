import { Tile } from './Tile';

export function buildGridTiles(grid: Record<string, string>): Tile[][] {
  const tiles: Tile[][] = [];

  for (let row = 0; row < 4; row++) {
    const rowTiles: Tile[] = [];
    for (let col = 0; col < 4; col++) {
      const coord = `${String.fromCharCode(97 + col)}${row + 1}`;
      const letter = grid[coord] ?? '';
      rowTiles.push(new Tile(row, col, letter));
    }
    tiles.push(rowTiles);
  }

  return tiles;
}
