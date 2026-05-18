import Phaser from 'phaser';
import type { SkinDefinition } from '../../skins/types';

export function renderBackground(
  scene: Phaser.Scene,
  skin: SkinDefinition
): void {
  const { width, height } = scene.scale;
  const bg = scene.add.rectangle(width / 2, height / 2, width, height, skin.background.centerColor)
    .setDepth(0)
    .setOrigin(0.5);

  (bg as any).postFX.addVignette(0.5, 0.42, 0.85, 0.55, skin.background.edgeColor);

  // Noise overlay (per skin toggle)
  if (skin.background.noise && scene.textures.exists('noise')) {
    const noise = scene.add.tileSprite(
      width / 2, height / 2, width, height, 'noise'
    );
    noise.setAlpha(skin.background.noiseAlpha);
    noise.setBlendMode(Phaser.BlendModes.SCREEN);
    noise.setDepth(1);
  }

  // Scanline overlay (per skin toggle)
  if (skin.background.scanlines && scene.textures.exists('scanlines')) {
    const scan = scene.add.tileSprite(
      width / 2,
      height / 2,
      width,
      height,
      'scanlines'
    );
    scan.setAlpha(skin.background.scanlineAlpha);
    scan.setBlendMode(Phaser.BlendModes.MULTIPLY);
    scan.setDepth(1.1);
  }
}

export function drawBackground(scene: Phaser.Scene, skin: SkinDefinition): void {
  renderBackground(scene, skin);
}

export function renderGridAmbient(
  scene: Phaser.Scene,
  gridCenterX: number,
  gridCenterY: number,
  skin: SkinDefinition
): Phaser.GameObjects.Graphics {
  const gfx = scene.add.graphics().setDepth(2);
  const a = skin.chrome.gridAmbient;
  [[150, a.alpha * 0.35], [220, a.alpha * 0.2], [290, a.alpha * 0.1]].forEach(
    ([r, alpha]) => {
      gfx.fillStyle(a.color, alpha as number);
      gfx.fillEllipse(gridCenterX, gridCenterY, (r as number) * 2,
                      (r as number) * 1.4);
    }
  );
  return gfx;
}
