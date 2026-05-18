import Phaser from 'phaser';
import type { SkinDefinition } from '../../skins/types';

export function drawBackground(scene: Phaser.Scene, skin: SkinDefinition): void {
  const { width, height } = scene.scale;
  const bg = scene.add.graphics().setDepth(-20);
  const b = skin.background;

  bg.fillStyle(b.edgeColor, 1);
  bg.fillRect(0, 0, width, height);
  bg.fillStyle(b.centerColor, 1);
  bg.fillEllipse(width / 2, height * 0.42, width * 0.75, height * 0.65);

  if (b.noise && scene.textures.exists('noise')) {
    const noiseImg = scene.add.tileSprite(width / 2, height / 2, width, height, 'noise');
    noiseImg.setAlpha(b.noiseAlpha);
    noiseImg.setBlendMode(Phaser.BlendModes.SCREEN);
    noiseImg.setDepth(-19);
  }

  if (b.scanlines && scene.textures.exists('scanlines')) {
    const slImg = scene.add.tileSprite(width / 2, height / 2, width, height, 'scanlines');
    slImg.setAlpha(b.scanlineAlpha);
    slImg.setDepth(-18);
  }
}
