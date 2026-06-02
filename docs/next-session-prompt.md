# Ludodex — handoff prompt for a fresh Claude session

Paste this into a new conversation when you're ready to continue. It
gives the new Claude enough context to hit the ground running without
re-discovering the codebase.

---

## Project

**Ludodex** is a daily word puzzle for the gaming culture niche.
Mechanic: a 4×4 grid of letters; swipe across adjacent letters to
spell themed words (characters, items, studios, hardware, etc.). One
puzzle per day; old puzzles live in an archive. Theme of each puzzle
groups all answers under one topic.

- **Stack**: Vanilla TypeScript SPA + Vite 6 + Capacitor 8. No React /
  Vue / Svelte. Every DOM element is created by hand in TypeScript.
- **Platforms**: Android (scaffolded, AndroidManifest configured), web
  (deployed to Cloudflare Pages). iOS not yet scaffolded (`pnpm cap
  add ios` hasn't been run).
- **Languages**: English + Spanish, full i18n coverage via
  `src/i18n/{en,es}.ts`.
- **Owner**: Kris Escobar (KrisEnigma). Personal project.
- **Repo root**: the folder containing this file's parent (typically
  named `Ludodex` or similar after a local rename).

## Recent state (don't redo this work)

The codebase was renamed from **GlitchSalad → Ludodex** in a prior
session. All brand strings, storage key prefixes (`ludodex.*`),
Capacitor `appId` (`app.ludodex.game`), package name, OG tags,
Android intent filter, assetlinks template, Sentry release tag, and
legal HTML pages reference the new name. **Don't reintroduce the old
name.** The `glitch` visual-effect constants in `GameView.ts`
(`GLITCH_CORRUPT_MS`, `GLITCH_COLLAPSE_MS`, `GLITCH_CHARS`,
`runGlitchOut()`) refer to the CRT win-transition animation, NOT the
brand — leave those.

Other recently completed work:

- **Deep linking** end-to-end (web URL parsing on boot, `replaceState`
  on nav, `popstate` listener, Capacitor `App.addListener('appUrlOpen',
  ...)`, shared `buildInstallCta` component in
  `src/components/InstallCta.ts`).
- **Color/accent triage** (theme-aware). `--title-glow` is now reserved
  for: primary CTAs, brand wordmark, active selection, and celebration
  moments (swipe path, found tiles, stars, FLAWLESS, achievement
  trophy icons, hero progress numbers). It has been **demoted off**:
  archive solved-row borders, achievement card borders (Win and
  Achievements views), section/category labels, stat-card "fire"
  border, daily card tag, daily card title glow, archive time
  numbers, settings utility links. Use `--button-border` /
  `--chrome-text` / `--title-color` for demoted treatments. Never
  hardcode hex — every theme-relevant value goes through a CSS
  variable so Synthwave and Game Boy skins re-skin correctly.
- **Tutorial reworked**: 4 steps with new copy, dot pagination
  anchored to the bottom (with the nav), redesigned theme-aware SVGs.
  Step 2 deliberately uses abstract content (no real puzzle theme or
  words) to avoid spoilers. Step 3 shows the actual hint mechanic:
  press-and-hold on an empty hint slot below the grid.
- **Win screen polish**: NEW RATING pill no longer false-fires on
  first-time solves (requires `previousRating > 0`). Layout-shift
  bug on the win-achievements section fixed (no more `max-height`
  animation). Countdown rendered synchronously (no longer empty for
  1s before populating).
- **Archive row hierarchy** fixed (puzzle title dominant, day number
  and time/stars demoted to metadata).
- **Skin selector**: tile-shaped previews using per-skin
  `previewTile` tokens in `src/skins/registry.ts`, replacing the
  three-color swatches.
- **Achievements view**: hero progress block (big earned count + thin
  progress bar) replaces the buried "11/39" line.

User has also done since the last session:
- **Revamped the puzzle editor** (`public/editor.html`). Don't assume
  it matches what's described in earlier docs.
