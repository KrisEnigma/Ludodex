type IconName = 'trophy' | 'settings' | 'lock' | 'chevron-right' | 'dismiss' | 'flame' | 'bulb';

type IconShape =
  | { type: 'path'; d: string; fillRule?: 'evenodd' | 'nonzero' }
  | { type: 'rect'; x: number; y: number; width: number; height: number; rx?: number }
  | { type: 'circle'; cx: number; cy: number; r: number }
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'polyline'; points: string };

type IconEntry = {
  shapes: IconShape[];
  /** If true, renders fill="currentColor" stroke="none" instead of the default stroke style. */
  filled?: boolean;
};

const ICONS: Record<IconName, IconEntry> = {
  trophy: { shapes: [
    { type: 'path', d: 'M7 4h10v5a5 5 0 0 1-10 0V4z' },
    { type: 'path', d: 'M17 5h2.5a1.5 1.5 0 0 1 1.5 1.5 3.5 3.5 0 0 1-3.5 3.5' },
    { type: 'path', d: 'M7 5H4.5A1.5 1.5 0 0 0 3 6.5 3.5 3.5 0 0 0 6.5 10' },
    { type: 'path', d: 'M12 14v4' },
    { type: 'path', d: 'M8 19h8' }
  ]},
  settings: { shapes: [
    { type: 'line', x1: 4, y1: 6, x2: 7, y2: 6 },
    { type: 'line', x1: 11, y1: 6, x2: 20, y2: 6 },
    { type: 'circle', cx: 9, cy: 6, r: 2 },
    { type: 'line', x1: 4, y1: 12, x2: 13, y2: 12 },
    { type: 'line', x1: 17, y1: 12, x2: 20, y2: 12 },
    { type: 'circle', cx: 15, cy: 12, r: 2 },
    { type: 'line', x1: 4, y1: 18, x2: 9, y2: 18 },
    { type: 'line', x1: 13, y1: 18, x2: 20, y2: 18 },
    { type: 'circle', cx: 11, cy: 18, r: 2 }
  ]},
  lock: { shapes: [
    { type: 'rect', x: 5, y: 11, width: 14, height: 10, rx: 2 },
    { type: 'path', d: 'M8 11V7a4 4 0 0 1 8 0v4' }
  ]},
  'chevron-right': { shapes: [
    { type: 'polyline', points: '9 6 15 12 9 18' }
  ]},
  dismiss: { shapes: [
    { type: 'line', x1: 6, y1: 6, x2: 18, y2: 18 },
    { type: 'line', x1: 18, y1: 6, x2: 6, y2: 18 }
  ]},
  /**
   * Filled flame with inner cutout (fill-rule: evenodd).
   * Outer path: flame silhouette with side lick.
   * Inner subpath (same `d`): teardrop highlight — creates the hollow inner glow.
   * Both subpaths share one <path> element; evenodd punches the inner shape out.
   */
  flame: { filled: true, shapes: [
    {
      type: 'path',
      fillRule: 'evenodd',
      d:
        // Outer flame
        'M 21 16 C 20 20.5 16.5 22 13 22 C 9.5 22 6 20.5 5.5 16' +
        ' C 4 10.5 13.5 8.5 10 1.5 C 10 1.5 15 3.5 17 9' +
        ' C 17.5 9.5 18.5 7.5 17.5 6 C 21 9.5 22 14 21 16 Z' +
        // Inner cutout — evenodd punches this out of the fill
        ' M 11 20 C 10 18.5 10.5 16 12 15' +
        ' C 11.5 14.5 11.5 13.5 12.5 13.5' +
        ' C 14 14.5 15.5 17 15 20' +
        ' C 14.5 21.5 12 21.5 11 20 Z'
    }
  ]},
  bulb: { shapes: [
    { type: 'path', d: 'M9 16 C 9 12 6 11 6 8 C 6 4.7 8.7 2 12 2 C 15.3 2 18 4.7 18 8 C 18 11 15 12 15 16 Z' },
    { type: 'path', d: 'M9 19 L 15 19' }
  ]}
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createIcon(name: IconName): SVGSVGElement {
  const entry = ICONS[name];
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('icon', `icon-${name}`);

  if (entry.filled) {
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('stroke', 'none');
  } else {
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
  }

  for (const shape of entry.shapes) {
    svg.append(createShapeElement(shape));
  }

  return svg;
}

function createShapeElement(shape: IconShape): SVGElement {
  switch (shape.type) {
    case 'path': {
      const el = document.createElementNS(SVG_NS, 'path');
      el.setAttribute('d', shape.d);
      if (shape.fillRule) el.setAttribute('fill-rule', shape.fillRule);
      return el;
    }
    case 'rect': {
      const el = document.createElementNS(SVG_NS, 'rect');
      el.setAttribute('x', String(shape.x));
      el.setAttribute('y', String(shape.y));
      el.setAttribute('width', String(shape.width));
      el.setAttribute('height', String(shape.height));
      if (shape.rx !== undefined) el.setAttribute('rx', String(shape.rx));
      return el;
    }
    case 'circle': {
      const el = document.createElementNS(SVG_NS, 'circle');
      el.setAttribute('cx', String(shape.cx));
      el.setAttribute('cy', String(shape.cy));
      el.setAttribute('r', String(shape.r));
      return el;
    }
    case 'line': {
      const el = document.createElementNS(SVG_NS, 'line');
      el.setAttribute('x1', String(shape.x1));
      el.setAttribute('y1', String(shape.y1));
      el.setAttribute('x2', String(shape.x2));
      el.setAttribute('y2', String(shape.y2));
      return el;
    }
    case 'polyline': {
      const el = document.createElementNS(SVG_NS, 'polyline');
      el.setAttribute('points', shape.points);
      return el;
    }
  }
}
