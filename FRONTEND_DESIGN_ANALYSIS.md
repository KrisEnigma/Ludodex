# Ludodex — Frontend Design Analysis

> Prepared May 2026. Based on full source review of the TypeScript/Vite/Capacitor codebase.

---

## 1. Architecture Overview

Ludodex is a **zero-framework vanilla TypeScript SPA** bundled with Vite 6 and shipped cross-platform via Capacitor 8. There is no React, Vue, or Svelte — every element is created by hand in TypeScript. This is an intentional, disciplined choice that keeps the bundle lean and gives the game loop full control over DOM lifecycle.

The overall structure is:

- **`main.ts`** — async IIFE bootstrap (Sentry → Analytics → IAP → i18n → skin → progress → routing)
- **`Router.ts`** — client-side stack router; 7 named routes with typed payloads
- **`views/`** — one class per screen (Menu, Game, Win, Settings, Archive, HowToPlay, Achievements)
- **`game/`** — pure logic utilities (Grid, InputManager, etc.)
- **`skins/`** — CSS custom property theming + registry
- **`index.css`** — global styles (~47 KB)
- **`skins/skins.css`** — three complete theme overrides

The stack is modern and well-chosen for a mobile game: pure ESM, strict TypeScript 6, Space Mono monospace font via `@fontsource`, and a coordinate system using column letters `a–d` and row numbers `1–4`.

---

## 2. Design System & Theming

### 2.1 CSS Custom Properties

The entire visual system is driven by CSS custom properties declared on `:root`. A single class on `<html>` (`skin-synthwave`, `skin-gameboy`) overrides the full token set — backgrounds, tile states, path color, buttons, chrome text, and more. The void theme (default dark) applies no class, which keeps the fallback clean.

This is a textbook implementation of a token-based design system. Every theme provides the same set of tokens, so no component ever needs to know which skin is active.

**Token coverage per skin:**
- Background / shell / chrome text
- Title color
- Button (primary action, secondary, skin buttons)
- Tile states: `idle`, `selected`, `found`, `deactivated`
- SVG path color (halo + core)
- Hint overlay colors

### 2.2 Skin Palette

| Skin | Background | Accent | Character |
|---|---|---|---|
| **void** (free) | `#07090e` near-black | Cyan `#00e5ff` | Cold, hacker aesthetic |
| **synthwave** (paid) | Deep purple | Hot pink | Retro neon '80s |
| **gameboy** (paid) | Olive green | Lime green | Handheld nostalgia |

The three skins are well-differentiated and each has a strong emotional identity. The `previewSwatch` triple `[bg, tile, accent]` in `registry.ts` gives the store UI an efficient preview without rendering the full skin.

### 2.3 Typography

Space Mono is the only typeface used, loaded via `@fontsource` (zero external request at runtime). It's an excellent choice — monospace enforces the grid-aligned, terminal-coded aesthetic of the game without needing any custom icon fonts. All UI text, tile labels, timer, and stats share the same face with weight/size variation.

**Recommendation:** Consider adding a `--font-size-base` CSS variable and a small responsive scale (e.g., `clamp(14px, 3.5vw, 16px)`) to improve readability on tablets and wide phones. Right now, if font sizes are hard-coded in px in `index.css`, they won't adapt to viewport width variations across the iOS/Android device matrix.

---

## 3. Navigation & Router

### 3.1 Stack-Based Router

The router maintains a `RouteEntry[]` stack and exposes `push`, `replace`, `pop`, and `popToRoot`. This maps naturally to native mobile navigation behavior — `push` is forward, `pop` is back. The stack means returning from Settings or Archive correctly restores the menu without re-fetching data.

Route payloads are typed via a `RoutePayloads` mapped type and a `AnyRouteEntry` discriminated union, giving full compile-time safety when navigating. This is a clean pattern that prevents routing bugs common in dynamic-key approaches.

### 3.2 Mount Animation

The double-`requestAnimationFrame` trick in `Router.mount()` is a well-known pattern for triggering CSS enter transitions reliably. The new view is appended to the DOM, then a frame is skipped before adding the `.is-entering` class, preventing the browser from batching the initial paint with the animated state. This is the correct way to do this without a framework's `useLayoutEffect` equivalent.

