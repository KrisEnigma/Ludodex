import Phaser from 'phaser';
import type { SkinDefinition } from '../../skins/types';

function drawRoundedTile(
  bg: Phaser.GameObjects.Graphics,
  size: number,
  radius: number,
  state: SkinDefinition['tiles']['idle']
) {
  const half = size * 0.5;
  bg.clear();

  if (state.glow) {
    bg.fillStyle(state.glow.color, state.glow.outerAlpha);
    bg.fillRoundedRect(
      -half - state.glow.outerOffset,
      -half - state.glow.outerOffset,
      size + state.glow.outerOffset * 2,
      size + state.glow.outerOffset * 2,
      radius + state.glow.outerOffset
    );
  }

  bg.fillStyle(state.gradientBR, 1);
  bg.fillRoundedRect(-half, -half, size, size, radius);
  bg.lineStyle(3, state.borderColor, state.borderAlpha);
  bg.strokeRoundedRect(-half, -half, size, size, radius);
}

function drawTileState(
  bg: Phaser.GameObjects.Graphics,
  label: Phaser.GameObjects.Text,
  state: SkinDefinition['tiles']['idle']
) {
  const size = (bg.getData('size') as number | undefined) ?? 128;
  const radius = (bg.getData('radius') as number | undefined) ?? Math.round(size * 0.24);
  drawRoundedTile(bg, size, radius, state);
  label.setColor(state.letterColor);

  if (state.letterGlow) {
    label.setShadow(0, 0, state.letterGlow.color, state.letterGlow.blur, false, true);
  } else {
    label.setShadow(0, 0, 'transparent', 0, false, false);
  }
}

export function drawTileIdle(
  bg: Phaser.GameObjects.Graphics,
  label: Phaser.GameObjects.Text,
  skin: SkinDefinition
): void {
  drawTileState(bg, label, skin.tiles.idle);
}

export function drawTileSelected(
  bg: Phaser.GameObjects.Graphics,
  label: Phaser.GameObjects.Text,
  skin: SkinDefinition
): void {
  drawTileState(bg, label, skin.tiles.selected);
}

export function drawTileFoundPending(
  bg: Phaser.GameObjects.Graphics,
  label: Phaser.GameObjects.Text,
  skin: SkinDefinition
): void {
  drawTileState(bg, label, skin.tiles.foundPending);
}

export function drawTileDeactivated(target: Phaser.GameObjects.Container | Phaser.GameObjects.Text, skin: SkinDefinition): void {
  target.setAlpha(skin.tiles.deactivatedAlpha);
}
