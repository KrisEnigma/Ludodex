'use strict';

// ── Skins ─────────────────────────────────────────────────────────────────────

const SKINS = [
  { id: 'void',             name: 'Void',             desc: 'Cold, focused, minimal. The default Ludodex look.' },
  { id: 'lumen',            name: 'Lumen',            desc: "Void's daytime counterpart. Same sharp identity, bright open surface." },
  { id: 'neon-horizon',     name: 'Neon Horizon',     desc: 'A neon city at night. All bloom, all glow.' },
  { id: 'laser-vector',     name: 'Laser Vector',     desc: 'Pure vector arcade. Like a coin-op cabinet from the future.' },
  { id: 'maze-chase',       name: 'Maze Chase',       desc: 'Classic maze arcade. Every move feels deliberate.' },
  { id: 'swarm',            name: 'Swarm',            desc: 'An alien hive-mind aesthetic. Creeping, organic, unsettling.' },
  { id: 'phantom-thieves',  name: 'Phantom Thieves',  desc: 'Stylish and theatrical. Pure heist energy.' },
  { id: 'catalyst',         name: 'Catalyst',         desc: 'Austere and high-velocity. Corporate dystopia.' },
  { id: 'paleblood',        name: 'Paleblood',        desc: 'Victorian gothic nightmare. Cold, grim, beautiful.' },
  { id: 'aero',             name: 'Aero',             desc: 'Peak 2000s. Gradients, gloss, and pure tech optimism.' },
  { id: 'star-hunter',      name: 'Star Hunter',      desc: "You're deep underground in an alien cavern, suit lights blazing." },
  { id: 'relic-gold',       name: 'Relic Gold',       desc: 'Dungeon crawler energy. Heavy stone, legendary reward.' },
  { id: 'puff-star',        name: 'Puff Star',        desc: 'Dreamy and soft. Midnight indigo with bubblegum clouds.' },
  { id: 'mushroom-kingdom', name: 'Mushroom Kingdom', desc: 'Flat overworld energy. NES-sharp, zero flourish.' },
  { id: 'cape-16bit',       name: '16-Bit Cape',      desc: 'Warm island overworld vibes. Chocolate earth, bright open sky.' },
  { id: 'blue-blur',        name: 'Blue Blur',        desc: 'Checkerboard loops and golden rings. You are going fast.' },
  { id: 'dragon-heat',      name: 'Dragon Heat',      desc: 'Underground nightlife. Hot, dangerous, neon-lit.' },
  { id: 'radio-tag',        name: 'Radio Tag',        desc: 'Counter-culture chaos. Spray cans and attitude.' },
  { id: 'cyber-shinobi',    name: 'Cyber Shinobi',    desc: 'Midnight espionage. Ninjutsu meets cyberpunk.' },
  { id: 'gameboy',          name: 'Dot Matrix',       desc: 'The original handheld. Four greens and nothing else.' },
  { id: 'terminal',         name: 'Terminal',         desc: 'Old terminal, no colour, full focus.' },
  { id: 'phosphor',         name: 'Phosphor',         desc: 'The glow of a monitor in a dark room. Nothing else exists.' },
  { id: 'bios',             name: 'BIOS',             desc: 'Booting up. That old PC feeling before anything loads.' },
  { id: 'super-16-bit-lilac', name: 'Super 16-Bit Lilac', desc: 'The calm confidence of a purple console.' },
  { id: 'toaster',          name: 'Toaster',          desc: 'Charcoal grey and one bold accent. The original home console look.' },
  { id: 'lord-of-terror',   name: 'Lord of Terror',   desc: 'Hell is other dungeon crawlers. Darker and heavier.' },
  { id: 'test-chamber',     name: 'Test Chamber',     desc: 'You are being tested. Stark, clinical, and unexpectedly orange.' },
  { id: 'polygon',          name: 'Polygon',          desc: 'Low-poly era. The PlayStation face buttons come alive.' },
  { id: 'ring-of-light',    name: 'Ring of Light',    desc: 'The green ring glows. Mid-2000s living room energy.' },
  { id: 'dream-spiral',     name: 'Dream Spiral',     desc: 'Swirl energy. The Dreamcast\'s optimistic, playful spirit.' },
  { id: 'rip-tear',         name: 'Rip & Tear',       desc: 'Rip and tear until it is done.' },
  { id: 'blood-darkness',   name: 'Blood & Darkness', desc: 'Underworld gold. Dark, mythic, relentless.' },
  { id: 'crimson',          name: 'Crimson',          desc: 'All red, all intensity. Pure boss fight.' },
];

// ── Inline SVG icons (mirroring src/components/icons.ts exactly) ─────────────

const ICON = {
  trophy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="icon icon-trophy"><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h2.5a1.5 1.5 0 0 1 1.5 1.5 3.5 3.5 0 0 1-3.5 3.5"/><path d="M7 5H4.5A1.5 1.5 0 0 0 3 6.5 3.5 3.5 0 0 0 6.5 10"/><path d="M12 14v4"/><path d="M8 19h8"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="icon icon-settings"><line x1="4" y1="6" x2="7" y2="6"/><line x1="11" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="2"/><line x1="4" y1="12" x2="13" y2="12"/><line x1="17" y1="12" x2="20" y2="12"/><circle cx="15" cy="12" r="2"/><line x1="4" y1="18" x2="9" y2="18"/><line x1="13" y1="18" x2="20" y2="18"/><circle cx="11" cy="18" r="2"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="icon icon-lock"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="icon icon-chevron-right"><polyline points="9 6 15 12 9 18"/></svg>`,
  flame: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="icon icon-flame"><path d="M12 3 C 9 7 7 11 7 14 C 7 18 9 21 12 21 C 15 21 17 18 17 14 C 17 11 14 8 13 5 C 13 7 12 8 12 3 Z"/><path d="M12 11 C 10 13 10 16 12 18 C 14 16 14 13 12 11 Z"/></svg>`,
  bulb: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="icon icon-bulb"><path d="M9 16 C 9 12 6 11 6 8 C 6 4.7 8.7 2 12 2 C 15.3 2 18 4.7 18 8 C 18 11 15 12 15 16 Z"/><path d="M9 19 L 15 19"/></svg>`,
};

// ── Confetti helper ───────────────────────────────────────────────────────────
// Static confetti scattered across the win view, colored by current skin vars.
// Pieces are absolutely positioned so they don't affect layout.

function buildConfettiMarkup() {
  // 16 pieces: mix of circles and rectangles, scattered at varying depths
  const pieces = [
    { shape: 'circle', colorVar: '--title-glow',          top: '7%',  left: '12%', r: 6,  rot: 20  },
    { shape: 'rect',   colorVar: '--path-grad-start',     top: '11%', left: '58%', w: 8,  h: 14, rot: -15 },
    { shape: 'circle', colorVar: '--title-color',         top: '15%', left: '82%', r: 5,  rot: 0   },
    { shape: 'rect',   colorVar: '--tile-selected-border',top: '22%', left: '28%', w: 10, h: 7,  rot: 34  },
    { shape: 'circle', colorVar: '--path-grad-end',       top: '28%', left: '73%', r: 7,  rot: 0   },
    { shape: 'rect',   colorVar: '--title-glow',          top: '32%', left: '6%',  w: 7,  h: 12, rot: -28 },
    { shape: 'circle', colorVar: '--primary-action-bg',   top: '38%', left: '44%', r: 5,  rot: 0   },
    { shape: 'rect',   colorVar: '--path-grad-start',     top: '44%', left: '88%', w: 9,  h: 6,  rot: 18  },
    { shape: 'circle', colorVar: '--tile-selected-border',top: '50%', left: '20%', r: 6,  rot: 0   },
    { shape: 'rect',   colorVar: '--title-color',         top: '56%', left: '65%', w: 8,  h: 13, rot: -8  },
    { shape: 'circle', colorVar: '--path-grad-end',       top: '62%', left: '38%', r: 4,  rot: 0   },
    { shape: 'rect',   colorVar: '--title-glow',          top: '67%', left: '5%',  w: 11, h: 7,  rot: 42  },
    { shape: 'circle', colorVar: '--primary-action-bg',   top: '72%', left: '78%', r: 5,  rot: 0   },
    { shape: 'rect',   colorVar: '--path-grad-start',     top: '77%', left: '52%', w: 7,  h: 10, rot: -22 },
    { shape: 'circle', colorVar: '--tile-selected-border',top: '83%', left: '18%', r: 6,  rot: 0   },
    { shape: 'rect',   colorVar: '--title-color',         top: '88%', left: '91%', w: 9,  h: 6,  rot: 14  },
  ];

  return pieces.map(({ shape, colorVar, top, left, r, w, h, rot }) => {
    const isCircle = shape === 'circle';
    const width  = isCircle ? r * 2 : w;
    const height = isCircle ? r * 2 : h;
    const radius = isCircle ? '50%' : '2px';
    return `<div aria-hidden="true" style="position:absolute;top:${top};left:${left};width:${width}px;height:${height}px;border-radius:${radius};background:var(${colorVar});transform:rotate(${rot}deg);opacity:0.85;pointer-events:none;"></div>`;
  }).join('');
}

// ── Screen markups ────────────────────────────────────────────────────────────

