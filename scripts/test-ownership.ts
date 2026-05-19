import assert from 'node:assert/strict';
import {
  applySolvedPart,
  buildTileOwnership,
  type PartOwnershipEntry
} from '../src/game/tileOwnership';

function run(): void {
  const entries: PartOwnershipEntry[] = [
    { id: 'SONIC', path: ['a1', 'b1', 'c1'] },
    { id: 'LARA', path: ['b1', 'b2'] }
  ];

  const state = buildTileOwnership(entries);

  const deactivatedAfterSonic = applySolvedPart(state, entries[0]);
  assert.deepEqual(deactivatedAfterSonic, ['a1', 'c1']);
  assert.equal(state.ownership.get('b1')?.has('LARA'), true);

  const deactivatedAfterLara = applySolvedPart(state, entries[1]);
  assert.deepEqual(deactivatedAfterLara.sort(), ['b1', 'b2']);

  console.log('Ownership tests passed.');
}

run();
