import { InputManager, type PendingAction } from '../game/InputManager';
import { HapticService } from '../services/HapticService';
import { t } from '../i18n';
import { createIcon } from '../components/icons';
import { Tile } from '../game/Tile';
import { applySolvedPart, buildTileOwnership, type PartOwnershipEntry, type TileOwnershipState } from '../game/tileOwnership';
import { showConfirmModal } from '../components/Modal';
import { recordSolveForInterstitial } from '../services/AdService';
import { invalidateMenuCache } from '../services/MenuDataCache';
import { showHintStore } from '../components/HintStoreSheet';
import {
  ensureDailyGrant,
  consumeHint,
  getPuzzleReveals,
  addPuzzleReveal,
  clearPuzzleReveals
} from '../services/HintService';
import {
  beginFirstPlayAttempt,
  forfeitFirstPlay,
  getFirstSolveTimes,
  getSolvedIds,
  getSolvedRatings,
  isFirstPlayAvailable,
  recordPuzzleCompletion
} from '../services/ProgressService';
import type { Puzzle } from '../types/puzzle';
import { t as tp } from '../utils/i18n';

import { ACHIEVEMENTS } from '../data/achievements';
import { detectAndUnlockAchievements } from '../services/AchievementService';
import { getDayNumberSinceLaunch } from '../game/PuzzleLoader';
import { track } from '../services/AnalyticsService';
import type { RoutePayloads } from './Router';
import type { WinPayload } from './types';
import { formatDuration } from '../utils/format';
import { playCollapse, playFind, playGlitch, playSelect } from '../services/SoundService';
import { renderRibbon } from '../components/ribbon';
import { requestWordmarkSweep } from '../services/wordmarkSweep';

type PartEntry = {
  id: string;
  answerDisplay: string;
  word: string;
  path: string[];
};

export class GameView {
  private static readonly FINAL_ANIMATION_HOLD_MS = 800;
  private static readonly GLITCH_CORRUPT_MS = 320;
  private static readonly GLITCH_COLLAPSE_MS = 220;
  // Total time GameView is exiting before WinView mounts.
  private static readonly EXIT_FADE_MS = GameView.GLITCH_CORRUPT_MS + GameView.GLITCH_COLLAPSE_MS;
  private static readonly TILE_REVEAL_STAGGER_MS = 50;
  private static readonly TILE_REVEAL_DURATION_MS = 360;
  // Find fly-in (letters → answer slots).
  private static readonly LETTER_FLY_MS = 420;
  // Trigger tile's found-flash duration (index.css tile-found-flash-trigger).
  private static readonly TILE_TRIGGER_FLASH_MS = 480;
  private static readonly RIBBON_OUTRO_MS = 180;
  // Long-press duration to reveal a hint letter. The reveal is driven by this
  // JS timer (not by `animationend`) so it still works when reduced-motion
  // disables the CSS animations. Keep in sync with the visual-only durations
  // of `hint-reveal-rise` (1s) and `hint-charge-fill` (1000ms) in index.css.
  private static readonly HINT_HOLD_MS = 1000;
  private static readonly GLITCH_CHARS =
    'ÀÁÂÃÄÅÆĆČĐÈÉÊËĞĐÌÍÎÏÑÒÓÔÕÖØŒÙÚÛÜÝŠŽß#@%&*<>?!~∆ΩΣΨ█▓▒░╳';
  readonly element: HTMLDivElement;
  private readonly gridWrap: HTMLDivElement;
  private readonly overlay: SVGSVGElement;
  private readonly pathSegments: SVGGElement;
  private readonly tileElements = new Map<Tile, HTMLDivElement>();
  private readonly tileByCoord = new Map<string, Tile>();
  private readonly pendingVisualDeactivationCoords = new Set<string>();
  private readonly selectedTiles = new Set<Tile>();
  private readonly hintSlotsByPartId = new Map<string, HTMLSpanElement[]>();
  // Game content kept off the DOM so DevTools / DOM inspection can't spoil answers.
  // Maps each slot element to its part ID, letter index, and the actual letter.
  private readonly slotMeta = new Map<HTMLElement, { partId: string; letterIndex: number; letter: string }>();
  private readonly hintRowsByDisplay = new Map<string, HTMLDivElement>();
  private readonly partEntriesById = new Map<string, PartEntry>();
  private readonly partIdsByWord = new Map<string, string[]>();
  private readonly partIdsByAnswer = new Map<string, string[]>();
  private readonly fullAnswerWordToPartIds = new Map<string, string[]>();
  private readonly answerFullWords = new Map<string, string>();
  private readonly solvedPartIds = new Set<string>();
  private readonly solvedAnswerDisplays = new Set<string>();
  private readonly allTiles: Tile[];
  private readonly inputManager: InputManager<{ partIds: string[] }>;
  private readonly ownershipState: TileOwnershipState;
  private readonly onWin: (payload: WinPayload) => void;
  private readonly onMenu: () => void;
  private readonly dayNumber: number;
  private readonly puzzle: Puzzle;
  private readonly isTodaysDaily: boolean;
  private readonly isTutorial: boolean;
  private readonly isPreview: boolean;
  private readonly puzzleId: string;
  private readonly puzzleTitle: string;
  private readonly timerLabel: HTMLSpanElement;
  private timerStartedAt = 0; // 0 = not started (board not shown yet)
  private timerStoppedAt: number | null = null;
  private lastElapsedMs = 0;
  private timerInterval: number | null = null;
  private chainsStarted = 0;
  private wrongLetterAdds = 0;
  private wordsFound = 0;
  private hintsUsed: number = 0;
  private hintsRemaining: number = 0;
  private prevHintsRemaining: number = 0;
  private hintCounterEl!: HTMLElement;
  private hintCounterCount!: HTMLElement;
  private chargeBarWrapEl!: HTMLDivElement;
  private hintHoldTimer: number | null = null;
  private hintHoldSlot: HTMLElement | null = null;
  private outsidePointerDownHandler: ((event: PointerEvent) => void) | null = null;
  private pressedTileEl: HTMLElement | null = null;
  private layoutCache: {
    gridLeft: number;
    gridTop: number;
    centers: Map<Tile, { x: number; y: number }>;
    hitRadius: number;
  } | null = null;
  private readonly liveRegion: HTMLParagraphElement;
  // First-play tracking (docs/audit §6.2): true once this view has written the
  // attempt marker; leaving without solving then forfeits the first play.
  private attemptActive = false;
  private disposed = false;
  private readonly handleResize = (): void => {
    if (this.layoutCache) this.refreshLayoutCache(); // resized mid-gesture
    this.redrawPath(this.inputManager.getChain());
  };
  private previousChainLength = 0;
  private solved = false;

