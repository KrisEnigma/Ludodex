import { InputManager } from '../game/InputManager';
import { t } from '../i18n';
import { Tile } from '../game/Tile';
import { applySolvedPart, buildTileOwnership, isFoundPending, type PartOwnershipEntry, type TileOwnershipState } from '../game/tileOwnership';
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
import type { RoutePayloads } from './Router';
import type { WinPayload } from './types';

type PartEntry = {
  id: string;
  answerDisplay: string;
  word: string;
  path: string[];
};

export class GameView {
  readonly element: HTMLDivElement;
  private readonly gridWrap: HTMLDivElement;
  private readonly overlay: SVGSVGElement;
  private readonly haloPath: SVGPathElement;
  private readonly corePath: SVGPathElement;
  private readonly tileElements = new Map<Tile, HTMLDivElement>();
  private readonly tileByCoord = new Map<string, Tile>();
  private readonly selectedTiles = new Set<Tile>();
  private readonly hintSlotsByPartId = new Map<string, HTMLSpanElement[]>();
  private readonly hintRowsByDisplay = new Map<string, HTMLDivElement>();
  private readonly partEntriesById = new Map<string, PartEntry>();
  private readonly partIdsByWord = new Map<string, string[]>();
  private readonly partIdsByAnswer = new Map<string, string[]>();
  private readonly fullAnswerWordToPartIds = new Map<string, string[]>();
  private readonly solvedPartIds = new Set<string>();
  private readonly allTiles: Tile[];
  private readonly inputManager: InputManager<{ partIds: string[] }>;
  private readonly ownershipState: TileOwnershipState;
  private readonly onWin: (payload: WinPayload) => void;
  private readonly onMenu: () => void;
  private readonly dayNumber: number;
  private readonly puzzle: Puzzle;
  private readonly isTodaysDaily: boolean;
  private readonly wordsProgressLabel: HTMLParagraphElement;
  private readonly puzzleId: string;
  private readonly puzzleTitle: string;
  private readonly timerLabel: HTMLSpanElement;
  private timerStartedAt = 0;
  private timerPausedAt: number | null = null;
  private timerTotalPausedMs = 0;
  private timerInterval: number | null = null;
  private selectionsStarted = 0;
  private undosPerformed = 0;
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
    const { puzzle, dayNumber, isTodaysDaily } = payload;

    this.onWin = callbacks.onWin;
  this.onMenu = callbacks.onMenu;
    this.dayNumber = dayNumber;
    this.puzzle = puzzle;
    this.isTodaysDaily = isTodaysDaily;
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
    this.hintCounterEl.dataset.empty = 'false';
    const hintIcon = document.createElement('span');
    hintIcon.className = 'game-hint-counter-icon';
    hintIcon.textContent = '💡';
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

