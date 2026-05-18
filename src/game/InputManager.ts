import { Tile } from './Tile';

export type InputState = 'IDLE' | 'PENDING' | 'SWIPING';

export type PendingAction =
  | { type: 'add'; tile: Tile }
  | { type: 'remove_last' }
  | { type: 'backtrack'; backtrackTo: number }
  | { type: 'new_chain'; tile: Tile }
  | { type: 'clear' };

export type WordMatch = {
  word: string;
};

export type InputManagerEvents<TMatch = WordMatch> = {
  onWordFound: (match: TMatch) => void;
  onInvalidWord: (chain: Tile[]) => void;
  onChainChanged: (chain: Tile[]) => void;
  onPendingActionChanged?: (pending: PendingAction | null) => void;
};

export type InputManagerOptions<TMatch = WordMatch> = {
  tiles: Tile[];
  hitRadius: number;
  swipeThreshold?: number;
  getTileCenter: (tile: Tile) => { x: number; y: number };
  validWordLengths: Set<number>;
  findMatch: (word: string) => TMatch | null;
  events: InputManagerEvents<TMatch>;
  haptics?: {
    light: () => void;
  };
};

export class InputManager<TMatch = WordMatch> {
  private readonly tiles: Tile[];
  private readonly hitRadius: number;
  private readonly swipeThreshold: number;
  private readonly getTileCenter: (tile: Tile) => { x: number; y: number };
  private readonly validWordLengths: Set<number>;
  private readonly findMatch: (word: string) => TMatch | null;
  private readonly events: InputManagerEvents<TMatch>;
  private readonly haptics?: { light: () => void };

  private state: InputState = 'IDLE';
  private pendingAction: PendingAction | null = null;
  private downOrigin: { x: number; y: number } | null = null;
  private chain: Tile[] = [];

  constructor(options: InputManagerOptions<TMatch>) {
    this.tiles = options.tiles;
    this.hitRadius = options.hitRadius;
    this.swipeThreshold = options.swipeThreshold ?? 12;
    this.getTileCenter = options.getTileCenter;
    this.validWordLengths = options.validWordLengths;
    this.findMatch = options.findMatch;
    this.events = options.events;
    this.haptics = options.haptics;
  }

  getState(): InputState {
    return this.state;
  }

  getChain(): Tile[] {
    return [...this.chain];
  }

  onPointerDown(pointerId: number, x: number, y: number): void {
    if (pointerId !== 0) return;

    const tile = this.tileAtPoint(x, y);
    this.downOrigin = { x, y };
    this.state = 'PENDING';

    if (!tile || tile.deactivated) {
      this.setPendingAction({ type: 'clear' });
      return;
    }

    if (this.chain.length === 0) {
      this.setPendingAction({ type: 'add', tile });
      return;
    }

    const idx = this.chain.indexOf(tile);
    if (idx === this.chain.length - 1) {
      this.setPendingAction({ type: 'remove_last' });
      return;
    }

    if (idx >= 0) {
      this.setPendingAction({ type: 'backtrack', backtrackTo: idx });
      return;
    }

    if (this.isAdjacent(this.chain[this.chain.length - 1], tile)) {
      this.setPendingAction({ type: 'add', tile });
      return;
    }

    this.setPendingAction({ type: 'new_chain', tile });
  }

  onPointerMove(pointerId: number, x: number, y: number, isDown: boolean): void {
    if (pointerId !== 0) return;
    if (this.state === 'IDLE') return;
    if (!isDown) return;

    if (this.state === 'PENDING') {
      const displacement = this.getDisplacementFromDown(x, y);
      if (displacement < this.swipeThreshold) {
        return;
      }

      this.applyPendingAction('swipe');
      this.state = 'SWIPING';
    }

    if (this.state !== 'SWIPING') return;

    const tile = this.tileAtPoint(x, y);
    if (!tile || tile.deactivated) {
      return;
    }

    const last = this.chain[this.chain.length - 1];
    if (!last) return;

    if (tile === last) return;

    const idx = this.chain.indexOf(tile);
    if (this.chain.length >= 2 && idx === this.chain.length - 2) {
      this.removeLast();
      return;
    }

    if (idx >= 0) {
      return;
    }

    if (this.isAdjacent(last, tile)) {
      this.addToChain(tile);
    }
  }

  onPointerUp(pointerId: number): void {
    if (pointerId !== 0) return;

    if (this.state === 'PENDING') {
      this.applyPendingAction('tap');
      this.state = 'IDLE';
      this.downOrigin = null;
      return;
    }

    if (this.state === 'SWIPING') {
      this.attemptSubmit(true);
      this.state = 'IDLE';
      this.downOrigin = null;
      this.setPendingAction(null);
      return;
    }

    this.downOrigin = null;
    this.setPendingAction(null);
  }

  clearChain(): void {
    if (this.chain.length === 0) return;
    this.chain = [];
    this.events.onChainChanged(this.getChain());
  }

  private setPendingAction(pending: PendingAction | null): void {
    this.pendingAction = pending;
    this.events.onPendingActionChanged?.(pending);
  }

  private applyPendingAction(source: 'tap' | 'swipe'): void {
    if (!this.pendingAction) return;

    const pending = this.pendingAction;
    this.setPendingAction(null);

    switch (pending.type) {
      case 'clear':
        this.clearChain();
        break;
      case 'add':
        this.addToChain(pending.tile);
        if (source === 'tap') {
          this.attemptSubmitIfTapLengthMatches();
        }
        break;
      case 'remove_last':
        this.removeLast();
        break;
      case 'backtrack':
        this.backtrackTo(pending.backtrackTo);
        break;
      case 'new_chain':
        this.clearChain();
        this.addToChain(pending.tile);
        if (source === 'tap') {
          this.attemptSubmitIfTapLengthMatches();
        }
        break;
    }
  }

  private addToChain(tile: Tile): void {
    this.chain.push(tile);
    this.haptics?.light();
    this.events.onChainChanged(this.getChain());
  }

  private removeLast(): void {
    if (this.chain.length === 0) return;
    this.chain.pop();
    this.haptics?.light();
    this.events.onChainChanged(this.getChain());
  }

  private backtrackTo(index: number): void {
    if (index < 0 || index >= this.chain.length) return;
    this.chain = this.chain.slice(0, index + 1);
    this.haptics?.light();
    this.events.onChainChanged(this.getChain());
  }

  private attemptSubmitIfTapLengthMatches(): void {
    if (this.validWordLengths.has(this.chain.length)) {
      this.attemptSubmit(false);
    }
  }

  private attemptSubmit(swipeEnd: boolean): void {
    if (this.chain.length === 0) return;

    const word = this.chain.map((tile) => tile.letter).join('');
    const match = this.findMatch(word);

    if (match) {
      this.events.onWordFound(match);
      return;
    }

    if (swipeEnd) {
      this.events.onInvalidWord(this.getChain());
    }
  }

  private tileAtPoint(x: number, y: number): Tile | null {
    for (const tile of this.tiles) {
      if (tile.deactivated) continue;
      const center = this.getTileCenter(tile);
      const dx = x - center.x;
      const dy = y - center.y;
      if (Math.sqrt(dx * dx + dy * dy) <= this.hitRadius) {
        return tile;
      }
    }
    return null;
  }

  private getDisplacementFromDown(x: number, y: number): number {
    if (!this.downOrigin) return 0;
    const dx = x - this.downOrigin.x;
    const dy = y - this.downOrigin.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private isAdjacent(a: Tile, b: Tile): boolean {
    return Math.abs(a.col - b.col) <= 1 && Math.abs(a.row - b.row) <= 1 && a !== b;
  }
}
