import { deepMerge } from '../utils/deepMerge';
import type { DeepPartial } from '../utils/types';
import type { SkinDefinition } from './types';

export const FONT_FAMILY = "'Space Mono', ui-monospace, monospace";

export const VOID_SKIN: SkinDefinition = {
  id: 'void',
  name: 'VOID',
  price: 'free',
  background: {
    centerColor: 0x101a2a,
    edgeColor: 0x070d18,
    noise: true,
    noiseAlpha: 0.03,
    scanlines: false,
    scanlineAlpha: 0
  },
  tiles: {
    idle: {
      gradientTL: 0x1E2236,
      gradientBR: 0x131824,
      borderColor: 0x252A3E,
      borderAlpha: 0.7,
      insetAlpha: 0.05,
      shadowAlpha: 0.55,
      letterColor: '#9CA8C4'
    },
    selected: {
      gradientTL: 0x0D3A42,
      gradientBR: 0x071E26,
      borderColor: 0x00D4E8,
      borderAlpha: 0.9,
      insetAlpha: 0.08,
      shadowAlpha: 0.6,
      glow: {
        color: 0x00D4E8,
        innerAlpha: 0.40,
        outerAlpha: 0.12,
        innerOffset: 2,
        outerOffset: 6
      },
      letterColor: '#DDFAFF',
      letterGlow: { color: '#00D4E8', blur: 10 }
    },
    foundPending: {
      gradientTL: 0x0A2E1E,
      gradientBR: 0x061A12,
      borderColor: 0x00DC8C,
      borderAlpha: 0.5,
      insetAlpha: 0.04,
      shadowAlpha: 0.4,
      glow: {
        color: 0x00DC8C,
        innerAlpha: 0.15,
        outerAlpha: 0.05,
        innerOffset: 2,
        outerOffset: 5
      },
      letterColor: '#7AEDC0'
    },
    deactivatedAlpha: 0.08
  },
  path: {
    color: 0x00D4E8,
    halo: { width: 14, alpha: 0.10 },
    body: { width: 5, alpha: 0.40 },
    core: { width: 1.5, alpha: 0.90 },
    endpoint: { radius: 4, alpha: 0.90 }
  },
  hints: {
    empty: {
      fillColor: 0x000000,
      fillAlpha: 0.52,
      borderColor: 0x1f2b49,
      borderAlpha: 0.72,
      insetAlpha: 0.35,
      letterColor: 'transparent'
    },
    solved: {
      fillColor: 0x0a2e1e,
      fillAlpha: 1,
      borderColor: 0x00dc8c,
      borderAlpha: 0.7,
      insetAlpha: 0,
      glow: { color: 0x00dc8c, alpha: 0.25 },
      letterColor: '#4EEDB0'
    }
  },
  chrome: {
    menuColor: '#495777',
    levelColor: '#495777',
    timerColor: '#495777',
    titleColor: '#d7e3f5',
    titleGlowColor: '#19D7EF',
    titleGlowAlpha: 0.18,
    hintTextColor: '#6a7898',
    dotActive: 0x19d7ef,
    dotActiveGlow: 0.25,
    dotInactive: 0x1a1d2a,
    gridAmbient: { color: 0x19d7ef, alpha: 0.06 }
  },
  effects: {
    rgbSplit: false,
    deactivateStyle: 'glitch',
    wordFoundStyle: 'fill'
  }
};

export function createSkin(base: SkinDefinition, overrides: DeepPartial<SkinDefinition>): SkinDefinition {
  return deepMerge(base, overrides) as SkinDefinition;
}

export const SYNTHWAVE_SKIN = createSkin(VOID_SKIN, {
  id: 'synthwave',
  name: 'SYNTHWAVE',
  price: 'skin_synthwave',
  background: {
    centerColor: 0x0a0016,
    edgeColor: 0x050009,
    noise: false,
    scanlines: true,
    scanlineAlpha: 0.035
  },
  tiles: {
    idle: {
      gradientTL: 0x1a0830,
      gradientBR: 0x0d041c,
      borderColor: 0x420084,
      borderAlpha: 0.3,
      insetAlpha: 0.04,
      letterColor: '#7A4A9A'
    },
    selected: {
      gradientTL: 0x2d0848,
      gradientBR: 0x180430,
      borderColor: 0xcc00ee,
      borderAlpha: 0.95,
      glow: {
        color: 0xcc00ee,
        innerAlpha: 0.45,
        outerAlpha: 0.14,
        innerOffset: 2,
        outerOffset: 7
      },
      letterColor: '#FFDDFF',
      letterGlow: { color: '#CC00EE', blur: 10 }
    },
    foundPending: {
      gradientTL: 0x00201e,
      gradientBR: 0x001412,
      borderColor: 0x00c8b4,
      letterColor: '#60E8D8'
    }
  },
  path: { color: 0xcc00ee },
  effects: {
    rgbSplit: true,
    rgbSplitLeft: 'rgba(255,0,200,0.55)',
    rgbSplitRight: 'rgba(0,220,255,0.55)',
    deactivateStyle: 'glitch',
    wordFoundStyle: 'glitch-fill'
  }
});

export const GAMEBOY_SKIN = createSkin(VOID_SKIN, {
  id: 'gameboy',
  name: 'GAME BOY',
  price: 'skin_pixel',
  background: {
    centerColor: 0x0d220d,
    edgeColor: 0x060e06,
    noise: false,
    scanlines: true,
    scanlineAlpha: 0.06
  },
  tiles: {
    idle: {
      gradientTL: 0x162a16,
      gradientBR: 0x0e1e0e,
      borderColor: 0x1c5c1c,
      borderAlpha: 0.35,
      insetAlpha: 0.04,
      letterColor: '#3A6A1A'
    },
    selected: {
      gradientTL: 0x1e4a0a,
      gradientBR: 0x102808,
      borderColor: 0xaaee00,
      borderAlpha: 0.85,
      letterColor: '#C8FF44',
      letterGlow: { color: '#AAEE00', blur: 8 }
    },
    foundPending: {
      gradientTL: 0x203a0c,
      gradientBR: 0x102008,
      borderColor: 0xaaee00,
      letterColor: '#BBFF44'
    }
  },
  path: {
    color: 0xaaee00,
    halo: { width: 12, alpha: 0.08 },
    body: { width: 4, alpha: 0.35 },
    core: { width: 1.5, alpha: 0.85 }
  },
  effects: {
    rgbSplit: false,
    deactivateStyle: 'shrink',
    wordFoundStyle: 'fill'
  }
});

export const ALL_SKINS: Record<string, SkinDefinition> = {
  [VOID_SKIN.id]: VOID_SKIN,
  [SYNTHWAVE_SKIN.id]: SYNTHWAVE_SKIN,
  [GAMEBOY_SKIN.id]: GAMEBOY_SKIN,
  // Legacy aliases for backward compatibility with older saved ids
  default: VOID_SKIN,
  pixel: GAMEBOY_SKIN
};

export function getSkinById(id: string): SkinDefinition {
  return ALL_SKINS[id] ?? VOID_SKIN;
}
