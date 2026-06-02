# Ludodex — Skin Authoring & Implementation Guide

A complete, self-contained recipe for adding a new skin to Ludodex, from concept
to a verified build. Written so an LLM (or a human) with **no prior context** can
follow it end to end.

**To build a new skin, share these files with the assistant:**
1. `docs/making-skins.md` — this file
2. `src/skins/skins.css` — existing skins as color/font references
3. `src/skins/registry.ts` — current `SkinId` union and `SKINS` array
4. `docs/skins-roadmap.md` — candidate skin ideas, packs, and font licensing policy

---

## 0. TL;DR

A skin is **one CSS class** on `<html>` (`.skin-<id>`) that overrides a set of CSS
variables, plus **one entry** in a TypeScript registry. Everything visual flows
from those variables. To add a skin you touch **2 files** (3 if it needs a new
font):

1. `src/skins/skins.css` — add a `.skin-<id> { … }` block of variable overrides.
2. `src/skins/registry.ts` — add the `SkinId` and a `SKINS` entry (with a preview tile).
3. `src/main.ts` + `package.json` — only if the skin uses a **new font**.

Then build-verify. No changes to game logic, the grid, the ribbon code, or the
settings UI are ever needed — they all read the variables.

**Hard rules:** colors live only in `skins.css` (never hardcode hex elsewhere);
skins are cosmetic only (never change layout or hitboxes); display fonts go on
identity text only, not functional chrome (see §3).

---

## 1. How skins work (architecture)

- **Mechanism:** `applySkin(id)` (in `src/skins/registry.ts`) adds `skin-<id>` to
  `<html>`. CSS variables scoped to `.skin-<id>` then cascade to the whole app.
  `void` is the default and is represented by the **`:root` block itself** — it has
  no `.skin-void` class; absence of any skin class = void.
- **Source of truth for color/typography:** `src/skins/skins.css`. `:root` holds
  the void baseline (every variable, defined once). Each `.skin-<id>` block
  overrides only what differs.
- **Consumers:** `src/index.css` styles every component using `var(--…)`. You do
  **not** edit `index.css` to add a skin — it already consumes the variables.
- **Registry:** `src/skins/registry.ts` — the `SkinId` union, the `SKINS` array
  (metadata + a `previewTile` used by the Settings swatch), and `applySkin` /
  `normalizeSkinId` / `getCurrentSkinId`.
- **Fonts:** bundled via `@fontsource/*` npm packages, imported in `src/main.ts`.
  Bundled (not CDN) so they work offline in the native iOS/Android (Capacitor) builds.
- **Ownership / availability:** `isSkinOwned()` in `src/services/IAPService.ts`.
  On **web all skins are free**. On **native** a skin unlocks via IAP (`productId`)
  or an achievement (`unlockedByAchievement`), or is free everywhere with
  `productId: null`. **The web has no monetization — every skin is free there —
  so the earn/pay fields only ever matter on native. Every skin is available on
  every platform; there is no web-only / platform-exclusive skin.**
- **Persistence:** the chosen skin is stored via `ProgressService`
  (`getActiveSkinId` / `setActiveSkinId`); restored on boot in `main.ts`.

---

## 2. Files you'll touch

| File | What you add |
|---|---|
| `src/skins/skins.css` | The `.skin-<id>` variable block. Plus, for a **new font**, per-font scale constants in `:root`. |
| `src/skins/registry.ts` | `SkinId` union member + `SKINS` entry with `previewTile`. |
| `src/main.ts` | New-font only: one `@fontsource/<font>/latin-<weight>.css` import. |
| `package.json` | New-font only: the `@fontsource/<font>` dependency. |

Optional / rarely:
- `src/i18n/*.ts` + `getSkinName()` in `SettingsView.ts` — only to **localize** the
  skin's display name. If you skip it, `getSkinName` falls back to the registry
  `name` field automatically (fine for test skins).
- `src/services/IAPService.ts` — only to ship a skin to **native** with real pricing.

