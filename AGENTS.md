# GlitchSalad — Copilot Agent build prompt

A daily word puzzle for the LatAm / Spanish-speaking market, themed around gaming knowledge. Mechanic clones WordSalad (Bleppo Games): a 4×4 grid of letters where the player swipes adjacent letters to spell themed words. Tiles can be shared between words and only deactivate once *all* words that include them are found.

This document is the complete rewrite spec. The previous attempt used Phaser 3 + Capacitor 6 and is being scrapped down to its engine-agnostic logic.

---

## 1. Tech stack decision

**Capacitor 8 + DOM/CSS/SVG + TypeScript + Vite. Vanilla TS — no React, no Phaser, no game engine.**

Reasoning: this is a UI app with one custom touch gesture, not a game engine workload. Between user inputs the screen is static. The needed animations (tile scale-out, color shift, polyline draw, popup) are exactly what CSS does well. The mockup we built (`glitchsalad_mockup_v6`) is already the game visually — port the mockup, don't reinvent it.

Concrete stack:

- `@capacitor/core@8` + `@capacitor/cli@8` + `@capacitor/ios@8` + `@capacitor/android@8`
- `@capacitor/preferences@8`, `@capacitor/local-notifications@8`, `@capacitor/haptics@8`, `@capacitor/share@8`, `@capacitor/app@8`, `@capacitor/status-bar@8`
- `@capacitor-community/admob` (latest)
- `@revenuecat/purchases-capacitor` (latest)
- `typescript@5.x`, `vite@5.x`
- No React. No Phaser. No frontend framework. Pure DOM with TypeScript classes.

---

## 2. Project structure

```
glitchsalad/
├── src/
│   ├── main.ts                    # DOM bootstrap, mounts Router into #app
│   ├── index.css                  # global styles, font import, root layout
│   ├── skins/
│   │   ├── skins.css              # one block per skin: .skin-void {...}, .skin-synthwave {...}
│   │   └── registry.ts            # skin metadata: id, name, IAP product ID, free?
│   ├── views/
│   │   ├── Router.ts              # swaps a single child of #app between views
│   │   ├── MenuView.ts            # main menu (play, skins, stats)
│   │   ├── GameView.ts            # the puzzle screen
│   │   └── WinView.ts             # win modal contents
│   ├── components/
│   │   ├── Grid.ts                # 4×4 DOM grid + SVG path overlay
│   │   ├── Tile.ts                # ★ ENGINE-AGNOSTIC LOGIC, PORT VERBATIM
│   │   ├── HintRow.ts             # hint slots for one answer entry
│   │   ├── Header.ts              # hamburger | LEVEL N | timer + streak dots
│   │   └── WinPopup.ts            # win modal DOM
│   ├── game/
│   │   ├── InputManager.ts        # ★ ENGINE-AGNOSTIC, PORT VERBATIM
│   │   ├── PuzzleParser.ts        # ★ PORT VERBATIM
│   │   ├── PuzzleLoader.ts        # ★ PORT VERBATIM (date-math daily selection)
│   │   ├── tileOwnership.ts       # ★ PORT VERBATIM (shared-tile deactivation)
│   │   └── Grid.ts                # ⚠ REWRITE (fix coordinate bug, see §4)
│   ├── services/
│   │   ├── AdService.ts           # ★ PORT VERBATIM (AdMob wrapper)
│   │   ├── IAPService.ts          # ★ PORT VERBATIM (RevenueCat wrapper)
│   │   ├── ProgressService.ts     # ★ PORT VERBATIM (preferences keys)
│   │   └── NotificationService.ts # ★ PORT VERBATIM
│   ├── utils/
│   │   ├── i18n.ts                # ★ PORT VERBATIM
│   │   ├── merge-helper.ts        # ★ PORT VERBATIM
│   │   └── types.ts               # ★ PORT VERBATIM
│   ├── data/
│   │   └── puzzles.json           # ★ PORT VERBATIM (4 starter puzzles)
│   └── types/
│       └── puzzle.ts              # ★ PORT VERBATIM
├── scripts/
│   ├── validate-puzzles.ts        # ★ PORT VERBATIM
│   ├── test-grid.ts               # ⚠ UPDATE EXPECTATIONS (see §4)
│   ├── test-selection.ts          # ★ PORT VERBATIM
│   ├── test-ownership.ts          # ★ PORT VERBATIM
│   └── test-deactivation.ts       # ★ PORT VERBATIM
├── index.html                     # ⚠ REWRITE (mobile viewport, font preload, #app root)
├── capacitor.config.ts            # ★ PORT (update versions, app ID stays app.glitchsalad.game)
├── vite.config.ts                 # new
├── tsconfig.json                  # new
└── package.json                   # new (drop phaser, drop Capacitor 6 versions)
```

