import Phaser from 'phaser';

export class WinScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WinScene' });
  }

  create() {
    this.add.text(540, 900, 'Puzzle Solved', {
      color: '#27ae60',
      fontFamily: 'monospace',
      fontSize: '64px'
    }).setOrigin(0.5);
  }
}
