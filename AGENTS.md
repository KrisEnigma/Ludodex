# GlitchSalad — Copilot Agent Build Prompt

## Concept
A daily word puzzle game themed entirely around gaming knowledge.
The player is shown a 4x4 grid of letters and a set of hint boxes
showing the lengths of hidden words. By swiping adjacent tiles,
they trace paths that spell out themed words (e.g. "Video Game
Heroes" → LARA CROFT, MARIO, SONIC). When a word is found, its
tiles are marked. Tiles fully deactivate (animate out) only once
ALL words sharing that tile have been found. Puzzle is solved
when all words are found and all tiles are deactivated.

---

## Tech Stack
- Game engine: Phaser 3 (TypeScript)
- Native wrapper: Capacitor 6
- Build tool: Vite
- Ads: @capacitor-community/admob
- IAP: @revenuecat/purchases-capacitor
- Persistence: @capacitor/preferences
- Notifications: @capacitor/local-notifications
- Haptics: @capacitor/haptics
- Share: @capacitor/share

---

## Project Structure
```
glitchsalad/
├── src/
│   ├── main.ts
│   ├── scenes/
│   │   ├── BootScene.ts
│   │   ├── MenuScene.ts
│   │   ├── GameScene.ts
│   │   └── WinScene.ts
│   ├── game/
│   │   ├── Grid.ts
│   │   ├── Tile.ts
│   │   ├── PuzzleLoader.ts
│   │   └── SkinManager.ts
│   ├── services/
│   │   ├── AdService.ts
│   │   ├── IAPService.ts
│   │   ├── ProgressService.ts
│   │   └── NotificationService.ts
│   ├── data/
│   │   └── puzzles.json
│   └── skins/
│       └── skins.ts
├── capacitor.config.ts
├── vite.config.ts
└── package.json
```

---

## Grid Rules
- Always 4x4 (16 tiles)
- Each tile is identified by [row, col] (0-indexed)
- Adjacency is 8-directional (orthogonal + diagonal)
- Tiles CAN be shared between multiple words
- A tile deactivates (animates out) only when ALL words
  that include that tile have been found
- Ideally all 16 tiles are part of at least one word
  (no filler tiles), but filler is allowed if needed

---

## Puzzle Data Format — replace previous section entirely

### Schema

```typescript
// src/types/puzzle.ts

type Locale = 'en' | 'es';

type LocalizedString = {
  en: string;               // required — fallback for all locales
  es?: string;              // optional — add per language as needed
};

type Difficulty = 'easy' | 'medium' | 'hard';

type Series = {
  id: string;               // e.g. "fromsoftware"
  part: number;             // e.g. 1
};

type RawPuzzle = {
  id: string;               // unique slug, lowercase, no spaces
  name: LocalizedString;    // level title, translated
  category: string;         // e.g. "characters" | "titles" | "studios"
                            //      "franchises" | "consoles" | "composers"
                            //      "genres" | "decades"
  difficulty: Difficulty;
  date: string | null;      // "YYYY-MM-DD" — overrides daily rotation
                            // null = enter normal rotation
  series: Series | null;    // multi-part themed collections
  premium: boolean;         // reserved for future paid puzzle packs
  hint: LocalizedString | null; // optional flavor text shown before solving
  filler?: Record<string, string>; // tiles not belonging to any word
                                   // e.g. { "b2": "X" }
  data: Record<string, string>;    // word paths — see format below
};
```

### Path format

Coordinate system: column letter (a–d, left→right) + row number (1–4, top→bottom).

```
     a    b    c    d
1  [a1] [b1] [c1] [d1]
2  [a2] [b2] [c2] [d2]
3  [a3] [b3] [c3] [d3]
4  [a4] [b4] [c4] [d4]
```

Each word's value is a continuous string of 2-char coordinate pairs.
For multi-word answers, the path covers all words concatenated —
split positions are derived from word lengths in the display name.

```javascript
// puzzles.json — example entry
{
  "id": "videogameheroes",
  "name": {
    "en": "Video Game Heroes",
    "es": "Héroes de Videojuegos"
  },
  "category": "characters",
  "difficulty": "medium",
  "date": null,
  "series": null,
  "premium": false,
  "hint": {
    "en": "Classic heroes from three different decades",
    "es": "Héroes clásicos de tres décadas distintas"
  },
  "data": {
    "SONIC":      "a1b1c1d1c2",
    "LARA CROFT": "a3b3c4d3c2d2c3b2a2",
    "MARIO":      "d4d3c4b4a4"
  }
}
```

### Parser

```typescript
// src/game/PuzzleParser.ts

import type { RawPuzzle, Puzzle, Answer, PuzzlePart } from '../types/puzzle';

export function parsePuzzle(raw: RawPuzzle): Puzzle {
  const grid: Record<string, string> = {};
  const answers: Answer[] = [];

  for (const [display, pathStr] of Object.entries(raw.data)) {
    const coords = pathStr.match(/.{2}/g);
    if (!coords) throw new Error(`Invalid path string for "${display}"`);

    const wordParts = display.split(' ');
    const wordLengths = wordParts.map(w => w.length);
    const totalExpected = wordLengths.reduce((a, b) => a + b, 0);

    if (coords.length !== totalExpected) {
      throw new Error(
        `Path length mismatch for "${display}": ` +
        `expected ${totalExpected}, got ${coords.length}`
      );
    }

    // Map coordinates → letters, catch tile conflicts
    const allLetters = display.replace(/ /g, '').split('');
    coords.forEach((coord, i) => {
      const letter = allLetters[i];
      if (grid[coord] && grid[coord] !== letter) {
        throw new Error(
          `Tile ${coord} conflict in "${display}": ` +
          `"${grid[coord]}" already set, trying to set "${letter}"`
        );
      }
      grid[coord] = letter;
    });

    // Validate adjacency
    for (let i = 1; i < coords.length; i++) {
      if (!areTilesAdjacent(coords[i - 1], coords[i])) {
        throw new Error(
          `Non-adjacent tiles in "${display}": ` +
          `${coords[i - 1]} → ${coords[i]}`
        );
      }
    }

    // Split path into per-word parts
    let offset = 0;
    const parts: PuzzlePart[] = wordParts.map((word) => {
      const path = coords.slice(offset, offset + word.length);
      offset += word.length;
      return { word, path };
    });

    answers.push({ display, parts });
  }

  // Apply filler tiles
  if (raw.filler) {
    for (const [coord, letter] of Object.entries(raw.filler)) {
      if (grid[coord]) {
        throw new Error(
          `Filler tile ${coord} conflicts with word tile "${grid[coord]}"`
        );
      }
      grid[coord] = letter;
    }
  }

  // Warn on incomplete grid coverage
  const covered = Object.keys(grid).length;
  if (covered < 16) {
    console.warn(
      `Puzzle "${raw.id}" covers ${covered}/16 tiles. ` +
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
    answers,
  };
}

function areTilesAdjacent(a: string, b: string): boolean {
  const col = (c: string) => c.charCodeAt(0) - 97; // a=0 b=1 c=2 d=3
  const row = (c: string) => parseInt(c[1]) - 1;   // 1=0 2=1 3=2 4=3
  return (
    Math.abs(col(a) - col(b)) <= 1 &&
    Math.abs(row(a) - row(b)) <= 1 &&
    a !== b
  );
}
```

### Localization helper

```typescript
// src/utils/i18n.ts

import type { LocalizedString, Locale } from '../types/puzzle';

let currentLocale: Locale = 'en';

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function t(str: LocalizedString | null, fallback = ''): string {
  if (!str) return fallback;
  return str[currentLocale] ?? str.en ?? fallback;
}

// Usage in GameScene:
// this.titleText.setText(t(puzzle.name));
// this.hintText.setText(t(puzzle.hint));
```

### Offline validator script

Run this before committing any new puzzles.json entries.
It catches all structural errors without launching the game.

```typescript
// scripts/validate-puzzles.ts
// Run with: npx ts-node scripts/validate-puzzles.ts

import puzzles from '../src/data/puzzles.json';
import { parsePuzzle } from '../src/game/PuzzleParser';
import type { RawPuzzle } from '../src/types/puzzle';

const VALID_CATEGORIES = [
  'characters', 'titles', 'studios', 'franchises',
  'consoles', 'composers', 'genres', 'decades'
];

const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];

let errors = 0;

for (const raw of puzzles as RawPuzzle[]) {
  const tag = `[${raw.id}]`;

  try {
    // Schema checks
    if (!raw.id)   throw new Error('Missing id');
    if (!raw.name?.en) throw new Error('Missing name.en');
    if (!VALID_CATEGORIES.includes(raw.category))
      throw new Error(`Invalid category: "${raw.category}"`);
    if (!VALID_DIFFICULTIES.includes(raw.difficulty))
      throw new Error(`Invalid difficulty: "${raw.difficulty}"`);
    if (raw.date && !/^\d{4}-\d{2}-\d{2}$/.test(raw.date))
      throw new Error(`Invalid date format: "${raw.date}"`);
    if (raw.hint && !raw.hint.en)
      throw new Error('hint exists but missing hint.en');

    // Parse (catches path, adjacency, conflict errors)
    parsePuzzle(raw);

    console.log(`✓ ${tag} ${raw.name.en}`);
  } catch (e: any) {
    console.error(`✗ ${tag} ${e.message}`);
    errors++;
  }
}

console.log(`\n${puzzles.length - errors}/${puzzles.length} puzzles valid`);
if (errors > 0) process.exit(1);
```

---

## Tile Sharing — Engine Logic
At puzzle load time, compute a tile ownership map:

```typescript
// tileOwnership[row][col] = Set of word part IDs using that tile
// Example: tileOwnership[2][1] = { "SONIC", "CROFT" }

function buildTileOwnership(answers: Answer[]): TileOwnership {
  const map: TileOwnership = {};
  for (const answer of answers) {
    for (const part of answer.parts) {
      for (const [row, col] of part.path) {
        const key = `${row},${col}`;
        if (!map[key]) map[key] = new Set();
        map[key].add(part.word);
      }
    }
  }
  return map;
}
```

When a word part is found:
1. Remove it from the ownership set of each tile it uses
2. If a tile's ownership set becomes empty → deactivate that tile
3. Animate deactivated tiles: scale down + fade out

---

## Word Validation Logic
When player releases swipe:
1. Collect the ordered sequence of tiles swiped
2. Extract letter string from tile sequence
3. Check if string matches any unfound word part
4. Adjacency check: each consecutive tile pair must be
   within 1 step in both row and col (8-directional)
5. No revisiting already-deactivated tiles within one swipe
6. Tiles that are found-but-not-yet-deactivated (shared)
   remain swipeable for remaining words that need them
7. On valid match: mark part as found, trigger deactivation
   check, update hint boxes
8. On invalid: shake the traced path briefly, release

---

## UI Layout (GameScene)
Top to bottom within the screen:

```
┌─────────────────────────┐
│  Level 42               │  ← small, top left
│  Video Game Heroes      │  ← title, prominent
│  0:47  ────────────     │  ← timer, top right
│                         │
│  [ S ][ T ][ L ][ O ]   │
│  [ O ][ F ][ A ][ I ]   │  ← 4x4 grid, centered
│  [ N ][ C ][ O ][ R ]   │
│  [ I ][ R ][ A ][ M ]   │
│                         │
│  ┌──────────┐ ┌─────┐ ┌─────┐  │
│  │ 4  + 5   │ │  5  │ │  5  │  │ ← hint boxes
│  └──────────┘ └─────┘ └─────┘  │
└─────────────────────────┘
```

Hint boxes:
- Ordered alphabetically by the answer's display name
- Width of each box = proportional to total letter count
- Multi-word answers show parts separated by a space gap:
  [ _ _ _ _ ] [ _ _ _ _ _ ] for "LARA CROFT" (4+5)
  shown as one combined box with a visible gap in the middle
- When a part is found, its blank slots fill with letters
- When all parts of an answer are found, the full box
  lights up with the solved skin color
- Example progression for "LARA CROFT":
  Before:     [ _ _ _ _   _ _ _ _ _ ]
  LARA found: [ L A R A   _ _ _ _ _ ]
  Both found: [ L A R A   C R O F T ] ← highlight

Timer:
- Counts up from 0:00
- Displayed top right
- Stored with solved puzzle for stats (no time limit)

---

## Daily Puzzle Selection
```typescript
// PuzzleLoader.ts
const LAUNCH_DATE = new Date('2025-01-01T00:00:00');

export function getDailyPuzzle(puzzles: Puzzle[]): Puzzle {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayIndex = Math.floor(
    (today.getTime() - LAUNCH_DATE.getTime()) / 86400000
  );
  return puzzles[dayIndex % puzzles.length];
}
```

Future upgrade path: on BootScene, attempt to fetch
`https://cdn.glitchsalad.app/puzzles.json`. If successful,
cache in preferences under key `puzzles_remote`. Fall back
to bundled puzzles.json if fetch fails or is unavailable.

---

## Skin System
```typescript
// skins/skins.ts
export const SKINS: Record<string, Skin> = {
  default: {
    id: 'default',
    name: 'Default',
    price: 'free',
    tileFill: 0x2d2d2d,
    tileStroke: 0x555555,
    tileActive: 0x4a90d9,
    tileSolved: 0x27ae60,
    tileDeactivated: 0x1a1a1a,
    letterColor: '#ffffff',
    background: 0x1a1a1a,
    font: 'monospace'
  },
  synthwave: {
    id: 'synthwave',
    name: 'Synthwave',
    price: 'skin_synthwave',   // RevenueCat product ID
    tileFill: 0x1a0533,
    tileStroke: 0xff00ff,
    tileActive: 0xff00ff,
    tileSolved: 0x00ffff,
    tileDeactivated: 0x0d0d1a,
    letterColor: '#00ffff',
    background: 0x0d0d1a,
    font: 'monospace'
  },
  pixel: {
    id: 'pixel',
    name: 'Game Boy',
    price: 'skin_pixel',
    tileFill: 0x0f380f,
    tileStroke: 0x306230,
    tileActive: 0x8bac0f,
    tileSolved: 0x306230,
    tileDeactivated: 0x071607,
    letterColor: '#9bbc0f',
    background: 0x0f380f,
    font: 'monospace'
  },
  darkfantasy: {
    id: 'darkfantasy',
    name: 'Dark Souls',
    price: 'skin_darkfantasy',
    tileFill: 0x1c1007,
    tileStroke: 0x8b6914,
    tileActive: 0x8b6914,
    tileSolved: 0x4a3000,
    tileDeactivated: 0x0a0704,
    letterColor: '#c9a84c',
    background: 0x0d0a06,
    font: 'serif'
  }
}
```

---

## IAP Products
Configure in App Store Connect + Google Play Console,
map in RevenueCat dashboard:

| Product ID         | Type             | Price  |
|--------------------|------------------|--------|
| remove_ads         | Non-consumable   | $1.99  |
| skin_synthwave     | Non-consumable   | $0.99  |
| skin_pixel         | Non-consumable   | $0.99  |
| skin_darkfantasy   | Non-consumable   | $0.99  |
| skin_bundle        | Non-consumable   | $1.99  |

```typescript
// IAPService.ts
import { Purchases } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

export async function initIAP() {
  if (!Capacitor.isNativePlatform()) return;
  await Purchases.configure({ apiKey: 'RC_KEY' });
}

export async function hasEntitlement(id: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const { customerInfo } = await Purchases.getCustomerInfo();
  return id in customerInfo.entitlements.active;
}

export async function restorePurchases() {
  if (!Capacitor.isNativePlatform()) return;
  await Purchases.restorePurchases();
}
```

---

## Ads (AdMob)
- Show interstitial after every 2 completed puzzles
- Never show if `remove_ads` entitlement is active
- Guard all calls with `Capacitor.isNativePlatform()`
- Preload next interstitial immediately after showing one
- Use test ad IDs during development

---

## Progress Persistence
Keys stored via @capacitor/preferences:

| Key                    | Type       | Description                        |
|------------------------|------------|------------------------------------|
| solved_ids             | number[]   | Puzzle IDs completed               |
| solved_times           | object     | Map of puzzle ID → completion time |
| active_skin            | string     | Current skin ID                    |
| puzzles_solved_count   | number     | Total count (for ad frequency)     |
| last_played_date       | string     | ISO date string                    |
| notification_scheduled | boolean    | Whether daily notif is set up      |
| puzzles_remote         | string     | Cached remote puzzles JSON         |

---

## Daily Notification
Schedule once on first launch, repeats daily at 9am.

```typescript
import { LocalNotifications } from '@capacitor/local-notifications';

export async function scheduleDailyNotification() {
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return;

  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) return;

  await LocalNotifications.schedule({
    notifications: [{
      id: 1,
      title: "New puzzle unlocked",
      body: "Today's challenge is live. How fast can you solve it?",
      schedule: {
        on: { hour: 9, minute: 0 },
        repeats: true,
        allowWhileIdle: true
      }
    }]
  });
}
```

---

## Build Order (MVP)
1. Vite + Phaser 3 + Capacitor scaffold
2. Static test puzzle rendered on 4x4 grid
3. Swipe input with 8-directional adjacency validation
4. Word validation against puzzle data
5. Tile deactivation logic (ownership map)
6. Hint boxes with letter-count display + fill on solve
7. Win condition → WinScene with time + share
8. PuzzleLoader with date-math daily selection
9. ProgressService (solved IDs, streak, ad counter)
10. SkinManager + default skin
11. AdService with interstitial frequency logic
12. IAPService in sandbox mode
13. Skin selector in MenuScene
14. NotificationService
15. BootScene: remote puzzle fetch attempt + fallback

---

## Copilot Notes
- All game objects are Phaser GameObjects on canvas — zero DOM elements

## Input System — Feel and Precision

### Core principle
All pointer events are handled at the SCENE level, not on
individual tiles. This gives full control over what counts
as a valid interaction at every moment.

```typescript
// GameScene.ts — wire up in create()
this.input.on('pointerdown', this.onPointerDown, this);
this.input.on('pointermove', this.onPointerMove, this);
this.input.on('pointerup', this.onPointerUp, this);
```

---

### Hitbox — circular, not full tile
Each tile occupies a square cell but its INTERACTIVE AREA
is a circle centered on the tile, with radius = 38% of cell
size. This creates a deliberate dead zone (~24% gap) between
adjacent tile hitboxes, preventing accidental activations
while swiping across the grid.

```typescript
const CELL_SIZE = Math.floor(Math.min(screenW, screenH) * 0.22);
const HIT_RADIUS = CELL_SIZE * 0.38;

function getTileAtPoint(x: number, y: number): Tile | null {
  for (const tile of allTiles) {
    if (tile.deactivated) continue;
    const dx = x - tile.centerX;
    const dy = y - tile.centerY;
    if (Math.sqrt(dx * dx + dy * dy) <= HIT_RADIUS) return tile;
  }
  return null;
}
```

The visual tile (rounded rectangle) can be larger than the
hitbox — it fills more of the cell for a clean look, but
selection is governed purely by the circle.

---

### Selection state machine
Four states. Only valid transitions are allowed:

```
IDLE → SELECTING (pointerdown on a tile)
SELECTING → SELECTING (valid adjacent tile added)
SELECTING → SELECTING (backtrack removes last tile)
SELECTING → IDLE (pointerup → submit attempt)
SELECTING → IDLE (cancel: outside board or non-adjacent)
IDLE → IDLE (tap on deactivated tile → do nothing)
```

---

### pointerdown
```typescript
onPointerDown(pointer: Phaser.Input.Pointer) {
  const tile = getTileAtPoint(pointer.x, pointer.y);
  if (!tile) return; // tapped dead zone or outside board — ignore

  this.state = 'SELECTING';
  this.chain = [tile];
  tile.setHighlight(true);
  this.haptics.impact({ style: ImpactStyle.Light });
  this.redrawPath();
}
```

---

### pointermove — the most critical method
```typescript
onPointerMove(pointer: Phaser.Input.Pointer) {
  if (this.state !== 'SELECTING') return;
  if (!pointer.isDown) return;

  const tile = getTileAtPoint(pointer.x, pointer.y);
  const last = this.chain[this.chain.length - 1];

  // In dead zone between tiles — hold current selection, do nothing
  if (!tile) {
    // But if pointer leaves the board boundary entirely → cancel
    if (this.isOutsideBoard(pointer.x, pointer.y)) {
      this.cancelSelection();
    }
    return;
  }

  // Already the last tile — hovering, no change
  if (tile === last) return;

  // Backtracking: pointer re-entered second-to-last tile
  // Remove last tile from chain instead of adding a new one
  const prevIndex = this.chain.indexOf(tile);
  if (prevIndex === this.chain.length - 2) {
    const removed = this.chain.pop();
    removed?.setHighlight(false);
    this.haptics.impact({ style: ImpactStyle.Light });
    this.redrawPath();
    return;
  }

  // Tile already in chain but not second-to-last → ignore
  // (don't cancel, don't add — player may be wiggling)
  if (prevIndex >= 0) return;

  // Not adjacent to last selected tile → cancel entire selection
  if (!isAdjacent(last, tile)) {
    this.cancelSelection();
    return;
  }

  // Valid adjacent tile — add to chain
  this.chain.push(tile);
  tile.setHighlight(true);
  this.haptics.impact({ style: ImpactStyle.Light });
  this.redrawPath();
}
```

**Why not cancel on non-adjacent instead of just ignoring?**
The gap between hitboxes means the pointer can briefly be
over a non-adjacent tile's zone if the player swipes fast
at an angle. Canceling there feels broken. Only cancel if
the pointer clearly crosses into a non-adjacent tile that is
itself within HIT_RADIUS — meaning the player intentionally
landed on a wrong tile.

---

### pointerup — submit or cancel
```typescript
onPointerUp(pointer: Phaser.Input.Pointer) {
  if (this.state !== 'SELECTING') return;
  if (this.chain.length === 0) return;

  const word = this.chain.map(t => t.letter).join('');
  const match = this.findWordMatch(word);

  if (match) {
    this.onWordFound(match);
  } else {
    this.shakeChain();         // brief horizontal tween on each tile
    this.haptics.notification({ type: NotificationType.Warning });
    this.time.delayedCall(300, () => this.clearChain());
  }
}
```

---

### Tap — single tile at a time
Tapping individual tiles builds the chain without holding.
This is the same code path: pointerdown adds the first tile,
pointerup immediately tries to submit it (fails for single
letter, shakes), and the chain is NOT cleared — it stays.

Wait — that breaks single-tap mode. Handle it like this:

```typescript
onPointerUp(pointer: Phaser.Input.Pointer) {
  const wasTap = pointer.getDuration() < 200
               && pointer.getDistance() < 10;

  if (wasTap && this.chain.length > 0) {
    // Single tap — keep chain, don't submit yet
    // Submit only if the new tile was added (handled in pointerdown)
    // and word length matches a valid target length
    const word = this.chain.map(t => t.letter).join('');
    const possibleMatch = this.couldBeValidWord(word);
    if (!possibleMatch) {
      // Chain can't possibly form any word — clear it
      this.shakeChain();
      this.time.delayedCall(300, () => this.clearChain());
    }
    // Otherwise leave chain active for more taps
    return;
  }

  // Swipe end — always attempt submit
  this.attemptSubmit();
}
```

`couldBeValidWord(prefix)` — returns true if any unfound
word starts with this exact letter sequence (using the
known paths). Gives tap mode a safety net.

---

### Path line rendering
Draw a line connecting the centers of all tiles in the chain.
Use a Phaser Graphics object, cleared and redrawn on every
chain change.

```typescript
redrawPath() {
  this.pathGraphics.clear();
  if (this.chain.length < 2) return;

  this.pathGraphics.lineStyle(CELL_SIZE * 0.18, 0x4a90d9, 0.7);
  this.pathGraphics.beginPath();
  this.pathGraphics.moveTo(this.chain[0].centerX, this.chain[0].centerY);

  for (let i = 1; i < this.chain.length; i++) {
    this.pathGraphics.lineTo(
      this.chain[i].centerX,
      this.chain[i].centerY
    );
  }
  this.pathGraphics.strokePath();
}
```

Draw the path BELOW the tile layer so tiles render on top.

---

### Tile visual states
Each tile has four visual states. Tween between them,
never set values instantly:

| State         | Scale | Alpha | Fill color         |
|---------------|-------|-------|--------------------|
| idle          | 1.0   | 1.0   | skin.tileFill      |
| selected      | 1.08  | 1.0   | skin.tileActive    |
| found-pending | 1.0   | 0.6   | skin.tileSolved    |
| deactivated   | 0.0   | 0.0   | — (gone)           |

"found-pending" = tile is part of a found word but still
visible because another word shares it. It dims but stays.
Fully deactivates when the last word using it is found.

---

### Deactivation animation — "glitch out"
When a tile deactivates, it should feel satisfying and
on-brand for GlitchSalad:

```typescript
glitchOut(tile: Tile) {
  // 1. Brief RGB split: offset duplicates of the tile
  //    (use two temporary image copies, offset ±4px in x,
  //    tinted red and cyan, fade in 40ms then fade out)
  // 2. Flicker: rapid alpha oscillation 3 times over 80ms
  // 3. Scale to 0 + fade: tween scale 1→0 and alpha 1→0
  //    over 120ms with ease-in
  // 4. Destroy the tile game object

  const duration = 240;
  this.tweens.add({
    targets: tile,
    scaleX: 0,
    scaleY: 0,
    alpha: 0,
    duration: duration * 0.5,
    delay: duration * 0.5,
    ease: 'Cubic.In',
    onComplete: () => tile.destroy()
  });
  // RGB flicker handled separately with timeline
}
```

---

### Cancel selection
```typescript
cancelSelection() {
  this.chain.forEach(t => t.setHighlight(false));
  this.chain = [];
  this.pathGraphics.clear();
  this.state = 'IDLE';
}
```

Called when:
- Pointer leaves board boundary during swipe
- Pointer lands on a non-adjacent tile during swipe
- pointerup with invalid word after shake delay

NOT called:
- Pointer is in dead zone between tiles (hold state)
- Pointer returns to previous tile in chain (backtrack instead)

---

### isOutsideBoard()
```typescript
isOutsideBoard(x: number, y: number): boolean {
  const padding = CELL_SIZE * 0.5; // generous margin
  return x < boardLeft - padding
      || x > boardRight + padding
      || y < boardTop - padding
      || y > boardBottom + padding;
}
```

Give a generous padding so a fast swipe that exits the board
by a few pixels doesn't immediately cancel. Only cancel
if clearly outside.

---

### Haptic feedback timing
- Tile added to chain: Light impact
- Backtrack (tile removed): Light impact (same, feels natural)
- Word found: Medium impact + short delay + Medium impact
- Invalid word: Warning notification
- Puzzle solved: Heavy impact + 200ms delay + Heavy impact

---

### Multi-touch
Ignore all secondary pointers. Only track pointer index 0.
```typescript
onPointerDown(pointer: Phaser.Input.Pointer) {
  if (pointer.id !== 0) return;
  // ...
}
```

- All Capacitor plugin calls wrapped in isNativePlatform() guards
- Skin is passed into GameScene via scene init data object,
  never read mid-game
- Tile ownership map is computed once at puzzle load,
  not recalculated during gameplay
- Multi-word answers (like "LARA CROFT") are found part by
  part — each part validated independently, same answer entry
- Hint boxes sorted alphabetically on puzzle load,
  order never changes during gameplay
- puzzles.json must be pre-validated offline before committing —
  build a separate Node.js validator script that checks every
  puzzle for: valid adjacency on all paths, correct grid letters,
  no out-of-bounds coordinates