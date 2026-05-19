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
import { Router } from './views/Router';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app root element');
}

void (async () => {
  try {
    await initIAP();
  } catch {
    // Keep web/dev startup resilient when native billing is unavailable.
  }

  await initI18n();
  ensureBundledPuzzlesLoaded();

  applySkin(normalizeSkinId(await getActiveSkinId()));

  // Bootstrap progress (with pristine_count backfill), then run the retroactive
  // achievement scan so upgrading players catch up silently.
  const snapshot = await bootstrapProgress();
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

  const router = new Router(app);
  const tutorial = await Preferences.get({ key: 'tutorial_seen' });
  const shouldShowTutorial = tutorial.value !== 'true';

  if (shouldShowTutorial) {
    router.push('how-to-play', { fromOnboarding: true });
  } else {
    router.push('menu');
  }
})();
