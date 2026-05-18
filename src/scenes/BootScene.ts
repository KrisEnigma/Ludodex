import Phaser from 'phaser';
import { ensureBundledPuzzlesLoaded, getLoadedPuzzleSource, loadPuzzles } from '../game/PuzzleLoader';
import { scheduleDailyNotification } from '../services/NotificationService';
import { initAds } from '../services/AdService';
import { initIAP } from '../services/IAPService';
import { FONT_FAMILY } from '../skins/registry';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  async create() {
    console.log('BootScene create called');

    this.generateNoiseTexture();
    this.generateScanlineTexture();

    const status = this.add.text(this.scale.width / 2, this.scale.height / 2, 'Loading puzzles...', {
      color: '#d3d9e3',
      fontFamily: FONT_FAMILY,
      fontSize: '34px'
    }).setOrigin(0.5);

    const loaded = await Promise.race([
      loadPuzzles().then(() => true).catch(() => false),
      new Promise<boolean>((resolve) => this.time.delayedCall(2200, () => resolve(false)))
    ]);

    if (!loaded) {
      ensureBundledPuzzlesLoaded();
    }

    const source = getLoadedPuzzleSource();
    status.setText(`Puzzles source: ${source}`);

    await Promise.all([
      scheduleDailyNotification(),
      initAds(),
      initIAP()
    ]);

    await new Promise<void>((resolve) => {
      this.time.delayedCall(250, () => resolve());
    });

    this.scene.start('MenuScene');
  }

  generateNoiseTexture(): void {
    if (this.textures.exists('noise')) return;

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = ctx.createImageData(size, size);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = Math.floor(Math.random() * 255);
      data.data[i] = v;
      data.data[i + 1] = v;
      data.data[i + 2] = v;
      data.data[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    this.textures.addCanvas('noise', canvas);
  }

  generateScanlineTexture(): void {
    if (this.textures.exists('scanlines')) return;

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 3;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 1, 1);
    ctx.clearRect(0, 1, 1, 2);
    this.textures.addCanvas('scanlines', canvas);
  }
}