const puzzleMarkup = `
  <div class="app-shell">
    <div class="view game-view">
      <div class="header">
        <button type="button" class="header-menu-button">← Menu</button>
        <div class="game-hint-counter">
          <span class="game-hint-counter-icon">${ICON.bulb}</span>
          <span class="game-hint-counter-count">5</span>
        </div>
        <span class="header-timer">0:18</span>
      </div>
      <div class="game-title-row">
        <h2 class="view-title">Dark Souls Bosses</h2>
      </div>
      <p class="game-puzzle-hint">I bet you died many times</p>
      <div class="grid-wrap">
        <div class="grid" aria-label="Static puzzle preview">
          <div class="tile" data-row="0" data-col="0" data-state="selected"><span class="tile-letter">G</span></div>
          <div class="tile" data-row="0" data-col="1" data-state="idle"><span class="tile-letter">S</span></div>
          <div class="tile" data-row="0" data-col="2" data-state="deactivated"><span class="tile-letter">E</span></div>
          <div class="tile" data-row="0" data-col="3" data-state="deactivated"><span class="tile-letter">A</span></div>
          <div class="tile" data-row="1" data-col="0" data-state="idle"><span class="tile-letter">N</span></div>
          <div class="tile" data-row="1" data-col="1" data-state="selected"><span class="tile-letter">W</span></div>
          <div class="tile" data-row="1" data-col="2" data-state="idle"><span class="tile-letter">I</span></div>
          <div class="tile" data-row="1" data-col="3" data-state="deactivated"><span class="tile-letter">T</span></div>
          <div class="tile" data-row="2" data-col="0" data-state="idle"><span class="tile-letter">I</span></div>
          <div class="tile" data-row="2" data-col="1" data-state="idle"><span class="tile-letter">F</span></div>
          <div class="tile" data-row="2" data-col="2" data-state="selected"><span class="tile-letter">Y</span></div>
          <div class="tile" data-row="2" data-col="3" data-state="deactivated"><span class="tile-letter">H</span></div>
          <div class="tile" data-row="3" data-col="0" data-state="selected"><span class="tile-letter">L</span></div>
          <div class="tile" data-row="3" data-col="1" data-state="selected"><span class="tile-letter">O</span></div>
          <div class="tile" data-row="3" data-col="2" data-state="selected"><span class="tile-letter">D</span></div>
          <div class="tile" data-row="3" data-col="3" data-state="selected"><span class="tile-letter">N</span></div>
        </div>
        <svg class="path-overlay" viewBox="0 0 332 332" preserveAspectRatio="none" aria-hidden="true">
          <g class="path-segments">
            <line class="path-seg" x1="38.5" y1="38.5" x2="123.5" y2="123.5" style="--seg-t: 0;"></line>
            <line class="path-seg" x1="123.5" y1="123.5" x2="208.5" y2="208.5" style="--seg-t: 0.2;"></line>
            <line class="path-seg" x1="208.5" y1="208.5" x2="293.5" y2="293.5" style="--seg-t: 0.4;"></line>
            <line class="path-seg" x1="293.5" y1="293.5" x2="208.5" y2="293.5" style="--seg-t: 0.6;"></line>
            <line class="path-seg" x1="208.5" y1="293.5" x2="123.5" y2="293.5" style="--seg-t: 0.8;"></line>
            <line class="path-seg" x1="123.5" y1="293.5" x2="38.5" y2="293.5" style="--seg-t: 1;"></line>
          </g>
        </svg>
      </div>
      <div class="hints">
        <div class="hint-row" data-solved="false">
          <span class="hint-slot" data-filled="false"><span class="hint-slot-letter">G</span></span>
          <span class="hint-slot" data-filled="false"><span class="hint-slot-letter">W</span></span>
          <span class="hint-slot" data-filled="false"><span class="hint-slot-letter">Y</span></span>
          <span class="hint-slot" data-filled="false"><span class="hint-slot-letter">N</span></span>
        </div>
        <div class="hint-row" data-solved="false">
          <span class="hint-slot" data-filled="false"><span class="hint-slot-letter">G</span></span>
          <span class="hint-slot" data-filled="false"><span class="hint-slot-letter">W</span></span>
          <span class="hint-slot" data-filled="false"><span class="hint-slot-letter">Y</span></span>
          <span class="hint-slot" data-filled="false"><span class="hint-slot-letter">N</span></span>
          <span class="hint-slot" data-filled="false"><span class="hint-slot-letter">D</span></span>
          <span class="hint-slot" data-filled="false"><span class="hint-slot-letter">O</span></span>
          <span class="hint-slot" data-filled="false"><span class="hint-slot-letter">L</span></span>
          <span class="hint-slot" data-filled="false"><span class="hint-slot-letter">I</span></span>
          <span class="hint-slot" data-filled="false"><span class="hint-slot-letter">N</span></span>
        </div>
        <div class="hint-row" data-solved="true">
          <span class="hint-slot" data-filled="true"><span class="hint-slot-letter">S</span></span>
          <span class="hint-slot" data-filled="true"><span class="hint-slot-letter">E</span></span>
          <span class="hint-slot" data-filled="true"><span class="hint-slot-letter">A</span></span>
          <span class="hint-slot" data-filled="true"><span class="hint-slot-letter">T</span></span>
          <span class="hint-slot" data-filled="true"><span class="hint-slot-letter">H</span></span>
        </div>
        <div class="hint-row" data-solved="false">
          <span class="hint-slot" data-filled="false"><span class="hint-slot-letter">S</span></span>
          <span class="hint-slot" data-filled="false"><span class="hint-slot-letter">I</span></span>
          <span class="hint-slot" data-filled="false"><span class="hint-slot-letter">F</span></span>
        </div>
      </div>
    </div>
  </div>
`;

// winMarkup: generated at call time so confetti uses current CSS var values
function buildWinMarkup() {
  return `
  <div class="app-shell">
    <div class="view win-view" data-stars="3">
      <div class="win-view-shell" style="position:relative;z-index:1;">
        <div class="win-headline" data-pristine="true">
          <div class="win-stars">
            <span class="win-star" data-filled="true" data-position="1">★</span>
            <span class="win-star" data-filled="true" data-position="2">★</span>
            <span class="win-star" data-filled="true" data-position="3">★</span>
          </div>
          <span class="win-headline-label">Flawless</span>
        </div>
        <h2 class="view-title">Dark Souls Bosses</h2>
        <div class="win-time">0:07</div>
        <div class="win-pill-row"></div>
        <button type="button" class="win-share-button button-primary">Share</button>
        <div class="win-secondary-row">
          <button type="button" class="win-play-again button-secondary">Play again</button>
          <button type="button" class="win-done-link button-tertiary">Done</button>
        </div>
      </div>
      <div style="position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:8;" aria-hidden="true">
        ${buildConfettiMarkup()}
      </div>
    </div>
  </div>
`;
}

const menuMarkup = `
  <div class="app-shell">
    <div class="view menu-view">
      <div class="menu-top-bar">
        <button type="button" class="menu-icon-button" aria-label="Achievements">${ICON.trophy}</button>
        <button type="button" class="menu-icon-button" aria-label="Settings">${ICON.settings}</button>
      </div>
      <h1 class="menu-logo">LUDODEX</h1>
      <div class="stats-strip">
        <div class="stat-card" data-highlight="true">
          <span class="stat-value-row">
            <span class="stat-fire-icon">${ICON.flame}</span>
            <span class="stat-value">7</span>
          </span>
          <span class="stat-label">Streak</span>
        </div>
        <div class="stat-card">
          <span class="stat-value-row">
            <span class="stat-value">42</span>
          </span>
          <span class="stat-label">Solved</span>
        </div>
        <div class="stat-card">
          <span class="stat-value-row">
            <span class="stat-value">0:34</span>
          </span>
          <span class="stat-label">Best</span>
        </div>
      </div>
      <div class="menu-daily-section">
        <div class="daily-card">
          <div class="daily-card-head">
            <span class="daily-card-tag">Today · #142</span>
            <span class="daily-card-countdown">23:41:06</span>
          </div>
          <h2 class="daily-card-title">Dark Souls Bosses</h2>
          <div class="daily-card-meta">
            <span class="puzzle-tag puzzle-tag-category">Games</span>
            <span class="puzzle-tag puzzle-tag-difficulty">Hard</span>
          </div>
          <button type="button" class="daily-play-button button-primary">Play</button>
        </div>
        <button type="button" class="yesterday-card" data-status="solved">
          <div class="yesterday-card-content">
            <div class="yesterday-card-label">Yesterday · #141</div>
            <div class="yesterday-card-title">Sonic Zones</div>
            <div class="yesterday-card-status">
              <span class="yesterday-card-stars">★★★</span>
              <span class="yesterday-card-time">0:22</span>
            </div>
          </div>
          <span class="yesterday-card-chevron">${ICON.chevronRight}</span>
        </button>
      </div>
      <div class="menu-footer-actions">
        <button type="button" class="menu-footer-action button-tertiary">Archive</button>
        <button type="button" class="menu-footer-action button-tertiary">How to Play</button>
      </div>
    </div>
  </div>
`;

const achievementsMarkup = `
  <div class="app-shell">
    <div class="view achievements-view">
      <div class="view-topbar">
        <button type="button" class="view-topbar-back">← Back</button>
        <h2 class="view-topbar-title">Achievements</h2>
        <span style="width:56px;"></span>
      </div>
      <div class="achievements-summary">
        <div class="achievements-summary-count">
          <span class="achievements-summary-earned">12</span>
          <span class="achievements-summary-total">/28</span>
        </div>
        <div class="achievements-summary-label">unlocked</div>
        <div class="achievements-summary-bar" role="progressbar" aria-valuemin="0" aria-valuemax="28" aria-valuenow="12">
          <div class="achievements-summary-bar-fill" style="width:43%"></div>
        </div>
      </div>
      <div class="achievements-list">
        <section class="achievements-section">
          <div class="achievements-section-heading">
            <span class="achievements-section-label">Streak</span>
            <span class="achievements-section-count">2/4</span>
          </div>
          <div class="achievement-row" data-earned="true">
            <div class="achievement-row-icon" aria-hidden="true">${ICON.trophy}</div>
            <div class="achievement-row-text">
              <div class="achievement-row-name">On a Roll</div>
              <div class="achievement-row-description">Maintain a 3-day streak</div>
              <div class="achievement-row-status">Earned May 12, 2026</div>
            </div>
          </div>
          <div class="achievement-row" data-earned="true">
            <div class="achievement-row-icon" aria-hidden="true">${ICON.trophy}</div>
            <div class="achievement-row-text">
              <div class="achievement-row-name">Week Warrior</div>
              <div class="achievement-row-description">Maintain a 7-day streak</div>
              <div class="achievement-row-status">Earned May 18, 2026</div>
            </div>
          </div>
          <div class="achievement-row" data-earned="false">
            <div class="achievement-row-icon" aria-hidden="true">${ICON.lock}</div>
            <div class="achievement-row-text">
              <div class="achievement-row-name">Unstoppable</div>
              <div class="achievement-row-description">Maintain a 30-day streak</div>
            </div>
          </div>
          <div class="achievement-row" data-earned="false">
            <div class="achievement-row-icon" aria-hidden="true">${ICON.lock}</div>
            <div class="achievement-row-text">
              <div class="achievement-row-name">Century</div>
              <div class="achievement-row-description">Maintain a 100-day streak</div>
            </div>
          </div>
        </section>
        <section class="achievements-section">
          <div class="achievements-section-heading">
            <span class="achievements-section-label">Speed</span>
            <span class="achievements-section-count">1/3</span>
          </div>
          <div class="achievement-row" data-earned="true">
            <div class="achievement-row-icon" aria-hidden="true">${ICON.trophy}</div>
            <div class="achievement-row-text">
              <div class="achievement-row-name">Speed Demon</div>
              <div class="achievement-row-description">Solve a puzzle under 30 seconds</div>
              <div class="achievement-row-status">Earned June 1, 2026</div>
            </div>
          </div>
          <div class="achievement-row" data-earned="false">
            <div class="achievement-row-icon" aria-hidden="true">${ICON.lock}</div>
            <div class="achievement-row-text">
              <div class="achievement-row-name">Blink and Miss It</div>
              <div class="achievement-row-description">Solve a puzzle under 10 seconds</div>
            </div>
          </div>
          <div class="achievement-row" data-earned="false">
            <div class="achievement-row-icon" aria-hidden="true">${ICON.lock}</div>
            <div class="achievement-row-text">
              <div class="achievement-row-name">Lightning</div>
              <div class="achievement-row-description">Solve a puzzle under 5 seconds</div>
            </div>
          </div>
        </section>
        <section class="achievements-section">
          <div class="achievements-section-heading">
            <span class="achievements-section-label">Volume</span>
            <span class="achievements-section-count">3/4</span>
          </div>
          <div class="achievement-row" data-earned="true">
            <div class="achievement-row-icon" aria-hidden="true">${ICON.trophy}</div>
            <div class="achievement-row-text">
              <div class="achievement-row-name">First Steps</div>
              <div class="achievement-row-description">Solve your first puzzle</div>
              <div class="achievement-row-status">Earned April 3, 2026</div>
            </div>
          </div>
          <div class="achievement-row" data-earned="false">
            <div class="achievement-row-icon" aria-hidden="true">${ICON.lock}</div>
            <div class="achievement-row-text">
              <div class="achievement-row-name">Centurion</div>
              <div class="achievement-row-description">Solve 100 puzzles</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
`;

