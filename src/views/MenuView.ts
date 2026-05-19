import { ensureBundledPuzzlesLoaded, getDailyPuzzleIndex, getDayNumberSinceLaunch, getPuzzleAtIndex, getPuzzleForDay } from '../game/PuzzleLoader';
import { t } from '../i18n';
import { getProgressSnapshot, getSolvedIds, getSolvedRatings, getSolvedTimes, getStreakStatus } from '../services/ProgressService';
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

    const dailySection = document.createElement('div');
    dailySection.className = 'menu-daily-section';

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
    dailyPlayButton.className = 'daily-play-button button-primary';
    dailyPlayButton.textContent = t('menu.daily_play');
    dailyPlayButton.addEventListener('click', (event) => {
      event.stopPropagation();
      callbacks.onPlay(gamePayload);
    });

    dailyCard.addEventListener('click', () => {
      callbacks.onPlay(gamePayload);
    });
    dailyCard.append(dailyCardHead, dailyTitle, dailyMeta, dailyPlayButton);
    dailySection.append(dailyCard);

    const footerActions = document.createElement('div');
    footerActions.className = 'menu-footer-actions';

    const archiveButton = document.createElement('button');
    archiveButton.type = 'button';
    archiveButton.className = 'menu-footer-action button-tertiary';
    archiveButton.textContent = t('menu.footer_archive');
    archiveButton.addEventListener('click', () => {
      callbacks.onOpenArchive();
    });

    const howToPlayButton = document.createElement('button');
    howToPlayButton.type = 'button';
    howToPlayButton.className = 'menu-footer-action button-tertiary';
    howToPlayButton.textContent = t('menu.footer_how_to_play');
    howToPlayButton.addEventListener('click', () => {
      callbacks.onOpenHowToPlay();
    });

    footerActions.append(archiveButton, howToPlayButton);

    let getAppRow: HTMLDivElement | null = null;

    // Add web-only "Get the app" footer on its own line.
    const context = getMonetizationContext();
    if (!context.isNative) {
      getAppRow = document.createElement('div');
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

      const links = document.createElement('span');
      links.className = 'menu-get-app-links';
      links.append(appStoreLink, dot, playStoreLink);

      getAppRow.append(label, links);
    }

    const countdownIntervalId = window.setInterval(() => {
      if (!root.isConnected) {
        window.clearInterval(countdownIntervalId);
        return;
      }
      countdownEl.textContent = t('menu.daily_next_in', { time: this.formatTimeUntilMidnight() });
    }, 60_000);

    void (async () => {
      const [snapshot, solvedIds, solvedTimes, solvedRatings, streakStatus] = await Promise.all([
        getProgressSnapshot(),
        getSolvedIds(),
        getSolvedTimes(),
        getSolvedRatings(),
        getStreakStatus()
      ]);
      if (!root.isConnected) return;
      streakValue.textContent = String(streakStatus.effective);
      solvedValue.textContent = String(snapshot.solvedCount);
      bestValue.textContent = snapshot.bestTimeSec === null ? t('menu.stat_empty') : this.formatElapsed(snapshot.bestTimeSec);

      if (streakStatus.brokenAt !== null) {
        const banner = this.buildStreakLossBanner(streakStatus.brokenAt);
        root.insertBefore(banner, dailySection);
      }

      if (solvedIds.includes(dailyPuzzle.id)) {
        dailyCard.dataset.solved = 'true';
        dailyPlayButton.textContent = t('menu.daily_play_again');
      }

      const yesterdayNumber = dayNumber - 1;
      if (yesterdayNumber >= 1) {
        const yesterdayEntry = getPuzzleForDay(yesterdayNumber, puzzles);
        if (yesterdayEntry) {
          const yesterdayPuzzle = yesterdayEntry.puzzle;
          const isSolved = solvedIds.includes(yesterdayPuzzle.id);
          const time = isSolved ? solvedTimes[yesterdayPuzzle.id] : null;
          const rating = solvedRatings[yesterdayPuzzle.id] ?? 0;
          const card = this.buildYesterdayCard(yesterdayNumber, yesterdayPuzzle, isSolved, time, rating);
          card.addEventListener('click', () => {
            callbacks.onPlay({
              puzzle: yesterdayPuzzle,
              dayNumber: yesterdayNumber,
              isTodaysDaily: false
            });
          });
          dailySection.append(card);
        }
      }
    })();

    this.element.append(topBar, logo, divider, statsStrip, dailySection, footerActions);
    if (getAppRow) {
      this.element.append(getAppRow);
    }
  }

  private buildYesterdayCard(
    dayNumber: number,
    puzzle: RoutePayloads['game']['puzzle'],
    isSolved: boolean,
    time: number | null,
    rating: number
  ): HTMLButtonElement {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'yesterday-card';
    card.dataset.status = isSolved ? 'solved' : 'unsolved';

    const tag = document.createElement('div');
    tag.className = 'yesterday-card-tag';
    tag.textContent = t('menu.yesterday_tag', { n: dayNumber });

    const title = document.createElement('div');
    title.className = 'yesterday-card-title';
    title.textContent = tp(puzzle.name, puzzle.id);

    const status = document.createElement('div');
    status.className = 'yesterday-card-status';

    if (isSolved) {
      const stars = document.createElement('span');
      stars.className = 'yesterday-card-stars';
      stars.textContent = rating >= 1 && rating <= 3 ? this.renderStars(rating) : '—';

      const timeEl = document.createElement('span');
      timeEl.className = 'yesterday-card-time';
      timeEl.textContent = typeof time === 'number' && Number.isFinite(time)
        ? this.formatElapsed(time)
        : t('menu.stat_empty');

      status.append(stars, timeEl);
    } else {
      const unsolved = document.createElement('span');
      unsolved.className = 'yesterday-card-unsolved';
      unsolved.textContent = t('menu.yesterday_unsolved');
      status.append(unsolved);
    }

    const chevron = document.createElement('span');
    chevron.className = 'yesterday-card-chevron';
    chevron.textContent = '→';

    card.append(tag, title, status, chevron);
    return card;
  }

  private buildStreakLossBanner(brokenAt: number): HTMLElement {
    const banner = document.createElement('div');
    banner.className = 'streak-loss-banner';

    const icon = document.createElement('span');
    icon.className = 'streak-loss-icon';
    icon.textContent = '🔥';

    const text = document.createElement('span');
    text.className = 'streak-loss-text';
    text.textContent = t('menu.streak_loss', { n: brokenAt });

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'streak-loss-dismiss';
    dismiss.setAttribute('aria-label', t('menu.streak_loss_dismiss'));
    dismiss.textContent = '✕';
    dismiss.addEventListener('click', () => banner.remove());

    banner.append(icon, text, dismiss);
    return banner;
  }

  private renderStars(rating: number): string {
    const bounded = Math.max(0, Math.min(3, rating));
    return '★'.repeat(bounded) + '☆'.repeat(3 - bounded);
  }

  private formatElapsed(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private formatTimeUntilMidnight(): string {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const diffMs = Math.max(0, tomorrow.getTime() - now.getTime());
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}
