import Phaser from 'phaser';
import { Share } from '@capacitor/share';
import { getDailyPuzzleIndex, getPuzzleAtIndex, getPuzzleCount } from '../game/PuzzleLoader';
import { t } from '../utils/i18n';
import { getActiveSkinId, recordPuzzleCompletion, type ProgressSnapshot } from '../services/ProgressService';
import { maybeShowInterstitial } from '../services/AdService';
import { buildGridTiles } from '../game/Grid';
import { puzzleCoordToGridCoord } from '../game/coordMap';
import { getSkinById, type Skin } from '../game/SkinManager';
import { InputManager, type PendingAction } from '../game/InputManager';
import {
  applySolvedPart,
  buildTileOwnership,
  type PartOwnershipEntry,
  type TileOwnershipState
} from '../game/tileOwnership';
import { Tile } from '../game/Tile';
import { FONT_FAMILY } from '../skins/registry';
import { drawBackground, renderGridAmbient } from '../game/renderers/BackgroundRenderer';
import { styleHintCompleted, styleHintEmpty, styleHintSolved } from '../game/renderers/HintRenderer';
import {
  drawTileDeactivated,
  applyLetterStyle,
  drawTileFace
} from '../game/renderers/TileRenderer';
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
  bg: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  answer: Answer;
  cells: Array<{
    bg: Phaser.GameObjects.Graphics;
    text: Phaser.GameObjects.Text;
    partIndex: number;
    charIndex: number;
  }>;
};

type TileFaceFx = {
  textureKey: string;
};

