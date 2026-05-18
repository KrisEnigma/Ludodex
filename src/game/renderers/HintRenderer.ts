import Phaser from 'phaser';
import type { SkinDefinition } from '../../skins/types';

function drawRoundedHint(
  bg: Phaser.GameObjects.Graphics,
  fillColor: number,
  fillAlpha: number,
  borderColor: number,
  borderAlpha: number
) {
  const size = (bg.getData('size') as number | undefined) ?? 52;
  const radius = (bg.getData('radius') as number | undefined) ?? Math.round(size * 0.18);
  const half = size * 0.5;

  bg.clear();
  bg.fillStyle(fillColor, fillAlpha);
  bg.fillRoundedRect(-half, -half, size, size, radius);
  const borderThick = Math.max(2, Math.round(size * 0.04));
  bg.lineStyle(borderThick, borderColor, borderAlpha);
  bg.strokeRoundedRect(-half, -half, size, size, radius);
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
