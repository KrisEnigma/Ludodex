const SKINS = [
  { id: 'void', name: 'Void' },
  { id: 'lumen', name: 'Lumen' },
  { id: 'neon-horizon', name: 'Neon Horizon' },
  { id: 'laser-vector', name: 'Laser Vector' },
  { id: 'maze-chase', name: 'Maze Chase' },
  { id: 'swarm', name: 'Swarm' },
  { id: 'phantom-thieves', name: 'Phantom Thieves' },
  { id: 'catalyst', name: 'Catalyst' },
  { id: 'paleblood', name: 'Paleblood' },
  { id: 'aero', name: 'Aero' },
  { id: 'star-hunter', name: 'Star Hunter' },
  { id: 'relic-gold', name: 'Relic Gold' },
  { id: 'puff-star', name: 'Puff Star' },
  { id: 'overworld-8bit', name: '8-Bit Overworld' },
  { id: 'cape-16bit', name: '16-Bit Cape' },
  { id: 'blue-blur', name: 'Blue Blur' },
  { id: 'dragon-heat', name: 'Dragon Heat' },
  { id: 'radio-tag', name: 'Radio Tag' },
  { id: 'cyber-shinobi', name: 'Cyber Shinobi' },
  { id: 'gameboy', name: 'Dot Matrix' },
  { id: 'terminal', name: 'Terminal' },
  { id: 'phosphor', name: 'Phosphor' },
  { id: 'bios', name: 'BIOS' },
  { id: 'super-16-bit-lilac', name: 'Super 16-Bit Lilac' },
  { id: 'toaster', name: 'Toaster' },
  { id: 'lord-of-terror', name: 'Lord of Terror' },
  { id: 'test-chamber', name: 'Test Chamber' },
  { id: 'polygon', name: 'Polygon' },
  { id: 'ring-of-light', name: 'Ring of Light' },
  { id: 'dream-spiral', name: 'Dream Spiral' },
  { id: 'rip-tear', name: 'Rip & Tear' },
  { id: 'blood-darkness', name: 'Blood & Darkness' },
  { id: 'crimson', name: 'Crimson' }
];

const skinSelect = document.querySelector('#skinSelect');
const compareSelectedCheckbox = document.querySelector('#compareSelectedSkins');
const showAllCheckbox = document.querySelector('#showAllSkins');
const skinChecklist = document.querySelector('#skinChecklist');
const selectAllSkinsButton = document.querySelector('#selectAllSkins');
const clearAllSkinsButton = document.querySelector('#clearAllSkins');
const selectedSkinsCount = document.querySelector('#selectedSkinsCount');
const cards = document.querySelector('#skinCards');

const ROOT_TITLE_FONT_FAMILY_TOKEN = 'space mono';

const puzzleMarkup = `
  <div class="app-shell">
    <div class="view game-view">
      <div class="header">
        <button type="button" class="header-menu-button">← Menu</button>
        <div class="game-hint-counter">
          <span class="game-hint-counter-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="icon icon-bulb">
              <path d="M9 16 C 9 12 6 11 6 8 C 6 4.7 8.7 2 12 2 C 15.3 2 18 4.7 18 8 C 18 11 15 12 15 16 Z"></path>
              <path d="M9 19 L 15 19"></path>
            </svg>
          </span>
          <span class="game-hint-counter-count">5</span>
        </div>
        <span class="header-timer">0:18</span>
      </div>

      <div class="game-title-row">
        <h2 class="view-title">Dark Souls Bosses</h2>
      </div>

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

      <p class="game-instructions" hidden>Swipe adjacent letters to find all words.</p>
    </div>
  </div>
`;

const winMarkup = `
  <div class="app-shell">
    <div class="view win-view" data-stars="3">
      <div class="win-view-shell">
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

        <div class="win-pill-row">
          <div class="win-new-best" hidden>New best</div>
          <div class="win-new-rating" hidden>New rating</div>
          <div class="win-freeze-used" hidden>Streak Freeze used</div>
        </div>

        <button type="button" class="win-share-button button-primary">Share</button>

        <div class="win-secondary-row">
          <button type="button" class="win-play-again button-secondary">Play again</button>
          <button type="button" class="win-done-link button-tertiary">Done</button>
        </div>
      </div>

      <div class="tester-static-confetti" aria-hidden="true">
        <span class="tester-confetti-piece tester-confetti-a"></span>
        <span class="tester-confetti-piece tester-confetti-b"></span>
        <span class="tester-confetti-piece tester-confetti-c"></span>
        <span class="tester-confetti-piece tester-confetti-d"></span>
        <span class="tester-confetti-piece tester-confetti-e"></span>
        <span class="tester-confetti-piece tester-confetti-f"></span>
        <span class="tester-confetti-piece tester-confetti-g"></span>
        <span class="tester-confetti-piece tester-confetti-h"></span>
      </div>
    </div>
  </div>
`;

function fillSkinSelect() {
  skinSelect.innerHTML = SKINS.map((skin) => `<option value="${skin.id}">${skin.name}</option>`).join('');
}

