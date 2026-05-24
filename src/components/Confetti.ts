type ConfettiOptions = {
  count?: number;
  duration?: number;
  colors?: string[];
};

const STYLE_ID = 'ludodex-confetti-styles';

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.confetti-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 120;
}

.confetti-piece {
  position: absolute;
  top: -10%;
  width: 10px;
  height: 10px;
  will-change: transform, opacity;
  animation-name: confetti-fall;
  animation-timing-function: cubic-bezier(0.2, 0.7, 0.2, 1);
  animation-fill-mode: both;
}

.confetti-piece[data-shape='circle'] {
  border-radius: 999px;
}

.confetti-piece[data-shape='square'] {
  border-radius: 2px;
}

@keyframes confetti-fall {
  0% {
    transform: translate3d(0, -10vh, 0) rotate(0deg) scale(var(--scale, 1));
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  100% {
    transform: translate3d(var(--drift, 0px), 115vh, 0) rotate(var(--rotation, 180deg)) scale(var(--scale, 1));
    opacity: 0;
  }
}
`;
  document.head.append(style);
}

export function showConfetti(options: ConfettiOptions = {}): void {
  // Respect the user's motion preference — skip confetti entirely.
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const count = options.count ?? 40;
  const lifetimeMs = options.duration ?? 5000;
  const colors = options.colors ?? ['var(--title-glow)'];

  ensureStyles();

  const overlay = document.createElement('div');
  overlay.className = 'confetti-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.dataset.shape = Math.random() < 0.5 ? 'circle' : 'square';
    piece.style.background = colors[i % colors.length];

    const left = Math.random() * 100;
    const drift = (Math.random() - 0.5) * 240;
    const delay = Math.random() * 0.4;
    const duration = 2.2 + Math.random() * 2.4;
    const rotation = Math.floor(Math.random() * 360);
    const scale = 0.7 + Math.random() * 0.6;
    const opacity = 0.6 + Math.random() * 0.4;

    piece.style.left = `${left}%`;
    piece.style.setProperty('--drift', `${drift}px`);
    piece.style.setProperty('--rotation', `${rotation}deg`);
    piece.style.setProperty('--scale', String(scale));
    piece.style.opacity = String(opacity);
    piece.style.animationDelay = `${delay}s`;
    piece.style.animationDuration = `${duration}s`;

    overlay.append(piece);
  }

  document.body.append(overlay);
  window.setTimeout(() => overlay.remove(), lifetimeMs);
}