const archiveMarkup = `
  <div class="app-shell">
    <div class="view archive-view">
      <div class="view-topbar">
        <button type="button" class="view-topbar-back">← Back</button>
        <h2 class="view-topbar-title">Archive</h2>
        <span style="width:56px;"></span>
      </div>
      <div class="archive-list">
        <button type="button" class="archive-row" data-solved="true">
          <div class="archive-row-label">
            <span class="archive-row-number">#141</span>
            <span class="archive-row-title">Sonic Zones</span>
          </div>
          <div class="archive-row-meta">
            <span class="archive-row-stars" data-rating="3">★★★</span>
            <span class="archive-row-status">0:22</span>
          </div>
        </button>
        <button type="button" class="archive-row" data-solved="true">
          <div class="archive-row-label">
            <span class="archive-row-number">#140</span>
            <span class="archive-row-title">Zelda Dungeons</span>
          </div>
          <div class="archive-row-meta">
            <span class="archive-row-stars" data-rating="2">★★☆</span>
            <span class="archive-row-status">1:04</span>
          </div>
        </button>
        <button type="button" class="archive-row" data-solved="false">
          <div class="archive-row-label">
            <span class="archive-row-number">#139</span>
            <span class="archive-row-title">Final Fantasy Jobs</span>
          </div>
          <div class="archive-row-meta">
            <span class="archive-row-stars"></span>
            <span class="archive-row-status">Unsolved</span>
          </div>
        </button>
        <button type="button" class="archive-row" data-solved="true">
          <div class="archive-row-label">
            <span class="archive-row-number">#138</span>
            <span class="archive-row-title">Pokémon Types</span>
          </div>
          <div class="archive-row-meta">
            <span class="archive-row-stars" data-rating="3">★★★</span>
            <span class="archive-row-status">0:41</span>
          </div>
        </button>
        <button type="button" class="archive-row" data-solved="true">
          <div class="archive-row-label">
            <span class="archive-row-number">#137</span>
            <span class="archive-row-title">Mario Kart Tracks</span>
          </div>
          <div class="archive-row-meta">
            <span class="archive-row-stars" data-rating="1">★☆☆</span>
            <span class="archive-row-status">2:11</span>
          </div>
        </button>
        <button type="button" class="archive-row" data-solved="false">
          <div class="archive-row-label">
            <span class="archive-row-number">#136</span>
            <span class="archive-row-title">Metroid Bosses</span>
          </div>
          <div class="archive-row-meta">
            <span class="archive-row-stars"></span>
            <span class="archive-row-status">Unsolved</span>
          </div>
        </button>
      </div>
    </div>
  </div>
`;

const settingsMarkup = `
  <div class="app-shell">
    <div class="view settings-view">
      <div class="view-topbar">
        <button type="button" class="view-topbar-back">← Back</button>
        <h2 class="view-topbar-title">Settings</h2>
        <span style="width:56px;"></span>
      </div>
      <div class="settings-section">
        <h2 class="settings-section-heading">Language</h2>
        <div class="settings-language-toggle">
          <button type="button" class="settings-language-button" data-active="true">EN</button>
          <button type="button" class="settings-language-button">ES</button>
          <button type="button" class="settings-language-button">FR</button>
          <button type="button" class="settings-language-button">DE</button>
        </div>
      </div>
      <div class="settings-section">
        <h2 class="settings-section-heading">Skin</h2>
        <div class="settings-skin-cards">
          <button type="button" class="settings-skin-card" data-active="true">
            <div class="settings-skin-left">
              <div class="settings-skin-preview-scope skin-void">
                <div class="settings-skin-tile settings-skin-tile--default"></div>
                <div class="settings-skin-tile settings-skin-tile--selected"></div>
              </div>
              <span class="settings-skin-name">Void</span>
            </div>
            <span class="settings-skin-pill">Active</span>
          </button>
          <button type="button" class="settings-skin-card">
            <div class="settings-skin-left">
              <div class="settings-skin-preview-scope skin-neon-horizon">
                <div class="settings-skin-tile settings-skin-tile--default"></div>
                <div class="settings-skin-tile settings-skin-tile--selected"></div>
              </div>
              <span class="settings-skin-name">Neon Horizon</span>
            </div>
          </button>
          <button type="button" class="settings-skin-card">
            <div class="settings-skin-left">
              <div class="settings-skin-preview-scope skin-lumen">
                <div class="settings-skin-tile settings-skin-tile--default"></div>
                <div class="settings-skin-tile settings-skin-tile--selected"></div>
              </div>
              <span class="settings-skin-name">Lumen</span>
            </div>
          </button>
          <button type="button" class="settings-skin-card" data-locked="true">
            <div class="settings-skin-left">
              <div class="settings-skin-preview-scope skin-relic-gold">
                <div class="settings-skin-tile settings-skin-tile--default"></div>
                <div class="settings-skin-tile settings-skin-tile--selected"></div>
              </div>
              <span class="settings-skin-name">Relic Gold</span>
            </div>
            <span class="settings-skin-pill">Pro</span>
          </button>
        </div>
      </div>
      <div class="settings-section">
        <button type="button" class="button-tertiary">Restore purchases</button>
      </div>
      <div class="settings-section">
        <p style="font-size:11px;color:var(--chrome-text);text-align:center;margin:0;">Ludodex v1.0.0 · Made with ♥</p>
      </div>
    </div>
  </div>
`;

const modalMarkup = `
  <div class="app-shell" style="position:relative;">
    <div class="view game-view" style="filter:blur(2px);pointer-events:none;user-select:none;opacity:0.6;">
      <div class="header">
        <button type="button" class="header-menu-button">← Menu</button>
        <div class="game-hint-counter">
          <span class="game-hint-counter-icon">${ICON.bulb}</span>
          <span class="game-hint-counter-count">5</span>
        </div>
        <span class="header-timer">0:18</span>
      </div>
      <div class="game-title-row">
        <h2 class="view-title">Dark Souls Bosses</h2>
      </div>
      <div class="grid-wrap">
        <div class="grid">
          <div class="tile" data-state="idle"><span class="tile-letter">G</span></div>
          <div class="tile" data-state="idle"><span class="tile-letter">S</span></div>
          <div class="tile" data-state="deactivated"><span class="tile-letter">E</span></div>
          <div class="tile" data-state="deactivated"><span class="tile-letter">A</span></div>
          <div class="tile" data-state="idle"><span class="tile-letter">N</span></div>
          <div class="tile" data-state="selected"><span class="tile-letter">W</span></div>
          <div class="tile" data-state="idle"><span class="tile-letter">I</span></div>
          <div class="tile" data-state="deactivated"><span class="tile-letter">T</span></div>
          <div class="tile" data-state="idle"><span class="tile-letter">I</span></div>
          <div class="tile" data-state="idle"><span class="tile-letter">F</span></div>
          <div class="tile" data-state="selected"><span class="tile-letter">Y</span></div>
          <div class="tile" data-state="deactivated"><span class="tile-letter">H</span></div>
          <div class="tile" data-state="idle"><span class="tile-letter">L</span></div>
          <div class="tile" data-state="idle"><span class="tile-letter">O</span></div>
          <div class="tile" data-state="idle"><span class="tile-letter">D</span></div>
          <div class="tile" data-state="idle"><span class="tile-letter">N</span></div>
        </div>
      </div>
      <div class="hints" style="margin-top:auto;">
        <div class="hint-row" data-solved="false">
          <span class="hint-slot" data-filled="false"><span class="hint-slot-letter">G</span></span>
          <span class="hint-slot" data-filled="false"><span class="hint-slot-letter">W</span></span>
          <span class="hint-slot" data-filled="false"><span class="hint-slot-letter">Y</span></span>
          <span class="hint-slot" data-filled="false"><span class="hint-slot-letter">N</span></span>
        </div>
      </div>
    </div>
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true">
        <h3 class="modal-title">Use a hint?</h3>
        <p class="modal-body">This will reveal one letter in a random unsolved word. You have 5 hints remaining.</p>
        <div class="modal-buttons">
          <button type="button" class="modal-button modal-button-cancel">Cancel</button>
          <button type="button" class="modal-button modal-button-confirm">Use hint</button>
        </div>
      </div>
    </div>
  </div>
`;

