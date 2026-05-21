import { InputManager } from '../game/InputManager';
import { HapticService } from '../services/HapticService';
import { t } from '../i18n';
import { createIcon } from '../components/icons';
import { Tile } from '../game/Tile';
import { applySolvedPart, buildTileOwnership, type PartOwnershipEntry, type TileOwnershipState } from '../game/tileOwnership';
import { showConfirmModal, showInfoModal } from '../components/Modal';
import { maybeShowInterstitial } from '../services/AdService';
import {
  ensureDailyGrant,
  consumeHint,
  getPuzzleReveals,
  addPuzzleReveal,
  clearPuzzleReveals
} from '../services/HintService';
import {
  getSolvedIds,
  getSolvedRatings,
  getSolvedTimes,
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

type PartEntry = {
  id: string;
  answerDisplay: string;
  word: string;
  path: string[];
};

export class GameView {
  private static readonly FINAL_ANIMATION_HOLD_MS = 800;
  private static readonly EXIT_FADE_MS = 220;
  private static readonly TILE_REVEAL_STAGGER_MS = 50;
  private static readonly TILE_REVEAL_DURATION_MS = 360;
  readonly element: HTMLDivElement;
  private readonly gridWrap: HTMLDivElement;
  private readonly overlay: SVGSVGElement;
  private readonly haloPath: SVGPathElement;
  private readonly corePath: SVGPathElement;
  private readonly tileElements = new Map<Tile, HTMLDivElement>();
  private readonly tileByCoord = new Map<string, Tile>();
  private readonly pendingVisualDeactivationCoords = new Set<string>();
  private readonly selectedTiles = new Set<Tile>();
  private readonly hintSlotsByPartId = new Map<string, HTMLSpanElement[]>();
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
  private readonly puzzleId: string;
  private readonly puzzleTitle: string;
  private readonly timerLabel: HTMLSpanElement;
  private timerStartedAt = 0;
  private timerPausedAt: number | null = null;
  private timerTotalPausedMs = 0;
  private timerInterval: number | null = null;
  private chainsStarted = 0;
  private wrongLetterAdds = 0;
  private wordsFound = 0;
  private hintsUsed: number = 0;
  private hintsRemaining: number = 0;
  private hintCounterEl!: HTMLElement;
  private hintCounterCount!: HTMLElement;
  private previousChainLength = 0;
  private solved = false;

  constructor(
    payload: RoutePayloads['game'],
    callbacks: { onWin: (payload: WinPayload) => void; onMenu: () => void }
  ) {
    const { puzzle, dayNumber, isTodaysDaily, isTutorial } = payload;

    this.onWin = callbacks.onWin;
    this.onMenu = callbacks.onMenu;
    this.dayNumber = dayNumber;
    this.puzzle = puzzle;
    this.isTodaysDaily = isTodaysDaily;
    this.isTutorial = isTutorial ?? false;
    this.puzzleId = puzzle.id;
    this.puzzleTitle = tp(puzzle.name, puzzle.id);

    this.element = document.createElement('div');
    this.element.className = 'view game-view';


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
    this.hintCounterCount.textContent = '3';
    this.hintCounterEl.append(hintIcon, this.hintCounterCount);

    const levelLabel = document.createElement('span');
    levelLabel.className = 'header-level';
    levelLabel.textContent = t('game.day_label', { n: this.dayNumber });

    this.timerLabel = document.createElement('span');
    this.timerLabel.className = 'header-timer';
    this.timerLabel.textContent = '0:00';

    header.append(menuButton, levelLabel, this.hintCounterEl, this.timerLabel);

    const titleRow = document.createElement('div');
    titleRow.className = 'game-title-row';

    const title = document.createElement('h2');
    title.className = 'view-title';
    title.textContent = this.puzzleTitle;
    titleRow.append(title);

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

    this.haloPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.haloPath.setAttribute('class', 'path-halo');
    this.haloPath.setAttribute('d', '');

    this.corePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.corePath.setAttribute('class', 'path-core');
    this.corePath.setAttribute('d', '');

    this.overlay.append(this.haloPath, this.corePath);
    this.gridWrap.append(gridEl, this.overlay);

    const hints = document.createElement('div');
    hints.className = 'hints';

    const answers = [...puzzle.answers].sort((a, b) => a.display.localeCompare(b.display));
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
      if (this.inputManager.getChain().length === 0) return;
      this.inputManager.clearChain();
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown, true);

    // Hints: ensure daily grant, restore reveals, update counter
    void (async () => {
      const state = await ensureDailyGrant();
      this.hintsRemaining = state.hintsRemaining;
      this.updateHintCounter();
      await this.restoreHintReveals();
    })();

    this.startTimer();

    window.addEventListener('resize', () => {
      this.redrawPath(this.inputManager.getChain());
    });

    const tutorialLabel = document.createElement('p');
    tutorialLabel.className = 'game-instructions';
    tutorialLabel.textContent = t('game.instructions');

    const rootEl = this.element;
    void (async () => {
      const solvedIds = await getSolvedIds();
      if (!rootEl.isConnected) return;
      if (solvedIds.length > 0) tutorialLabel.hidden = true;
    })();

    this.element.append(header, titleRow, this.gridWrap, hints, tutorialLabel);

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
    slot.dataset.partId = partId;
    slot.dataset.letterIndex = String(letterIndex);
    slot.dataset.revealed = 'false';
    slot.dataset.filled = 'false';
    slot.dataset.letter = letter;
    const letterSpan = document.createElement('span');
    letterSpan.className = 'hint-slot-letter';
    letterSpan.textContent = letter;
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

    if (this.hintsRemaining <= 0) {
      event.preventDefault();
      await this.showOutOfHintsModal();
      return;
    }

    event.preventDefault();
    slot.dataset.revealing = 'true';
    this.hintCounterEl.dataset.charging = 'true';
  }

  private onHintSlotPointerEnd(slot: HTMLElement): void {
    if (slot.dataset.revealed !== 'true') {
      delete slot.dataset.revealing;
    }
    delete this.hintCounterEl.dataset.charging;
  }

  private async onHintSlotAnimationEnd(event: AnimationEvent, slot: HTMLElement): Promise<void> {
    if (event.animationName !== 'hint-reveal-rise') {
      delete this.hintCounterEl.dataset.charging;
      return;
    }
    if (slot.dataset.revealed === 'true') {
      delete this.hintCounterEl.dataset.charging;
      return;
    }
    if (slot.dataset.revealing !== 'true') {
      delete this.hintCounterEl.dataset.charging;
      return;
    }
    delete slot.dataset.revealing;
    await this.revealSlot(slot);
  }

  private async revealSlot(slot: HTMLElement): Promise<void> {
    const partId = slot.dataset.partId;
    const letterIndex = Number(slot.dataset.letterIndex);
    if (!partId || !Number.isFinite(letterIndex)) return;

    slot.dataset.revealed = 'true';
    slot.dataset.filled = 'true';
    delete this.hintCounterEl.dataset.charging;
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
    this.hintCounterCount.textContent = String(this.hintsRemaining);
    if (this.hintsRemaining <= 0) {
      this.hintCounterEl.dataset.state = 'empty';
    } else {
      delete this.hintCounterEl.dataset.state;
    }
  }

  private async showOutOfHintsModal(): Promise<void> {
    await showInfoModal({
      title: t('hint.out_title'),
      body: t('hint.out_body'),
      closeLabel: t('hint.out_close')
    });
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
      const slot = this.element.querySelector<HTMLElement>(
        `.hint-slot[data-part-id="${CSS.escape(reveal.partId)}"][data-letter-index="${reveal.letterIndex}"]`
      );
      if (slot) {
        slot.dataset.revealed = 'true';
        slot.dataset.filled = 'true';
      }
    }
  }

  private startTimer(): void {
    this.timerStartedAt = Date.now();
    this.timerPausedAt = null;
    this.timerTotalPausedMs = 0;
    this.timerInterval = window.setInterval(() => this.tickTimer(), 100);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('focus', this.handleFocus);
  }

  private stopTimer(): void {
    if (this.timerInterval !== null) {
      window.clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('focus', this.handleFocus);
  }

  private pauseTimer(): void {
    if (this.timerPausedAt !== null || this.timerInterval === null) return;
    this.timerPausedAt = Date.now();
  }

  private resumeTimer(): void {
    if (this.timerPausedAt === null) return;
    this.timerTotalPausedMs += Date.now() - this.timerPausedAt;
    this.timerPausedAt = null;
    this.tickTimer();
  }

  private getElapsedSeconds(): number {
    const referenceNow = this.timerPausedAt ?? Date.now();
    const rawElapsedMs = referenceNow - this.timerStartedAt - this.timerTotalPausedMs;
    return Math.max(0, Math.floor(rawElapsedMs / 1000));
  }

  private tickTimer(): void {
    this.timerLabel.textContent = this.formatElapsed(this.getElapsedSeconds());
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.pauseTimer();
      return;
    }
    this.resumeTimer();
  };

  private handleBlur = (): void => {
    this.pauseTimer();
  };

  private handleFocus = (): void => {
    this.resumeTimer();
  };

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

  private formatElapsed(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private bindPointerEvents(): void {
    this.gridWrap.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary) return;
      this.gridWrap.setPointerCapture(event.pointerId);
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
      if (this.gridWrap.hasPointerCapture(event.pointerId)) {
        this.gridWrap.releasePointerCapture(event.pointerId);
      }
    });

    this.gridWrap.addEventListener('pointercancel', (event) => {
      if (!event.isPrimary) return;
      this.inputManager.clearChain();
      this.inputManager.onPointerUp(0);
      if (this.gridWrap.hasPointerCapture(event.pointerId)) {
        this.gridWrap.releasePointerCapture(event.pointerId);
      }
    });
  }

  private onChainChanged(chain: Tile[]): void {
    const prevLen = this.previousChainLength;
    const newLen = chain.length;

    if (prevLen === 0 && newLen >= 1) {
      this.chainsStarted += 1;
      HapticService.selection();
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
      if (match && !this.isLongerPrefixPossible(chainStr)) {
        HapticService.impactMedium();
        this.onWordFound(match.partIds);
      }
    }
  }

  private redrawPath(chain: Tile[]): void {
    const rect = this.gridWrap.getBoundingClientRect();
    this.overlay.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);

    if (chain.length < 2) {
      this.haloPath.setAttribute('d', '');
      this.corePath.setAttribute('d', '');
      return;
    }

    const points = chain.map((tile) => this.getTileCenter(tile));
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }

    this.haloPath.setAttribute('d', d);
    this.corePath.setAttribute('d', d);
  }

  private getTileCenter(tile: Tile): { x: number; y: number } {
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
    const rect = this.gridWrap.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  private computeHitRadius(): number {
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

  private isLongerPrefixPossible(chainStr: string): boolean {
    for (const [display, fullWord] of this.answerFullWords) {
      if (this.solvedAnswerDisplays.has(display)) continue;
      if (fullWord.length > chainStr.length && fullWord.startsWith(chainStr)) {
        return true;
      }
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
          slot.dataset.filled = 'true';
        }, index * 60);
      });
    }

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
          this.triggerCascade(row);
        }
      }
    }

  }

  private triggerCascade(row: HTMLDivElement): void {
    const slots = row.querySelectorAll<HTMLElement>('.hint-slot');
    slots.forEach((slot, index) => {
      slot.style.setProperty('--cascade-delay', `${index * 60}ms`);
    });
    row.dataset.justSolved = 'true';

    // Total animation time = (slots.length - 1) * 60ms delay + 220ms duration
    const totalMs = (slots.length - 1) * 60 + 220 + 40;
    window.setTimeout(() => {
      if (!row.isConnected) return;
      row.removeAttribute('data-just-solved');
      slots.forEach((slot) => slot.style.removeProperty('--cascade-delay'));
    }, totalMs);

    for (const tile of this.allTiles) {
      this.applyTileVisualState(tile);
    }

    this.inputManager.clearChain();

    const solvedAllParts = this.solvedPartIds.size === this.partEntriesById.size;
    if (solvedAllParts) {
      this.onPuzzleSolved();
    }
  }

  private triggerTileFoundAnimation(path: string[]): void {
    const STAGGER_MS = GameView.TILE_REVEAL_STAGGER_MS;
    const ANIMATION_DURATION_MS = GameView.TILE_REVEAL_DURATION_MS;

    path.forEach((coord, index) => {
      const tile = this.tileByCoord.get(coord);
      if (!tile) return;
      const tileEl = this.tileElements.get(tile);
      if (!tileEl) return;
      tileEl.style.setProperty('--reveal-delay', `${index * STAGGER_MS}ms`);
      tileEl.dataset.revealing = 'true';
    });

    const cleanupMs = ANIMATION_DURATION_MS + (path.length - 1) * STAGGER_MS + 50;
    window.setTimeout(() => {
      for (const coord of path) {
        const tile = this.tileByCoord.get(coord);
        if (!tile) continue;
        const tileEl = this.tileElements.get(tile);
        if (!tileEl) continue;
        tileEl.removeAttribute('data-revealing');
        tileEl.style.removeProperty('--reveal-delay');
        this.pendingVisualDeactivationCoords.delete(coord);
        this.applyTileVisualState(tile);
      }
    }, cleanupMs);
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
    this.timerLabel.textContent = this.formatElapsed(elapsedSeconds);
    const starRating = this.getStarRating();
    const mistakes = this.getMistakeCount();
    const holdForAnimations = new Promise<void>((resolve) =>
      window.setTimeout(resolve, GameView.FINAL_ANIMATION_HOLD_MS)
    );

    const fadeOut = async (): Promise<void> => {
      if (!this.element.isConnected) return;
      this.element.classList.add('view-exiting');
      await new Promise<void>((resolve) =>
        window.setTimeout(resolve, GameView.EXIT_FADE_MS)
      );
    };

    // void haptic.pristineWin() or haptic.win() if available

    void (async () => {
      try {
        const previousRatings = await getSolvedRatings();
        const previousRating = previousRatings[this.puzzleId] ?? 0;
        const wasNewRating = starRating > previousRating;

        const previousTimes = await getSolvedTimes();
        const previousValues = Object.values(previousTimes).filter((v): v is number => Number.isFinite(v));
        const previousBest = previousValues.length === 0 ? null : Math.min(...previousValues);
        const wasNewBest = previousBest !== null && elapsedSeconds < previousBest;

        const snapshot = await recordPuzzleCompletion(this.puzzleId, elapsedSeconds, {
          isTodaysDaily: this.isTodaysDaily,
          starRating,
          isTutorial: this.isTutorial
        });

        await clearPuzzleReveals(this.puzzleId);

        let unlockedAchievements: string[] = [];
        if (!this.isTutorial) {
          unlockedAchievements = await detectAndUnlockAchievements({
            currentStreak: snapshot.currentStreak,
            solvedCount: snapshot.solvedCount,
            pristineCount: snapshot.pristineCount,
            consecutivePristineCount: snapshot.consecutivePristineCount,
            archiveSolvesCount: snapshot.archiveSolvesCount,
            bestTimeSec: snapshot.bestTimeSec,
            elapsedSeconds,
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
          was_new_best: wasNewBest,
          was_new_rating: wasNewRating
        });

        await maybeShowInterstitial(snapshot.totalSolveAttempts);
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
          unlockedAchievements
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
          unlockedAchievements: []
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
