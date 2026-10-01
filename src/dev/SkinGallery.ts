/**
 * Dev-only skin gallery: every skin side by side as a small "screen" built
 * from the real game classes (.menu-logo, .stat-card, .view-title, .tile,
 * .hint-slot, .button-primary, ribbon), each wrapped in `skin-scope skin-<id>`
 * so it renders exactly as that skin does in the app.
 *
 * Open from the dev overlay (🎨) or with `?skins` in the URL. While open, the
 * page itself is switched to Void so skin-specific CSS for the active skin
 * (e.g. `.skin-aero .tile::before`) can't bleed into other cards.
 *
 * Dev builds only (imported from DevOverlay); tree-shaken from production.
 */
import { SKINS, type SkinMeta } from '../skins/registry';
import { renderRibbon } from '../components/ribbon';

const LETTERS = 'GSEANWITIFYHLODN';
const PATH = [0, 5, 10, 11, 7]; // G → W → Y → H → T (diagonal run + turns)
const DEACTIVATED = [12, 13]; // a couple of "used up" tiles

let galleryEl: HTMLElement | null = null;
let restoreSkinClass: string | null = null;

export function isSkinGalleryOpen(): boolean {
  return galleryEl !== null;
}

export function openSkinGallery(): void {
  if (galleryEl) return;
  const root = document.documentElement;
  restoreSkinClass = [...root.classList].find((c) => c.startsWith('skin-')) ?? null;
  if (restoreSkinClass) root.classList.remove(restoreSkinClass);
  root.classList.add('skin-void');

  injectStyles();
  const overlay = document.createElement('div');
  // Own Void scope so cards never inherit layers from the skin on <html>.
  overlay.className = 'dev-skin-gallery skin-scope skin-void';

  const bar = document.createElement('div');
  bar.className = 'dev-skin-gallery-bar';
  const title = document.createElement('strong');
  title.textContent = `Skins · ${SKINS.length}`;
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close ✕';
  close.addEventListener('click', closeSkinGallery);
  bar.append(title, close);

  const grid = document.createElement('div');
  grid.className = 'dev-skin-gallery-grid';
  for (const skin of SKINS) grid.append(buildCard(skin));

  overlay.append(bar, grid);
  document.body.append(overlay);
  galleryEl = overlay;

  // Ribbons need laid-out tiles.
  requestAnimationFrame(() => {
    overlay.querySelectorAll<HTMLElement>('.dev-skin-board').forEach(drawRibbon);
  });

  window.addEventListener('keydown', onKey);
}

export function closeSkinGallery(): void {
  if (!galleryEl) return;
  galleryEl.remove();
  galleryEl = null;
  const root = document.documentElement;
  root.classList.remove('skin-void');
  if (restoreSkinClass) root.classList.add(restoreSkinClass);
  restoreSkinClass = null;
  window.removeEventListener('keydown', onKey);
  const url = new URL(window.location.href);
  if (url.searchParams.has('skins')) {
    url.searchParams.delete('skins');
    window.history.replaceState(window.history.state, '', url);
  }
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeSkinGallery();
}

function buildCard(skin: SkinMeta): HTMLElement {
  const card = document.createElement('section');
  card.className = 'dev-skin-card';

  const head = document.createElement('div');
  head.className = 'dev-skin-card-head';
  const name = document.createElement('span');
  name.className = 'dev-skin-card-name';
  name.textContent = skin.name;
  const id = document.createElement('code');
  id.textContent = skin.id;
  head.append(name, id);

  const tags = document.createElement('div');
  tags.className = 'dev-skin-card-tags';
  const tagList: string[] = [];
  tagList.push(skin.unlockHint ? `🔒 ${skin.unlockHint}` : 'free');
  if (skin.productId) tagList.push(`IAP ${skin.productId}`);
  if (skin.isLight) tagList.push('light');
  tags.textContent = tagList.join(' · ');

  const screen = document.createElement('div');
  screen.className = `dev-skin-screen skin-scope skin-${skin.id}`;

  const logo = document.createElement('div');
  logo.className = 'menu-logo';
  logo.textContent = 'LUDODEX';

  const stats = document.createElement('div');
  stats.className = 'dev-skin-stats';
  for (const [value, label, fire] of [['12', 'STREAK', true], ['48', 'SOLVED', false], ['0:42', 'BEST', false]] as const) {
    const c = document.createElement('div');
    c.className = 'stat-card';
    if (fire) c.dataset.highlight = 'true';
    const v = document.createElement('span');
    v.className = 'stat-value';
    v.textContent = value;
    const l = document.createElement('span');
    l.className = 'stat-label';
    l.textContent = label;
    c.append(v, l);
    stats.append(c);
  }

  const levelTitle = document.createElement('div');
  levelTitle.className = 'view-title';
  levelTitle.textContent = 'Dark Souls';

  const board = document.createElement('div');
  board.className = 'dev-skin-board';
  const tilesGrid = document.createElement('div');
  tilesGrid.className = 'dev-skin-tiles';
  [...LETTERS].forEach((ch, i) => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset.state = PATH.includes(i) ? 'selected' : DEACTIVATED.includes(i) ? 'deactivated' : 'idle';
    const letter = document.createElement('span');
    letter.className = 'tile-letter';
    letter.textContent = ch;
    tile.append(letter);
    tilesGrid.append(tile);
  });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'dev-skin-path');
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('class', 'path-segments');
  svg.append(group);
  board.append(tilesGrid, svg);

  const hints = document.createElement('div');
  hints.className = 'dev-skin-hints';
  hints.append(hintRow('GWYN', true), hintRow('MANUS', false));

  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'button-primary dev-skin-play';
  play.textContent = '▶ Play';
  play.tabIndex = -1;

  screen.append(logo, stats, levelTitle, board, hints, play);
  card.append(head, tags, screen);
  return card;
}

