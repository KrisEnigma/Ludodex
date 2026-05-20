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
  private readonly summaryEl: HTMLParagraphElement;

  constructor(private readonly onBack: () => void) {
    this.element = document.createElement('div');
    this.element.className = 'view achievements-view';

    this.summaryEl = document.createElement('p');
    this.summaryEl.className = 'achievements-summary';
    this.summaryEl.textContent = '';

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

    this.summaryEl.textContent = t('achievements.unlocked_summary', {
      earned: earnedCount,
      total: totalCount
    });

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
      return date.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  }
}