### Files to delete from the previous attempt

```
src/scenes/                        # all four Phaser scenes
src/game/renderers/                # all five canvas renderers
src/game/SkinManager.ts            # Phaser thin wrapper
src/game/coordMap.ts               # transpose workaround, no longer needed
src/skins/SkinManager.ts           # Phaser event-based
src/skins/skins.ts                 # legacy duplicate
src/main.ts                        # Phaser bootstrap
index.html                         # Phaser canvas mount
```

Drop `phaser` and any `@types/phaser` from `package.json`.

---

## 3. Architecture overview

- Single-page app. Vite builds to `dist/`. Capacitor `npx cap copy` syncs `dist/` into the iOS/Android shells.
- Root element is `<div id="app">` in `index.html`. A `Router` class mounts exactly one view (`MenuView`, `GameView`, `WinView`) as its only child.
- Each view is a plain TS class that creates DOM in its constructor and exposes update methods. No frameworks, no virtual DOM, no JSX. Imperative.
- Skins are CSS classes on `document.documentElement`. Switching skin = toggling a class. Every visual color reads from a CSS custom property; the skin class defines those properties.
- The 4×4 grid is a CSS Grid of 16 `<div class="tile">` elements. Tile state lives in `data-state="idle|selected|found-pending|deactivated"`. CSS rules style each state.
- The path connecting selected tiles is an absolutely-positioned `<svg>` sibling of the grid (NOT a child — must render above scaled selected tiles). Two `<path>` layers: halo (wide, translucent) + core (thin, bright).
- Touch handling: Pointer Events on the grid container, never per-tile. Use `setPointerCapture` so movement is tracked even if the pointer leaves the element. Hit detection is a circular distance check from the pointer to each tile's center, with a dead zone between hitboxes.

---

## 4. Coordinate system — CRITICAL FIX

The previous attempt had a bug. The puzzle data format uses **column-letter + row-number** (`a1` = column a, row 1 = top-left; `b3` = column b, row 3). The previous `Grid.ts` swapped this and used row-letter + column-number, then patched over the bug with a `coordMap.ts` transpose. We are fixing it for real and deleting `coordMap.ts`.

### Correct convention

A tile at visual position `[row, col]` has coordinate:

```typescript
const coord = `${String.fromCharCode(97 + col)}${row + 1}`;
// row=0, col=0 → "a1"  (top-left)
// row=0, col=3 → "d1"  (top-right)
// row=3, col=0 → "a4"  (bottom-left)
// row=3, col=3 → "d4"  (bottom-right)
```

### Grid letters under the correct mapping

Tracing the four words in the first puzzle (`videogameheroes`) — SONIC, LARA CROFT, MARIO — gives this canonical grid:

```
        col0  col1  col2  col3
row0:    S     O     N     I
row1:    T     F     C     R
row2:    L     A     O     A
row3:    O     I     R     M
```

Three shared tiles:
- `c2` (col 2, row 1) = C, shared by SONIC + CROFT
- `c4` (col 2, row 3) = R, shared by LARA + MARIO
- `d3` (col 3, row 2) = A, shared by LARA + MARIO

### Things to fix

1. **`src/game/Grid.ts`** — when assigning the `coord` for each tile, use `String.fromCharCode(97 + col)${row + 1}`. The existing `Tile.ts` getter already uses this formula, so just align Grid with Tile.
2. **Delete `src/game/coordMap.ts`** entirely.
3. **Find every call site** of `puzzleCoordToGridCoord(coord)` and replace with `coord` directly. (Most are in `tileOwnership.ts` and `Grid.ts`.)
4. **`scripts/test-grid.ts`** — update expectations: `rowString(0) === "SONI"` and `colString(0) === "STLO"`. The old expectations (`STLO` for row 0) reflected the buggy mapping.

