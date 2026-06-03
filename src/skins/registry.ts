export type SkinId = 'void' | 'lumen' | 'synthwave' | 'vector' | 'cabinet' | 'zerg' | 'phantom' | 'catalyst' | 'yharnam' | 'aero' | 'zebes' | 'hyrule-antique' | 'dream-land' | 'kingdom' | 'dinosaur-land' | 'green-hill' | 'kamurocho' | 'graffiti-soul' | 'cyber-shinobi' | 'gameboy' | 'terminal' | 'phosphor' | 'bios' | 'pastel' | 'toaster' | 'inferno' | 'aperture' | 'polygon' | 'ring' | 'spirit' | 'phobos' | 'crimson' | 'underworld';

/**
 * Tile-shaped preview token set. Drives the mini-tile shown in the Settings
 * skin selector. The tokens here mirror the skin's selected-state values
 * because the selected state is the most distinctive look — it's what the
 * player sees during the active "I'm tracing a word" moment.
 *
 * We can't reuse the live CSS variables for the preview because those only
 * apply when the corresponding skin class is on `<html>`. The preview must
 * render in every skin's style regardless of which skin is currently active,
 * so the values are baked in here and applied via inline styles.
 */
export type SkinPreviewTile = {
  /** Background gradient or solid color (CSS `background` value). */
  bg: string;
  /** 1px border color around the tile. */
  border: string;
  /** Letter color inside the tile. */
  letter: string;
  /** Outer glow color (CSS `box-shadow` color). */
  glow: string;
  /** Tile-letter font-family for this skin, so the preview shows the real font. */
  font: string;
  /** Corner radius as a CSS length ('8px', '0', …), mirroring the skin's tile radius. */
  radius: string;
  /** Font-size multiplier so display/pixel fonts sit correctly in the swatch. */
  scale: number;
};

export type SkinMeta = {
  id: SkinId;
  name: string;
  productId: string | null;
  bundleProductId?: string;
  /**
   * Achievement ID that unlocks this skin for free on all platforms.
   * If earned, the player owns the skin regardless of IAP status.
   * IAP remains an alternative unlock path on native builds.
   */
  unlockedByAchievement?: string;
  /**
   * Human-readable unlock condition shown in the locked skin card,
   * e.g. "10 puzzles solved" or "30-day streak".
   */
  unlockHint?: string;
  previewTile: SkinPreviewTile;
};

