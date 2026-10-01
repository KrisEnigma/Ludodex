import { ensureBundledPuzzlesLoaded, getDateForDayNumber, getDayNumberSinceLaunch, getPuzzleForDay } from '../game/PuzzleLoader';
import { getLang, t } from '../i18n';
import { getFirstSolveTimes, getSolvedIds, getSolvedTimes, getSolvedRatings, normalizeStarRating } from '../services/ProgressService';
import type { Puzzle } from '../types/puzzle';
import { t as tp } from '../utils/i18n';
import { getMonetizationContext } from '../services/MonetizationContext';
import { buildInstallCta } from '../components/InstallCta';
import { buildPuzzleTags } from '../components/PuzzleTags';
import { formatDuration } from '../utils/format';

/** On web, only the most recent N days are freely accessible. */
const WEB_FREE_DAYS = 7;

type Entry = {
  day: number;
  date: Date;
  puzzle: Puzzle;
  isSolved: boolean;
  first: number | null;
  best: number | null;
  rating: number;
  locked: boolean;
};

type Mode = 'calendar' | 'list';
let lastMode: Mode = 'calendar';

/** Dev-only: `?archivemock` fills the archive with ~1000 days of fake results
 *  (dated backwards from yesterday, so it ignores the real launch date). */
function mockEntries(_today: number): Entry[] {
  const names = ['Final Bosses', 'Racing Games', 'Sidekicks', 'Power-Ups', 'Space Shooters', 'JRPG Towns', 'Fighting Moves', 'Platform Heroes', 'Horror Classics', 'Puzzle Games', 'Sports Titles', 'Villains'];
  const cats = ['characters', 'items', 'locations', 'enemies'];
  const diffs = ['easy', 'medium', 'hard'] as const;
  const out: Entry[] = [];
  const last = 1000;
  const yesterday = new Date();
  yesterday.setHours(0, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);
  for (let day = last; day >= 1; day--) {
    const r = Math.abs(Math.sin(day * 12.9898) * 43758.5453) % 1;
    const played = r > 0.22;
    const rating = !played ? 0 : r > 0.62 ? 3 : r > 0.38 ? 2 : 1;
    const puzzle = {
      id: `mock-${day}`,
      name: { en: names[day % names.length], es: names[day % names.length] },
      category: cats[day % cats.length],
      difficulty: diffs[day % 3],
      date: null, series: null, hint: null, grid: {}, answers: []
    } as unknown as Puzzle;
    const time = played ? Math.round(20 + r * 140) : null;
    const date = new Date(yesterday);
    date.setDate(date.getDate() - (last - day));
    out.push({ day, date, puzzle, isSolved: played, first: time, best: time, rating, locked: false });
  }
  return out;
}

export class ArchiveView {
  public readonly element: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private entries: Entry[] = [];
  private mode: Mode = lastMode;
  private cursor = { year: 0, month: 0 };
  private selectedDay: number | null = null;
  private readonly isMock = import.meta.env.DEV && new URLSearchParams(window.location.search).has('archivemock');

  constructor(
    private readonly onBack: () => void,
    private readonly onPlay: (puzzle: Puzzle, dayNumber: number) => void
  ) {
    this.element = document.createElement('div');
    this.element.className = 'view archive-view';

    this.body = document.createElement('div');
    this.body.className = 'archive-body';

    this.element.append(this.renderTopBar(), this.body);

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

    if (this.isMock) {
      this.entries = mockEntries(today);
    } else {
      // Cap to puzzle catalog size — days beyond the catalog have no content.
      const puzzleCount = ensureBundledPuzzlesLoaded().length;
      const ctx = getMonetizationContext();
      // Dev full-access: show the entire catalog regardless of today's day number.
      const isDevFullAccess = import.meta.env.DEV && sessionStorage.getItem('dev_sim_platform') === null;
      const lastArchiveDay = isDevFullAccess ? puzzleCount : Math.min(today - 1, puzzleCount);

      const [solvedIds, solvedTimes, firstSolveTimes, solvedRatings] = await Promise.all([
        getSolvedIds(),
        getSolvedTimes(),
        getFirstSolveTimes(),
        getSolvedRatings()
      ]);
      if (!this.element.isConnected) return;

      // On web, only the most recent WEB_FREE_DAYS entries are playable.
      const webFreeThreshold = (ctx.isNative || isDevFullAccess) ? 0 : lastArchiveDay - WEB_FREE_DAYS + 1;
      for (let day = lastArchiveDay; day >= 1; day -= 1) {
        const entry = getPuzzleForDay(day);
        if (!entry) continue;
        const { puzzle } = entry;
        const isSolved = solvedIds.includes(puzzle.id);
        const bestValue = solvedTimes[puzzle.id];
        const firstValue = firstSolveTimes[puzzle.id];
        this.entries.push({
          day,
          date: getDateForDayNumber(day),
          puzzle,
          isSolved,
          first: isSolved && Number.isFinite(firstValue) ? (firstValue as number) : null,
          best: isSolved && Number.isFinite(bestValue) ? (bestValue as number) : null,
          rating: normalizeStarRating(solvedRatings[puzzle.id]),
          locked: !ctx.isNative && day < webFreeThreshold
        });
      }
    }

    if (this.entries.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'archive-empty';
      empty.textContent = t('archive.empty');
      this.body.append(empty);
      return;
    }

    const latest = this.entries[0];
    this.cursor = { year: latest.date.getFullYear(), month: latest.date.getMonth() };
    this.selectedDay = latest.day;
    this.render();
  }