const SCREENS = [
  { id: 'game',         label: 'Game',         markup: () => puzzleMarkup },
  { id: 'win',          label: 'Win',          markup: () => buildWinMarkup() },
  { id: 'menu',         label: 'Menu',         markup: () => menuMarkup },
  { id: 'achievements', label: 'Achievements', markup: () => achievementsMarkup },
  { id: 'archive',      label: 'Archive',      markup: () => archiveMarkup },
  { id: 'settings',     label: 'Settings',     markup: () => settingsMarkup },
  { id: 'modal',        label: 'Modal',        markup: () => modalMarkup },
];

// ── Fonts ─────────────────────────────────────────────────────────────────────

const LOADED_FONTS = [
  { label: 'Space Mono',         value: "'Space Mono', ui-monospace, monospace" },
  { label: 'Share Tech Mono',    value: "'Share Tech Mono', monospace" },
  { label: 'Major Mono Display', value: "'Major Mono Display', monospace" },
  { label: 'Press Start 2P',     value: "'Press Start 2P', monospace" },
  { label: 'Squada One',         value: "'Squada One', sans-serif" },
  { label: 'Silkscreen',         value: "'Silkscreen', monospace" },
  { label: 'VT323',              value: "'VT323', monospace" },
  { label: 'Pixelify Sans',      value: "'Pixelify Sans', sans-serif" },
  { label: 'DotGothic16',        value: "'DotGothic16', sans-serif" },
  { label: 'Anton',              value: "'Anton', sans-serif" },
  { label: 'Orbitron',           value: "'Orbitron', sans-serif" },
  { label: 'Electrolize',        value: "'Electrolize', sans-serif" },
  { label: 'Audiowide',          value: "'Audiowide', sans-serif" },
  { label: 'Exo 2',              value: "'Exo 2', sans-serif" },
  { label: 'Unbounded',          value: "'Unbounded', sans-serif" },
  { label: 'Russo One',          value: "'Russo One', sans-serif" },
  { label: 'Teko',               value: "'Teko', sans-serif" },
  { label: 'Oswald',             value: "'Oswald', sans-serif" },
  { label: 'Antonio',            value: "'Antonio', sans-serif" },
  { label: 'Syncopate',          value: "'Syncopate', sans-serif" },
  { label: 'Righteous',          value: "'Righteous', sans-serif" },
  { label: 'RocknRoll One',      value: "'RocknRoll One', sans-serif" },
  { label: 'Titan One',          value: "'Titan One', cursive" },
  { label: 'Luckiest Guy',       value: "'Luckiest Guy', cursive" },
  { label: 'Permanent Marker',   value: "'Permanent Marker', cursive" },
  { label: 'Bungee',             value: "'Bungee', sans-serif" },
  { label: 'Dela Gothic One',    value: "'Dela Gothic One', sans-serif" },
  { label: 'Rubik Mono One',     value: "'Rubik Mono One', monospace" },
  { label: 'Comfortaa',          value: "'Comfortaa', sans-serif" },
  { label: 'Cinzel',             value: "'Cinzel', serif" },
  { label: 'Cinzel Decorative',  value: "'Cinzel Decorative', serif" },
  { label: 'Almendra',           value: "'Almendra', serif" },
  { label: 'UnifrakturMaguntia', value: "'UnifrakturMaguntia', serif" },
];

