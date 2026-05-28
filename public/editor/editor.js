/* ===== CONSTANTS ===== */
const API_URL = '/api/puzzles';
const COLS = ['a','b','c','d'];
const ROWS = ['1','2','3','4'];
const CELL_ORDER = ROWS.flatMap(r => COLS.map(c => c + r));
const WC = ['#5b9bff','#f472b6','#4ade80','#fb923c','#c084fc','#34d399','#fbbf24','#f87171'];
let CATS = ['characters','titles','studios','franchises','consoles','composers','genres','decades'];
const DIFFS = ['easy','medium','hard'];

/* ===== STATE ===== */
let serverPuzzles = [];
let editingId = null;
let savedSnapshot = '';
let dialogState = null;

let S = {
  meta: { id:'', category: CATS[0], nameEn:'', nameEs:'', difficulty: DIFFS[0], date:'', hintEn:'', hintEs:'', premium: false },
  letters: {}, words: [], drawIdx: null, path: [],
  newWord: '', importText: '', importErr: '', copied: false, viewMode: 'edit'
};

const AUTOSAVE_KEY = 'ludodex_editor_v2_state';

/* ===== PERSISTENCE ===== */
function saveLocalState() {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ meta: S.meta, letters: S.letters, words: S.words, newWord: S.newWord }));
  } catch(e) {}
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (p.meta) S.meta = { ...S.meta, ...p.meta };
    if (p.letters) S.letters = p.letters;
    if (p.words) S.words = p.words;
    if (p.newWord) S.newWord = p.newWord;
  } catch(e) {}
}

/* ===== THEME ===== */
function toggleTheme() {
  const html = document.documentElement;
  const cur = html.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  const btn = document.getElementById('theme-toggle');
  if (next === 'light') {
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
  } else {
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }
}

/* ===== MOBILE TABS ===== */
function setTab(tab) {
  S.viewMode = tab;
  document.querySelectorAll('.mobile-tab').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.tab === tab);
    btn.setAttribute('aria-selected', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.mobile-pane').forEach(pane => {
    pane.classList.toggle('is-active', pane.dataset.panel === tab || pane.dataset.panel === 'edit' && tab === 'edit');
  });
  // left col always visible on desktop
}

/* ===== SERVER STATUS ===== */
function serverStatus(msg, isError = false) {
  const el = document.getElementById('server-status');
  el.textContent = msg;
  el.className = isError ? 'error' : msg.startsWith('✓') ? 'success' : '';
}

// Token persistence
(function() {
  const inp = document.getElementById('api-token');
  if (inp) {
    try {
      const saved = localStorage.getItem('ludodex_cms_token') || '';
      inp.value = saved;
      if (saved) setTimeout(serverLoad, 100); // auto-login if token present
    } catch(e) {}
    inp.addEventListener('input', () => {
      try { localStorage.setItem('ludodex_cms_token', inp.value.trim()); } catch(e) {}
    });
  }
})();

function token() { return document.getElementById('api-token').value.trim(); }
function authHeaders() { return { 'Content-Type': 'application/json', ...(token() ? { 'Authorization': `Bearer ${token()}` } : {}) }; }

async function readApiJson(res) {
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch(e) { body = { error: text.slice(0, 120) }; }
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}

/* ===== SNAPSHOT / DIRTY ===== */
function currentSnapshot() { return toJSON(S.meta, S.words, S.letters); }
function syncSavedSnapshot() { savedSnapshot = currentSnapshot(); }
function isDirty() { return currentSnapshot() !== savedSnapshot; }

function updateDirtyChip() {
  const chip = document.getElementById('dirty-chip');
  if (!chip) return;
  const dirty = isDirty();
  chip.className = 'save-chip ' + (dirty ? 'save-chip--dirty' : 'save-chip--clean');
  chip.textContent = dirty ? 'Unsaved changes' : 'Saved';
}

/* ===== DIALOG ===== */
function promptConfirm(state) {
  return new Promise(resolve => {
    dialogState = { ...state, resolve };
    renderDialog();
  });
}

function dialogAccept() {
  if (!dialogState) return;
  const resolve = dialogState.resolve;
  dialogState = null;
  renderDialog();
  resolve(true);
}

function dialogCancel() {
  if (!dialogState) return;
  const resolve = dialogState.resolve;
  dialogState = null;
  renderDialog();
  resolve(false);
}

