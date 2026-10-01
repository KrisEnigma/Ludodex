/**
 * Spoiler-free share image (1080×1350 PNG) in the player's CURRENT skin.
 *
 * Contains no grid information — no letters, no paths, no order — only the
 * result: puzzle number + title, stars, time, the star key and streak, under a
 * LUDODEX wordmark spelled in the skin's own tiles. Every share therefore shows
 * off a skin. Colours and fonts are read from the live skin variables on
 * <html>; gradient-valued tokens fall back to a solid sibling colour.
 */
import { t, tn } from '../i18n';
import { formatDuration } from '../utils/format';
import type { WinPayload } from '../views/types';

const W = 1080;
const H = 1350;

/** Resolve a CSS colour variable to a canvas-safe colour string (fallback if
 *  unset or not a plain colour, e.g. a gradient-valued tile token). */
function cssColor(name: string, fallback: string): string {
  const raw = cssVar(name);
  if (!raw || !CSS.supports('color', raw)) return fallback;
  const probe = document.createElement('span');
  probe.style.color = raw;
  probe.style.display = 'none';
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  // color(srgb r g b / a) → rgba(), for canvases that only take legacy syntax.
  const m = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/.exec(value);
  if (m) {
    const [r, g, b] = [m[1], m[2], m[3]].map((v) => Math.round(Number(v) * 255));
    return `rgba(${r}, ${g}, ${b}, ${m[4] ?? 1})`;
  }
  return value || fallback;
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function cssNumber(name: string, fallback: number): number {
  const n = parseFloat(cssVar(name));
  return Number.isFinite(n) ? n : fallback;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}


function rgbOf(c: string): [number, number, number] | null {
  const m = c.match(/[\d.]+/g);
  if (!m || m.length < 3) return null;
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (v: number): number => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: string, b: string): number {
  const ra = rgbOf(a);
  const rb = rgbOf(b);
  if (!ra || !rb) return 21;
  const la = luminance(ra);
  const lb = luminance(rb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** color(srgb r g b / a) → rgba(), for canvases that only take legacy syntax. */
function legacyColor(value: string): string {
  const m = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/.exec(value.trim());
  if (!m) return value;
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => Math.round(Number(v) * 255));
  return `rgba(${r}, ${g}, ${b}, ${m[4] ?? 1})`;
}

/** Parse a computed text-shadow list ("rgb(…) 3px 3px 0px, …"). */
function parseShadows(value: string): Array<{ color: string; x: number; y: number; blur: number }> {
  if (!value || value === 'none') return [];
  const out: Array<{ color: string; x: number; y: number; blur: number }> = [];
  for (const part of value.split(/,(?![^(]*\))/)) {
    const color = part.match(/(rgba?\([^)]*\)|color\([^)]*\)|#[0-9a-f]+)/i)?.[1] ?? 'rgba(0,0,0,0.5)';
    const nums = part.replace(color, '').match(/-?[\d.]+px/g)?.map((v) => parseFloat(v)) ?? [];
    out.push({ color: legacyColor(color), x: nums[0] ?? 0, y: nums[1] ?? 0, blur: nums[2] ?? 0 });
  }
  return out;
}

export type ShareTitleStyle = 'tiles' | 'wordmark';

export async function renderShareCard(
  payload: WinPayload,
  url: string,
  titleStyle: ShareTitleStyle = 'wordmark',
  timeStyle: 'text' | 'tiles' = 'text'
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const titleFont = cssVar('--title-font-family') || cssVar('--wordmark-font-family') || "'Space Mono', monospace";
  const titleWeight = cssVar('--title-font-weight') || '700';
  const tileFont = cssVar('--tile-font-family') || "'Space Mono', monospace";
  const tileWeight = cssVar('--tile-font-weight') || '700';
  const titleScale = Math.min(cssNumber('--title-font-scale', cssNumber('--display-font-scale', 1)), 1.5);
  const tileScale = cssNumber('--tile-font-scale', 1);
  try {
    await Promise.all([
      document.fonts.load(`${titleWeight} 80px ${titleFont}`),
      document.fonts.load(`${tileWeight} 80px ${tileFont}`)
    ]);
  } catch {
    // Fonts unavailable: the canvas falls back to the generic family.
  }

  const bgCenter = cssColor('--bg-center', '#0d1118');
  const bgEdge = cssColor('--bg-edge', '#07090e');
  const titleColor = cssColor('--heading-color', cssColor('--title-color', '#ffffff'));
  const glow = cssColor('--title-glow', '#00d4e8');
  const celebrate = cssColor('--celebrate-color', glow);
  const chrome = cssColor('--chrome-text', '#9aa3b5');
  const tileBg = cssColor('--tile-selected-border', glow);
  const tileFill = cssColor('--tile-sel', cssColor('--hint-solved-bg', cssColor('--action', glow)));
  const tileLetter = cssColor('--tile-selected-letter', '#ffffff');
  const tileRadius = cssNumber('--tile-radius', 14);

  // Text over the backdrop: canvases don't get the skin's CSS text-shadows, so
  // a colour too close to the background gets an outline in a contrasting skin
  // colour (e.g. Aero's white headings → deep-blue edge), like the win screen.
  const text = (str: string, x: number, y: number, color: string, maxWidth?: number): void => {
    if (contrast(color, bgCenter) < 3) {
      const edge = contrast(glow, color) >= 3 ? glow : (luminance(rgbOf(color) ?? [0, 0, 0]) > 0.5 ? '#000000' : '#ffffff');
      const size = parseFloat(ctx.font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '40');
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3, size * 0.09);
      ctx.strokeStyle = edge;
      ctx.strokeText(str, x, y, maxWidth);
      ctx.restore();
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y, maxWidth);
  };

  // Display text sized by its real ink box, not the nominal font size: tall
  // or condensed faces (AmazDooM, Squada, VT323) otherwise collide with the
  // lines around them. Scales `basePx` down to fit maxW × maxH.
  const fitFont = (str: string, basePx: number, maxW: number, maxH: number, family = titleFont, weight = titleWeight): void => {
    ctx.font = `${weight} ${basePx}px ${family}`;
    const m = ctx.measureText(str);
    const h = (m.actualBoundingBoxAscent || basePx * 0.72) + (m.actualBoundingBoxDescent || 0);
    const k = Math.min(1, maxW / Math.max(1, m.width), maxH / Math.max(1, h));
    ctx.font = `${weight} ${Math.floor(basePx * k)}px ${family}`;
  };

  // Backdrop: the skin's radial gradient.
  const bg = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, H * 0.85);
  bg.addColorStop(0, bgCenter);
  bg.addColorStop(1, bgEdge);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (titleStyle === 'tiles') {
    // Wordmark spelled in the skin's (selected) tiles.
    const word = 'LUDODEX';
    const tile = 118;
    const gap = 14;
    const rowW = word.length * tile + (word.length - 1) * gap;
    let x = (W - rowW) / 2;
    const y = 120;
    for (const ch of word) {
      ctx.save();
      ctx.shadowColor = glow;
      ctx.shadowBlur = 24;
      roundRect(ctx, x, y, tile, tile, tileRadius * 1.4);
      ctx.fillStyle = tileFill;
      ctx.fill();
      ctx.restore();
      roundRect(ctx, x, y, tile, tile, tileRadius * 1.4);
      ctx.lineWidth = 3;
      ctx.strokeStyle = tileBg;
      ctx.stroke();
      ctx.fillStyle = tileLetter;
      ctx.font = `${tileWeight} ${Math.round(64 * tileScale)}px ${tileFont}`;
      ctx.fillText(ch, x + tile / 2, y + tile / 2 + 4);
      x += tile + gap;
    }
  } else {
    // The skin's own wordmark, as on the menu: font, colour, stroke, shadows.
    const wmFont = cssVar('--wordmark-font-family') || titleFont;
    const wmWeight = cssVar('--wordmark-font-weight') || titleWeight;
    const wmScale = Math.min(cssNumber('--menu-logo-scale', cssNumber('--display-font-scale', 1)), 1.6);
    try { await document.fonts.load(`${wmWeight} 120px ${wmFont}`); } catch { /* fallback family */ }
    const probe = document.createElement('h1');
    probe.className = 'menu-logo';
    probe.style.cssText = 'position:fixed;left:-9999px;top:0;';
    probe.textContent = 'LUDODEX';
    document.body.append(probe);
    const cs = getComputedStyle(probe);
    const wmColorRaw = legacyColor(cs.color);
    const shadows = parseShadows(cs.textShadow);
    const strokeW = parseFloat(cs.getPropertyValue('-webkit-text-stroke-width')) || 0;
    const strokeC = legacyColor(cs.getPropertyValue('-webkit-text-stroke-color'));
    const spacing = cs.letterSpacing;
    probe.remove();
    const applyFont = (px: number): void => {
      ctx.font = `${wmWeight} ${px}px ${wmFont}`;
      if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        spacing.endsWith('px') ? `${parseFloat(spacing) * (px / parseFloat(cs.fontSize))}px` : '0px';
    };
    // Fit the icon + wordmark lockup inside the card (wide faces shrink).
    let size = Math.round(118 * wmScale);
    applyFont(size);
    const lockupW = (px: number): number => ctx.measureText('LUDODEX').width + px * 0.82 + px * 0.32;
    const maxW = W - 120;
    const inkH = (): number => {
      const m = ctx.measureText('LUDODEX');
      return (m.actualBoundingBoxAscent || size * 0.72) + (m.actualBoundingBoxDescent || 0);
    };
    const fit = Math.min(1, maxW / lockupW(size), 120 / Math.max(1, inkH()));
    if (fit < 1) {
      size = Math.floor(size * fit);
      applyFont(size);
    }
    const k = size / (parseFloat(cs.fontSize) || size); // scale CSS shadow px to canvas size
    const cy = 190;
    // Logo lockup: the 2×2 tile mark from the boot splash, in this skin's tiles
    // (diagonal selected, like the picker card), then the wordmark.
    const textW = ctx.measureText('LUDODEX').width;
    // Icon matches the letters' ink height (cap height), whatever the face.
    const icon = Math.round(Math.min(size * 0.82, inkH() * 1.05));
    const iconGap = Math.round(size * 0.32);
    const groupW = icon + iconGap + textW;
    const ix = (W - groupW) / 2;
    const iy = cy - icon / 2;
    const cell = (icon - icon * 0.12) / 2;
    const cellGap = icon * 0.12;
    const idleFill = cssColor('--tile', cssColor('--surface', '#1e2236'));
    const idleBorder = cssColor('--tile-border', cssColor('--border', '#2a3148'));
    for (let i = 0; i < 4; i++) {
      const selected = i === 0 || i === 3;
      const qx = ix + (i % 2) * (cell + cellGap);
      const qy = iy + Math.floor(i / 2) * (cell + cellGap);
      const r = Math.min(tileRadius * 0.9, cell * 0.3);
      ctx.save();
      if (selected) {
        ctx.shadowColor = glow;
        ctx.shadowBlur = 18;
      }
      roundRect(ctx, qx, qy, cell, cell, r);
      ctx.fillStyle = selected ? tileFill : idleFill;
      ctx.fill();
      ctx.restore();
      roundRect(ctx, qx, qy, cell, cell, r);
      ctx.lineWidth = 3;
      ctx.strokeStyle = selected ? tileBg : idleBorder;
      ctx.stroke();
    }
    const cx = ix + icon + iconGap + textW / 2;
    // Shadows listed first paint on top → draw the list in reverse.
    for (const sh of [...shadows].reverse()) {
      ctx.save();
      if (sh.blur > 0) {
        // Draw the glyphs far off-canvas and throw only their shadow back, so
        // a blurred glow never leaves a solid copy of the text (hollow
        // wordmarks like Laser Vector stay hollow).
        const OFF = 10000;
        ctx.shadowColor = sh.color;
        ctx.shadowBlur = sh.blur * k;
        ctx.shadowOffsetX = sh.x * k + OFF;
        ctx.shadowOffsetY = sh.y * k;
        ctx.fillStyle = '#000';
        ctx.fillText('LUDODEX', cx - OFF, cy);
        if (strokeW > 0) {
          ctx.lineWidth = strokeW * k;
          ctx.strokeStyle = '#000';
          ctx.strokeText('LUDODEX', cx - OFF, cy);
        }
      } else {
        ctx.fillStyle = sh.color;
        ctx.fillText('LUDODEX', cx + sh.x * k, cy + sh.y * k);
      }
      ctx.restore();
    }
    const transparentFill = /rgba\([^)]*,\s*0\)/.test(wmColorRaw) || wmColorRaw === 'transparent';
    if (!transparentFill) {
      ctx.fillStyle = wmColorRaw;
      ctx.fillText('LUDODEX', cx, cy);
    }
    if (strokeW > 0) {
      ctx.lineWidth = strokeW * k;
      ctx.strokeStyle = strokeC;
      ctx.strokeText('LUDODEX', cx, cy);
    }
    if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
  }

  // Puzzle number + title.
  ctx.font = `700 34px 'Space Mono', monospace`;
  text(t('share.card_day', { day: payload.dayNumber }).toUpperCase(), W / 2, 330, chrome);
  fitFont(payload.puzzleTitle, Math.round(62 * titleScale), W - 120, 58);
  text(payload.puzzleTitle, W / 2, 400, titleColor, W - 120);

  // Stars.
  ctx.font = `150px system-ui, sans-serif`;
  for (let i = 0; i < 3; i++) {
    const filled = i < payload.starRating;
    ctx.save();
    ctx.globalAlpha = filled ? 1 : 0.22;
    if (filled) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 30;
    }
    text('★', W / 2 + (i - 1) * 180, 590, celebrate);
    ctx.restore();
  }

  // Result label.
  const label = payload.starRating === 3 ? t('win.pristine_label') : t('win.solved_subtitle');
  fitFont(label.toUpperCase(), Math.round(44 * titleScale), W - 160, 38);
  text(label.toUpperCase().split('').join(String.fromCharCode(8202)), W / 2, 715, payload.starRating === 3 ? celebrate : chrome);

  // Time: as display text, or each digit in one of the skin's selected tiles
  // (scoreboard-style; the colon stays a glyph between them).
  const timeStr = formatDuration(payload.elapsedSeconds);
  if (timeStyle === 'tiles') {
    const tw = 168;
    const th = 200;
    const tgap = 14;
    const colonW = 56;
    const chars = [...timeStr];
    const total = chars.reduce((acc, ch, i) => acc + (ch === ':' ? colonW : tw) + (i > 0 ? tgap : 0), 0);
    let tx = (W - total) / 2;
    const ty = 880 - th / 2;
    for (const ch of chars) {
      if (ch === ':') {
        ctx.font = `${titleWeight} ${Math.round(150 * titleScale)}px ${titleFont}`;
        text(':', tx + colonW / 2, 880, titleColor);
        tx += colonW + tgap;
        continue;
      }
      ctx.save();
      ctx.shadowColor = glow;
      ctx.shadowBlur = 26;
      roundRect(ctx, tx, ty, tw, th, tileRadius * 1.5);
      ctx.fillStyle = tileFill;
      ctx.fill();
      ctx.restore();
      roundRect(ctx, tx, ty, tw, th, tileRadius * 1.5);
      ctx.lineWidth = 3;
      ctx.strokeStyle = tileBg;
      ctx.stroke();
      ctx.fillStyle = tileLetter;
      ctx.font = `${tileWeight} ${Math.round(120 * tileScale)}px ${tileFont}`;
      ctx.fillText(ch, tx + tw / 2, 880 + 6);
      tx += tw + tgap;
    }
  } else {
    fitFont(timeStr, Math.round(210 * titleScale), W - 160, 175);
    text(timeStr, W / 2, 880, titleColor, W - 120);
  }

  // Star key + streak.
  const key = [
    `★ ${t('win.key_solved')}`,
    `${payload.mistakes === 0 ? '★' : '☆'} ${payload.mistakes === 0 ? t('win.key_no_mistakes') : tn('win.stat_mistake', payload.mistakes)}`,
    `${payload.hintsUsed === 0 ? '★' : '☆'} ${payload.hintsUsed === 0 ? t('win.key_no_hints') : tn('win.stat_hint', payload.hintsUsed)}`
  ].join('   ');
  ctx.font = `700 34px 'Space Mono', monospace`;
  text(key, W / 2, 1040, chrome, W - 100);
  if (payload.currentStreak >= 2) {
    text(`🔥 ${t('win.stat_day_streak', { n: payload.currentStreak })}`, W / 2, 1110, glow);
  }

  // Footer link.
  if (url) {
    ctx.font = `700 32px 'Space Mono', monospace`;
    text(url.replace(/^https?:\/\//, ''), W / 2, 1265, chrome);
  }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
