import '@fontsource/space-mono/latin-400.css';
import '@fontsource/space-mono/latin-700.css';
// Skin display fonts. Bundled via Vite (relative asset URLs) so they work
// offline on iOS/Android, same as Space Mono above. Latin-only subset and
// only the weights each skin uses (Press Start 2P ships 400 only) — keeps
// the bundle lean by skipping cyrillic/greek/vietnamese glyphs we never show.
import '@fontsource/orbitron/latin-700.css';
import '@fontsource/oswald/latin-500.css'; // Test Chamber skin (tiles)
import '@fontsource/oswald/latin-600.css'; // Test Chamber skin (wordmark)
import '@fontsource/antonio/latin-700.css'; // Catalyst skin (tiles)
import '@fontsource/syncopate/latin-700.css'; // Catalyst skin (wordmark)
import '@fontsource/almendra/latin-700.css'; // Paleblood + Relic Gold skin (tiles)
import '@fontsource/unifrakturmaguntia/latin-400.css'; // Paleblood skin (wordmark)
import '@fontsource/comfortaa/latin-700.css'; // Aero skin (tiles)
import '@fontsource/audiowide/latin-400.css'; // Aero skin (wordmark)
import '@fontsource/share-tech-mono/latin-400.css'; // Star Hunter + Polygon skin (tiles)
import '@fontsource/russo-one/latin-400.css'; // Star Hunter + Crimson skin (wordmark)
import '@fontsource/cinzel-decorative/latin-700.css'; // Relic Gold skin (wordmark)
import '@fontsource/titan-one/latin-400.css'; // Puff Star skin (wordmark)
import '@fontsource/pixelify-sans/latin-700.css'; // 8-Bit Overworld skin (tiles)
import '@fontsource/bungee/latin-400.css'; // 8-Bit Overworld skin (wordmark)
import '@fontsource/dotgothic16/latin-400.css'; // 16-Bit Cape skin (tiles)
import '@fontsource/dela-gothic-one/latin-400.css'; // 16-Bit Cape skin (wordmark)
import '@fontsource/rubik-mono-one/latin-400.css'; // Blue Blur skin (tiles)
import '@fontsource/righteous/latin-400.css'; // Blue Blur skin (wordmark)
import '@fontsource/rocknroll-one/latin-400.css'; // Dragon Heat skin (tiles)
import '@fontsource/teko/latin-600.css'; // Dragon Heat skin (wordmark)
import '@fontsource/permanent-marker/latin-400.css'; // Radio Tag skin (tiles)
import '@fontsource/luckiest-guy/latin-400.css'; // Radio Tag skin (wordmark)
import '@fontsource/electrolize/latin-400.css'; // Cyber Shinobi skin (tiles)
import '@fontsource/major-mono-display/latin-400.css'; // Cyber Shinobi skin (wordmark)
import '@fontsource/exo-2/latin-700.css'; // Spirit skin (wordmark)
import '@fontsource/unbounded/latin-700.css'; // Crimson skin (tiles)
import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/silkscreen/latin-700.css';
import '@fontsource/vt323/latin-400.css'; // Terminal skin
import '@fontsource/cinzel/latin-400.css'; // Underworld skin
import '@fontsource/cinzel/latin-700.css'; // Underworld skin (wordmark)
import '@fontsource/squada-one/latin-400.css';  // Mushroom Kingdom skin (tiles)
import './skins/skins.css';
import './index.css';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { loadPuzzles } from './game/PuzzleLoader';
import { initI18n } from './i18n';
import { applySkin, normalizeSkinId } from './skins/registry';
import { initIAP } from './services/IAPService';
import { bootstrapProgress, getStoredSkinId, getSolvedTimes } from './services/ProgressService';
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
  // Skin on boot: honor the player's explicit choice if they've made one. If
  // they never have, follow the OS theme — light-mode devices land on Lumen
  // (Void's light twin), dark-mode on Void. resolveBootSkin keeps the
  // "explicit Void" vs "never chose" distinction (see getStoredSkinId).
  const storedSkin = await getStoredSkinId();
  applySkin(resolveBootSkin(storedSkin));
  // Keep following the OS theme live until the player picks a skin themselves.
  watchSystemThemeForDefaultSkin(getStoredSkinId);

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
 * Decide which skin to show on boot.
 *  - If the player has explicitly chosen a skin before (any stored value,
 *    including 'void'), honor it.
 *  - If they never have, follow the OS colour scheme: light-mode devices get
 *    Lumen (Void's light twin), everything else gets Void.
 */
function resolveBootSkin(storedSkinId: string | null): ReturnType<typeof normalizeSkinId> {
  if (storedSkinId) {
    return normalizeSkinId(storedSkinId);
  }
  return prefersLightScheme() ? 'lumen' : 'void';
}

function prefersLightScheme(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: light)').matches;
}

/**
 * While the player has NOT explicitly picked a skin, keep the default in sync
 * with the OS theme live: flipping the device to light mode swaps to Lumen,
 * back to dark swaps to Void. Once they choose a skin (getStored returns a
 * value), this stops touching the skin — their choice wins from then on.
 */
function watchSystemThemeForDefaultSkin(getStored: () => Promise<string | null>): void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return;
  }
  const query = window.matchMedia('(prefers-color-scheme: light)');
  const onChange = (event: MediaQueryListEvent): void => {
    void (async () => {
      // Respect an explicit choice — never override a skin the player picked.
      if (await getStored()) {
        return;
      }
      applySkin(event.matches ? 'lumen' : 'void');
    })();
  };
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', onChange);
  } else if (typeof query.addListener === 'function') {
    // Safari < 14 fallback.
    query.addListener(onChange);
  }
}

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