function renderDialog() {
  const mount = document.getElementById('dialog-mount');
  if (!dialogState) { mount.innerHTML = ''; return; }
  const variant = dialogState.variant === 'danger' ? 'btn-danger' : 'btn-primary';
  mount.innerHTML = `
  <div class="dialog-backdrop" onclick="dialogCancel()" role="dialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-msg">
    <div class="dialog-card" onclick="event.stopPropagation()">
      <p class="dialog-title" id="dlg-title">${escapeHtml(dialogState.title)}</p>
      <p class="dialog-message" id="dlg-msg">${escapeHtml(dialogState.message)}</p>
      <div class="dialog-actions">
        <button class="btn btn-ghost" onclick="dialogCancel()">${escapeHtml(dialogState.cancelText || 'Cancel')}</button>
        <button class="btn ${variant}" onclick="dialogAccept()">${escapeHtml(dialogState.confirmText || 'OK')}</button>
      </div>
    </div>
  </div>`;
}

/* ===== SERVER OPS ===== */
async function serverLoad() {
  if (!token()) { serverStatus('Enter a token first', true); return; }
  serverStatus('Loading…');
  try {
    const res = await fetch(API_URL, { headers: authHeaders() });
    const body = await readApiJson(res);
    serverPuzzles = Array.isArray(body) ? body : (body.puzzles || []);
    rebuildCats();
    serverStatus(`✓ ${serverPuzzles.length} puzzles`);
    rebuildSelect();
    // Switch to logged-in UI
    document.getElementById('login-group').style.display = 'none';
    const lg = document.getElementById('logged-group');
    lg.style.display = 'flex';
    ['btn-new','btn-save','btn-delete'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.removeAttribute('disabled');
    });
    const sel = document.getElementById('puzzle-select');
    if (sel) sel.removeAttribute('disabled');
    // If already in list mode, refresh it
    if (editorMode === 'list') renderListPanel();
  } catch(e) {
    serverStatus('Load failed: ' + e.message, true);
  }
}

function rebuildCats() {
  const fromData = new Set(serverPuzzles.map(p => p.category).filter(Boolean));
  // Merge: keep existing CATS order, append any new ones found in data
  const merged = [...CATS];
  fromData.forEach(c => { if (!merged.includes(c)) merged.push(c); });
  CATS = merged;
}

function addCategory(val) {
  const cat = val.trim().toLowerCase().replace(/\s+/g, '-');
  if (!cat) return;
  if (!CATS.includes(cat)) CATS.push(cat);
  S.meta.category = cat;
  renderAll();
}