  private render(): void {
    this.body.replaceChildren(this.renderModeToggle(), this.mode === 'calendar' ? this.renderCalendar() : this.renderList());
  }

  private renderModeToggle(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'settings-language-toggle archive-mode-toggle';
    for (const mode of ['calendar', 'list'] as const) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'settings-language-button';
      b.dataset.active = String(this.mode === mode);
      b.textContent = t(mode === 'calendar' ? 'archive.mode_calendar' : 'archive.mode_list');
      b.addEventListener('click', () => {
        this.mode = mode;
        lastMode = mode;
        this.render();
      });
      wrap.append(b);
    }
    return wrap;
  }

  // ── List (unchanged look) ────────────────────────────────────────────────

  /**
   * Newest first, grouped under month headings, rendered in batches as you
   * scroll (a sentinel near the end pulls in the next batch), so opening the
   * Archive costs the same at day 30 as at day 1000.
   */
  private renderList(): HTMLElement {
    const list = document.createElement('div');
    list.className = 'archive-list';

    const BATCH = 30;
    const locale = getLang() === 'es' ? 'es-ES' : 'en-US';
    const monthKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}`;
    const monthStats = new Map<string, { solved: number; total: number }>();
    for (const e of this.entries) {
      if (e.locked) continue;
      const k = monthKey(e.date);
      const m = monthStats.get(k) ?? { solved: 0, total: 0 };
      m.total += 1;
      if (e.isSolved) m.solved += 1;
      monthStats.set(k, m);
    }

    let index = 0;
    let currentMonth = '';
    let lockedRowInserted = false;
    const sentinel = document.createElement('div');
    sentinel.className = 'archive-list-sentinel';

    const appendBatch = (): void => {
      let added = 0;
      while (index < this.entries.length && added < BATCH) {
        const e = this.entries[index++];
        if (e.locked) {
          if (!lockedRowInserted) {
            sentinel.before(this.renderLockedGate());
            lockedRowInserted = true;
          }
          continue;
        }
        const k = monthKey(e.date);
        if (k !== currentMonth) {
          currentMonth = k;
          const heading = document.createElement('div');
          heading.className = 'archive-month-heading';
          const name = e.date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
          const label = document.createElement('span');
          label.textContent = name.charAt(0).toUpperCase() + name.slice(1);
          const stats = monthStats.get(k);
          const count = document.createElement('span');
          count.className = 'archive-month-count';
          count.textContent = stats ? t('archive.month_count', { solved: stats.solved, total: stats.total }) : '';
          heading.append(label, count);
          sentinel.before(heading);
        }
        sentinel.before(this.renderRow(e));
        added += 1;
      }
      if (index >= this.entries.length) {
        observer.disconnect();
        sentinel.remove();
      }
    };

    const observer = new IntersectionObserver(
      (records) => {
        // (The first callback arrives while the list is still detached —
        // only act on real intersections.)
        if (records.some((r) => r.isIntersecting) && list.isConnected) appendBatch();
      },
      { rootMargin: '0px 0px 600px 0px' }
    );

    list.append(sentinel);
    appendBatch();
    // Still more to load → watch the sentinel (it lives in `list`, which the
    // caller attaches to the page right after this returns).
    if (index < this.entries.length) observer.observe(sentinel);
    return list;
  }

  // ── Calendar ─────────────────────────────────────────────────────────────

  private renderCalendar(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'archive-calendar';

    const byDateKey = new Map<string, Entry>();
    for (const e of this.entries) byDateKey.set(this.key(e.date), e);
    const first = this.entries[this.entries.length - 1].date;
    const last = this.entries[0].date;

    const { year, month } = this.cursor;
    const locale = getLang() === 'es' ? 'es-ES' : 'en-US';

    // Header: ◀ Month Year ▶
    const header = document.createElement('div');
    header.className = 'archive-cal-header';
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'archive-cal-nav';
    prev.textContent = '‹';
    prev.setAttribute('aria-label', t('archive.prev_month'));
    prev.disabled = year < first.getFullYear() || (year === first.getFullYear() && month <= first.getMonth());
    prev.addEventListener('click', () => this.shiftMonth(-1));
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'archive-cal-nav';
    next.textContent = '›';
    next.setAttribute('aria-label', t('archive.next_month'));
    next.disabled = year > last.getFullYear() || (year === last.getFullYear() && month >= last.getMonth());
    next.addEventListener('click', () => this.shiftMonth(1));
    const title = document.createElement('span');
    title.className = 'archive-cal-title';
    const monthName = new Date(year, month, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    title.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    header.append(prev, title, next);

    // Month summary
    const inMonth = this.entries.filter((e) => e.date.getFullYear() === year && e.date.getMonth() === month);
    const solved = inMonth.filter((e) => e.isSolved).length;
    const flawless = inMonth.filter((e) => e.isSolved && e.rating === 3).length;
    const summary = document.createElement('div');
    summary.className = 'archive-cal-summary';
    summary.textContent = t('archive.month_summary', { solved, total: inMonth.length, flawless });

    // Weekday row (Sunday-first in English, Monday-first in Spanish).
    const weekStart = getLang() === 'es' ? 1 : 0;
    const grid = document.createElement('div');
    grid.className = 'archive-cal-grid';
    grid.setAttribute('role', 'grid');
    const wd = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
    for (let i = 0; i < 7; i++) {
      const d = new Date(2026, 1, 1 + ((weekStart + i) % 7)); // Feb 1 2026 is a Sunday
      const h = document.createElement('span');
      h.className = 'archive-cal-weekday';
      h.textContent = wd.format(d);
      grid.append(h);
    }

    const firstOfMonth = new Date(year, month, 1);
    const lead = (firstOfMonth.getDay() - weekStart + 7) % 7;
    for (let i = 0; i < lead; i++) grid.append(document.createElement('span'));
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayKey = this.key(new Date());

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const entry = byDateKey.get(this.key(date));
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'archive-cal-day';
      const num = document.createElement('span');
      num.className = 'archive-cal-num';
      num.textContent = String(d);
      cell.append(num);
      if (this.key(date) === todayKey) cell.dataset.today = 'true';
      if (!entry) {
        cell.dataset.state = 'none';
        cell.disabled = true;
      } else {
        cell.dataset.state = entry.locked ? 'locked' : entry.isSolved ? `stars-${entry.rating}` : 'open';
        if (entry.isSolved) {
          const dots = document.createElement('span');
          dots.className = 'archive-cal-dots';
          dots.textContent = '★'.repeat(entry.rating);
          cell.append(dots);
        }
        cell.dataset.selected = String(entry.day === this.selectedDay);
        cell.setAttribute(
          'aria-label',
          `${date.toLocaleDateString(locale, { month: 'long', day: 'numeric' })} · ${entry.isSolved ? '★'.repeat(entry.rating) : t('archive.unplayed')}`
        );
        cell.addEventListener('click', () => {
          this.selectedDay = entry.day;
          this.render();
        });
      }
      grid.append(cell);
    }

    // Selected day's puzzle, as the familiar archive row (tap to play).
    const selected = this.entries.find((e) => e.day === this.selectedDay && e.date.getFullYear() === year && e.date.getMonth() === month);
    const detail = document.createElement('div');
    detail.className = 'archive-cal-detail';
    if (selected) detail.append(selected.locked ? this.renderLockedGate() : this.renderRow(selected));

    wrap.append(header, summary, grid, detail);
    return wrap;
  }

  private shiftMonth(delta: number): void {
    const d = new Date(this.cursor.year, this.cursor.month + delta, 1);
    this.cursor = { year: d.getFullYear(), month: d.getMonth() };
    // Select the latest available day in the new month.
    const inMonth = this.entries.find((e) => e.date.getFullYear() === this.cursor.year && e.date.getMonth() === this.cursor.month);
    this.selectedDay = inMonth?.day ?? null;
    this.render();
  }

  private key(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  /**
   * Install CTA for web players when older puzzles fall outside the
   * WEB_FREE_DAYS window. Uses the shared InstallCta component.
   */
  private renderLockedGate(): HTMLElement {
    return buildInstallCta({
      className: 'archive-install-cta',
      headlineKey: 'archive.web_locked_label',
      subheadKey: 'archive.web_locked_cta',
    });
  }

  private renderRow(e: Entry): HTMLElement {
    const { day, puzzle, isSolved, first: firstTime, best: bestTime, rating } = e;
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'archive-row';
    row.dataset.solved = String(isSolved);

    // Typography sets the hierarchy: puzzle title > number > rating/time.
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
      if (this.isMock) return; // fake puzzles can't be played
      this.onPlay(puzzle, day);
    });
    return row;
  }
}
