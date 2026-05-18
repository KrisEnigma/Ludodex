import Phaser from 'phaser';
import type { SkinDefinition } from '../../skins/types';
import type { TileState } from '../../skins/skins';

const tileFaceTextureCache = new Map<string, string>();

function colorToRgba(color: number, alpha: number): string {
  const c = Phaser.Display.Color.IntegerToRGB(color);
  return `rgba(${c.r},${c.g},${c.b},${alpha})`;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) * 0.5));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function getTileFaceTextureKey(state: TileState, size: number): string {
  return [
    'tile-face',
    size,
    state.gradientTL,
    state.gradientBR,
    state.borderColor,
    state.borderAlpha,
    state.insetAlpha,
    state.shadowAlpha,
    state.letterColor
  ].join('-');
}

function ensureTileFaceTexture(scene: Phaser.Scene, state: TileState, size: number): string {
  const key = getTileFaceTextureKey(state, size);
  const cached = tileFaceTextureCache.get(key);
  if (cached && scene.textures.exists(cached)) {
    return cached;
  }

  if (scene.textures.exists(key)) {
    tileFaceTextureCache.set(key, key);
    return key;
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '__MISSING';

  const radius = Math.round(size * 0.22);

  // Shadow.
  ctx.fillStyle = colorToRgba(0x000000, state.shadowAlpha * 0.48);
  roundRectPath(ctx, 2, 4, size - 2, size - 4, radius);
  ctx.fill();

  // Smooth gradient face.
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, colorToRgba(state.gradientTL, 1));
  grad.addColorStop(1, colorToRgba(state.gradientBR, 1));
  ctx.fillStyle = grad;
  roundRectPath(ctx, 0, 0, size, size, radius);
  ctx.fill();

  // Soft darker lower-right overlay for the mockup's 145deg depth.
  ctx.fillStyle = colorToRgba(state.gradientBR, 0.35);
  roundRectPath(ctx, size * 0.25, size * 0.25, size * 0.75, size * 0.75, radius * 0.55);
  ctx.fill();

  // Border.
  const borderW = Math.max(2, Math.round(size * 0.013));
  ctx.lineWidth = borderW;
  ctx.strokeStyle = colorToRgba(state.borderColor, state.borderAlpha);
  roundRectPath(ctx, borderW * 0.5, borderW * 0.5, size - borderW, size - borderW, radius - borderW * 0.5);
  ctx.stroke();

  // Bevel highlight.
  const bevelW = Math.max(1, Math.round(size * 0.007));
  ctx.lineWidth = bevelW;
  ctx.strokeStyle = colorToRgba(0xffffff, state.insetAlpha * 1.5);
  ctx.beginPath();
  ctx.moveTo(radius * 0.7, bevelW + 0.5);
  ctx.lineTo(size - radius * 0.7, bevelW + 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bevelW + 0.5, radius * 0.7);
  ctx.lineTo(bevelW + 0.5, size - radius * 0.7);
  ctx.stroke();

  scene.textures.addCanvas(key, canvas);
  tileFaceTextureCache.set(key, key);
  return key;
}

function setTileFaceTexture(
  image: Phaser.GameObjects.Image,
  state: TileState,
  size: number
): void {
  const textureKey = ensureTileFaceTexture(image.scene, state, size);
  if (textureKey !== '__MISSING') {
    image.setTexture(textureKey);
    image.setDisplaySize(size, size);
  }
}

function setTileLabelStyle(label: Phaser.GameObjects.Text, state: TileState): void {
  label.setColor(state.letterColor);
  if (state.letterGlow) {
    label.setShadow(0, 0, state.letterGlow.color, state.letterGlow.blur, false, true);
  } else {
    label.setShadow(0, 0, 'transparent', 0, false, false);
  }
}

export function drawTileFace(
  graphics: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image,
  state: TileState,
  size: number
): void {
  if (graphics instanceof Phaser.GameObjects.Image) {
    setTileFaceTexture(graphics, state, size);
    return;
  }

  // Legacy fallback: use a flat fill if callers still pass Graphics.
  const R = Math.round(size * 0.22);
  const hs = size / 2;
  graphics.clear();
  graphics.fillStyle(state.gradientTL, 1);
  graphics.fillRoundedRect(-hs, -hs, size, size, R);
  graphics.lineStyle(Math.max(2, Math.round(size * 0.013)), state.borderColor, state.borderAlpha);
  graphics.strokeRoundedRect(-hs, -hs, size, size, R);
}

export function drawTileIdle(
  bg: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image,
  label: Phaser.GameObjects.Text,
  skin: SkinDefinition
): void {
  drawTileFace(bg, skin.tiles.idle, (bg as any).getData?.('size') ?? 128);
  setTileLabelStyle(label, skin.tiles.idle);
}

export function drawTileSelected(
  bg: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image,
  label: Phaser.GameObjects.Text,
  skin: SkinDefinition
): void {
  drawTileFace(bg, skin.tiles.selected, (bg as any).getData?.('size') ?? 128);
  setTileLabelStyle(label, skin.tiles.selected);
}

export function drawTileFoundPending(
  bg: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image,
  label: Phaser.GameObjects.Text,
  skin: SkinDefinition
): void {
  drawTileFace(bg, skin.tiles.foundPending, (bg as any).getData?.('size') ?? 128);
  setTileLabelStyle(label, skin.tiles.foundPending);
}

export function drawTileDeactivated(target: Phaser.GameObjects.Container | Phaser.GameObjects.Text, skin: SkinDefinition): void {
  target.setAlpha(skin.tiles.deactivatedAlpha);
}

// Compatibility no-ops retained for older call sites.
export function applyTileFX(): void {}
export function updateTileGradientFX(): void {}
export function updateTileShadowFX(): void {}
export function createTileGlowFX(): null { return null; }
export function setTileGlowActive(): void {}
export function drawTileGlow(_glowGraphics: Phaser.GameObjects.Graphics): void {
  _glowGraphics.clear();
}

export function applyLetterStyle(
  text: Phaser.GameObjects.Text,
  state: TileState
): void {
  setTileLabelStyle(text, state);
}