function rebuildSelect() {
  const sel = document.getElementById('puzzle-select');
  sel.innerHTML = `<option value="">— select puzzle —</option>`;
  serverPuzzles.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.id}`;
    if (p.name?.en) opt.textContent += ` — ${p.name.en}`;
    if (editingId === p.id) opt.selected = true;
    sel.appendChild(opt);
  });
}

async function serverSelectPuzzle(id) {
  if (!id) return;
  const puzzle = serverPuzzles.find(p => p.id === id);
  if (!puzzle) return;
  if (isDirty()) {
    const ok = await promptConfirm({ title: 'Discard changes?', message: 'You have unsaved changes. Load a different puzzle anyway?', confirmText: 'Discard', variant: 'danger' });
    if (!ok) { rebuildSelect(); return; }
  }
  loadPuzzleIntoEditor(puzzle, id);
}

function loadPuzzleIntoEditor(puzzle, id) {
  editingId = id;
  const n = puzzle.name || {};
  const h = puzzle.hint || {};
  S.meta = {
    id: puzzle.id || '',
    category: puzzle.category || CATS[0],
    nameEn: n.en || '', nameEs: n.es || '',
    difficulty: puzzle.difficulty || DIFFS[0],
    date: puzzle.date || '',
    hintEn: h.en || '', hintEs: h.es || '',
    series: puzzle.series || '',
    premium: !!puzzle.premium,
  };
  const d = puzzle.data || {};
  S.letters = {};
  S.words = [];
  CATS; // no-op
  // API format: data = { "WORD": "pathstring" }  OR  { word1: { display, path } }
  // Detect which format and normalise into [{ display, path }]
  const firstVal = Object.values(d)[0];
  const isLegacy = firstVal && typeof firstVal === 'object' && ('display' in firstVal || 'path' in firstVal);

  if (isLegacy) {
    // Old format: { word1: { display: "X", path: "a1b1" } }
    S.words = Object.entries(d)
      .filter(([k]) => k.startsWith('word'))
      .map(([k, v], i) => ({
        id: k,
        display: v.display || '',
        path: Array.isArray(v.path) ? v.path.join('') : (v.path || ''),
        color: WC[i % WC.length],
      }));
  } else {
    // New format: { "WORD": "pathstring" }
    S.words = Object.entries(d).map(([display, path], i) => ({
      id: `word${i + 1}`,
      display,
      path: Array.isArray(path) ? path.join('') : (path || ''),
      color: WC[i % WC.length],
    }));
  }

  // Rebuild letters from words
  S.words.forEach(w => {
    const coords = (w.path.match(/.{2}/g) || []);
    const letters = w.display.replace(/ /g, '').split('');
    coords.forEach((c, i) => { if (letters[i]) S.letters[c] = letters[i]; });
  });
  // Filler tiles
  if (puzzle.filler) Object.entries(puzzle.filler).forEach(([c, l]) => { if (!S.letters[c]) S.letters[c] = l; });

  S.drawIdx = null; S.path = [];
  syncSavedSnapshot();
  renderAll();
}


function serverLogout() {
  try { localStorage.removeItem('ludodex_cms_token'); } catch(e) {}
  document.getElementById('api-token').value = '';
  document.getElementById('login-group').style.display = 'flex';
  document.getElementById('logged-group').style.display = 'none';
  document.getElementById('puzzle-select').innerHTML = '<option value="">— select puzzle —</option>';
  serverPuzzles = [];
  editingId = null;
  serverStatus('');
  // Reset mode to full on logout
  if (editorMode === 'list') setEditorMode('full');
}
async function serverNew() {
  if (isDirty()) {
    const ok = await promptConfirm({ title: 'Discard changes?', message: 'You have unsaved changes. Create a new puzzle anyway?', confirmText: 'Discard', variant: 'danger' });
    if (!ok) return;
  }
  editingId = null;
  S.meta = { id:'', category: CATS[0], nameEn:'', nameEs:'', difficulty: DIFFS[0], date:'', hintEn:'', hintEs:'', premium: false };
  S.letters = {}; S.words = []; S.drawIdx = null; S.path = [];
  syncSavedSnapshot();
  renderAll();
}

async function serverSaveCurrent() {
  const json = buildPuzzleObject();
  if (!json) return;
  serverStatus('Saving…');
  try {
    let res;
    if (editingId) {
      // Update existing: replace the puzzle in the array
      const idx = serverPuzzles.findIndex(p => p.id === editingId);
      if (idx >= 0) serverPuzzles[idx] = json;
      else serverPuzzles.push(json);
    } else {
      if (!S.meta.id) { serverStatus('Set an ID first', true); return; }
      editingId = S.meta.id;
      serverPuzzles.push(json);
    }
    res = await fetch(API_URL, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(serverPuzzles, null, 2),
    });
    const body = await readApiJson(res);
    serverStatus(`✓ Saved as ${editingId}`);
    syncSavedSnapshot();
    updateDirtyChip();
    rebuildSelect();
  } catch(e) {
    serverStatus('Save failed: ' + e.message, true);
  }
}

async function serverDeleteCurrent() {
  if (!editingId) { serverStatus('Nothing to delete', true); return; }
  const ok = await promptConfirm({
    title: 'Delete puzzle?',
    message: `Permanently delete "${editingId}"? This cannot be undone.`,
    confirmText: 'Delete', cancelText: 'Cancel', variant: 'danger',
  });
  if (!ok) return;
  serverPuzzles = serverPuzzles.filter(p => p.id !== editingId);
  serverStatus('Deleting…');
  try {
    const res = await fetch(API_URL, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(serverPuzzles, null, 2) });
    await readApiJson(res);
    serverStatus(`✓ Deleted`);
    editingId = null;
    rebuildSelect();
    await serverNew();
  } catch(e) {
    serverStatus('Delete failed: ' + e.message, true);
  }
}

/* ===== BUILD PUZZLE OBJECT ===== */
function buildPuzzleObject() {
  const id = S.meta.id.trim();
  if (!id) { serverStatus('Puzzle ID is required', true); return null; }
  const data = {};
  S.words.forEach(w => { data[w.display] = w.path; });
  // filler tiles (letters not covered by words)
  const usedCells = new Set(S.words.flatMap(w => (w.path.match(/.{2}/g) || [])));
  const filler = {};
  Object.entries(S.letters).forEach(([c, l]) => { if (!usedCells.has(c)) filler[c] = l; });
  return {
    id,
    category: S.meta.category,
    name: { en: S.meta.nameEn, es: S.meta.nameEs },
    difficulty: S.meta.difficulty,
    date: S.meta.date,
    hint: { en: S.meta.hintEn, es: S.meta.hintEs },
    ...(S.meta.series ? { series: S.meta.series } : {}),
    premium: S.meta.premium,
    data,
    ...(Object.keys(filler).length ? { filler } : {}),
  };
}

/* ===== JSON OUTPUT ===== */
function toJSON(meta, words, letters) {
  const data = {};
  words.forEach(w => { data[w.display] = w.path; });
  const usedCells = new Set(words.flatMap(w => (w.path.match(/.{2}/g) || [])));
  const filler = {};
  Object.entries(letters).forEach(([c, l]) => { if (!usedCells.has(c)) filler[c] = l; });
  return JSON.stringify({
    id: meta.id,
    category: meta.category,
    name: { en: meta.nameEn, es: meta.nameEs },
    difficulty: meta.difficulty,
    date: meta.date,
    hint: { en: meta.hintEn, es: meta.hintEs },
    premium: meta.premium,
    data,
    ...(Object.keys(filler).length ? { filler } : {}),
  }, null, 2);
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ===== VALIDATION ===== */
function validate() {
  const errs = [];
  const warns = [];
  if (!S.meta.id.trim()) errs.push('Puzzle ID is required');
  if (!S.meta.nameEn.trim()) warns.push('Missing English name');
  if (!S.meta.nameEs.trim()) warns.push('Missing Spanish name');
  if (S.words.length === 0) errs.push('No words defined');
  const filledCells = Object.keys(S.letters).length;
  if (filledCells < 16) warns.push(`Grid not full (${filledCells}/16 cells)`);
  S.words.forEach(w => {
    if (!w.path || w.path.length < 2) errs.push(`Word "${w.display}" has no path`);
    const coords = w.path.match(/.{2}/g) || [];
    const letterCount = w.display.replace(/ /g,'').length;
    if (coords.length !== letterCount) errs.push(`Word "${w.display}" path length mismatch (${coords.length} cells, ${letterCount} letters)`);
  });
  return { errs, warns, ok: errs.length === 0 };
}

/* ===== RENDER ===== */
function renderAll() {
  renderGrid();
  renderDrawContext();
  renderWords();
  renderMeta();
  renderExport();
  updateDirtyChip();
  saveLocalState();
}

function renderGrid() {
  const wrap = document.getElementById('grid-wrap');
  if (!wrap) return;
  const filledCount = Object.keys(S.letters).length;
  const label = document.getElementById('grid-fill-label');
  if (label) label.textContent = `${filledCount}/16 filled`;

  wrap.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'tile-grid';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
  grid.style.gap = 'var(--space-2)';

  CELL_ORDER.forEach(cell => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset.cell = cell;

    const letter = S.letters[cell] || '';
    const wordForCell = S.words.find(w => (w.path.match(/.{2}/g) || []).includes(cell));
    const isDrawing = S.drawIdx !== null;
    const isInCurrentPath = S.path.includes(cell);
    const isWordActive = S.drawIdx !== null && wordForCell && S.words[S.drawIdx]?.id === wordForCell.id;

    if (wordForCell) {
      tile.style.setProperty('--word-color', wordForCell.color);
      tile.classList.add('tile--word');
      if (isWordActive || isInCurrentPath) tile.classList.add('tile--active');
    }
    if (isInCurrentPath) {
      tile.style.setProperty('--word-color', WC[S.drawIdx % WC.length]);
      tile.classList.add('tile--path');
    }
    if (letter) tile.classList.add('tile--filled');
    if (!letter && !isInCurrentPath) tile.classList.add('tile--empty');

    tile.innerHTML = `<span class="tile-letter">${escapeHtml(letter)}</span><span class="tile-coord">${cell}</span>`;

    // Events
    tile.addEventListener('pointerdown', e => { e.preventDefault(); onTileDown(cell); });
    tile.addEventListener('pointerenter', e => { if (e.buttons) onTileEnter(cell); });
    tile.addEventListener('pointerup', () => onTileUp());

    grid.appendChild(tile);
  });

  wrap.appendChild(grid);

  // Global pointerup to end draw even outside the grid
  document.removeEventListener('pointerup', onTileUp);
  document.addEventListener('pointerup', onTileUp, { once: true });
}

function onTileDown(cell) {
  if (S.drawIdx === null) return;
  S.path = [cell];
  renderGrid();
}
function onTileEnter(cell) {
  if (S.drawIdx === null || S.path.length === 0) return;
  if (!S.path.includes(cell)) S.path.push(cell);
  renderGrid();
}
function onTileUp() {
  if (S.drawIdx === null || S.path.length === 0) return;
  const word = S.words[S.drawIdx];
  if (!word) return;
  const letterCount = word.display.replace(/ /g,'').length;
  if (S.path.length === letterCount) {
    // Assign letters to cells
    const letters = word.display.replace(/ /g,'').split('');
    S.path.forEach((c, i) => { S.letters[c] = letters[i]; });
    word.path = S.path.join('');
  }
  S.path = [];
  renderAll();
}

function renderDrawContext() {
  const el = document.getElementById('draw-context');
  if (!el) return;
  if (S.drawIdx === null) { el.style.display = 'none'; el.innerHTML = ''; return; }
  const word = S.words[S.drawIdx];
  if (!word) { el.style.display = 'none'; return; }
  el.style.display = '';
  const letterCount = word.display.replace(/ /g,'').length;
  const pathCells = S.path.length || (word.path.match(/.{2}/g) || []).length;
  el.innerHTML = `
    <div class="draw-context-inner">
      <span class="draw-badge" style="background:${word.color}20;color:${word.color};border-color:${word.color}40">Drawing</span>
      <span class="draw-word" style="color:${word.color}">${escapeHtml(word.display)}</span>
      <span class="draw-progress">${pathCells}/${letterCount} cells</span>
      <button class="btn btn-ghost draw-cancel" onclick="S.drawIdx=null;S.path=[];renderAll()">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Cancel
      </button>
    </div>`;
}

function renderWords() {
  const list = document.getElementById('words-list');
  const countLabel = document.getElementById('word-count-label');
  if (!list) return;
  if (countLabel) countLabel.textContent = `${S.words.length} total`;
  if (S.words.length === 0) {
    list.innerHTML = `<div class="words-empty">No words yet. Type a word above and click Add.</div>`;
    return;
  }
  list.innerHTML = S.words.map((w, i) => {
    const pathCells = (w.path.match(/.{2}/g) || []).length;
    const letterCount = w.display.replace(/ /g,'').length;
    const isActive = S.drawIdx === i;
    return `
    <div class="word-item${isActive ? ' word-item--active' : ''}" style="--wc:${w.color}">
      <span class="word-dot" style="background:${w.color}"></span>
      <span class="word-name">${escapeHtml(w.display)}</span>
      <span class="word-path">${pathCells}/${letterCount}</span>
      <button class="btn btn-ghost btn-icon word-action" onclick="startDraw(${i})" title="Draw path" aria-label="Draw path for ${escapeHtml(w.display)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      </button>
      <button class="btn btn-ghost btn-icon word-action" onclick="clearWordPath(${i})" title="Clear path" aria-label="Clear path for ${escapeHtml(w.display)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
      </button>
      <button class="btn btn-ghost btn-icon word-action" onclick="removeWord(${i})" title="Remove word" aria-label="Remove ${escapeHtml(w.display)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`;
  }).join('');
}

