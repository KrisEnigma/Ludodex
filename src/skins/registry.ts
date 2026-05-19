export type SkinId = 'void' | 'synthwave' | 'gameboy';

export type SkinMeta = {
  id: SkinId;
  name: string;
  productId: string | null;
  bundleProductId?: string;
  /** Three colors driving the preview swatch in Settings: [background, tile, accent]. */
  previewSwatch: [string, string, string];
};

export const SKINS: SkinMeta[] = [
  {
    id: 'void',
    name: 'Void',
    productId: null,
    previewSwatch: ['#131824', '#1e2236', '#00d4e8']
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    productId: 'skin_synthwave',
    bundleProductId: 'skin_bundle',
    previewSwatch: ['#150620', '#6a0f9a', '#ff2bd6']
  },
  {
    id: 'gameboy',
    name: 'Game Boy',
    productId: 'skin_pixel',
    bundleProductId: 'skin_bundle',
    previewSwatch: ['#4a5e44', '#6a8060', '#b5d68f']
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