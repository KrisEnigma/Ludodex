export function puzzleCoordToGridCoord(coord: string): string {
  const col = coord[0];
  const row = coord[1];
  return `${String.fromCharCode(96 + Number(row))}${col.charCodeAt(0) - 96}`;
}