---

## 3. Design principles (do not violate)

1. **Colors are variables, only in `skins.css`.** Never hardcode a hex/rgb value
   in `index.css` or a component. If a color needs to differ per skin, it's a
   variable. (One sanctioned exception exists today: `.modal-button-destructive`
   stays red on purpose.)
2. **Skins are cosmetic only.** Never change grid layout, cell size, or hitboxes.
   Tile glyph size is scaled with `--tile-font-scale` *inside* the fixed cell;
   the cell itself never moves.
3. **Frame vs. content for FONTS.** The skin display font goes on **identity /
   display text only**: the `LUDODEX` wordmark, the level title, tile letters,
   hint-answer letters, and the win-screen `FLAWLESS` label + result time.
   **Functional chrome stays neutral mono** — the header (`← MENU`, timer, hint
   count), body copy, settings labels. Colors theme *everything*; fonts do not.
4. **One font or two — both are valid.** Most skins use one font for both tiles
   (`--tile-font-family`) and the wordmark/titles (`--wordmark-font-family`).
   But some aesthetics call for a split: a bold display font for the wordmark and
   a different font for tiles. **Phobos** does this — AmazDooMRight2 for the
   wordmark (the Doom logo feel) and DooM for tiles (the authentic HUD pixel font).
   Use two fonts when the skin has a strong *title identity* that doesn't read well
   at tile size, or a great *tile font* that's too quirky for headings. Don't split
   just for variety — both fonts must serve the same aesthetic.
5. **Optical sizing is per-font, not per-skin.** Different fonts fill their
   em-box differently, so each font has a tuned scale defined once and reused
   (see §5). Tiles and display text get *separate* scales for the same font.
6. **Match font-weight to what the font ships.** Pixel/display fonts often ship a
   single weight (Press Start 2P 400, VT323 400). Set `--tile-font-weight` /
   `--wordmark-font-weight` to that weight, or the browser fakes bold and it looks
   wrong.

---

## 4. Complete variable reference

Every variable below is defined in `:root` (void baseline) in `skins.css`. A skin
overrides any subset. Grouped by what they control.

### Background & shell
- `--bg-center`, `--bg-edge` — radial page background (center → edge).
- `--shell-bg` — app shell panel background (**gradient** — see gotcha §8).
- `--shell-border`, `--shell-shadow` — shell frame.

### Chrome & title
- `--chrome-text` — muted UI text (labels, header).
- `--title-color` — primary heading text color.
- `--title-glow` — accent/brand color; used for glows, the wordmark color, the
  hint-counter, scanline FX, confetti, etc. **The skin's signature color.**
  ⚠️ **Must be fully opaque.** Many UI elements use `--title-glow` as a text
  color (hint counter, archive stars, achievement count, stat highlights). A
  semi-transparent value (e.g. `rgba(…, 0.4)`) will cause low-contrast text
  across the app. If your skin's glow effect needs transparency, apply it at
  the use site (e.g. `color-mix`, `opacity` on a wrapper) — never in the
  variable definition itself. On monochromatic skins (e.g. Dot Matrix),
  `--title-glow` and `--title-color` will naturally be close in hue — that's
  fine and expected.

### Buttons
- `--button-bg`, `--button-border`, `--button-text`, `--button-hover-bg`,
  `--button-active-bg`, `--button-active-border`, `--button-active-text`.
- `--primary-action-bg`, `--primary-action-text` — the primary CTA (PLAY/SHARE).

### Tiles — grid cells
- Idle: `--tile-bg` (gradient), `--tile-border`, `--tile-letter`.
- Selected (during a swipe): `--tile-selected-bg` (gradient), `--tile-selected-border`,
  `--tile-selected-letter`, `--tile-selected-glow`.
- Found/solved: `--tile-found-bg` (gradient), `--tile-found-border`, `--tile-found-letter`.
- `--tile-deactivated-opacity` — dimming for unusable tiles.