---

## 5. Puzzle data format

Port verbatim from the previous repo. Spec for reference:

```typescript
// src/types/puzzle.ts
interface Puzzle {
  id: string;                          // e.g. "videogameheroes"
  date?: string;                       // optional pinned date "YYYY-MM-DD"
  i18n: {
    en: { title: string; hint: string };
    es: { title: string; hint: string };
  };
  answers: Answer[];
}

interface Answer {
  displayKey: string;                  // canonical key, e.g. "LARA_CROFT"
  i18n: {
    en: { display: string };           // "LARA CROFT"
    es: { display: string };           // "LARA CROFT"
  };
  parts: Part[];                       // multi-word answers have N parts
}

interface Part {
  word: string;                        // letters only, no spaces: "LARA", "CROFT"
  path: string;                        // 2-char pairs concatenated: "a3b3c4d3"
}
```

Paths are parsed by `PuzzleParser.ts` into `[row, col][]` arrays. Adjacency between consecutive cells is 8-directional (orthogonal + diagonal).

The first 4 puzzles ship bundled: `videogameheroes`, `chess`, `planets`, `street_fighters`. `videogameheroes` is pinned to `2025-01-01` (launch date) so it's always day 1.

---

## 6. Tile ownership and deactivation

Port `src/game/tileOwnership.ts` verbatim. Spec for reference:

At puzzle load, build a map from each tile coordinate to the set of word parts that include it:

```typescript
type TileOwnership = Map<string, Set<string>>;  // "row,col" → Set<partKey>
```

When a part is found, remove its key from every tile it touched. When a tile's set becomes empty, that tile fully deactivates. The tile stays visible (in `found-pending` state) as long as another unfound part still needs it.

This is what makes the shared tiles work cleanly: finding SONIC marks the `C` at (1, 2) as `found-pending` but doesn't remove it, because CROFT still needs that `C`.

---

## 7. Grid rendering (DOM)

The grid container is a CSS Grid:

```html
<div class="grid-wrap">
  <div class="grid" id="grid">
    <div class="tile" data-row="0" data-col="0" data-state="idle">S</div>
    <div class="tile" data-row="0" data-col="1" data-state="idle">O</div>
    <!-- ... 14 more ... -->
  </div>
  <svg class="path-overlay" id="path-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
    <path class="path-halo" d="" />
    <path class="path-core" d="" />
  </svg>
</div>
```

```css
.grid-wrap {
  position: relative;
  width: min(86vw, 360px);
  aspect-ratio: 1;
  margin: 0 auto;
}
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(4, 1fr);
  gap: 8px;
  width: 100%;
  height: 100%;
}
.tile {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Space Mono', monospace;
  font-size: clamp(28px, 7vw, 38px);
  font-weight: 700;
  letter-spacing: 0.02em;
  background: var(--tile-bg);
  color: var(--tile-letter);
  border: 1px solid var(--tile-border);
  border-radius: 14px;
  transition: transform 140ms ease-out, opacity 220ms ease-out, background 180ms ease-out, color 180ms ease-out, box-shadow 180ms ease-out;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: none;
}
.tile[data-state="selected"] {
  background: var(--tile-selected-bg);
  color: var(--tile-selected-letter);
  border-color: var(--tile-selected-border);
  box-shadow: 0 0 18px var(--tile-selected-glow);
  transform: scale(1.07);
  z-index: 1;
}
.tile[data-state="found-pending"] {
  background: var(--tile-found-bg);
  color: var(--tile-found-letter);
  border-color: var(--tile-found-border);
}
.tile[data-state="deactivated"] {
  transform: scale(0);
  opacity: 0;
  pointer-events: none;
}
.path-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;        /* MUST be above .tile[selected] which has z-index: 1 */
  overflow: visible;
}
.path-halo {
  fill: none;
  stroke: var(--path-color);
  stroke-opacity: 0.25;
  stroke-width: 18;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.path-core {
  fill: none;
  stroke: var(--path-color);
  stroke-opacity: 0.95;
  stroke-width: 6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
```