function hintRow(word: string, solved: boolean): HTMLElement {
  const row = document.createElement('div');
  row.className = 'hint-row';
  row.dataset.solved = String(solved);
  for (const ch of word) {
    const slot = document.createElement('span');
    slot.className = 'hint-slot';
    slot.dataset.filled = String(solved);
    const letter = document.createElement('span');
    letter.className = 'hint-slot-letter';
    letter.textContent = solved ? ch : '';
    slot.append(letter);
    row.append(slot);
  }
  return row;
}

function drawRibbon(board: HTMLElement): void {
  const tiles = board.querySelectorAll<HTMLElement>('.tile');
  const group = board.querySelector<SVGGElement>('.path-segments');
  if (!group) return;
  renderRibbon(
    group,
    PATH.map((i) => ({
      x: tiles[i].offsetLeft + tiles[i].offsetWidth / 2,
      y: tiles[i].offsetTop + tiles[i].offsetHeight / 2
    }))
  );
}

function injectStyles(): void {
  if (document.getElementById('dev-skin-gallery-styles')) return;
  const style = document.createElement('style');
  style.id = 'dev-skin-gallery-styles';
  style.textContent = `
.dev-skin-gallery {
  position: fixed; inset: 0; z-index: 2147483000; overflow: auto;
  background: #0b0c10; color: #d8dce4;
  font: 12px/1.4 ui-monospace, 'Space Mono', monospace;
}
.dev-skin-gallery-bar {
  position: sticky; top: 0; z-index: 1000; display: flex; justify-content: space-between; align-items: center;
  padding: 10px 16px; background: rgba(11, 12, 16, 0.92); border-bottom: 1px solid #23262f;
}
.dev-skin-gallery-bar button {
  font: inherit; color: inherit; background: #1b1e26; border: 1px solid #333846; border-radius: 6px; padding: 4px 10px; cursor: pointer;
}
.dev-skin-gallery-grid {
  display: grid; grid-template-columns: repeat(auto-fill, 268px); justify-content: center; gap: 22px 18px; padding: 18px 16px 40px;
}
.dev-skin-card { display: flex; flex-direction: column; gap: 4px; width: 268px; scroll-margin-top: 56px; }
.dev-skin-card-head { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.dev-skin-card-name { font-weight: 700; font-size: 13px; }
.dev-skin-card-head code { opacity: 0.55; font-size: 11px; }
.dev-skin-card-tags { opacity: 0.6; font-size: 11px; min-height: 1.4em; margin-bottom: 4px; }

.dev-skin-screen {
  width: 268px; box-sizing: border-box; padding: 16px 16px 18px; border-radius: 18px;
  isolation: isolate; /* keep the card's ribbon/letter z-indexes under the sticky bar */
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  position: relative; overflow: hidden;
  background-color: var(--bg-edge);
  background-image: var(--bg-pattern, none), radial-gradient(circle at 50% 35%, var(--bg-center), var(--bg-edge));
  background-size: var(--bg-pattern-size, auto), auto;
  background-position: var(--bg-pattern-position, 0 0), 0 0;
  background-repeat: var(--bg-pattern-repeat, repeat), repeat;
  color: var(--title-color);
  font-family: 'Space Mono', ui-monospace, monospace;
  border: 1px solid #23262f;
}
.dev-skin-screen .menu-logo {
  margin: 0; font-size: calc(26px * var(--menu-logo-scale, var(--title-font-scale, var(--display-font-scale, 1))));
}
.dev-skin-screen .dev-skin-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; width: 100%; }
.dev-skin-screen .stat-card { padding: 6px 4px; gap: 2px; }
.dev-skin-screen .stat-value { font-size: 14px; }
.dev-skin-screen .stat-label { font-size: 8px; }
.dev-skin-screen .view-title { font-size: calc(17px * var(--level-title-scale, var(--title-font-scale, var(--display-font-scale, 1)))); }
.dev-skin-board { position: relative; width: 200px; height: 200px; }
.dev-skin-tiles { display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(4, 1fr); gap: 6px; width: 100%; height: 100%; }
.dev-skin-tiles .tile {
  font-size: calc(19px * var(--tile-font-scale, 1));
  border-radius: calc(var(--tile-radius, 14px) * 0.7);
}
.dev-skin-path { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; z-index: 10; }
.dev-skin-path .path-seg { stroke-width: max(5px, calc(var(--path-width, 9px) * 0.7)); }
.dev-skin-tiles .tile-letter { position: relative; z-index: 20; }
.dev-skin-hints { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.dev-skin-hints .hint-slot { width: 22px; height: 29px; font-size: calc(13px * var(--hint-font-scale, 1)); }
.dev-skin-play { padding: 10px 12px; font-size: 13px; pointer-events: none; }
`;
  document.head.append(style);
}
