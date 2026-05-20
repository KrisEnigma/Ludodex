type IconName = 'trophy' | 'settings' | 'lock' | 'chevron-right' | 'dismiss';

type IconShape =
  | { type: 'path'; d: string }
  | { type: 'rect'; x: number; y: number; width: number; height: number; rx?: number }
  | { type: 'circle'; cx: number; cy: number; r: number }
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'polyline'; points: string };

const ICON_SHAPES: Record<IconName, IconShape[]> = {
  trophy: [
    { type: 'path', d: 'M7 4h10v5a5 5 0 0 1-10 0V4z' },
    { type: 'path', d: 'M17 5h2.5a1.5 1.5 0 0 1 1.5 1.5 3.5 3.5 0 0 1-3.5 3.5' },
    { type: 'path', d: 'M7 5H4.5A1.5 1.5 0 0 0 3 6.5 3.5 3.5 0 0 0 6.5 10' },
    { type: 'path', d: 'M12 14v4' },
    { type: 'path', d: 'M8 19h8' }
  ],
  settings: [
    { type: 'line', x1: 4, y1: 6, x2: 7, y2: 6 },
    { type: 'line', x1: 11, y1: 6, x2: 20, y2: 6 },
    { type: 'circle', cx: 9, cy: 6, r: 2 },
    { type: 'line', x1: 4, y1: 12, x2: 13, y2: 12 },
    { type: 'line', x1: 17, y1: 12, x2: 20, y2: 12 },
    { type: 'circle', cx: 15, cy: 12, r: 2 },
    { type: 'line', x1: 4, y1: 18, x2: 9, y2: 18 },
    { type: 'line', x1: 13, y1: 18, x2: 20, y2: 18 },
    { type: 'circle', cx: 11, cy: 18, r: 2 }
  ],
  lock: [
    { type: 'rect', x: 5, y: 11, width: 14, height: 10, rx: 2 },
    { type: 'path', d: 'M8 11V7a4 4 0 0 1 8 0v4' }
  ],
  'chevron-right': [
    { type: 'polyline', points: '9 6 15 12 9 18' }
  ],
  dismiss: [
    { type: 'line', x1: 6, y1: 6, x2: 18, y2: 18 },
    { type: 'line', x1: 18, y1: 6, x2: 6, y2: 18 }
  ]
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createIcon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('icon', `icon-${name}`);

  for (const shape of ICON_SHAPES[name]) {
    svg.append(createShapeElement(shape));
  }

  return svg;
}

function createShapeElement(shape: IconShape): SVGElement {
  switch (shape.type) {
    case 'path': {
      const el = document.createElementNS(SVG_NS, 'path');
      el.setAttribute('d', shape.d);
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
