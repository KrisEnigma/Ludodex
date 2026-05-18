import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    console.log('MenuScene create called');
    this.add.rectangle(540, 960, 1080, 1920, 0x2222aa, 1).setOrigin(0.5);
    this.add.text(540, 800, 'GlitchSalad', {
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '72px'
    }).setOrigin(0.5);

    const start = this.add.text(540, 980, 'Tap To Start', {
      color: '#4a90d9',
      fontFamily: 'monospace',
      fontSize: '40px'
    }).setOrigin(0.5);

    start.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.scene.start('GameScene');
    });
  }
}
