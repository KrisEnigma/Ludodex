import Phaser from 'phaser';
import { loadPuzzles } from '../game/PuzzleLoader';
import { scheduleDailyNotification } from '../services/NotificationService';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  async create() {
    console.log('BootScene create called');
    await loadPuzzles();
    await scheduleDailyNotification();
    this.scene.start('GameScene');
  }
}
