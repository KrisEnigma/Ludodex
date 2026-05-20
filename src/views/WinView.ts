import { Share } from '@capacitor/share';
import { createIcon } from '../components/icons';
import { getPuzzleById } from '../game/PuzzleLoader';
import { showConfetti } from '../components/Confetti';
import { t, tn } from '../i18n';
import { clearPuzzleReveals } from '../services/HintService';
import type { Router } from './Router';
import { ACHIEVEMENTS } from '../data/achievements';
import type { WinPayload } from './types';

export class WinView {
  readonly element: HTMLDivElement;
  private readonly payload: WinPayload;
  private readonly router: Router;

  constructor(payload: WinPayload, router: Router, onDone: () => void) {
    this.payload = payload;
    this.router = router;

    this.element = document.createElement('div');
    this.element.className = 'view win-view';
    this.element.dataset.stars = String(payload.starRating);

    if (payload.starRating === 3) {
      window.setTimeout(() => {
        showConfetti({
          count: 60,
          duration: 7000,
          colors: ['var(--title-glow)', 'var(--title-color)']
        });
      }, 600);
    }

    const headline = document.createElement('div');
    headline.className = 'win-headline';
    headline.dataset.pristine = String(payload.starRating === 3);

    const starsRow = document.createElement('div');
    starsRow.className = 'win-stars';
    for (let i = 1; i <= 3; i += 1) {
      const star = document.createElement('span');
      star.className = 'win-star';
      star.dataset.filled = String(i <= payload.starRating);
      star.dataset.position = String(i);
      star.textContent = '★';
      starsRow.append(star);
    }
    headline.append(starsRow);

    if (payload.starRating === 3) {
      const label = document.createElement('span');
      label.className = 'win-headline-label';
      label.textContent = t('win.pristine_label');
      headline.append(label);
    } else {
      const subtitle = document.createElement('p');
      subtitle.className = 'view-subtitle';
      subtitle.textContent = t('win.solved_subtitle');
      headline.append(subtitle);
    }

    const title = document.createElement('h2');
    title.className = 'view-title';
    title.textContent = payload.puzzleTitle;

    const time = document.createElement('div');
    time.className = 'win-time';
    time.textContent = formatTime(payload.elapsedSeconds);

    const nextCountdown = document.createElement('p');
    nextCountdown.className = 'win-next-countdown';
    nextCountdown.hidden = !payload.isTodaysDaily;
    if (payload.isTodaysDaily) {
      const updateCountdown = (): void => {
        if (!this.element.isConnected) return;
        nextCountdown.textContent = `${t('menu.daily_next_in', { time: formatTimeUntilMidnight() })}`;
      };
      updateCountdown();
      const countdownId = window.setInterval(() => {
        if (!this.element.isConnected) {
          window.clearInterval(countdownId);
          return;
        }
        updateCountdown();
      }, 1000);
    }

    const newBest = document.createElement('div');
    newBest.className = 'win-new-best';
    newBest.textContent = t('win.new_best');
    newBest.hidden = !payload.wasNewBest;

    const newRating = document.createElement('div');
    newRating.className = 'win-new-rating';
    newRating.textContent = t('win.new_rating');
    newRating.hidden = !payload.wasNewRating;

    const pillRow = document.createElement('div');
    pillRow.className = 'win-pill-row';
    pillRow.append(newBest, newRating);

    const showStreak = payload.currentStreak >= 2;
    const showMistakes = payload.mistakes > 0;
    const showHints = payload.hintsUsed > 0;
    const hasStats = showStreak || showMistakes || showHints;

    let stats: HTMLDivElement | null = null;
    if (hasStats) {
      stats = document.createElement('div');
      stats.className = 'win-stats-line';

      type StatPart = { icon?: 'flame' | 'bulb'; text: string };
      const parts: StatPart[] = [];
      if (showStreak) parts.push({ icon: 'flame', text: t('win.stat_day_streak', { n: payload.currentStreak }) });
      if (showMistakes) parts.push({ text: tn('win.stat_mistake', payload.mistakes) });
      if (showHints) parts.push({ icon: 'bulb', text: tn('win.stat_hint', payload.hintsUsed) });

      parts.forEach((part, i) => {
        if (i > 0) {
          const dot = document.createElement('span');
          dot.textContent = '·';
          stats!.append(dot);
        }
        const wrap = document.createElement('span');
        wrap.className = 'win-stat-part';
        if (part.icon) wrap.append(createIcon(part.icon));
        const text = document.createElement('span');
        text.textContent = part.text;
        wrap.append(text);
        stats!.append(wrap);
      });
    }

    const shareButton = document.createElement('button');
    shareButton.type = 'button';
    shareButton.className = 'win-share-button button-primary';
    shareButton.textContent = t('win.share_button');
    shareButton.addEventListener('click', () => {
      void shareWin(payload);
    });

    const secondaryRow = document.createElement('div');
    secondaryRow.className = 'win-secondary-row';

    const playAgainButton = document.createElement('button');
    playAgainButton.type = 'button';
    playAgainButton.className = 'win-play-again button-secondary';
    playAgainButton.textContent = t('win.play_again');
    playAgainButton.addEventListener('click', () => {
      void this.onPlayAgain();
    });

    const doneLink = document.createElement('button');
    doneLink.type = 'button';
    doneLink.className = 'win-done-link button-tertiary';
    doneLink.textContent = t('win.done_link');
    doneLink.addEventListener('click', onDone);

    secondaryRow.append(playAgainButton, doneLink);

    const achievementsSection =
      payload.unlockedAchievements && payload.unlockedAchievements.length > 0
        ? this.renderAchievementsSection(payload.unlockedAchievements)
        : null;

    const children: HTMLElement[] = [
      headline,
      title,
      time,
      pillRow,
      ...(achievementsSection ? [achievementsSection] : []),
      ...(stats ? [stats] : []),
      shareButton,
      secondaryRow,
      nextCountdown
    ];

    this.element.append(...children);

  }