function renderMeta() {
  const form = document.getElementById('meta-form');
  if (!form) return;
  const m = S.meta;
  form.innerHTML = `
    <div class="form-field span-3">
      <label class="form-label" for="m-nen">Name (EN)</label>
      <input class="form-input" id="m-nen" type="text" value="${escapeHtml(m.nameEn)}" placeholder="English name" oninput="S.meta.nameEn=this.value;renderAll()">
    </div>
    <div class="form-field span-3">
      <label class="form-label" for="m-nes">Name (ES)</label>
      <input class="form-input" id="m-nes" type="text" value="${escapeHtml(m.nameEs)}" placeholder="Spanish name" oninput="S.meta.nameEs=this.value;renderAll()">
    </div>
    <div class="form-field span-3">
      <label class="form-label" for="m-hen">Hint (EN)</label>
      <input class="form-input" id="m-hen" type="text" value="${escapeHtml(m.hintEn)}" placeholder="Hint in English" oninput="S.meta.hintEn=this.value;renderAll()">
    </div>
    <div class="form-field span-3">
      <label class="form-label" for="m-hes">Hint (ES)</label>
      <input class="form-input" id="m-hes" type="text" value="${escapeHtml(m.hintEs)}" placeholder="Hint in Spanish" oninput="S.meta.hintEs=this.value;renderAll()">
    </div>
    <div class="form-field">
      <label class="form-label" for="m-cat">Category</label>
      <input class="form-input" id="m-cat" type="text" list="cats-list"
        value="${escapeHtml(m.category)}"
        placeholder="Type or pick…"
        oninput="S.meta.category=this.value.trim().toLowerCase().replace(/\\s+/g,'-');renderAll()"
        onchange="addCategory(this.value)"
        autocomplete="off">
      <datalist id="cats-list">
        ${CATS.map(c => `<option value="${c}">`).join('')}
      </datalist>
    </div>
    <div class="form-field">
      <label class="form-label" for="m-diff">Difficulty</label>
      <select class="form-input" id="m-diff" onchange="S.meta.difficulty=this.value;renderAll()">
        ${DIFFS.map(d => `<option value="${d}"${m.difficulty===d?' selected':''}>${d}</option>`).join('')}
      </select>
    </div>
    <div class="form-field">
      <label class="form-label" for="m-series">Series</label>
      <input class="form-input" id="m-series" type="text" value="${escapeHtml(m.series||'')}" placeholder="e.g. Final Fantasy" oninput="S.meta.series=this.value;renderAll()">
    </div>
    <div class="form-field">
      <label class="form-label" for="m-date">Date</label>
      <input class="form-input" id="m-date" type="date" value="${escapeHtml(m.date)}" oninput="S.meta.date=this.value;renderAll()">
    </div>
    <div class="form-field span-2 form-field--inline">
      <input type="checkbox" id="m-premium" ${m.premium?'checked':''} onchange="S.meta.premium=this.checked;renderAll()">
      <label for="m-premium">Premium puzzle</label>
    </div>`;
}

