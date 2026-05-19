import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import './skins/skins.css';
import './index.css';
import { Preferences } from '@capacitor/preferences';
import { ensureBundledPuzzlesLoaded } from './game/PuzzleLoader';
import { initI18n } from './i18n';
import { applySkin, normalizeSkinId } from './skins/registry';
import { initIAP } from './services/IAPService';
import { getActiveSkinId } from './services/ProgressService';
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

  const router = new Router(app);
  const tutorial = await Preferences.get({ key: 'tutorial_seen' });
  const shouldShowTutorial = tutorial.value !== 'true';

  if (shouldShowTutorial) {
    router.push('how-to-play', { fromOnboarding: true });
  } else {
    router.push('menu');
  }
})();