- **Another small UI pass**. Run a quick visual sanity check on each
  screen before assuming they match earlier screenshots.

## What to tackle next (in this session)

Four threads, in the order the user listed them. They're loosely
independent; tackle each as its own conversation arc.

### 1. Cross-device streak persistence

Currently the streak lives in `@capacitor/preferences` (local-only).
If a player loses their device or uninstalls, their streak resets.
The user wants a way to preserve it.

Options worth presenting before coding:

- **Account-based sync** — adds an account system (sign-in, identity
  storage). Heaviest. Could be Sign in with Apple / Google + a small
  backend (or Cloudflare Workers + D1).
- **Soft sync** via deep link / QR code: "Continue your streak on
  another device" generates a one-time token the player can scan to
  port their progress. No backend account; the token resolves
  client-side. Lightest in terms of infra; doesn't survive device
  loss without the user actively syncing.
- **Cloud backup** via iCloud (iOS) / Google Drive (Android) for the
  native builds. Web stays local. Per-platform but no custom backend.
- **Backend free tier** (Cloudflare Workers + D1, or Supabase free
  tier) + anonymous identifier. Survives device loss as long as the
  anonymous ID persists. Easiest UX but introduces accounts.

Don't pick blind. Ask which one Kris wants the experience to feel
like before writing code.

### 2. Functional paid skins on desktop

Currently `Synthwave` and `Game Boy` are gated behind RevenueCat
products (`skin_synthwave`, `skin_pixel`) that only work on native
(see `MonetizationContext.canPurchase`). On web you can preview them
but can't unlock them.

Possible directions to discuss with Kris:

- Make all skins free on web (asymmetric pricing — native pays).
- Add web purchase via Stripe / Lemon Squeezy (more infra).
- Unlock via achievements (overlaps with #3 — could be the same
  system).
- Generous-tier: each skin unlocks at a milestone (e.g., 10 solves =
  Synthwave, 30-day streak = Game Boy).

Affected files: `src/services/IAPService.ts` (entitlement reads),
`src/skins/registry.ts` (skin definitions), `src/views/SettingsView.ts`
(purchase flow), `src/services/MonetizationContext.ts` (platform
detection). May need a new `SkinUnlockService` or merge with
`AchievementService`.

### 3. Unlock free skins via achievements / solves

Likely overlaps with #2. The cleanest design might be: a new
"entitlement source" alongside IAP — `unlockedByAchievement` — that
adds skin ownership when a specific achievement is earned. The skin
catalog in `registry.ts` would carry an optional
`unlockedAtAchievement: AchievementId` field that the entitlement
checker honors in addition to the IAP `productId`.

Ask Kris which achievements (or solve counts) should unlock which
skins. Possible mapping to discuss:
- Solve N puzzles → unlock first paid skin
- Maintain X-day streak → unlock second paid skin
- Unlock the "everything" pristine achievement → unlock something
  cosmetic on top

Affected files: same as #2 plus `src/data/achievements.ts` and
`src/services/AchievementService.ts`.

### 4. Non-repeating puzzle archive

Currently `getPuzzleForDay()` in `src/game/PuzzleLoader.ts` uses
modular arithmetic over the rotation indices, so puzzles **do**
repeat once the catalog is exhausted. Kris wants the archive to never
repeat.

Two interpretations to clarify:

- **Hard cap**: once the catalog runs out, show a "no more puzzles
  yet" screen for the day. Forces content production cadence.
- **Date-mapped**: each puzzle is permanently mapped to a specific
  date (some puzzles already use a `date` field, see
  `getDailyPuzzleIndex`). Switching to date-mapped means every puzzle
  is a designated calendar entry; gaps are explicit.

Either way, the rotation logic in `PuzzleLoader.ts` is the central
edit. Ask which model Kris wants. Also consider the archive UI: a
date-mapped model is easier to display as a calendar, while a
sequence-mapped model fits the current "#N" list.