function renderExport() {
  const v = validate();
  const block = document.getElementById('validation-block');
  if (block) {
    const icon = v.ok ? '✓' : '✗';
    const cls  = v.ok ? 'validation-ok' : 'validation-err';
    let html = `<div class="validation-row ${cls}"><span>${icon} ${v.ok ? 'Valid puzzle' : v.errs[0]}</span></div>`;
    if (v.warns.length) html += v.warns.map(w => `<div class="validation-row validation-warn">⚠ ${escapeHtml(w)}</div>`).join('');
    block.innerHTML = html;
  }
  const out = document.getElementById('json-output');
  if (out) out.textContent = toJSON(S.meta, S.words, S.letters);
  const imp = document.getElementById('import-text');
  if (imp && S.importText) imp.value = S.importText;
  const impErr = document.getElementById('import-error');
  if (impErr) impErr.textContent = S.importErr;
}

/* ===== WORD OPS ===== */
function addWord() {
  const raw = (document.getElementById('nw')?.value || S.newWord).trim().toUpperCase();
  if (!raw) return;
  const alreadyExists = S.words.some(w => w.display === raw);
  if (alreadyExists) { S.newWord = ''; document.getElementById('nw').value = ''; renderAll(); return; }
  S.words.push({ id: `word${Date.now()}`, display: raw, path: '', color: WC[S.words.length % WC.length] });
  S.newWord = '';
  if (document.getElementById('nw')) document.getElementById('nw').value = '';
  renderAll();
}