### 3.3 View Instance Lifecycle

Every call to `renderCurrent()` creates a **fresh view instance** and appends it, replacing the previous one. There is no view caching or recycling. This is simple and correct for a game with few screens and small view state, but it means every screen mount re-runs `Promise.all` data fetches. For Menu (5 async calls) this is perceptible on slower devices.

**Recommendation:** Consider caching `MenuView` or at least memoizing its data layer between nav events. A lightweight "stale-while-revalidate" pattern (render with cached data immediately, then update once fresh data arrives) would make the menu feel instant on re-open.

---

## 4. Game Screen & Interaction Design

### 4.1 Tile State Machine

Tiles use `data-state` as a CSS state machine with four states: `idle`, `selected`, `deactivated`, and `found`. This is the right pattern — state lives in the DOM attribute, CSS handles all visual transitions per state, and no JavaScript className wrangling is needed. It also makes the state trivially inspectable in DevTools.

The staggered `found` animation uses a `--reveal-delay` CSS custom property set inline per tile, creating a cascade effect without any JavaScript timers.

### 4.2 Input & Pointer Capture

The `InputManager` uses the **Pointer Events API** with pointer capture (`setPointerCapture`). This is the correct cross-platform approach — it handles mouse, touch, and stylus with one code path, and pointer capture ensures the drag continues tracking even if the pointer moves off the target tile. This avoids the classic mobile bug where fast swipes "drop" midway.

### 4.3 SVG Path Overlay

The swipe trail is rendered as an SVG overlay with dual paths (halo + core) — a thick blurred halo for glow and a thinner crisp core on top. This technique produces a polished neon trail effect purely with CSS `filter: blur()` and layered `stroke`, with no canvas or WebGL needed. The coordinate system maps tile centers to SVG space.

### 4.4 Hint System

Press-and-hold hint reveals are driven by a CSS animation + `animationend` event listener. The animation serves double duty: it provides the progress affordance (the user sees the tile "charging up") and triggers the reveal on completion. This is elegant — the timing is CSS-controlled and respects `prefers-reduced-motion` implicitly if configured.

**Recommendation:** Verify that `prefers-reduced-motion` is explicitly handled for the hint animation. If the CSS animation is gated on the media query, reduced-motion users currently can't use hints unless an instant reveal fallback is coded in the `animationend` handler.

### 4.5 Timer

The timer pauses on `document.visibilitychange` and on window blur, tracking accumulated paused time in `timerTotalPausedMs`. This is important for a daily puzzle — a player who backgrounds the app mid-solve shouldn't have their time penalized. The implementation is correct.

### 4.6 Win Transition (Glitch-Out)

The win transition runs a two-phase animation:
1. **Corrupt phase** — letter scramble across tile labels
2. **CRT collapse phase** — screen compresses vertically, simulating an old CRT shutting off

This is the standout interaction design moment in the app. It's thematically coherent with the "GLITCH" name, and the two-phase approach gives it narrative weight (the solve "breaks" the screen before transitioning). The `prefers-reduced-motion` check (noted in the codebase) is essential here.

**Recommendation:** Ensure the glitch transition also respects reduced-motion by skipping or shortening to a simple cross-fade. The CRT collapse in particular (vertical compression) can trigger vestibular discomfort.

---

## 5. Win Screen

The Win screen does a lot of work gracefully:

- **Star rating** (`1 + (mistakes===0 ? 1 : 0) + (hints===0 ? 1 : 0)`) is a clean, readable 1–3 scale
- **Confetti** (60 particles, skin-colored, 600ms delay) fires only on 3-star — high reward for perfect play
- **Live countdown** to the next daily puzzle keeps the screen "alive" and motivates return visits
- **Achievement cards** surface unlocks in the moment of success, reinforcing progression
- **Share button** uses Capacitor's native share sheet, producing platform-native behavior

The hierarchy is: emotional peak (stars + confetti) → puzzle identity (title + time) → next action hook (countdown) → social (share) → secondary actions (play again / done). This is good UX sequencing.

**Recommendation:** The "new best" and "new rating" pills are a strong moment — make sure they animate in with a brief delay after the stars animate, rather than appearing simultaneously. The micro-stagger amplifies the reward feeling.

