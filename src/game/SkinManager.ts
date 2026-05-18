import { getSkinById as getSkinFromRegistry } from '../skins/registry';
import type { SkinDefinition } from '../skins/types';

export type Skin = SkinDefinition;

export function getSkinById(id: string): Skin {
  return getSkinFromRegistry(id);
}
