import assert from 'node:assert/strict';
import { InputManager } from '../src/game/InputManager';
import { Tile } from '../src/game/Tile';

type Harness = {
  manager: InputManager<{ word: string }>;
  a: Tile;
  b: Tile;
  c: Tile;
  d: Tile;
  e: Tile;
  invalidChains: string[];
  foundWords: string[];
  pendingActions: string[];
};

function createHarness(): Harness {
  const a = new Tile(0, 0, 'A');
  const b = new Tile(0, 1, 'B');
  const c = new Tile(3, 3, 'C');
  const d = new Tile(0, 2, 'D');
  const e = new Tile(1, 1, 'E');
  const tiles = [a, b, c, d, e];

  const centers = new Map<Tile, { x: number; y: number }>([
    [a, { x: 0, y: 0 }],
    [b, { x: 20, y: 0 }],
    [c, { x: 200, y: 200 }],
    [d, { x: 40, y: 0 }],
    [e, { x: 20, y: 20 }]
  ]);

  const invalidChains: string[] = [];
  const foundWords: string[] = [];
  const pendingActions: string[] = [];

  const manager = new InputManager<{ word: string }>({
    tiles,
    hitRadius: 10,
    swipeThreshold: 12,
    getTileCenter: (tile) => centers.get(tile)!,
    validWordLengths: new Set([2, 3]),
    findMatch: (word) => (word === 'AB' || word === 'ABE' ? { word } : null),
    events: {
      onWordFound: (match) => {
        foundWords.push(match.word);
      },
      onInvalidWord: (chain) => {
        invalidChains.push(chain.map((tile) => tile.letter).join(''));
      },
      onChainChanged: () => {},
      onPendingActionChanged: (pending) => {
        pendingActions.push(pending?.type ?? 'null');
      }
    }
  });

  return { manager, a, b, c, d, e, invalidChains, foundWords, pendingActions };
}

function chain(h: Harness): string[] {
  return h.manager.getChain().map((tile) => tile.letter);
}

function testTapSelectionAndSubmission(): void {
  const h = createHarness();

  h.manager.onPointerDown(0, 0, 0);
  h.manager.onPointerUp(0);
  assert.deepEqual(chain(h), ['A']);

  h.manager.onPointerDown(0, 20, 0);
  h.manager.onPointerUp(0);
  assert.deepEqual(chain(h), ['A', 'B']);
  assert.deepEqual(h.foundWords, ['AB']);
}

function testTapOutsideClearsSelection(): void {
  const h = createHarness();
  h.manager.onPointerDown(0, 0, 0);
  h.manager.onPointerUp(0);
  assert.deepEqual(chain(h), ['A']);

  h.manager.onPointerDown(0, 120, 120); // miss all hitboxes
  h.manager.onPointerUp(0);
  assert.deepEqual(chain(h), []);
}

function testTapLastRemovesAndTapPreviousBacktracks(): void {
  const h = createHarness();

  h.manager.onPointerDown(0, 0, 0);
  h.manager.onPointerUp(0); // A
  h.manager.onPointerDown(0, 20, 0);
  h.manager.onPointerUp(0); // AB
  h.manager.onPointerDown(0, 20, 20);
  h.manager.onPointerUp(0); // ABE

  assert.deepEqual(chain(h), ['A', 'B', 'E']);

  h.manager.onPointerDown(0, 20, 20); // tap last -> remove
  h.manager.onPointerUp(0);
  assert.deepEqual(chain(h), ['A', 'B']);

  h.manager.onPointerDown(0, 0, 0); // tap previous (index 0) -> backtrack
  h.manager.onPointerUp(0);
  assert.deepEqual(chain(h), ['A']);
}

function testTapNonAdjacentStartsNewChain(): void {
  const h = createHarness();

  h.manager.onPointerDown(0, 0, 0);
  h.manager.onPointerUp(0); // A
  h.manager.onPointerDown(0, 200, 200); // C non-adjacent to A
  h.manager.onPointerUp(0);

  assert.deepEqual(chain(h), ['C']);
}

function testPendingThresholdTransition(): void {
  const h = createHarness();

  h.manager.onPointerDown(0, 0, 0);
  assert.equal(h.manager.getState(), 'PENDING');
  assert.deepEqual(chain(h), []);

  h.manager.onPointerMove(0, 5, 5, true); // below threshold
  assert.equal(h.manager.getState(), 'PENDING');
  assert.deepEqual(chain(h), []);

  h.manager.onPointerMove(0, 0, 13, true); // crosses threshold
  assert.equal(h.manager.getState(), 'SWIPING');
  assert.deepEqual(chain(h), ['A']);
}