---

## 6. Menu Screen

### 6.1 Layout Hierarchy

Top bar (day chip + trophy + settings) → two-line logo (GLITCH / SALAD) → stats strip (streak / solved / best time) → daily card → yesterday card → footer actions → optional web "get the app" row.

This is a sensible information hierarchy for a daily puzzle app. The stats strip gives returning players an immediate identity anchor ("I'm on a 14-day streak") before the day's puzzle CTA.

### 6.2 Stats Strip

Three cards with icon + value + label. The fire icon on streak is the right motivational touch. The strip loads asynchronously via `Promise.all` — ensure skeleton/loading states are shown while the five concurrent async calls resolve, otherwise the stats area will flash empty on slower connections or first launch.

### 6.3 Daily Card

The daily card has a `data-solved` attribute when the puzzle is already completed. This is used to switch the CTA from "Play" to "Play Again" and visually marks the card as complete. Consistent with the `data-state` tile approach — DOM-driven state.

### 6.4 Yesterday Card

Shows stars + elapsed time if solved, or "unsolved" if not. This is a nice accountability feature for streak-focused players. The star display here should be visually consistent with the Win screen stars (same SVG/CSS source).

### 6.5 Streak Loss Banner

The dismissible banner on streak loss is a good UX choice — it's informative without being punitive, and dismissibility respects the player's choice to move on. Make sure the dismiss state is persisted (Capacitor Preferences) and not just in-memory, otherwise the banner reappears on every app open.

**Recommendation:** Consider a brief shake or bounce animation on the streak card in the stats strip when the streak loss banner is visible, to make the visual connection between the banner and the streak value more apparent.

---

## 7. Animation & Motion Design

| Animation | Technique | Quality |
|---|---|---|
| Tile found cascade | `--reveal-delay` CSS var per tile | Excellent |
| Swipe trail | SVG dual-path, CSS blur | Excellent |
| Win glitch-out | Letter scramble + CRT collapse | Standout |
| Confetti | JS particle system, skin colors | Good |
| Screen enter transition | Double-rAF CSS class toggle | Correct |
| Hint press-hold | CSS animation + `animationend` | Good |
| Live countdown | `setInterval` + `isConnected` guard | Clean |

The overall motion quality is high. The `isConnected` guard on interval-based animations (menu countdown, win countdown) is a clean leak-prevention pattern — the interval self-terminates when the view is removed from the DOM.

**Recommendation:** Audit all CSS transitions and animations for a `prefers-reduced-motion` override block in `index.css`. A single `@media (prefers-reduced-motion: reduce)` block that sets `animation-duration: 0.01ms` and `transition-duration: 0.01ms` on all custom properties provides a safe baseline, with specific carve-outs for the glitch transition and confetti.

---

## 8. Monetization Integration

The monetization layer is well-separated from UI code:

- **RevenueCat** handles IAP entitlement checks; the skin registry maps `SkinId` to `productId` strings
- **AdMob** shows an interstitial after a solve threshold (configured in `GameView`)
- **Skin purchase flow** is gated in `registry.ts` — `productId: null` for the free void skin, string IDs for paid skins
- **Bundle product** (`skin_bundle`) is a first-class concept in `SkinMeta`
- **Web-only "Get the App" row** in MenuView is conditionally rendered via `getMonetizationContext()`

The separation is clean. The skin store has a natural preview affordance via the `previewSwatch` triple. The IAP bootstrap is wrapped in a resilient `try/catch` in `main.ts` so a failed IAP init doesn't break the app.

**Recommendation:** The ad interstitial timing (post-solve) is well-chosen — it follows a natural completion moment rather than interrupting play. Ensure there's a minimum solve count gate (e.g., 3+ solves before first ad) to avoid showing ads to brand-new users on their first win.

---

## 9. Accessibility & Internationalization

### 9.1 i18n

`t()` and `tn()` helpers are used throughout the views with English and Spanish support. The `buildShareText()` function in WinView uses i18n for the share string, which is the right level of coverage (shared content is the most publicly visible text).

**Recommendation:** Audit for hard-coded strings in `MenuView` and `WinView` (e.g., "Play Again", "Done", stat labels). These are common places where i18n is missed in iterative development.

