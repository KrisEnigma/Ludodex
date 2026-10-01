import { createIcon } from '../components/icons';
import { ACHIEVEMENTS, type AchievementCategory, type AchievementDefinition } from '../data/achievements';
import { getEarnedAchievements, type EarnedRecord } from '../services/AchievementService';
import { getProgressSnapshot, getStreakStatus, type ProgressSnapshot } from '../services/ProgressService';
import { formatDuration } from '../utils/format';
import { t, getLang, type StringKey } from '../i18n';

const CATEGORY_ORDER: AchievementCategory[] = [
  'streak',
  'volume',
  'mastery',
  'speed',
  'consistency',
  'variety'
];

/** Badge glyph per category. */
const CATEGORY_ICON: Record<AchievementCategory, 'flame' | 'layers' | 'star' | 'bolt' | 'gem' | 'sparkle'> = {
  streak: 'flame',
  volume: 'layers',
  mastery: 'star',
  speed: 'bolt',
  consistency: 'gem',
  variety: 'sparkle'
};

type Tier = 'bronze' | 'silver' | 'gold' | 'diamond';
const TIERS: Tier[] = ['bronze', 'silver', 'gold', 'diamond'];

/** Progress toward a locked achievement, where it's measurable. */
type Progress =
  | { kind: 'count'; n: number; total: number }
  | { kind: 'time'; bestSec: number | null; targetSec: number };

function progressFor(id: string, snap: ProgressSnapshot, currentStreak: number): Progress | null {
  const m = /^(streak|solve|pristine_streak|pristine|archive|speed)_(\d+)$/.exec(id);
  if (!m) return null;
  const total = Number(m[2]);
  switch (m[1]) {
    case 'streak': return { kind: 'count', n: currentStreak, total };
    case 'solve': return { kind: 'count', n: snap.solvedCount, total };
    case 'pristine': return { kind: 'count', n: snap.pristineCount, total };
    case 'pristine_streak': return { kind: 'count', n: snap.consecutivePristineCount, total };
    case 'archive': return { kind: 'count', n: snap.archiveSolvesCount, total };
    case 'speed': return { kind: 'time', bestSec: snap.bestTimeSec, targetSec: total };
    default: return null;
  }
}

/** 0..1, for sorting "almost there" (time goals: how close the best is). */
function ratio(p: Progress): number {
  if (p.kind === 'count') return Math.min(1, p.n / Math.max(1, p.total));
  if (p.bestSec === null) return 0;
  return Math.min(0.99, p.targetSec / Math.max(p.targetSec, p.bestSec));
}

export class AchievementsView {
  public readonly element: HTMLDivElement;
  private readonly listContainer: HTMLDivElement;
  private readonly summaryEl: HTMLDivElement;
  private readonly almostEl: HTMLDivElement;

  constructor(private readonly onBack: () => void) {
    this.element = document.createElement('div');
    this.element.className = 'view achievements-view';

    this.summaryEl = document.createElement('div');
    this.summaryEl.className = 'achievements-summary';

    this.almostEl = document.createElement('div');
    this.almostEl.className = 'achievements-almost';
    this.almostEl.hidden = true;

    this.listContainer = document.createElement('div');
    this.listContainer.className = 'achievements-list';

    this.element.append(this.renderTopBar(), this.summaryEl, this.almostEl, this.listContainer);

    void this.populate();
  }

  private renderTopBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'view-topbar';

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'view-topbar-back';
    back.textContent = t('achievements.back');
    back.addEventListener('click', this.onBack);

    const title = document.createElement('h2');
    title.className = 'view-topbar-title';
    title.textContent = t('achievements.title');

    const spacer = document.createElement('span');
    spacer.style.width = '56px';