function testSwipeAddBacktrackIgnoreLoopAndNonAdjacent(): void {
  const h = createHarness();

  h.manager.onPointerDown(0, 0, 0);
  h.manager.onPointerMove(0, 0, 13, true); // apply pending add(A)
  h.manager.onPointerMove(0, 20, 0, true); // add B
  h.manager.onPointerMove(0, 20, 20, true); // add E (adjacent to B)
  assert.deepEqual(chain(h), ['A', 'B', 'E']);

  h.manager.onPointerMove(0, 20, 0, true); // second-to-last -> remove E
  assert.deepEqual(chain(h), ['A', 'B']);

  h.manager.onPointerMove(0, 20, 20, true); // add E again
  assert.deepEqual(chain(h), ['A', 'B', 'E']);

  h.manager.onPointerMove(0, 0, 0, true); // earlier tile (not second-to-last) -> ignore
  assert.deepEqual(chain(h), ['A', 'B', 'E']);

  h.manager.onPointerMove(0, 20, 0, true); // second-to-last -> remove E
  assert.deepEqual(chain(h), ['A', 'B']);

  h.manager.onPointerMove(0, 200, 200, true); // non-adjacent -> ignore
  assert.deepEqual(chain(h), ['A', 'B']);
}

function testSwipeEndInvalidDoesNotClear(): void {
  const h = createHarness();

  h.manager.onPointerDown(0, 0, 0);
  h.manager.onPointerMove(0, 0, 13, true); // SWIPING + A
  h.manager.onPointerMove(0, 20, 20, true); // add E -> "AE" invalid
  assert.deepEqual(chain(h), ['A', 'E']);

  h.manager.onPointerUp(0);
  assert.deepEqual(h.invalidChains, ['AE']);
  assert.deepEqual(chain(h), ['A', 'E']);
  assert.equal(h.manager.getState(), 'IDLE');
}

function testSwipeEndValidFound(): void {
  const h = createHarness();

  h.manager.onPointerDown(0, 0, 0);
  h.manager.onPointerMove(0, 0, 13, true); // SWIPING + A
  h.manager.onPointerMove(0, 20, 0, true); // add B -> "AB"
  h.manager.onPointerUp(0);

  assert.deepEqual(h.foundWords, ['AB']);
  assert.equal(h.manager.getState(), 'IDLE');
}

function testTapSubmitOnlyOnValidLengths(): void {
  const h = createHarness();

  h.manager.onPointerDown(0, 0, 0);
  h.manager.onPointerUp(0); // len 1, no submit
  assert.deepEqual(h.foundWords, []);

  h.manager.onPointerDown(0, 20, 0);
  h.manager.onPointerUp(0); // len 2, submit AB
  assert.deepEqual(h.foundWords, ['AB']);
}

function testDeactivatedTileActsAsClearTarget(): void {
  const h = createHarness();
  h.b.deactivated = true;

  h.manager.onPointerDown(0, 0, 0);
  h.manager.onPointerUp(0);
  assert.deepEqual(chain(h), ['A']);

  h.manager.onPointerDown(0, 20, 0); // b is deactivated -> pending clear
  h.manager.onPointerUp(0);
  assert.deepEqual(chain(h), []);
}

function testMultiTouchIgnored(): void {
  const h = createHarness();

  h.manager.onPointerDown(1, 0, 0);
  h.manager.onPointerMove(1, 0, 20, true);
  h.manager.onPointerUp(1);
  assert.deepEqual(chain(h), []);
  assert.equal(h.manager.getState(), 'IDLE');
}

function testPendingActionSignals(): void {
  const h = createHarness();

  h.manager.onPointerDown(0, 0, 0);
  h.manager.onPointerUp(0);
  h.manager.onPointerDown(0, 20, 0);
  h.manager.onPointerUp(0);
  h.manager.onPointerDown(0, 20, 0); // remove_last
  h.manager.onPointerUp(0);

  assert.ok(h.pendingActions.includes('add'));
  assert.ok(h.pendingActions.includes('remove_last'));
  assert.ok(h.pendingActions.includes('null'));
}

function run(): void {
  testTapSelectionAndSubmission();
  testTapOutsideClearsSelection();
  testTapLastRemovesAndTapPreviousBacktracks();
  testTapNonAdjacentStartsNewChain();
  testPendingThresholdTransition();
  testSwipeAddBacktrackIgnoreLoopAndNonAdjacent();
  testSwipeEndInvalidDoesNotClear();
  testSwipeEndValidFound();
  testTapSubmitOnlyOnValidLengths();
  testDeactivatedTileActsAsClearTarget();
  testMultiTouchIgnored();
  testPendingActionSignals();
  console.log('Selection state-machine tests passed (full mechanics matrix).');
}

run();
