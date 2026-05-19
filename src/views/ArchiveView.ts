import { getDayNumberSinceLaunch, getPuzzleForDay } from '../game/PuzzleLoader';
import { t } from '../i18n';
import { getSolvedIds, getSolvedTimes, getSolvedRatings } from '../services/ProgressService';
import type { Puzzle } from '../types/puzzle';
import { t as tp } from '../utils/i18n';

export class ArchiveView {
  public readonly element: HTMLDivElement;
  private readonly listContainer: HTMLDivElement;

  constructor(
    private readonly onBack: () => void,
    private readonly onPlay: (puzzle: Puzzle, dayNumber: number) => void
  ) {
    this.element = document.createElement('div');
    this.element.className = 'view archive-view';

    this.listContainer = document.createElement('div');
    this.listContainer.className = 'archive-list';

    this.element.append(this.renderTopBar(), this.listContainer);

    void this.populate();
  }

  private renderTopBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'view-topbar';

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'view-topbar-back';
    back.textContent = t('archive.back');
    back.addEventListener('click', this.onBack);

    const title = document.createElement('h2');
    title.className = 'view-topbar-title';
    title.textContent = t('archive.title');

    const spacer = document.createElement('span');
    spacer.style.width = '56px';

    bar.append(back, title, spacer);
    return bar;
  }

  private async populate(): Promise<void> {
    const today = getDayNumberSinceLaunch();
    const lastArchiveDay = today - 1;

    if (lastArchiveDay < 1) {
      const empty = document.createElement('p');
      empty.className = 'archive-empty';
      empty.textContent = t('archive.empty');
      this.listContainer.append(empty);
      return;
    }

    const [solvedIds, solvedTimes, solvedRatings] = await Promise.all([
      getSolvedIds(),
      getSolvedTimes(),
      getSolvedRatings()
    ]);

    if (!this.element.isConnected) return;

    for (let day = lastArchiveDay; day >= 1; day -= 1) {
      const entry = getPuzzleForDay(day);
      if (!entry) continue;
      const { puzzle } = entry;
      const isSolved = solvedIds.includes(puzzle.id);
      const timeValue = solvedTimes[puzzle.id];
      const time = isSolved && Number.isFinite(timeValue) ? timeValue : null;
      const rating = solvedRatings[puzzle.id] ?? 0;
      this.listContainer.append(this.renderRow(day, puzzle, isSolved, time, rating));
    }
  }

  private renderRow(
    day: number,
    puzzle: Puzzle,
    isSolved: boolean,
    time: number | null,
    rating: number
  ): HTMLElement {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'archive-row';
    row.dataset.solved = String(isSolved);

    const label = document.createElement('span');
    label.className = 'archive-row-label';
    label.textContent = t('archive.day_row', { n: day, title: tp(puzzle.name, puzzle.id) });

    const stars = document.createElement('span');
    stars.className = 'archive-row-stars';
    if (isSolved && rating >= 1 && rating <= 3) {
      stars.textContent = '★'.repeat(rating) + '☆'.repeat(3 - rating);
      stars.dataset.rating = String(rating);
    } else {
      stars.textContent = '';
    }

    const status = document.createElement('span');
    status.className = 'archive-row-status';
    status.textContent = isSolved && time !== null
      ? this.formatTime(time)
      : t('archive.unsolved');

    row.append(label, stars, status);
    row.addEventListener('click', () => {
      this.onPlay(puzzle, day);
    });
    return row;
  }

  private formatTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}
