import { getDailyPuzzleIndex, getPuzzleAtIndex, ensureBundledPuzzlesLoaded } from '../game/PuzzleLoader';
import { InputManager } from '../game/InputManager';
import { Tile } from '../game/Tile';
import { applySolvedPart, buildTileOwnership, isFoundPending, type PartOwnershipEntry, type TileOwnershipState } from '../game/tileOwnership';
import { maybeShowInterstitial } from '../services/AdService';
import { recordPuzzleCompletion } from '../services/ProgressService';
import { t } from '../utils/i18n';
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
  private readonly puzzleId: string;
  private readonly puzzleTitle: string;
  private readonly timerLabel: HTMLSpanElement;
  private readonly startTimeMs: number;
  private timerIntervalId: number | null = null;
  private solved = false;

  constructor(onWin: (payload: WinPayload) => void, onMenu?: () => void) {
    const puzzles = ensureBundledPuzzlesLoaded();
    const dailyIndex = getDailyPuzzleIndex(puzzles);
    const puzzle = getPuzzleAtIndex(dailyIndex, puzzles);

    this.onWin = onWin;
    this.puzzleId = puzzle.id;
    this.puzzleTitle = t(puzzle.name, puzzle.id);
    this.startTimeMs = Date.now();

    this.element = document.createElement('div');
    this.element.className = 'view game-view';

    const header = document.createElement('div');
    header.className = 'header';

    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'header-menu-button';
    menuButton.textContent = 'Menu';
    menuButton.addEventListener('click', () => {
      this.stopTimer();
      onMenu?.();
    });

    const levelLabel = document.createElement('span');
    levelLabel.className = 'header-level';
    levelLabel.textContent = `Level ${dailyIndex + 1}`;

    this.timerLabel = document.createElement('span');
    this.timerLabel.className = 'header-timer';
    this.timerLabel.textContent = '0:00';

    header.append(menuButton, levelLabel, this.timerLabel);

    const title = document.createElement('h2');
    title.className = 'view-title';
    title.textContent = this.puzzleTitle;

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
          const slot = document.createElement('span');
          slot.className = 'hint-slot';
          slot.dataset.filled = 'false';
          slot.textContent = '_';
          row.appendChild(slot);
          slotsForPart.push(slot);
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
    this.startTimer();

    window.addEventListener('resize', () => {
      this.redrawPath(this.inputManager.getChain());
    });

    const description = document.createElement('p');
    description.className = 'view-subtitle';
    description.textContent = 'Swipe adjacent letters to find all words.';

    const completeButton = document.createElement('button');
    completeButton.type = 'button';
    completeButton.className = 'action-button';
    completeButton.textContent = 'Simulate Win';
    completeButton.addEventListener('click', () => {
      this.onPuzzleSolved();
    });

    this.element.append(header, title, this.gridWrap, hints, description, completeButton);
  }

  private startTimer(): void {
    this.timerIntervalId = window.setInterval(() => {
      this.timerLabel.textContent = this.formatElapsed(this.getElapsedSeconds());
    }, 250);
  }

  private stopTimer(): void {
    if (this.timerIntervalId === null) return;
    window.clearInterval(this.timerIntervalId);
    this.timerIntervalId = null;
  }

  private getElapsedSeconds(): number {
    return Math.floor((Date.now() - this.startTimeMs) / 1000);
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

  private onPuzzleSolved(): void {
    if (this.solved) return;
    this.solved = true;
    this.stopTimer();

    const elapsedSeconds = this.getElapsedSeconds();
    this.timerLabel.textContent = this.formatElapsed(elapsedSeconds);

    void (async () => {
      try {
        const snapshot = await recordPuzzleCompletion(this.puzzleId, elapsedSeconds);
        await maybeShowInterstitial(snapshot.solvedCount);

        this.onWin({
          puzzleId: this.puzzleId,
          puzzleTitle: this.puzzleTitle,
          elapsedSeconds,
          solvedCount: snapshot.solvedCount,
          currentStreak: snapshot.currentStreak
        });
      } catch {
        this.onWin({
          puzzleId: this.puzzleId,
          puzzleTitle: this.puzzleTitle,
          elapsedSeconds,
          solvedCount: 0,
          currentStreak: 0
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
}
