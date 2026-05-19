import { ensureBundledPuzzlesLoaded, getDailyPuzzleIndex, getDayNumberSinceLaunch, getPuzzleAtIndex } from '../game/PuzzleLoader';
import { t } from '../i18n';
import { getProgressSnapshot, getSolvedIds } from '../services/ProgressService';
import { t as tp } from '../utils/i18n';
import type { RoutePayloads } from './Router';
import { getMonetizationContext } from '../services/MonetizationContext';
import { STORE_URLS } from '../config/legalUrls';

type MenuCallbacks = {
  onPlay: (payload: RoutePayloads['game']) => void;
  onOpenSettings: () => void;
  onOpenArchive: () => void;
  onOpenHowToPlay: () => void;
};

export class MenuView {
  readonly element: HTMLDivElement;

  constructor(callbacks: MenuCallbacks) {
    const puzzles = ensureBundledPuzzlesLoaded();
    const dailyIndex = getDailyPuzzleIndex(puzzles);
    const dailyPuzzle = getPuzzleAtIndex(dailyIndex, puzzles);
    const dayNumber = getDayNumberSinceLaunch();
    const puzzleTitle = tp(dailyPuzzle.name, dailyPuzzle.id);

    const gamePayload: RoutePayloads['game'] = {
      puzzle: dailyPuzzle,
      dayNumber,
      isTodaysDaily: true
    };

    this.element = document.createElement('div');
    this.element.className = 'view menu-view';
    const root = this.element;

    const topBar = document.createElement('div');
    topBar.className = 'menu-top-bar';

    const dayChip = document.createElement('span');
    dayChip.className = 'menu-day-chip';
    dayChip.textContent = t('menu.day_chip', { n: dayNumber });

    const settingsButton = document.createElement('button');
    settingsButton.type = 'button';
    settingsButton.className = 'menu-icon-button';
    settingsButton.textContent = '⚙';
    settingsButton.setAttribute('aria-label', t('menu.settings_aria'));
    settingsButton.addEventListener('click', () => {
      callbacks.onOpenSettings();
    });

    topBar.append(dayChip, settingsButton);

    const logo = document.createElement('div');
    logo.className = 'menu-logo';

    const logoTop = document.createElement('span');
    logoTop.className = 'menu-logo-top';
    logoTop.textContent = t('menu.brand_glitch');

    const logoBottom = document.createElement('span');
    logoBottom.className = 'menu-logo-bottom';
    logoBottom.textContent = t('menu.brand_salad');

    logo.append(logoTop, logoBottom);

    const divider = document.createElement('div');
    divider.className = 'menu-divider';

    const statsStrip = document.createElement('div');
    statsStrip.className = 'stats-strip';

    const streakCard = document.createElement('div');
    streakCard.className = 'stat-card';
    streakCard.dataset.highlight = 'true';
    const streakValue = document.createElement('span');
    streakValue.className = 'stat-value';
    streakValue.textContent = '0';
    const streakLabel = document.createElement('span');
    streakLabel.className = 'stat-label';
    streakLabel.textContent = t('menu.stat_streak');
    streakCard.append(streakValue, streakLabel);

    const solvedCard = document.createElement('div');
    solvedCard.className = 'stat-card';
    const solvedValue = document.createElement('span');
    solvedValue.className = 'stat-value';
    solvedValue.textContent = '0';
    const solvedLabel = document.createElement('span');
    solvedLabel.className = 'stat-label';
    solvedLabel.textContent = t('menu.stat_solved');
    solvedCard.append(solvedValue, solvedLabel);

    const bestCard = document.createElement('div');
    bestCard.className = 'stat-card';
    const bestValue = document.createElement('span');
    bestValue.className = 'stat-value';
    bestValue.textContent = t('menu.stat_empty');
    const bestLabel = document.createElement('span');
    bestLabel.className = 'stat-label';
    bestLabel.textContent = t('menu.stat_best');
    bestCard.append(bestValue, bestLabel);

    statsStrip.append(streakCard, solvedCard, bestCard);

    const dailyCard = document.createElement('div');
    dailyCard.className = 'daily-card';

    const dailyCardHead = document.createElement('div');
    dailyCardHead.className = 'daily-card-head';

    const dailyTag = document.createElement('span');
    dailyTag.className = 'daily-card-tag';
    dailyTag.textContent = t('menu.daily_tag_today');

    const countdownEl = document.createElement('span');
    countdownEl.className = 'daily-card-countdown';
    countdownEl.textContent = t('menu.daily_next_in', { time: this.formatTimeUntilMidnight() });

    dailyCardHead.append(dailyTag, countdownEl);

    const dailyTitle = document.createElement('h2');
    dailyTitle.className = 'daily-card-title';
    dailyTitle.textContent = puzzleTitle;

    const dailyMeta = document.createElement('p');
    dailyMeta.className = 'daily-card-meta';
    dailyMeta.textContent = `${dailyPuzzle.category} · ${dailyPuzzle.difficulty}`;

    const dailyPlayButton = document.createElement('button');
    dailyPlayButton.type = 'button';
    dailyPlayButton.className = 'daily-play-button';
    dailyPlayButton.textContent = t('menu.daily_play');
    dailyPlayButton.addEventListener('click', (event) => {
      event.stopPropagation();
      callbacks.onPlay(gamePayload);
    });

    dailyCard.addEventListener('click', () => {
      callbacks.onPlay(gamePayload);
    });
    dailyCard.append(dailyCardHead, dailyTitle, dailyMeta, dailyPlayButton);

    const footerActions = document.createElement('div');
    footerActions.className = 'menu-footer-actions';

    const archiveButton = document.createElement('button');
    archiveButton.type = 'button';
    archiveButton.className = 'menu-footer-action';
    archiveButton.textContent = t('menu.footer_archive');
    archiveButton.addEventListener('click', () => {
      callbacks.onOpenArchive();
    });

    const howToPlayButton = document.createElement('button');
    howToPlayButton.type = 'button';
    howToPlayButton.className = 'menu-footer-action';
    howToPlayButton.textContent = t('menu.footer_how_to_play');
    howToPlayButton.addEventListener('click', () => {
      callbacks.onOpenHowToPlay();
    });

    footerActions.append(archiveButton, howToPlayButton);

    // Add web-only "Get the app" footer
    const context = getMonetizationContext();
    if (!context.isNative) {
      const getAppRow = document.createElement('div');
      getAppRow.className = 'menu-get-app';

      const label = document.createElement('span');
      label.className = 'menu-get-app-label';
      label.textContent = t('menu.get_app_label');

      const appStoreLink = document.createElement('a');
      appStoreLink.href = STORE_URLS.appStore;
      appStoreLink.target = '_blank';
      appStoreLink.rel = 'noopener noreferrer';
      appStoreLink.className = 'menu-get-app-link';
      appStoreLink.textContent = t('settings.store_app_store');

      const dot = document.createElement('span');
      dot.className = 'menu-get-app-divider';
      dot.textContent = '·';

      const playStoreLink = document.createElement('a');
      playStoreLink.href = STORE_URLS.playStore;
      playStoreLink.target = '_blank';
      playStoreLink.rel = 'noopener noreferrer';
      playStoreLink.className = 'menu-get-app-link';
      playStoreLink.textContent = t('settings.store_play_store');

      getAppRow.append(label, appStoreLink, dot, playStoreLink);
      footerActions.append(getAppRow);
    }

    const countdownIntervalId = window.setInterval(() => {
      if (!root.isConnected) {
        window.clearInterval(countdownIntervalId);
        return;
      }
      countdownEl.textContent = t('menu.daily_next_in', { time: this.formatTimeUntilMidnight() });
    }, 60_000);

    void (async () => {
      const [snapshot, solvedIds] = await Promise.all([
        getProgressSnapshot(),
        getSolvedIds()
      ]);
      if (!root.isConnected) return;
      streakValue.textContent = String(snapshot.currentStreak);
      solvedValue.textContent = String(snapshot.solvedCount);
      bestValue.textContent = snapshot.bestTimeSec === null ? t('menu.stat_empty') : this.formatElapsed(snapshot.bestTimeSec);

      if (solvedIds.includes(dailyPuzzle.id)) {
        dailyCard.dataset.solved = 'true';
        dailyPlayButton.textContent = t('menu.daily_play_again');
      }
    })();

    this.element.append(topBar, logo, divider, statsStrip, dailyCard, footerActions);
  }

  private formatElapsed(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private formatTimeUntilMidnight(): string {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const totalMinutes = Math.max(0, Math.floor((tomorrow.getTime() - now.getTime()) / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
}
