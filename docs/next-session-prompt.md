# Ludodex — handoff for a fresh session (finish & ship)

Paste this into a new conversation to continue. The goal of the next
session is **final polish and shipping** — *not* new features. The owner
(Kris, solo unknown dev, first published mobile game) has explicitly
decided the feature set is done. Default to finishing work, and push back
on speculative additions.

---

## Project

**Ludodex** — a daily word-swipe puzzle themed around video-game culture.
4×4 grid; swipe adjacent letters to spell themed answers (characters,
items, studios, hardware…). One global daily puzzle; past puzzles live in
an archive.

- **Stack**: vanilla TypeScript SPA + Vite 6 + Capacitor 8. No framework —
  every DOM node is hand-built in TS.
- **Platforms**: web on **Cloudflare Pages** (domain `ludodex.krisenigma.com`);
  Android scaffolded; **iOS not yet scaffolded** (`pnpm cap add ios` not run).
- **i18n**: English + Spanish, full parity via `src/i18n/{en,es}.ts`. Keep both
  in sync for any new string.
- **Package manager**: **pnpm**. Build: `pnpm build` (= `tsc --noEmit && vite build`).
- **Owner**: Kris / KrisEnigma. Voice: direct, decisive, honest caveats, no
  filler. Use the AskUserQuestion tool for choices. Flag on-device/dashboard
  actions explicitly.

## What this session built (don't redo)

**Skin system, expanded to font + shape + motion (was colors-only):**
- New per-skin CSS variables in `src/skins/skins.css`: `--tile-font-family/-weight`,
  `--tile-font-scale`, `--tile-radius`, `--wordmark-font-family/-weight/-letter-spacing`,
  `--display-font-scale`, `--glow-strength`, and the selection ribbon set
  (`--path-grad-start/-end`, `--path-width`, `--path-cap`, `--path-opacity`,
  `--path-glow`, `--selected-letter-outline`).
- **Optical sizing is per-font**, defined once in `:root` and referenced by skins:
  `--tile-scale-{orbitron,press-start,vt323}` and `--display-scale-{orbitron,silkscreen,vt323}`.
  Reused fonts (Orbitron in Synthwave + Crimson) share one tuned value.
- **Selection ribbon** rewritten in `GameView.redrawPath` as one `<line>` per
  segment (`.path-seg`), tinted along swipe order via `--seg-t` + `color-mix`
  (a WordSalad-style progress gradient; equal endpoints = flat). Letters now
  render **above** the ribbon — `isolation` was removed from `.tile` and the
  selected-state `transform/z-index` dropped (they created a stacking context
  that trapped the letter under the ribbon). The selection "pop" lives on the
  letter now.
- **5 skins**: `void` (default), `synthwave`, `gameboy`, `terminal` (amber CRT,
  VT323), `crimson` (red, Orbitron). Terminal + Crimson are `productId: null` =
  **free on every platform** (the old `webOnly`/`isWeb` concept was removed —
  see decisions below).
- **New fonts** via `@fontsource` (latin subsets, imported in `main.ts`):
  orbitron, press-start-2p, silkscreen, vt323. → **Run `pnpm install`** in a
  fresh checkout (4 new deps in `package.json`).
- **Authoritative skin guide: `docs/making-skins.md`** — how to add a skin end
  to end, the full variable reference, the per-font scale system, and the
  earn/purchase model. Read it before touching skins.

**Win-screen cohesion:** the glitch chromatic-split uses the skin's ribbon
gradient (not hardcoded pink/cyan); confetti draws 5 skin colors; `FLAWLESS`
label and the result timer use the skin display font. Level title
(`.view-title`) + hint-answer letters also use the skin font. The menu
`.daily-card` gradient is skin-tinted (was hardcoded void teal).

**Monetization ids reconciled:** registry `gameboy.productId` is `skin_gameboy`
(was a mismatched `skin_pixel`); `skin_bundle` is declared in `PRODUCT_IDS` +
`FALLBACK_CATALOG`. Achievement unlocks work today (Synthwave = `solve_10`,
Game Boy = `streak_30`); the **IAP purchase path is scaffolded but stubbed**
(`initIAP`/`isOwned`/`purchase` are RevenueCat TODOs).

