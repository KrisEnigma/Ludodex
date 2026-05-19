import { Share } from '@capacitor/share';
import type { WinPayload } from './types';

export class WinView {
  readonly element: HTMLDivElement;

  constructor(payload: WinPayload, onDone: () => void) {
    this.element = document.createElement('div');
    this.element.className = 'view win-view';

    const subtitle = document.createElement('p');
    subtitle.className = 'view-subtitle';
    subtitle.textContent = 'Puzzle Solved';

    const title = document.createElement('h2');
    title.className = 'view-title';
    title.textContent = payload.puzzleTitle;

    const stats = document.createElement('div');
    stats.className = 'win-stats';

    const time = document.createElement('p');
    time.className = 'view-subtitle';
    time.textContent = `Time ${formatTime(payload.elapsedSeconds)}`;

    const streak = document.createElement('p');
    streak.className = 'view-subtitle';
    streak.textContent = `Streak ${payload.currentStreak}`;

    const solved = document.createElement('p');
    solved.className = 'view-subtitle';
    solved.textContent = `Solved total ${payload.solvedCount}`;

    stats.append(time, streak, solved);

    const shareButton = document.createElement('button');
    shareButton.type = 'button';
    shareButton.className = 'action-button';
    shareButton.textContent = 'Share';
    shareButton.addEventListener('click', () => {
      void shareWin(payload);
    });

    const doneButton = document.createElement('button');
    doneButton.type = 'button';
    doneButton.className = 'action-button';
    doneButton.textContent = 'Done';
    doneButton.addEventListener('click', onDone);

    this.element.append(subtitle, title, stats, shareButton, doneButton);
  }
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
      text: `I solved ${payload.puzzleTitle} in ${formatTime(payload.elapsedSeconds)} on GlitchSalad.`
    });
  } catch {
    // Sharing is optional and can be unavailable on some web contexts.
  }
}
