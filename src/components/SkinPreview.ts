/**
 * A skin rendered as a little screen, from the real game classes, for the
 * Settings picker card and the skin detail sheet (one builder → they always
 * match each other and the game).
 *
 * `skin-scope skin-<id>` re-derives every skin variable locally, so the
 * preview never depends on the skin active on <html>. The backdrop is drawn on
 * a ::before that is laid out larger and scaled down (--screen-scale), so
 * pixel-sized backdrop art (clouds, bushes, starfields) keeps phone-screen
 * proportions instead of filling a small card.
 */
import { renderRibbon } from './ribbon';

type Variant = 'card' | 'detail';

const SPEC: Record<Variant, {
  cols: number;
  letters: string;
  path: number[];
  tile: number;
  gap: number;
}> = {
  // 2×2 "LUDO" patch, diagonal selection.
  card: { cols: 2, letters: 'LUDO', path: [0, 3], tile: 30, gap: 4 },
  // 4×4 board, W→O→R→D diagonal run then a turn.
  detail: { cols: 4, letters: 'WGTLPOEBMARFCNSD', path: [0, 5, 10, 15, 14, 9], tile: 42, gap: 6 }
};

export function buildSkinScreen(skinId: string, variant: Variant, title: string): HTMLElement {
  const spec = SPEC[variant];
  const screen = document.createElement('div');
  screen.className = `skin-screen skin-screen--${variant} skin-scope skin-${skinId}`;
  screen.setAttribute('aria-hidden', 'true');

  const wordmark = document.createElement('span');
  wordmark.className = 'skin-screen-wordmark';
  wordmark.textContent = title;

  const board = document.createElement('div');
  board.className = 'skin-screen-tiles';
  board.style.setProperty('--cols', String(spec.cols));
  board.style.setProperty('--tile', `${spec.tile}px`);
  board.style.setProperty('--gap', `${spec.gap}px`);
  [...spec.letters].forEach((ch, i) => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset.state = spec.path.includes(i) ? 'selected' : 'idle';
    const letter = document.createElement('span');
    letter.className = 'tile-letter';
    letter.textContent = ch;
    tile.append(letter);
    board.append(tile);
  });

  const size = spec.cols * spec.tile + (spec.cols - 1) * spec.gap;
  const stride = spec.tile + spec.gap;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'skin-screen-path');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('class', 'path-segments');
  renderRibbon(
    group,
    spec.path.map((i) => ({
      x: (i % spec.cols) * stride + spec.tile / 2,
      y: Math.floor(i / spec.cols) * stride + spec.tile / 2
    }))
  );
  svg.append(group);
  board.append(svg);

  screen.append(wordmark, board);
  return screen;
}
