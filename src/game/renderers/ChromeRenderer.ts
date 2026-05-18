import Phaser from 'phaser';
import { FONT_FAMILY } from '../../skins/registry';
import type { SkinDefinition } from '../../skins/types';

export function createChromeText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: string,
  size: string,
  originX = 0.5,
  originY = 0.5
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, {
    fontFamily: FONT_FAMILY,
    fontSize: size,
    color
  }).setOrigin(originX, originY);
}

export function styleTitle(textObj: Phaser.GameObjects.Text, skin: SkinDefinition) {
  textObj.setColor(skin.chrome.titleColor);
  textObj.setShadow(0, 0, skin.chrome.titleGlowColor, 40, false, true);
  textObj.setAlpha(1);
}
