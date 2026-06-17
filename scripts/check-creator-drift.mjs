#!/usr/bin/env node
/**
 * check-creator-drift.mjs
 *
 * Detects structural drift between the static markup strings in
 * src/skin-creator/creator.js and the real game view files in src/views/.
 *
 * The creator duplicates view markup as static HTML for its preview panels.
 * When a view gains or loses a CSS class that the creator preview also needs,
 * this script surfaces the mismatch so the creator can be updated.
 *
 * Run: node scripts/check-creator-drift.mjs
 * Exit 1 if drift is detected.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract every CSS class name from an HTML string. */
function classesFromHtml(html) {
  const classes = new Set();
  for (const m of html.matchAll(/class="([^"]+)"/g)) {
    for (const cls of m[1].trim().split(/\s+/)) {
      if (cls) classes.add(cls);
    }
  }
  return classes;
}

/** Extract every CSS class name assigned in a TypeScript view file.
 *  Covers both `element.className = '…'` and `.classList.add('…')`. */
function classesFromTs(ts) {
  const classes = new Set();
  // className = '…'
  for (const m of ts.matchAll(/\.className\s*=\s*['"`]([^'"`]+)['"`]/g)) {
    for (const cls of m[1].trim().split(/\s+/)) {
      const cleanCls = cls.replace(/^['"`]|['"`]$/g, '').trim();
      if (cleanCls && !cleanCls.includes('${') && !cleanCls.includes('?') && !cleanCls.includes(':')) {
        classes.add(cleanCls);
      }
    }
  }
  // classList.add('…', '…')
  for (const m of ts.matchAll(/classList\.add\(([^)]+)\)/g)) {
    for (const arg of m[1].split(',')) {
      const cls = arg.trim().replace(/^['"`]|['"`]$/g, '');
      if (cls && !cls.includes('${')) classes.add(cls);
    }
  }
  // setAttribute('class', '…')
  for (const m of ts.matchAll(/setAttribute\s*\(\s*['"]class['"]\s*,\s*['"]([^'"]+)['"]/g)) {
    for (const cls of m[1].trim().split(/\s+/)) {
      if (cls) classes.add(cls);
    }
  }
  return classes;
}

/** Return sorted array of classes in A but not B. */
function diff(a, b) {
  return [...a].filter(c => !b.has(c)).sort();
}

// ── Screen ↔ view file mapping ─────────────────────────────────────────────
//
// Each entry names:
//   - screen:      label for error messages
//   - creatorTag:  unique string in creator.js that marks the start of this
//                  screen's markup block (used to slice out the right section)
//   - viewFile:    path relative to src/views/
//   - skipClasses: classes that intentionally appear only in one side
//                  (e.g. creator-only scaffold, or view-only dynamic classes)

// ── Known-intentional differences ────────────────────────────────────────────
//
// These classes are expected to appear only on one side and should not trigger
// a drift warning.  Add to this list when:
//   - The creator uses simplified/placeholder markup that omits a dynamic feature
//   - The creator adds scaffold elements that don't exist in the real view
//   - A class is set via a template literal interpolation (extracted as a literal
//     by our regex, e.g. `skin-${skin.id}`)
//
// Keep this list minimal.  If a class drifts for a real reason, fix the creator.

/** Classes that appear only in creator markup (acceptable creator-only scaffold). */
const CREATOR_ONLY = new Set([
  'app-shell',                // creator wraps every preview in app-shell
  'settings-skin-preview-scope', // creator adds scope wrapper for skin preview
  // PuzzleTag placeholder elements in the menu preview
  'puzzle-tag', 'puzzle-tag-category', 'puzzle-tag-difficulty',
  // Inline puzzle hint paragraph (dynamic in view — omitted in static preview)
  'game-puzzle-hint',
  // Settings skin cards are generated dynamically from SKINS — skin-${id} classes
  // appear inside ${...} template expressions, so classesFromHtml won't extract them.
  // They are intentionally absent from the extracted creator markup.
]);

/** Classes that appear only in view files (acceptable view-only dynamic features
 *  not shown in the simplified creator preview). */
const VIEW_ONLY = new Set([
  // Post-creator additions to GameView not shown in preview
  'endgame-crt-line', 'endgame-scanlines', 'path-segments-outro',
  'game-instructions',
  // Hint-row separator only rendered when words > 1
  'hint-word-separator',
  // WinView: share sheet + achievements section (added after creator was written)
  'share-preview-close', 'share-preview-copy', 'share-preview-header',
  'share-preview-sheet', 'share-preview-sheet--visible', 'share-preview-text',
  'share-preview-title', 'sheet-backdrop', 'sheet-backdrop--visible',
  'view-subtitle', 'win-achievement-card', 'win-achievement-card-icon',
  'win-achievement-description', 'win-achievement-details', 'win-achievement-name',
  'win-achievements-heading', 'win-achievements-section',
  'win-freeze-used', 'win-new-best', 'win-new-rating', 'win-next-countdown',
  'win-stat-part', 'win-stats-line',
  // MenuView: streak-loss banner + unsolved-yesterday state (added after creator)
  'streak-loss-banner', 'streak-loss-dismiss', 'streak-loss-icon', 'streak-loss-text',
  'yesterday-card-unsolved',
  // SettingsView: skin card markup is generated dynamically in buildSettingsMarkup()
  // via a ${skinCards} template expression, so classesFromHtml() can't extract them.
  // These classes do appear in the creator — just not statically visible to this script.
  'settings-skin-card', 'settings-skin-left', 'settings-skin-name',
  'settings-skin-pill', 'settings-skin-tile', 'settings-skin-tile--default', 'settings-skin-tile--selected',
  // SettingsView: skin description line added below skin name
  'settings-skin-desc', 'settings-skin-info',
  // SettingsView: new settings sections and skin purchase/web CTA UI
  'button-primary', 'button-secondary', 'button-tertiary',
  'legal-link', 'legal-link-divider',
  'settings-about', 'settings-about-credit', 'settings-about-section',
  'settings-about-version', 'settings-legal-links',
  'settings-reminder-hint', 'settings-restore',
  'settings-skin-web-cta', 'settings-skin-web-cta-label', 'settings-skin-web-cta-links',
  'skin-preview-banner', 'skin-preview-banner-actions', 'skin-preview-banner-buy',
  'skin-preview-banner-cancel', 'skin-preview-banner-text',
  'skin-status', 'skin-${skin.id}', // template literal extracted as literal string
  'store-link', 'store-link-divider',
  // ArchiveView: empty-state class
  'archive-empty',
  // App alternate icon picker classes
  'settings-icon-picker', 'settings-icon-option', 'settings-icon-option-img',
  'settings-icon-option-label', 'settings-icon-option-check',
  // Skin detail sheet & preview classes
  'skin-detail-backdrop', 'skin-detail-backdrop--visible', 'skin-detail-sheet', 'skin-detail-sheet--visible',
  'skin-detail-header', 'skin-detail-name', 'skin-detail-close', 'skin-detail-preview-scope',
  'skin-detail-preview-title', 'skin-detail-preview-grid-wrap', 'skin-detail-preview-grid',
  'skin-detail-preview-letter', 'skin-detail-preview-path', 'path-seg', 'path-segments',
  'skin-detail-desc', 'skin-detail-actions', 'skin-detail-active-pill', 'skin-detail-earn-row',
  'sheet-handle',
  // GameView hint charge classes
  'hint-charge-bar-fill', 'hint-charge-bar-track', 'hint-charge-bar-wrap',
  'hint-charge-label', 'hint-count-decrement--active', 'is-charging',
  // WinView skin unlock classes
  'win-skin-unlock-nudge',
  // SettingsView skin badge and promo classes
  'settings-skin-badge', 'settings-skin-promo-block', 'settings-skin-promo-divider',
]);

const SCREENS = [
  {
    screen: 'game',
    creatorTag: 'game-view',
    viewFile: 'GameView.ts',
    skipClasses: new Set([...CREATOR_ONLY, ...VIEW_ONLY]),
  },
  {
    screen: 'win',
    creatorTag: 'win-view',
    viewFile: 'WinView.ts',
    skipClasses: new Set([...CREATOR_ONLY, ...VIEW_ONLY]),
  },
  {
    screen: 'menu',
    creatorTag: 'menu-view',
    viewFile: 'MenuView.ts',
    skipClasses: new Set([...CREATOR_ONLY, ...VIEW_ONLY]),
  },
  {
    screen: 'settings',
    creatorTag: 'settings-view',
    viewFile: 'SettingsView.ts',
    skipClasses: new Set([...CREATOR_ONLY, ...VIEW_ONLY]),
  },
  {
    screen: 'achievements',
    creatorTag: 'achievements-view',
    viewFile: 'AchievementsView.ts',
    skipClasses: new Set([...CREATOR_ONLY, ...VIEW_ONLY]),
  },
  {
    screen: 'archive',
    creatorTag: 'archive-view',
    viewFile: 'ArchiveView.ts',
    skipClasses: new Set([...CREATOR_ONLY, ...VIEW_ONLY]),
  },
];

// ── Load creator.js and split into per-screen sections ──────────────────────

const creatorSrc = readFileSync(resolve(ROOT, 'src/skin-creator/creator.js'), 'utf8');

/**
 * Extract the HTML content associated with a screen by finding the backtick
 * template literal that contains `creatorTag` as a CSS class name.
 * The class may appear in a multi-class attribute, e.g. `class="view win-view"`.
 */
function extractCreatorSection(tag) {
  // Find first occurrence of the tag as a word boundary inside a class attribute
  const re = new RegExp(`class="[^"]*\\b${tag}\\b[^"]*"`);
  const m = re.exec(creatorSrc);
  if (!m) return '';
  const idx = m.index;

  // Walk backwards to the opening backtick of the enclosing template literal
  let start = idx;
  while (start > 0 && creatorSrc[start] !== '`') start--;
  if (creatorSrc[start] !== '`') return ''; // not in a template literal

  // Walk forwards to the matching closing backtick (skip ${…} expressions)
  let end = start + 1;
  let depth = 0;
  while (end < creatorSrc.length) {
    if (creatorSrc[end] === '$' && creatorSrc[end + 1] === '{') { depth++; end += 2; continue; }
    if (creatorSrc[end] === '}' && depth > 0) { depth--; end++; continue; }
    if (creatorSrc[end] === '`' && depth === 0) { end++; break; }
    end++;
  }
  return creatorSrc.slice(start, end);
}

// ── Run checks ────────────────────────────────────────────────────────────────

let exitCode = 0;
const failures = [];

for (const { screen, creatorTag, viewFile, skipClasses } of SCREENS) {
  const creatorSection = extractCreatorSection(creatorTag);
  if (!creatorSection) {
    failures.push(`  [${screen}] Could not locate creator section for tag "${creatorTag}"`);
    exitCode = 1;
    continue;
  }

  const viewPath = resolve(ROOT, 'src/views', viewFile);
  let viewSrc;
  try {
    viewSrc = readFileSync(viewPath, 'utf8');
  } catch {
    failures.push(`  [${screen}] View file not found: src/views/${viewFile}`);
    exitCode = 1;
    continue;
  }

  const creatorClasses = classesFromHtml(creatorSection);
  const viewClasses    = classesFromTs(viewSrc);

  // Remove skip-listed classes from both sides before comparing
  for (const cls of skipClasses) { creatorClasses.delete(cls); viewClasses.delete(cls); }

  // Classes in creator but not in view → creator may have stale / invented classes
  const creatorOnly = diff(creatorClasses, viewClasses);
  // Classes in view but not in creator → creator is missing new view classes
  const viewOnly    = diff(viewClasses,    creatorClasses);

  if (creatorOnly.length > 0 || viewOnly.length > 0) {
    exitCode = 1;
    failures.push(`  [${screen}] Drift detected:`);
    if (creatorOnly.length > 0)
      failures.push(`    In creator but not view (stale?): ${creatorOnly.join(', ')}`);
    if (viewOnly.length > 0)
      failures.push(`    In view but not creator (missing?): ${viewOnly.join(', ')}`);
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

if (exitCode === 0) {
  console.log('✓ Creator markup is in sync with view files.');
} else {
  console.error('✗ Creator markup has drifted from view files:');
  for (const line of failures) console.error(line);
  console.error('\nUpdate src/skin-creator/creator.js to match the current view markup.');
}

process.exit(exitCode);