    bar.append(back, title, spacer);
    return bar;
  }

  private async populate(): Promise<void> {
    const [earned, snap, streak] = await Promise.all([getEarnedAchievements(), getProgressSnapshot(), getStreakStatus()]);
    if (!this.element.isConnected) return;

    const earnedById = new Map(earned.map((r) => [r.id, r] as const));
    const totalCount = ACHIEVEMENTS.length;
    const earnedCount = earned.length;
    const pct = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

    const progressById = new Map<string, Progress>();
    for (const a of ACHIEVEMENTS) {
      if (earnedById.has(a.id)) continue;
      const p = progressFor(a.id, snap, streak.effective);
      if (p) progressById.set(a.id, p);
    }

    // Hero summary: big earned count, small `/total unlocked` descriptor,
    // thin progress bar.
    this.summaryEl.replaceChildren();

    const countRow = document.createElement('div');
    countRow.className = 'achievements-summary-count';

    const earnedNum = document.createElement('span');
    earnedNum.className = 'achievements-summary-earned';
    earnedNum.textContent = String(earnedCount);

    const totalNum = document.createElement('span');
    totalNum.className = 'achievements-summary-total';
    totalNum.textContent = `/${totalCount}`;

    countRow.append(earnedNum, totalNum);

    const label = document.createElement('div');
    label.className = 'achievements-summary-label';
    label.textContent = t('achievements.unlocked_label');

    const bar = document.createElement('div');
    bar.className = 'achievements-summary-bar';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(totalCount));
    bar.setAttribute('aria-valuenow', String(earnedCount));

    const fill = document.createElement('div');
    fill.className = 'achievements-summary-bar-fill';
    fill.style.width = `${pct}%`;
    bar.append(fill);

    this.summaryEl.append(countRow, label, bar);

    // "Almost there": the three locked goals you're closest to.
    const almost = [...progressById.entries()]
      .filter(([, p]) => ratio(p) > 0)
      .sort((a, b) => ratio(b[1]) - ratio(a[1]))
      .slice(0, 3);
    this.almostEl.replaceChildren();
    if (almost.length > 0) {
      const heading = document.createElement('div');
      heading.className = 'achievements-section-heading';
      const headingLabel = document.createElement('span');
      headingLabel.className = 'achievements-section-label';
      headingLabel.textContent = t('achievements.almost_there');
      heading.append(headingLabel);
      this.almostEl.append(heading);
      for (const [id, p] of almost) {
        const def = ACHIEVEMENTS.find((a) => a.id === id);
        if (def) this.almostEl.append(this.renderAchievementRow(def, null, p));
      }
      this.almostEl.hidden = false;
    }

    for (const category of CATEGORY_ORDER) {
      const inCategory = ACHIEVEMENTS.filter((a) => a.category === category);
      if (inCategory.length === 0) continue;

      const section = this.renderCategorySection(category, inCategory, earnedById, progressById);
      this.listContainer.append(section);
    }
  }

  private renderCategorySection(
    category: AchievementCategory,
    achievements: AchievementDefinition[],
    earnedById: Map<string, EarnedRecord>,
    progressById: Map<string, Progress>
  ): HTMLElement {
    const section = document.createElement('section');
    section.className = 'achievements-section';

    const earnedInCategory = achievements.filter((a) => earnedById.has(a.id)).length;

    const heading = document.createElement('div');
    heading.className = 'achievements-section-heading';
    const headingLabel = document.createElement('span');
    headingLabel.className = 'achievements-section-label';
    headingLabel.textContent = t(`achievement_category.${category}` as StringKey);
    const headingCount = document.createElement('span');
    headingCount.className = 'achievements-section-count';
    headingCount.textContent = `${earnedInCategory}/${achievements.length}`;
    heading.append(headingLabel);
    heading.append(' ');
    heading.append(headingCount);
    section.append(heading);

    for (const achievement of achievements) {
      section.append(
        this.renderAchievementRow(achievement, earnedById.get(achievement.id) ?? null, progressById.get(achievement.id) ?? null)
      );
    }

    return section;
  }

  /** Tier from the achievement's position in its category (first → last). */
  private tierOf(definition: AchievementDefinition): Tier {
    const inCategory = ACHIEVEMENTS.filter((a) => a.category === definition.category);
    const index = inCategory.findIndex((a) => a.id === definition.id);
    if (inCategory.length <= 1) return 'gold';
    const step = Math.min(TIERS.length - 1, Math.floor((index / (inCategory.length - 1)) * TIERS.length));
    return TIERS[step];
  }

  private renderBadge(definition: AchievementDefinition, earned: boolean): HTMLElement {
    const badge = document.createElement('div');
    badge.className = 'achievement-badge';
    badge.dataset.tier = this.tierOf(definition);
    badge.dataset.earned = String(earned);
    badge.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span');
    inner.className = 'achievement-badge-inner';
    inner.append(createIcon(earned ? CATEGORY_ICON[definition.category] : 'lock'));
    badge.append(inner);
    return badge;
  }

  private renderAchievementRow(
    definition: AchievementDefinition,
    earned: EarnedRecord | null,
    progress: Progress | null
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'achievement-row';
    row.dataset.earned = String(earned !== null);

    const text = document.createElement('div');
    text.className = 'achievement-row-text';

    const name = document.createElement('div');
    name.className = 'achievement-row-name';
    name.textContent = t(definition.nameKey as StringKey);

    const description = document.createElement('div');
    description.className = 'achievement-row-description';
    description.textContent = t(definition.descriptionKey as StringKey);

    text.append(name, description);

    if (earned) {
      const status = document.createElement('div');
      status.className = 'achievement-row-status';
      status.textContent = t('achievements.earned_on', { date: this.formatEarnedDate(earned.earnedAt) });
      text.append(status);
    } else if (progress) {
      const meter = document.createElement('div');
      meter.className = 'achievement-row-progress';
      const track = document.createElement('span');
      track.className = 'achievement-row-progress-track';
      const fill = document.createElement('span');
      fill.style.width = `${Math.round(ratio(progress) * 100)}%`;
      track.append(fill);
      const label = document.createElement('span');
      label.className = 'achievement-row-progress-label';
      label.textContent = progress.kind === 'count'
        ? `${Math.min(progress.n, progress.total)}/${progress.total}`
        : progress.bestSec === null
          ? t('achievements.progress_no_best')
          : t('achievements.progress_best', { time: formatDuration(progress.bestSec) });
      meter.append(track, label);
      text.append(meter);
    }

    row.append(this.renderBadge(definition, earned !== null), text);
    return row;
  }

  private formatEarnedDate(iso: string): string {
    try {
      const date = new Date(iso);
      const locale = getLang() === 'es' ? 'es-ES' : 'en-US';
      // `month: 'long'` produces natural Spanish ("22 de mayo de 2026")
      // instead of the abbreviated "22 may 2026".
      return date.toLocaleDateString(locale, {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  }
}
