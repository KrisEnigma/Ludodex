import { createIcon } from '../components/icons';
import { ACHIEVEMENTS, type AchievementCategory, type AchievementDefinition } from '../data/achievements';
import { getEarnedAchievements, type EarnedRecord } from '../services/AchievementService';
import { t, getLang, type StringKey } from '../i18n';

const CATEGORY_ORDER: AchievementCategory[] = [
  'streak',
  'volume',
  'mastery',
  'speed',
  'consistency',
  'variety'
];

export class AchievementsView {
  public readonly element: HTMLDivElement;
  private readonly listContainer: HTMLDivElement;
  private readonly summaryEl: HTMLDivElement;

  constructor(private readonly onBack: () => void) {
    this.element = document.createElement('div');
    this.element.className = 'view achievements-view';

    this.summaryEl = document.createElement('div');
    this.summaryEl.className = 'achievements-summary';

    this.listContainer = document.createElement('div');
    this.listContainer.className = 'achievements-list';

    this.element.append(this.renderTopBar(), this.summaryEl, this.listContainer);

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
    const earned = await getEarnedAchievements();
    if (!this.element.isConnected) return;

    const earnedById = new Map(earned.map((r) => [r.id, r] as const));
    const totalCount = ACHIEVEMENTS.length;
    const earnedCount = earned.length;
    const pct = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

    // Hero summary: big earned count, small `/total unlocked` descriptor,
    // thin progress bar. The earned count is the screen's most engaging
    // number — players who can see they're 11/39 of the way through are
    // more motivated to chase the rest. Previously this was rendered as
    // a single small muted line that read as a footer.
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

    for (const category of CATEGORY_ORDER) {
      const inCategory = ACHIEVEMENTS.filter((a) => a.category === category);
      if (inCategory.length === 0) continue;

      const section = this.renderCategorySection(category, inCategory, earnedById);
      this.listContainer.append(section);
    }
  }

  private renderCategorySection(
    category: AchievementCategory,
    achievements: AchievementDefinition[],
    earnedById: Map<string, EarnedRecord>
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
      section.append(this.renderAchievementRow(achievement, earnedById.get(achievement.id) ?? null));
    }

    return section;
  }

  private renderAchievementRow(
    definition: AchievementDefinition,
    earned: EarnedRecord | null
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'achievement-row';
    row.dataset.earned = String(earned !== null);

    const icon = document.createElement('div');
    icon.className = 'achievement-row-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.appendChild(createIcon(earned ? 'trophy' : 'lock'));

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
    }

    row.append(icon, text);
    return row;
  }

  private formatEarnedDate(iso: string): string {
    try {
      const date = new Date(iso);
      const locale = getLang() === 'es' ? 'es-ES' : 'en-US';
      // `month: 'long'` produces natural Spanish ("22 de mayo de 2026")
      // instead of the abbreviated "22 may 2026". For English the change
      // is invisible for short month names (May, Jun) and slightly longer
      // for spelled-out names (December). Card has room either way.
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
