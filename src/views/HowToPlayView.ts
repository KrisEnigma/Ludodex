import { Preferences } from '@capacitor/preferences';
import { t, type StringKey } from '../i18n';
import { track } from '../services/AnalyticsService';

const TUTORIAL_KEY = 'tutorial_seen';

type Step = {
  titleKey: StringKey;
  bodyKey: StringKey;
  svg: string;
};

/**
 * Four-step onboarding tutorial. Shown automatically on first launch
 * (gated by the `tutorial_seen` preference) and on demand from the
 * menu footer's HOW TO PLAY link.
 *
 * Each step has a title, a body paragraph, and an illustrative SVG.
 * The SVGs are theme-aware — colors come from CSS variables
 * (--title-glow, --tile-bg, --tile-border, etc.) so the same illustration
 * shifts cyan / pink / lime as the player swaps skins.
 */
export class HowToPlayView {
  public readonly element: HTMLDivElement;
  private current = 0;
  private readonly steps: Step[];

  constructor(
    private readonly payload: { fromOnboarding: boolean },
    private readonly onFinish: () => void
  ) {
    this.steps = [
      { titleKey: 'how_to_play.step1_title', bodyKey: 'how_to_play.step1_body', svg: this.svgSwipeToSpell() },
      { titleKey: 'how_to_play.step2_title', bodyKey: 'how_to_play.step2_body', svg: this.svgTheme() },
      { titleKey: 'how_to_play.step3_title', bodyKey: 'how_to_play.step3_body', svg: this.svgHint() },
      { titleKey: 'how_to_play.step4_title', bodyKey: 'how_to_play.step4_body', svg: this.svgStreak() }
    ];

    this.element = document.createElement('div');
    this.element.className = 'view how-to-play-view';
    this.render();
  }

  private render(): void {
    this.element.innerHTML = '';
    const step = this.steps[this.current];
    const isLast = this.current === this.steps.length - 1;

    track('tutorial_step_viewed', {
      step: this.current + 1,
      from_onboarding: this.payload.fromOnboarding
    });

    // ── Top bar ──────────────────────────────────────────────────────────
    // From onboarding: a "Skip" affordance lets the player bail.
    // From menu: a "← Back" returns them to where they came from.
    const topBar = document.createElement('div');
    topBar.className = 'how-to-play-topbar';

    const navAction = document.createElement('button');
    navAction.type = 'button';
    navAction.className = 'how-to-play-skip';
    if (this.payload.fromOnboarding) {
      navAction.textContent = t('how_to_play.close');
      navAction.addEventListener('click', () => {
        track('tutorial_skipped', { at_step: this.current + 1 });
        void this.complete();
      });
    } else {
      navAction.textContent = t('settings.back');
      navAction.addEventListener('click', this.onFinish);
    }
    topBar.append(navAction);

    // ── Illustration ─────────────────────────────────────────────────────
    const visual = document.createElement('div');
    visual.className = 'how-to-play-visual';
    visual.innerHTML = step.svg;

    // ── Title + body ─────────────────────────────────────────────────────
    const title = document.createElement('h2');
    title.className = 'how-to-play-title';
    title.textContent = t(step.titleKey);

    const body = document.createElement('p');
    body.className = 'how-to-play-body';
    body.textContent = t(step.bodyKey);

    // ── Dot pagination ───────────────────────────────────────────────────
    // Replaces the old "1 / 4" text indicator. Standard pattern for
    // paginated onboarding — more visual, requires less reading.
    const indicator = document.createElement('div');
    indicator.className = 'how-to-play-indicator';
    indicator.setAttribute('role', 'tablist');
    indicator.setAttribute('aria-label', t('how_to_play.title'));
    for (let i = 0; i < this.steps.length; i += 1) {
      const dot = document.createElement('span');
      dot.className = 'how-to-play-dot';
      dot.dataset.active = String(i === this.current);
      dot.setAttribute('aria-current', i === this.current ? 'step' : 'false');
      indicator.append(dot);
    }

    // ── Nav row ──────────────────────────────────────────────────────────
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
      // Spacer keeps the "Next" button right-aligned even on step 1.
      const spacer = document.createElement('span');
      spacer.className = 'how-to-play-nav-spacer';
      nav.append(spacer);
    }

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'button-primary how-to-play-nav-next';
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

