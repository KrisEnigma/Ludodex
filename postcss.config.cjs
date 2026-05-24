/**
 * PostCSS configuration for Ludodex.
 *
 * ## Activating PurgeCSS
 *
 * 1. Install the plugin:
 *      pnpm add -D @fullhuman/postcss-purgecss
 *
 * 2. Uncomment the purgecss block below.
 *
 * ## Safelist rationale
 *
 * Ludodex uses several categories of selectors that PurgeCSS cannot
 * detect from static source scanning:
 *
 *  - `[data-*]` attribute selectors:  data-state, data-filled, data-solved,
 *    data-loading, data-endgame-phase, data-revealing, data-fire, etc.
 *    These are set dynamically in TypeScript and never appear as literal
 *    class strings. The `greedy` safelist pattern preserves them all.
 *
 *  - Skin classes (`skin-synthwave`, `skin-gameboy`) are applied via
 *    applySkin() at runtime on <html>; they appear in source but the
 *    pattern safelist ensures they survive even if scanning misses them.
 *
 *  - Router transition class `is-entering` is added/removed by the Router.
 *
 *  - Confetti and endgame overlay classes are injected into document.body
 *    at runtime and only referenced in their own component files.
 *
 *  - `@keyframes` names: PurgeCSS doesn't prune keyframes by default when
 *    the animation is referenced in a safelisted rule, but the keyframes
 *    option makes this explicit.
 */

const purgecss = (() => {
  // Comment this block out (or wrap in `if (process.env.NODE_ENV === 'production')`)
  // to disable PurgeCSS in development.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@fullhuman/postcss-purgecss').default;
  } catch {
    // Package not installed — skip PurgeCSS silently.
    return null;
  }
})();

const plugins = [];

if (purgecss && process.env.NODE_ENV === 'production') {
  plugins.push(
    purgecss({
      content: [
        './index.html',
        './src/**/*.ts',
        './src/**/*.html'
      ],

      // Preserve all [data-*] attribute selectors, skin classes, and
      // dynamically-injected classes that PurgeCSS can't detect statically.
      safelist: {
        standard: [
          // Skin classes applied to <html>
          /^skin-/,
          // Router enter animation
          /^is-/,
          // Confetti particle overlay
          /^confetti-/,
          // Endgame CRT overlay
          /^endgame-/,
          // Modal backdrop/container
          /^modal/,
          // Ensure base .view class survives
          'view',
        ],
        // Preserve any CSS rule whose selector contains [data-
        greedy: [/\[data-/],
      },

      // Keep CSS custom property declarations (the entire :root block).
      variables: true,

      // Run PurgeCSS after other PostCSS transforms (e.g. autoprefixer).
      // Set to false if you want to see what gets removed (add rejected: true).
      rejected: false,
    })
  );
}

module.exports = { plugins };
