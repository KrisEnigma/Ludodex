import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
// Skin display fonts. Bundled via Vite (relative asset URLs) so they work
// offline on iOS/Android, same as Space Mono above. Latin-only subset and
// only the weights each skin uses (Press Start 2P ships 400 only) — keeps
// the bundle lean by skipping cyrillic/greek/vietnamese glyphs we never show.
import '@fontsource/orbitron/latin-700.css';
import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/silkscreen/latin-700.css';
import '@fontsource/vt323/latin-400.css'; // Terminal skin
import './skins/skins.css';
import './index.css';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { loadPuzzles } from './game/PuzzleLoader';
import { initI18n } from './i18n';
import { applySkin, normalizeSkinId } from './skins/registry';
import { initIAP } from './services/IAPService';
import { bootstrapProgress, getActiveSkinId, getSolvedTimes } from './services/ProgressService';
import { retroactivelyUnlockEarnedAchievements } from './services/AchievementService';
import { initAnalytics, track, updateLocale } from './services/AnalyticsService';
import { initSentry } from './services/SentryService';
import { initDailyNotification } from './services/NotificationService';
import { Router } from './views/Router';
import { parseCurrentUrl, parseDeepLinkUrl, type ParsedDeepLink } from './services/DeepLinking';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app root element');
}

void (async () => {
  // ── Sync / non-async init ──────────────────────────────────────────────────
  initSentry();
  initAnalytics();

  // ── Critical path: everything needed before first render ──────────────────
  await initI18n();
  updateLocale();
  // Load the live catalog from the remote store (editor → Worker/R2) before the
  // first render so the daily + archive reflect published puzzles. loadPuzzles
  // is bounded (≤1.8s fetch timeout) and falls back to cache then the bundled
  // set on any failure, so startup never hangs or breaks if the network/store
  // is unavailable.
  await loadPuzzles();
  applySkin(normalizeSkinId(await getActiveSkinId()));

  // Route immediately — the user sees UI as soon as skin + i18n are ready.
  const router = new Router(app);
  const tutorial = await Preferences.get({ key: 'tutorial_seen' });

  // First-time players always see the tutorial, even if they arrived via a
  // deep link — landing a brand-new user directly in a puzzle they don't
  // know how to play is a worse experience than the slight delay of going
  // through onboarding first.
  if (tutorial.value !== 'true') {
    router.push('how-to-play', { fromOnboarding: true });
  } else {
    // Returning player: honor any deep-link URL, otherwise menu.
    const initialDeepLink = await resolveInitialDeepLink();
    applyDeepLink(router, initialDeepLink);
  }

  // Capacitor native: listen for deep links that arrive while the app is
  // already running (warm-start). Cold-start native links are handled via
  // App.getLaunchUrl() inside resolveInitialDeepLink above.
  if (Capacitor.isNativePlatform()) {
    void CapacitorApp.addListener('appUrlOpen', (event) => {
      const parsed = parseDeepLinkUrl(event.url);
      track('deep_link_opened', { kind: parsed.kind, source: 'app_url_open' });
      applyDeepLink(router, parsed);
    });
  }

  // ── Non-critical background init ──────────────────────────────────────────
  // IAP, progress bootstrap, and achievement scan run after the first frame is
  // painted so they don't delay the initial render on slow devices / cold start.
  void (async () => {
    try {
      await initIAP();
    } catch {
      // Keep web/dev startup resilient when native billing is unavailable.
    }

    // Re-arm the daily reminder if the player opted in previously (native-only,
    // never prompts — see NotificationService.initDailyNotification).
    void initDailyNotification();

    const snapshot = await bootstrapProgress();
    track('app_opened', { is_first_open: snapshot.solvedCount === 0 });

    const solvedTimes = await getSolvedTimes();
    const bestTimeSec = (() => {
      const values = Object.values(solvedTimes).filter((v): v is number => Number.isFinite(v));
      return values.length === 0 ? null : Math.min(...values);
    })();

    await retroactivelyUnlockEarnedAchievements({
      bestStreak: snapshot.bestStreak,
      solvedCount: snapshot.solvedCount,
      pristineCount: snapshot.pristineCount,
      archiveSolvesCount: snapshot.archiveSolvesCount,
      bestTimeSec
    });
  })();
})();

/**
 * Resolve the deep link that opened the app, for cold-start routing.
 *
 *  - Native: ask Capacitor for the URL that launched the app via
 *    App.getLaunchUrl(). Falls back to parsing window.location in case
 *    the platform doesn't honor getLaunchUrl (unlikely on iOS/Android,
 *    but harmless).
 *  - Web: parse the current window.location.
 *
 * Returns a parsed deep-link descriptor; `{ kind: 'menu' }` is the
 * neutral "no deep link, just open the menu" fallback.
 */
async function resolveInitialDeepLink(): Promise<ParsedDeepLink> {
  if (Capacitor.isNativePlatform()) {
    try {
      const launch = await CapacitorApp.getLaunchUrl();
      if (launch?.url) {
        return parseDeepLinkUrl(launch.url);
      }
    } catch {
      // getLaunchUrl can throw if not available on the platform.
    }
  }
  return parseCurrentUrl();
}

/**
 * Apply a parsed deep link to the router. Always pushes the menu as the
 * stack root so that an internal `pop` from the deep-linked view lands
 * the player at home — even if they entered the app directly into a
 * puzzle. Browser-back from a deep-link entry still exits the app, which
 * is the expected behavior for a shared link.
 */
function applyDeepLink(router: Router, link: ParsedDeepLink): void {
  if (link.kind === 'puzzle') {
    track('deep_link_opened', { kind: 'puzzle', day_number: link.dayNumber });
    router.replace('menu');
    router.push('game', {
      puzzle: link.puzzle,
      dayNumber: link.dayNumber,
      isTodaysDaily: link.isTodaysDaily
    });
    return;
  }
  if (link.kind === 'archive-locked') {
    // The puzzle exists but is outside the web free window. Land them on
    // the menu and open the archive so they see the locked-gate row that
    // already exists; native players never hit this branch.
    track('deep_link_opened', { kind: 'archive_locked', day_number: link.dayNumber });
    router.replace('menu');
    router.push('archive');
    return;
  }
  if (link.kind === 'preview-puzzle') {
    // A puzzle encoded in the URL (editor "test in game" / tester share).
    // dayNumber 0 + isPreview: this is a throwaway play — nothing persists
    // (no solve record, streak, achievement, or ad cadence). See GameView.
    track('deep_link_opened', { kind: 'preview' });
    router.replace('menu');
    router.push('game', {
      puzzle: link.puzzle,
      dayNumber: 0,
      isTodaysDaily: false,
      isPreview: true,
      previewToken: link.token
    });
    return;
  }
  router.replace('menu');
}