### 9.2 Touch Targets

As a mobile-first game, all interactive elements should meet the 44×44px minimum touch target. The tile grid (4×4 on a mobile viewport) is the primary concern — verify that tiles are large enough on the smallest supported screen size (iPhone SE: 375×667px).

### 9.3 Screen Reader Support

The SVG overlay and `data-state` tile pattern will likely need `aria-label` and `role` annotations to be meaningful to screen readers. The game interaction (pointer-based swipe) has no keyboard equivalent. This is acceptable for a mobile game, but consider adding:
- `aria-live` region for game state announcements (found a word, timer, etc.)
- `aria-label` on icon-only buttons (trophy, settings icons in the menu top bar)

### 9.4 Reduced Motion

The `prefers-reduced-motion` check noted in GameView is a good start. It should be extended to cover the confetti particle system in WinView and the screen enter transitions in the Router.

---

## 10. Performance Considerations

### 10.1 Bootstrap Sequence

The `main.ts` IIFE runs 8 sequential async operations before the router renders. On first launch, this means the user sees nothing until Sentry, analytics, IAP, i18n, skin, and progress are all resolved. The IAP init (`initIAP`) is particularly likely to be slow on first cold start.

**Recommendation:** Move non-blocking inits (Sentry, PostHog) to background tasks with `void` (fire-and-forget). The critical path to first render should be: skin → i18n → router. IAP can load after first render and update the skin store reactively.

### 10.2 View Re-instantiation

As noted in §3.3, every navigation creates a fresh view instance. For `GameView` (1,163 lines) this is fine since it's the primary screen. For `MenuView`, the 5 concurrent async data fetches on every navigation can cause layout shifts if not handled with loading states.

### 10.3 CSS Bundle

At ~47 KB, `index.css` is large for a mobile app. Without seeing the full file, it's likely there are unused utility classes or over-specified selectors. A PurgeCSS pass (or Vite's built-in CSS tree-shaking) may yield meaningful savings.

### 10.4 Space Mono Loading

`@fontsource/space-mono` bundles the font as a local file, avoiding network latency — this is correct. Verify only the required weights and subsets are imported (e.g., if only `400` and `700` are used, don't import all weights).

---

## 11. Recommendations Summary

These are ordered roughly by impact:

**High Impact**
1. **Bootstrap critical path** — defer Sentry/PostHog init post-render; show UI before IAP resolves
2. **Menu data caching** — cache the 5 async calls stale-while-revalidate to make re-navigation instant
3. **Reduced motion audit** — add a comprehensive `@media (prefers-reduced-motion)` override block covering glitch transition, confetti, and screen enter transitions
4. **Touch target audit** — verify 44×44px minimum on tiles for iPhone SE viewport

**Medium Impact**
5. **Responsive font scaling** — use `clamp()` for `--font-size-base` to adapt across device sizes
6. **Loading skeleton on MenuView stats strip** — prevent layout shift during async data load
7. **Dismiss persistence on streak loss banner** — verify state is persisted in Capacitor Preferences
8. **Win screen micro-stagger** — delay "new best" / "new rating" pills to animate after stars

**Low Impact / Polish**
9. **i18n audit** — sweep MenuView and WinView for hard-coded English strings
10. **CSS bundle purge** — run PurgeCSS to reduce the 47 KB stylesheet
11. **Aria labels on icon buttons** — trophy and settings icons in the menu top bar
12. **Ad interstitial gate** — ensure a minimum solve count before first ad display

---

## 12. Strengths Worth Preserving

The codebase has several design decisions that are unusually clean and should be kept:

- The `data-state` tile state machine — simple, inspectable, CSS-driven
- The SVG dual-path swipe trail — high-fidelity without canvas overhead
- The `isConnected` interval guard pattern — clean memory leak prevention
- The double-rAF mount animation — correct, framework-free CSS transition trigger
- The skin token system — full visual rebranding via a single `<html>` class
- The glitch-out win transition — the signature moment of the app, thematically perfect
- Typed route payloads — discriminated union routing prevents a whole class of runtime bugs
- Confetti using skin accent colors — monetization and aesthetics reinforce each other

---

*End of analysis.*
