import Phaser from 'phaser';
import type { SkinDefinition } from '../../skins/types';

function drawRoundedHint(
  bg: Phaser.GameObjects.Graphics,
  fillColor: number,
  fillAlpha: number,
  borderColor: number,
  borderAlpha: number
) {
  const width =
    (bg.getData('width') as number | undefined) ??
    (bg.getData('size') as number | undefined) ??
    52;
  const height =
    (bg.getData('height') as number | undefined) ??
    (bg.getData('size') as number | undefined) ??
    52;
  const radius =
    (bg.getData('radius') as number | undefined) ??
    Math.round(Math.min(width, height) * 0.18);
  const halfW = width * 0.5;
  const halfH = height * 0.5;

  bg.clear();
  bg.fillStyle(fillColor, fillAlpha);
  bg.fillRoundedRect(-halfW, -halfH, width, height, radius);
  const borderThick = Math.max(2, Math.round(Math.min(width, height) * 0.08));
  bg.lineStyle(borderThick, borderColor, borderAlpha);
  bg.strokeRoundedRect(-halfW, -halfH, width, height, radius);
}

export function styleHintEmpty(bg: Phaser.GameObjects.Graphics, skin: SkinDefinition) {
  const s = skin.hints.empty;
  drawRoundedHint(bg, s.fillColor, s.fillAlpha, s.borderColor, s.borderAlpha);
}

export function styleHintSolved(bg: Phaser.GameObjects.Graphics, skin: SkinDefinition) {
  const s = skin.hints.solved;
  drawRoundedHint(bg, s.fillColor, s.fillAlpha, s.borderColor, s.borderAlpha);
}

export function styleHintCompleted(bg: Phaser.GameObjects.Graphics): void {
  drawRoundedHint(bg, 0x22452f, 1, 0x27ae60, 1);
}