Render rules:

- `Grid.ts` mounts the 16 tile divs in row-major order and stores references.
- A tile's letter and `data-row`/`data-col` attributes never change after creation. Only `data-state` and `style.transform`/`style.opacity` change.
- The SVG path is redrawn on every chain change. The viewBox is normalized to the grid container's bounding rect (0,0 to W,H in pixels) and the path is built from tile center coordinates.

---

## 8. Input system — the part that has to feel right

Port `src/game/InputManager.ts` verbatim. It's a clean state machine (`IDLE` / `PENDING` / `SWIPING`) that takes a `getTileCenter(row, col): {x, y}` callback. Wire it to DOM by:

1. Attach pointer listeners to the `.grid-wrap` container (NOT individual tiles).
2. On `pointerdown`, call `element.setPointerCapture(e.pointerId)` so subsequent `pointermove` and `pointerup` events come to us even if the finger leaves the container.
3. Convert each pointer event's `clientX`/`clientY` to grid-local coordinates by subtracting the container's `getBoundingClientRect()` origin.
4. Pass that local point to `InputManager.onPointerMove(x, y)`. The InputManager runs the hit-detection and state machine, and emits events: `chainChanged`, `wordSubmitted(letters)`, `cancel`.

### Hit detection

A tile's hitbox is a **circle**, not its full square cell. This is the difference between "feels solid" and "feels jittery".

```typescript
const CELL = container.clientWidth / 4;
const HIT_RADIUS = CELL * 0.38;        // ~24% dead zone between adjacent hitboxes

function getTileAt(x: number, y: number): Tile | null {
  for (const t of tiles) {
    if (t.state === 'deactivated') continue;
    const c = getTileCenter(t.row, t.col);
    const d = Math.hypot(x - c.x, y - c.y);
    if (d <= HIT_RADIUS) return t;
  }
  return null;
}
```

### Behaviors the state machine implements (these are non-negotiable for feel)

| Situation | Behavior |
|---|---|
| Pointer enters adjacent tile's hitbox | Add to chain, light haptic |
| Pointer enters second-to-last tile in chain | Backtrack: remove last tile, light haptic |
| Pointer enters non-adjacent tile's hitbox | Cancel entire chain |
| Pointer in dead zone between tiles | Hold current chain, do nothing |
| Pointer exits grid container's padded bounds | Cancel chain |
| Pointer on already-selected tile (not second-to-last) | Ignore — no add, no cancel (user is wiggling) |
| `pointerup` on valid word | Submit, animate found-pending |
| `pointerup` on invalid word | Brief shake, warning haptic, clear chain after 300 ms |
| Multi-touch | Ignore secondary pointers (only track `pointerId === 0`) |

The state machine is already written. Just wire `getTileCenter` to read DOM positions.

### `getTileCenter`

```typescript
function getTileCenter(row: number, col: number): { x: number; y: number } {
  const el = tiles[row][col].element;
  const rect = el.getBoundingClientRect();
  const gridRect = container.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - gridRect.left,
    y: rect.top + rect.height / 2 - gridRect.top,
  };
}
```

Recompute on `resize` and on `orientationchange` — the InputManager caches centers but invalidates the cache when told.

### Path drawing

On every `chainChanged` event, rebuild the SVG path `d` attribute:

```typescript
function buildPathD(chain: Tile[]): string {
  if (chain.length < 1) return '';
  const points = chain.map(t => getTileCenter(t.row, t.col));
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`;
  return d;
}
```

Set the same `d` on both `.path-halo` and `.path-core`.

---

## 9. Visual spec (from mockup v6, VOID skin)

This is the free, default skin and the reference look for the whole game.

### Layout

- App fills viewport. Centered column max-width 390px on desktop, full-width on mobile.
- Page background: radial gradient from `#0d1118` at center to `#07090e` at edges, fixed.
- Vertical stack inside the column: Header (60 px) → Streak dots row (32 px) → Title (50 px) → Grid (≈360 px) → Hint rows (auto).
- Gaps between sections: 16 px.

### Header

Single row, 3 columns: `[hamburger]` left, `LEVEL 1` center, `0:47` right.

