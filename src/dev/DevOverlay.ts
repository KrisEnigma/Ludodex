/**
 * Dev overlay — floating badge that shows the current dev mode and lets you
 * toggle between full dev access and web-player simulation with one tap.
 *
 * Only imported in dev builds (import.meta.env.DEV gate in IAPService.ts).
 * Zero bytes in production bundles.
 *
 *   🔓 DEV  — all skins + levels unlocked (default dev state)
 *   🌐 WEB  — simulates the web player experience (limited skin set)
 *
 * Tap the badge to toggle. Page reloads to apply the change.
 */

const SIM_KEY = 'dev_sim_platform';

const CSS = `
  #dev-overlay {
    position: fixed;
    bottom: 20px;
    right: 14px;
    z-index: 99999;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px 6px 9px;
    border-radius: 999px;
    border: 1.5px solid rgba(255, 255, 255, 0.25);
    font-family: ui-monospace, 'Space Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #fff;
    cursor: pointer;
    user-select: none;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    transition: transform 0.1s, opacity 0.15s;
    -webkit-tap-highlight-color: transparent;
  }
  #dev-overlay:active { transform: scale(0.94); }
  #dev-overlay[data-sim="false"] { background: rgba(220, 80, 20, 0.88); }
  #dev-overlay[data-sim="true"]  { background: rgba(30, 100, 230, 0.88); }

  #dev-overlay-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.7);
    animation: dev-pulse 2s infinite;
  }
  @keyframes dev-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.35; }
  }
`;

function isSimulating(): boolean {
  return sessionStorage.getItem(SIM_KEY) === 'web';
}

function mount(): void {
  // Inject stylesheet
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // Build badge
  const badge = document.createElement('button');
  badge.id = 'dev-overlay';
  badge.type = 'button';
  badge.setAttribute('aria-label', 'Dev mode toggle');

  const dot = document.createElement('span');
  dot.id = 'dev-overlay-dot';

  const label = document.createElement('span');

  badge.appendChild(dot);
  badge.appendChild(label);

  function update(): void {
    const sim = isSimulating();
    label.textContent = sim ? '🌐 Web player' : '🔓 Dev';
    badge.title = sim
      ? 'Simulating web player — tap to restore full dev access'
      : 'Full dev access — tap to simulate web player';
    badge.dataset.sim = sim ? 'true' : 'false';
  }

  badge.addEventListener('click', () => {
    if (isSimulating()) {
      sessionStorage.removeItem(SIM_KEY);
    } else {
      sessionStorage.setItem(SIM_KEY, 'web');
    }
    location.reload();
  });

  document.body.appendChild(badge);
  update();
}

export function initDevOverlay(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
}
