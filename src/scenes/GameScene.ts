import Phaser from 'phaser';
import { getDailyPuzzleIndex, getPuzzleAtIndex, getPuzzleCount } from '../game/PuzzleLoader';
import { t } from '../utils/i18n';
import { buildGridTiles } from '../game/Grid';
import { puzzleCoordToGridCoord } from '../game/coordMap';
import { InputManager, type PendingAction } from '../game/InputManager';
import {
  applySolvedPart,
  buildTileOwnership,
  type PartOwnershipEntry,
  type TileOwnershipState
} from '../game/tileOwnership';
import { Tile } from '../game/Tile';
import type { Answer, PuzzlePart } from '../types/puzzle';

type GameWordMatch = {
  answerWord: string;
  answerDisplay: string;
  partIds: string[];
};

type PartEntry = {
  id: string;
  answerDisplay: string;
  word: string;
  path: string[];
};

type HintRow = {
  answer: Answer;
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
};

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  tileGrid: Tile[][] = [];
  allTiles: Tile[] = [];
  tileByCoord: Map<string, Tile> = new Map();
  tileSprites: Map<Tile, Phaser.GameObjects.Container> = new Map();
  tileLetters: Map<Tile, Phaser.GameObjects.Text> = new Map();
  pendingOverlay: Map<Tile, Phaser.Tweens.Tween> = new Map();
  pathGraphics!: Phaser.GameObjects.Graphics;
  pathHeadGraphics!: Phaser.GameObjects.Graphics;
  pathSegmentTween: Phaser.Tweens.Tween | null = null;
  pathDisappearTween: Phaser.Tweens.Tween | null = null;
  nearWordPulseTween: Phaser.Tweens.Tween | null = null;
  singleHeadTween: Phaser.Tweens.Tween | null = null;
  singleHeadTile: Tile | null = null;
  singleHeadPulse = { scale: 1, alpha: 1 };
  lastPathChain: Tile[] = [];
  CELL_SIZE = 180;
  HIT_RADIUS = 68;
  PATH_COLOR = 0xaee7ff;
  PATH_SEGMENT_COLORS = [0xff00c8, 0xae00ff, 0x3a35ff, 0x0f7bff, 0x16c7d4, 0x12c93d];
  boardLeft = 0;
  boardTop = 0;
  boardRight = 0;
  boardBottom = 0;

  solvedPartIds: Set<string> = new Set();
  solvedAnswers: Set<string> = new Set();
  partEntriesById: Map<string, PartEntry> = new Map();
  answerWordToDisplay: Map<string, string> = new Map();
  partIdsByAnswerDisplay: Map<string, string[]> = new Map();
  ownershipState!: TileOwnershipState;

  activeChain: Tile[] = [];
  inputManager!: InputManager<GameWordMatch>;
  puzzle: any;
  levelText!: Phaser.GameObjects.Text;
  timerText!: Phaser.GameObjects.Text;
  startTimeMs = 0;
  hintRows: HintRow[] = [];

  onGlobalPointerDown = (event: PointerEvent) => {
    const canvas = this.game.canvas as HTMLCanvasElement | null;
    if (!canvas) return;

    const target = event.target as Node | null;
    if (target && canvas.contains(target)) return;

    this.inputManager.clearChain();
  };

  currentPuzzleIndex = 0;
  nearWordPulseScale = 1;
  winPopup: Phaser.GameObjects.Container | null = null;

  create(data?: { puzzleIndex?: number }) {
    this.currentPuzzleIndex = data?.puzzleIndex ?? getDailyPuzzleIndex();
    this.puzzle = getPuzzleAtIndex(this.currentPuzzleIndex);
    const levelNumber = this.currentPuzzleIndex + 1;
    this.startTimeMs = Date.now();

    this.levelText = this.add.text(80, 50, `Level ${levelNumber}`, {
      color: '#b8b8b8',
      fontFamily: 'monospace',
      fontSize: '24px'
    }).setOrigin(0, 0.5);

    this.timerText = this.add.text(this.scale.width - 80, 50, '0:00', {
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '28px'
    }).setOrigin(1, 0.5);

    this.add.text(this.scale.width / 2, 110, t(this.puzzle.name), {
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '48px',
      align: 'center',
      wordWrap: { width: 900 }
    }).setOrigin(0.5);

    if (this.puzzle.hint) {
      this.add.text(this.scale.width / 2, 175, t(this.puzzle.hint), {
        color: '#999999',
        fontFamily: 'monospace',
        fontSize: '24px',
        align: 'center',
        wordWrap: { width: 900 }
      }).setOrigin(0.5);
    }

    this.CELL_SIZE = Math.floor(Math.min(this.scale.width, this.scale.height) * 0.22);
    this.HIT_RADIUS = this.CELL_SIZE * 0.38;
    const gridW = this.CELL_SIZE * 4;
    const gridH = this.CELL_SIZE * 4;
    this.boardLeft = (this.scale.width - gridW) / 2;
    this.boardTop = 260;
    this.boardRight = this.boardLeft + gridW;
    this.boardBottom = this.boardTop + gridH;

    this.tileGrid = buildGridTiles(this.puzzle.grid);
    this.allTiles = this.tileGrid.flat();
    this.tileByCoord.clear();
    for (const tile of this.allTiles) {
      this.tileByCoord.set(tile.coord, tile);
    }

    this.buildPartMetadata();
    this.tileSprites.clear();
    this.tileLetters.clear();

    for (const tile of this.allTiles) {
      const x = this.boardLeft + tile.col * this.CELL_SIZE + this.CELL_SIZE / 2;
      const y = this.boardTop + tile.row * this.CELL_SIZE + this.CELL_SIZE / 2;
      const container = this.add.container(x, y).setDepth(10);
      const bg = this.add
        .rectangle(0, 0, this.CELL_SIZE * 0.92, this.CELL_SIZE * 0.92, 0x2d2d2d, 1)
        .setOrigin(0.5)
        .setStrokeStyle(4, 0x555555);
      const letter = this.add.text(x, y, tile.letter, {
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: `${this.CELL_SIZE * 0.48}px`
      }).setOrigin(0.5).setDepth(30);
      container.add(bg);
      this.tileSprites.set(tile, container);
      this.tileLetters.set(tile, letter);
    }

    this.pathGraphics = this.add.graphics().setDepth(20);
    this.pathHeadGraphics = this.add.graphics().setDepth(20);

    this.buildHintRows();

    const validWordLengths = new Set<number>();
    for (const answer of this.puzzle.answers as Answer[]) {
      validWordLengths.add(answer.display.replace(/ /g, '').length);
    }

    this.inputManager = new InputManager<GameWordMatch>({
      tiles: this.allTiles,
      hitRadius: this.HIT_RADIUS,
      swipeThreshold: 12,
      getTileCenter: (tile) => {
        const sprite = this.tileSprites.get(tile);
        return { x: sprite?.x ?? 0, y: sprite?.y ?? 0 };
      },
      validWordLengths,
      findMatch: (word) => this.findWordMatch(word),
      events: {
        onWordFound: (match) => this.onWordFound(match),
        onInvalidWord: (chain) => this.onInvalidWord(chain),
        onChainChanged: (chain) => this.onChainChanged(chain),
        onPendingActionChanged: (pending) => this.previewPendingAction(pending)
      }
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.inputManager.onPointerDown(pointer.id, pointer.x, pointer.y);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.inputManager.onPointerMove(pointer.id, pointer.x, pointer.y, pointer.isDown);
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.inputManager.onPointerUp(pointer.id);
    });

    this.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => this.updateTimer()
    });

    window.addEventListener('pointerdown', this.onGlobalPointerDown, true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('pointerdown', this.onGlobalPointerDown, true);
      this.clearPendingPreview();
      this.stopNearWordPulse();
      this.winPopup?.destroy();
      this.winPopup = null;
    });
  }

  buildPartMetadata() {
    this.partEntriesById.clear();
    this.answerWordToDisplay.clear();
    this.partIdsByAnswerDisplay.clear();
    this.solvedPartIds.clear();
    this.solvedAnswers.clear();

    const ownershipEntries: PartOwnershipEntry[] = [];

    for (const answer of this.puzzle.answers as Answer[]) {
      const partIds: string[] = [];
      answer.parts.forEach((part: PuzzlePart, index: number) => {
        const id = `${answer.display}::${index}`;
        const entry: PartEntry = {
          id,
          answerDisplay: answer.display,
          word: part.word,
          path: part.path.map((coord) => puzzleCoordToGridCoord(coord))
        };

        this.partEntriesById.set(id, entry);
        partIds.push(id);
        ownershipEntries.push({ id, path: entry.path });
      });

      const answerWord = answer.display.replace(/ /g, '').toUpperCase();
      this.answerWordToDisplay.set(answerWord, answer.display);
      this.partIdsByAnswerDisplay.set(answer.display, partIds);
    }

    this.ownershipState = buildTileOwnership(ownershipEntries);
  }

  updateTimer() {
    const elapsedSec = Math.floor((Date.now() - this.startTimeMs) / 1000);
    const minutes = Math.floor(elapsedSec / 60);
    const seconds = elapsedSec % 60;
    this.timerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`);
  }

  buildHintRows() {
    const rowsY = this.boardBottom + 55;
    const answers = [...(this.puzzle.answers as Answer[])].sort((a, b) =>
      a.display.localeCompare(b.display)
    );

    const totalWeight = answers.reduce((sum, answer) => {
      return sum + answer.display.replace(/ /g, '').length;
    }, 0);

    const maxWidth = this.scale.width - 120;
    const gap = 12;
    const usableWidth = maxWidth - gap * (answers.length - 1);
    let cursorX = (this.scale.width - maxWidth) / 2;

    this.hintRows = [];

    for (const answer of answers) {
      const weight = answer.display.replace(/ /g, '').length;
      const width = Math.max(140, Math.floor((usableWidth * weight) / totalWeight));
      const height = 56;
      const centerX = cursorX + width / 2;

      const bg = this.add
        .rectangle(centerX, rowsY, width, height, 0x1e1e1e, 1)
        .setStrokeStyle(2, 0x555555)
        .setOrigin(0.5);

      const text = this.add.text(centerX, rowsY, this.renderAnswerMask(answer), {
        color: '#cfcfcf',
        fontFamily: 'monospace',
        fontSize: '22px'
      }).setOrigin(0.5);

      this.hintRows.push({ answer, bg, text });
      cursorX += width + gap;
    }
  }

  getPartId(answer: Answer, index: number): string {
    return `${answer.display}::${index}`;
  }

  renderAnswerMask(answer: Answer): string {
    const chunks: string[] = [];
    answer.parts.forEach((part, index) => {
      const partId = this.getPartId(answer, index);
      const solved = this.solvedPartIds.has(partId);
      chunks.push(solved ? part.word : '_'.repeat(part.word.length));
    });
    return chunks.join(' ');
  }

  refreshHintRow(answerDisplay: string) {
    const row = this.hintRows.find((h) => h.answer.display === answerDisplay);
    if (!row) return;

    row.text.setText(this.renderAnswerMask(row.answer));
    const allSolved = row.answer.parts.every((_, index) => {
      const partId = this.getPartId(row.answer, index);
      return this.solvedPartIds.has(partId);
    });

    if (allSolved) {
      this.solvedAnswers.add(answerDisplay);
      row.bg.setFillStyle(0x22452f, 1);
      row.bg.setStrokeStyle(2, 0x27ae60);
      row.text.setColor('#e9ffe9');
    }
  }

  findWordMatch(word: string): GameWordMatch | null {
    const key = word.toUpperCase();
    const answerDisplay = this.answerWordToDisplay.get(key);
    if (!answerDisplay) return null;
    if (this.solvedAnswers.has(answerDisplay)) return null;

    const partIds = this.partIdsByAnswerDisplay.get(answerDisplay) ?? [];
    if (partIds.length === 0) return null;

    return {
      answerWord: key,
      answerDisplay,
      partIds
    };
  }

  onWordFound(match: GameWordMatch) {
    if (this.solvedAnswers.has(match.answerDisplay)) return;

    // Clear any active selection/path immediately after a successful match.
    this.inputManager.clearChain();

    this.solvedAnswers.add(match.answerDisplay);

    for (const partId of match.partIds) {
      if (this.solvedPartIds.has(partId)) continue;
      this.solvedPartIds.add(partId);

      const entry = this.partEntriesById.get(partId);
      if (!entry) continue;

      const deactivatedCoords = applySolvedPart(this.ownershipState, {
        id: entry.id,
        path: entry.path
      });

      for (const coord of deactivatedCoords) {
        this.deactivateTile(coord);
      }
    }

    this.refreshHintRow(match.answerDisplay);

    if (this.solvedAnswers.size === this.puzzle.answers.length) {
      this.showWinPopup();
    }
  }

  deactivateTile(coord: string) {
    const tile = this.tileByCoord.get(coord);
    if (!tile || tile.deactivated) return;

    const sprite = this.tileSprites.get(tile);
    const letter = this.tileLetters.get(tile);
    if (!sprite) return;

    tile.deactivated = true;

    this.tweens.add({
      targets: letter ? [sprite, letter] : [sprite],
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 180,
      ease: 'Cubic.In',
      onComplete: () => {
        sprite.setVisible(false);
        letter?.setVisible(false);
      }
    });
  }

  onInvalidWord(_chain: Tile[]) {
    // TODO: add shake animation and warning haptic.
  }

  onChainChanged(chain: Tile[]) {
    this.activeChain = chain;
    const selected = new Set(chain);
    for (const tile of this.allTiles) {
      this.setHighlight(tile, selected.has(tile));
    }
    this.redrawPath(chain);
  }

  previewPendingAction(pending: PendingAction | null) {
    this.clearPendingPreview();
    if (!pending) return;

    if (pending.type === 'add' || pending.type === 'new_chain') {
      // No pulse animation for hold/initial pending selection.
      return;
    }

    if (pending.type === 'remove_last') {
      const last = this.activeChain[this.activeChain.length - 1];
      if (last) this.startDimPreview([last]);
      return;
    }

    if (pending.type === 'backtrack') {
      const keep = pending.backtrackTo + 1;
      this.startDimPreview(this.activeChain.slice(keep));
    }
  }

  startPulsePreview(tiles: Tile[]) {
    // Intentionally no-op: hold state should not pulse.
  }

  startDimPreview(tiles: Tile[]) {
    for (const tile of tiles) {
      const sprite = this.tileSprites.get(tile);
      const letter = this.tileLetters.get(tile);
      if (!sprite) continue;
      const tween = this.tweens.add({
        targets: letter ? [sprite, letter] : [sprite],
        alpha: 0.6,
        duration: 120,
        yoyo: true,
        repeat: -1
      });
      this.pendingOverlay.set(tile, tween);
    }
  }

  clearPendingPreview() {
    for (const [tile, tween] of this.pendingOverlay.entries()) {
      tween.stop();
      const sprite = this.tileSprites.get(tile);
      const letter = this.tileLetters.get(tile);
      if (sprite) {
        if (tile.deactivated) {
          sprite.setAlpha(0);
          sprite.setScale(0);
          letter?.setAlpha(0);
          letter?.setScale(0);
        } else {
          sprite.setAlpha(1);
          letter?.setAlpha(1);
          if (!this.activeChain.includes(tile)) {
            sprite.setScale(1);
            letter?.setScale(1);
          }
        }
      }
    }
    this.pendingOverlay.clear();
  }

  setHighlight(tile: Tile, on: boolean) {
    const sprite = this.tileSprites.get(tile);
    const letter = this.tileLetters.get(tile);
    if (!sprite) return;
    if (tile.deactivated) return;

    const bg = sprite.list[0] as Phaser.GameObjects.Rectangle;

    if (on) {
      // Keep tile dark while selected; ribbon is the primary visual indicator.
      bg.setFillStyle(0x1f1f1f, 1);
      sprite.setScale(1.08);
      sprite.setAlpha(1);
      letter?.setScale(1.08);
      letter?.setAlpha(1);
      return;
    }

    bg.setFillStyle(0x2d2d2d, 1);
    sprite.setScale(1);
    sprite.setAlpha(1);
    letter?.setScale(1);
    letter?.setAlpha(1);
  }

  redrawPath(chain: Tile[]) {
    if (this.pathDisappearTween) {
      this.pathDisappearTween.stop();
      this.pathDisappearTween = null;
    }

    if (this.pathSegmentTween) {
      this.pathSegmentTween.stop();
      this.pathSegmentTween = null;
    }

    const isClearingSelection = chain.length === 0 && this.lastPathChain.length > 0;
    const isBacktrack =
      chain.length === this.lastPathChain.length - 1 &&
      chain.every((tile, i) => tile === this.lastPathChain[i]);

    if (isClearingSelection) {
      this.stopNearWordPulse();
      this.startRibbonDisappearAnimation();
      this.lastPathChain = [];
      return;
    }

    if (chain.length !== 1) {
      this.stopSingleHeadAnimation();
    }

    // Only clear graphics immediately if not about to animate deselect or undo
    if (!isBacktrack && !isClearingSelection) {
      this.pathGraphics.clear();
      this.pathHeadGraphics.clear();
    }
    if (chain.length === 0) {
      this.stopNearWordPulse();
      // Don't clear here, let startRibbonDisappearAnimation handle it
      this.lastPathChain = [...chain];
      return;
    }

    if (chain.length === 1) {
      const tile = chain[0];
      const sprite = this.tileSprites.get(tile);
      if (!sprite) {
        this.pathHeadGraphics.clear();
        this.lastPathChain = [...chain];
        return;
      }

      const color = this.PATH_SEGMENT_COLORS[0];
      this.stopSingleHeadAnimation();
      this.singleHeadTile = tile;
      this.drawSingleHead(sprite.x, sprite.y, color, 1, 1);
      this.updateNearWordPulse(chain);
      this.lastPathChain = [...chain];
      return;
    }

    this.pathHeadGraphics.clear();

    const points = chain
      .map((tile) => {
        const sprite = this.tileSprites.get(tile);
        return sprite ? { x: sprite.x, y: sprite.y } : null;
      })
      .filter(Boolean) as { x: number; y: number }[];

    if (points.length < 2) {
      this.lastPathChain = [...chain];
      return;
    }

    const segmentColors = this.buildSegmentColors(points);

    const isIncrementalAdd =
      chain.length === this.lastPathChain.length + 1 &&
      this.lastPathChain.every((tile, i) => tile === chain[i]);

    if (isBacktrack && this.lastPathChain.length > 1) {
      // Animate the last segment disappearing in reverse, only animate the last segment
      const prevPoints = this.lastPathChain
        .map((tile) => {
          const sprite = this.tileSprites.get(tile);
          return sprite ? { x: sprite.x, y: sprite.y } : null;
        })
        .filter(Boolean) as { x: number; y: number }[];
      const prevSegmentColors = this.buildSegmentColors(prevPoints);
      // Draw the new (shorter) chain as the base
      this.drawAllSegments(points, segmentColors);
      // Animate the last segment of the previous chain out on the head layer only
      const progress = { t: 1 };
      this.pathSegmentTween = this.tweens.add({
        targets: progress,
        t: 0,
        duration: 180,
        ease: 'Cubic.In',
        onUpdate: () => {
          this.pathHeadGraphics.clear();
          // Only animate the last segment (from previous chain)
          if (prevPoints.length >= 2) {
            this.drawSegment(
              this.pathHeadGraphics,
              prevPoints[prevPoints.length - 2],
              prevPoints[prevPoints.length - 1],
              prevSegmentColors[prevSegmentColors.length - 1],
              progress.t,
              1,
              1
            );
          }
        },
        onComplete: () => {
          this.pathSegmentTween = null;
          this.pathHeadGraphics.clear();
        }
      });
      this.updateNearWordPulse(chain);
      this.lastPathChain = [...chain];
      return;
    }

    if (!isIncrementalAdd) {
      this.updateNearWordPulse(chain);
      const pulseScale = this.nearWordPulseTween ? this.nearWordPulseScale : 1;
      this.drawAllSegments(points, segmentColors, pulseScale, 1);
      this.lastPathChain = [...chain];
      return;
    }

    // Draw previous segments instantly, animate only the newest one on a separate layer.
    this.drawBaseSegments(points, segmentColors);

    const progress = { t: 0 };
    this.pathSegmentTween = this.tweens.add({
      targets: progress,
      t: 1,
      duration: 180,
      ease: 'Cubic.Out',
      onUpdate: () => {
        this.drawLatestSegment(points, segmentColors, progress.t);
      },
      onComplete: () => {
        this.pathSegmentTween = null;
        this.pathHeadGraphics.clear();
        this.drawAllSegments(points, segmentColors);
      }
    });

    this.updateNearWordPulse(chain);
    this.lastPathChain = [...chain];
  }

  updateNearWordPulse(chain: Tile[]) {
    if (this.isOneLetterAway(chain)) {
      this.startNearWordPulse();
    } else {
      this.stopNearWordPulse();
    }
  }

  isOneLetterAway(chain: Tile[]): boolean {
    if (chain.length === 0) return false;

    const currentWord = chain.map((tile) => tile.letter).join('').toUpperCase();

    for (const [answerWord, answerDisplay] of this.answerWordToDisplay.entries()) {
      if (this.solvedAnswers.has(answerDisplay)) continue;
      if (answerWord.length !== currentWord.length + 1) continue;
      if (answerWord.startsWith(currentWord)) return true;
    }

    return false;
  }

  startNearWordPulse() {
    if (this.nearWordPulseTween) return;

    this.nearWordPulseScale = 1;
    this.nearWordPulseTween = this.tweens.add({
      targets: this,
      nearWordPulseScale: 1.14,
      duration: 180,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
      onUpdate: () => {
        this.redrawNearWordPulseFrame();
      }
    });
  }

  stopNearWordPulse() {
    if (this.nearWordPulseTween) {
      this.nearWordPulseTween.stop();
      this.nearWordPulseTween = null;
    }
    this.nearWordPulseScale = 1;
  }

  redrawNearWordPulseFrame() {
    if (this.pathSegmentTween || this.pathDisappearTween) return;

    if (this.activeChain.length === 0) {
      this.pathGraphics.clear();
      this.pathHeadGraphics.clear();
      return;
    }

    if (this.activeChain.length === 1) {
      const tile = this.activeChain[0];
      const sprite = this.tileSprites.get(tile);
      if (!sprite) return;
      this.drawSingleHead(sprite.x, sprite.y, this.PATH_SEGMENT_COLORS[0], this.nearWordPulseScale, 1);
      return;
    }

    const points = this.chainToPoints(this.activeChain);
    if (points.length < 2) return;

    const segmentColors = this.buildSegmentColors(points);
    this.pathHeadGraphics.clear();
    this.drawAllSegments(points, segmentColors, this.nearWordPulseScale, 1);
  }

  buildSegmentColors(points: { x: number; y: number }[]): number[] {
    const colors: number[] = [];
    let colorIndex = 0;
    let prevDx = 0;
    let prevDy = 0;

    for (let i = 1; i < points.length; i++) {
      const from = points[i - 1];
      const to = points[i];
      const dx = Math.sign(to.x - from.x);
      const dy = Math.sign(to.y - from.y);

      if (i > 1 && (dx !== prevDx || dy !== prevDy)) {
        colorIndex = (colorIndex + 1) % this.PATH_SEGMENT_COLORS.length;
      }

      colors.push(this.PATH_SEGMENT_COLORS[colorIndex]);
      prevDx = dx;
      prevDy = dy;
    }

    return colors;
  }

  chainToPoints(chain: Tile[]): { x: number; y: number }[] {
    return chain
      .map((tile) => {
        const sprite = this.tileSprites.get(tile);
        return sprite ? { x: sprite.x, y: sprite.y } : null;
      })
      .filter(Boolean) as { x: number; y: number }[];
  }

  startRibbonDisappearAnimation() {
    const points = this.chainToPoints(this.lastPathChain);

    this.stopNearWordPulse();
    this.stopSingleHeadAnimation();
    this.pathGraphics.clear();
    this.pathHeadGraphics.clear();

    if (points.length === 0) return;

    if (points.length === 1) {
      const color = this.PATH_SEGMENT_COLORS[0];
      const pulse = { scale: 1, alpha: 1 };
      this.pathDisappearTween = this.tweens.add({
        targets: pulse,
        scale: 0,
        alpha: 0.9,
        duration: 180,
        ease: 'Cubic.In',
        onUpdate: () => {
          this.drawSingleHead(points[0].x, points[0].y, color, pulse.scale, pulse.alpha);
        },
        onComplete: () => {
          this.pathDisappearTween = null;
          this.pathHeadGraphics.clear();
        }
      });
      return;
    }

    const segmentColors = this.buildSegmentColors(points);
    const state = { widthScale: 1, alpha: 1 };
    this.pathDisappearTween = this.tweens.add({
      targets: state,
      widthScale: 0,
      alpha: 0.9,
      duration: 180,
      ease: 'Cubic.In',
      onUpdate: () => {
        this.drawAllSegments(points, segmentColors, state.widthScale, state.alpha);
      },
      onComplete: () => {
        this.pathDisappearTween = null;
        this.pathGraphics.clear();
        this.pathHeadGraphics.clear();
      }
    });
  }

  drawSegment(
    g: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
    color: number,
    progress = 1,
    widthScale = 1,
    alpha = 1
  ) {
    if (progress <= 0 || widthScale <= 0) return;

    const ribbonWidth = this.CELL_SIZE * 0.50 * widthScale;
    const ribbonRadius = ribbonWidth * 0.5;
    const toX = from.x + (to.x - from.x) * progress;
    const toY = from.y + (to.y - from.y) * progress;

    g.lineStyle(ribbonWidth, color, alpha);
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.lineTo(toX, toY);
    g.strokePath();

    g.fillStyle(color, alpha);
    g.fillCircle(from.x, from.y, ribbonRadius);
    g.fillCircle(toX, toY, ribbonRadius);
  }

  drawAllSegments(
    points: { x: number; y: number }[],
    segmentColors: number[],
    widthScale = 1,
    alpha = 1
  ) {
    this.pathGraphics.clear();

    for (let i = 1; i < points.length; i++) {
      this.drawSegment(
        this.pathGraphics,
        points[i - 1],
        points[i],
        segmentColors[i - 1],
        1,
        widthScale,
        alpha
      );
    }
  }

  drawBaseSegments(points: { x: number; y: number }[], segmentColors: number[]) {
    this.pathGraphics.clear();
    this.pathHeadGraphics.clear();

    // Exclude the newest segment; it will animate on the head layer.
    for (let i = 1; i < points.length - 1; i++) {
      this.drawSegment(
        this.pathGraphics,
        points[i - 1],
        points[i],
        segmentColors[i - 1],
        1,
        1,
        1
      );
    }
  }

  drawLatestSegment(points: { x: number; y: number }[], segmentColors: number[], progress: number) {
    this.pathHeadGraphics.clear();
    if (points.length < 2) return;

    const latestIdx = points.length - 1;
    this.drawSegment(
      this.pathHeadGraphics,
      points[latestIdx - 1],
      points[latestIdx],
      segmentColors[latestIdx - 1],
      progress,
      1,
      1
    );
  }

  drawSingleHead(x: number, y: number, color: number, scale = 1, alpha = 1) {
    this.pathHeadGraphics.clear();

    const radius = this.CELL_SIZE * 0.25 * scale;
    this.pathHeadGraphics.fillStyle(color, alpha);
    this.pathHeadGraphics.fillCircle(x, y, radius);
  }

  formatElapsedTime(elapsedSec: number): string {
    const minutes = Math.floor(elapsedSec / 60);
    const seconds = elapsedSec % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  showWinPopup() {
    if (this.winPopup) return;

    const elapsedSec = Math.floor((Date.now() - this.startTimeMs) / 1000);
    const finalTime = this.formatElapsedTime(elapsedSec);

    const overlay = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000, 0.62)
      .setDepth(120)
      .setInteractive();

    const panel = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2, Math.min(860, this.scale.width - 80), 460, 0x141414, 1)
      .setStrokeStyle(3, 0x2f2f2f)
      .setDepth(121);

    const title = this.add.text(this.scale.width / 2, this.scale.height / 2 - 140, 'Puzzle Solved', {
      color: '#27ae60',
      fontFamily: 'monospace',
      fontSize: '56px'
    }).setOrigin(0.5).setDepth(122);

    const timeLabel = this.add.text(this.scale.width / 2, this.scale.height / 2 - 40, 'Final Time  ' + finalTime, {
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '36px'
    }).setOrigin(0.5).setDepth(122);

    const restartBtn = this.add
      .rectangle(this.scale.width / 2 - 170, this.scale.height / 2 + 90, 280, 92, 0x1f2a3d, 1)
      .setStrokeStyle(2, 0x4a90d9)
      .setDepth(122)
      .setInteractive({ useHandCursor: true });
    const restartText = this.add.text(this.scale.width / 2 - 170, this.scale.height / 2 + 90, 'Restart', {
      color: '#e7f0ff',
      fontFamily: 'monospace',
      fontSize: '32px'
    }).setOrigin(0.5).setDepth(123);

    const nextBtn = this.add
      .rectangle(this.scale.width / 2 + 170, this.scale.height / 2 + 90, 280, 92, 0x1f3d26, 1)
      .setStrokeStyle(2, 0x27ae60)
      .setDepth(122)
      .setInteractive({ useHandCursor: true });
    const nextText = this.add.text(this.scale.width / 2 + 170, this.scale.height / 2 + 90, 'Next Level', {
      color: '#e9ffe9',
      fontFamily: 'monospace',
      fontSize: '32px'
    }).setOrigin(0.5).setDepth(123);

    const group = this.add.container(0, 0, [
      overlay,
      panel,
      title,
      timeLabel,
      restartBtn,
      restartText,
      nextBtn,
      nextText
    ]);
    group.setDepth(120);
    this.winPopup = group;

    restartBtn.on('pointerdown', () => this.restartCurrentPuzzle());
    nextBtn.on('pointerdown', () => this.goToNextPuzzle());
  }

  restartCurrentPuzzle() {
    this.scene.restart({ puzzleIndex: this.currentPuzzleIndex });
  }

  goToNextPuzzle() {
    const total = getPuzzleCount();
    if (total <= 0) return;
    const nextIndex = (this.currentPuzzleIndex + 1) % total;
    this.scene.restart({ puzzleIndex: nextIndex });
  }

  stopSingleHeadAnimation() {
    if (this.singleHeadTween) {
      this.singleHeadTween.stop();
      this.singleHeadTween = null;
    }
    this.singleHeadTile = null;
  }
}
