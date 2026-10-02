import { Preferences } from '@capacitor/preferences';
import { getLang, t, type StringKey } from '../i18n';
import { createIcon } from '../components/icons';
import { renderRibbon } from '../components/ribbon';
import { track } from '../services/AnalyticsService';

const TUTORIAL_KEY = 'tutorial_seen';

type Step = {
  titleKey: StringKey;
  bodyKey: StringKey;
  demo: () => HTMLElement;
};

/**
 * Four-step onboarding tutorial. Shown automatically on first launch
 * (gated by the `tutorial_seen` preference) and on demand from the
 * menu footer's HOW TO PLAY link.
 *
 * Each step has a title, a body paragraph, and an illustration built from
 * the real game pieces, so it always looks like the player's current skin.
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
      { titleKey: 'how_to_play.step1_title', bodyKey: 'how_to_play.step1_body', demo: () => this.demoSwipe() },
      { titleKey: 'how_to_play.step2_title', bodyKey: 'how_to_play.step2_body', demo: () => this.demoTheme() },
      { titleKey: 'how_to_play.step3_title', bodyKey: 'how_to_play.step3_body', demo: () => this.demoHint() },
      { titleKey: 'how_to_play.step4_title', bodyKey: 'how_to_play.step4_body', demo: () => this.demoStreak() }
    ];

    this.element = document.createElement('div');
    this.element.className = 'view how-to-play-view';
    this.render();
  }

  private render(): void {
    this.stopDemo();
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
    visual.append(step.demo());

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

  // ── Illustrations ────────────────────────────────────────────────────────
  // Built from the REAL game pieces (.tile + ribbon, .hint-slot, the bulb
  // counter, the streak strip), so every skin's tiles, gradients, bevels and
  // trail show exactly as in play. Steps 1 and 3 loop a short demo
  // (static under reduced motion); timers stop when the step changes.

  private demoTimers: number[] = [];

  private later(fn: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      this.demoTimers = this.demoTimers.filter((x) => x !== id);
      if (this.element.isConnected) fn();
    }, ms);
    this.demoTimers.push(id);
  }

  private stopDemo(): void {
    this.demoTimers.forEach((id) => window.clearTimeout(id));
    this.demoTimers = [];
  }

  private reducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  /** Step 1: a 2×2 "LUDO" patch; a swipe traces L → U → D → O on a loop. */
  private demoSwipe(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'htp-demo htp-swipe';
    const board = document.createElement('div');
    board.className = 'htp-board';
    const tiles = ['L', 'U', 'D', 'O'].map((ch) => {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.state = 'idle';
      const letter = document.createElement('span');
      letter.className = 'tile-letter';
      letter.textContent = ch;
      tile.append(letter);
      board.append(tile);
      return tile;
    });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'htp-path');
    svg.setAttribute('viewBox', '0 0 128 128');
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'path-segments');
    svg.append(group);
    board.append(svg);
    wrap.append(board);

    // Tile centres in the 128×128 board (2 × 60px tiles, 8px gap).
    const centre = [{ x: 30, y: 30 }, { x: 98, y: 30 }, { x: 30, y: 98 }, { x: 98, y: 98 }];
    const order = [0, 1, 2, 3];
    const showUpTo = (k: number): void => {
      tiles.forEach((tile, i) => { tile.dataset.state = order.slice(0, k + 1).includes(i) ? 'selected' : 'idle'; });
      renderRibbon(group, order.slice(0, k + 1).map((i) => centre[i]));
    };
    if (this.reducedMotion()) {
      showUpTo(order.length - 1);
      return wrap;
    }
    const cycle = (): void => {
      tiles.forEach((tile) => { tile.dataset.state = 'idle'; });
      renderRibbon(group, []);
      order.forEach((_, k) => this.later(() => showUpTo(k), 500 + k * 380));
      this.later(cycle, 500 + order.length * 380 + 1400);
    };
    cycle();
    return wrap;
  }

  /** Step 2: a sample theme title above one found answer and one to find. */
  private demoTheme(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'htp-demo htp-theme';
    const title = document.createElement('div');
    title.className = 'view-title htp-theme-title';
    title.textContent = t('how_to_play.sample_theme');
    const rows = document.createElement('div');
    rows.className = 'hints htp-rows';
    rows.append(this.hintRow('KART', true), this.hintRow('DRIFT', false));
    wrap.append(title, rows);
    return wrap;
  }

  private hintRow(word: string, solved: boolean): HTMLElement {
    const row = document.createElement('div');
    row.className = 'hint-row';
    row.dataset.solved = String(solved);
    for (const ch of word) row.append(this.hintSlot(solved ? ch : '', solved));
    return row;
  }

  private hintSlot(ch: string, filled: boolean): HTMLElement {
    const slot = document.createElement('span');
    slot.className = 'hint-slot';
    slot.dataset.filled = String(filled);
    const letter = document.createElement('span');
    letter.className = 'hint-slot-letter';
    letter.textContent = ch;
    slot.append(letter);
    return slot;
  }

  /** Step 3: the bulb counter and a row of slots; one charges and fills. */
  private demoHint(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'htp-demo htp-hint';

    const counter = document.createElement('div');
    counter.className = 'game-hint-counter';
    const icon = document.createElement('span');
    icon.className = 'game-hint-counter-icon';
    icon.append(createIcon('bulb'));
    const count = document.createElement('span');
    count.className = 'game-hint-counter-count';
    count.textContent = '3';
    counter.append(icon, count);

    const row = document.createElement('div');
    row.className = 'hints htp-rows';
    const hintRow = document.createElement('div');
    hintRow.className = 'hint-row';
    hintRow.dataset.solved = 'false';
    const slots = [0, 1, 2, 3, 4].map(() => this.hintSlot('', false));
    slots.forEach((sl) => hintRow.append(sl));
    row.append(hintRow);

    const caption = document.createElement('div');
    caption.className = 'htp-caption';
    caption.textContent = t('game.hint_charging');

    wrap.append(counter, row, caption);

    const held = slots[2];
    const letter = held.querySelector<HTMLElement>('.hint-slot-letter')!;
    const reveal = (): void => {
      delete held.dataset.revealing;
      held.dataset.filled = 'true';
      letter.textContent = 'A';
      count.textContent = '2';
      caption.textContent = t('game.hint_revealed');
    };
    if (this.reducedMotion()) {
      reveal();
      return wrap;
    }
    const cycle = (): void => {
      held.dataset.filled = 'false';
      letter.textContent = '';
      count.textContent = '3';
      caption.textContent = t('game.hint_charging');
      this.later(() => {
        held.dataset.revealing = 'true';
        counter.dataset.charging = 'true';
      }, 700);
      this.later(() => {
        delete counter.dataset.charging;
        reveal();
        held.dataset.justRevealed = 'true';
        this.later(() => { delete held.dataset.justRevealed; }, 400);
      }, 1700);
      this.later(cycle, 3800);
    };
    cycle();
    return wrap;
  }

  /** Step 4: the menu's 7-day strip with a four-day run. */
  private demoStreak(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'htp-demo htp-streak';
    const flame = document.createElement('span');
    flame.className = 'htp-flame';
    flame.append(createIcon('flame'));
    const week = document.createElement('div');
    week.className = 'streak-week';
    const states = ['missed', 'missed', 'missed', 'solved', 'solved', 'solved', 'solved'];
    const weekday = new Intl.DateTimeFormat(getLang(), { weekday: 'narrow' });
    const today = new Date();
    states.forEach((state, i) => {
      const cell = document.createElement('span');
      cell.className = 'streak-day';
      cell.dataset.state = state;
      if (i === states.length - 1) cell.dataset.today = 'true';
      const box = document.createElement('span');
      box.className = 'streak-day-box';
      if (state === 'solved') box.append(createIcon('check'));
      const label = document.createElement('span');
      label.className = 'streak-day-label';
      const d = new Date(today);
      d.setDate(d.getDate() - (states.length - 1 - i));
      label.textContent = weekday.format(d);
      cell.append(box, label);
      week.append(cell);
    });
    const caption = document.createElement('div');
    caption.className = 'htp-caption';
    caption.textContent = t('how_to_play.streak_caption', { n: 4 });
    wrap.append(flame, week, caption);
    return wrap;
  }
}