function removeWord(i) {
  const w = S.words[i];
  if (w) {
    const coords = (w.path.match(/.{2}/g) || []);
    coords.forEach(c => delete S.letters[c]);
  }
  S.words.splice(i, 1);
  if (S.drawIdx === i) S.drawIdx = null;
  else if (S.drawIdx > i) S.drawIdx--;
  renderAll();
}

function clearWordPath(i) {
  const w = S.words[i];
  if (!w) return;
  const coords = (w.path.match(/.{2}/g) || []);
  coords.forEach(c => delete S.letters[c]);
  w.path = '';
  if (S.drawIdx === i) { S.path = []; }
  renderAll();
}

function startDraw(i) {
  S.drawIdx = (S.drawIdx === i) ? null : i;
  S.path = [];
  renderAll();
  // On mobile, switch to Grid tab
  if (window.innerWidth < 768) setTab('edit');
}

/* ===== COPY / IMPORT / RESET ===== */
function copyJSON() {
  const text = document.getElementById('json-output')?.textContent;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copy-btn');
    if (btn) { btn.textContent = '✓ Copied'; setTimeout(() => { btn.textContent = 'Copy'; }, 1800); }
  });
}

function doImport() {
  try {
    const raw = S.importText.trim();
    if (!raw) return;
    const p = JSON.parse(raw);
    loadPuzzleIntoEditor(p, p.id || '');
    S.importText = '';
    S.importErr = '';
    if (document.getElementById('import-text')) document.getElementById('import-text').value = '';
    renderAll();
  } catch(e) {
    S.importErr = 'Invalid JSON: ' + e.message;
    renderExport();
  }
}

function doReset() {
  S.meta = { id:'', category: CATS[0], nameEn:'', nameEs:'', difficulty: DIFFS[0], date:'', hintEn:'', hintEs:'', premium: false };
  S.letters = {}; S.words = []; S.drawIdx = null; S.path = [];
  editingId = null;
  syncSavedSnapshot();
  renderAll();
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', () => {
  loadLocalState();
  renderAll();
});


/* ===== EDITOR MODE (full | list) ===== */
let editorMode = 'full';

function setEditorMode(mode) {
  editorMode = mode;
  const workspace = document.getElementById('workspace');
  const listPanel = document.getElementById('list-panel');
  const btnFull   = document.getElementById('mode-btn-full');
  const btnList   = document.getElementById('mode-btn-list');
  if (mode === 'list') {
    workspace.style.display = 'none';
    listPanel.style.display = 'block';
    btnFull.classList.remove('is-active');
    btnList.classList.add('is-active');
    renderListPanel();
  } else {
    workspace.style.display = '';
    listPanel.style.display = 'none';
    btnFull.classList.add('is-active');
    btnList.classList.remove('is-active');
    renderAll();
  }
}

/* ===== LIST MODE ===== */
let dragSrcIdx = null;
let orderDirty = false;

