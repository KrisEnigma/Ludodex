import Phaser from 'phaser';
import type { SkinDefinition } from '../../skins/types';
import type { TileState } from '../../skins/skins';

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

export function drawTileFace(
  graphics: Phaser.GameObjects.Graphics,
  state: TileState,
  size: number
): void {
  const R = Math.round(size * 0.20);
  const hs = size / 2;

  graphics.clear();

  // Drop shadow — offset rect behind tile
  graphics.fillStyle(0x000000, state.shadowAlpha * 0.65);
  graphics.fillRoundedRect(-hs + 1, -hs + 3, size, size, R);
  graphics.fillStyle(0x000000, state.shadowAlpha * 0.3);
  graphics.fillRoundedRect(-hs, -hs + 2, size, size, R);

  // Tile face — diagonal gradient (TL light, BR dark)
  graphics.fillGradientStyle(
    state.gradientTL, state.gradientTL,
    state.gradientBR, state.gradientBR,
    1
  );
  graphics.fillRoundedRect(-hs, -hs, size, size, R);

  // Border
  graphics.lineStyle(1, state.borderColor, state.borderAlpha);
  graphics.strokeRoundedRect(-hs, -hs, size, size, R);

  // Bevel — top edge inset highlight
  graphics.lineStyle(1, 0xffffff, state.insetAlpha);
  graphics.beginPath();
  graphics.moveTo(-hs + R, -hs + 0.5);
  graphics.lineTo(hs - R, -hs + 0.5);
  graphics.strokePath();
  // Left edge
  graphics.beginPath();
  graphics.moveTo(-hs + 0.5, -hs + R);
  graphics.lineTo(-hs + 0.5, hs - R);
  graphics.strokePath();
}

export function drawTileGlow(
  glowGraphics: Phaser.GameObjects.Graphics,
  state: TileState,
  size: number
): void {
  glowGraphics.clear();
  if (!state.glow) return;

  const R = Math.round(size * 0.20);
  const hs = size / 2;
  const g = state.glow;

  glowGraphics.setAlpha(1);
  // Outer ring
  glowGraphics.lineStyle(5, g.color, g.outerAlpha);
  glowGraphics.strokeRoundedRect(
    -hs - g.outerOffset, -hs - g.outerOffset,
    size + g.outerOffset * 2, size + g.outerOffset * 2,
    R + g.outerOffset
  );
  // Inner ring
  glowGraphics.lineStyle(3, g.color, g.innerAlpha);
  glowGraphics.strokeRoundedRect(
    -hs - g.innerOffset, -hs - g.innerOffset,
    size + g.innerOffset * 2, size + g.innerOffset * 2,
    R + g.innerOffset
  );
}

export function applyLetterStyle(
  text: Phaser.GameObjects.Text,
  state: TileState
): void {
  text.setColor(state.letterColor);
  if (state.letterGlow) {
    text.setShadow(
      0, 0,
      state.letterGlow.color,
      state.letterGlow.blur,
      false, true
    );
  } else {
    text.setShadow(0, 0, 'transparent', 0, false, false);
  }
}
