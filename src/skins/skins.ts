export interface GlowConfig {
  color:       number;
  innerAlpha:  number;
  outerAlpha:  number;
  innerOffset: number;
  outerOffset: number;
}

export interface TileState {
  gradientTL:   number;
  gradientBR:   number;
  borderColor:  number;
  borderAlpha:  number;
  insetAlpha:   number;
  shadowAlpha:  number;
  glow?:        GlowConfig;
  letterColor:  string;
  letterGlow?:  { color: string; blur: number };
}

export interface PathConfig {
  color:    number;
  halo:     { width: number; alpha: number };
  body:     { width: number; alpha: number };
  core:     { width: number; alpha: number };
  endpoint: { radius: number; alpha: number };
}

export interface SkinDefinition {
  id:    string;
  name:  string;
  price: string;

  bgCenter:      number;
  bgEdge:        number;
  noiseAlpha:    number;

  tiles: {
    idle:             TileState;
    selected:         TileState;
    foundPending:     TileState;
    deactivatedAlpha: number;
  };

  path: PathConfig;

  hints: {
    emptyFill:        number;
    emptyFillAlpha:   number;
    emptyBorder:      number;
    emptyBorderAlpha: number;
    emptyInsetAlpha:  number;
    solvedGradTL:     number;
    solvedGradBR:     number;
    solvedBorder:     number;
    solvedGlowColor:  number;
    solvedGlowAlpha:  number;
    solvedLetterColor:string;
  };

  chrome: {
    levelColor:     string;
    timerColor:     string;
    titleColor:     string;
    titleGlowColor: string;
    titleGlowAlpha: number;
    hintTextColor:  string;
    menuColor:      string;
    dotActive:      number;
    dotInactive:    number;
    gridAmbient:    { color: number; alpha: number };
  };
}

// ── VOID (default, free) ─────────────────────────────────────────────────────

export const VOID_SKIN: SkinDefinition = {
  id: 'void', name: 'VOID', price: 'free',

  bgCenter:   0x0D1118,
  bgEdge:     0x07090E,
  noiseAlpha: 0.025,

  tiles: {
    idle: {
      gradientTL:  0x1E2236,
      gradientBR:  0x131824,
      borderColor: 0x252A3E,
      borderAlpha: 0.7,
      insetAlpha:  0.05,
      shadowAlpha: 0.55,
      letterColor: '#9CA8C4',
    },
    selected: {
      gradientTL:  0x0D3A42,
      gradientBR:  0x071E26,
      borderColor: 0x00D4E8,
      borderAlpha: 0.9,
      insetAlpha:  0.08,
      shadowAlpha: 0.6,
      glow: {
        color:       0x00D4E8,
        innerAlpha:  0.40,
        outerAlpha:  0.12,
        innerOffset: 2,
        outerOffset: 6,
      },
      letterColor: '#DDFAFF',
      letterGlow:  { color: '#00D4E8', blur: 10 },
    },
    foundPending: {
      gradientTL:  0x0A2E1E,
      gradientBR:  0x061A12,
      borderColor: 0x00DC8C,
      borderAlpha: 0.5,
      insetAlpha:  0.04,
      shadowAlpha: 0.4,
      glow: {
        color:       0x00DC8C,
        innerAlpha:  0.15,
        outerAlpha:  0.05,
        innerOffset: 2,
        outerOffset: 5,
      },
      letterColor: '#7AEDC0',
    },
    deactivatedAlpha: 0.08,
  },

  path: {
    color:    0x00D4E8,
    halo:     { width: 14, alpha: 0.10 },
    body:     { width: 5,  alpha: 0.40 },
    core:     { width: 1.5,alpha: 0.90 },
    endpoint: { radius: 4, alpha: 0.90 },
  },

  hints: {
    emptyFill:         0x000000,
    emptyFillAlpha:    0.45,
    emptyBorder:       0x252A3E,
    emptyBorderAlpha:  0.6,
    emptyInsetAlpha:   0.35,
    solvedGradTL:      0x0A2E1E,
    solvedGradBR:      0x061A12,
    solvedBorder:      0x00DC8C,
    solvedGlowColor:   0x00DC8C,
    solvedGlowAlpha:   0.25,
    solvedLetterColor: '#4EEDB0',
  },

  chrome: {
    levelColor:     '#3A3D52',
    timerColor:     '#3A3D52',
    titleColor:     '#C8D0E0',
    titleGlowColor: '#00D4E8',
    titleGlowAlpha: 0.12,
    hintTextColor:  '#3A3D52',
    menuColor:      '#3A3D52',
    dotActive:      0x00D4E8,
    dotInactive:    0x1A1D2A,
    gridAmbient:    { color: 0x00D4E8, alpha: 0.04 },
  },
};

export const SKINS: Record<string, SkinDefinition> = {
  void: VOID_SKIN,
};

export function getSkinById(id: string): SkinDefinition {
  return SKINS[id] ?? VOID_SKIN;
}

// Keep backward compat — GameScene imports getSkinById
export type Skin = SkinDefinition;