function listReload() {
  serverLoad().then(() => renderListPanel());
}

function renderListPanel() {
  const container = document.getElementById('list-items');
  const countEl   = document.getElementById('list-count');
  if (!container) return;
  countEl.textContent = `${serverPuzzles.length} puzzle${serverPuzzles.length !== 1 ? 's' : ''}`;
  const saveOrderBtn = document.getElementById('btn-save-order');
  if (saveOrderBtn) saveOrderBtn.style.display = orderDirty ? '' : 'none';
  container.innerHTML = serverPuzzles.map((p, i) => renderListItem(p, i)).join('');
  // Drag listeners
  container.querySelectorAll('.list-item').forEach(el => {
    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('dragover',  onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop',      onDrop);
    el.addEventListener('dragend',   onDragEnd);
  });
}

function renderListItem(p, i) {
  const name = p.name?.en || p.name?.es || '';
  const diff = p.difficulty || 'medium';
  const cat  = p.category  || '';
  const isExpanded = listExpandedId === p.id;
  return `
  <div class="list-item${isExpanded ? ' is-expanded' : ''}" draggable="true" data-idx="${i}" data-id="${p.id}">
    <div class="list-item-row">
      <div class="list-item-drag" title="Drag to reorder">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="19" r="1" fill="currentColor"/><circle cx="15" cy="5" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/></svg>
      </div>
      <span class="list-item-num">#${i + 1}</span>
      <span class="list-item-name">${escapeHtml(name) || '<span style="color:var(--color-text-faint)">No name</span>'}</span>
      <div class="list-item-badges">
        <span class="badge badge-${diff}">${diff}</span>
        ${cat ? `<span class="badge badge-cat">${escapeHtml(cat)}</span>` : ''}
        ${p.premium ? '<span class="badge badge-premium">★</span>' : ''}
      </div>
      <div class="list-item-actions">
        <button class="btn btn-ghost btn-icon" onclick="listToggleExpand('${p.id}')" title="${isExpanded ? 'Collapse' : 'Edit'}" aria-label="${isExpanded ? 'Collapse' : 'Edit'}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="transform:rotate(${isExpanded ? '180deg' : '0deg'});transition:transform 180ms ease">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <button class="btn btn-ghost btn-icon" onclick="listOpenFull('${p.id}')" title="Open in editor" aria-label="Open in editor">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
      </div>
    </div>
    ${isExpanded ? renderListItemExpanded(p, i) : ''}
  </div>`;
}

function renderListItemExpanded(p, i) {
  const n = p.name  || {};
  const h = p.hint  || {};
  return `
  <div class="list-item-expanded">
    <div class="list-meta-grid">
      <div class="list-meta-field">
        <label>Name (EN)</label>
        <input type="text" value="${escapeHtml(n.en || '')}" oninput="listUpdateField('${p.id}', 'name.en', this.value)" placeholder="English name">
      </div>
      <div class="list-meta-field">
        <label>Name (ES)</label>
        <input type="text" value="${escapeHtml(n.es || '')}" oninput="listUpdateField('${p.id}', 'name.es', this.value)" placeholder="Spanish name">
      </div>
      <div class="list-meta-field">
        <label>Category</label>
        <input type="text" list="cats-list-li" value="${escapeHtml(p.category||'')}"
          placeholder="Type or pick…"
          oninput="listUpdateField('${p.id}', 'category', this.value.trim().toLowerCase().replace(/\\s+/g,'-'))"
          onchange="if(this.value){addCategory(this.value);listUpdateField('${p.id}','category',this.value.trim().toLowerCase().replace(/\\s+/g,'-'))}">
        <datalist id="cats-list-li">
          ${CATS.map(c => `<option value="${c}">`).join('')}
        </datalist>
      </div>
      <div class="list-meta-field">
        <label>Difficulty</label>
        <select onchange="listUpdateField('${p.id}', 'difficulty', this.value)">
          ${DIFFS.map(d => `<option value="${d}"${p.difficulty === d ? ' selected' : ''}>${d}</option>`).join('')}
        </select>
      </div>
      <div class="list-meta-field">
        <label>Date</label>
        <input type="date" value="${escapeHtml(p.date || '')}" oninput="listUpdateField('${p.id}', 'date', this.value)">
      </div>
      <div class="list-meta-field">
        <label>Hint (EN)</label>
        <input type="text" value="${escapeHtml(h.en || '')}" oninput="listUpdateField('${p.id}', 'hint.en', this.value)" placeholder="Hint in English">
      </div>
      <div class="list-meta-field">
        <label>Hint (ES)</label>
        <input type="text" value="${escapeHtml(h.es || '')}" oninput="listUpdateField('${p.id}', 'hint.es', this.value)" placeholder="Hint in Spanish">
      </div>
      <div class="list-meta-field" style="display:flex;align-items:center;gap:var(--space-2);padding-top:20px;">
        <input type="checkbox" id="li-prem-${i}" ${p.premium ? 'checked' : ''} onchange="listUpdateField('${p.id}', 'premium', this.checked)" style="width:16px;height:16px;min-height:unset;">
        <label for="li-prem-${i}" style="text-transform:none;letter-spacing:0;font-size:var(--text-sm);font-weight:500;color:var(--color-text);">Premium</label>
      </div>
    </div>
    <div style="display:flex;gap:var(--space-2);">
      <button class="btn btn-success" onclick="listSavePuzzle('${p.id}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Save changes
      </button>
      <button class="btn btn-danger" onclick="listDeletePuzzle('${p.id}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        Delete
      </button>
    </div>
  </div>`;
}

let listExpandedId = null;

function listToggleExpand(id) {
  listExpandedId = listExpandedId === id ? null : id;
  renderListPanel();
}

function listUpdateField(id, field, value) {
  const p = serverPuzzles.find(p => p.id === id);
  if (!p) return;
  const parts = field.split('.');
  if (parts.length === 2) {
    if (!p[parts[0]]) p[parts[0]] = {};
    p[parts[0]][parts[1]] = value;
  } else {
    p[field] = value;
  }
  const el = document.querySelector(`.list-item[data-id="${id}"]`);
  if (el) {
    const nameEl = el.querySelector('.list-item-name');
    if (nameEl) nameEl.innerHTML = escapeHtml(p.name?.en || p.name?.es || '') || '<span style="color:var(--color-text-faint)">No name</span>';
    const diffBadge = el.querySelector('.badge-easy, .badge-medium, .badge-hard');
    if (diffBadge && field === 'difficulty') {
      diffBadge.className = `badge badge-${value}`;
      diffBadge.textContent = value;
    }
  }
}

async function listSavePuzzle(id) {
  serverStatus('Saving…');
  try {
    const res = await fetch(API_URL, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(serverPuzzles, null, 2),
    });
    await readApiJson(res);
    serverStatus('✓ Saved');
    rebuildSelect();
  } catch(e) {
    serverStatus('Save failed: ' + e.message, true);
  }
}

