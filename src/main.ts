// All skin fonts live in one place. See src/fonts.css — add new fonts there.
import './fonts.css';
import './skins/skins.css';
import './index.css';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar';
import { Preferences } from '@capacitor/preferences';
import { loadPuzzles } from './game/PuzzleLoader';
import { getLang, initI18n } from './i18n';
import { applySkin, normalizeSkinId, onSkinChanged, SKINS } from './skins/registry';
import type { SkinId } from './skins/registry';
import { initIAP, isSkinAccessibleSync } from './services/IAPService';
import { bootstrapProgress, getStoredSkinId, reconcileAbandonedAttempt } from './services/ProgressService';
import { retroactivelyUnlockEarnedAchievements } from './services/AchievementService';
import { initAnalytics, track, updateLocale } from './services/AnalyticsService';
import { captureException, initSentry } from './services/SentryService';
import { initDailyNotification } from './services/NotificationService';
import { Router } from './views/Router';
import { parseCurrentUrl, parseDeepLinkUrl, type ParsedDeepLink } from './services/DeepLinking';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app root element');
}

// Set once initI18n succeeds, so the boot-error screen knows whether the
// player's chosen language is available.
let i18nReady = false;

async function boot(root: HTMLDivElement): Promise<void> {
  // ── Sync / non-async init ──────────────────────────────────────────────────
  initSentry();
  initAnalytics();

  // ── Critical path: everything needed before first render ──────────────────
  await initI18n();
  i18nReady = true;
  updateLocale();
  // DEV-only: `?bootfail` simulates a startup failure to preview the error screen.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('bootfail')) {
    throw new Error('Simulated boot failure (?bootfail)');
  }
  // Load the live catalog from the remote store (editor → Worker/R2) before the
  // first render so the daily + archive reflect published puzzles. loadPuzzles
  // is bounded (≤1.8s fetch timeout) and falls back to cache then the bundled
  // set on any failure, so startup never hangs or breaks if the network/store
  // is unavailable.
  await loadPuzzles();
  // A first-play attempt still marked from the last session means the app was
  // closed mid-puzzle → that first play is forfeited. Must run before any
  // route (incl. deep links) can open a game. One storage read; cheap.
  try {
    await reconcileAbandonedAttempt();
  } catch {
    // Never block startup on this.
  }
  // Skin on boot: honor the player's explicit choice if they've made one. If
  // they never have, follow the OS theme — light-mode devices land on Lumen
  // (Void's light twin), dark-mode on Void. resolveBootSkin keeps the
  // "explicit Void" vs "never chose" distinction (see getStoredSkinId).
  const storedSkin = await getStoredSkinId();
  applySkin(resolveBootSkin(storedSkin));
  // Keep following the OS theme live until the player picks a skin themselves.
  watchSystemThemeForDefaultSkin(getStoredSkinId);

  // Route immediately — the user sees UI as soon as skin + i18n are ready.
  const router = new Router(root);
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

  // Capacitor native: configure status bar (edge-to-edge, icon style follows
  // the active skin's light/dark polarity). Fire-and-forget — cosmetic
  // failures must never block startup.
  if (Capacitor.isNativePlatform()) {
    const statusBarStyleForSkin = (skinId: SkinId): StatusBarStyle => {
      const meta = SKINS.find((s) => s.id === skinId);
      // Light skins need dark icons (Style.Light); dark skins need white icons (Style.Dark).
      return meta?.isLight ? StatusBarStyle.Light : StatusBarStyle.Dark;
    };

    void (async () => {
      try {
        const skinId = resolveBootSkin(await getStoredSkinId());
        const style = statusBarStyleForSkin(skinId);
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setStyle({ style });
      } catch (err) {
        console.error('[StatusBar] init failed:', err);
      }
    })();

    // Keep icon style in sync whenever the player switches skins.
    onSkinChanged((skinId) => {
      const style = statusBarStyleForSkin(skinId);
      void StatusBar.setStyle({ style });
    });
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

    await retroactivelyUnlockEarnedAchievements({
      bestStreak: snapshot.bestStreak,
      solvedCount: snapshot.solvedCount,
      pristineCount: snapshot.pristineCount,
      archiveSolvesCount: snapshot.archiveSolvesCount,
      // First-play best only (replays excluded), matching the live speed checks.
      bestTimeSec: snapshot.bestTimeSec
    });
  })();
}

void boot(app).catch((error: unknown) => {
  // Anything on the critical path failed (i18n, catalog, skin, router, first
  // route). Without this the boot splash would spin forever.
  console.error('[boot] startup failed', error);
  try {
    captureException(error, { phase: 'boot' });
  } catch {
    // Sentry itself may be what failed.
  }
  renderBootError(app);
});

/**
 * Minimal, dependency-free error screen (reuses the inline .boot-splash styles
 * from index.html). Copy is inline EN/ES rather than i18n keys on purpose:
 * the i18n layer may be what failed.
 */
function renderBootError(root: HTMLElement): void {
  const lang = i18nReady ? getLang() : (navigator.language || '').toLowerCase().startsWith('es') ? 'es' : 'en';
  const copy = lang === 'es'
    ? { title: 'No se pudo iniciar Ludodex', body: 'Comprueba tu conexión e inténtalo de nuevo.', retry: 'Reintentar' }
    : { title: "Ludodex couldn't start", body: 'Check your connection and try again.', retry: 'Retry' };

  const wrap = document.createElement('div');
  wrap.className = 'boot-splash boot-error';
  wrap.setAttribute('role', 'alert');

  const box = document.createElement('div');
  box.className = 'boot-error-box';

  const title = document.createElement('p');
  title.className = 'boot-error-title';
  title.textContent = copy.title;

  const body = document.createElement('p');
  body.className = 'boot-error-body';
  body.textContent = copy.body;

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'boot-error-retry';
  retry.textContent = copy.retry;
  retry.addEventListener('click', () => window.location.reload());

  box.append(title, body, retry);
  wrap.append(box);
  root.replaceChildren(wrap);
  retry.focus();
}

/**
 * Decide which skin to show on boot.
 *  - If the player has explicitly chosen a skin before (any stored value,
 *    including 'void'), honor it.
 *  - If they never have, follow the OS colour scheme: light-mode devices get
 *    Lumen (Void's light twin), everything else gets Void.
 */
function resolveBootSkin(storedSkinId: string | null): ReturnType<typeof normalizeSkinId> {
  if (storedSkinId) {
    const normalized = normalizeSkinId(storedSkinId);
    // If the stored skin is no longer accessible (e.g. web promo rotated), fall back to void.
    // Storage is corrected async by SettingsView.bootstrap() on the next settings open.
    if (!isSkinAccessibleSync(normalized)) return 'void';
    return normalized;
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
