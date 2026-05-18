export type Skin = {
  id: string;
  name: string;
  price: string;
  tileFill: number;
  tileStroke: number;
  tileActive: number;
  tileSolved: number;
  tileDeactivated: number;
  letterColor: string;
  background: number;
  font: string;
};

export const SKINS: Record<string, Skin> = {
  default: {
    id: 'default',
    name: 'Default',
    price: 'free',
    tileFill: 0x2d2d2d,
    tileStroke: 0x555555,
    tileActive: 0x4a90d9,
    tileSolved: 0x27ae60,
    tileDeactivated: 0x1a1a1a,
    letterColor: '#ffffff',
    background: 0x1a1a1a,
    font: 'monospace'
  },
  synthwave: {
    id: 'synthwave',
    name: 'Synthwave',
    price: 'skin_synthwave',
    tileFill: 0x1a0533,
    tileStroke: 0xff00ff,
    tileActive: 0xff00ff,
    tileSolved: 0x00ffff,
    tileDeactivated: 0x0d0d1a,
    letterColor: '#00ffff',
    background: 0x0d0d1a,
    font: 'monospace'
  },
  pixel: {
    id: 'pixel',
    name: 'Game Boy',
    price: 'skin_pixel',
    tileFill: 0x0f380f,
    tileStroke: 0x306230,
    tileActive: 0x8bac0f,
    tileSolved: 0x306230,
    tileDeactivated: 0x071607,
    letterColor: '#9bbc0f',
    background: 0x0f380f,
    font: 'monospace'
  },
  darkfantasy: {
    id: 'darkfantasy',
    name: 'Dark Souls',
    price: 'skin_darkfantasy',
    tileFill: 0x1c1007,
    tileStroke: 0x8b6914,
    tileActive: 0x8b6914,
    tileSolved: 0x4a3000,
    tileDeactivated: 0x0a0704,
    letterColor: '#c9a84c',
    background: 0x0d0a06,
    font: 'serif'
  }
};
