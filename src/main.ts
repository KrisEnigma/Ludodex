import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import './skins/skins.css';
import './index.css';
import { Preferences } from '@capacitor/preferences';
import { ensureBundledPuzzlesLoaded } from './game/PuzzleLoader';
import { initI18n } from './i18n';
import { applySkin, normalizeSkinId } from './skins/registry';
import { initIAP } from './services/IAPService';
import { bootstrapProgress, getActiveSkinId, getSolvedTimes } from './services/ProgressService';
import { retroactivelyUnlockEarnedAchievements } from './services/AchievementService';
import { initAnalytics, track, updateLocale } from './services/AnalyticsService';
import { initSentry } from './services/SentryService';
import { Router } from './views/Router';

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
  ensureBundledPuzzlesLoaded();
  applySkin(normalizeSkinId(await getActiveSkinId()));

  // Route immediately — the user sees UI as soon as skin + i18n are ready.
  const router = new Router(app);
  const tutorial = await Preferences.get({ key: 'tutorial_seen' });
  if (tutorial.value !== 'true') {
    router.push('how-to-play', { fromOnboarding: true });
  } else {
    router.push('menu');
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