```css
.header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 16px 18px;
  color: var(--chrome-text);
  font-family: 'Space Mono', monospace;
  font-size: 14px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.header .level { justify-self: center; }
.header .timer { justify-self: end; font-variant-numeric: tabular-nums; }
```

### Streak dots

Row of 7 small dots, 8 px diameter, 8 px gap. First N are filled (`--dot-active`), rest are empty (`--dot-inactive`). N = current streak modulo 7.

### Title

Puzzle theme display, centered, 22 px, weight 700, letter-spacing 0.04em, color `var(--title-color)`, with a subtle text-shadow glow of `var(--title-glow)` at 0.4 opacity (`text-shadow: 0 0 12px ...`).

### Grid

See §7. The mockup uses tile background `linear-gradient(145deg, #1e2236, #131824)` for idle and `linear-gradient(145deg, #0d3a42, #071e26)` for selected, with selected glow `#00D4E8` at 40% opacity, scale 1.07. Letter color `#cfd6e1` idle, `#9af0ff` selected.

### Hint rows

One row per answer entry, sorted alphabetically by `displayKey`. Each row is a flex container of slot boxes:

```css
.hint-row {
  display: flex;
  gap: 4px;
  justify-content: center;
  margin-top: 6px;
}
.hint-row .word-gap {
  width: 12px;       /* visual separator between words in multi-word answers */
}
.hint-slot {
  width: 22px;
  height: 30px;
  border-radius: 6px;
  background: var(--hint-empty-bg);
  border: 1px solid var(--hint-empty-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: transparent;
  font-family: 'Space Mono', monospace;
  font-size: 14px;
  font-weight: 700;
  transition: background 200ms ease, border-color 200ms ease, color 200ms ease;
}
.hint-slot[data-filled="true"] {
  color: var(--hint-solved-letter);
}
.hint-row[data-solved="true"] .hint-slot {
  background: var(--hint-solved-bg);
  border-color: var(--hint-solved-border);
}
```

Multi-word answers (like `LARA CROFT`): one `.hint-row` containing slots for "LARA", a `.word-gap`, then slots for "CROFT". Filling LARA fills its 4 slots; filling CROFT fills the remaining 5. The whole row only switches to `data-solved="true"` once **all parts** are found.

### Win state

When all answers are found, show a centered modal (DOM, no canvas). Display: theme title, time taken, current streak, two buttons (`Share`, `Done`). Share uses `@capacitor/share`.

### Things explicitly cut from the mockup

- Background scanlines
- Background noise texture
- RGB-split on deactivation
- Vignette
- Near-word pulse
- Ribbon-disappear effect on deactivate
- Third path layer (we keep halo + core, drop the inner "body" layer)

These were sources of GPU jank and visual noise. Keep clean cyan-on-dark.

---

## 10. Skin system

Three skins ship, monetized as IAP:

| Skin ID | Name | Price | RevenueCat product ID |
|---|---|---|---|
| `void` | Void | free | — |
| `synthwave` | Synthwave | $0.99 | `skin_synthwave` |
| `gameboy` | Game Boy | $0.99 | `skin_pixel` |
| (bundle) | All skins | $1.99 | `skin_bundle` |

A skin is **only** a set of CSS custom property values. No JS configuration, no per-skin behavior toggles.

### `src/skins/registry.ts`

```typescript
export interface SkinMeta {
  id: string;
  name: string;
  productId: string | null;       // null = free
  bundleProductId?: string;       // entitlement that also unlocks this skin
}

export const SKINS: SkinMeta[] = [
  { id: 'void',      name: 'Void',      productId: null },
  { id: 'synthwave', name: 'Synthwave', productId: 'skin_synthwave', bundleProductId: 'skin_bundle' },
  { id: 'gameboy',   name: 'Game Boy',  productId: 'skin_pixel',     bundleProductId: 'skin_bundle' },
];
```

### `src/skins/skins.css`

