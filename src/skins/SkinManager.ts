import Phaser from 'phaser';
import { Preferences } from '@capacitor/preferences';
import { getSkinById, VOID_SKIN } from './registry';
import type { SkinDefinition } from './types';

export const SKIN_CHANGED_EVENT = 'skinChanged';

export class SkinManager {
  private active: SkinDefinition = VOID_SKIN;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  async init(): Promise<void> {
    const { value } = await Preferences.get({ key: 'active_skin' });
    if (value) this.active = getSkinById(value);
  }

  get(): SkinDefinition {
    return this.active;
  }

  async set(id: string): Promise<void> {
    const skin = getSkinById(id);
    this.active = skin;
    await Preferences.set({ key: 'active_skin', value: skin.id });
    this.scene.events.emit(SKIN_CHANGED_EVENT, skin);
  }
}