  private renderAchievementsSection(unlockedAchievementIds: string[]): HTMLElement | null {
    const unlockedDefs = unlockedAchievementIds
      .map((id) => ACHIEVEMENTS.find((achievement) => achievement.id === id))
      .filter((def): def is typeof ACHIEVEMENTS[number] => !!def);

    if (unlockedDefs.length === 0) return null;

    const achievementsSection = document.createElement('section');
    achievementsSection.className = 'win-achievements-section';

    const heading = document.createElement('div');
    heading.className = 'win-achievements-heading';
    heading.textContent = t('win.achievements_unlocked');
    achievementsSection.append(heading);

    for (const def of unlockedDefs) {
      achievementsSection.append(this.renderAchievementCard(def));
    }

    return achievementsSection;
  }

  private renderAchievementCard(def: typeof ACHIEVEMENTS[number]): HTMLElement {
    const card = document.createElement('div');
    card.className = 'win-achievement-card';

    const icon = document.createElement('div');
    icon.className = 'win-achievement-card-icon';
    icon.append(createIcon('trophy'));
    card.append(icon);

    const details = document.createElement('div');
    details.className = 'win-achievement-details';
    const name = document.createElement('div');
    name.className = 'win-achievement-name';
    name.textContent = t(def.nameKey as import('../i18n').StringKey);
    const desc = document.createElement('div');
    desc.className = 'win-achievement-description';
    desc.textContent = t(def.descriptionKey as import('../i18n').StringKey);
    details.append(name, desc);
    card.append(details);
    return card;
  }

  private async onPlayAgain(): Promise<void> {
    const puzzle = getPuzzleById(this.payload.puzzleId);
    if (!puzzle) {
      console.warn('[WinView] could not find puzzle to replay', this.payload.puzzleId);
      return;
    }

    try {
      await clearPuzzleReveals(this.payload.puzzleId);
    } catch (err) {
      console.warn('[WinView] failed to clear hint reveals before replay', err);
    }

    this.router.replace('game', {
      puzzle,
      dayNumber: this.payload.dayNumber,
      isTodaysDaily: this.payload.isTodaysDaily
    });
  }
}

function renderStars(rating: 1 | 2 | 3): string {
  return '★'.repeat(rating) + '☆'.repeat(3 - rating);
}

function buildShareText(payload: WinPayload): string {
  const time = formatTime(payload.elapsedSeconds);
  const stars = renderStars(payload.starRating);

  const actionLabel = payload.starRating === 3
    ? t('share.pristine_in', { time })
    : t('share.solved_in', { time });

  const hintsSuffix = payload.hintsUsed > 0
    ? (payload.hintsUsed === 1
      ? t('share.suffix_hint_one', { n: payload.hintsUsed })
      : t('share.suffix_hint_other', { n: payload.hintsUsed }))
    : '';
  const newBestSuffix = payload.wasNewBest ? t('share.suffix_new_best') : '';

  const performanceLine = `${stars} ${actionLabel}${hintsSuffix}${newBestSuffix}`;

  const statsParts: string[] = [];
  if (payload.currentStreak >= 2) {
    statsParts.push(t('share.stat_day_streak', { n: payload.currentStreak }));
  }
  if (payload.solvedCount >= 2) {
    statsParts.push(t('share.stat_solved_count', { n: payload.solvedCount }));
  }
  const statsLine = statsParts.join(' · ');

  const lines: string[] = [
    t('share.header', { day: payload.dayNumber, title: payload.puzzleTitle }),
    '',
    performanceLine
  ];
  if (statsLine) lines.push(statsLine);
  lines.push('', t('share.footer'));
  return lines.join('\n');
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatTimeUntilMidnight(): string {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const diffMs = Math.max(0, tomorrow.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

async function shareWin(payload: WinPayload): Promise<void> {
  try {
    await Share.share({
      title: 'GlitchSalad',
      text: buildShareText(payload)
    });
  } catch {
    // Sharing is optional and may be unavailable on web.
  }
}