```css
:root {
  /* default = void */
  --bg-center: #0d1118;
  --bg-edge: #07090e;
  --tile-bg: linear-gradient(145deg, #1e2236, #131824);
  --tile-border: #2a3148;
  --tile-letter: #cfd6e1;
  --tile-selected-bg: linear-gradient(145deg, #0d3a42, #071e26);
  --tile-selected-border: #00D4E8;
  --tile-selected-letter: #9af0ff;
  --tile-selected-glow: #00D4E866;
  --tile-found-bg: linear-gradient(145deg, #143844, #0a1f26);
  --tile-found-border: #1d6a78;
  --tile-found-letter: #6fc4d4;
  --path-color: #00D4E8;
  --hint-empty-bg: #14182230;
  --hint-empty-border: #2a3148;
  --hint-solved-bg: #1e4d2b;
  --hint-solved-border: #2faa55;
  --hint-solved-letter: #b5f2c4;
  --chrome-text: #8590a7;
  --title-color: #cfd6e1;
  --title-glow: #00D4E8;
  --dot-active: #00D4E8;
  --dot-inactive: #2a3148;
}

.skin-synthwave {
  --bg-center: #1a0826;
  --bg-edge: #0a0414;
  --tile-bg: linear-gradient(145deg, #2a0d3c, #150620);
  --tile-border: #4a1f6a;
  --tile-letter: #f8d8ff;
  --tile-selected-bg: linear-gradient(145deg, #ff2bd6, #6a0f9a);
  --tile-selected-border: #ff7af0;
  --tile-selected-letter: #ffffff;
  --tile-selected-glow: #ff2bd699;
  --tile-found-bg: linear-gradient(145deg, #3c1450, #1a0828);
  --tile-found-border: #7a2ca8;
  --tile-found-letter: #d895f0;
  --path-color: #ff2bd6;
  --hint-empty-bg: #15062030;
  --hint-empty-border: #4a1f6a;
  --hint-solved-bg: #ff2bd6;
  --hint-solved-border: #ff7af0;
  --hint-solved-letter: #ffffff;
  --chrome-text: #c89cdb;
  --title-color: #f8d8ff;
  --title-glow: #ff2bd6;
  --dot-active: #ff2bd6;
  --dot-inactive: #4a1f6a;
}

.skin-gameboy {
  --bg-center: #2d402d;
  --bg-edge: #1a2a1a;
  --tile-bg: linear-gradient(145deg, #6a8060, #4a5e44);
  --tile-border: #2d3e2d;
  --tile-letter: #0d1a0d;
  --tile-selected-bg: linear-gradient(145deg, #b5d68f, #7ea05c);
  --tile-selected-border: #1a2a1a;
  --tile-selected-letter: #0d1a0d;
  --tile-selected-glow: #b5d68f99;
  --tile-found-bg: linear-gradient(145deg, #3d5238, #2a3e26);
  --tile-found-border: #1a2a1a;
  --tile-found-letter: #8aa872;
  --path-color: #0d1a0d;
  --hint-empty-bg: #1a2a1a40;
  --hint-empty-border: #2d3e2d;
  --hint-solved-bg: #b5d68f;
  --hint-solved-border: #1a2a1a;
  --hint-solved-letter: #0d1a0d;
  --chrome-text: #8aa872;
  --title-color: #b5d68f;
  --title-glow: #b5d68f;
  --dot-active: #b5d68f;
  --dot-inactive: #2d3e2d;
}
```

### Switching skins

```typescript
function applySkin(skinId: string) {
  document.documentElement.classList.remove('skin-void', 'skin-synthwave', 'skin-gameboy');
  if (skinId !== 'void') document.documentElement.classList.add(`skin-${skinId}`);
}
```

### IAP gating

When the user taps a locked skin in the menu, call `IAPService.purchase(productId)`. On success, persist their selection and call `applySkin`. On app start, check entitlements against `SKINS[].productId` and `bundleProductId` to determine which skins are unlocked.

---

## 11. Capacitor 8 setup

`capacitor.config.ts`:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.glitchsalad.game',
  appName: 'GlitchSalad',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#00D4E8',
    },
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#07090e',
      showSpinner: false,
    },
  },
};

export default config;
```

Capacitor 8 requires Xcode 16+ and Android Studio Otter (2025.2.1)+. Bump `minSdkVersion` and `iOSDeploymentTarget` per the v8 migration guide.

---

## 12. Services — port verbatim, just bump versions

### IAPService (RevenueCat)

The previous repo's `src/services/IAPService.ts` is already correct in shape:

```typescript
import { Purchases } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

