export type SkinId =
  | 'void'
  | 'lumen'
  | 'neon-horizon'
  | 'laser-vector'
  | 'maze-chase'
  | 'swarm'
  | 'phantom-thieves'
  | 'catalyst'
  | 'paleblood'
  | 'aero'
  | 'star-hunter'
  | 'relic-gold'
  | 'puff-star'
  | 'cape-16bit'
  | 'blue-blur'
  | 'dragon-heat'
  | 'radio-tag'
  | 'cyber-shinobi'
  | 'gameboy'
  | 'terminal'
  | 'phosphor'
  | 'bios'
  | 'super-16-bit-lilac'
  | 'toaster'
  | 'lord-of-terror'
  | 'test-chamber'
  | 'polygon'
  | 'ring-of-light'
  | 'dream-spiral'
  | 'rip-tear'
  | 'blood-darkness'
  | 'crimson'
  | 'mushroom-kingdom';

export type SkinMeta = {
  id: SkinId;
  name: string;
  productId: string | null;
  bundleProductId?: string;
  /**
   * Achievement ID that unlocks this skin for free on all platforms.
   * If earned, the player owns the skin regardless of IAP status.
   * IAP remains an alternative unlock path on native builds.
   */
  unlockedByAchievement?: string;
  /**
   * Human-readable unlock condition shown in the locked skin card,
   * e.g. "10 puzzles solved" or "30-day streak".
   */
  unlockHint?: string;
  /**
   * True for skins that declare `color-scheme: light` in skins.css.
   * Used to set the native status-bar icon style on Android/iOS.
   */
  isLight?: true;
};

export const SKINS: SkinMeta[] = [
  { id: 'void', name: 'Void', productId: null },
  { id: 'lumen', name: 'Lumen', productId: null, isLight: true },
  {
    id: 'neon-horizon',
    name: 'Neon Horizon',
    productId: 'skin_neon_horizon',
    bundleProductId: 'skin_bundle',
    unlockedByAchievement: 'solve_10',
    unlockHint: '10 puzzles solved'
  },
  { id: 'laser-vector', name: 'Laser Vector', productId: null },
  { id: 'maze-chase', name: 'Maze Chase', productId: null },
  { id: 'swarm', name: 'Swarm', productId: null },
  { id: 'phantom-thieves', name: 'Phantom Thieves', productId: null },
  { id: 'catalyst', name: 'Catalyst', productId: null, isLight: true },
  { id: 'paleblood', name: 'Paleblood', productId: null },
  { id: 'aero', name: 'Aero', productId: null, isLight: true },
  { id: 'star-hunter', name: 'Star Hunter', productId: null },
  { id: 'relic-gold', name: 'Hyrule Vault', productId: null },
  { id: 'puff-star', name: 'Puff Star', productId: null },
  {
    id: 'mushroom-kingdom',
    name: 'Mushroom Kingdom',
    productId: 'skin_mushroom_kingdom',
    bundleProductId: 'skin_bundle',
    unlockedByAchievement: 'streak_30',
    unlockHint: '30-day streak'
  },
  { id: 'cape-16bit', name: '16-Bit Cape', productId: null },
  { id: 'blue-blur', name: 'Blue Blur', productId: null },
  { id: 'dragon-heat', name: 'Dragon Heat', productId: null },
  { id: 'radio-tag', name: 'Radio Tag', productId: null },
  { id: 'cyber-shinobi', name: 'Cyber Shinobi', productId: null },
  {
    id: 'gameboy',
    name: 'Dot Matrix',
    productId: 'skin_gameboy',
    bundleProductId: 'skin_bundle',
    unlockedByAchievement: 'streak_30',
    unlockHint: '30-day streak'
  },
  {
    id: 'terminal',
    name: 'Terminal',
    productId: null,
    unlockedByAchievement: 'solve_50',
    unlockHint: '50 puzzles solved'
  },
  {
    id: 'phosphor',
    name: 'Phosphor',
    productId: null,
    unlockedByAchievement: 'pristine_10',
    unlockHint: '10 pristine solves'
  },
  { id: 'bios', name: 'BIOS', productId: null },
  { id: 'super-16-bit-lilac', name: 'Super 16-Bit Lilac', productId: null },
  { id: 'toaster', name: 'Toaster', productId: null },
  {
    id: 'lord-of-terror',
    name: 'Lord of Terror',
    productId: 'skin_lord_of_terror',
    bundleProductId: 'skin_bundle',
    unlockedByAchievement: 'streak_7',
    unlockHint: '7-day streak'
  },
  { id: 'test-chamber', name: 'Test Chamber', productId: null, isLight: true },
  { id: 'polygon', name: 'Polygon', productId: null, isLight: true },
  {
    id: 'ring-of-light',
    name: 'Ring of Light',
    productId: 'skin_ring_of_light',
    bundleProductId: 'skin_bundle',
    unlockedByAchievement: 'solve_25',
    unlockHint: '25 puzzles solved',
    isLight: true
  },
  { id: 'dream-spiral', name: 'Dream Spiral', productId: null, isLight: true },
  { id: 'rip-tear', name: 'Rip & Tear', productId: null },
  { id: 'blood-darkness', name: 'Blood & Darkness', productId: null },
  { id: 'crimson', name: 'Crimson', productId: null }
];

const SKIN_CLASS_PREFIX = 'skin-';
const SKIN_CLASS_NAMES = SKINS.map((skin) => `${SKIN_CLASS_PREFIX}${skin.id}`);

export function normalizeSkinId(id: string | null | undefined): SkinId {
  return SKINS.some((skin) => skin.id === id) ? (id as SkinId) : 'void';
}

export function getCurrentSkinId(): SkinId {
  const classList = document.documentElement.classList;
  for (const skin of SKINS) {
    if (classList.contains(`${SKIN_CLASS_PREFIX}${skin.id}`)) {
      return skin.id;
    }
  }
  return 'void';
}

type SkinChangedCallback = (skinId: SkinId) => void;
let skinChangedCallback: SkinChangedCallback | null = null;

/** Register a single listener that fires after every applySkin call. */
export function onSkinChanged(cb: SkinChangedCallback): void {
  skinChangedCallback = cb;
}

export function applySkin(skinId: SkinId): void {
  const root = document.documentElement;
  root.classList.remove(...SKIN_CLASS_NAMES);
  root.classList.add(`${SKIN_CLASS_PREFIX}${skinId}`);
  skinChangedCallback?.(skinId);
}
