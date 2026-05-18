import type { RawPuzzle, Puzzle, Answer, PuzzlePart } from '../types/puzzle';

export function parsePuzzle(raw: RawPuzzle): Puzzle {
  const grid: Record<string, string> = {};
  const answers: Answer[] = [];

  for (const [display, pathStr] of Object.entries(raw.data)) {
    const coords = pathStr.match(/.{2}/g);
    if (!coords) throw new Error(`Invalid path string for \"${display}\"`);

    const wordParts = display.split(' ');
    const wordLengths = wordParts.map((w) => w.length);
    const totalExpected = wordLengths.reduce((a, b) => a + b, 0);

    if (coords.length !== totalExpected) {
      throw new Error(
        `Path length mismatch for \"${display}\": ` +
        `expected ${totalExpected}, got ${coords.length}`
      );
    }

    const allLetters = display.replace(/ /g, '').split('');
    coords.forEach((coord, i) => {
      const letter = allLetters[i];
      if (grid[coord] && grid[coord] !== letter) {
        throw new Error(
          `Tile ${coord} conflict in \"${display}\": ` +
          `\"${grid[coord]}\" already set, trying to set \"${letter}\"`
        );
      }
      grid[coord] = letter;
    });

    for (let i = 1; i < coords.length; i++) {
      if (!areTilesAdjacent(coords[i - 1], coords[i])) {
        throw new Error(
          `Non-adjacent tiles in \"${display}\": ` +
          `${coords[i - 1]} -> ${coords[i]}`
        );
      }
    }

    let offset = 0;
    const parts: PuzzlePart[] = wordParts.map((word) => {
      const path = coords.slice(offset, offset + word.length);
      offset += word.length;
      return { word, path };
    });

    answers.push({ display, parts });
  }

  if (raw.filler) {
    for (const [coord, letter] of Object.entries(raw.filler)) {
      if (grid[coord]) {
        throw new Error(
          `Filler tile ${coord} conflicts with word tile \"${grid[coord]}\"`
        );
      }
      grid[coord] = letter;
    }
  }

  const covered = Object.keys(grid).length;
  if (covered < 16) {
    console.warn(
      `Puzzle \"${raw.id}\" covers ${covered}/16 tiles. ` +
      `Add filler for the remaining ${16 - covered}.`
    );
  }

  return {
    id: raw.id,
    name: raw.name,
    category: raw.category,
    difficulty: raw.difficulty,
    date: raw.date,
    series: raw.series,
    premium: raw.premium,
    hint: raw.hint,
    grid,
    answers
  };
}

function areTilesAdjacent(a: string, b: string): boolean {
  const col = (c: string) => c.charCodeAt(0) - 97;
  const row = (c: string) => parseInt(c[1], 10) - 1;
  return Math.abs(col(a) - col(b)) <= 1 && Math.abs(row(a) - row(b)) <= 1 && a !== b;
}