async function listDeletePuzzle(id) {
  const puzzle = serverPuzzles.find(p => p.id === id);
  const ok = await promptConfirm({
    title: 'Delete puzzle?',
    message: `Permanently delete "${puzzle?.name?.en || id}"? This cannot be undone.`,
    confirmText: 'Delete', cancelText: 'Cancel', variant: 'danger',
  });
  if (!ok) return;
  serverPuzzles = serverPuzzles.filter(p => p.id !== id);
  listExpandedId = null;
  serverStatus('Saving…');
  try {
    const res = await fetch(API_URL, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(serverPuzzles, null, 2) });
    await readApiJson(res);
    serverStatus('✓ Deleted');
    rebuildSelect();
    renderListPanel();
  } catch(e) {
    serverStatus('Delete failed: ' + e.message, true);
    serverPuzzles.push(puzzle);
    renderListPanel();
  }
}

async function saveOrder() {
  serverStatus('Saving order…');
  try {
    const res = await fetch(API_URL, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(serverPuzzles, null, 2) });
    await readApiJson(res);
    orderDirty = false;
    serverStatus('✓ Order saved');
    renderListPanel();
  } catch(e) {
    serverStatus('Save failed: ' + e.message, true);
  }
}

function listOpenFull(id) {
  const puzzle = serverPuzzles.find(p => p.id === id);
  if (!puzzle) return;
  setEditorMode('full');
  loadPuzzleIntoEditor(puzzle, id);
  const sel = document.getElementById('puzzle-select');
  if (sel) sel.value = id;
}

/* Drag-to-reorder */
function onDragStart(e) {
  dragSrcIdx = +e.currentTarget.dataset.idx;
  e.currentTarget.classList.add('is-dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}
function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}
function onDrop(e) {
  e.preventDefault();
  const targetIdx = +e.currentTarget.dataset.idx;
  e.currentTarget.classList.remove('drag-over');
  if (dragSrcIdx === null || dragSrcIdx === targetIdx) return;
  const moved = serverPuzzles.splice(dragSrcIdx, 1)[0];
  serverPuzzles.splice(targetIdx, 0, moved);
  dragSrcIdx = null;
  orderDirty = true;
  renderListPanel();
}
function onDragEnd(e) {
  e.currentTarget.classList.remove('is-dragging');
  dragSrcIdx = null;
  document.querySelectorAll('.list-item').forEach(el => el.classList.remove('drag-over'));
}
