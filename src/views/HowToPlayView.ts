import { Preferences } from '@capacitor/preferences';
import { t } from '../i18n';

const TUTORIAL_KEY = 'tutorial_seen';

type Step = {
  titleKey: 'how_to_play.step1_title' | 'how_to_play.step2_title' | 'how_to_play.step3_title' | 'how_to_play.step4_title';
  bodyKey: 'how_to_play.step1_body' | 'how_to_play.step2_body' | 'how_to_play.step3_body' | 'how_to_play.step4_body';
  svg: string;
};

export class HowToPlayView {
  public readonly element: HTMLDivElement;
  private current = 0;
  private readonly steps: Step[];

  constructor(
    private readonly payload: { fromOnboarding: boolean },
    private readonly onFinish: () => void
  ) {
    this.steps = [
      { titleKey: 'how_to_play.step1_title', bodyKey: 'how_to_play.step1_body', svg: this.svgFormWords() },
      { titleKey: 'how_to_play.step2_title', bodyKey: 'how_to_play.step2_body', svg: this.svgTheme() },
      { titleKey: 'how_to_play.step3_title', bodyKey: 'how_to_play.step3_body', svg: this.svgBacktrack() },
      { titleKey: 'how_to_play.step4_title', bodyKey: 'how_to_play.step4_body', svg: this.svgDailyRitual() }
    ];

    this.element = document.createElement('div');
    this.element.className = 'view how-to-play-view';
    this.render();
  }

  private render(): void {
    this.element.innerHTML = '';
    const step = this.steps[this.current];
    const isLast = this.current === this.steps.length - 1;

    const topBar = document.createElement('div');
    topBar.className = 'how-to-play-topbar';

    const navAction = document.createElement('button');
    navAction.type = 'button';
    navAction.className = 'how-to-play-skip';
    if (this.payload.fromOnboarding) {
      navAction.textContent = t('how_to_play.close');
      navAction.addEventListener('click', () => {
        void this.complete();
      });
    } else {
      navAction.textContent = t('settings.back');
      navAction.addEventListener('click', this.onFinish);
    }
    topBar.append(navAction);

    const visual = document.createElement('div');
    visual.className = 'how-to-play-visual';
    visual.innerHTML = step.svg;

    const indicator = document.createElement('div');
    indicator.className = 'how-to-play-indicator';
    indicator.textContent = `${this.current + 1} / ${this.steps.length}`;

    const title = document.createElement('h2');
    title.className = 'how-to-play-title';
    title.textContent = t(step.titleKey);

    const body = document.createElement('p');
    body.className = 'how-to-play-body';
    body.textContent = t(step.bodyKey);

    const nav = document.createElement('div');
    nav.className = 'how-to-play-nav';

    if (this.current > 0) {
      const backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'how-to-play-nav-back';
      backBtn.textContent = t('how_to_play.back');
      backBtn.addEventListener('click', () => {
        this.current -= 1;
        this.render();
      });
      nav.append(backBtn);
    } else {
      const spacer = document.createElement('span');
      nav.append(spacer);
    }

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'action-button how-to-play-nav-next';
    nextBtn.textContent = isLast ? t('how_to_play.got_it') : t('how_to_play.next');
    nextBtn.addEventListener('click', () => {
      if (isLast) {
        void this.complete();
      } else {
        this.current += 1;
        this.render();
      }
    });
    nav.append(nextBtn);

    this.element.append(topBar, visual, indicator, title, body, nav);
  }

  private async complete(): Promise<void> {
    await Preferences.set({ key: TUTORIAL_KEY, value: 'true' });
    this.onFinish();
  }

  private svgFormWords(): string {
    return `<svg viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <rect x="18" y="18" width="164" height="164" rx="16" fill="color-mix(in srgb, var(--tile-bg) 78%, transparent)" stroke="var(--tile-border)" />
      <path d="M44 44 L84 44 L124 44 L164 44 L124 84" stroke="var(--title-glow)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
      <g fill="var(--tile-letter)">
        <rect x="32" y="32" width="24" height="24" rx="6" /><rect x="72" y="32" width="24" height="24" rx="6" /><rect x="112" y="32" width="24" height="24" rx="6" /><rect x="152" y="32" width="24" height="24" rx="6" />
        <rect x="112" y="72" width="24" height="24" rx="6" />
      </g>
      <g fill="var(--bg-edge)" font-size="14" font-family="Space Mono" font-weight="700">
        <text x="40" y="48">S</text><text x="80" y="48">O</text><text x="120" y="48">N</text><text x="160" y="48">I</text><text x="120" y="88">C</text>
      </g>
    </svg>`;
  }

  private svgTheme(): string {
    return `<svg viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <text x="100" y="26" text-anchor="middle" fill="var(--chrome-text)" font-size="10" font-family="Space Mono" letter-spacing="1.5">VIDEO GAME HEROES</text>
      <rect x="24" y="34" width="152" height="142" rx="14" fill="color-mix(in srgb, var(--tile-bg) 78%, transparent)" stroke="var(--tile-border)" />
      <path d="M44 56 L84 56 L124 56 L164 56" stroke="var(--title-glow)" stroke-width="5" stroke-linecap="round" />
      <path d="M44 96 L84 96 L124 136 L164 96" stroke="color-mix(in srgb, var(--title-glow) 70%, white)" stroke-width="4" stroke-linecap="round" />
      <path d="M44 136 L84 136 L124 136 L164 136" stroke="color-mix(in srgb, var(--title-glow) 55%, black)" stroke-width="4" stroke-linecap="round" />
    </svg>`;
  }

  private svgBacktrack(): string {
    return `<svg viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <rect x="28" y="28" width="144" height="144" rx="14" fill="color-mix(in srgb, var(--tile-bg) 78%, transparent)" stroke="var(--tile-border)" />
      <path d="M52 56 L92 56 L132 96" stroke="var(--title-glow)" stroke-width="6" stroke-linecap="round" />
      <circle cx="132" cy="96" r="18" fill="color-mix(in srgb, var(--bg-edge) 75%, transparent)" stroke="var(--tile-selected-border)" />
      <text x="132" y="102" text-anchor="middle" fill="var(--title-color)" font-size="16" font-family="Space Mono">⤺</text>
    </svg>`;
  }

  private svgDailyRitual(): string {
    return `<svg viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <rect x="24" y="56" width="152" height="88" rx="14" fill="color-mix(in srgb, var(--tile-bg) 78%, transparent)" stroke="var(--tile-border)" />
      <g fill="var(--tile-letter)">
        <rect x="36" y="72" width="16" height="16" rx="4" />
        <rect x="58" y="72" width="16" height="16" rx="4" />
        <rect x="80" y="72" width="16" height="16" rx="4" />
        <rect x="102" y="72" width="16" height="16" rx="4" />
        <rect x="124" y="72" width="16" height="16" rx="4" />
        <rect x="146" y="72" width="16" height="16" rx="4" />
      </g>
      <g fill="var(--hint-solved-letter)" font-size="12" font-family="Space Mono" font-weight="700">
        <text x="40" y="84">✓</text><text x="62" y="84">✓</text><text x="84" y="84">✓</text><text x="106" y="84">✓</text>
      </g>
      <text x="146" y="84" fill="var(--title-glow)" font-size="12">🔥</text>
      <text x="100" y="126" text-anchor="middle" fill="var(--chrome-text)" font-size="11" font-family="Space Mono" letter-spacing="1.2">DAILY STREAK</text>
    </svg>`;
  }
}