export const PRODUCTS = {
  REMOVE_ADS: 'remove_ads',
  SKIN_SYNTHWAVE: 'skin_synthwave',
  SKIN_PIXEL: 'skin_pixel',
  SKIN_BUNDLE: 'skin_bundle',
} as const;

export async function initIAP(apiKey: string) {
  if (!Capacitor.isNativePlatform()) return;
  await Purchases.configure({ apiKey });
}

export async function hasEntitlement(productId: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const { customerInfo } = await Purchases.getCustomerInfo();
  return productId in customerInfo.entitlements.active;
}

export async function purchase(productId: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const { offerings } = await Purchases.getOfferings();
  const pkg = offerings.current?.availablePackages.find(
    p => p.product.identifier === productId
  );
  if (!pkg) throw new Error(`Product ${productId} not found in offerings`);
  await Purchases.purchasePackage({ aPackage: pkg });
  return hasEntitlement(productId);
}

export async function restore() {
  if (!Capacitor.isNativePlatform()) return;
  await Purchases.restorePurchases();
}
```

### AdService (AdMob)

```typescript
import { AdMob } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';
import { hasEntitlement, PRODUCTS } from './IAPService';

const INTERSTITIAL_ID_IOS = 'ca-app-pub-XXX/XXX';
const INTERSTITIAL_ID_ANDROID = 'ca-app-pub-XXX/XXX';
const PUZZLES_PER_AD = 2;

export async function initAds() {
  if (!Capacitor.isNativePlatform()) return;
  await AdMob.initialize({ testingDevices: [], initializeForTesting: false });
  await prepareInterstitial();
}

async function prepareInterstitial() {
  const adId = Capacitor.getPlatform() === 'ios' ? INTERSTITIAL_ID_IOS : INTERSTITIAL_ID_ANDROID;
  await AdMob.prepareInterstitial({ adId });
}

export async function maybeShowInterstitial(puzzlesSolvedCount: number) {
  if (!Capacitor.isNativePlatform()) return;
  if (await hasEntitlement(PRODUCTS.REMOVE_ADS)) return;
  if (puzzlesSolvedCount % PUZZLES_PER_AD !== 0) return;
  await AdMob.showInterstitial();
  await prepareInterstitial();
}
```

### NotificationService — daily 9 AM

```typescript
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';

