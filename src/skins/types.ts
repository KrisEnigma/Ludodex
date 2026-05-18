export interface GlowConfig {
  color: number;
  innerAlpha: number;
  outerAlpha: number;
  innerOffset: number;
  outerOffset: number;
}

export interface TileState {
  gradientTL: number;
  gradientBR: number;
  borderColor: number;
  borderAlpha: number;
  insetAlpha: number;
  shadowAlpha: number;
  glow?: GlowConfig;
  letterColor: string;
  letterGlow?: { color: string; blur: number };
}

export interface HintSlotState {
  fillColor: number;
  fillAlpha: number;
  borderColor: number;
  borderAlpha: number;
  insetAlpha: number;
  glow?: { color: number; alpha: number };
  letterColor: string;
}

export interface PathConfig {
  color: number;
  halo: { width: number; alpha: number };
  body: { width: number; alpha: number };
  core: { width: number; alpha: number };
  endpoint: { radius: number; alpha: number };
}

export interface BackgroundConfig {
  centerColor: number;
  edgeColor: number;
  noise: boolean;
  noiseAlpha: number;
  scanlines: boolean;
  scanlineAlpha: number;
}

export interface ChromeConfig {
  menuColor: string;
  levelColor: string;
  timerColor: string;
  titleColor: string;
  titleGlowColor: string;
  titleGlowAlpha: number;
  hintTextColor: string;
  dotActive: number;
  dotActiveGlow: number;
  dotInactive: number;
  gridAmbient: { color: number; alpha: number };
}

export interface EffectsConfig {
  rgbSplit: boolean;
  rgbSplitLeft?: string;
  rgbSplitRight?: string;
  deactivateStyle: 'shrink' | 'glitch';
  wordFoundStyle: 'fill' | 'glitch-fill';
}

export interface SkinDefinition {
  id: string;
  name: string;
  price: 'free' | string;
  background: BackgroundConfig;
  tiles: {
    idle: TileState;
    selected: TileState;
    foundPending: TileState;
    deactivatedAlpha: number;
  };
  path: PathConfig;
  hints: {
    empty: HintSlotState;
    solved: HintSlotState;
  };
  chrome: ChromeConfig;
  effects: EffectsConfig;
}
