import Phaser from 'phaser';
import type { SkinDefinition } from '../../skins/types';

export function drawPath(
  graphics: Phaser.GameObjects.Graphics,
  chain: Phaser.Math.Vector2[],
  skin: SkinDefinition
): void {
  graphics.clear();
  if (chain.length < 2) return;

  const p = skin.path;

  const stroke = (width: number, alpha: number) => {
    graphics.lineStyle(width, p.color, alpha);
    graphics.beginPath();
    graphics.moveTo(chain[0].x, chain[0].y);
    for (let i = 1; i < chain.length; i++) {
      graphics.lineTo(chain[i].x, chain[i].y);
    }
    graphics.strokePath();
  };

  stroke(p.halo.width, p.halo.alpha);
  stroke(p.body.width, p.body.alpha);
  stroke(p.core.width, p.core.alpha);

  const end = chain[chain.length - 1];
  graphics.fillStyle(p.color, p.endpoint.alpha);
  graphics.fillCircle(end.x, end.y, p.endpoint.radius);
}