/** Normalize a font-family value to its primary face name for fuzzy matching. */
function normalizeFontName(fontFamily) {
  return fontFamily.split(',')[0].trim().replace(/['"]/g, '').trim().toLowerCase();
}

// ── Google Fonts runtime loader ───────────────────────────────────────────────
// Fonts loaded here are intentionally kept separate from LOADED_FONTS so that
// buildFontSnippet() still correctly flags them as needing @fontsource setup.

const GOOGLE_LOADED_FONTS = [];

/**
 * Inject a Google Fonts stylesheet for `fontName` and register it as a
 * selectable option in every font-family dropdown on the page.
 * Returns the CSS font-family value string, e.g. "'Roboto', sans-serif".
 */
function loadGoogleFont(fontName) {
  const name = fontName.trim().replace(/['"]/g, '').trim();
  if (!name) return null;

  const family = name.replace(/\s+/g, '+');
  const url = `https://fonts.googleapis.com/css2?family=${family}:ital,wght@0,400;0,700;1,400&display=swap`;
  const linkId = `gfont-${name.toLowerCase().replace(/\s+/g, '-')}`;

  if (!document.getElementById(linkId)) {
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
  }

  const cssValue = `'${name}', sans-serif`;
  const alreadyTracked = GOOGLE_LOADED_FONTS.some(
    (f) => normalizeFontName(f.value) === normalizeFontName(cssValue)
  );

  if (!alreadyTracked) {
    GOOGLE_LOADED_FONTS.push({ label: `${name} (Google)`, value: cssValue });
    // Add to every existing font-family dropdown immediately
    for (const select of document.querySelectorAll('.creator-font-stack select')) {
      const opt = document.createElement('option');
      opt.value = cssValue;
      opt.textContent = `${name} (Google)`;
      select.appendChild(opt);
    }
  }

  return cssValue;
}

// ── Variable groups ───────────────────────────────────────────────────────────

const VAR_GROUPS = [
  {
    id: 'background',
    label: 'Background',
    vars: [
      { name: '--bg-center', label: 'Center', type: 'color', default: '#0d1118' },
      { name: '--bg-edge',   label: 'Edge',   type: 'color', default: '#07090e' },
    ],
  },
  {
    id: 'chrome',
    label: 'Colors',
    vars: [
      { name: '--chrome-text',      label: 'UI text',         type: 'color',  default: '#8590a7' },
      { name: '--title-color',      label: 'Primary text',    type: 'color',  default: '#cfd6e1' },
      { name: '--title-glow',       label: 'Accent color',    type: 'color',  default: '#00d4e8' },
      { name: '--title-glow-alpha', label: 'Glow intensity',  type: 'range', min: 0, max: 100, step: 1,   unit: '%', default: '40%' },
      { name: '--glow-strength',    label: 'Glow multiplier', type: 'range', min: 0, max: 5,   step: 0.1, unit: '',  default: '1' },
    ],
  },
  {
    id: 'wordmark-typography',
    label: 'Typography — Wordmark',
    vars: [
      { name: '--wordmark-font-family',    label: 'Font family',    type: 'font-family', default: "'Space Mono', ui-monospace, monospace" },
      { name: '--wordmark-font-weight',    label: 'Font weight',    type: 'font-weight', default: '700' },
      { name: '--display-font-scale',      label: 'Scale',          type: 'range', min: 0.4, max: 2,    step: 0.05, unit: '',   default: '1' },
      { name: '--wordmark-letter-spacing', label: 'Letter spacing', type: 'range', min: -0.1, max: 0.8, step: 0.01, unit: 'em', default: '0.18em' },
      { name: '--title-text-transform',    label: 'Transform',      type: 'select', options: ['none', 'uppercase', 'lowercase'], default: 'none' },
    ],
  },
  {
    id: 'tile-typography',
    label: 'Typography — Tiles',
    vars: [
      { name: '--tile-font-family', label: 'Font family', type: 'font-family', default: "'Space Mono', ui-monospace, monospace" },
      { name: '--tile-font-weight', label: 'Font weight', type: 'font-weight', default: '700' },
      { name: '--tile-font-scale',  label: 'Scale',       type: 'range', min: 0.4, max: 2, step: 0.05, unit: '', default: '1' },
    ],
  },
  {
    id: 'tiles',
    label: 'Tiles',
    vars: [
      { name: '--tile-radius', label: 'Corner radius', type: 'range',    min: 0, max: 40, step: 1, unit: 'px', default: '14px' },
      { name: '--tile-bg',     label: 'Background',    type: 'gradient', default: 'linear-gradient(145deg, #1e2236, #131824)' },
      { name: '--tile-border', label: 'Border',        type: 'color',    default: '#2a3148' },
      { name: '--tile-letter', label: 'Letter',        type: 'color',    default: '#cfd6e1' },
    ],
  },
  {
    id: 'tile-selected',
    label: 'Tiles — Selected',
    vars: [
      { name: '--tile-selected-bg',        label: 'Background',     type: 'gradient', default: 'linear-gradient(145deg, #0d3a42, #071e26)' },
      { name: '--tile-selected-border',    label: 'Border',         type: 'color',    default: '#00d4e8' },
      { name: '--tile-selected-letter',    label: 'Letter',         type: 'color',    default: '#9af0ff' },
      { name: '--tile-selected-glow',      label: 'Glow',           type: 'color',    default: 'rgba(0, 212, 232, 0.4)' },
      { name: '--selected-letter-outline', label: 'Letter outline', type: 'color',    default: '#04121a' },
    ],
  },
  {
    id: 'path',
    label: 'Selection Path',
    vars: [
      { name: '--path-color',      label: 'Trail color',    type: 'color',  default: '#00d4e8' },
      { name: '--path-grad-start', label: 'Gradient start', type: 'color',  default: '#8a7bff' },
      { name: '--path-grad-end',   label: 'Gradient end',   type: 'color',  default: '#22e0f0' },
      { name: '--path-width',      label: 'Width',          type: 'range',  min: 1, max: 24, step: 0.5, unit: 'px', default: '9px' },
      { name: '--path-cap',        label: 'Cap style',      type: 'select', options: ['round', 'square', 'butt'], default: 'round' },
      { name: '--path-opacity',    label: 'Opacity',        type: 'range',  min: 0, max: 1,  step: 0.05, unit: '',   default: '0.95' },
      { name: '--path-glow',       label: 'Glow blur (px)', type: 'range',  min: 0, max: 30, step: 1,    unit: '',   default: '7' },
    ],
  },
  {
    id: 'buttons',
    label: 'Buttons',
    vars: [
      { name: '--button-bg',     label: 'Background', type: 'gradient', default: '#131824' },
      { name: '--button-border', label: 'Border',     type: 'color',    default: '#2a3148' },
      { name: '--button-text',   label: 'Text',       type: 'color',    default: '#cfd6e1' },
    ],
  },
  {
    id: 'primary-action',
    label: 'Primary Action',
    vars: [
      { name: '--primary-action-bg',   label: 'Background', type: 'color', default: '#00d4e8' },
      { name: '--primary-action-text', label: 'Text',       type: 'color', default: '#07090e' },
    ],
  },
  {
    id: 'hints',
    label: 'Hints',
    vars: [
      { name: '--hint-empty-bg',     label: 'Empty bg',     type: 'color', default: 'rgba(20, 24, 34, 0.19)' },
      { name: '--hint-empty-border', label: 'Empty border', type: 'color', default: '#2a3148' },
      { name: '--hint-solved-bg',    label: 'Solved bg',    type: 'color', default: '#0d3a42' },
      { name: '--hint-solved-border',label: 'Solved border',type: 'color', default: '#00d4e8' },
      { name: '--hint-solved-letter',label: 'Solved letter',type: 'color', default: '#9af0ff' },
    ],
  },
];

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  screenId: 'game',
  vars: {},
  customCSS: '',
  // Snapshot of vars at last preset-load (or defaults if no preset loaded).
  // Used by the per-row ↺ reset button.
  presetVars: {},
  presetCustomCSS: '',
};

function initVarsFromDefaults() {
  for (const group of VAR_GROUPS) {
    for (const v of group.vars) {
      state.vars[v.name] = v.default;
    }
  }
  // Baseline = defaults when no preset is loaded
  state.presetVars = { ...state.vars };
  state.presetCustomCSS = '';
}

// ── Color utilities ───────────────────────────────────────────────────────────

function cssColorToHex(color) {
  if (!color || color === 'transparent' || color === 'none') return '#000000';
  const clean = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(clean)) return clean.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(clean)) {
    const [, r, g, b] = clean.match(/^#(.)(.)(.)$/i);
    return '#' + [r + r, g + g, b + b].join('').toLowerCase();
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillStyle = clean;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
  } catch {
    return '#000000';
  }
}

function nameToSlug(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'my-skin';
}

// ── Preview ───────────────────────────────────────────────────────────────────

const previewEl = document.getElementById('creatorPreview');

function updatePreview() {
  const screen = SCREENS.find((s) => s.id === state.screenId) || SCREENS[0];
  previewEl.innerHTML = screen.markup();

  // Use setProperty for reliable custom-property application
  previewEl.removeAttribute('style');
  for (const [k, v] of Object.entries(state.vars)) {
    if (v !== '' && v !== null && v !== undefined) {
      previewEl.style.setProperty(k, v);
    }
  }

  // `:root` defines derived vars via var(...) chains, but those resolve against
  // :root — not against the inline-style scope on #creatorPreview. Mirror every
  // value that has a non-obvious derived alias so the preview stays in sync.
  const wf  = state.vars['--wordmark-font-family'];
  if (wf)  previewEl.style.setProperty('--title-font-family', wf);
  const ww  = state.vars['--wordmark-font-weight'];
  if (ww)  previewEl.style.setProperty('--title-font-weight', ww);
  const wls = state.vars['--wordmark-letter-spacing'];
  if (wls) previewEl.style.setProperty('--title-letter-spacing', wls);
  // --title-font-scale and its derived vars are defined on :root via var() chains,
  // but :root vars don't resolve inside the inline-style scope on #creatorPreview.
  // Mirror all five explicitly so font-size calc() expressions see the right value.
  const dfs = state.vars['--display-font-scale'];
  if (dfs) {
    previewEl.style.setProperty('--title-font-scale',    dfs);
    previewEl.style.setProperty('--wordmark-font-scale', dfs);
    previewEl.style.setProperty('--level-title-scale',   dfs);
    previewEl.style.setProperty('--menu-logo-scale',     dfs);
    previewEl.style.setProperty('--win-timer-scale',     dfs);
  }

  let styleTag = document.getElementById('creator-custom-style');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'creator-custom-style';
    document.head.appendChild(styleTag);
  }
  // Auto-scope custom CSS to the preview container using @scope
  const css = state.customCSS.trim();
  styleTag.textContent = css ? `@scope (.creator-preview) {\n${css}\n}` : '';
}

// ── Accordion open-state persistence ─────────────────────────────────────────

const OPEN_GROUPS_KEY = 'skin-creator-open-groups';

function getSavedOpenGroups() {
  try {
    const raw = localStorage.getItem(OPEN_GROUPS_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return null; // null = use hardcoded defaults
}

function saveOpenGroups() {
  try {
    const open = [...document.querySelectorAll('.creator-group[open]')]
      .map((el) => el.dataset.groupId);
    localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(open));
  } catch {}
}

// ── Editor rendering ──────────────────────────────────────────────────────────

const editorInner = document.getElementById('creatorEditorInner');

function renderEditor() {
  // Rescue the textarea value before wiping (the element lives in the HTML on first render)
  const existingTextarea = document.getElementById('creatorCustomCSS');

  editorInner.innerHTML = '';

  const savedOpen = getSavedOpenGroups();
  const defaultOpen = new Set(['background', 'chrome', 'tiles', 'tile-selected']);

  for (const group of VAR_GROUPS) {
    const details = document.createElement('details');
    details.className = 'creator-group';
    details.open = savedOpen ? savedOpen.has(group.id) : defaultOpen.has(group.id);
    details.dataset.groupId = group.id;
    details.addEventListener('toggle', saveOpenGroups);

    const summary = document.createElement('summary');
    summary.className = 'creator-group-toggle';
    summary.innerHTML = `<span class="creator-group-label">${group.label}</span><span class="creator-group-chevron">▶</span>`;
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'creator-group-body';
    for (const varDef of group.vars) {
      body.appendChild(buildVarRow(varDef));
    }

    details.appendChild(body);
    editorInner.appendChild(details);
  }

  // Build the Custom CSS accordion in JS — identical construction to other groups
  // so Chrome renders the <summary> marker exactly the same way.
  const customDetails = document.createElement('details');
  customDetails.className = 'creator-group creator-custom-section';
  customDetails.dataset.groupId = 'custom-css';
  customDetails.open = savedOpen ? savedOpen.has('custom-css') : true;
  customDetails.addEventListener('toggle', saveOpenGroups);

  const customSummary = document.createElement('summary');
  customSummary.className = 'creator-group-toggle';
  customSummary.innerHTML = `<span class="creator-group-label">Custom CSS</span><span class="creator-group-chevron">▶</span>`;
  customDetails.appendChild(customSummary);

  const customBody = document.createElement('div');
  customBody.className = 'creator-group-body';

  const hint = document.createElement('p');
  hint.className = 'creator-custom-hint';
  hint.textContent = 'Scoped automatically — write plain selectors, no prefix needed';
  customBody.appendChild(hint);

  // Reuse the existing textarea element if available (preserves event listeners
  // wired in wireTopBar), otherwise create a fresh one.
  const textarea = existingTextarea || document.createElement('textarea');
  textarea.id = 'creatorCustomCSS';
  textarea.className = 'creator-textarea';
  textarea.rows = 8;
  textarea.spellcheck = false;
  textarea.placeholder = '/* Extra rules — selector overrides, text-shadows, pseudo-elements… */\n.view-title {\n  text-shadow: 2px 2px 0 #000;\n}';
  textarea.value = state.customCSS || '';
  customBody.appendChild(textarea);
  customDetails.appendChild(customBody);
  editorInner.appendChild(customDetails);
}

function buildVarRow(varDef) {
  const row = document.createElement('div');
  row.className = 'creator-var-row';
  row.dataset.varName = varDef.name;

  const label = document.createElement('label');
  label.className = 'creator-var-label';
  label.title = varDef.name;
  label.textContent = varDef.label;

  const control = document.createElement('div');
  control.className = 'creator-var-control';

  switch (varDef.type) {
    case 'color':
    case 'gradient':    buildColorOrGradientControl(control, varDef); break;
    case 'font-family': buildFontFamilyControl(control, varDef); break;
    case 'font-weight': buildFontWeightControl(control, varDef); break;
    case 'select':      buildSelectControl(control, varDef);     break;
    case 'range':       buildRangeControl(control, varDef);      break;
    default:            buildTextControl(control, varDef);        break;
  }

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'creator-var-reset';
  resetBtn.textContent = '↺';
  resetBtn.title = 'Reset to baseline';
  resetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetVarToBaseline(varDef);
  });

  row.appendChild(label);
  row.appendChild(control);
  row.appendChild(resetBtn);
  return row;
}

function buildColorControl(container, varDef) {
  const currentVal = state.vars[varDef.name] ?? varDef.default;

  const picker = document.createElement('input');
  picker.type = 'color';
  picker.className = 'creator-color-swatch';
  picker.value = cssColorToHex(currentVal);
  picker.dataset.varName = varDef.name;

  const text = document.createElement('input');
  text.type = 'text';
  text.className = 'creator-var-text';
  text.value = currentVal;
  text.spellcheck = false;
  text.dataset.varName = varDef.name;
  text.placeholder = varDef.default;

  picker.addEventListener('input', () => {
    text.value = picker.value;
    setVar(varDef.name, picker.value);
  });

  text.addEventListener('input', () => {
    const val = text.value.trim();
    setVar(varDef.name, val);
    const hex = cssColorToHex(val);
    if (hex !== '#000000' || /^#0+$/.test(val)) {
      picker.value = hex;
    }
  });

  container.appendChild(picker);
  container.appendChild(text);
}

function buildTextControl(container, varDef) {
  const currentVal = state.vars[varDef.name] ?? varDef.default;

  const text = document.createElement('input');
  text.type = 'text';
  text.className = 'creator-var-text';
  text.value = currentVal;
  text.spellcheck = false;
  text.dataset.varName = varDef.name;
  text.placeholder = varDef.default;

  text.addEventListener('input', () => setVar(varDef.name, text.value));
  container.appendChild(text);
}