**Puzzle preview links** (`src/services/PuzzleCodec.ts`): a whole puzzle is
base64url-encoded into a `/p/<token>` URL (no server). `DeepLinking` decodes +
validates it (untrusted-input boundary — strict validation, renders via
textContent) and routes it into the real game as a **non-persisting preview**
(`GameView` `isPreview`: reuses the tutorial no-write path; no streak/achievement/
ad effects). The editor (`public/editor/`) gained **Copy link** and **Test**
buttons. Same-domain path, so it opens the native app where installed.

**Remote puzzle catalog wired** (`PuzzleLoader.loadPuzzles` is now called at
boot in `main.ts`): editor saves to `PUT /api/puzzles` (Worker → R2), game
fetches `GET /api/puzzles` at launch (remote → cache → bundled fallback,
bounded ≤1.8s). `REMOTE_PUZZLES_URL` derives from `VITE_SHARE_BASE_URL`
(`/api/puzzles`); override with `VITE_PUZZLES_URL`. `src/data/puzzles.json` is
now just the offline/first-paint fallback.

**Daily-puzzle model finalized:**
- `LAUNCH_DATE` is env-configurable via `VITE_LAUNCH_DATE` (YYYY-MM-DD), default
  `2026-06-22` in code. **Target public launch ≈ 2026-06-29**; the anchor is
  set 7 days earlier so launch day computes to **day 8** with a **7-puzzle
  starter archive** already present. Daily = `puzzles[dayNumber-1]`, global &
  calendar-based (everyone gets the same puzzle per date).
- **DEV-only day override** for testing: `?day=N` or
  `localStorage['ludodex.devday'] = 'N'`. Compiled out of production
  (`import.meta.env.DEV`). Use it to jump days / verify the archive.

