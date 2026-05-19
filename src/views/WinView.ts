import { Share } from '@capacitor/share';
import { t, tn } from '../i18n';
import type { WinPayload } from './types';

export class WinView {
  readonly element: HTMLDivElement;

  constructor(payload: WinPayload, onDone: () => void) {
    this.element = document.createElement('div');
    this.element.className = 'view win-view';

    const headline = document.createElement('div');
    headline.className = 'win-headline';
    headline.dataset.pristine = String(payload.wasPristine);

    if (payload.wasPristine) {
      const icon = document.createElement('span');
      icon.className = 'win-headline-icon';
      icon.textContent = '🏆';

      const label = document.createElement('span');
      label.className = 'win-headline-label';
      label.textContent = t('win.pristine_label');

      headline.append(icon, label);
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

    const doneLink = document.createElement('button');
    doneLink.type = 'button';
    doneLink.className = 'win-done-link';
    doneLink.textContent = t('win.done_link');
    doneLink.addEventListener('click', onDone);

    this.element.append(headline, title, time, newBest, stats, shareButton, doneLink);
  }
}

function buildShareText(payload: WinPayload): string {
  const time = formatTime(payload.elapsedSeconds);

  const headlineKey = payload.wasPristine ? 'share.line_pristine' : 'share.line_solved';
  const headline = t(headlineKey, { time });

  const hintsSuffix = payload.hintsUsed > 0
    ? (payload.hintsUsed === 1
      ? t('share.suffix_hint_one', { n: payload.hintsUsed })
      : t('share.suffix_hint_other', { n: payload.hintsUsed }))
    : '';
  const newBestSuffix = payload.wasNewBest ? t('share.suffix_new_best') : '';

  const performanceLine = `${headline}${hintsSuffix}${newBestSuffix}`;

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