  constructor(
    payload: RoutePayloads['game'],
    callbacks: { onWin: (payload: WinPayload) => void; onMenu: () => void }
  ) {
    const { puzzle, dayNumber, isTodaysDaily, isTutorial, isPreview } = payload;

    this.onWin = callbacks.onWin;
    this.onMenu = callbacks.onMenu;
    this.dayNumber = dayNumber;
    this.puzzle = puzzle;
    this.isTodaysDaily = isTodaysDaily;
    this.isTutorial = isTutorial ?? false;
    this.isPreview = isPreview ?? false;
    this.puzzleId = puzzle.id;
    this.puzzleTitle = tp(puzzle.name, puzzle.id);
    // Coming back to the menu after a puzzle replays the wordmark sweep.
    requestWordmarkSweep();

    this.element = document.createElement('div');
    this.element.className = 'view game-view';

    // Screen-reader announcements — found words only (rewards-only design:
    // wrong attempts stay silent here too).
    this.liveRegion = document.createElement('p');
    this.liveRegion.className = 'sr-only';
    this.liveRegion.setAttribute('role', 'status');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.element.append(this.liveRegion);


    const header = document.createElement('div');
    header.className = 'header';

    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'header-menu-button';
    menuButton.textContent = t('game.back');
    menuButton.addEventListener('click', () => {
      void this.handleExit();
    });

    // Hint counter UI
    this.hintCounterEl = document.createElement('div');
    this.hintCounterEl.className = 'game-hint-counter';
    const hintIcon = document.createElement('span');
    hintIcon.className = 'game-hint-counter-icon';
    hintIcon.append(createIcon('bulb'));
    this.hintCounterCount = document.createElement('span');
    this.hintCounterCount.className = 'game-hint-counter-count';
    this.hintCounterCount.textContent = '5';
    this.hintCounterEl.append(hintIcon, this.hintCounterCount);

    // Tapping the counter always opens the Hint Store — whether empty (get more)
    // or not (top up proactively).
    this.hintCounterEl.addEventListener('click', () => {
      void showHintStore('loss_recovery', (granted) => {
        if (granted > 0) {
          this.hintsRemaining += granted;
          this.updateHintCounter();
        }
      });
    });

    // Puzzle number is intentionally NOT shown in the game chrome —
    // the player already saw "TODAY'S PUZZLE #N" on the menu card.
    // Header has two clusters now: ← MENU on the left, hint + timer
    // on the right (matches NYT Mini's clean two-cluster header).

    this.timerLabel = document.createElement('span');
    this.timerLabel.className = 'header-timer';
    this.timerLabel.textContent = '0:00';

    header.append(menuButton, this.hintCounterEl, this.timerLabel);

    const titleRow = document.createElement('div');
    titleRow.className = 'game-title-row';

    const title = document.createElement('h2');
    title.className = 'view-title';
    title.textContent = this.puzzleTitle;
    titleRow.append(title);

    const puzzleHintText = tp(puzzle.hint, '').trim();
    const puzzleHint = puzzleHintText
      ? Object.assign(document.createElement('p'), {
          className: 'game-puzzle-hint',
          textContent: puzzleHintText
        })
      : null;

    this.gridWrap = document.createElement('div');
    this.gridWrap.className = 'grid-wrap';

    const gridEl = document.createElement('div');
    gridEl.className = 'grid';
    gridEl.id = 'grid';

    this.allTiles = [];

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const coord = `${String.fromCharCode(97 + col)}${row + 1}`;
        const model = new Tile(row, col, puzzle.grid[coord] ?? '');
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.dataset.row = String(row);
        tile.dataset.col = String(col);
        tile.dataset.state = 'idle';
        const letterSpan = document.createElement('span');
        letterSpan.className = 'tile-letter';
        letterSpan.textContent = model.letter;
        tile.append(letterSpan);
        gridEl.appendChild(tile);

        this.allTiles.push(model);
        this.tileByCoord.set(model.coord, model);
        this.tileElements.set(model, tile);
      }
    }

    this.overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.overlay.setAttribute('class', 'path-overlay');
    this.overlay.setAttribute('id', 'path-overlay');
    this.overlay.setAttribute('viewBox', '0 0 100 100');
    this.overlay.setAttribute('preserveAspectRatio', 'none');

    // Per-segment ribbon container. redrawPath rebuilds its <line> children.
    this.pathSegments = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.pathSegments.setAttribute('class', 'path-segments');

    this.overlay.append(this.pathSegments);

    const chargeBarWrap = document.createElement('div');
    chargeBarWrap.className = 'hint-charge-bar-wrap';
    const chargeBarLabel = document.createElement('span');
    chargeBarLabel.className = 'hint-charge-label';
    chargeBarLabel.textContent = t('game.hint_charging');
    const chargeBarTrack = document.createElement('div');
    chargeBarTrack.className = 'hint-charge-bar-track';
    const chargeBarFill = document.createElement('div');
    chargeBarFill.className = 'hint-charge-bar-fill';
    chargeBarTrack.append(chargeBarFill);
    chargeBarWrap.append(chargeBarLabel, chargeBarTrack);
    this.chargeBarWrapEl = chargeBarWrap;

    this.gridWrap.append(gridEl, this.overlay, chargeBarWrap);

    const hints = document.createElement('div');
    hints.className = 'hints';

    const answers = [...puzzle.answers].sort((a, b) => a.display.localeCompare(b.display));
    // Many answers → more slot rows; CSS switches to compact slots so the
    // board still fits a phone screen without scrolling.
    if (answers.length >= 5) hints.dataset.dense = 'true';
    const ownershipEntries: PartOwnershipEntry[] = [];

    for (const answer of puzzle.answers) {
      const fullWord = answer.parts.map((part) => part.word).join('').toUpperCase();
      this.answerFullWords.set(answer.display, fullWord);
    }

    for (const answer of answers) {
      const row = document.createElement('div');
      row.className = 'hint-row';
      row.dataset.solved = 'false';

      this.hintRowsByDisplay.set(answer.display, row);

      const answerPartIds: string[] = [];

      answer.parts.forEach((part, index) => {
        const partId = `${answer.display}::${index}`;
        const partEntry: PartEntry = {
          id: partId,
          answerDisplay: answer.display,
          word: part.word,
          path: part.path
        };

        answerPartIds.push(partId);
        this.partEntriesById.set(partId, partEntry);
        ownershipEntries.push({ id: partId, path: part.path });

        const slotsForPart: HTMLSpanElement[] = [];

        if (index > 0) {
          const separator = document.createElement('span');
          separator.className = 'hint-word-separator';
          separator.textContent = '·';
          separator.setAttribute('aria-hidden', 'true');
          row.append(separator);
        }


        for (let i = 0; i < part.word.length; i++) {
          const slot = this.buildLetterSlot(partId, i, part.word[i]);
          row.appendChild(slot);
          slotsForPart.push(slot as HTMLSpanElement);
        }
        this.hintSlotsByPartId.set(partId, slotsForPart);
      });

      this.partIdsByAnswer.set(answer.display, answerPartIds);

      // For multi-part answers, only allow matching the full concatenated word
      if (answer.parts.length > 1) {
        const fullWord = answer.parts.map((p) => p.word).join('').toUpperCase();
        this.fullAnswerWordToPartIds.set(fullWord, answerPartIds);
      } else {
        // Single-part answers can be matched individually
        const partWord = answer.parts[0].word.toUpperCase();
        if (!this.partIdsByWord.has(partWord)) {
          this.partIdsByWord.set(partWord, []);
        }
        this.partIdsByWord.get(partWord)!.push(answerPartIds[0]);
      }

      hints.appendChild(row);
    }

    this.ownershipState = buildTileOwnership(ownershipEntries);

    const validWordLengths = new Set<number>();
    // Single-part answers
    for (const ids of this.partIdsByWord.values()) {
      for (const id of ids) {
        const partEntry = this.partEntriesById.get(id);
        if (partEntry) validWordLengths.add(partEntry.word.length);
      }
    }
    // Multi-part answers (full concatenated word)
    for (const ids of this.fullAnswerWordToPartIds.values()) {
      let totalLength = 0;
      for (const id of ids) {
        const partEntry = this.partEntriesById.get(id);
        if (partEntry) totalLength += partEntry.word.length;
      }
      validWordLengths.add(totalLength);
    }

    this.inputManager = new InputManager<{ partIds: string[] }>({
      tiles: this.allTiles,
      hitRadius: () => this.computeHitRadius(),
      getTileCenter: (tile) => this.getTileCenter(tile),
      validWordLengths,
      findMatch: (word) => this.findPartMatch(word),
      events: {
        onChainChanged: (chain) => this.onChainChanged(chain),
        onPendingActionChanged: (pending) => this.updatePressedTile(pending),
        onInvalidWord: () => {
          // Intentionally silent. Wrong-letter additions are tracked by the
          // path-prefix check in onChainChanged and surface at win time via the
          // mistake counter. No grid shake, no warning haptic, no toast — mid-swipe
          // stops are exploration, not error states.
        },
        onWordFound: (match) => {
          HapticService.impactMedium();
          this.onWordFound(match.partIds);
        }
      }
    });

    this.bindPointerEvents();
    // Outside-grid deselection: any pointerdown not on the grid clears the active
    // chain. Attached to `document` (capture phase) instead of `this.element` so it
    // catches taps anywhere on the page — including header buttons, modals that
    // haven't opened yet, and the area around the app shell. Capture phase runs
    // before any descendant handler can stop propagation.
    //
    // Self-cleaning: when the GameView is replaced and this.element is detached,
    // the next pointerdown removes the listener.
    const handleOutsidePointerDown = (event: PointerEvent): void => {
      if (!this.element.isConnected) {
        document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
        return;
      }
      if (this.solved) return;
      if (this.gridWrap.contains(event.target as Node)) return;
      // Interactive game controls, modals, and bottom sheets must not clear the active chain.
      if ((event.target as Element).closest?.('.hints, .game-hint-counter, .header-menu-button, .modal-backdrop, .modal, .sheet-backdrop, .skin-detail-backdrop')) return;
      if (this.inputManager.getChain().length === 0) return;
      this.inputManager.clearChain();
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown, true);
    this.outsidePointerDownHandler = handleOutsidePointerDown;

    // Hints: ensure daily grant, restore reveals, update counter
    void (async () => {
      const state = await ensureDailyGrant();
      this.hintsRemaining = state.hintsRemaining;
      // Sync prev before the first render so the grant animation doesn't
      // fire on load (it only fires when the count increases mid-session).
      this.prevHintsRemaining = state.hintsRemaining;
      this.updateHintCounter();
      await this.restoreHintReveals();
    })();

    // Timer starts in onShown() (called by the Router once the board is visible).

    window.addEventListener('resize', this.handleResize);

    const tutorialLabel = document.createElement('p');
    tutorialLabel.className = 'game-instructions';
    tutorialLabel.textContent = t('game.instructions');

    const rootEl = this.element;
    void (async () => {
      const solvedIds = await getSolvedIds();
      if (!rootEl.isConnected) return;
      if (solvedIds.length > 0) tutorialLabel.hidden = true;
    })();

    this.element.append(header, titleRow, ...(puzzleHint ? [puzzleHint] : []), this.gridWrap, hints, tutorialLabel);

    track('puzzle_started', {
      puzzle_id: this.puzzleId,
      day_number: this.dayNumber,
      is_archive: !this.isTodaysDaily,
      is_tutorial: this.isTutorial,
      is_replay: false
    });
  }

  private buildLetterSlot(partId: string, letterIndex: number, letter: string): HTMLElement {
    const slot = document.createElement('span');
    slot.className = 'hint-slot';
    slot.dataset.revealed = 'false';
    slot.dataset.filled = 'false';
    // Game content (partId, letterIndex, letter) is deliberately kept off the
    // DOM. Storing it in data-* attributes would hand the full solution to
    // anyone with DevTools open. Look up via this.slotMeta instead.
    this.slotMeta.set(slot, { partId, letterIndex, letter });
    const letterSpan = document.createElement('span');
    letterSpan.className = 'hint-slot-letter';
    // textContent starts empty — letter is stamped in only when the slot is
    // filled or revealed (see revealSlot / restoreHintReveals / onWordFound).
    slot.append(letterSpan);

    slot.addEventListener('pointerdown', (e) => this.onHintSlotPointerDown(e, slot));
    slot.addEventListener('pointerup', () => this.onHintSlotPointerEnd(slot));
    slot.addEventListener('pointerleave', () => this.onHintSlotPointerEnd(slot));
    slot.addEventListener('pointercancel', () => this.onHintSlotPointerEnd(slot));
    slot.addEventListener('animationend', (e) => this.onHintSlotAnimationEnd(e, slot));

    return slot;
  }

  private async onHintSlotPointerDown(event: PointerEvent, slot: HTMLElement): Promise<void> {
    if (slot.dataset.revealed === 'true') return;
    if (this.solved) return;
    // Slots belonging to an already-found word are not hintable. Checks both
    // the DOM flag and the solved set, because the solve-fill is staggered
    // (60ms per slot) and `filled` lags behind `solvedPartIds`.
    if (slot.dataset.filled === 'true') return;
    const meta = this.slotMeta.get(slot);
    if (meta && this.solvedPartIds.has(meta.partId)) return;

    if (this.hintsRemaining <= 0) {
      event.preventDefault();
      // Error feedback: flash the tapped slot + shake the counter.
      slot.removeAttribute('data-error');
      void slot.offsetWidth; // forced reflow restarts the animation
      slot.dataset.error = 'true';
      window.setTimeout(() => slot.removeAttribute('data-error'), 400);

      this.hintCounterEl.removeAttribute('data-error-shake');
      void this.hintCounterEl.offsetWidth;
      this.hintCounterEl.dataset.errorShake = 'true';
      window.setTimeout(() => this.hintCounterEl.removeAttribute('data-error-shake'), 400);

      await showHintStore('loss_recovery', (granted) => {
        if (granted > 0) {
          this.hintsRemaining += granted;
          this.updateHintCounter();
        }
      });
      return;
    }

    event.preventDefault();
    slot.dataset.revealing = 'true';
    this.hintCounterEl.dataset.charging = 'true';
    this.chargeBarWrapEl.classList.add('is-charging');
    HapticService.impactLight();
    this.startHintHold(slot);
  }

  private onHintSlotPointerEnd(slot: HTMLElement): void {
    if (this.hintHoldSlot === slot) this.cancelHintHold();
    if (slot.dataset.revealed !== 'true') {
      delete slot.dataset.revealing;
    }
    delete this.hintCounterEl.dataset.charging;
    this.chargeBarWrapEl.classList.remove('is-charging');
  }

  private startHintHold(slot: HTMLElement): void {
    this.cancelHintHold();
    this.hintHoldSlot = slot;
    this.hintHoldTimer = window.setTimeout(() => {
      this.hintHoldTimer = null;
      this.hintHoldSlot = null;
      // Guards: view left mid-hold, puzzle finished, hold released, or
      // slot already revealed — any of these means no hint is spent.
      if (!slot.isConnected || this.solved) return;
      if (slot.dataset.revealing !== 'true' || slot.dataset.revealed === 'true') return;
      delete slot.dataset.revealing;
      void this.revealSlot(slot);
    }, GameView.HINT_HOLD_MS);
  }

  private cancelHintHold(): void {
    if (this.hintHoldTimer !== null) window.clearTimeout(this.hintHoldTimer);
    this.hintHoldTimer = null;
    this.hintHoldSlot = null;
  }

  private onHintSlotAnimationEnd(event: AnimationEvent, _slot: HTMLElement): void {
    // The reveal itself is owned by the hold timer (startHintHold). The
    // rise animation is purely visual, so its end is ignored here.
    if (event.animationName === 'hint-reveal-rise') return;
    delete this.hintCounterEl.dataset.charging;
    this.chargeBarWrapEl.classList.remove('is-charging');
  }

  private async revealSlot(slot: HTMLElement): Promise<void> {
    const meta = this.slotMeta.get(slot);
    if (!meta) return;
    const { partId, letterIndex, letter } = meta;

    // Stamp the letter into the DOM now that the slot is being revealed.
    const revealLetterEl = slot.querySelector<HTMLElement>('.hint-slot-letter');
    if (revealLetterEl && !revealLetterEl.textContent) {
      revealLetterEl.textContent = letter;
    }
    slot.dataset.revealed = 'true';
    slot.dataset.filled = 'true';
    delete this.hintCounterEl.dataset.charging;
    this.chargeBarWrapEl.classList.remove('is-charging');

    // Reveal pop animation on the slot.
    slot.removeAttribute('data-just-revealed');
    void slot.offsetWidth; // forced reflow restarts the animation
    slot.dataset.justRevealed = 'true';
    window.setTimeout(() => slot.removeAttribute('data-just-revealed'), 400);

    HapticService.impactMedium();
    this.hintsUsed += 1;

    const state = await consumeHint();
    this.hintsRemaining = state.hintsRemaining;
    this.updateHintCounter();

    track('hint_used', {
      puzzle_id: this.puzzleId,
      hints_used_this_puzzle: this.hintsUsed,
      hints_remaining: this.hintsRemaining
    });

    await addPuzzleReveal(this.puzzleId, { partId, letterIndex });
  }

  private updateHintCounter(): void {
    const prev = this.prevHintsRemaining;
    const curr = this.hintsRemaining;
    this.hintCounterCount.textContent = String(curr);
    if (curr <= 0) {
      this.hintCounterEl.dataset.state = 'empty';
    } else {
      delete this.hintCounterEl.dataset.state;
    }
    if (curr < prev) {
      // Decrement pop: number shrinks then overshoots back.
      this.hintCounterCount.classList.remove('hint-count-decrement--active');
      void this.hintCounterCount.offsetWidth; // forced reflow
      this.hintCounterCount.classList.add('hint-count-decrement--active');
      window.setTimeout(() => this.hintCounterCount.classList.remove('hint-count-decrement--active'), 350);
    } else if (curr > prev) {
      // Grant glow: counter pulses to signal hints were added.
      this.hintCounterEl.removeAttribute('data-hint-granted');
      void this.hintCounterEl.offsetWidth;
      this.hintCounterEl.dataset.hintGranted = 'true';
      window.setTimeout(() => this.hintCounterEl.removeAttribute('data-hint-granted'), 700);
    }
    this.prevHintsRemaining = curr;
  }

  private async restoreHintReveals(): Promise<void> {
    const solvedIds = await getSolvedIds();
    if (solvedIds.includes(this.puzzleId)) {
      try {
        await clearPuzzleReveals(this.puzzleId);
      } catch {
        // Ignore cleanup failures; this is a defensive path.
      }
      this.hintsUsed = 0;
      return;
    }

    const reveals = await getPuzzleReveals(this.puzzleId);
    this.hintsUsed = reveals.length;
    for (const reveal of reveals) {
      // Look up via the JS-side map — no DOM query on data-part-id, which was
      // removed to keep answer text off the DOM.
      const partSlots = this.hintSlotsByPartId.get(reveal.partId) ?? [];
      const slot = partSlots[reveal.letterIndex] ?? null;
      if (slot) {
        const meta = this.slotMeta.get(slot);
        // Stamp the letter in before marking as filled so the letter is present
        // in the DOM when the filled color rules take effect.
        const restoredLetterEl = slot.querySelector<HTMLElement>('.hint-slot-letter');
        if (restoredLetterEl && !restoredLetterEl.textContent && meta) {
          restoredLetterEl.textContent = meta.letter;
        }
        slot.dataset.revealed = 'true';
        slot.dataset.filled = 'true';
      }
    }
  }

  /**
   * Timer rules (see docs/audit §6.2):
   *  - starts when the board is shown (Router → onShown), not at construction;
   *  - never pauses — backgrounding, blur, overlays all count, so studying a
   *    screenshot elsewhere costs time;
   *  - wall-clock based, but can't run backwards if the device clock is set
   *    back mid-puzzle (clamped to the last value shown).
   */
  private startTimer(): void {
    if (this.timerStartedAt !== 0) return; // already running / ran
    this.timerStartedAt = Date.now();
    this.timerStoppedAt = null;
    this.lastElapsedMs = 0;
    this.tickTimer();
    // Display refresh only; the time itself comes from Date.now() deltas, so
    // throttled/suspended intervals (background) catch up automatically.
    this.timerInterval = window.setInterval(() => this.tickTimer(), 100);
  }

  private stopTimer(): void {
    if (this.timerInterval !== null) {
      window.clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    // Freeze the value so later reads (win payload, analytics) match.
    if (this.timerStartedAt !== 0 && this.timerStoppedAt === null) {
      this.timerStoppedAt = Date.now();
    }
  }

  private getElapsedMs(): number {
    if (this.timerStartedAt === 0) return 0; // board not shown yet
    const now = this.timerStoppedAt ?? Date.now();
    const raw = now - this.timerStartedAt;
    // Clock set back mid-puzzle → never shrink below what was already shown.
    this.lastElapsedMs = Math.max(this.lastElapsedMs, raw);
    return this.lastElapsedMs;
  }

  private getElapsedSeconds(): number {
    return Math.floor(this.getElapsedMs() / 1000);
  }

  private tickTimer(): void {
    this.timerLabel.textContent = formatDuration(this.getElapsedSeconds());
  }

  /** Router hook: the view is on screen (fade-in has started). */
  onShown(): void {
    if (this.solved) return;
    this.startTimer();
    if (!this.isTutorial && !this.isPreview) void this.beginAttempt();
  }

  /** The board is visible: if this can still be a first play, mark the attempt. */
  private async beginAttempt(): Promise<void> {
    if (!(await isFirstPlayAvailable(this.puzzleId))) return;
    await beginFirstPlayAttempt(this.puzzleId);
    this.attemptActive = true;
    // Left during the async gap above → forfeit now.
    if (this.disposed && !this.solved) {
      this.attemptActive = false;
      void forfeitFirstPlay(this.puzzleId);
    }
  }

  /**
   * Called by the Router whenever this view is replaced or popped (Leave,
   * win, browser Back, warm deep link). Releases everything that lives on
   * window/document or in timers. Idempotent.
   */
  dispose(): void {
    this.disposed = true;
    // Leaving without solving — menu, browser/hardware Back, restart, deep
    // link — forfeits the first play. (Closing the app is caught at the next
    // cold start via the attempt marker.)
    if (this.attemptActive && !this.solved) {
      this.attemptActive = false;
      void forfeitFirstPlay(this.puzzleId);
    }
    this.stopTimer();
    this.cancelHintHold();
    window.removeEventListener('resize', this.handleResize);
    if (this.outsidePointerDownHandler) {
      document.removeEventListener('pointerdown', this.outsidePointerDownHandler, true);
      this.outsidePointerDownHandler = null;
    }
  }

  /** Public so Router can invoke it from the Android hardware back button. */
  async exit(): Promise<void> {
    return this.handleExit();
  }

  private async handleExit(): Promise<void> {
    if (this.solved) {
      this.stopTimer();
      this.onMenu();
      return;
    }

    const hasProgress = this.solvedPartIds.size > 0 || this.chainsStarted > 0 || this.getElapsedSeconds() >= 5;
    if (!hasProgress) {
      this.stopTimer();
      this.onMenu();
      return;
    }

    const confirmed = await showConfirmModal({
      title: t('dialog.exit_title'),
      body: t('dialog.exit_body'),
      confirmLabel: t('dialog.exit_confirm'),
      cancelLabel: t('common.cancel'),
      destructive: true
    });

    if (!confirmed) return;

    const totalParts = this.partEntriesById.size;
    const solvedParts = this.solvedPartIds.size;
    track('puzzle_abandoned', {
      puzzle_id: this.puzzleId,
      day_number: this.dayNumber,
      elapsed_sec: this.getElapsedSeconds(),
      progress_pct: totalParts === 0 ? 0 : Math.round((solvedParts / totalParts) * 100),
      is_archive: !this.isTodaysDaily,
      hints_used: this.hintsUsed,
      mistakes: this.getMistakeCount()
    });

    this.stopTimer();
    this.onMenu();
  }

  private bindPointerEvents(): void {
    this.gridWrap.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary) return;
      this.gridWrap.setPointerCapture(event.pointerId);
      // Measure once per gesture; pointermove then reads the cache instead of
      // forcing layout for 16 tiles on every move.
      this.refreshLayoutCache();
      const { x, y } = this.toLocalPoint(event.clientX, event.clientY);
      this.inputManager.onPointerDown(0, x, y);
    });

    this.gridWrap.addEventListener('pointermove', (event) => {
      if (!event.isPrimary) return;
      const { x, y } = this.toLocalPoint(event.clientX, event.clientY);
      this.inputManager.onPointerMove(0, x, y, event.buttons !== 0);
    });

    this.gridWrap.addEventListener('pointerup', (event) => {
      if (!event.isPrimary) return;
      this.inputManager.onPointerUp(0);
      this.layoutCache = null;
      if (this.gridWrap.hasPointerCapture(event.pointerId)) {
        this.gridWrap.releasePointerCapture(event.pointerId);
      }
    });

    this.gridWrap.addEventListener('pointercancel', (event) => {
      if (!event.isPrimary) return;
      this.inputManager.onPointerCancel(0);
      this.layoutCache = null;
      if (this.gridWrap.hasPointerCapture(event.pointerId)) {
        this.gridWrap.releasePointerCapture(event.pointerId);
      }
    });
  }

  /** Screen readers: "Found MARIO. 2 of 3 words." (answers, not parts). */
  private announceFound(partIds: string[]): { found: number; total: number } {
    const word = partIds
      .map((id) => this.partEntriesById.get(id)?.word ?? '')
      .filter(Boolean)
      .join(' ');
    const solvedByAnswer = new Map<string, boolean>();
    for (const entry of this.partEntriesById.values()) {
      const soFar = solvedByAnswer.get(entry.answerDisplay) ?? true;
      solvedByAnswer.set(entry.answerDisplay, soFar && this.solvedPartIds.has(entry.id));
    }
    const total = solvedByAnswer.size;
    const found = [...solvedByAnswer.values()].filter(Boolean).length;
    this.liveRegion.textContent = t('game.sr_found', { word, found, total });
    return { found, total };
  }

  /**
   * Pressed ring for the ambiguous touches that still wait for the tap/swipe
   * threshold: pressing the chain's last tile (tap = remove it, swipe =
   * continue) or an earlier chain tile (tap = backtrack). Everything else is
   * applied instantly on pointerdown (InputManager).
   */
  private updatePressedTile(pending: PendingAction | null): void {
    this.pressedTileEl?.removeAttribute('data-pressed');
    this.pressedTileEl = null;
    if (!pending || !this.inputManager) return;
    const chain = this.inputManager.getChain();
    const tile =
      pending.type === 'remove_last' ? chain[chain.length - 1]
      : pending.type === 'backtrack' ? chain[pending.backtrackTo]
      : undefined;
    const el = tile ? this.tileElements.get(tile) : undefined;
    if (!el) return;
    el.dataset.pressed = 'true';
    this.pressedTileEl = el;
  }

  private onChainChanged(chain: Tile[]): void {
    const prevLen = this.previousChainLength;
    const newLen = chain.length;

    if (newLen > prevLen) playSelect(); // soft tick per added tile (no backtrack/clear)

    if (prevLen === 0 && newLen >= 1) {
      this.chainsStarted += 1;
      // impactLight matches subsequent-letter feedback and is reliable on Android.
      // selectionChanged() (CLOCK_TICK on Android) is often imperceptible or
      // disabled by the system, leaving the first tap feeling dead.
      HapticService.impactLight();
      if (!this.isChainOnLetterPrefix(chain)) this.wrongLetterAdds += 1;
    } else if (newLen > prevLen) {
      HapticService.impactLight();
      if (!this.isChainOnLetterPrefix(chain)) this.wrongLetterAdds += 1;
    } else if (newLen > 0 && newLen < prevLen) {
      HapticService.impactLight();
      // backtrack — no mistake
    }
    this.previousChainLength = newLen;

    this.selectedTiles.clear();
    for (const tile of chain) {
      this.selectedTiles.add(tile);
    }

    for (const tile of this.allTiles) {
      this.applyTileVisualState(tile);
    }

    this.redrawPath(chain);

    if (this.inputManager.getState() === 'SWIPING' && chain.length > 0) {
      const chainStr = chain.map((tile) => tile.letter).join('').toUpperCase();
      const match = this.findPartMatch(chainStr);
      // Found the moment the swipe spells it, even when a longer answer starts
      // with it (GWYN ends the swipe; GWYNDOLIN is a separate swipe, which
      // passes the solved GWYN without matching it).
      if (match) {
        HapticService.impactMedium();
        this.onWordFound(match.partIds);
      }
    }
  }

  private redrawPath(chain: Tile[]): void {
    const rect = this.gridWrap.getBoundingClientRect();
    this.overlay.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);

    // One gradient per segment so colour flows continuously along the swipe
    // (see components/ribbon.ts). Skin-driven colours; JS supplies geometry.
    renderRibbon(this.pathSegments, chain.map((tile) => this.getTileCenter(tile)));
  }

  /**
   * Grid geometry snapshot, valid only while a pointer is down (set on
   * pointerdown, cleared on up/cancel). Tiles don't move mid-gesture
   * (touch-action: none, no tile transforms), so one measurement per gesture
   * replaces ~33 layout reads per pointermove.
   */
  private refreshLayoutCache(): void {
    const gridRect = this.gridWrap.getBoundingClientRect();
    const centers = new Map<Tile, { x: number; y: number }>();
    for (const [tile, el] of this.tileElements) {
      const r = el.getBoundingClientRect();
      centers.set(tile, { x: r.left + r.width / 2 - gridRect.left, y: r.top + r.height / 2 - gridRect.top });
    }
    this.layoutCache = {
      gridLeft: gridRect.left,
      gridTop: gridRect.top,
      centers,
      hitRadius: Math.max(20, (this.gridWrap.clientWidth / 4) * 0.38)
    };
  }

  private getTileCenter(tile: Tile): { x: number; y: number } {
    const cached = this.layoutCache?.centers.get(tile);
    if (cached) return cached;
    const tileEl = this.tileElements.get(tile);
    if (!tileEl) return { x: 0, y: 0 };

    const rect = tileEl.getBoundingClientRect();
    const gridRect = this.gridWrap.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 - gridRect.left,
      y: rect.top + rect.height / 2 - gridRect.top
    };
  }

  private toLocalPoint(clientX: number, clientY: number): { x: number; y: number } {
    if (this.layoutCache) {
      return { x: clientX - this.layoutCache.gridLeft, y: clientY - this.layoutCache.gridTop };
    }
    const rect = this.gridWrap.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  private computeHitRadius(): number {
    if (this.layoutCache) return this.layoutCache.hitRadius;
    const cell = this.gridWrap.clientWidth / 4;
    return Math.max(20, cell * 0.38);
  }

  private findPartMatch(word: string): { partIds: string[] } | null {
    const upperWord = word.toUpperCase();

    // Check multi-part answers first (full word match required)
    const multiPartIds = this.fullAnswerWordToPartIds.get(upperWord);
    if (multiPartIds) {
      // All parts must be unsolved for this answer to be valid
      const allUnsolved = multiPartIds.every((id) => !this.solvedPartIds.has(id));
      if (allUnsolved) {
        return { partIds: multiPartIds };
      }
    }

    // Check single-part answers
    const singlePartIds = this.partIdsByWord.get(upperWord);
    if (singlePartIds) {
      for (const id of singlePartIds) {
        if (!this.solvedPartIds.has(id)) {
          return { partIds: [id] };
        }
      }
    }

    return null;
  }

  private isChainOnLetterPrefix(chain: Tile[]): boolean {
    if (chain.length === 0) return true;
    const chainStr = chain.map((tile) => tile.letter).join('').toUpperCase();
    for (const [display, fullWord] of this.answerFullWords) {
      if (this.solvedAnswerDisplays.has(display)) continue;
      if (fullWord.startsWith(chainStr)) return true;
    }
    return false;
  }

  private onWordFound(partIds: string[]): void {
    if (this.solved) return;

    // Check if any part is already solved
    if (partIds.some((id) => this.solvedPartIds.has(id))) {
      this.inputManager.clearChain();
      return;
    }

    // The player's actual chain at the moment of solve. We animate these tiles
    // rather than partEntry.path so the celebration follows what the player
    // swiped, not the canonical authoring path (which can differ when duplicate
    // letters enable alternate routes). Ownership and deactivation still use
    // canonical paths — tile letters and shared-tile claims are defined there.
    const playerChainCoords = this.inputManager.getChain().map((tile) => tile.coord);
    const deactivatedCoordsForSolve = new Set<string>();

    // Letters fly from the grid into their slots; each slot fills (and pops)
    // when its letter arrives. null → reduced motion / mismatch → old timing.
    const flight = this.launchLetterFlight(partIds, playerChainCoords);

    // Mark all parts as solved
    let anyDeactivated = false;
    for (const partId of partIds) {
      this.solvedPartIds.add(partId);
      const partEntry = this.partEntriesById.get(partId);
      if (!partEntry) continue;

      const deactivated = new Set(
        applySolvedPart(this.ownershipState, {
          id: partEntry.id,
          path: partEntry.path
        })
      );

      if (deactivated.size > 0) anyDeactivated = true;

      for (const coord of partEntry.path) {
        const tile = this.tileByCoord.get(coord);
        if (!tile) continue;

        if (deactivated.has(coord)) {
          tile.deactivated = true;
          this.pendingVisualDeactivationCoords.add(coord);
          deactivatedCoordsForSolve.add(coord);
        }
      }

      const slots = this.hintSlotsByPartId.get(partId) ?? [];
      slots.forEach((slot, index) => {
        if (slot.dataset.filled === 'true') return;
        window.setTimeout(() => {
          if (!this.element.isConnected) return;
          // Stamp the letter in the same frame we mark it filled so the CSS
          // color rule (.hint-slot[data-filled="true"] .hint-slot-letter) and
          // the text content are always in sync.
          const solvedLetterEl = slot.querySelector<HTMLElement>('.hint-slot-letter');
          const solvedMeta = this.slotMeta.get(slot);
          if (solvedLetterEl && !solvedLetterEl.textContent && solvedMeta) {
            solvedLetterEl.textContent = solvedMeta.letter;
          }
          slot.dataset.filled = 'true';
        }, flight?.get(slot) ?? index * 60);
      });
    }

    const progress = this.announceFound(partIds);
    playFind(progress.found, progress.total);

    // Single coherent flash wave across the player's swipe, in the order they swiped.
    // For multi-part answers (e.g. LARA CROFT) this replaces two overlapping per-part
    // staggers with one continuous N-tile stagger.
    if (playerChainCoords.length > 0) {
      this.triggerTileFoundAnimation(playerChainCoords);
    }

    if (deactivatedCoordsForSolve.size > 0) {
      const cleanupMs =
        playerChainCoords.length > 0
          ? GameView.TILE_REVEAL_DURATION_MS +
            (playerChainCoords.length - 1) * GameView.TILE_REVEAL_STAGGER_MS +
            50
          : 0;

      window.setTimeout(() => {
        for (const coord of deactivatedCoordsForSolve) {
          const tile = this.tileByCoord.get(coord);
          if (!tile) continue;
          this.pendingVisualDeactivationCoords.delete(coord);
          this.applyTileVisualState(tile);
        }
      }, cleanupMs);
    }

    // Get the answer display from first part
    const firstEntry = this.partEntriesById.get(partIds[0]);
    if (firstEntry) {
      const answerPartIds = this.partIdsByAnswer.get(firstEntry.answerDisplay) ?? [];
      const solved = answerPartIds.every((id) => this.solvedPartIds.has(id));
      if (solved) {
        this.wordsFound += 1;
        this.solvedAnswerDisplays.add(firstEntry.answerDisplay);
        const row = this.hintRowsByDisplay.get(firstEntry.answerDisplay);
        if (row) {
          row.dataset.solved = 'true';
          this.triggerCascade(row, flight);
        }
      }
    }

  }

  private triggerCascade(row: HTMLDivElement, flight: Map<HTMLElement, number> | null = null): void {
    const slots = row.querySelectorAll<HTMLElement>('.hint-slot');
    let lastDelay = 0;
    slots.forEach((slot, index) => {
      // With the fly-in, each slot pops when its letter lands.
      const delay = flight?.get(slot) ?? index * 60;
      lastDelay = Math.max(lastDelay, delay);
      slot.style.setProperty('--cascade-delay', `${delay}ms`);
    });
    row.dataset.justSolved = 'true';

    // Total animation time = last slot's delay + 220ms pop duration
    const totalMs = lastDelay + 220 + 40;
    window.setTimeout(() => {
      if (!row.isConnected) return;
      row.removeAttribute('data-just-solved');
      slots.forEach((slot) => slot.style.removeProperty('--cascade-delay'));
    }, totalMs);

    for (const tile of this.allTiles) {
      this.applyTileVisualState(tile);
    }

    this.animateRibbonOutro();
    this.inputManager.clearChain();

    const solvedAllParts = this.solvedPartIds.size === this.partEntriesById.size;
    if (solvedAllParts) {
      this.onPuzzleSolved();
    }
  }

  private animateRibbonOutro(): void {
    if (!this.pathSegments.firstChild) return;

    const svgNs = 'http://www.w3.org/2000/svg';
    const outroGroup = document.createElementNS(svgNs, 'g');
    outroGroup.setAttribute('class', 'path-segments path-segments-outro');

    for (const child of this.pathSegments.childNodes) {
      outroGroup.appendChild(child.cloneNode(true));
    }

    this.overlay.appendChild(outroGroup);

    window.setTimeout(() => {
      if (outroGroup.isConnected) {
        outroGroup.remove();
      }
    }, GameView.RIBBON_OUTRO_MS + 20);
  }

  /**
   * Find fly-in: a clone of each found tile's letter flies (slight arc,
   * shrinking to slot size) into its answer slot, staggered like the flash
   * wave. Clones are fixed-position overlays — the grid itself is untouched
   * (no transforms on .tile). Returns each slot's arrival time (ms) so the
   * caller fills / pops slots on arrival, or null to keep the old timing
   * (reduced motion, or chain/slot count mismatch).
   */
  private launchLetterFlight(partIds: string[], chainCoords: string[]): Map<HTMLElement, number> | null {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null;
    const slots = partIds.flatMap((id) => this.hintSlotsByPartId.get(id) ?? []);
    if (slots.length === 0 || slots.length !== chainCoords.length) return null;

    const FLY_MS = GameView.LETTER_FLY_MS;
    const arrivals = new Map<HTMLElement, number>();
    // Depart in word order (first → last). Letters 1…n-1 leave at their tile's
    // found-flash peak (50ms ripple, peak at 40% of 360ms). The last tile is
    // the trigger and flashes first (t=0), so its letter can't match its own
    // flash and still go last — it simply follows one ripple step later.
    const lastIndex = chainCoords.length - 1;

    // Colour: letters leave in the tile's colour and land in the colour the
    // slot will show (solved-word ink if this find completes the answer, the
    // revealed-letter ink otherwise). A thin outline keeps them legible over
    // any tile/background, easing from the selected-letter outline to the
    // destination slot's fill so the letter "brings" its slot colour along.
    const rootStyle = getComputedStyle(document.documentElement);
    const cssColor = (name: string, fallback: string): string => {
      const v = rootStyle.getPropertyValue(name).trim();
      return v && CSS.supports('color', v) ? v : fallback;
    };
    const firstEntry = this.partEntriesById.get(partIds[0]);
    const answerParts = firstEntry ? this.partIdsByAnswer.get(firstEntry.answerDisplay) ?? [] : [];
    const completes = answerParts.every((id) => this.solvedPartIds.has(id) || partIds.includes(id));
    const endColor = completes ? cssColor('--hint-solved-letter', '#fff') : cssColor('--tile-letter', '#fff');
    const startOutline = cssColor('--selected-letter-outline', 'rgba(0, 0, 0, 0.6)');
    const endOutline = completes
      ? cssColor('--hint-solved-bg', cssColor('--hint-solved-border', startOutline))
      : cssColor('--hint-empty-border', startOutline);
    const outline = (c: string): string =>
      `1.5px 0 0 ${c}, -1.5px 0 0 ${c}, 0 1.5px 0 ${c}, 0 -1.5px 0 ${c}`;

    const departAt = (i: number): number =>
      i * GameView.TILE_REVEAL_STAGGER_MS + 0.4 * GameView.TILE_REVEAL_DURATION_MS;

    chainCoords.forEach((coord, i) => {
      const slot = slots[i];
      if (slot.dataset.filled === 'true') return; // already revealed by a hint
      const tile = this.tileByCoord.get(coord);
      const letterEl = tile ? this.tileElements.get(tile)?.querySelector<HTMLElement>('.tile-letter') : null;
      const slotLetterEl = slot.querySelector<HTMLElement>('.hint-slot-letter');
      if (!tile || !letterEl || !slotLetterEl) return;

      const from = letterEl.getBoundingClientRect();
      const to = slot.getBoundingClientRect();
      const fromSize = parseFloat(getComputedStyle(letterEl).fontSize) || 24;
      const startColor = getComputedStyle(letterEl).color;
      const toSize = parseFloat(getComputedStyle(slotLetterEl).fontSize) || fromSize * 0.5;

      const fly = document.createElement('span');
      fly.className = 'fly-letter';
      fly.setAttribute('aria-hidden', 'true');
      fly.textContent = tile.letter;
      fly.style.fontSize = `${fromSize}px`;
      document.body.append(fly);

      const x0 = from.left + from.width / 2;
      const y0 = from.top + from.height / 2;
      const x1 = to.left + to.width / 2;
      const y1 = to.top + to.height / 2;
      const scale = toSize / fromSize;
      const delay = departAt(i);
      const startScale = i === lastIndex ? 1 : 1.22; // the tile letter's pop size at its flash peak (trigger's pop is over)
      const at = (x: number, y: number, k: number): string =>
        `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${k})`;
      const anim = fly.animate(
        [
          { transform: at(x0, y0, startScale), opacity: 1, color: startColor, textShadow: outline(startOutline) },
          { transform: at((x0 + x1) / 2, Math.min(y0, y1) - 24, (startScale + scale) / 2 + 0.1), opacity: 1, offset: 0.45 },
          { transform: at(x1, y1, scale), opacity: 1, color: endColor, textShadow: outline(endOutline) }
        ],
        { duration: FLY_MS, delay, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'both' }
      );
      anim.onfinish = () => fly.remove();
      anim.oncancel = () => fly.remove();
      arrivals.set(slot, delay + FLY_MS);
    });

    return arrivals.size > 0 ? arrivals : null;
  }

  private triggerTileFoundAnimation(path: string[]): void {
    const STAGGER_MS = GameView.TILE_REVEAL_STAGGER_MS;
    const ANIMATION_DURATION_MS = GameView.TILE_REVEAL_DURATION_MS;
    const TRIGGER_ANIMATION_DURATION_MS = GameView.TILE_TRIGGER_FLASH_MS;
    const triggerIndex = path.length - 1;

    path.forEach((coord, index) => {
      const tile = this.tileByCoord.get(coord);
      if (!tile) return;
      const tileEl = this.tileElements.get(tile);
      if (!tileEl) return;
      const isTrigger = index === triggerIndex;
      // Trigger tile fires at t=0 with its own larger animation. Every other tile
      // runs the standard forward wave from t=0 at 50ms stagger. First and last
      // tiles thus both start at t=0; the wave fills in the middle.
      tileEl.style.setProperty('--reveal-delay', isTrigger ? '0ms' : `${index * STAGGER_MS}ms`);
      tileEl.dataset.revealing = 'true';
      if (isTrigger) tileEl.dataset.revealingTrigger = 'true';
    });

    // Cleanup waits for whichever finishes later: the trigger animation, or the
    // last non-trigger tile's wave step (at index path.length - 2 when path.length >= 2).
    const waveDuration =
      path.length >= 2 ? ANIMATION_DURATION_MS + (path.length - 2) * STAGGER_MS : 0;
    const cleanupMs = Math.max(waveDuration, TRIGGER_ANIMATION_DURATION_MS) + 50;

    window.setTimeout(() => {
      for (const coord of path) {
        const tile = this.tileByCoord.get(coord);
        if (!tile) continue;
        const tileEl = this.tileElements.get(tile);
        if (!tileEl) continue;
        tileEl.removeAttribute('data-revealing');
        tileEl.removeAttribute('data-revealing-trigger');
        tileEl.style.removeProperty('--reveal-delay');
        this.pendingVisualDeactivationCoords.delete(coord);
        this.applyTileVisualState(tile);
      }
    }, cleanupMs);
  }

  private async runGlitchOut(): Promise<void> {
    if (!this.element.isConnected) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      // No glitch, no CRT — just instant exit. The default view-entering opacity
      // transition handles WinView's appearance.
      this.element.style.opacity = '0';
      await new Promise<void>((resolve) => window.setTimeout(resolve, 60));
      return;
    }

    // Snapshot original textContent for every letter element we'll scramble, so
    // we can guarantee restoration even if the scramble loop is interrupted.
    const letterEls: HTMLElement[] = [];
    const originalText = new WeakMap<HTMLElement, string>();

    for (const tileEl of this.tileElements.values()) {
      const letterEl = tileEl.querySelector<HTMLElement>('.tile-letter');
      if (!letterEl) continue;
      letterEls.push(letterEl);
      originalText.set(letterEl, letterEl.textContent ?? '');
    }
    const slotLetterEls = this.element.querySelectorAll<HTMLElement>(
      '.hint-slot[data-filled="true"] .hint-slot-letter, .hint-slot[data-revealed="true"] .hint-slot-letter'
    );
    for (const letterEl of slotLetterEls) {
      letterEls.push(letterEl);
      originalText.set(letterEl, letterEl.textContent ?? '');
    }

    // Append the scanline overlay first — it spans the entire transition window.
    const scanlines = document.createElement('div');
    scanlines.className = 'endgame-scanlines';
    scanlines.setAttribute('aria-hidden', 'true');
    document.body.append(scanlines);

    // Phase 1: corrupt. Tick the scramble every 40ms; 70% of ticks swap to a
    // glitch glyph, 30% restore so the original letters strobe through.
    this.element.dataset.endgamePhase = 'corrupt';
    playGlitch(GameView.GLITCH_CORRUPT_MS);
    const corruptUntil = performance.now() + GameView.GLITCH_CORRUPT_MS;
    const tickScramble = (): void => {
      if (performance.now() >= corruptUntil) return;
      for (const el of letterEls) {
        if (Math.random() < 0.7) {
          const ch = GameView.GLITCH_CHARS[Math.floor(Math.random() * GameView.GLITCH_CHARS.length)];
          el.textContent = ch;
        } else {
          el.textContent = originalText.get(el) ?? '';
        }
      }
      window.setTimeout(tickScramble, 40);
    };
    tickScramble();

    await new Promise<void>((resolve) => window.setTimeout(resolve, GameView.GLITCH_CORRUPT_MS));
    // Force-restore in case the last tick wrote glitch glyphs.
    for (const el of letterEls) {
      el.textContent = originalText.get(el) ?? '';
    }

    if (!this.element.isConnected) {
      delete this.element.dataset.endgamePhase;
      scanlines.remove();
      return;
    }

    // Phase 2 + 3: CRT collapse + horizontal line of light.
    this.element.dataset.endgamePhase = 'collapse';
    playCollapse(GameView.GLITCH_COLLAPSE_MS);
    const crtLine = document.createElement('div');
    crtLine.className = 'endgame-crt-line';
    crtLine.setAttribute('aria-hidden', 'true');
    document.body.append(crtLine);

    await new Promise<void>((resolve) => window.setTimeout(resolve, GameView.GLITCH_COLLAPSE_MS));

    // Schedule cleanup of the overlay elements regardless of the WinView mount.
    // The CRT line keeps animating into the WinView boot crossover for ~240ms more.
    window.setTimeout(() => crtLine.remove(), 500);
    window.setTimeout(() => scanlines.remove(), 800);
  }

  private getMistakeCount(): number {
    const abandoned = Math.max(0, this.chainsStarted - this.wordsFound);
    return this.wrongLetterAdds + abandoned;
  }

  private getStarRating(): 1 | 2 | 3 {
    const cleanExecution = this.getMistakeCount() === 0;
    const noHints = this.hintsUsed === 0;
    const stars = 1 + (cleanExecution ? 1 : 0) + (noHints ? 1 : 0);
    return stars as 1 | 2 | 3;
  }

  private onPuzzleSolved(): void {
    if (this.solved) return;
    this.solved = true;
    this.stopTimer();

    const elapsedSeconds = this.getElapsedSeconds();
    this.timerLabel.textContent = formatDuration(elapsedSeconds);
    const starRating = this.getStarRating();
    const mistakes = this.getMistakeCount();
    const holdForAnimations = new Promise<void>((resolve) =>
      window.setTimeout(resolve, GameView.FINAL_ANIMATION_HOLD_MS)
    );

    const fadeOut = async (): Promise<void> => {
      if (!this.element.isConnected) return;
      await this.runGlitchOut();
    };

    // void haptic.pristineWin() or haptic.win() if available

    void (async () => {
      try {
        const previousRatings = await getSolvedRatings();
        const previousRating = previousRatings[this.puzzleId] ?? 0;
        // "New rating" means an *improvement* over a prior rating — not
        // the absence of one. Without the `previousRating > 0` gate,
        // every first-time solve would flag wasNewRating (since
        // starRating ≥ 1 always beats the 0 fallback), and the
        // NEW RATING pill would show on every initial play. Mirrors
        // the shape of the wasNewBest check below, which requires
        // previousBest !== null before declaring an improvement.
        const wasNewRating = previousRating > 0 && starRating > previousRating;

        // BEST / NEW BEST compare first plays only (replays are memory, not
        // skill — docs/audit §6.2). Read before this solve is recorded.
        const previousFirstTimes = await getFirstSolveTimes();
        const previousFirstValues = Object.values(previousFirstTimes).filter((v): v is number => Number.isFinite(v));
        const previousBest = previousFirstValues.length === 0 ? null : Math.min(...previousFirstValues);

        // Preview plays (editor "test in game" / tester links) must not touch
        // any saved state. recordPuzzleCompletion already no-ops + returns the
        // current snapshot when isTutorial is set, so we reuse that bypass for
        // previews too; the side effects below are then skipped explicitly.
        const skipPersistence = this.isTutorial || this.isPreview;

        const snapshot = await recordPuzzleCompletion(this.puzzleId, elapsedSeconds, {
          isTodaysDaily: this.isTodaysDaily,
          starRating,
          isTutorial: skipPersistence
        });
        const wasNewBest = snapshot.wasFirstPlay && previousBest !== null && elapsedSeconds < previousBest;

        if (!this.isPreview) {
          // Invalidate the menu data cache so the next menu visit reflects the
          // new solved state immediately rather than showing stale stats.
          invalidateMenuCache();

          await clearPuzzleReveals(this.puzzleId);
        }

        let unlockedAchievements: string[] = [];
        if (!skipPersistence) {
          unlockedAchievements = await detectAndUnlockAchievements({
            currentStreak: snapshot.currentStreak,
            solvedCount: snapshot.solvedCount,
            pristineCount: snapshot.pristineCount,
            consecutivePristineCount: snapshot.consecutivePristineCount,
            archiveSolvesCount: snapshot.archiveSolvesCount,
            bestTimeSec: snapshot.bestTimeSec,
            elapsedSeconds,
            isFirstPlay: snapshot.wasFirstPlay,
            starRating,
            isTodaysDaily: this.isTodaysDaily,
            wasNewRating,
            hourLocal: new Date().getHours(),
            dayNumberSolved: this.dayNumber,
            currentDayNumber: getDayNumberSinceLaunch()
          });
        }

        track('puzzle_solved', {
          puzzle_id: this.puzzleId,
          day_number: this.dayNumber,
          elapsed_sec: elapsedSeconds,
          star_rating: starRating,
          hints_used: this.hintsUsed,
          mistakes,
          is_archive: !this.isTodaysDaily,
          is_tutorial: this.isTutorial,
          is_preview: this.isPreview,
          was_new_best: wasNewBest,
          is_first_play: snapshot.wasFirstPlay,
          was_new_rating: wasNewRating
        });

        // Record this solve toward the interstitial cadence counter (skipped
        // for previews — a test play shouldn't push the player toward an ad).
        // The ad itself fires on the WinView→next-view transition (Router).
        if (!this.isPreview) {
          await recordSolveForInterstitial();
        }
        await holdForAnimations;
        await fadeOut();

        this.onWin({
          puzzleId: this.puzzleId,
          puzzleTitle: this.puzzleTitle,
          elapsedSeconds,
          solvedCount: snapshot.solvedCount,
          currentStreak: snapshot.currentStreak,
          dayNumber: this.dayNumber,
          hintsUsed: this.hintsUsed,
          mistakes,
          isTodaysDaily: this.isTodaysDaily,
          starRating,
          wasNewBest,
          wasNewRating,
          unlockedAchievements,
          freezeUsed: snapshot.freezeUsed,
          answers: this.puzzle.answers.map((a) => a.display)
        });
      } catch (err) {
        console.warn('[GameView] onPuzzleSolved failed', err);
        try {
          await clearPuzzleReveals(this.puzzleId);
        } catch {
          // Ignore cleanup failures in fallback path.
        }

        await holdForAnimations;
        await fadeOut();

        this.onWin({
          puzzleId: this.puzzleId,
          puzzleTitle: this.puzzleTitle,
          elapsedSeconds,
          solvedCount: 0,
          currentStreak: 0,
          dayNumber: this.dayNumber,
          hintsUsed: this.hintsUsed,
          mistakes: 0,
          isTodaysDaily: this.isTodaysDaily,
          starRating: this.getStarRating(),
          wasNewBest: false,
          wasNewRating: false,
          unlockedAchievements: [],
          freezeUsed: false,
          answers: this.puzzle.answers.map((a) => a.display)
        });
      }
    })();
  }

  private applyTileVisualState(tile: Tile): void {
    const el = this.tileElements.get(tile);
    if (!el) return;

    if (tile.deactivated && this.pendingVisualDeactivationCoords.has(tile.coord)) {
      el.dataset.state = 'idle';
      return;
    }

    if (tile.deactivated) {
      el.dataset.state = 'deactivated';
      return;
    }

    if (this.selectedTiles.has(tile)) {
      el.dataset.state = 'selected';
      return;
    }

    el.dataset.state = 'idle';
  }

}