**Daily reminder notifications** (`src/services/NotificationService.ts`,
native-only, opt-in):
- `enableDailyNotification()` requests OS permission then schedules a repeating
  09:00 local notification with **evergreen streak-loss copy** ("Keep your
  streak alive"); `disableDailyNotification()` cancels; `initDailyNotification()`
  re-arms on boot (never prompts, self-heals if permission revoked).
- **Settings → "Daily reminder"** toggle (native-only).
- **First-solve soft prompt**: after `solvedCount === 1`, the win screen offers
  reminders once (`shouldOfferDailyReminderPrompt` / `markDailyReminderPrompted`,
  one-time via `ludodex.reminder_prompted`). Nothing is scheduled until the user
  opts in.

## Decisions to preserve (don't re-litigate)

- **Daily is a global calendar (Wordle model), not per-install.** Late joiners
  get the current day + archive, not a personal day-1 countdown.
- **Launch day will display "TODAY'S PUZZLE #8"** (consequence of the 7-day
  backdated anchor). Accepted — it reads as an established game; not a bug.
- **Skin font rule**: colors theme *everything*; the display font goes only on
  identity text (wordmark, level title, tile letters, hint letters, win
  FLAWLESS + timer). Functional chrome (header, in-game timer, body) stays mono.
- **No web-only skins.** Web has no monetization → every skin is free on web;
  the earn/pay fields only gate native. Every skin appears on every platform.
- **Feature set is frozen.** Build new things only with post-launch evidence.

## Parked — do NOT build now (and why)

- **Dynamic streak *number* in notifications + "skip if already solved today"**:
  local notifications carry a fixed payload, so a live number goes stale exactly
  when the player's been away (the moment it matters); doing it right needs
  server push (device tokens + APNs/FCM + a job) — real infra. Evergreen copy
  already carries the loss-aversion hook. Revisit only with a measured retention
  need post-launch.
- **Server push / backend, UGC community grids, cross-device streak sync**: all
  scale features for an audience that doesn't exist yet.

## Remaining before ship (this is the actual next-session work — hygiene, not features)

1. `pnpm install` (4 new `@fontsource` deps).
2. **Lock `VITE_LAUNCH_DATE`** when the date is final = (public launch − 7). Set
   it in the **Cloudflare Pages build config** too, not just local `.env` (build-time
   var). Default in code is `2026-06-22`.
3. **Verify the puzzle pipeline round-trips on the DEPLOYED site**: editor save →
   `/api/puzzles` (R2) → game fetches at boot. Confirm the deployed Worker serves
   `GET /api/puzzles`, and keep `src/data/puzzles.json` as a sane offline fallback
   (roughly in sync with R2). Note: one malformed remote puzzle makes the whole
   fetch fall back to bundled — rely on the editor's validate step.
4. **Native deep links**: fill the SHA-256 fingerprint in
   `public/.well-known/assetlinks.json` (Play Console), and for iOS run
   `pnpm cap add ios`, add `public/.well-known/apple-app-site-association`, and the
   Associated Domains entitlement. Until done, links/preview links open the web
   game everywhere (the code side is ready).
5. **Smoke-test the native build on a device**: notification permission prompt +
   09:00 fire; achievement-unlock of skins; IAP stubs (purchase returns
   not-implemented — that's expected); `/p/<token>` preview + `/N` daily deep
   links open the app; all 5 skins render.
6. Confirm enough launch runway: 50 bundled puzzles → the daily exhausts around
   launch + 42 days; keep the pipeline ahead of the calendar.
7. First-session / store-listing polish — the highest-leverage pre-launch work
   (acquisition + first 30 seconds), per the owner's own framing.

## Guardrails (still in force)

- **No hardcoded hex outside `skins.css`.** Every theme-relevant color is a CSS
  variable. (One sanctioned exception: `.modal-button-destructive` stays red.)
- **`color-mix()` only accepts colors, never gradients.** `--tile-*-bg` and
  `--shell-bg` are gradients — never `color-mix` them (it silently fails → bad
  fallback). Use solid vars (`--hint-solved-bg`, `--title-glow`, `--button-bg`).
  This caused a real invisible-hint-letters bug.
- **PurgeCSS runs on prod builds**: classes applied via JS strings must appear
  literally (skin classes safelisted via `/^skin-/`, `[data-` greedy); unused CSS
  variables are pruned (`variables: true`) so every var must be consumed in
  retained CSS. `@font-face`/`@keyframes` aren't purged.
- **Never put `transform`/`isolation`/`z-index`/`filter`/`opacity` on `.tile`**
  (esp. the selected state) — it re-creates the stacking context that traps the
  letter under the ribbon.
- **Fonts are bundled, latin-subset, exact weights** via `@fontsource/*/latin-*.css`.
  No Google Fonts CDN (native is offline). Match `font-weight` to a weight the
  font ships (pixel fonts are 400-only) or you get faux-bold.
- **No puzzle spoilers in static content** (tutorial uses abstract examples).
- **Brand is "Ludodex"**, wordmark `LUDODEX`. **Storage prefix `ludodex.*`.**
- **`@sentry/browser` pinned to exact `8.55.0`** (`@sentry/capacitor` requires it).
- **Cloudflare Pages SPA fallback** is `wrangler.toml` `[assets] not_found_handling
  = "single-page-application"`, not `_redirects`.
- **Build-time env vars** (`VITE_*`) go in the Pages **Build configuration**, not
  the runtime Variables/Secrets panel. The editor's `API_SECRET` (guards
  `PUT /api/puzzles`) lives in `.env` (gitignored) and must be a Worker secret in
  prod — never commit or paste it.

## Key files

- `src/main.ts` — boot (loadPuzzles, skin, route, background init incl. notifications).
- `src/skins/skins.css` + `src/skins/registry.ts` — skin tokens + catalog (read
  `docs/making-skins.md`).
- `src/game/PuzzleLoader.ts` — daily/day-number/archive mapping, LAUNCH_DATE,
  remote fetch, dev override.
- `src/services/DeepLinking.ts` + `src/services/PuzzleCodec.ts` — URL routing +
  preview-link encode/decode.
- `src/views/GameView.ts` — grid, ribbon, solve/persistence (incl. `isPreview`).
- `src/views/WinView.ts` — win screen + first-solve reminder prompt.
- `src/services/NotificationService.ts` — opt-in daily reminders.
- `src/services/IAPService.ts` / `AchievementService.ts` — skin entitlements.
- `public/editor/` — standalone puzzle editor (Copy link / Test buttons).
- `docs/making-skins.md`, `docs/deep-linking.md` — subsystem references.

## Verify

`pnpm build` must be clean (`tsc --noEmit && vite build`). For PurgeCSS-active
checks use `NODE_ENV=production`. There is no automated UI test — smoke-test
screens visually, and the native-only paths (notifications, IAP, deep links) on
a device.
