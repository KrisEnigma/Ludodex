import { SKINS, type Skin } from '../skins/skins';

export function getSkinById(id: string): Skin {
  return SKINS[id] ?? SKINS.default;
}