## Guardrails

- **Theme awareness is non-negotiable.** Every color in CSS must go
  through a CSS variable from `src/skins/skins.css` or `:root` in
  `index.css`. Hardcoded hex was a recurring bug — there was a leaked
  `#00d4e866` glow on the daily card title that showed cyan on
  Synthwave's pink theme. Don't reintroduce that pattern.
- **No puzzle spoilers in static content.** The tutorial's earlier
  version showed "VIDEO GAME HEROES" + SONIC + LARA — that's a real
  puzzle in the catalog. Use abstract/placeholder content for any
  illustrative example.
- **The brand is "Ludodex"** — single word, single capital, no
  CamelCase. The wordmark renders all-caps `LUDODEX` as one mark.
- **Storage key prefix is `ludodex.*`.** Don't reintroduce
  `glitchsalad.*`. The migration code that handled the rename has
  been deleted — nothing in the wild to migrate from.
- **`@sentry/browser` is pinned to exact version `8.55.0`** (no
  caret), because `@sentry/capacitor` requires that exact version
  and the postinstall script fails CI builds on any other.
- **Cloudflare Pages SPA fallback** lives in `wrangler.toml`'s
  `[assets] not_found_handling = "single-page-application"`, not in
  `_redirects`. Cloudflare's current validator rejects
  `/* /index.html 200` with a false-positive "infinite loop" error.
- **Build-time env vars** (`VITE_SHARE_BASE_URL` etc.) live in the
  Cloudflare Pages dashboard's "Build configuration" section, not in
  the "Variables and Secrets" panel (that one is for runtime Worker
  vars and rejects vars on static-assets-only projects).
- **No tutorial content for the puzzle editor in `public/editor.html`.**
  That file was just revamped by the user; before touching it,
  re-read it. Don't assume what's inside.

## Tool quirks (sandbox)

- `rm` is blocked in this sandbox (EPERM). To "delete" a file, Write
  to it with empty/marker content and ask the user to run `rm` on
  their machine.
- `pnpm cap sync android` fails in-sandbox due to permission errors
  on certain native files but successfully reads / processes config.
  User must run it locally to apply native changes.
- Full `vite build` may fail due to missing rollup native binary in
  the sandbox. `tsc --noEmit` (via `./node_modules/.bin/tsc`) is the
  reliable verification step.
- Path: project lives under `/sessions/<session-name>/mnt/<folder>/`.
  Always cd into the project root before running pnpm/tsc commands;
  shell cwd doesn't always persist between Bash invocations.

## Reading order if you want to ramp up before starting

If the new Claude wants to understand the codebase before touching it,
read in this order:

1. `package.json` — stack, dependencies, scripts.
2. `src/main.ts` — boot sequence.
3. `src/views/Router.ts` — navigation model.
4. `src/skins/registry.ts` and `src/skins/skins.css` — design tokens.
5. `src/data/achievements.ts` — current achievement set.
6. `src/services/ProgressService.ts` — streak / solve / rating
   tracking.
7. `src/services/AchievementService.ts` — earning logic.
8. `src/services/IAPService.ts` — entitlement checks (this is where
   skin ownership lookups will need to grow for #2 / #3).
9. `src/game/PuzzleLoader.ts` — puzzle rotation (relevant for #4).

`docs/deep-linking.md` covers the deep-linking implementation if
that's relevant. `FRONTEND_DESIGN_ANALYSIS.md` is partially stale
(brand name is now Ludodex) but still useful for architecture.

## Voice / posture for the session

The user values direct, decisive recommendations with honest
caveats. Skip prefatory "great question" filler. When asking for
their input, use the AskUserQuestion tool — they're moving fast and
appreciate not having to re-type clarifications. Acknowledge mistakes
plainly when they happen; don't over-apologize.

When something needs their action on their machine (cap sync, rm,
dashboard config, domain DNS), list it explicitly at the end of the
work so it doesn't slip.