export const SKINS: SkinMeta[] = [
  {
    id: 'void',
    name: 'Void',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #0d3a42, #071e26)',
      border: '#00d4e8',
      letter: '#9af0ff',
      glow: 'rgba(0, 212, 232, 0.4)',
      font: "'Space Mono', ui-monospace, monospace",
      radius: '8px',
      scale: 1
    }
  },
  {
    id: 'lumen',
    name: 'Lumen',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #4fddef, #00b9d4)',
      border: '#00d4e8',
      letter: '#04323c',
      glow: 'rgba(0, 212, 232, 0.5)',
      font: "'Space Mono', ui-monospace, monospace",
      radius: '8px',
      scale: 1
    }
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    productId: 'skin_synthwave',
    bundleProductId: 'skin_bundle',
    unlockedByAchievement: 'solve_10',
    unlockHint: '10 puzzles solved',
    previewTile: {
      bg: 'linear-gradient(145deg, #ff2bd6, #6a0f9a)',
      border: '#ff7af0',
      letter: '#ffffff',
      glow: 'rgba(255, 43, 214, 0.6)',
      font: "'Orbitron', sans-serif",
      radius: '10px',
      scale: 0.84
    }
  },
  {
    id: 'vector',
    name: 'Vector',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #004050, #001a24)',
      border: '#00f0ff',
      letter: '#ffffff',
      glow: 'rgba(0, 240, 255, 0.5)',
      font: "'Orbitron', sans-serif",
      radius: '4px',
      scale: 0.84
    }
  },
  {
    id: 'cabinet',
    name: 'Cabinet',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #181826, #050510)',
      border: '#ffde00',
      letter: '#ffde00',
      glow: 'rgba(255, 222, 0, 0.45)',
      font: "'Press Start 2P', monospace",
      radius: '0',
      scale: 0.62
    }
  },
  {
    id: 'zerg',
    name: 'Zerg',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #7a1f60, #3a0a2c)',
      border: '#ff66d4',
      letter: '#ffffff',
      glow: 'rgba(255, 102, 212, 0.5)',
      font: "'Orbitron', sans-serif",
      radius: '12px',
      scale: 0.84
    }
  },
  {
    id: 'phantom',
    name: 'Phantom',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #ff1235, #8a0013)',
      border: '#ffffff',
      letter: '#ffffff',
      glow: 'rgba(255, 27, 61, 0.62)',
      font: "'Oswald', sans-serif",
      radius: '3px',
      scale: 0.92
    }
  },
  {
    id: 'catalyst',
    name: 'Catalyst',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #222630, #11141a)',
      border: '#11141a',
      letter: '#ffffff',
      glow: 'rgba(0, 0, 0, 0.15)',
      font: "'Antonio', sans-serif",
      radius: '6px',
      scale: 0.95
    }
  },
  {
    id: 'yharnam',
    name: 'Yharnam',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #300c14, #180307)',
      border: '#801a24',
      letter: '#ffffff',
      glow: 'rgba(128, 26, 36, 0.5)',
      font: "'Almendra', serif",
      radius: '2px',
      scale: 0.9
    }
  },
  {
    id: 'aero',
    name: 'Aero',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #3da7e1, #106294)',
      border: '#7ec5f0',
      letter: '#ffffff',
      glow: 'rgba(61, 167, 225, 0.5)',
      font: "'Comfortaa', cursive",
      radius: '16px',
      scale: 0.88
    }
  },
  {
    id: 'zebes',
    name: 'Zebes',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #e65c00, #993d00)',
      border: '#ff944d',
      letter: '#ffffff',
      glow: 'rgba(230, 92, 0, 0.6)',
      font: "'Share Tech Mono', monospace",
      radius: '6px',
      scale: 1.02
    }
  },
  {
    id: 'hyrule-antique',
    name: 'Hyrule Antique',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #1f4480, #0f2447)',
      border: '#4682b4',
      letter: '#ffffff',
      glow: 'rgba(31, 68, 128, 0.6)',
      font: "'Almendra', serif",
      radius: '4px',
      scale: 0.88
    }
  },
  {
    id: 'dream-land',
    name: 'Dream Land',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #ff66b2, #cc3377)',
      border: '#ff99cc',
      letter: '#ffffff',
      glow: 'rgba(255, 102, 178, 0.6)',
      font: "'Comfortaa', cursive",
      radius: '16px',
      scale: 0.85
    }
  },
  {
    id: 'kingdom',
    name: 'Kingdom',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #fc9838, #bc6800)',
      border: '#ffffff',
      letter: '#000000',
      glow: 'rgba(252, 152, 56, 0.55)',
      font: "'Pixelify Sans', monospace",
      radius: '0',
      scale: 1
    }
  },
  {
    id: 'dinosaur-land',
    name: 'Dinosaur Land',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #ffcc00, #cc9900)',
      border: '#ffffff',
      letter: '#1a0d00',
      glow: 'rgba(255, 204, 0, 0.6)',
      font: "'DotGothic16', sans-serif",
      radius: '8px',
      scale: 1.05
    }
  },
  {
    id: 'green-hill',
    name: 'Green Hill',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #0055ff, #0022aa)',
      border: '#80b3ff',
      letter: '#ffffff',
      glow: 'rgba(0, 85, 255, 0.6)',
      font: "'Rubik Mono One', sans-serif",
      radius: '12px',
      scale: 0.82
    }
  },
  {
    id: 'kamurocho',
    name: 'Kamurocho',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #d6001c, #4a0005)',
      border: '#ff4d62',
      letter: '#ffffff',
      glow: 'rgba(214, 0, 28, 0.55)',
      font: "'RocknRoll One', sans-serif",
      radius: '2px',
      scale: 0.85
    }
  },
  {
    id: 'graffiti-soul',
    name: 'Graffiti Soul',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #00e676, #006020)',
      border: '#000000',
      letter: '#ffffff',
      glow: 'rgba(0, 230, 118, 0.4)',
      font: "'Permanent Marker', cursive",
      radius: '8px',
      scale: 0.9
    }
  },
  {
    id: 'cyber-shinobi',
    name: 'Cyber Shinobi',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #ffffff, #99aab8)',
      border: '#ffffff',
      letter: '#05081a',
      glow: 'rgba(255, 255, 255, 0.5)',
      font: "'Electrolize', sans-serif",
      radius: '0',
      scale: 0.98
    }
  },
  {
    id: 'gameboy',
    name: 'Dot Matrix',
    productId: 'skin_gameboy',
    bundleProductId: 'skin_bundle',
    unlockedByAchievement: 'streak_30',
    unlockHint: '30-day streak',
    previewTile: {
      bg: 'linear-gradient(145deg, #b5d68f, #7ea05c)',
      border: '#1a2a1a',
      letter: '#0d1a0d',
      glow: 'rgba(181, 214, 143, 0.6)',
      font: "'Press Start 2P', monospace",
      radius: '0',
      scale: 0.62
    }
  },
  {
    id: 'terminal',
    name: 'Terminal',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #ffb000, #a86e00)',
      border: '#ffd86a',
      letter: '#1a1000',
      glow: 'rgba(255, 176, 0, 0.5)',
      font: "'VT323', monospace",
      radius: '2px',
      scale: 1.18
    }
  },
  {
    id: 'phosphor',
    name: 'Phosphor',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #39e832, #1a7a18)',
      border: '#a8f0b8',
      letter: '#010a02',
      glow: 'rgba(57, 232, 50, 0.55)',
      font: "'VT323', monospace",
      radius: '2px',
      scale: 1.18
    }
  },
  {
    id: 'bios',
    name: 'BIOS',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #2f9bff, #1357c8)',
      border: '#8cc6ff',
      letter: '#ffffff',
      glow: 'rgba(47, 155, 255, 0.55)',
      font: "'VT323', monospace",
      radius: '3px',
      scale: 1.18
    }
  },
  {
    id: 'pastel',
    name: 'Pastel',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #b486e8, #6d4fb0)',
      border: '#d8b8ff',
      letter: '#ffffff',
      glow: 'rgba(180, 134, 232, 0.5)',
      font: "'Silkscreen', monospace",
      radius: '10px',
      scale: 1.06
    }
  },
  {
    id: 'toaster',
    name: 'Toaster',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #e8281f, #9a0f0a)',
      border: '#ff6a5e',
      letter: '#ffffff',
      glow: 'rgba(232, 40, 31, 0.55)',
      font: "'Press Start 2P', monospace",
      radius: '0',
      scale: 0.62
    }
  },
  {
    id: 'inferno',
    name: 'Inferno',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #ff7a1e, #9a1505)',
      border: '#ffb45a',
      letter: '#fff5e0',
      glow: 'rgba(255, 90, 20, 0.6)',
      font: "'Cinzel', serif",
      radius: '5px',
      scale: 0.78
    }
  },
  {
    id: 'aperture',
    name: 'Aperture',
    productId: null,
    previewTile: {
      bg: 'radial-gradient(circle at 50% 38%, #5cc6ee, #1c93c8)',
      border: '#7fd6f4',
      letter: '#ffffff',
      glow: 'rgba(39, 167, 216, 0.55)',
      font: "'Oswald', sans-serif",
      radius: '0',
      scale: 0.92
    }
  },
  {
    id: 'polygon',
    name: 'Polygon',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #5aa8e8, #2f6fd6)',
      border: '#8fc4f0',
      letter: '#ffffff',
      glow: 'rgba(47, 111, 214, 0.5)',
      font: "'Space Mono', ui-monospace, monospace",
      radius: '8px',
      scale: 1
    }
  },
  {
    id: 'ring',
    name: 'Ring',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #4cd44e, #0e9e14)',
      border: '#7fe87f',
      letter: '#052a05',
      glow: 'rgba(43, 197, 43, 0.5)',
      font: "'Oswald', sans-serif",
      radius: '10px',
      scale: 0.92
    }
  },
  {
    id: 'spirit',
    name: 'Spirit',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #ff9a3c, #ef6a08)',
      border: '#ffbc78',
      letter: '#fff5ec',
      glow: 'rgba(244, 123, 32, 0.5)',
      font: "'Space Mono', ui-monospace, monospace",
      radius: '12px',
      scale: 1
    }
  },
  {
    id: 'phobos',
    name: 'Phobos',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #cc1111, #7a0a0a)',
      border: '#ff4444',
      letter: '#ffffff',
      glow: 'rgba(204, 17, 17, 0.6)',
      font: "'DooM', monospace",
      radius: '0',
      scale: 1
    }
  },
  {
    id: 'underworld',
    name: 'Underworld',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #e8a010, #9a6600)',
      border: '#ffe080',
      letter: '#1a0c00',
      glow: 'rgba(232, 160, 16, 0.7)',
      font: "'Cinzel', serif",
      radius: '8px',
      scale: 0.78
    }
  },
  {
    id: 'crimson',
    name: 'Crimson',
    productId: null,
    previewTile: {
      bg: 'linear-gradient(145deg, #ff2d2d, #8a0f12)',
      border: '#ff8a3d',
      letter: '#ffffff',
      glow: 'rgba(255, 45, 45, 0.55)',
      font: "'Orbitron', sans-serif",
      radius: '6px',
      scale: 0.84
    }
  }
];

const SKIN_CLASS_PREFIX = 'skin-';
const SKIN_CLASS_NAMES = SKINS.map((skin) => `${SKIN_CLASS_PREFIX}${skin.id}`);

export function normalizeSkinId(id: string | null | undefined): SkinId {
  return SKINS.some((skin) => skin.id === id) ? (id as SkinId) : 'void';
}

export function getCurrentSkinId(): SkinId {
  const classList = document.documentElement.classList;
  for (const skin of SKINS) {
    if (classList.contains(`${SKIN_CLASS_PREFIX}${skin.id}`)) {
      return skin.id;
    }
  }
  return 'void';
}

export function applySkin(skinId: SkinId): void {
  const root = document.documentElement;
  root.classList.remove(...SKIN_CLASS_NAMES);
  if (skinId !== 'void') {
    root.classList.add(`${SKIN_CLASS_PREFIX}${skinId}`);
  }
}