### Selection ribbon (the swipe trail)
- `--path-grad-start`, `--path-grad-end` — the ribbon is tinted along swipe order
  between these two colors (a progress gradient). **Set them equal for a flat,
  single-color ribbon** (Game Boy does this). These are **also reused** for the
  win-screen glitch chromatic split.
- `--path-width` (e.g. `9px`), `--path-cap` (`round` | `butt`), `--path-opacity`,
  `--path-glow` (drop-shadow blur in px; `0` = flat, no glow).
- `--path-color` — legacy single color; still used by the tutorial trail. Keep it
  defined (set it to your accent).
- `--selected-letter-outline` — a thin outline drawn on selected tile letters so
  they stay legible where the ribbon crosses under them. Use a color that
  contrasts the letter (dark outline for light letters, light for dark).

### Hints — the answer slots at the bottom
- Empty: `--hint-empty-bg`, `--hint-empty-border`, `--hint-empty-letter`
  (usually `transparent`).
- Solved/revealed: `--hint-solved-bg` (**solid color, not a gradient**),
  `--hint-solved-border`, `--hint-solved-letter` (must contrast `--hint-solved-bg`).

### Skin-selector buttons (Settings)
- `--skin-button-bg`, `--skin-button-border`, `--skin-button-text`,
  `--skin-button-active-bg`, `--skin-button-active-border`, `--skin-button-active-text`.

### Typography & shape
- `--tile-font-family`, `--tile-font-weight`, `--tile-font-scale` — grid letters.
- `--tile-radius` — tile corner radius (`0` = square, e.g. Game Boy).
- `--wordmark-font-family`, `--wordmark-font-weight`, `--wordmark-letter-spacing` —
  the `LUDODEX` wordmark **and** the level/win titles + `FLAWLESS` (they share the
  display font).
- `--display-font-scale` — optical size for the wordmark/titles (see §5).
- `--glow-strength` — multiplier on selection-glow and wordmark/title glow blur
  (`0` = no glow, e.g. Game Boy; `1.7` = strong bloom, e.g. Synthwave).

### Per-font scale constants (defined in `:root`, referenced by skins — see §5)
| Font | `--tile-scale-*` | `--display-scale-*` | Weights bundled | Used by |
|---|---|---|---|---|
| Orbitron | `0.84` | `0.9` | 700 | Synthwave, Crimson |
| Press Start 2P | `0.62` | `0.84` | 400 | Dot Matrix, Phobos (tiles) |
| Silkscreen | _(tile only)_ | `1.0` | 700 | Dot Matrix (wordmark) |
| VT323 | `1.18` | `1.45` | 400 | Terminal, Phosphor |
| Cinzel | `0.78` | `1.0` | 400, 700 | Underworld |
| AmazDooMRight2 | _(wordmark only)_ | `0.9` | 400 | Phobos (wordmark) |
| DooM | `1.0` | _(tile only)_ | 400 | Phobos (tiles) |

---

## 5. The per-font optical-scale system

Fonts render at different visual sizes for the same `font-size` (VT323 and
Silkscreen look small; Orbitron looks large). To keep tiles and titles consistent
across skins, each font has a **scale multiplier defined once** in `:root` and
**referenced** by every skin that uses that font. Tweak the font in one place →
every skin using it updates.

There are **two** scale families because tiles and titles want different sizes for
the same font:
- `--tile-scale-<font>` → consumed via `--tile-font-scale` on `.tile`.
- `--display-scale-<font>` → consumed via `--display-font-scale` on the wordmark/titles.

A skin **references** the constant; it does not hardcode a number:

```css
.skin-synthwave {
  --tile-font-scale: var(--tile-scale-orbitron);
  --display-font-scale: var(--display-scale-orbitron);
}
```

