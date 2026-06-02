export type SkinId = 'void' | 'synthwave' | 'gameboy' | 'terminal' | 'phosphor' | 'phobos' | 'crimson' | 'underworld';

/**
 * Tile-shaped preview token set. Drives the mini-tile shown in the Settings
 * skin selector. The tokens here mirror the skin's selected-state values
 * because the selected state is the most distinctive look — it's what the
 * player sees during the active "I'm tracing a word" moment.
 *
 * We can't reuse the live CSS variables for the preview because those only
 * apply when the corresponding skin class is on `<html>`. The preview must
 * render in every skin's style regardless of which skin is currently active,
 * so the values are baked in here and applied via inline styles.
 */
export type SkinPreviewTile = {
  /** Background gradient or solid color (CSS `background` value). */
  bg: string;
  /** 1px border color around the tile. */
  border: string;
  /** Letter color inside the tile. */
  letter: string;
  /** Outer glow color (CSS `box-shadow` color). */
  glow: string;
  /** Tile-letter font-family for this skin, so the preview shows the real font. */
  font: string;
  /** Corner radius as a CSS length ('8px', '0', …), mirroring the skin's tile radius. */
  radius: string;
  /** Font-size multiplier so display/pixel fonts sit correctly in the swatch. */
  scale: number;
};

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
  previewTile: SkinPreviewTile;
};

export const SKINS: SkinMeta[] = [
  {
    id: 'void',
    name: 'Void',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #0d3a42, #071e26)',
      border: '#00d4e8',
      letter: '#9af0ff',
      glow: 'rgba(0, 212, 232, 0.4)',
      font: "'Space Mono', ui-monospace, monospace",
      radius: '8px',
      scale: 1
    }
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    productId: 'skin_synthwave',
    bundleProductId: 'skin_bundle',
    unlockedByAchievement: 'solve_10',
    unlockHint: '10 puzzles solved',
    previewTile: {
      bg: 'linear-gradient(145deg, #ff2bd6, #6a0f9a)',
      border: '#ff7af0',
      letter: '#ffffff',
      glow: 'rgba(255, 43, 214, 0.6)',
      font: "'Orbitron', sans-serif",
      radius: '10px',
      scale: 0.84
    }
  },
  {
    id: 'gameboy',
    name: 'Dot Matrix',
    productId: 'skin_gameboy',
    bundleProductId: 'skin_bundle',
    unlockedByAchievement: 'streak_30',
    unlockHint: '30-day streak',
    previewTile: {
      bg: 'linear-gradient(145deg, #b5d68f, #7ea05c)',
      border: '#1a2a1a',
      letter: '#0d1a0d',
      glow: 'rgba(181, 214, 143, 0.6)',
      font: "'Press Start 2P', monospace",
      radius: '0',
      scale: 0.62
    }
  },
  {
    id: 'terminal',
    name: 'Terminal',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #ffb000, #a86e00)',
      border: '#ffd86a',
      letter: '#1a1000',
      glow: 'rgba(255, 176, 0, 0.5)',
      font: "'VT323', monospace",
      radius: '2px',
      scale: 1.18
    }
  },
  {
    id: 'phosphor',
    name: 'Phosphor',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #39e832, #1a7a18)',
      border: '#a8f0b8',
      letter: '#010a02',
      glow: 'rgba(57, 232, 50, 0.55)',
      font: "'VT323', monospace",
      radius: '2px',
      scale: 1.18
    }
  },
  {
    id: 'phobos',
    name: 'Phobos',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #cc1111, #7a0a0a)',
      border: '#ff4444',
      letter: '#ffffff',
      glow: 'rgba(204, 17, 17, 0.6)',
      font: "'DooM', monospace",
      radius: '0',
      scale: 1
    }
  },
  {
    id: 'underworld',
    name: 'Underworld',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #e8a010, #9a6600)',
      border: '#ffe080',
      letter: '#1a0c00',
      glow: 'rgba(232, 160, 16, 0.7)',
      font: "'Cinzel', serif",
      radius: '8px',
      scale: 0.78
    }
  },
  {
    id: 'crimson',
    name: 'Crimson',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #ff2d2d, #8a0f12)',
      border: '#ff8a3d',
      letter: '#ffffff',
      glow: 'rgba(255, 45, 45, 0.55)',
      font: "'Orbitron', sans-serif",
      radius: '6px',
      scale: 0.84
    }
  }
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

export function applySkin(skinId: SkinId): void {
  const root = document.documentElement;
  root.classList.remove(...SKIN_CLASS_NAMES);
  if (skinId !== 'void') {
    root.classList.add(`${SKIN_CLASS_PREFIX}${skinId}`);
  }
}