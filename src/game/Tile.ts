export class Tile {
  row: number;
  col: number;
  letter: string;
  deactivated = false;

  constructor(row: number, col: number, letter: string) {
    this.row = row;
    this.col = col;
    this.letter = letter;
  }

  get coord(): string {
    return `${String.fromCharCode(97 + this.col)}${this.row + 1}`;
  }
}