function buildFontFamilyControl(container, varDef) {
  const currentVal = state.vars[varDef.name] ?? varDef.default;

  const stack = document.createElement('div');
  stack.className = 'creator-font-stack';

  const select = document.createElement('select');
  select.className = 'creator-var-select';
  select.dataset.varName = varDef.name;

  const optCustom = document.createElement('option');
  optCustom.value = '__custom__';
  optCustom.textContent = '— Custom / Google Font —';
  select.appendChild(optCustom);

  const currentNorm = normalizeFontName(currentVal);
  let matchFound = false;

  for (const font of [...LOADED_FONTS, ...GOOGLE_LOADED_FONTS]) {
    const opt = document.createElement('option');
    opt.value = font.value;
    opt.textContent = font.label;
    if (font.value === currentVal || normalizeFontName(font.value) === currentNorm) {
      opt.selected = true;
      matchFound = true;
    }
    select.appendChild(opt);
  }

  // Custom text input + Google Fonts load button, shown only in custom mode
  const customRow = document.createElement('div');
  customRow.className = 'creator-font-custom-row';

  const customText = document.createElement('input');
  customText.type = 'text';
  customText.className = 'creator-var-text';
  customText.spellcheck = false;
  customText.dataset.varName = varDef.name;
  customText.placeholder = "Font name, e.g. Roboto";

  const loadBtn = document.createElement('button');
  loadBtn.type = 'button';
  loadBtn.className = 'creator-font-load-btn';
  loadBtn.textContent = 'Load';
  loadBtn.title = 'Load from Google Fonts and apply to preview';

  loadBtn.addEventListener('click', () => {
    const rawText = customText.value.trim();
    if (!rawText) return;
    const primaryName = rawText.split(',')[0].trim().replace(/['"]/g, '').trim();
    if (!primaryName) return;

    const cssValue = loadGoogleFont(primaryName);
    if (!cssValue) return;

    // Select the new option (loadGoogleFont already appended it to all selects)
    const opt = Array.from(select.options).find(
      (o) => normalizeFontName(o.value) === normalizeFontName(cssValue)
    );
    if (opt) {
      select.value = opt.value;
      customRow.style.display = 'none';
      setVar(varDef.name, opt.value);
    }

    const orig = loadBtn.textContent;
    loadBtn.textContent = 'Loaded ✓';
    setTimeout(() => { loadBtn.textContent = orig; }, 2000);
  });

  customRow.appendChild(customText);
  customRow.appendChild(loadBtn);

  if (!matchFound) {
    select.value = '__custom__';
    customText.value = currentVal;
    customRow.style.display = '';
  } else {
    customRow.style.display = 'none';
  }

  select.addEventListener('change', () => {
    if (select.value === '__custom__') {
      customRow.style.display = '';
      customText.focus();
    } else {
      customRow.style.display = 'none';
      setVar(varDef.name, select.value);
    }
  });

  customText.addEventListener('input', () => {
    if (select.value === '__custom__') {
      setVar(varDef.name, customText.value.trim());
    }
  });

  stack.appendChild(select);
  stack.appendChild(customRow);
  container.appendChild(stack);
}

function buildFontWeightControl(container, varDef) {
  const currentVal = state.vars[varDef.name] ?? varDef.default;
  const select = document.createElement('select');
  select.className = 'creator-var-select';
  select.dataset.varName = varDef.name;

  for (const w of ['400', '500', '600', '700', '800', '900']) {
    const opt = document.createElement('option');
    opt.value = w;
    opt.textContent = w;
    if (w === String(currentVal)) opt.selected = true;
    select.appendChild(opt);
  }

  select.addEventListener('change', () => setVar(varDef.name, select.value));
  container.appendChild(select);
}

function updateSliderTrack(slider) {
  const min = parseFloat(slider.min);
  const max = parseFloat(slider.max);
  const val = parseFloat(slider.value);
  const pct = ((val - min) / (max - min)) * 100;
  slider.style.setProperty('--track-fill', `${Math.max(0, Math.min(100, pct))}%`);
}

function buildRangeControl(container, varDef) {
  const unit       = varDef.unit ?? '';
  const currentRaw = state.vars[varDef.name] ?? varDef.default;
  const currentNum = parseFloat(currentRaw);
  const displayNum = isNaN(currentNum) ? varDef.min : currentNum;

  const wrap = document.createElement('div');
  wrap.className = 'creator-range-wrap';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'creator-range';
  slider.min   = varDef.min;
  slider.max   = varDef.max;
  slider.step  = varDef.step ?? 1;
  slider.value = displayNum;
  slider.dataset.varName = varDef.name;
  slider.dataset.unit    = unit;
  updateSliderTrack(slider);

  const numInput = document.createElement('input');
  numInput.type  = 'number';
  numInput.className = 'creator-range-number';
  numInput.step  = varDef.step ?? 1;
  numInput.value = displayNum;
  numInput.dataset.varName = varDef.name;

  function emitValue(num) {
    setVar(varDef.name, unit ? `${num}${unit}` : String(num));
  }

  slider.addEventListener('input', () => {
    const val = parseFloat(slider.value);
    numInput.value = val;
    updateSliderTrack(slider);
    emitValue(val);
  });

  numInput.addEventListener('input', () => {
    const val = parseFloat(numInput.value);
    if (isNaN(val)) return;
    // Clamp only the slider visual; number input allows fine-tuning beyond range
    slider.value = Math.min(varDef.max, Math.max(varDef.min, val));
    updateSliderTrack(slider);
    emitValue(val);
  });

  wrap.appendChild(slider);
  wrap.appendChild(numInput);

  if (unit) {
    const unitSpan = document.createElement('span');
    unitSpan.className = 'creator-range-unit';
    unitSpan.textContent = unit;
    wrap.appendChild(unitSpan);
  }

  container.appendChild(wrap);
}

// ── Gradient editor ───────────────────────────────────────────────────────────

/**
 * Split `str` on `sep` only at the top nesting level (not inside parentheses).
 */
function splitOutsideParens(str, sep) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth--; current += ch; }
    else if (depth === 0 && str.startsWith(sep, i)) {
      parts.push(current.trim());
      current = '';
      i += sep.length - 1;
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Parse a `linear-gradient(...)` CSS value.
 * Returns `{ angle, stops: [{color, position}] }` or `null`.
 */
function tryParseLinearGradient(css) {
  if (!css) return null;
  const m = css.trim().match(/^linear-gradient\(\s*([\s\S]+)\s*\)$/i);
  if (!m) return null;

  const parts = splitOutsideParens(m[1].trim(), ',');
  if (parts.length < 2) return null;

  let angle = 180;
  let stopParts = parts;

  const first = parts[0].trim();
  if (/^\d+(\.\d+)?deg$/i.test(first)) {
    angle = parseFloat(first);
    stopParts = parts.slice(1);
  } else if (/^to\s+/i.test(first)) {
    const dir = first.replace(/^to\s+/i, '').trim().toLowerCase();
    const dirMap = {
      'bottom': 180, 'top': 0, 'right': 90, 'left': 270,
      'bottom right': 135, 'right bottom': 135,
      'bottom left': 225, 'left bottom': 225,
      'top right': 45,    'right top': 45,
      'top left': 315,    'left top': 315,
    };
    angle = dirMap[dir] ?? 180;
    stopParts = parts.slice(1);
  }

  if (stopParts.length < 1) return null;

  const stops = stopParts.map((part) => {
    const tokens = splitOutsideParens(part.trim(), ' ').filter(Boolean);
    if (tokens.length >= 2) {
      const last = tokens[tokens.length - 1];
      if (/^-?[\d.]+(%|px|em|rem|vw|vh)?$/.test(last)) {
        return { color: tokens.slice(0, -1).join(' '), position: last };
      }
    }
    return { color: part.trim(), position: '' };
  });

  return { angle, stops };
}

/** Rebuild a `linear-gradient()` CSS string from a parsed object. */
function buildLinearGradientCSS(parsed) {
  const stops = parsed.stops
    .map((s) => (s.position ? `${s.color} ${s.position}` : s.color))
    .join(', ');
  return `linear-gradient(${parsed.angle}deg, ${stops})`;
}

function buildGradientControl(container, varDef) {
  const currentVal = state.vars[varDef.name] ?? varDef.default;

  const wrap = document.createElement('div');
  wrap.className = 'creator-gradient-wrap';
  wrap.dataset.varName = varDef.name;
  wrap.dataset.parseable = 'false';

  // ── Visual section (shown when parseable) ─────────────────────────────────

  const visualSection = document.createElement('div');
  visualSection.className = 'creator-gradient-visual';

  // Preview strip + angle input
  const header = document.createElement('div');
  header.className = 'creator-gradient-header';

  const preview = document.createElement('div');
  preview.className = 'creator-gradient-preview';

  const angleWrap = document.createElement('span');
  angleWrap.className = 'creator-gradient-angle-wrap';

  const angleInput = document.createElement('input');
  angleInput.type = 'number';
  angleInput.className = 'creator-gradient-angle';
  angleInput.min = 0;
  angleInput.max = 360;
  angleInput.step = 1;

  const angleSuffix = document.createElement('span');
  angleSuffix.className = 'creator-gradient-angle-suffix';
  angleSuffix.textContent = '°';

  angleWrap.appendChild(angleInput);
  angleWrap.appendChild(angleSuffix);
  header.appendChild(preview);
  header.appendChild(angleWrap);
  visualSection.appendChild(header);

  // Stop rows container
  const stopsEl = document.createElement('div');
  stopsEl.className = 'creator-gradient-stops';
  visualSection.appendChild(stopsEl);

  // Add stop button
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'creator-gradient-add-btn';
  addBtn.textContent = '+ add stop';
  visualSection.appendChild(addBtn);

  wrap.appendChild(visualSection);

  // ── Raw fallback (always visible) ─────────────────────────────────────────

  const rawInput = document.createElement('input');
  rawInput.type = 'text';
  rawInput.className = 'creator-var-text creator-gradient-raw';
  rawInput.spellcheck = false;
  rawInput.dataset.varName = varDef.name;
  rawInput.placeholder = varDef.default;
  wrap.appendChild(rawInput);

  // ── Internal mutable parsed state ─────────────────────────────────────────

  let parsed = null;

  function emitCSS() {
    if (!parsed) return;
    const css = buildLinearGradientCSS(parsed);
    rawInput.value = css;
    preview.style.background = css;
    setVar(varDef.name, css);
  }

  function buildStopRow(stop, idx) {
    const row = document.createElement('div');
    row.className = 'creator-gradient-stop';

    const swatch = document.createElement('input');
    swatch.type = 'color';
    swatch.className = 'creator-color-swatch creator-gradient-stop-swatch';
    swatch.value = cssColorToHex(stop.color);

    const colorText = document.createElement('input');
    colorText.type = 'text';
    colorText.className = 'creator-var-text creator-gradient-stop-color';
    colorText.value = stop.color;
    colorText.spellcheck = false;

    const posText = document.createElement('input');
    posText.type = 'text';
    posText.className = 'creator-gradient-stop-pos';
    posText.value = stop.position || '';
    posText.placeholder = 'pos';
    posText.spellcheck = false;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'creator-gradient-stop-remove';
    removeBtn.title = 'Remove stop';
    removeBtn.textContent = '×';

    swatch.addEventListener('input', () => {
      if (!parsed) return;
      parsed.stops[idx].color = swatch.value;
      colorText.value = swatch.value;
      emitCSS();
    });

    colorText.addEventListener('input', () => {
      if (!parsed) return;
      const v = colorText.value.trim();
      parsed.stops[idx].color = v;
      const hex = cssColorToHex(v);
      if (hex !== '#000000' || /^#0+$/.test(v)) swatch.value = hex;
      emitCSS();
    });

    posText.addEventListener('input', () => {
      if (!parsed) return;
      parsed.stops[idx].position = posText.value.trim();
      emitCSS();
    });

    removeBtn.addEventListener('click', () => {
      if (!parsed || parsed.stops.length <= 2) return;
      parsed.stops.splice(idx, 1);
      rebuildStopsUI();
      emitCSS();
    });

    row.appendChild(swatch);
    row.appendChild(colorText);
    row.appendChild(posText);
    row.appendChild(removeBtn);
    return row;
  }

  function rebuildStopsUI() {
    stopsEl.innerHTML = '';
    if (!parsed) return;
    parsed.stops.forEach((stop, i) => stopsEl.appendChild(buildStopRow(stop, i)));
    if (parsed.stops.length <= 2) {
      for (const btn of stopsEl.querySelectorAll('.creator-gradient-stop-remove')) {
        btn.disabled = true;
      }
    }
  }

  addBtn.addEventListener('click', () => {
    if (!parsed) return;
    const last = parsed.stops[parsed.stops.length - 1];
    parsed.stops.push({ color: last.color, position: '' });
    rebuildStopsUI();
    emitCSS();
  });

  angleInput.addEventListener('input', () => {
    if (!parsed) return;
    const a = parseFloat(angleInput.value);
    if (!isNaN(a)) parsed.angle = a;
    emitCSS();
  });

  rawInput.addEventListener('input', () => {
    const v = rawInput.value;
    setVar(varDef.name, v);
    const newParsed = tryParseLinearGradient(v);
    if (newParsed) {
      parsed = newParsed;
      wrap.dataset.parseable = 'true';
      angleInput.value = parsed.angle;
      preview.style.background = v;
      rebuildStopsUI();
    } else {
      parsed = null;
      wrap.dataset.parseable = 'false';
    }
  });

  // Called by syncEditorToState to fully resync visual state after preset load / reset
  wrap._rebuildFromValue = function (val) {
    rawInput.value = val;
    const newParsed = tryParseLinearGradient(val);
    if (newParsed) {
      parsed = newParsed;
      wrap.dataset.parseable = 'true';
      angleInput.value = parsed.angle;
      preview.style.background = val;
      rebuildStopsUI();
    } else {
      parsed = null;
      wrap.dataset.parseable = 'false';
      preview.style.background = '';
    }
  };

  wrap._rebuildFromValue(currentVal);
  container.appendChild(wrap);
}

// ── Unified color-or-gradient control ────────────────────────────────────────
// Used for both 'color' and 'gradient' vars. Auto-detects the current value's
// type and shows the appropriate editor. A small mode badge lets the user
// flip between solid color and gradient at any time.

function buildColorOrGradientControl(container, varDef) {
  const outer = document.createElement('div');
  outer.className = 'creator-cog';
  outer.dataset.varName = varDef.name;

  function render() {
    outer.innerHTML = '';

    const val = state.vars[varDef.name] ?? varDef.default;
    const isGradient = tryParseLinearGradient(val) !== null;

    // Build the inner control into `outer`
    if (isGradient) {
      buildGradientControl(outer, varDef);
    } else {
      buildColorControl(outer, varDef);
    }

    // Mode toggle badge
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'creator-cog-badge';
    badge.textContent = isGradient ? 'solid' : 'grad';
    badge.title = isGradient ? 'Switch to solid color' : 'Switch to gradient';

    badge.addEventListener('click', () => {
      if (isGradient) {
        // gradient → solid: use first stop color
        const p = tryParseLinearGradient(state.vars[varDef.name] ?? varDef.default);
        const c = p?.stops[0]?.color ?? varDef.default;
        setVar(varDef.name, c);
      } else {
        // solid → gradient: wrap current color in a simple 2-stop gradient
        const c = state.vars[varDef.name] ?? varDef.default;
        setVar(varDef.name, `linear-gradient(180deg, ${c}, ${c})`);
      }
      render();
    });

    if (isGradient) {
      // Tuck the badge into the gradient header row (next to the angle input)
      const gradHeader = outer.querySelector('.creator-gradient-header');
      if (gradHeader) gradHeader.appendChild(badge);
      else outer.appendChild(badge);
    } else {
      // Append badge after the color text input in the flex row
      outer.appendChild(badge);
    }
  }

  // Called by syncEditorToState — handles mode switching when a preset loads
  // a different value type than what's currently displayed.
  outer._rebuildFromValue = function (val) {
    state.vars[varDef.name] = val;
    render();
  };

  render();
  container.appendChild(outer);
}

function buildSelectControl(container, varDef) {
  const currentVal = state.vars[varDef.name] ?? varDef.default;
  const select = document.createElement('select');
  select.className = 'creator-var-select';
  select.dataset.varName = varDef.name;

  for (const opt of varDef.options) {
    const el = document.createElement('option');
    el.value = opt;
    el.textContent = opt;
    if (opt === currentVal) el.selected = true;
    select.appendChild(el);
  }

  select.addEventListener('change', () => setVar(varDef.name, select.value));
  container.appendChild(select);
}

// ── State mutation ────────────────────────────────────────────────────────────

/** Mark a var row as modified (or not) relative to the current baseline. */
function updateModifiedState(varName) {
  const row = editorInner.querySelector(`.creator-var-row[data-var-name="${CSS.escape(varName)}"]`);
  if (!row) return;
  const baseline = state.presetVars[varName];
  const current  = state.vars[varName];
  row.dataset.modified = (baseline !== undefined && current !== baseline) ? 'true' : 'false';
}

/** Refresh modified indicators for every var. Called after load/reset. */
function updateAllModifiedStates() {
  for (const group of VAR_GROUPS) {
    for (const v of group.vars) {
      updateModifiedState(v.name);
    }
  }
}

/** Reset a single var back to its preset (or default) baseline. */
function resetVarToBaseline(varDef) {
  const baseline = state.presetVars[varDef.name] ?? varDef.default;
  state.vars[varDef.name] = baseline;
  syncEditorToState();
  updatePreview();
}

function setVar(name, value) {
  state.vars[name] = value;
  updateModifiedState(name);
  updatePreview();
}

function syncEditorToState() {
  for (const group of VAR_GROUPS) {
    for (const varDef of group.vars) {
      const val = state.vars[varDef.name] ?? varDef.default;
      const escapedName = CSS.escape(varDef.name);

      // Color-or-gradient wrapper — call first so the inner control is (re)built
      // before the generic sync loops below try to find its child elements.
      const cogEl = editorInner.querySelector(`.creator-cog[data-var-name="${escapedName}"]`);
      if (cogEl?._rebuildFromValue) cogEl._rebuildFromValue(val);

      // Color picker
      const picker = editorInner.querySelector(`input[type="color"][data-var-name="${escapedName}"]`);
      if (picker) picker.value = cssColorToHex(val);

      // Range slider + paired number input
      const rangeEl = editorInner.querySelector(`input[type="range"][data-var-name="${escapedName}"]`);
      if (rangeEl) {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          rangeEl.value = Math.min(rangeEl.max, Math.max(rangeEl.min, num));
          updateSliderTrack(rangeEl);
        }
      }
      const numberEl = editorInner.querySelector(`input[type="number"][data-var-name="${escapedName}"]`);
      if (numberEl) {
        const num = parseFloat(val);
        if (!isNaN(num)) numberEl.value = num;
      }

      // Text inputs not inside font-stack or gradient-wrap (those manage their own sync)
      for (const textEl of editorInner.querySelectorAll(`input[type="text"][data-var-name="${escapedName}"]`)) {
        if (!textEl.closest('.creator-font-stack') && !textEl.closest('.creator-gradient-wrap')) {
          textEl.value = val;
        }
      }

      // Gradient wraps — call their full resync method
      const gradWrap = editorInner.querySelector(`.creator-gradient-wrap[data-var-name="${escapedName}"]`);
      if (gradWrap?._rebuildFromValue) gradWrap._rebuildFromValue(val);

      // Select elements (non-font)
      const selects = editorInner.querySelectorAll(`select[data-var-name="${escapedName}"]`);
      for (const sel of selects) {
        const isFontStack = sel.closest('.creator-font-stack');

        if (isFontStack) {
          // Font-family: fuzzy match
          const normVal = normalizeFontName(val);
          let matched = false;
          for (const opt of sel.options) {
            if (opt.value !== '__custom__' && (opt.value === val || normalizeFontName(opt.value) === normVal)) {
              sel.value = opt.value;
              matched = true;
              break;
            }
          }
          const customText = sel.parentElement?.querySelector('.creator-font-custom-row input[type="text"]');
          const customRow  = sel.parentElement?.querySelector('.creator-font-custom-row');
          if (!matched) {
            sel.value = '__custom__';
            if (customText) customText.value = val;
            if (customRow)  customRow.style.display = '';
          } else {
            if (customRow) customRow.style.display = 'none';
          }
        } else {
          // Regular select: exact match
          const exists = Array.from(sel.options).some((o) => o.value === val);
          if (exists) sel.value = val;
        }
      }
    }
  }
  updateAllModifiedStates();
}

// ── Preset loading ────────────────────────────────────────────────────────────

/**
 * Extract any non-variable CSS rules for a skin (e.g. .skin-foo .view-title { })
 * and rewrite the selector to .creator-preview so they work in the preview.
 */
function extractSkinCustomCSS(skinId) {
  const prefix = `.skin-${skinId}`;
  // Escape prefix for RegExp (handles dots and hyphens)
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prefixRe = new RegExp(escaped, 'g');
  const rules = [];

  for (const sheet of document.styleSheets) {
    let cssRules;
    try { cssRules = sheet.cssRules; } catch { continue; }
    if (!cssRules) continue;

    for (const rule of cssRules) {
      if (!(rule instanceof CSSStyleRule)) continue;
      const sel = rule.selectorText;
      // Only capture rules that include the skin prefix with a descendant
      // (skip the bare `.skin-{id} { }` variable block itself)
      if (!sel.includes(prefix) || sel.trim() === prefix) continue;

      // Strip the skin prefix from each comma-part → plain unscoped selector
      const rewritten = sel.split(',')
        .map(s => s.trim().replace(prefixRe, '').trim())
        .filter(Boolean)
        .join(',\n');
      // rule.style.cssText preserves !important and all declarations
      rules.push(`${rewritten} {\n  ${rule.style.cssText.replace(/;\s+/g, ';\n  ').trim()}\n}`);
    }
  }

  return rules.join('\n\n');
}

function loadPreset(skinId) {
  const probe = document.createElement('div');
  probe.className = `skin-${skinId}`;
  probe.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:1px;height:1px;';
  document.body.appendChild(probe);

  const computed = getComputedStyle(probe);

  for (const group of VAR_GROUPS) {
    for (const varDef of group.vars) {
      const raw = computed.getPropertyValue(varDef.name);
      const val = raw.trim();
      if (val) {
        state.vars[varDef.name] = val;
      }
    }
  }

  document.body.removeChild(probe);

  // Populate name + description from the SKINS registry
  const skinMeta = SKINS.find((s) => s.id === skinId);
  if (skinMeta) {
    const nameEl = document.getElementById('creatorSkinName');
    const descEl = document.getElementById('creatorSkinDesc');
    if (nameEl) nameEl.value = skinMeta.name;
    if (descEl) descEl.value = skinMeta.desc ?? '';
  }

  // Populate the Custom CSS textarea with any non-variable rules from the skin
  const customCSS = extractSkinCustomCSS(skinId);
  state.customCSS = customCSS;
  document.getElementById('creatorCustomCSS').value = customCSS;

  // Snapshot the loaded values as the new baseline for ↺ reset
  state.presetVars = { ...state.vars };
  state.presetCustomCSS = customCSS;

  syncEditorToState();
  updatePreview();
}

// ── Export ────────────────────────────────────────────────────────────────────

function buildExportCSS() {
  const nameInput = document.getElementById('creatorSkinName');
  const name = (nameInput?.value || 'My Skin').trim();
  const slug = nameToSlug(name);
  const desc = (document.getElementById('creatorSkinDesc')?.value || '').trim();

  const lines = [];

  for (const group of VAR_GROUPS) {
    const changed = group.vars.filter((v) => {
      const cur = state.vars[v.name];
      return cur !== undefined && cur !== null && cur !== '' && cur !== v.default;
    });
    if (changed.length === 0) continue;
    lines.push(`\n  /* ${group.label} */`);
    for (const v of changed) {
      lines.push(`  ${v.name}: ${state.vars[v.name]};`);
    }
  }

  const header = desc
    ? `/* ── ${name} ── ${desc} */`
    : `/* ── ${name} ─────────────────────────────────────────────────────────────── */`;
  let output = `${header}\n`;
  output += `.skin-${slug} {`;
  if (lines.length > 0) {
    output += lines.join('\n') + '\n';
  } else {
    output += '\n  /* (no changes from defaults) */\n';
  }
  output += '}';

  const customCSS = state.customCSS.trim();
  if (customCSS) {
    // Prepend .skin-{slug} to every selector; leave @-rules (media, keyframes) intact
    const scoped = customCSS.replace(/([^{}@]+)\s*\{/g, (match, rawSel) => {
      const sel = rawSel.trim();
      if (!sel) return match;
      const prefixed = sel.split(',').map(s => `.skin-${slug} ${s.trim()}`).join(',\n');
      return `${prefixed} {`;
    });
    output += '\n\n' + scoped;
  }

  return output;
}

function buildFontSnippet() {
  const tileFontRaw     = (state.vars['--tile-font-family']     || '').trim();
  const wordmarkFontRaw = (state.vars['--wordmark-font-family'] || '').trim();
  const skinName = (document.getElementById('creatorSkinName')?.value || 'My Skin').trim();

  // Collect fonts that aren't already in the LOADED_FONTS list (= already in fonts.css)
  const seen = new Set();
  const customFonts = [];
  for (const fontRaw of [tileFontRaw, wordmarkFontRaw]) {
    if (!fontRaw) continue;
    const isLoaded = LOADED_FONTS.some(
      (f) => f.value === fontRaw || normalizeFontName(f.value) === normalizeFontName(fontRaw)
    );
    if (!isLoaded) {
      const primaryName = fontRaw.split(',')[0].trim().replace(/['"]/g, '').trim();
      if (primaryName && !seen.has(primaryName.toLowerCase())) {
        seen.add(primaryName.toLowerCase());
        customFonts.push(primaryName);
      }
    }
  }

  if (customFonts.length === 0) {
    return '/* No new fonts needed — all selected fonts are already bundled in src/fonts.css. */';
  }

  const npmCmds   = [];
  const imports   = [];
  const rootVars  = [];

  for (const name of customFonts) {
    const pkg      = name.toLowerCase().replace(/\s+/g, '-');
    const scaleKey = pkg;
    npmCmds.push(`npm install @fontsource/${pkg}`);
    imports.push(`@import '@fontsource/${pkg}/latin-400.css'; /* ${skinName} — adjust weight as needed */`);
    rootVars.push(`  --tile-scale-${scaleKey}: 1;    /* adjust if letters run large/small in tiles */`);
    rootVars.push(`  --display-scale-${scaleKey}: 1; /* adjust for the wordmark */`);
  }

  const lines = [];
  lines.push('/* 1. Install in your terminal: */');
  for (const cmd of npmCmds) lines.push(cmd);
  lines.push('');
  lines.push('/* 2. Add to src/fonts.css: */');
  for (const imp of imports) lines.push(imp);
  lines.push('');
  lines.push('/* 3. Add to :root in src/skins/skins.css: */');
  lines.push(':root {');
  for (const v of rootVars) lines.push(v);
  lines.push('}');

  return lines.join('\n');
}

function buildRegistrySnippet() {
  const nameInput = document.getElementById('creatorSkinName');
  const name = (nameInput?.value || 'My Skin').trim();
  const slug = nameToSlug(name);

  return `// 1. Add to the SkinId union in src/skins/registry.ts:
  | '${slug}'

// 2. Add to the SKINS array in src/skins/registry.ts:
{
  id: '${slug}',
  name: '${name}',
  productId: null,
  // unlockedByAchievement: 'solve_10',  // e.g. 'streak_30', 'solve_100'
  // unlockHint: '10 puzzles solved',
},`;
}

// ── UI wiring ─────────────────────────────────────────────────────────────────

function buildScreenTabs() {
  const tabsEl = document.getElementById('creatorScreenTabs');
  tabsEl.innerHTML = '';

  for (const screen of SCREENS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'creator-screen-tab';
    btn.textContent = screen.label;
    btn.dataset.screenId = screen.id;
    btn.setAttribute('aria-selected', screen.id === state.screenId ? 'true' : 'false');

    btn.addEventListener('click', () => {
      state.screenId = screen.id;
      for (const t of tabsEl.querySelectorAll('.creator-screen-tab')) {
        t.setAttribute('aria-selected', t.dataset.screenId === screen.id ? 'true' : 'false');
      }
      updatePreview();
    });

    tabsEl.appendChild(btn);
  }
}

function buildPresetSelect() {
  const select = document.getElementById('creatorPresetSelect');
  select.innerHTML = '<option value="">— choose preset —</option>';
  for (const skin of SKINS) {
    const opt = document.createElement('option');
    opt.value = skin.id;
    opt.textContent = skin.name;
    select.appendChild(opt);
  }
}

function wireTopBar() {
  document.getElementById('creatorPresetSelect').addEventListener('change', (e) => {
    if (e.target.value) loadPreset(e.target.value);
  });

  document.getElementById('creatorResetDefaults').addEventListener('click', () => {
    if (!confirm('Reset all variables to Void (default) values?')) return;
    initVarsFromDefaults(); // also resets state.presetVars to defaults
    state.customCSS = '';
    document.getElementById('creatorCustomCSS').value = '';
    syncEditorToState();    // calls updateAllModifiedStates() internally
    updatePreview();
  });

  document.getElementById('creatorExport').addEventListener('click', () => {
    document.getElementById('exportOutput').value   = buildExportCSS();
    document.getElementById('exportRegistry').value = buildRegistrySnippet();
    document.getElementById('exportFonts').value    = buildFontSnippet();
    document.getElementById('exportModal').hidden   = false;
  });

  document.getElementById('creatorCustomCSS').addEventListener('input', (e) => {
    state.customCSS = e.target.value;
    updatePreview();
  });
}

function wireExportModal() {
  const modal = document.getElementById('exportModal');

  document.getElementById('exportModalClose').addEventListener('click', () => { modal.hidden = true; });
  document.getElementById('exportClose2').addEventListener('click',      () => { modal.hidden = true; });

  modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });

  async function copyWithFeedback(btnId, text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    const btn = document.getElementById(btnId);
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1800);
  }

  document.getElementById('exportCopy').addEventListener('click', () => {
    copyWithFeedback('exportCopy', document.getElementById('exportOutput').value);
  });

  document.getElementById('exportCopyRegistry').addEventListener('click', () => {
    copyWithFeedback('exportCopyRegistry', document.getElementById('exportRegistry').value);
  });

  document.getElementById('exportCopyFonts').addEventListener('click', () => {
    copyWithFeedback('exportCopyFonts', document.getElementById('exportFonts').value);
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  initVarsFromDefaults();
  buildPresetSelect();
  buildScreenTabs();
  renderEditor();   // builds all groups + custom-css section via JS
  wireTopBar();
  wireExportModal();
  updatePreview();
}

init();
