import { ensureBundledPuzzlesLoaded, getDayNumberSinceLaunch, getPuzzleForDay } from '../game/PuzzleLoader';
import { t } from '../i18n';
import { getFirstSolveTimes, getSolvedIds, getSolvedTimes, getSolvedRatings, normalizeStarRating } from '../services/ProgressService';
import type { Puzzle } from '../types/puzzle';
import { t as tp } from '../utils/i18n';
import { getMonetizationContext } from '../services/MonetizationContext';
import { buildInstallCta } from '../components/InstallCta';
import { buildPuzzleTags } from '../components/PuzzleTags';
import { formatDuration } from '../utils/format';

/** On web, only the most recent N days are freely accessible. */
const WEB_FREE_DAYS = 7;

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
    // Cap to puzzle catalog size — days beyond the catalog have no content.
    const puzzleCount = ensureBundledPuzzlesLoaded().length;
    const ctx = getMonetizationContext();

    // Dev full-access: show the entire catalog regardless of today's day number.
    const isDevFullAccess = import.meta.env.DEV && sessionStorage.getItem('dev_sim_platform') === null;
    const lastArchiveDay = isDevFullAccess ? puzzleCount : Math.min(today - 1, puzzleCount);

    if (lastArchiveDay < 1) {
      const empty = document.createElement('p');
      empty.className = 'archive-empty';
      empty.textContent = t('archive.empty');
      this.listContainer.append(empty);
      return;
    }

    const [solvedIds, solvedTimes, firstSolveTimes, solvedRatings] = await Promise.all([
      getSolvedIds(),
      getSolvedTimes(),
      getFirstSolveTimes(),
      getSolvedRatings()
    ]);

    if (!this.element.isConnected) return;

    // On web, only the most recent WEB_FREE_DAYS entries are unlocked.
    // Older entries are shown as locked rows — visible but unplayable —
    // with an install CTA to prompt app download.
    // Dev full-access bypasses this gate entirely.
    const webFreeThreshold = (ctx.isNative || isDevFullAccess) ? 0 : lastArchiveDay - WEB_FREE_DAYS + 1;

    let lockedRowInserted = false;

    for (let day = lastArchiveDay; day >= 1; day -= 1) {
      const entry = getPuzzleForDay(day);
      if (!entry) continue;
      const { puzzle } = entry;

      if (!ctx.isNative && day < webFreeThreshold) {
        // Render one locked-gate row to represent all older entries.
        if (!lockedRowInserted) {
          this.listContainer.append(this.renderLockedGate());
          lockedRowInserted = true;
        }
        continue;
      }

      const isSolved = solvedIds.includes(puzzle.id);
      const bestValue = solvedTimes[puzzle.id];
      const firstValue = firstSolveTimes[puzzle.id];
      const best = isSolved && Number.isFinite(bestValue) ? bestValue : null;
      const first = isSolved && Number.isFinite(firstValue) ? firstValue : null;
      const rating = normalizeStarRating(solvedRatings[puzzle.id]);
      this.listContainer.append(this.renderRow(day, puzzle, isSolved, first, best, rating));
    }
  }

  /**
   * Install CTA shown at the bottom of the web archive list when older
   * puzzles fall outside the WEB_FREE_DAYS window. Uses the shared
   * InstallCta component so the styling and UA-detection logic match
   * the Win screen's install row.
   */
  private renderLockedGate(): HTMLElement {
    return buildInstallCta({
      className: 'archive-install-cta',
      headlineKey: 'archive.web_locked_label',
      subheadKey: 'archive.web_locked_cta',
    });
  }

  private renderRow(
    day: number,
    puzzle: Puzzle,
    isSolved: boolean,
    firstTime: number | null,
    bestTime: number | null,
    rating: number
  ): HTMLElement {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'archive-row';
    row.dataset.solved = String(isSolved);

    // Split number from title so the puzzle title can carry the visual
    // weight while the day number sits as quieter metadata. Single-string
    // labels meant `#508` and the title rendered at identical size/color,
    // and the cyan time on the right ended up reading as more important
    // than the puzzle identity. The new shape lets typography establish
    // hierarchy: puzzle title > number > rating/time.
    const label = document.createElement('div');
    label.className = 'archive-row-label';

    const num = document.createElement('span');
    num.className = 'archive-row-number';
    num.textContent = `#${day}`;

    const title = document.createElement('span');
    title.className = 'archive-row-title';
    title.textContent = tp(puzzle.name, puzzle.id);

    const tags = buildPuzzleTags({ category: puzzle.category, difficulty: puzzle.difficulty });

    label.append(num, title, tags);

    const meta = document.createElement('div');
    meta.className = 'archive-row-meta';

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
    // First-play time is the headline (docs/audit §6.2); a faster replay best
    // is shown next to it. No first-play time (forfeited) → best only.
    if (!isSolved || (firstTime === null && bestTime === null)) {
      status.textContent = t('archive.unsolved');
    } else if (firstTime !== null && bestTime !== null && bestTime < firstTime) {
      status.textContent = t('archive.time_first_best', {
        first: formatDuration(firstTime),
        best: formatDuration(bestTime)
      });
    } else {
      status.textContent = formatDuration((firstTime ?? bestTime) as number);
    }

    meta.append(stars, status);

    row.append(label, meta);
    row.addEventListener('click', () => {
      this.onPlay(puzzle, day);
    });
    return row;
  }

}
