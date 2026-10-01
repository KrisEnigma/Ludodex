/**
 * Swipe ribbon renderer, shared by the game (GameView.redrawPath) and the
 * skin preview (SettingsView skin detail sheet).
 *
 * One <line> per segment between consecutive tile centres. Each segment gets
 * its OWN linear gradient (userSpaceOnUse, along the segment) running from the
 * colour at its start to the colour at its end, so the colour flows
 * continuously along the whole swipe instead of stepping per segment.
 *
 * Colours stay fully skin-driven: gradient stops are tinted in CSS
 * (.path-stop, via --stop-t and the skin's --path-grad-start/-end); JS only
 * supplies geometry and fractions. --seg-t (segment midpoint) still drives the
 * glow tint and any per-segment CSS.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
let ribbonCounter = 0;

export type RibbonPoint = { x: number; y: number };

/** Replace `group`'s contents with ribbon segments through `points`. */
export function renderRibbon(group: SVGGElement, points: RibbonPoint[]): void {
  while (group.firstChild) group.removeChild(group.firstChild);
  if (points.length < 2) return;

  const defs = document.createElementNS(SVG_NS, 'defs');
  group.append(defs);
  const prefix = `ribbon-${++ribbonCounter}`;
  const segCount = points.length - 1;

  for (let i = 0; i < segCount; i++) {
    const a = points[i];
    const b = points[i + 1];
    const t0 = i / segCount;
    const t1 = (i + 1) / segCount;

    const grad = document.createElementNS(SVG_NS, 'linearGradient');
    const id = `${prefix}-${i}`;
    grad.setAttribute('id', id);
    grad.setAttribute('gradientUnits', 'userSpaceOnUse');
    grad.setAttribute('x1', String(a.x));
    grad.setAttribute('y1', String(a.y));
    grad.setAttribute('x2', String(b.x));
    grad.setAttribute('y2', String(b.y));
    for (const [offset, t] of [[0, t0], [1, t1]] as const) {
      const stop = document.createElementNS(SVG_NS, 'stop');
      stop.setAttribute('class', 'path-stop');
      stop.setAttribute('offset', String(offset));
      stop.style.setProperty('--stop-t', String(t));
      grad.append(stop);
    }
    defs.append(grad);

    const seg = document.createElementNS(SVG_NS, 'line');
    seg.setAttribute('class', 'path-seg');
    seg.setAttribute('x1', String(a.x));
    seg.setAttribute('y1', String(a.y));
    seg.setAttribute('x2', String(b.x));
    seg.setAttribute('y2', String(b.y));
    seg.style.setProperty('--seg-t', String((t0 + t1) / 2));
    // Inline stroke beats the class's flat color-mix fallback.
    seg.style.stroke = `url(#${id})`;
    group.append(seg);
  }
}