function fillSkinChecklist() {
  skinChecklist.innerHTML = SKINS.map((skin) => `
    <label class="tester-check-item">
      <input type="checkbox" class="tester-skin-check" value="${skin.id}" />
      <span>${skin.name}</span>
    </label>
  `).join('');

  const defaultCompare = new Set(['void', 'lumen', 'neon-horizon']);
  for (const checkbox of skinChecklist.querySelectorAll('.tester-skin-check')) {
    checkbox.checked = defaultCompare.has(checkbox.value);
  }
}

function getCheckedSkinIds() {
  return Array.from(skinChecklist.querySelectorAll('.tester-skin-check:checked')).map((checkbox) => checkbox.value);
}

function updateSelectedCount() {
  const count = getCheckedSkinIds().length;
  selectedSkinsCount.textContent = `${count} selected`;
}

function cardTemplate(skin) {
  return `
    <section class="tester-card skin-${skin.id}">
      <header class="tester-card-header">
        <p class="tester-card-name">${skin.name}</p>
        <p class="tester-card-slug">${skin.id}</p>
      </header>
      <div class="tester-stage-grid">
        <section class="tester-stage tester-stage-game" aria-label="Game preview">
          <p class="tester-stage-label">Game</p>
          ${puzzleMarkup}
        </section>
        <section class="tester-stage tester-stage-win" aria-label="Win preview">
          <p class="tester-stage-label">Win</p>
          ${winMarkup}
        </section>
      </div>
    </section>
  `;
}

function maybePatchTitleFallbackVars(card) {
  const styles = getComputedStyle(card);
  const titleFamily = styles.getPropertyValue('--title-font-family').trim().toLowerCase();
  const wordmarkFamily = styles.getPropertyValue('--wordmark-font-family').trim().toLowerCase();
  const titleWeight = styles.getPropertyValue('--title-font-weight').trim();
  const wordmarkWeight = styles.getPropertyValue('--wordmark-font-weight').trim();
  const titleScale = styles.getPropertyValue('--title-font-scale').trim();
  const displayScale = styles.getPropertyValue('--display-font-scale').trim();

  // In the real game, skins are on <html>; in the tester they are on cards.
  // If title vars stayed at root defaults, mirror the intended root fallback
  // chain so title typography matches in-game rendering.
  if (titleFamily.includes(ROOT_TITLE_FONT_FAMILY_TOKEN) && !wordmarkFamily.includes(ROOT_TITLE_FONT_FAMILY_TOKEN)) {
    card.style.setProperty('--title-font-family', 'var(--wordmark-font-family)');
  }

  if (titleWeight === '700' && wordmarkWeight !== '700') {
    card.style.setProperty('--title-font-weight', 'var(--wordmark-font-weight)');
  }

  if ((titleScale === '1' || titleScale === '1.0') && displayScale !== '1' && displayScale !== '1.0') {
    card.style.setProperty('--title-font-scale', 'var(--display-font-scale)');
  }
}

function render() {
  const showAll = showAllCheckbox.checked;
  const compareSelected = compareSelectedCheckbox.checked;
  const selectedId = skinSelect.value || SKINS[0].id;
  const checkedIds = getCheckedSkinIds();
  let renderSkins = SKINS.filter((skin) => skin.id === selectedId);

  if (showAll) {
    renderSkins = SKINS;
  } else if (compareSelected && checkedIds.length > 0) {
    const checkedSet = new Set(checkedIds);
    renderSkins = SKINS.filter((skin) => checkedSet.has(skin.id));
  }

  cards.innerHTML = renderSkins.map(cardTemplate).join('');
  for (const card of cards.querySelectorAll('.tester-card')) {
    maybePatchTitleFallbackVars(card);
  }
}

fillSkinSelect();
fillSkinChecklist();
skinSelect.value = 'void';
updateSelectedCount();
render();

showAllCheckbox.addEventListener('change', () => {
  const showAll = showAllCheckbox.checked;
  skinSelect.disabled = showAll || compareSelectedCheckbox.checked;
  compareSelectedCheckbox.disabled = showAll;
  render();
});

compareSelectedCheckbox.addEventListener('change', () => {
  skinSelect.disabled = compareSelectedCheckbox.checked || showAllCheckbox.checked;
  render();
});

skinChecklist.addEventListener('change', (event) => {
  if (event.target instanceof HTMLInputElement && event.target.classList.contains('tester-skin-check')) {
    updateSelectedCount();
    if (compareSelectedCheckbox.checked) {
      render();
    }
  }
});

selectAllSkinsButton.addEventListener('click', () => {
  for (const checkbox of skinChecklist.querySelectorAll('.tester-skin-check')) {
    checkbox.checked = true;
  }
  updateSelectedCount();
  if (compareSelectedCheckbox.checked) {
    render();
  }
});

clearAllSkinsButton.addEventListener('click', () => {
  for (const checkbox of skinChecklist.querySelectorAll('.tester-skin-check')) {
    checkbox.checked = false;
  }
  updateSelectedCount();
  if (compareSelectedCheckbox.checked) {
    render();
  }
});

skinSelect.addEventListener('change', render);