    this.wordsProgressLabel = document.createElement('p');
    this.wordsProgressLabel.className = 'game-words-progress';
    this.updateWordsProgressLabel();
    titleRow.append(title, this.wordsProgressLabel);

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
        tile.textContent = model.letter;
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
          const gap = document.createElement('span');
          gap.className = 'word-gap';
          row.appendChild(gap);
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
          // Selection persists after swipe-end so the user can continue by tap or swipe.
        },
        onWordFound: (match) => this.onWordFound(match.partIds)
      }
    });

    this.bindPointerEvents();
    this.element.addEventListener('pointerdown', (event) => {
      if (this.gridWrap.contains(event.target as Node)) return;
      this.inputManager.clearChain();
    });

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
  }

  private buildLetterSlot(partId: string, letterIndex: number, letter: string): HTMLElement {
    const slot = document.createElement('span');
    slot.className = 'hint-slot';
    slot.dataset.partId = partId;
    slot.dataset.letterIndex = String(letterIndex);
    slot.dataset.revealed = 'false';
    slot.dataset.filled = 'false';
    slot.dataset.letter = letter;
    slot.textContent = letter;

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
  }

  private onHintSlotPointerEnd(slot: HTMLElement): void {
    if (slot.dataset.revealed !== 'true') {
      delete slot.dataset.revealing;
    }
  }

  private async onHintSlotAnimationEnd(event: AnimationEvent, slot: HTMLElement): Promise<void> {
    if (event.animationName !== 'hint-reveal-fill') return;
    if (slot.dataset.revealed === 'true') return;
    if (slot.dataset.revealing !== 'true') return;
    delete slot.dataset.revealing;
    await this.revealSlot(slot);
  }

  private async revealSlot(slot: HTMLElement): Promise<void> {
    const partId = slot.dataset.partId;
    const letterIndex = Number(slot.dataset.letterIndex);
    if (!partId || !Number.isFinite(letterIndex)) return;

    slot.dataset.revealed = 'true';
    slot.dataset.filled = 'true';
    this.hintsUsed += 1;

    const state = await consumeHint();
    this.hintsRemaining = state.hintsRemaining;
    this.updateHintCounter();

    await addPuzzleReveal(this.puzzleId, { partId, letterIndex });
  }

  private updateHintCounter(): void {
    this.hintCounterCount.textContent = String(this.hintsRemaining);
    this.hintCounterEl.dataset.empty = String(this.hintsRemaining <= 0);
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

    const hasProgress = this.solvedPartIds.size > 0 || this.selectionsStarted > 0 || this.getElapsedSeconds() >= 5;
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
      this.selectionsStarted += 1;
    } else if (newLen > 0 && newLen < prevLen) {
      this.undosPerformed += 1;
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

  private onWordFound(partIds: string[]): void {
    if (this.solved) return;

    // Check if any part is already solved
    if (partIds.some((id) => this.solvedPartIds.has(id))) {
      this.inputManager.clearChain();
      return;
    }

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
        }
      }

      const slots = this.hintSlotsByPartId.get(partId) ?? [];
      for (let i = 0; i < slots.length; i++) {
        slots[i].dataset.filled = 'true';
        slots[i].textContent = partEntry.word[i] ?? '';
      }
    }

    // Get the answer display from first part
    const firstEntry = this.partEntriesById.get(partIds[0]);
    if (firstEntry) {
      const answerPartIds = this.partIdsByAnswer.get(firstEntry.answerDisplay) ?? [];
      const solved = answerPartIds.every((id) => this.solvedPartIds.has(id));
      if (solved) {
        const row = this.hintRowsByDisplay.get(firstEntry.answerDisplay);
        if (row) row.dataset.solved = 'true';
        this.updateWordsProgressLabel();
      }
    }

    for (const tile of this.allTiles) {
      this.applyTileVisualState(tile);
    }

    this.inputManager.clearChain();

    const solvedAllParts = this.solvedPartIds.size === this.partEntriesById.size;
    if (solvedAllParts) {
      this.onPuzzleSolved();
    }
  }


  private getStarRating(): 1 | 2 | 3 {
    const cleanExecution =
      this.undosPerformed === 0 &&
      this.selectionsStarted === this.puzzle.answers.length;
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
          starRating
        });

        await clearPuzzleReveals(this.puzzleId);

        await maybeShowInterstitial(snapshot.solvedCount);

        this.onWin({
          puzzleId: this.puzzleId,
          puzzleTitle: this.puzzleTitle,
          elapsedSeconds,
          solvedCount: snapshot.solvedCount,
          currentStreak: snapshot.currentStreak,
          dayNumber: this.dayNumber,
          hintsUsed: this.hintsUsed,
          isTodaysDaily: this.isTodaysDaily,
          starRating,
          wasNewBest,
          wasNewRating
        });
      } catch (err) {
        console.warn('[GameView] onPuzzleSolved failed', err);
        try {
          await clearPuzzleReveals(this.puzzleId);
        } catch {
          // Ignore cleanup failures in fallback path.
        }

        this.onWin({
          puzzleId: this.puzzleId,
          puzzleTitle: this.puzzleTitle,
          elapsedSeconds,
          solvedCount: 0,
          currentStreak: 0,
          dayNumber: this.dayNumber,
          hintsUsed: this.hintsUsed,
          isTodaysDaily: this.isTodaysDaily,
          starRating: this.getStarRating(),
          wasNewBest: false,
          wasNewRating: false
        });
      }
    })();
  }

  private applyTileVisualState(tile: Tile): void {
    const el = this.tileElements.get(tile);
    if (!el) return;

    if (tile.deactivated) {
      el.dataset.state = 'deactivated';
      return;
    }

    if (this.selectedTiles.has(tile)) {
      el.dataset.state = 'selected';
      return;
    }

    if (isFoundPending(this.ownershipState, tile.coord)) {
      el.dataset.state = 'found-pending';
      return;
    }

    el.dataset.state = 'idle';
  }

  private updateWordsProgressLabel(): void {
    const total = this.puzzle.answers.length;
    let found = 0;
    for (const answer of this.puzzle.answers) {
      const partIds = this.partIdsByAnswer.get(answer.display) ?? [];
      if (partIds.length > 0 && partIds.every((id) => this.solvedPartIds.has(id))) {
        found += 1;
      }
    }
    this.wordsProgressLabel.textContent = t('game.words_progress', { found, total });
  }
}
