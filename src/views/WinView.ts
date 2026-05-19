import { Share } from '@capacitor/share';
import { getPuzzleById } from '../game/PuzzleLoader';
import { t, tn } from '../i18n';
import type { Router } from './Router';
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

    const headline = document.createElement('div');
    headline.className = 'win-headline';
    headline.dataset.stars = String(payload.starRating);

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

    const stats = document.createElement('div');
    stats.className = 'win-stats-line';

    const showStreak = payload.currentStreak >= 2;
    const showSolved = payload.solvedCount >= 2;
    const showHints = payload.hintsUsed > 0;

    if (showStreak) {
      const s = document.createElement('span');
      s.textContent = t('win.stat_day_streak', { n: payload.currentStreak });
      stats.append(s);
    }
    if (showStreak && showSolved) {
      const dot = document.createElement('span');
      dot.textContent = '·';
      stats.append(dot);
    }
    if (showSolved) {
      const s = document.createElement('span');
      s.textContent = t('win.stat_solved_count', { n: payload.solvedCount });
      stats.append(s);
    }
    if (showHints) {
      const dot = document.createElement('span');
      dot.textContent = '·';
      stats.append(dot);
      const h = document.createElement('span');
      h.textContent = tn('win.stat_hint', payload.hintsUsed);
      stats.append(h);
    }

    const shareButton = document.createElement('button');
    shareButton.type = 'button';
    shareButton.className = 'action-button win-share-button';
    shareButton.textContent = t('win.share_button');
    shareButton.addEventListener('click', () => {
      void shareWin(payload);
    });

    const secondaryRow = document.createElement('div');
    secondaryRow.className = 'win-secondary-row';

    const playAgainButton = document.createElement('button');
    playAgainButton.type = 'button';
    playAgainButton.className = 'win-play-again';
    playAgainButton.textContent = t('win.play_again');
    playAgainButton.addEventListener('click', () => this.onPlayAgain());

    const doneLink = document.createElement('button');
    doneLink.type = 'button';
    doneLink.className = 'win-done-link';
    doneLink.textContent = t('win.done_link');
    doneLink.addEventListener('click', onDone);

    secondaryRow.append(playAgainButton, doneLink);

    this.element.append(headline, title, time, pillRow, stats, shareButton, secondaryRow);
  }

  private onPlayAgain(): void {
    const puzzle = getPuzzleById(this.payload.puzzleId);
    if (!puzzle) {
      console.warn('[WinView] could not find puzzle to replay', this.payload.puzzleId);
      return;
    }

    this.router.popToRoot();
    this.router.push('game', {
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
