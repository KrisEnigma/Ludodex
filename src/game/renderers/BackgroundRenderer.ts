import Phaser from 'phaser';
import type { SkinDefinition } from '../../skins/types';

export function renderBackground(
  scene: Phaser.Scene,
  skin: SkinDefinition
): void {
  const { width, height } = scene.scale;
  const bg = scene.add.graphics().setDepth(0);

  // Base dark fill
  bg.fillStyle(skin.background.edgeColor, 1);
  bg.fillRect(0, 0, width, height);

  // Radial gradient — lighter center
  bg.fillStyle(skin.background.centerColor, 1);
  bg.fillEllipse(width / 2, height * 0.42, width * 0.78, height * 0.68);

  // Softer inner ellipse
  bg.fillStyle(
    Phaser.Display.Color.ValueToColor(skin.background.centerColor).lighten(4).color,
    0.5
  );
  bg.fillEllipse(width / 2, height * 0.40, width * 0.45, height * 0.38);

  // Noise overlay
  if (scene.textures.exists('noise')) {
    const noise = scene.add.tileSprite(
      width / 2, height / 2, width, height, 'noise'
    );
    noise.setAlpha(skin.background.noiseAlpha);
    noise.setBlendMode(Phaser.BlendModes.SCREEN);
    noise.setDepth(1);
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
  [[120, a.alpha], [180, a.alpha * 0.6], [240, a.alpha * 0.3]].forEach(
    ([r, alpha]) => {
      gfx.fillStyle(a.color, alpha as number);
      gfx.fillEllipse(gridCenterX, gridCenterY, (r as number) * 2,
                      (r as number) * 1.4);
    }
  );
  return gfx;
}