Space Mono (void's font) is the `1.0` baseline and needs no constant.

**Adding a new font?** Add its two constants to the `:root` blocks first, then
reference them. Starting values: pixel/terminal fonts usually need scaling up
(VT323 ≈ 1.18 tile / 1.45 display), geometric display fonts down (Orbitron ≈ 0.84
tile / 0.9 display). **These need eyeballing** — render and adjust.

---

## 6. Step-by-step: add a skin

### Step 1 — Define the concept
Pick: an `id` (lowercase, e.g. `terminal`), a display `name` (`Terminal`), a
palette (bg, accent, tile colors, etc.), tile font, wordmark font, corner radius,
and glow level. Keep it on-theme for a video-game word puzzle.

### Step 2 — Fonts (skip if reusing an already-bundled font)
Already bundled: **Space Mono**, **Orbitron**, **Press Start 2P**, **Silkscreen**,
**VT323**. If the skin reuses one of these, do nothing here.

For a **new** font:
1. Add the dependency to `package.json` (e.g. `"@fontsource/<font>": "^5.x"`).
2. Import the **latin subset** and **only the weights used** in `src/main.ts`:
   ```ts
   import '@fontsource/<font>/latin-<weight>.css';
   ```
   (Latin-only keeps the bundle lean; importing `/<weight>.css` instead pulls every
   subset — don't.)
3. Add the per-font scale constants to `:root` in `skins.css` (§5).

### Step 3 — Add the `.skin-<id>` block in `skins.css`
Copy the template in §7.1 and fill in every variable. Use the existing skins as
color references. Set `--tile-font-scale` / `--display-font-scale` to the
per-font constants. Match `--tile-font-weight` / `--wordmark-font-weight` to what
the font ships.

### Step 4 — Register it in `registry.ts`
1. Add the id to the `SkinId` union.
2. Add a `SKINS` entry (template in §7.2). The `previewTile` drives the Settings
   swatch — set its `font`, `radius`, and `scale` to match the skin so the
   preview reflects it.
3. Choose availability (full details + current status in **§11**). Every skin
   appears on every platform; the web is always free, so these fields only gate
   native:
   - **Free everywhere:** `productId: null`, no achievement. (Good for trialing a
     new skin — it's just free on web and native.)
   - **Earned by play (works today):** `unlockedByAchievement: '<id>'` + `unlockHint`.
   - **Paid (needs store wiring first):** `productId` (+ catalog entry), optionally
     `bundleProductId`. See §11 — the IAP path is scaffolded but not yet live.

### Step 5 — Name localization (optional)
`getSkinName()` in `SettingsView.ts` returns the registry `name` for any skin
without an explicit i18n branch, so a test skin needs nothing. To localize, add
`skin.<id>.name` to `src/i18n/*.ts` and a branch in `getSkinName`.

### Step 6 — Build & verify (§9).

### Step 7 — Visual check
Render the grid, the wordmark/level title, the hint row (empty + solved), the
selection ribbon (including a self-crossing path), and the win screen. Tune the
scale numbers and any low-contrast colors.

---

## 7. Copy-paste templates

### 7.1 `skins.css` block
```css
/* ── <Name> ── short description of the concept. */
.skin-<id> {
  /* Background & shell */
  --bg-center: #______;
  --bg-edge: #______;
  --shell-bg: linear-gradient(180deg, rgba(_,_,_,0.9), rgba(_,_,_,0.95));
  --shell-border: #______;

  /* Chrome & title */
  --chrome-text: #______;
  --title-color: #______;
  --title-glow: #______;            /* signature accent */

  /* Buttons */
  --button-bg: #______;
  --button-border: #______;
  --button-text: #______;
  --button-hover-bg: rgba(_,_,_,0.7);
  --button-active-bg: rgba(_,_,_,0.22);
  --button-active-border: #______;
  --button-active-text: #______;

  /* Tiles */
  --tile-bg: linear-gradient(145deg, #______, #______);
  --tile-border: #______;
  --tile-letter: #______;
  --tile-selected-bg: linear-gradient(145deg, #______, #______);
  --tile-selected-border: #______;
  --tile-selected-letter: #______;
  --tile-selected-glow: rgba(_,_,_,0.5);
  --tile-found-bg: linear-gradient(145deg, #______, #______);
  --tile-found-border: #______;
  --tile-found-letter: #______;

  /* Path / primary action / hints / skin-buttons */
  --path-color: #______;
  --primary-action-bg: #______;
  --primary-action-text: #______;
  --hint-empty-bg: rgba(_,_,_,0.19);
  --hint-empty-border: #______;
  --hint-solved-bg: #______;        /* SOLID, not a gradient */
  --hint-solved-border: #______;
  --hint-solved-letter: #______;    /* must contrast --hint-solved-bg */
  --skin-button-bg: rgba(_,_,_,0.82);
  --skin-button-border: #______;
  --skin-button-text: #______;
  --skin-button-active-bg: rgba(_,_,_,0.22);
  --skin-button-active-border: #______;
  --skin-button-active-text: #______;

  /* Typography & shape */
  --tile-font-family: '<Font>', monospace;
  --tile-font-weight: <weight the font ships>;
  --tile-font-scale: var(--tile-scale-<font>);
  --tile-radius: <e.g. 14px | 0px>;
  --wordmark-font-family: '<Font>', monospace;
  --wordmark-font-weight: <weight>;
  --wordmark-letter-spacing: 0.1em;
  --display-font-scale: var(--display-scale-<font>);
  --glow-strength: <0 .. ~1.7>;

  /* Selection ribbon */
  --path-grad-start: #______;       /* == end for a flat ribbon */
  --path-grad-end: #______;
  --path-width: 9px;
  --path-cap: round;                /* butt for pixel skins */
  --path-opacity: 0.95;
  --path-glow: <0 .. ~14>;
  --selected-letter-outline: #______;  /* contrasts the selected letter */
}
```
If you added a new font, also add to `:root`:
```css
  --tile-scale-<font>: <starting value>;
  --display-scale-<font>: <starting value>;
```

### 7.2 `registry.ts` entry
```ts
// 1) add to the union:
export type SkinId = 'void' | 'synthwave' | 'gameboy' | 'terminal' | 'crimson' | '<id>';

// 2) add to the SKINS array:
{
  id: '<id>',
  name: '<Name>',
  productId: null,        // null = free everywhere; or 'skin_<id>' for native IAP
  // unlockedByAchievement: 'solve_10',   // native: free if achievement earned
  // unlockHint: '10 puzzles solved',
  // bundleProductId: 'skin_bundle',
  previewTile: {
    bg: 'linear-gradient(145deg, #______, #______)',   // mirror --tile-selected-bg
    border: '#______',
    letter: '#______',
    glow: 'rgba(_,_,_,0.6)',
    font: "'<Font>', monospace",   // the skin's tile font
    radius: '<e.g. 8px | 0>',
    scale: <e.g. 1 | 0.84 | 1.18>  // optical scale for the swatch
  }
}
```

---

## 8. Gotchas (hard-won — read these)

1. **`color-mix()` only accepts colors, never gradients.** `--tile-*-bg`,
   `--shell-bg` are **gradients**. `color-mix(in srgb, var(--tile-selected-bg) 84%, …)`
   is **invalid** and silently fails (the declaration is dropped, falling back to
   whatever came before — often an invisible result). If you need to blend, use a
   **solid** variable (e.g. `--hint-solved-bg`, `--title-glow`, `--button-bg`).
2. **PurgeCSS runs on production builds.** `.skin-*` is safelisted, so skin classes
   survive. But: (a) any class applied only via a JS string must appear **literally**
   in source; (b) `variables: true` prunes **unused** CSS variables — every variable
   you define must be **consumed** somewhere in retained CSS (the templates here are
   all consumed already). `@font-face` and `@keyframes` are not purged.
3. **Don't create a stacking context on `.tile` (selected state).** No `transform`,
   `isolation`, `z-index`, `filter`, or `opacity` on `.tile[data-state="selected"]`
   — any of these traps the letter beneath the ribbon overlay (ribbon is `z-index:10`,
   `.tile-letter` is `z-index:20`). This is why the selection "pop" lives on the
   *letter*, not the tile.
4. **Fonts must be bundled, latin-subset, correct weights.** Use `@fontsource/<font>/latin-<weight>.css`.
   Never Google Fonts CDN — native (Capacitor) is offline. Match `font-weight` to a
   weight the font actually ships (else faux-bold).
5. **Letters sit on two backgrounds.** A selected tile letter sits on the tile *and*
   the ribbon crossing under it. `--selected-letter-outline` keeps it legible — pick
   a contrasting outline color per skin.
6. **Hint solved colors are a designed triple.** `--hint-solved-bg` /
   `--hint-solved-border` / `--hint-solved-letter` must work together (letter
   contrasts bg). `--hint-solved-bg` must be a **solid** color.
7. **Flat ribbon = equal gradient endpoints.** Set `--path-grad-start` ==
   `--path-grad-end`. This also makes the win-screen glitch split collapse into a
   subtle same-color jitter (good for clean/LCD skins).
8. **`--title-glow` must be opaque.** It is used as a `color:` value on text
   elements throughout the app (archive stars, hint counter, achievement count,
   stat highlights, etc.). A semi-transparent value silently breaks contrast on
   all of them. Always define it as a solid hex or `rgb()`. See §4 Chrome & title.

---

## 9. Verification

This project uses **pnpm**. After editing:

```bash
pnpm install            # only if you added a font dependency
pnpm build              # runs `tsc --noEmit && vite build`
```

`pnpm build` must be clean. For an explicit production build (PurgeCSS active):

```bash
NODE_ENV=production pnpm exec vite build
```

Sanity checks on the built CSS (`dist/assets/index-*.css`):
- `grep -F 'skin-<id>' dist/assets/index-*.css` → present (survived purge).
- A reused per-font scale (e.g. `--display-scale-orbitron`) should show
  *1 declaration + N references* (one per skin using it).
- No new hardcoded hex outside `skins.css`.

Then load the app, switch to the new skin in Settings, and visually confirm:
grid letters, wordmark + level title size, the swipe ribbon (try a self-crossing
word), hint slots (empty + a revealed letter + a solved word), and the win screen
(FLAWLESS, the result time, confetti, the glitch transition).

---

## 10. Worked reference: the five existing skins

| Skin | id | Tile font | Wordmark font | Radius | Glow | Ribbon | Availability |
|---|---|---|---|---|---|---|---|
| Void | `void` (`:root`) | Space Mono | Space Mono | 14px | 1 | cyan→light-cyan | default, free |
| Synthwave | `synthwave` | Orbitron | Orbitron | 18px | 1.7 | magenta→cyan | solve_10 / IAP |
| Dot Matrix | `gameboy` | Press Start 2P | Silkscreen | 0 | 0 | flat green (butt caps) | streak_30 / IAP |
| Terminal | `terminal` | VT323 | VT323 | 2px | 1.2 | amber gradient | free (`productId: null`) |
| Crimson | `crimson` | Orbitron | Orbitron | 6px | 1.3 | red→orange | free (`productId: null`) |

Read `src/skins/skins.css` for their exact values — they are the best examples to
copy from. Synthwave/Crimson both use Orbitron and **reference the same
`--*-scale-orbitron` constants**, which is the pattern to follow for reused fonts.
See the table in §4 for all currently bundled fonts and their scale values.

---

## 11. Earning & purchasing skins (availability & monetization)

A skin's availability is decided entirely by its **registry fields** — no other
code changes needed to add one. `isSkinOwned(id)` in `src/services/IAPService.ts`
is the single gate, evaluated in this priority order:

1. `productId: null` → **always free** (all platforms).
2. Web (any skin) → free (there is no IAP surface on web).
3. `unlockedByAchievement` earned → owned.
4. `productId` (or `bundleProductId`) owned via IAP → owned.

Every skin appears on every platform — there is no web-only / hidden-on-native
concept. The web is simply always free.

### Web
All skins are free. Nothing to configure beyond the registry entry.

### Achievement unlock — ✅ works today
- Set `unlockedByAchievement: '<achievementId>'` and a human `unlockHint`
  (e.g. `'10 puzzles solved'`). The hint is shown on the locked card.
- Valid achievement IDs live in `src/data/achievements.ts`. Current set:
  `streak_{1,3,7,14,30,60,100,200,365}`, `solve_{1,5,10,25,50,100,250,500,1000}`,
  `pristine_{1,5,10,25,50,100,250}`, `pristine_lightning`, `speed_{60,30,20,15}`.
- Achievements unlock in real time on solve (`detectAndUnlockAchievements`) and
  retroactively on startup (`retroactivelyUnlockEarnedAchievements`), persisted
  locally in `ludodex.achievements_earned`. `isSkinOwned` calls `isEarned(id)`.
  **This path is fully functional on web and native** (it's local-storage based;
  the Game Center / Play Games submission is a separate best-effort stub and is
  not required for the skin to unlock).
- Live examples: Synthwave unlocks at `solve_10`, Game Boy at `streak_30`.

### IAP purchase — ⚠️ scaffolded, not live yet
The plumbing exists (canonical product IDs, a fallback price catalog, analytics,
and the full Settings preview→buy→unlock flow), but the actual store SDK calls are
**TODO stubs**, so purchases do **not** complete yet:
- `initIAP()`, `isOwned()`, and `purchase()` in `IAPService.ts` are RevenueCat
  TODOs. `isOwned` returns `false`; `purchase` returns `unavailable` /
  `not-implemented`.
- To make a skin actually purchasable on native: (a) add its product id to
  `PRODUCT_IDS` **and** `FALLBACK_CATALOG` in `IAPService.ts`; (b) set the
  registry `productId` to that **exact** id; (c) create the product in RevenueCat
  + App Store Connect / Play Console; (d) implement the three stubs.
- **Prices are never hardcoded in UI.** `getProductInfo().priceLabel` comes from
  the store at runtime; `FALLBACK_CATALOG` holds USD placeholders shown while the
  SDK loads. Note: `getPriceLabel()` in `SettingsView.ts` currently returns a flat
  `$0.99` placeholder — swap it to `getProductInfo()` when wiring real pricing.

### Settings flow (already wired — no changes needed per skin)
Tapping a locked skin calls `enterPreview` (applies it as a live preview). On
native a Buy button shows the price and calls `attemptPurchaseFromPreview` →
`purchase`; on success `setPaidStatus` records ownership and the card unlocks.
`restorePurchases` (native) re-checks entitlements.

### Product-id integrity (keep these in sync)
Because `registry.ts` can't import `IAPService` (circular), product ids are string
literals in the registry that **must match** `PRODUCT_IDS` / `FALLBACK_CATALOG`:
- Each skin's `productId` must equal a `PRODUCT_IDS` entry that also has a
  `FALLBACK_CATALOG` price (e.g. `skin_synthwave`, `skin_gameboy`).
- `bundleProductId` (currently `skin_bundle`, shared by Synthwave + Game Boy) must
  also be declared in `PRODUCT_IDS` + `FALLBACK_CATALOG`.
- If `getProductInfo(id)` returns null, the id is mismatched — the price label
  silently falls back. (The previously-mismatched `gameboy` id `skin_pixel` and the
  undeclared `skin_bundle` were reconciled to `skin_gameboy` + a declared
  `skin_bundle` entry.)

### Decision shortcut
| Goal | Set |
|---|---|
| Free everywhere (also the simplest way to trial a skin) | `productId: null` |
| Earned by playing (recommended; works now) | `unlockedByAchievement` + `unlockHint` |
| Paid on native (needs RevenueCat wiring) | `productId` (+ catalog entry); optional achievement as an alt path |
