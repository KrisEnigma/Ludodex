export type SkinId = 'void' | 'synthwave' | 'gameboy';

export type SkinMeta = {
  id: SkinId;
  name: string;
  productId: string | null;
  bundleProductId?: string;
};

export const SKINS: SkinMeta[] = [
  { id: 'void', name: 'Void', productId: null },
  { id: 'synthwave', name: 'Synthwave', productId: 'skin_synthwave', bundleProductId: 'skin_bundle' },
  { id: 'gameboy', name: 'Game Boy', productId: 'skin_pixel', bundleProductId: 'skin_bundle' }
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