export async function scheduleDaily() {
  const { value } = await Preferences.get({ key: 'notification_scheduled' });
  if (value === 'true') return;

  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return;

  await LocalNotifications.schedule({
    notifications: [{
      id: 1,
      title: 'Nuevo puzzle disponible',
      body: 'Tu reto diario de GlitchSalad está listo.',
      schedule: { on: { hour: 9, minute: 0 }, repeats: true, allowWhileIdle: true },
    }],
  });

  await Preferences.set({ key: 'notification_scheduled', value: 'true' });
}
```

### ProgressService — preferences keys

| Key | Type | Purpose |
|---|---|---|
| `solved_ids` | `string[]` JSON | Puzzle IDs the user has completed |
| `solved_times` | `Record<id, seconds>` JSON | Time-to-solve per puzzle |
| `puzzles_solved_count` | `number` | Total count (drives ad cadence) |
| `active_skin` | `string` | Current skin ID |
| `last_played_date` | ISO date string | For streak tracking |
| `current_streak` | `number` | Consecutive daily plays |
| `best_streak` | `number` | All-time best |
| `notification_scheduled` | `'true' \| 'false'` | One-time setup flag |
| `puzzles_remote` | JSON string | Cached remote puzzles (future CDN drop) |

---

## 13. MVP build order

Build incrementally, verifying each step before moving on:

1. **Scaffold.** Vite + TypeScript + Capacitor 8. `index.html` with `<div id="app">`. Mount a placeholder.
2. **Port engine-agnostic logic.** Copy `Tile.ts`, `InputManager.ts`, `PuzzleParser.ts`, `PuzzleLoader.ts`, `tileOwnership.ts`, `utils/*`, `services/*`, `types/puzzle.ts`, `data/puzzles.json`, all `scripts/test-*.ts`. Drop their Phaser imports if any sneak through.
3. **Fix Grid.ts coordinates** (§4). Delete `coordMap.ts`. Update `scripts/test-grid.ts` expectations. Run `validate-puzzles.ts` and `test-grid.ts` — both must pass.
4. **Render a static puzzle.** GameView mounts: header (hardcoded text), 4×4 grid, hint rows. Visually it should match mockup v6.
5. **Wire input.** Pointer events on the grid container, `setPointerCapture`, hit detection, InputManager state machine. Selection highlights work, path SVG draws between selected tiles.
6. **Word validation.** On `pointerup`, check letter sequence against unfound parts. On match, transition tiles to `found-pending`.
7. **Deactivation.** When a tile's ownership set empties, set `data-state="deactivated"`. CSS transition handles the visual.
8. **Hint rows.** Fill slots as parts are found. Light up row when all parts of an answer complete.
9. **Timer + win condition.** Count up from 0:00, freeze on win. Show WinView modal.
10. **Daily puzzle selection.** Use `PuzzleLoader.ts` date math from `LAUNCH_DATE = '2025-01-01'`.
11. **Progress persistence.** Save solved IDs, times, streak. Restore on app start.
12. **Skins.** Skin picker in MenuView. Apply skin class on root. Persist `active_skin`.
13. **AdMob.** Interstitial every 2 solved puzzles, gated by `remove_ads`.
14. **RevenueCat IAP.** Wire skin purchases, restore button, entitlement check.
15. **Daily notifications.** Schedule on first launch.
16. **Capacitor builds.** `npx cap add ios && npx cap add android`, copy, test on device.

Each step has visible output. If step N feels wrong, the bug is in step N — don't pile features on a broken base.

---

## 14. Critical "don'ts"

These are the patterns that killed performance in the previous DOM attempt. Avoid all of them:

- **Don't use React.** Imperative gesture state doesn't benefit from declarative re-rendering. React with frequent state updates on pointermove will tank the frame rate, exactly what burned us before.
- **Don't attach pointer listeners per-tile.** All input goes on the grid container.
- **Don't animate with `setInterval` or `setTimeout` loops.** Use CSS transitions. The browser already animates them on the compositor.
- **Don't use `backdrop-filter`, `filter: blur()`, or heavy `box-shadow` blur values on many elements.** They force the GPU to recomposite. The mockup uses one subtle box-shadow on selected tiles (only 1 tile at a time) and that's it.
- **Don't recalculate tile centers on every pointermove.** Cache them; invalidate on resize / orientationchange.
- **Don't trigger layout in pointermove handlers.** Reading `getBoundingClientRect()` once per pointer interaction (in pointerdown) is fine. Reading it 60× per second on pointermove forces synchronous layout.
- **Don't use third-party gesture libraries.** Pointer Events are well-supported on every target platform; the InputManager state machine already handles every edge case.
- **Don't render the path with DOM elements.** SVG paths only. The browser can update an SVG `d` attribute 60 times per second cheaply.
- **Don't ship copyrighted skin assets disguised as IAP.** "Game Boy" and "Synthwave" are aesthetic genres, not branded IP. No Nintendo green, no Trapper Keeper logos, no recognizable franchise palettes.

---

## 15. Notes for the agent

- Run `npm run validate` (script that runs `validate-puzzles.ts`, `test-grid.ts`, `test-selection.ts`, `test-ownership.ts`, `test-deactivation.ts`) after every change to the game logic. All five must stay green.
- Always test on a real device for input feel. Desktop browser DevTools touch emulation is a rough approximation, not the truth.
- When in doubt about visuals, open `glitchsalad_mockup_v6.html` and copy the CSS values exactly. The mockup is the source of truth for the VOID skin look.
- Capacitor plugin calls must be guarded by `Capacitor.isNativePlatform()` so web builds don't throw. The web build is useful for fast iteration; only IAP, ads, and notifications need to no-op on web.
- `package.json` should not contain `phaser`, `@types/phaser`, or any Capacitor 6 versions. Verify before shipping.

That's the full spec. Build incrementally, keep the green tests green, and the result will match the mockup.
