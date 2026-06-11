import { SKINS, type SkinId } from './registry';

/**
 * Skins permanently available on the web build (always free, never rotate out).
 */
export const WEB_SKIN_IDS: SkinId[] = ['void', 'lumen', 'crimson'];

/**
 * All skins not in WEB_SKIN_IDS compete equally for the weekly promo slot.
 * Order follows the SKINS registry, so new skins automatically join the rotation
 * the moment they're added to registry.ts — no other changes needed.
 */
const PROMO_ROTATION: SkinId[] = SKINS.map(s => s.id).filter(id => !WEB_SKIN_IDS.includes(id));

/** Deterministic Fisher-Yates shuffle seeded by cycle number — different order each cycle. */
function seededShuffle(arr: SkinId[], seed: number): SkinId[] {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = Math.imul(s ^ (s >>> 15), s | 1) ^ (s + Math.imul(s ^ (s >>> 7), s | 61));
    const j = Math.abs(s) % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Rotates every Monday midnight UTC. All skins appear once per cycle before repeating;
 * each cycle is shuffled in a different order so the sequence never feels predictable.
 */
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const weeksSinceEpoch = Math.floor((Date.now() + 3 * 24 * 60 * 60 * 1000) / MS_PER_WEEK);
const cycleLength = PROMO_ROTATION.length;
const cycleNumber = Math.floor(weeksSinceEpoch / cycleLength);
const weekInCycle = weeksSinceEpoch % cycleLength;
export const PROMO_SKIN_ID: SkinId = seededShuffle(PROMO_ROTATION, cycleNumber)[weekInCycle]!;

export function isWebAvailable(skinId: SkinId): boolean {
  return WEB_SKIN_IDS.includes(skinId) || skinId === PROMO_SKIN_ID;
}