    this.element.append(topBar, visual, title, body, indicator, nav);
  }

  private async complete(): Promise<void> {
    track('tutorial_completed', {
      from_onboarding: this.payload.fromOnboarding,
      completed_at_step: this.current + 1
    });
    await Preferences.set({ key: TUTORIAL_KEY, value: 'true' });
    this.onFinish();
  }

  // ── SVG illustrations ──────────────────────────────────────────────────
  // All colors come from CSS variables so the illustrations re-skin with
  // the active theme. The shared `viewBox="0 0 200 160"` gives each step
  // a consistent footprint; the parent .how-to-play-visual sizes them.

  /**
   * Step 1: a 2×2 mini-grid with letters "L U D O" and a glowing path
   * traced through them. Showcases the signature swipe trail in the
   * skin's accent color — the most identity-establishing visual the
   * tutorial can lead with.
   */
  private svgSwipeToSpell(): string {
    const tileSize = 44;
    const gap = 10;
    const startX = 100 - tileSize - gap / 2;
    const startY = 80 - tileSize - gap / 2;
    const center = (col: number, row: number): [number, number] => [
      startX + col * (tileSize + gap) + tileSize / 2,
      startY + row * (tileSize + gap) + tileSize / 2
    ];
    const tiles: [number, number, string][] = [
      [0, 0, 'L'],
      [1, 0, 'U'],
      [0, 1, 'D'],
      [1, 1, 'O'],
    ];
    const pathPoints = [center(0, 0), center(1, 0), center(0, 1), center(1, 1)];
    const pathD = pathPoints
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`)
      .join(' ');

    return `<svg viewBox="0 0 200 160" fill="none" aria-hidden="true">
      <!-- Tiles -->
      ${tiles
        .map(([col, row, letter]) => {
          const x = startX + col * (tileSize + gap);
          const y = startY + row * (tileSize + gap);
          const cx = x + tileSize / 2;
          const cy = y + tileSize / 2;
          return `
            <rect x="${x}" y="${y}" width="${tileSize}" height="${tileSize}"
                  rx="8" fill="var(--tile-selected-bg)" stroke="var(--tile-selected-border)" stroke-width="1.5" />
            <text x="${cx}" y="${cy + 7}" text-anchor="middle"
                  fill="var(--tile-selected-letter)" font-size="20"
                  font-family="Space Mono, monospace" font-weight="700">${letter}</text>
          `;
        })
        .join('')}
      <!-- Swipe trail: halo + core mirrors the in-game .path-halo / .path-core treatment -->
      <path d="${pathD}" stroke="var(--path-color)" stroke-opacity="0.25"
            stroke-width="14" stroke-linecap="round" stroke-linejoin="round" />
      <path d="${pathD}" stroke="var(--path-color)" stroke-opacity="0.95"
            stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>`;
  }

  /**
   * Step 2: an abstract theme banner above two solid-filled word-slot
   * rows. Communicates the shape of "theme + answers" without spelling
   * out a specific theme or specific answers — the original version
   * showed a real puzzle's theme and characters, which spoiled it for
   * new players.
   */
  private svgTheme(): string {
    const block = (x: number, y: number): string => `
      <rect x="${x}" y="${y}" width="18" height="22" rx="4"
            fill="var(--hint-solved-bg)"
            stroke="var(--hint-solved-border)" />
    `;
    // Abstract row counts — solid blocks, no letters. The shape of an
    // answer row + a theme banner is enough to communicate the rule;
    // any specific text risks colliding with a real puzzle.
    const row1Count = 5;
    const row2Count = 4;
    const r1Width = row1Count * 18 + (row1Count - 1) * 2;
    const r2Width = row2Count * 18 + (row2Count - 1) * 2;
    const r1X = (200 - r1Width) / 2;
    const r2X = (200 - r2Width) / 2;

    return `<svg viewBox="0 0 200 160" fill="none" aria-hidden="true">
      <!-- Theme banner: pill shape suggesting a header above the answers -->
      <rect x="32" y="22" width="136" height="26" rx="13"
            fill="color-mix(in srgb, var(--title-glow) 14%, transparent)"
            stroke="color-mix(in srgb, var(--title-glow) 40%, transparent)" />
      <!-- Three abstract "title" dashes inside the banner -->
      <rect x="56" y="32" width="22" height="6" rx="2" fill="var(--title-glow)" opacity="0.85" />
      <rect x="86" y="32" width="34" height="6" rx="2" fill="var(--title-glow)" opacity="0.85" />
      <rect x="128" y="32" width="16" height="6" rx="2" fill="var(--title-glow)" opacity="0.85" />
      <!-- Two solid answer rows (no letters → no spoilers) -->
      ${Array.from({ length: row1Count }, (_, i) => block(r1X + i * 20, 70)).join('')}
      ${Array.from({ length: row2Count }, (_, i) => block(r2X + i * 20, 102)).join('')}
    </svg>`;
  }

  /**
   * Step 3: a row of empty hint slots (the squares that sit below the
   * grid showing each answer's letter pattern) with one slot being
   * press-and-held by a finger. That slot shows the charging halo +
   * a letter rising into it, matching the actual hint mechanic — the
   * player holds a slot to reveal a letter there, not the bulb in
   * the header.
   *
   * The bulb counter in the header is shown small and decorative,
   * making it clear it's an indicator, not a tap target.
   */
  private svgHint(): string {
    const slotW = 22;
    const slotH = 28;
    const gap = 4;
    const slotCount = 5;
    const rowWidth = slotCount * slotW + (slotCount - 1) * gap;
    const startX = (200 - rowWidth) / 2;
    const slotY = 64;
    const heldIndex = 2; // middle slot is the one being held

    const slots = Array.from({ length: slotCount }, (_, i) => {
      const x = startX + i * (slotW + gap);
      const isHeld = i === heldIndex;
      return `
        <rect x="${x}" y="${slotY}" width="${slotW}" height="${slotH}" rx="5"
              fill="${isHeld ? 'var(--hint-solved-bg)' : 'var(--hint-empty-bg)'}"
              stroke="${isHeld ? 'var(--hint-solved-border)' : 'var(--hint-empty-border)'}" />
        ${
          isHeld
            ? `<text x="${x + slotW / 2}" y="${slotY + slotH / 2 + 5}" text-anchor="middle"
                  fill="var(--hint-solved-letter)" font-size="14"
                  font-family="Space Mono, monospace" font-weight="700">A</text>`
            : ''
        }
      `;
    }).join('');

    const heldSlotX = startX + heldIndex * (slotW + gap);
    const heldCenterX = heldSlotX + slotW / 2;
    const heldCenterY = slotY + slotH / 2;

    return `<svg viewBox="0 0 200 160" fill="none" aria-hidden="true">
      <!-- Small bulb counter pill (decorative — shows the resource exists in the header) -->
      <g transform="translate(76 18)">
        <rect width="48" height="22" rx="11"
              fill="var(--button-bg)" stroke="var(--button-border)" />
        <g transform="translate(7 5) scale(0.55)" fill="var(--title-glow)">
          <path d="M10 0 C 5 0 1 4 1 9 C 1 12 3 14 4 16 L 4 19 L 16 19 L 16 16 C 17 14 19 12 19 9 C 19 4 15 0 10 0 Z M 7 21 L 13 21 L 13 23 L 7 23 Z" />
        </g>
        <text x="32" y="16" fill="var(--title-glow)"
              font-size="12" font-family="Space Mono, monospace" font-weight="700">3</text>
      </g>

      <!-- Charging halo behind the held slot — mirrors the in-game
           .hint-slot[data-revealing]::after radial gradient. -->
      <circle cx="${heldCenterX}" cy="${heldCenterY}" r="26"
              fill="var(--path-color)" opacity="0.18" />

      <!-- Slot row -->
      ${slots}

      <!-- Finger indicator: a circle pressing on the held slot. -->
      <circle cx="${heldCenterX + 10}" cy="${heldCenterY + 14}" r="11"
              fill="color-mix(in srgb, var(--title-color) 75%, transparent)"
              stroke="var(--title-color)" stroke-width="1.5" />
      <circle cx="${heldCenterX + 10}" cy="${heldCenterY + 14}" r="5"
              fill="var(--title-glow)" opacity="0.7" />

      <!-- "Hold" caption beneath -->
      <text x="100" y="134" text-anchor="middle" fill="var(--chrome-text)"
            font-size="10" font-family="Space Mono, monospace" letter-spacing="1.5"
            font-weight="700">HOLD TO REVEAL</text>
    </svg>`;
  }

  /**
   * Step 4: a row of seven calendar squares with the last four filled,
   * suggesting a four-day streak and the path forward. A flame icon
   * anchors the metaphor; uses the in-app flame glyph rather than the
   * older hand-drawn path so it stays consistent across the product.
   */
  private svgStreak(): string {
    const days = [false, false, false, true, true, true, true];
    const boxSize = 18;
    const gap = 4;
    const rowWidth = days.length * boxSize + (days.length - 1) * gap;
    const startX = (200 - rowWidth) / 2;

    return `<svg viewBox="0 0 200 160" fill="none" aria-hidden="true">
      <!-- Flame icon (matches src/components/icons/flame) -->
      <g transform="translate(86 22)" fill="var(--title-glow)">
        <path d="M14 0 C 12 4 9 7 9 11 C 9 14 11 16 11 18 C 8 18 5 16 5 12 C 2 16 0 21 0 26 C 0 33 6 38 14 38 C 22 38 28 33 28 26 C 28 18 22 14 22 8 C 22 4 18 0 14 0 Z" />
      </g>
      <!-- Day row: filled = solved, empty = upcoming -->
      ${days
        .map((filled, i) => {
          const x = startX + i * (boxSize + gap);
          return `
            <rect x="${x}" y="80" width="${boxSize}" height="${boxSize}" rx="4"
                  fill="${filled ? 'var(--hint-solved-bg)' : 'var(--hint-empty-bg)'}"
                  stroke="${filled ? 'var(--hint-solved-border)' : 'var(--hint-empty-border)'}" />
            ${
              filled
                ? `<text x="${x + boxSize / 2}" y="${
                    80 + boxSize / 2 + 4
                  }" text-anchor="middle" fill="var(--hint-solved-letter)" font-size="11" font-family="Space Mono, monospace" font-weight="700">✓</text>`
                : ''
            }
          `;
        })
        .join('')}
      <text x="100" y="124" text-anchor="middle" fill="var(--chrome-text)"
            font-size="11" font-family="Space Mono, monospace" letter-spacing="1.5"
            font-weight="700">4-DAY STREAK</text>
    </svg>`;
  }
}