type WinStats = {
  solvedCount: string;
  bestTime: string;
  streak: string;
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
  TILE_VISUAL = 0;
  HIT_RADIUS = 68;
  boardLeft = 0;
  boardTop = 0;
  boardRight = 0;
  boardBottom = 0;

  solvedPartIds: Set<string> = new Set();
  solvedAnswers: Set<string> = new Set();
  foundPendingTiles: Set<Tile> = new Set();
  partEntriesById: Map<string, PartEntry> = new Map();
  answerWordToDisplay: Map<string, string> = new Map();
  partIdsByAnswerDisplay: Map<string, string[]> = new Map();
  ownershipState!: TileOwnershipState;
  private tileFaceTextures: Map<Tile, TileFaceFx> = new Map();

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
  skin: Skin = getSkinById('void');

  private tileGlows: Map<Tile, Phaser.FX.Glow> = new Map();

  async create(data?: { puzzleIndex?: number }) {
    const activeSkinId = await getActiveSkinId();
    this.skin = getSkinById(activeSkinId);

    this.currentPuzzleIndex = data?.puzzleIndex ?? getDailyPuzzleIndex();
    this.puzzle = getPuzzleAtIndex(this.currentPuzzleIndex);
    const levelNumber = this.currentPuzzleIndex + 1;
    this.startTimeMs = Date.now();

    this.cameras.main.setBackgroundColor(this.skin.background.edgeColor);
    drawBackground(this, this.skin);

    // Update text styles using skin colors:

    this.add.text(42, 50, '☰', {
      color: this.skin.chrome.menuColor,
      fontFamily: "'Space Mono', ui-monospace, monospace",
      fontSize: '26px'
    }).setOrigin(0.5);

    this.levelText = this.add.text(this.scale.width / 2, 50, `Level ${levelNumber}`, {
      color: this.skin.chrome.levelColor,
      fontFamily: "'Space Mono', ui-monospace, monospace",
      fontSize: '22px'
    }).setOrigin(0.5, 0.5);

    this.timerText = this.add.text(this.scale.width - 80, 50, '0:00', {
      color: this.skin.chrome.timerColor,
      fontFamily: "'Space Mono', ui-monospace, monospace",
      fontSize: '28px'
    }).setOrigin(1, 0.5);

    const titleGlow = Phaser.Display.Color.HexStringToColor(this.skin.chrome.titleGlowColor);
    const titleGlowColor = `rgba(${titleGlow.red},${titleGlow.green},${titleGlow.blue},${this.skin.chrome.titleGlowAlpha})`;

    this.add.text(this.scale.width / 2, 110, t(this.puzzle.name), {
      color: this.skin.chrome.titleColor,
      fontFamily: "'Space Mono', ui-monospace, monospace",
      fontSize: '48px',
      align: 'center',
      wordWrap: { width: 900 },
      shadow: {
        offsetX: 0, offsetY: 0,
        color: titleGlowColor,
        blur: 40, fill: true
      }
    }).setOrigin(0.5);

    if (this.puzzle.hint) {
      this.add.text(this.scale.width / 2, 175, t(this.puzzle.hint), {
        color: this.skin.chrome.hintTextColor,
        fontFamily: "'Space Mono', ui-monospace, monospace",
        fontSize: '24px',
        align: 'center',
        wordWrap: { width: 900 }
      }).setOrigin(0.5);
    }

    this.CELL_SIZE = Math.floor(Math.min(this.scale.width, this.scale.height) * 0.22);
    this.HIT_RADIUS = this.CELL_SIZE * 0.38;
    const TILE_VISUAL = Math.round(this.CELL_SIZE * 0.88);
    this.TILE_VISUAL = TILE_VISUAL;
    const gridW = this.CELL_SIZE * 4;
    const gridH = this.CELL_SIZE * 4;
    this.boardLeft = (this.scale.width - gridW) / 2;
    this.boardTop = 330;
    this.boardRight = this.boardLeft + gridW;
    this.boardBottom = this.boardTop + gridH;

    renderGridAmbient(
      this,
      this.boardLeft + gridW / 2,
      this.boardTop + gridH / 2,
      this.skin
    );

    this.tileGrid = buildGridTiles(this.puzzle.grid);
    this.allTiles = this.tileGrid.flat();
    this.tileByCoord.clear();
    for (const tile of this.allTiles) {
      this.tileByCoord.set(tile.coord, tile);
    }

    this.buildPartMetadata();
    this.tileSprites.clear();
    this.tileLetters.clear();
    this.tileGlows.clear();
    this.tileFaceTextures.clear();

    for (const tile of this.allTiles) {
      const x = this.boardLeft + tile.col * this.CELL_SIZE + this.CELL_SIZE / 2;
      const y = this.boardTop + tile.row * this.CELL_SIZE + this.CELL_SIZE / 2;
      const container = this.add.container(x, y).setDepth(10);
      const faceGfx = this.add.image(0, 0, '__MISSING');
      faceGfx.setData('size', this.TILE_VISUAL);
      const letter = this.add.text(0, 1, tile.letter, {
        fontFamily: "'Space Mono', ui-monospace, monospace",
        fontSize: `${Math.round(this.TILE_VISUAL * 0.49)}px`,
        fontStyle: 'bold',
        color: this.skin.tiles.idle.letterColor,
      }).setOrigin(0.5, 0.5);

      drawTileFace(faceGfx, this.skin.tiles.idle, this.TILE_VISUAL);

      container.add([faceGfx, letter]);

      this.tileFaceTextures.set(tile, { textureKey: faceGfx.texture.key });
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
    this.foundPendingTiles.clear();

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
    const sectionTop = this.boardBottom + 78;
    const answers = [...(this.puzzle.answers as Answer[])].sort((a, b) =>
      a.display.localeCompare(b.display)
    );

    const maxRowWidth = this.scale.width - 120;
    const rowGap = 22;
    const slotW = Math.round(this.TILE_VISUAL * 0.34);
    const slotH = Math.round(this.TILE_VISUAL * 0.50);
    const cellGap = Math.max(3, Math.round(this.CELL_SIZE * 0.03));
    const partGap = Math.round(slotW * 0.55);
    const answerGap = Math.round(slotW * 1.2);
    const startX = (this.scale.width - maxRowWidth) / 2;

    let cursorX = startX;
    let rowIndex = 0;

    this.hintRows = [];

    for (const answer of answers) {
      const partWidths = answer.parts.map((part) => {
        return part.word.length * slotW + (part.word.length - 1) * cellGap;
      });
      const width = partWidths.reduce((sum, w) => sum + w, 0) + partGap * (partWidths.length - 1);

      if (cursorX > startX && cursorX + width > startX + maxRowWidth) {
        rowIndex += 1;
        cursorX = startX;
      }

      const centerY = sectionTop + rowIndex * (slotH + rowGap);
      const row: HintRow = { 
        answer, 
        cells: [], 
        bg: this.add.graphics(), 
        text: this.add.text(0, 0, '') 
      };

      let cellX = cursorX;
      answer.parts.forEach((part, partIndex) => {
        for (let charIndex = 0; charIndex < part.word.length; charIndex++) {
          const centerX = cellX + slotW / 2;
          const bg = this.add.graphics().setPosition(centerX, centerY);
          bg.setData('width', slotW);
          bg.setData('height', slotH);
          bg.setData('radius', Math.round(slotW * 0.22));
          styleHintEmpty(bg, this.skin);

          const text = this.add.text(centerX, centerY, '', {
            color: this.skin.hints.empty.letterColor,
            fontFamily: FONT_FAMILY,
            fontSize: `${Math.round(slotH * 0.46)}px`
          }).setOrigin(0.5);

          row.cells.push({ bg, text, partIndex, charIndex });
          cellX += slotW + cellGap;
        }

        if (partIndex < answer.parts.length - 1) {
          cellX += partGap - cellGap;
        }
      });

      this.hintRows.push(row);
      this.refreshHintRow(answer.display);
      cursorX += width + answerGap;
    }
  }

  getPartId(answer: Answer, index: number): string {
    return `${answer.display}::${index}`;
  }

  refreshHintRow(answerDisplay: string) {
    const row = this.hintRows.find((h) => h.answer.display === answerDisplay);
    if (!row) return;

    for (const cell of row.cells) {
      const part = row.answer.parts[cell.partIndex];
      const partId = this.getPartId(row.answer, cell.partIndex);
      const solved = this.solvedPartIds.has(partId);
      cell.text.setText(solved ? part.word[cell.charIndex] ?? '' : '');

      if (solved) {
        styleHintSolved(cell.bg, this.skin);
        cell.text.setColor(this.skin.hints.solved.letterColor);
      } else {
        styleHintEmpty(cell.bg, this.skin);
        cell.text.setColor(this.skin.hints.empty.letterColor);
      }
    }

    const allSolved = row.answer.parts.every((_, index) => {
      const partId = this.getPartId(row.answer, index);
      return this.solvedPartIds.has(partId);
    });

    if (allSolved) {
      this.solvedAnswers.add(answerDisplay);
      styleHintCompleted(row.bg);
      row.text.setColor(this.skin.hints.solved.letterColor);
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
      const deactivatedSet = new Set(deactivatedCoords);

      for (const coord of entry.path) {
        if (deactivatedSet.has(coord)) {
          this.deactivateTile(coord);
        } else {
          this.markTileFoundPending(coord);
        }
      }
    }

    this.refreshHintRow(match.answerDisplay);

    if (this.solvedAnswers.size === this.puzzle.answers.length) {
      const elapsedSec = Math.floor((Date.now() - this.startTimeMs) / 1000);
      void recordPuzzleCompletion(this.puzzle.id, elapsedSec)
        .then((snapshot) => {
          void maybeShowInterstitial(snapshot.solvedCount);
          this.updateWinPopupStats(this.formatWinStats(snapshot));
        })
        .catch((error) => {
          console.warn('Failed to persist puzzle progress', error);
        });
      this.showWinPopup();
    }
  }

  markTileFoundPending(coord: string) {
    const tile = this.tileByCoord.get(coord);
    if (!tile || tile.deactivated) return;

    const sprite = this.tileSprites.get(tile);
    const letter = this.tileLetters.get(tile);
    if (!sprite || !letter) return;

    const faceGfx = sprite.list[0] as Phaser.GameObjects.Graphics;
    this.foundPendingTiles.add(tile);
    drawTileFace(faceGfx, this.skin.tiles.foundPending, this.TILE_VISUAL);
    applyLetterStyle(letter, this.skin.tiles.foundPending);
    sprite.setAlpha(0.75);
    letter.setAlpha(0.8);
  }

  deactivateTile(coord: string) {
    const tile = this.tileByCoord.get(coord);
    if (!tile || tile.deactivated) return;

    const sprite = this.tileSprites.get(tile);
    const letter = this.tileLetters.get(tile);
    if (!sprite) return;

    tile.deactivated = true;
    this.foundPendingTiles.delete(tile);
    if (letter) {
      drawTileDeactivated(letter, this.skin);
    }
    drawTileDeactivated(sprite, this.skin);

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
    const chain = _chain.filter((tile) => !tile.deactivated);
    if (chain.length === 0) return;

    const targets: Array<Phaser.GameObjects.Container | Phaser.GameObjects.Text> = [];
    const baseX = new Map<Phaser.GameObjects.Container | Phaser.GameObjects.Text, number>();

    for (const tile of chain) {
      const sprite = this.tileSprites.get(tile);
      const letter = this.tileLetters.get(tile);
      if (sprite) {
        targets.push(sprite);
        baseX.set(sprite, sprite.x);
      }
      if (letter) {
        targets.push(letter);
        baseX.set(letter, letter.x);
      }
    }

    if (targets.length === 0) return;

    for (const target of targets) {
      this.tweens.killTweensOf(target);
      const x = baseX.get(target);
      if (typeof x === 'number') target.x = x;
    }

    const strength = this.CELL_SIZE * 0.04;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 220,
      onUpdate: (tween) => {
        const p = tween.getValue() as number;
        const wave = Math.sin(p * Math.PI * 8) * (1 - p);
        for (const target of targets) {
          const x = baseX.get(target);
          if (typeof x === 'number') target.x = x + wave * strength;
        }
      },
      onComplete: () => {
        for (const target of targets) {
          const x = baseX.get(target);
          if (typeof x === 'number') target.x = x;
        }
      }
    });
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
    if (tile.deactivated) return;

    const container = this.tileSprites.get(tile);
    const letter    = this.tileLetters.get(tile);
    if (!container) return;

    const faceGfx = container.list[0] as Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
    const state = on ? this.skin.tiles.selected : this.skin.tiles.idle;

    drawTileFace(faceGfx, state, this.TILE_VISUAL);
    if (letter)  applyLetterStyle(letter, state);

    if (on) {
      this.tweens.add({
        targets: container, scaleX: 1.06, scaleY: 1.06,
        duration: 80, ease: 'Quad.Out'
      });
    } else {
      this.tweens.add({
        targets: container, scaleX: 1.0, scaleY: 1.0,
        duration: 60, ease: 'Quad.Out'
      });
    }
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

      const color = this.skin.path.color;
      this.stopSingleHeadAnimation();
      this.singleHeadTile = tile;
      this.drawSingleHead(sprite.x, sprite.y, color, 1, 1);
      this.updateNearWordPulse(chain);
      this.lastPathChain = [...chain];
      return;
    }

    if (!isBacktrack) {
      this.pathHeadGraphics.clear();
    }

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
      // Draw the full removed segment immediately to avoid a one-frame gap before tween updates.
      this.pathHeadGraphics.clear();
      if (prevPoints.length >= 2) {
        this.drawSegment(
          this.pathHeadGraphics,
          prevPoints[prevPoints.length - 2],
          prevPoints[prevPoints.length - 1],
          prevSegmentColors[prevSegmentColors.length - 1],
          1,
          1,
          1
        );
      }
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
      this.drawSingleHead(sprite.x, sprite.y, this.skin.path.color, this.nearWordPulseScale, 1);
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
    for (let i = 1; i < points.length; i++) {
      colors.push(this.skin.path.color);
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
    // Do not clear graphics here; let the animation handle it

    if (points.length === 0) return;

    if (points.length === 1) {
      const color = this.skin.path.color;
      const pulse = { scale: 1, alpha: 1 };
      this.pathDisappearTween = this.tweens.add({
        targets: pulse,
        scale: 0,
        alpha: 0.9,
        duration: 180,
        ease: 'Cubic.In',
        onUpdate: () => {
          this.pathHeadGraphics.clear();
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
        this.pathGraphics.clear();
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

    const p = this.skin.path;
    const haloWidth = (this.CELL_SIZE * 0.27) * widthScale;
    const bodyWidth = (this.CELL_SIZE * 0.09) * widthScale;
    const coreWidth = (this.CELL_SIZE * 0.028) * widthScale;
    const ribbonRadius = bodyWidth * 0.5;
    const toX = from.x + (to.x - from.x) * progress;
    const toY = from.y + (to.y - from.y) * progress;

    g.lineStyle(haloWidth, color, p.halo.alpha * alpha);
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.lineTo(toX, toY);
    g.strokePath();

    g.lineStyle(bodyWidth, color, p.body.alpha * alpha);
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.lineTo(toX, toY);
    g.strokePath();

    g.lineStyle(coreWidth, color, p.core.alpha * alpha);
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.lineTo(toX, toY);
    g.strokePath();

    g.fillStyle(color, p.body.alpha * alpha);
    g.fillCircle(from.x, from.y, ribbonRadius);
    g.fillCircle(toX, toY, ribbonRadius);

    g.fillStyle(color, p.core.alpha * alpha);
    g.fillCircle(from.x, from.y, Math.max(2, coreWidth * 0.75));
    g.fillCircle(toX, toY, Math.max(2, coreWidth * 0.75));
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

    const p = this.skin.path;
    const bodyWidth = this.CELL_SIZE * 0.09;
    const coreWidth = this.CELL_SIZE * 0.028;
    const radius = bodyWidth * 0.5 * scale;
    this.pathHeadGraphics.fillStyle(color, p.endpoint.alpha * alpha);
    this.pathHeadGraphics.fillCircle(x, y, radius);

    this.pathHeadGraphics.fillStyle(color, Math.min(1, p.core.alpha * alpha));
    this.pathHeadGraphics.fillCircle(x, y, Math.max(2, coreWidth * 0.75) * scale);
  }

  formatElapsedTime(elapsedSec: number): string {
    const minutes = Math.floor(elapsedSec / 60);
    const seconds = elapsedSec % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  formatWinStats(snapshot: ProgressSnapshot): WinStats {
    return {
      solvedCount: String(snapshot.solvedCount),
      bestTime: snapshot.bestTimeSec === null ? '--' : this.formatElapsedTime(snapshot.bestTimeSec),
      streak: `${snapshot.currentStreak} (best ${snapshot.bestStreak})`
    };
  }

  updateWinPopupStats(stats: WinStats) {
    if (!this.winPopup) return;
    const solvedText = this.winPopup.getByName('win-stats-solved') as Phaser.GameObjects.Text | null;
    const bestText = this.winPopup.getByName('win-stats-best') as Phaser.GameObjects.Text | null;
    const streakText = this.winPopup.getByName('win-stats-streak') as Phaser.GameObjects.Text | null;

    solvedText?.setText(`Solved Total  ${stats.solvedCount}`);
    bestText?.setText(`Best Time  ${stats.bestTime}`);
    streakText?.setText(`Streak  ${stats.streak}`);
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
      color: this.skin.hints.solved.letterColor,
      fontFamily: FONT_FAMILY,
      fontSize: '56px'
    }).setOrigin(0.5).setDepth(122);

    const timeLabel = this.add.text(this.scale.width / 2, this.scale.height / 2 - 40, 'Final Time  ' + finalTime, {
      color: '#ffffff',
      fontFamily: FONT_FAMILY,
      fontSize: '36px'
    }).setOrigin(0.5).setDepth(122);

    const solvedStatsLabel = this.add.text(this.scale.width / 2, this.scale.height / 2 + 22, 'Solved Total  --', {
      color: '#c6d0dd',
      fontFamily: FONT_FAMILY,
      fontSize: '24px'
    }).setOrigin(0.5).setDepth(122).setName('win-stats-solved');

    const bestTimeLabel = this.add.text(this.scale.width / 2, this.scale.height / 2 + 54, 'Best Time  --', {
      color: '#c6d0dd',
      fontFamily: FONT_FAMILY,
      fontSize: '24px'
    }).setOrigin(0.5).setDepth(122).setName('win-stats-best');

    const streakLabel = this.add.text(this.scale.width / 2, this.scale.height / 2 + 86, 'Streak  --', {
      color: '#c6d0dd',
      fontFamily: FONT_FAMILY,
      fontSize: '24px'
    }).setOrigin(0.5).setDepth(122).setName('win-stats-streak');

    const restartBtn = this.add
      .rectangle(this.scale.width / 2 - 170, this.scale.height / 2 + 162, 280, 92, 0x1f2a3d, 1)
      .setStrokeStyle(2, 0x4a90d9)
      .setDepth(122)
      .setInteractive({ useHandCursor: true });
    const restartText = this.add.text(this.scale.width / 2 - 170, this.scale.height / 2 + 162, 'Restart', {
      color: '#e7f0ff',
      fontFamily: FONT_FAMILY,
      fontSize: '32px'
    }).setOrigin(0.5).setDepth(123);

    const nextBtn = this.add
      .rectangle(this.scale.width / 2 + 170, this.scale.height / 2 + 162, 280, 92, 0x1f3d26, 1)
      .setStrokeStyle(2, 0x27ae60)
      .setDepth(122)
      .setInteractive({ useHandCursor: true });
    const nextText = this.add.text(this.scale.width / 2 + 170, this.scale.height / 2 + 162, 'Next Level', {
      color: '#e9ffe9',
      fontFamily: FONT_FAMILY,
      fontSize: '32px'
    }).setOrigin(0.5).setDepth(123);

    const shareBtn = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2 + 270, 580, 84, 0x2d1f3d, 1)
      .setStrokeStyle(2, 0x8f5bd1)
      .setDepth(122)
      .setInteractive({ useHandCursor: true });
    const shareText = this.add.text(this.scale.width / 2, this.scale.height / 2 + 270, 'Share Result', {
      color: '#f0e7ff',
      fontFamily: FONT_FAMILY,
      fontSize: '30px'
    }).setOrigin(0.5).setDepth(123);

    const group = this.add.container(0, 0, [
      overlay,
      panel,
      title,
      timeLabel,
      solvedStatsLabel,
      bestTimeLabel,
      streakLabel,
      restartBtn,
      restartText,
      nextBtn,
      nextText,
      shareBtn,
      shareText
    ]);
    group.setDepth(120);
    this.winPopup = group;

    restartBtn.on('pointerdown', () => this.restartCurrentPuzzle());
    nextBtn.on('pointerdown', () => this.goToNextPuzzle());
    shareBtn.on('pointerdown', () => {
      void this.shareWinResult(finalTime);
    });
  }

  async shareWinResult(finalTime: string) {
    const message = `I solved ${t(this.puzzle.name)} in ${finalTime} on GlitchSalad.`;
    try {
      const canShare = await Share.canShare();
      if (!canShare.value) return;

      await Share.share({
        title: 'GlitchSalad',
        text: message,
        dialogTitle: 'Share your result'
      });
    } catch (error) {
      console.warn('Share failed', error);
    }
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
