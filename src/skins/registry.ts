export type SkinId = 'void' | 'synthwave' | 'gameboy';

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
};

export type SkinMeta = {
  id: SkinId;
  name: string;
  productId: string | null;
  bundleProductId?: string;
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
      glow: 'rgba(0, 212, 232, 0.4)'
    }
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    productId: 'skin_synthwave',
    bundleProductId: 'skin_bundle',
    previewTile: {
      bg: 'linear-gradient(145deg, #ff2bd6, #6a0f9a)',
      border: '#ff7af0',
      letter: '#ffffff',
      glow: 'rgba(255, 43, 214, 0.6)'
    }
  },
  {
    id: 'gameboy',
    name: 'Game Boy',
    productId: 'skin_pixel',
    bundleProductId: 'skin_bundle',
    previewTile: {
      bg: 'linear-gradient(145deg, #b5d68f, #7ea05c)',
      border: '#1a2a1a',
      letter: '#0d1a0d',
      glow: 'rgba(181, 214, 143, 0.6)'
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