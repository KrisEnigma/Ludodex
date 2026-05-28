/* ============================================================
   LUDODEX EDITOR — production build (real backend)
   GET  /api/puzzles  -> returns the array of levels
   PUT  /api/puzzles  -> saves the whole array
   Adjust API_URL / authHeaders() below if your server differs.
   ============================================================ */

/* ---- constants ---- */
const COLS = ['a','b','c','d'];
const ROWS = ['1','2','3','4'];
const CELL_ORDER = ROWS.flatMap(r => COLS.map(c => c + r));
const WC = ['#5b9bff','#f472b6','#4ade80','#fb923c','#c084fc','#34d399','#fbbf24','#f87171'];
let CATS = [];
const DIFFS = ['easy','medium','hard'];

/* ---- state ---- */
let serverPuzzles = [];
let gridEditId = null;
let gridSavedSnapshot = '';
let S = { letters: {}, words: [], drawIdx: null, path: [], newWord: '' };

/* ---- real API ---- */
const API_URL = '/api/puzzles';
function authHeaders() {
  const t = (document.getElementById('api-token')?.value || '').trim();
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}
async function readApiJson(res) {
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch (e) { body = { error: text.slice(0, 120) }; }
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}
async function apiList() {
  const res = await fetch(API_URL, { headers: authHeaders() });
  const body = await readApiJson(res);
  return Array.isArray(body) ? body : (body.puzzles || []);
}
async function apiPut(puzzles) {
  const res = await fetch(API_URL, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(puzzles, null, 2) });
  return readApiJson(res);
}

/* ===== EDITOR ===== */
/* ============================================================
   EDITOR CORE — connect, grid editor (grid + words + paths)
   ============================================================ */

/* ---------- helpers ---------- */
function $(id) { return document.getElementById(id); }
function isMobile() { return window.innerWidth <= 900; }
function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
function scrollToEl(el, offset = 76) {
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
}
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ---------- toast ---------- */
function toast(msg, kind = 'ok') {
  const mount = $('toast-mount');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  const icon = kind === 'err'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  el.innerHTML = icon + '<span>' + escapeHtml(msg) + '</span>';
  mount.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; el.style.transition = 'opacity .25s, transform .25s'; setTimeout(() => el.remove(), 260); }, 2200);
}

/* ---------- status pill ---------- */
function serverStatus(msg, state = '') {
  const pill = $('server-status'), text = $('server-status-text');
  if (!pill) return;
  text.textContent = msg;
  pill.className = 'status-pill' + (state ? ' is-' + state : '');
}

/* ---------- dialog ---------- */
let dialogState = null;
function promptConfirm(state) { return new Promise(resolve => { dialogState = { ...state, resolve }; renderDialog(); }); }
function dialogAccept() { if (!dialogState) return; const r = dialogState.resolve; dialogState = null; renderDialog(); r(true); }
function dialogCancel() { if (!dialogState) return; const r = dialogState.resolve; dialogState = null; renderDialog(); r(false); }
function renderDialog() {
  const mount = $('dialog-mount');
  if (!dialogState) { mount.innerHTML = ''; return; }
  const danger = dialogState.variant === 'danger';
  const icon = danger
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  mount.innerHTML = `
  <div class="dialog-backdrop" onclick="dialogCancel()" role="dialog" aria-modal="true">
    <div class="dialog" onclick="event.stopPropagation()">
      <div class="dialog-icon ${danger ? 'danger' : 'primary'}">${icon}</div>
      <p class="dialog-title">${escapeHtml(dialogState.title)}</p>
      <p class="dialog-msg">${escapeHtml(dialogState.message)}</p>
      <div class="dialog-actions">
        <button class="btn btn-ghost" onclick="dialogCancel()">${escapeHtml(dialogState.cancelText || 'Cancel')}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" onclick="dialogAccept()">${escapeHtml(dialogState.confirmText || 'OK')}</button>
      </div>
    </div>
  </div>`;
}

/* ============================================================
   CONNECT (mock)
   ============================================================ */
function token() { return $('api-token').value.trim(); }
(function() {
  const inp = $('api-token');
  if (!inp) return;
  try { inp.value = localStorage.getItem('ludodex_cms_token') || ''; } catch(e) {}
  inp.addEventListener('input', () => { try { localStorage.setItem('ludodex_cms_token', inp.value.trim()); } catch(e) {} });
})();

async function serverLoad() {
  if (!token()) { toast('Enter a bearer token to connect', 'err'); return; }
  serverStatus('Connecting…', 'busy');
  try {
    serverPuzzles = await apiList();
    renumberIds();
    serverStatus(`${serverPuzzles.length} levels`, 'ok');
    $('login-group').classList.add('hidden');
    $('logged-group').classList.remove('hidden');
    renderLibrary();
    toast(`Connected · ${serverPuzzles.length} levels loaded`);
  } catch(e) { serverStatus('Load failed', 'err'); }
}
function rebuildCats() {
  const found = new Set(serverPuzzles.map(p => p.category).filter(Boolean));
  found.forEach(c => { if (!CATS.includes(c)) CATS.push(c); });
}
function serverLogout() {
  try { localStorage.removeItem('ludodex_cms_token'); } catch(e) {}
  $('api-token').value = '';
  $('login-group').classList.remove('hidden');
  $('logged-group').classList.add('hidden');
  serverPuzzles = []; gridEditId = null;
  closeGridEditor();
  serverStatus('Not connected');
  renderLibrary();
}

/* ============================================================
   PARSE / BUILD / VALIDATE  (puzzle <-> grid state)
   ============================================================ */
function parsePuzzleData(p) {
  // letters are derived entirely from word paths — no filler
  const d = p.data || {};
  const words = [];
  const firstVal = Object.values(d)[0];
  const isLegacy = firstVal && typeof firstVal === 'object' && ('display' in firstVal || 'path' in firstVal);
  if (isLegacy) {
    Object.entries(d).filter(([k]) => k.startsWith('word')).forEach(([k, v], i) =>
      words.push({ id: k, display: v.display || '', path: Array.isArray(v.path) ? v.path.join('') : (v.path || ''), color: WC[i % WC.length] }));
  } else {
    Object.entries(d).forEach(([display, path], i) =>
      words.push({ id: `word${i + 1}`, display, path: Array.isArray(path) ? path.join('') : (path || ''), color: WC[i % WC.length] }));
  }
  return { words, letters: lettersFromWords(words) };
}

/* letters seeded from word paths (cells are shared by any words crossing them) */
function lettersFromWords(words) {
  const letters = {};
  words.forEach(w => {
    const coords = (w.path.match(/.{2}/g) || []);
    const ls = w.display.replace(/ /g, '').split('');
    coords.forEach((c, i) => { if (ls[i]) letters[c] = ls[i]; });
  });
  return letters;
}

function buildDataFromS() {
  const data = {};
  S.words.forEach(w => { data[w.display] = w.path; });
  return { data };
}

function puzzleToJSON(p) {
  const out = {
    id: p.id,
    name: { en: p.name?.en || '', es: p.name?.es || '' },
    category: p.category || '',
    difficulty: p.difficulty || 'medium',
    date: p.date || null,
    series: p.series || null,
    premium: !!p.premium,
    hint: { en: p.hint?.en || '', es: p.hint?.es || '' },
    data: p.data || {},
  };
  return JSON.stringify(out, null, 2);
}

/* Unique non-empty values of a field across all levels (for autocomplete).
   Pass exceptId to omit the level currently being edited so its own
   in-progress value doesn't appear as a suggestion. */
function uniqueValues(field, exceptId) {
  const set = new Set();
  serverPuzzles.forEach(p => {
    if (exceptId != null && p.id === exceptId) return;
    const v = (p[field] || '').toString().trim();
    if (v) set.add(v);
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}

/* ids are simply the level's order number (1-based) */
function renumberIds() {
  serverPuzzles.forEach((p, i) => { p.id = String(i + 1); });
}

/* validate a stored puzzle (data = words only). A valid level fills all 16
   cells with word paths. Words may freely share cells. */
function validatePuzzle(p) {
  const errs = [], warns = [];
  const data = p.data || {};
  const words = Object.keys(data);
  if (words.length === 0) errs.push('No words');
  const covered = new Set();
  words.forEach(w => {
    const path = Array.isArray(data[w]) ? data[w].join('') : (data[w] || '');
    const coords = path.match(/.{2}/g) || [];
    const need = w.replace(/ /g, '').length;
    if (coords.length === 0) errs.push(`"${w}" has no path`);
    else if (coords.length !== need) errs.push(`"${w}" path mismatch (${coords.length}/${need})`);
    coords.forEach(c => covered.add(c));
  });
  if (words.length && covered.size < 16) errs.push(`Grid not full — ${16 - covered.size} uncovered cell${16 - covered.size !== 1 ? 's' : ''}`);
  if (!p.name?.en) warns.push('No English name');
  if (!p.name?.es) warns.push('No Spanish name');
  return { errs, warns, ok: errs.length === 0 };
}

/* validate the LIVE grid-editor state (also catches filler: a letter that no
   word uses). Shared letters are fine — never flagged. */
function validateGrid() {
  const errs = [];
  if (S.words.length === 0) errs.push('No words');
  const covered = new Set();
  S.words.forEach(w => {
    const coords = w.path.match(/.{2}/g) || [];
    const need = w.display.replace(/ /g, '').length;
    if (coords.length === 0) errs.push(`"${w.display}" has no path`);
    else if (coords.length !== need) errs.push(`"${w.display}" path mismatch (${coords.length}/${need})`);
    coords.forEach(c => covered.add(c));
  });
  const filled = Object.keys(S.letters);
  const filler = filled.filter(c => !covered.has(c));
  if (filler.length) errs.push(`${filler.length} letter${filler.length !== 1 ? 's' : ''} not used by any word`);
  const empty = 16 - filled.length;
  if (empty > 0) errs.push(`Grid not full — ${empty} empty cell${empty !== 1 ? 's' : ''}`);
  return { errs, ok: errs.length === 0 };
}

/* ============================================================
   GRID EDITOR
   ============================================================ */
const GRID_KEY = 'ludodex_grid_draft_v1';

function openGridEditor(id) {
  const p = serverPuzzles.find(x => x.id === id);
  if (!p) return;
  gridEditId = id;
  const parsed = parsePuzzleData(p);
  S.words = parsed.words;
  S.letters = parsed.letters;
  S.drawIdx = null; S.path = []; S.newWord = '';
  gridSavedSnapshot = JSON.stringify(buildDataFromS());
  $('library-view').classList.add('hidden');
  $('grid-view').classList.remove('hidden');
  $('ge-name').textContent = p.name?.en || p.name?.es || 'Untitled';
  $('ge-id').textContent = p.id;
  window.scrollTo(0, 0);
  renderGrid(); renderDrawBanner(); renderGridHint(); renderLegend(); renderWords(); updateGridValidation();
  saveGridDraft();
}

function closeGridEditor() {
  gridEditId = null;
  $('grid-view').classList.add('hidden');
  $('library-view').classList.remove('hidden');
  try { localStorage.removeItem(GRID_KEY); } catch(e) {}
  renderLibrary();
}

function gridDirty() { return gridEditId && JSON.stringify(buildDataFromS()) !== gridSavedSnapshot; }

function updateGridValidation() {
  const chip = $('ge-validation');
  if (!chip) return;
  if (!serverPuzzles.find(x => x.id === gridEditId)) return;
  const v = validateGrid();
  const dirty = gridDirty();
  if (!v.ok) {
    chip.className = 'save-chip save-chip--dirty';
    chip.innerHTML = `<span class="dot"></span>${v.errs.length} issue${v.errs.length !== 1 ? 's' : ''}`;
    chip.title = v.errs.join(' · ');
  } else if (dirty) {
    chip.className = 'save-chip save-chip--dirty';
    chip.innerHTML = '<span class="dot"></span>Unsaved';
    chip.title = '';
  } else {
    chip.className = 'save-chip save-chip--clean';
    chip.innerHTML = '<span class="dot"></span>Ready';
    chip.title = '';
  }
}

async function saveGrid() {
  const p = serverPuzzles.find(x => x.id === gridEditId);
  if (!p) return;
  const { data } = buildDataFromS();
  p.data = data;
  delete p.filler;
  serverStatus('Saving…', 'busy');
  try {
    await apiPut(serverPuzzles);
    gridSavedSnapshot = JSON.stringify(buildDataFromS());
    serverStatus(`Saved · ${p.id}`, 'ok');
    updateGridValidation();
    toast('Grid saved');
  } catch(e) { serverStatus('Save failed', 'err'); }
}

function copyGridJSON() {
  const p = serverPuzzles.find(x => x.id === gridEditId);
  if (!p) return;
  const { data } = buildDataFromS();
  const text = puzzleToJSON({ ...p, data });
  navigator.clipboard?.writeText(text).then(() => toast('JSON copied')).catch(() => toast('Copy failed', 'err'));
}

function saveGridDraft() {
  try { localStorage.setItem(GRID_KEY, JSON.stringify({ id: gridEditId, words: S.words, letters: S.letters })); } catch(e) {}
}

/* ============================================================
   GRID RENDER + DRAWING
   ============================================================ */
function renderGridAll() {
  renderGrid(); renderDrawBanner(); renderGridHint(); renderLegend(); renderWords(); updateGridValidation(); saveGridDraft();
}

const SVG_DRAW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
let _focusCell = null;   // cell whose input should regain focus after a re-render

function renderGrid() {
  const wrap = $('tile-grid');
  if (!wrap) return;
  const filled = Object.keys(S.letters).length;
  const label = $('grid-fill-label');
  if (label) label.textContent = `${filled}/16`;

  const drawing = S.drawIdx !== null;
  wrap.classList.toggle('is-drawing', drawing);
  wrap.innerHTML = '';

  CELL_ORDER.forEach(cell => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset.cell = cell;
    let letter = S.letters[cell] || '';
    const wordForCell = S.words.find(w => (w.path.match(/.{2}/g) || []).includes(cell));
    const inPath = S.path.includes(cell);

    if (wordForCell) { tile.style.setProperty('--wc', wordForCell.color); tile.classList.add('tile--word'); }
    if (inPath) {
      // live preview: show the drawing word's letter for this cell
      const wd = S.words[S.drawIdx];
      const ls = wd ? wd.display.replace(/ /g, '').split('') : [];
      letter = ls[S.path.indexOf(cell)] || letter;
      tile.style.setProperty('--wc', wd?.color || 'var(--accent)');
      tile.classList.add('tile--path');
      if (S.path.indexOf(cell) === 0) tile.classList.add('tile--path-first');
    }
    if (letter) tile.classList.add('tile--filled');
    // a letter not used by any word is invalid "filler" — flag it
    if (letter && !wordForCell && !inPath) tile.classList.add('tile--filler');
    if (!letter && !inPath) tile.classList.add('tile--empty');

    if (drawing) {
      // path-selection mode: tappable tiles, not editable
      let inner = `<span class="tile-letter">${escapeHtml(letter)}</span><span class="tile-coord">${cell}</span>`;
      if (inPath) inner += `<span class="tile-order">${S.path.indexOf(cell) + 1}</span>`;
      tile.innerHTML = inner;
      tile.addEventListener('pointerdown', e => { e.preventDefault(); onTileDown(cell); });
      tile.addEventListener('pointerenter', e => { if (e.buttons) onTileEnter(cell); });
    } else {
      // editing mode: type a letter directly into the cell (caret shown)
      const inp = document.createElement('input');
      inp.className = 'tile-input';
      inp.type = 'text';
      inp.value = letter;
      if (letter) inp.setAttribute('value', letter);
      inp.dataset.cell = cell;
      inp.setAttribute('aria-label', `Cell ${cell}`);
      inp.setAttribute('autocapitalize', 'characters');
      inp.setAttribute('autocomplete', 'off');
      inp.spellcheck = false;
      inp.addEventListener('input', () => onCellInput(cell, inp));
      inp.addEventListener('keydown', e => onCellKeydown(cell, inp, e));
      const coord = document.createElement('span');
      coord.className = 'tile-coord';
      coord.textContent = cell;
      tile.appendChild(inp);
      tile.appendChild(coord);
    }
    wrap.appendChild(tile);
  });

  document.removeEventListener('pointerup', onTileUp);
  document.addEventListener('pointerup', onTileUp, { once: true });

  // keep the caret moving as you type across cells
  if (!drawing && _focusCell) {
    const fi = wrap.querySelector(`.tile-input[data-cell="${_focusCell}"]`);
    if (fi) fi.focus();
    _focusCell = null;
  }
}

/* type letters directly into cells */
function nextCellOf(cell) { const i = CELL_ORDER.indexOf(cell); return CELL_ORDER[i + 1] || null; }
function onCellInput(cell, inp) {
  const ch = (inp.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-1);
  if (ch) S.letters[cell] = ch; else delete S.letters[cell];
  _focusCell = ch ? (nextCellOf(cell) || cell) : cell;   // advance after a char
  renderGridAll();
}
function onCellKeydown(cell, inp, e) {
  const i = CELL_ORDER.indexOf(cell);
  if (e.key === 'Backspace' && inp.value === '') {
    e.preventDefault();
    const prev = CELL_ORDER[i - 1];
    if (prev) { delete S.letters[prev]; _focusCell = prev; renderGridAll(); }
  } else if (e.key === 'ArrowRight') { e.preventDefault(); _focusCell = CELL_ORDER[i + 1] || cell; renderGridAll(); }
  else if (e.key === 'ArrowLeft')  { e.preventDefault(); _focusCell = CELL_ORDER[i - 1] || cell; renderGridAll(); }
  else if (e.key === 'ArrowDown')  { e.preventDefault(); _focusCell = CELL_ORDER[i + 4] || cell; renderGridAll(); }
  else if (e.key === 'ArrowUp')    { e.preventDefault(); _focusCell = CELL_ORDER[i - 4] || cell; renderGridAll(); }
}

function onTileDown(cell) {
  if (S.drawIdx === null) return;
  if (S.path.length && S.path[S.path.length - 1] === cell) return;
  if (S.path.includes(cell)) S.path = S.path.slice(0, S.path.indexOf(cell) + 1);
  else if (S.path.length === 0) S.path = [cell];
  else S.path.push(cell);
  renderGrid(); renderDrawBanner();
}
function onTileEnter(cell) {
  if (S.drawIdx === null || S.path.length === 0) return;
  if (!S.path.includes(cell)) { S.path.push(cell); renderGrid(); renderDrawBanner(); }
}
function onTileUp() {
  if (S.drawIdx === null || S.path.length === 0) return;
  const word = S.words[S.drawIdx];
  if (!word) return;
  const need = word.display.replace(/ /g,'').length;
  if (S.path.length === need) {
    // assign this word's letters to its path cells (shared cells are fine)
    const ls = word.display.replace(/ /g,'').split('');
    S.path.forEach((c, i) => { S.letters[c] = ls[i]; });
    word.path = S.path.join('');
    S.path = []; S.drawIdx = null;
    renderGridAll();
    toast(`"${word.display}" placed`);
    if (isMobile()) scrollToEl($('nw'), 84); // back to the add-word row for the next word
  } else {
    renderDrawBanner();
  }
}

function renderDrawBanner() {
  const el = $('draw-banner');
  if (!el) return;
  if (S.drawIdx === null) { el.className = 'draw-banner'; el.innerHTML = ''; return; }
  const word = S.words[S.drawIdx];
  if (!word) { el.className = 'draw-banner'; return; }
  el.className = 'draw-banner is-active';
  el.style.setProperty('--wc', word.color);
  const need = word.display.replace(/ /g,'').length;
  const progress = S.path.length || (word.path.match(/.{2}/g) || []).length;
  el.innerHTML = `
    <span class="draw-badge">Drawing</span>
    <span class="draw-word">${escapeHtml(word.display)}</span>
    <span class="draw-progress">${progress}/${need} cells</span>
    <button class="btn btn-soft btn-sm" onclick="cancelDraw()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      Done
    </button>`;
}
function cancelDraw() { S.drawIdx = null; S.path = []; renderGridAll(); }

function renderGridHint() {
  const el = $('grid-hint');
  if (!el) return;
  if (S.drawIdx !== null) {
    el.className = 'grid-hint is-drawing';
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> Tap or drag tiles in order to spell the word.`;
  } else {
    el.className = 'grid-hint';
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> Tap a cell to type letters, or add a word and tap <strong style="color:var(--text);font-weight:650">✎ draw</strong> to lay its path.`;
  }
}

function renderLegend() {
  const el = $('grid-legend');
  if (!el) return;
  if (S.words.length === 0) { el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = S.words.map(w => {
    const cells = (w.path.match(/.{2}/g) || []).length;
    const need = w.display.replace(/ /g,'').length;
    const done = cells === need && cells > 0;
    return `<span class="legend-chip${done ? '' : ' is-incomplete'}"><span class="sw" style="background:${w.color}"></span>${escapeHtml(w.display)}</span>`;
  }).join('');
}

function renderWords() {
  const list = $('words-list');
  const countLabel = $('word-count-label');
  if (!list) return;
  if (countLabel) countLabel.textContent = `${S.words.length} word${S.words.length !== 1 ? 's' : ''}`;
  if (S.words.length === 0) {
    list.innerHTML = `<div class="empty">
      <span class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="9" y1="20" x2="15" y2="20"/></svg></span>
      <p>No words yet. Type a word above and press Add to start building.</p>
    </div>`;
    return;
  }
  list.innerHTML = S.words.map((w, i) => {
    const cells = (w.path.match(/.{2}/g) || []).length;
    const need = w.display.replace(/ /g,'').length;
    const done = cells === need && cells > 0;
    const statusCls = done ? 'is-done' : (cells === 0 ? 'is-empty' : '');
    const statusTxt = done ? '✓ placed' : `${cells}/${need}`;
    const active = S.drawIdx === i;
    return `
    <div class="word-row${active ? ' word-row--active' : ''}" style="--wc:${w.color}">
      <span class="word-dot" style="background:${w.color}"></span>
      <span class="word-name">${escapeHtml(w.display)}</span>
      <span class="word-status ${statusCls}">${statusTxt}</span>
      <div class="word-actions">
        <button class="btn btn-ghost btn-draw${active ? ' is-active' : ''}" onclick="startDraw(${i})" title="${active ? 'Stop drawing' : 'Draw path'}" aria-label="Draw path for ${escapeHtml(w.display)}">${SVG_DRAW}</button>
        <button class="btn btn-ghost" onclick="clearWordPath(${i})" title="Clear path" aria-label="Clear path"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
        <button class="btn btn-ghost" onclick="removeWord(${i})" title="Remove word" aria-label="Remove ${escapeHtml(w.display)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
    </div>`;
  }).join('');
}

/* ============================================================
   WORD OPS  (grid letters are derived from word paths)
   ============================================================ */
function addWord() {
  const raw = ($('nw')?.value || S.newWord).trim().toUpperCase();
  if (!raw) return;
  if (S.words.some(w => w.display === raw)) { S.newWord = ''; if ($('nw')) $('nw').value = ''; toast('That word already exists', 'err'); return; }
  S.words.push({ id: `word${Date.now()}`, display: raw, path: '', color: WC[S.words.length % WC.length] });
  S.newWord = ''; if ($('nw')) $('nw').value = '';
  S.drawIdx = S.words.length - 1; S.path = [];
  renderGridAll();
  if (isMobile()) scrollToTop(); // bring the grid into view to draw the new word
}
function removeWord(i) {
  // remove the word + its path; the letters stay on the grid (you can reuse
  // them for another word). Uncovered letters show as “filler” until used.
  S.words.splice(i, 1);
  if (S.drawIdx === i) { S.drawIdx = null; S.path = []; }
  else if (S.drawIdx > i) S.drawIdx--;
  renderGridAll();
}
function clearWordPath(i) {
  // clear the path only — the letters stay on the grid
  const w = S.words[i];
  if (!w) return;
  w.path = '';
  if (S.drawIdx === i) S.path = [];
  renderGridAll();
}
function startDraw(i) {
  S.drawIdx = (S.drawIdx === i) ? null : i;
  S.path = [];
  renderGridAll();
  if (S.drawIdx !== null && isMobile()) scrollToTop(); // show the grid to draw on
}

/* ============================================================
   IMPORT JSON  (creates / replaces a level)
   ============================================================ */
function openImport() {
  const mount = $('dialog-mount');
  mount.innerHTML = `
  <div class="dialog-backdrop" onclick="dialogCancel()" role="dialog" aria-modal="true">
    <div class="dialog" style="width:min(100%,520px)" onclick="event.stopPropagation()">
      <div class="dialog-icon primary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
      <p class="dialog-title">Import level JSON</p>
      <p class="dialog-msg">Paste a level object (name, category, hint, data…). It's added to the end of the library — its ID is assigned automatically from its position.</p>
      <textarea class="import-textarea" id="import-text" placeholder='{ "name": { "en": "…" }, "category": "characters", "data": { "WORD": "a1b1…" } }' style="margin-top:var(--s4)"></textarea>
      <div id="import-error" class="import-error"></div>
      <div class="dialog-actions">
        <button class="btn btn-ghost" onclick="dialogCancel()">Cancel</button>
        <button class="btn btn-primary" onclick="doImport()">Import</button>
      </div>
    </div>
  </div>`;
  dialogState = { resolve: () => {} };
}
function doImport() {
  try {
    const raw = ($('import-text')?.value || '').trim();
    if (!raw) return;
    const p = JSON.parse(raw);
    if (!p.data || typeof p.data !== 'object') { $('import-error').textContent = 'Missing or invalid "data" field.'; return; }
    delete p.filler;
    serverPuzzles.push(p);
    renumberIds();
    dialogState = null; renderDialog();
    renderLibrary();
    toast('Level imported');
  } catch(e) { $('import-error').textContent = 'Invalid JSON: ' + e.message; }
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  if (token()) serverLoad();   // auto-connect when a saved token is present
});


/* ===== LIBRARY ===== */
/* ============================================================
   LIBRARY — level list, metadata dropdown, drag-reorder
   Metadata is edited ONLY here (single source of truth).
   ============================================================ */

let expandedId = null;
let listQuery = '';
let orderDirty = false;
let dragSrcIdx = null;

function renderLibrary() {
  const container = $('list-items');
  const countEl = $('list-count');
  if (!container) return;
  if (countEl) countEl.textContent = `${serverPuzzles.length}`;
  const saveOrderBtn = $('btn-save-order');
  if (saveOrderBtn) saveOrderBtn.classList.toggle('hidden', !orderDirty);

  const visible = serverPuzzles.map((p, i) => ({ p, i })).filter(({ p }) => listMatches(p));
  if (visible.length === 0) {
    container.innerHTML = `<div class="empty" style="padding:var(--s12)">
      <span class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
      <p>${serverPuzzles.length ? 'No levels match your search.' : 'No levels yet. Click “New level” to create one.'}</p>
    </div>`;
    return;
  }
  container.innerHTML = visible.map(({ p, i }) => renderListItem(p, i)).join('');
  container.querySelectorAll('.list-item').forEach(el => {
    const drag = el.querySelector('.list-drag');
    // don't make the expanded row draggable — it would block text selection in the form
    if (drag && !listQuery && el.dataset.id !== expandedId) {
      el.setAttribute('draggable', 'true');
      el.addEventListener('dragstart', onDragStart);
      el.addEventListener('dragover', onDragOver);
      el.addEventListener('dragleave', onDragLeave);
      el.addEventListener('drop', onDrop);
      el.addEventListener('dragend', onDragEnd);
    } else {
      el.removeAttribute('draggable');
    }
  });
}

function listFilter(q) { listQuery = q.toLowerCase().trim(); renderLibrary(); }
function listMatches(p) {
  if (!listQuery) return true;
  return [p.id, p.name?.en, p.name?.es, p.category, p.series].filter(Boolean).join(' ').toLowerCase().includes(listQuery);
}
function listReload() {
  serverStatus('Refreshing…', 'busy');
  serverLoad();
}

function renderListItem(p, i) {
  const name = p.name?.en || p.name?.es || '';
  const diff = p.difficulty || 'medium';
  const cat = p.category || '';
  const expanded = expandedId === p.id;
  const wordCount = p.data ? Object.keys(p.data).length : 0;
  const canMove = !listQuery;
  const total = serverPuzzles.length;
  const v = validatePuzzle(p);
  const statusDot = v.ok
    ? `<span class="row-status is-ok" title="Ready"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>`
    : `<span class="row-status is-warn" title="${escapeHtml(v.errs.join(' · '))}">${v.errs.length}</span>`;
  return `
  <div class="list-item${expanded ? ' is-expanded' : ''}" data-idx="${i}" data-id="${escapeHtml(p.id)}">
    <div class="list-row">
      <span class="list-reorder">
        <button class="reorder-btn" onclick="moveLevel(${i},-1)" ${(!canMove || i === 0) ? 'disabled' : ''} title="Move up" aria-label="Move up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>
        <button class="reorder-btn" onclick="moveLevel(${i},1)" ${(!canMove || i === total - 1) ? 'disabled' : ''} title="Move down" aria-label="Move down"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
      </span>
      <span class="list-drag" title="Drag to reorder">
        <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>
      </span>
      <span class="list-num">${i + 1}</span>
      ${statusDot}
      <span class="list-name">${name ? escapeHtml(name) : '<span class="noname">Untitled</span>'}<span class="sub">${wordCount} word${wordCount !== 1 ? 's' : ''}</span></span>
      <div class="list-badges">
        <span class="badge badge-${diff}">${diff}</span>
        ${cat ? `<span class="badge badge-cat">${escapeHtml(cat)}</span>` : ''}
        ${p.premium ? '<span class="badge badge-premium">★ Premium</span>' : ''}
      </div>
      <div class="list-actions">
        <button class="btn btn-ghost btn-meta${expanded ? ' is-open' : ''}" onclick="toggleMeta('${escapeHtml(p.id)}')" title="Edit metadata">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <span class="meta-label">Metadata</span>
          <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(${expanded ? '180deg' : '0'})"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <button class="btn btn-primary btn-editgrid" onclick="openGridEditor('${escapeHtml(p.id)}')" title="Edit grid">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
          <span class="grid-label">Edit grid</span>
        </button>
      </div>
    </div>
    ${expanded ? renderMetaForm(p) : ''}
  </div>`;
}

function renderMetaForm(p) {
  const n = p.name || {}, h = p.hint || {};
  const diff = p.difficulty || 'medium';
  const id = escapeHtml(p.id);
  return `
  <div class="list-expand">
    <div class="form-grid">
      <div class="form-field"><label class="form-label">Name <span class="lang">EN</span></label><input class="field" type="text" value="${escapeHtml(n.en || '')}" oninput="metaUpdate('${id}','name.en',this.value)" placeholder="English name"></div>
      <div class="form-field"><label class="form-label">Name <span class="lang">ES</span></label><input class="field" type="text" value="${escapeHtml(n.es || '')}" oninput="metaUpdate('${id}','name.es',this.value)" placeholder="Spanish name"></div>
      <div class="form-field"><label class="form-label">Category</label>
        <div class="combo">
          <input class="field" type="text" value="${escapeHtml(p.category || '')}" autocomplete="off" placeholder="Type or pick…"
            oninput="comboInput('category','${id}',this.value)" onfocus="comboShow('category','${id}')" onblur="setTimeout(comboHide,160)">
          <div class="combo-dropdown" id="combo-category" style="display:none"></div>
        </div>
      </div>
      <div class="form-field"><label class="form-label">Series <span class="lang">opt</span></label>
        <div class="combo">
          <input class="field" type="text" value="${escapeHtml(p.series || '')}" autocomplete="off" placeholder="Type or pick…"
            oninput="comboInput('series','${id}',this.value)" onfocus="comboShow('series','${id}')" onblur="setTimeout(comboHide,160)">
          <div class="combo-dropdown" id="combo-series" style="display:none"></div>
        </div>
      </div>
      <div class="form-field"><label class="form-label">Hint <span class="lang">EN</span></label><input class="field" type="text" value="${escapeHtml(h.en || '')}" oninput="metaUpdate('${id}','hint.en',this.value)" placeholder="Hint in English"></div>
      <div class="form-field"><label class="form-label">Hint <span class="lang">ES</span></label><input class="field" type="text" value="${escapeHtml(h.es || '')}" oninput="metaUpdate('${id}','hint.es',this.value)" placeholder="Hint in Spanish"></div>
      <div class="form-field span-2">
        <label class="form-label">Difficulty</label>
        <div class="diff-seg" role="group">${DIFFS.map(d => `<button class="diff-opt${diff===d?' is-active':''}" data-diff="${d}" onclick="metaUpdateDiff('${id}','${d}')">${d}</button>`).join('')}</div>
      </div>
      <div class="form-field"><label class="form-label">Release date</label><input class="field" type="date" value="${escapeHtml(p.date || '')}" oninput="metaUpdate('${id}','date',this.value)"></div>
      <div class="form-field" style="justify-content:flex-end">
        <label class="switch-row">
          <span class="switch-text"><strong>Premium</strong><span>Members-only level</span></span>
          <span class="switch"><input type="checkbox" ${p.premium ? 'checked' : ''} onchange="metaUpdate('${id}','premium',this.checked)"><span class="track"></span><span class="thumb"></span></span>
        </label>
      </div>
    </div>

    <details class="raw-json">
      <summary><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> Raw JSON <span class="muted">— import / export</span></summary>
      <textarea class="import-textarea" id="raw-${id}" spellcheck="false">${escapeHtml(puzzleToJSON(p))}</textarea>
      <div class="row-gap">
        <button class="btn btn-soft btn-sm" onclick="applyRawJSON('${id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Apply changes</button>
        <button class="btn btn-ghost btn-sm" onclick="copyRawJSON('${id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</button>
        <span class="raw-err" id="raw-err-${id}"></span>
      </div>
    </details>

    <div class="meta-foot">
      <button class="btn btn-success" onclick="metaSave('${id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg> Save metadata</button>
      <button class="btn btn-soft" onclick="openGridEditor('${id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg> Edit grid</button>
      <button class="btn btn-danger" style="margin-left:auto" onclick="metaDelete('${id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg> Delete</button>
    </div>
  </div>`;
}

function toggleMeta(id) { expandedId = expandedId === id ? null : id; renderLibrary(); }

function metaUpdate(id, field, value) {
  const p = serverPuzzles.find(x => x.id === id);
  if (!p) return;
  const parts = field.split('.');
  if (parts.length === 2) { if (!p[parts[0]]) p[parts[0]] = {}; p[parts[0]][parts[1]] = value; }
  else p[field] = value;
  // live-update the row header (name / badges / status) without collapsing
  const el = document.querySelector(`.list-item[data-id="${CSS.escape(id)}"]`);
  if (el) {
    if (field.startsWith('name')) {
      const nm = p.name?.en || p.name?.es || '';
      const wc = p.data ? Object.keys(p.data).length : 0;
      el.querySelector('.list-name').innerHTML = (nm ? escapeHtml(nm) : '<span class="noname">Untitled</span>') + `<span class="sub">${wc} word${wc !== 1 ? 's' : ''}</span>`;
    }
    if (field === 'category') {
      let b = el.querySelector('.badge-cat');
      if (value && b) b.textContent = value;
      else if (value && !b) { const badges = el.querySelector('.list-badges'); const s = document.createElement('span'); s.className = 'badge badge-cat'; s.textContent = value; badges.insertBefore(s, badges.querySelector('.badge-premium')); }
    }
    if (field === 'premium') {
      let b = el.querySelector('.badge-premium');
      const badges = el.querySelector('.list-badges');
      if (value && !b) { const s = document.createElement('span'); s.className = 'badge badge-premium'; s.textContent = '★ Premium'; badges.appendChild(s); }
      else if (!value && b) b.remove();
    }
  }
}
function metaUpdateDiff(id, diff) {
  metaUpdate(id, 'difficulty', diff);
  const el = document.querySelector(`.list-item[data-id="${CSS.escape(id)}"]`);
  if (el) {
    el.querySelectorAll('.diff-opt').forEach(o => o.classList.toggle('is-active', o.dataset.diff === diff));
    const b = el.querySelector('.badge-easy,.badge-medium,.badge-hard');
    if (b) { b.className = 'badge badge-' + diff; b.textContent = diff; }
  }
}

async function metaSave(id) {
  serverStatus('Saving…', 'busy');
  try { await apiPut(serverPuzzles); serverStatus('Saved', 'ok'); toast('Metadata saved'); renderLibrary(); }
  catch(e) { serverStatus('Save failed', 'err'); }
}

async function metaDelete(id) {
  const p = serverPuzzles.find(x => x.id === id);
  const ok = await promptConfirm({ title: 'Delete level?', message: `Permanently delete "${p?.name?.en || id}"? This cannot be undone.`, confirmText: 'Delete', variant: 'danger' });
  if (!ok) return;
  serverPuzzles = serverPuzzles.filter(x => x.id !== id);
  renumberIds();
  expandedId = null;
  serverStatus('Deleting…', 'busy');
  try { await apiPut(serverPuzzles); serverStatus('Deleted', 'ok'); toast('Level deleted'); renderLibrary(); }
  catch(e) { serverStatus('Delete failed', 'err'); serverPuzzles.push(p); renumberIds(); renderLibrary(); }
}

async function newLevel() {
  const p = {
    id: String(serverPuzzles.length + 1), category: '', difficulty: 'medium',
    name: { en: '', es: '' }, hint: { en: '', es: '' }, date: null, series: null, premium: false, data: {},
  };
  serverPuzzles.push(p);
  renumberIds();
  expandedId = p.id;
  listQuery = ''; const si = $('list-search-input'); if (si) si.value = '';
  renderLibrary();
  try { await apiPut(serverPuzzles); } catch(e) {}
  toast('New level created — set its details');
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  const el = document.querySelector(`.list-item[data-id="${CSS.escape(p.id)}"]`);
  if (el) el.querySelector('input')?.focus();
}

async function saveOrder() {
  serverStatus('Saving order…', 'busy');
  try {
    renumberIds();
    await apiPut(serverPuzzles);
    orderDirty = false; serverStatus('Order saved', 'ok'); renderLibrary(); toast('Order saved — IDs renumbered');
  } catch(e) { serverStatus('Save failed', 'err'); }
}

/* move up / down (touch-friendly reorder; confirm with Save order) */
function moveLevel(idx, dir) {
  if (listQuery) return;
  const j = idx + dir;
  if (j < 0 || j >= serverPuzzles.length) return;
  const tmp = serverPuzzles[idx]; serverPuzzles[idx] = serverPuzzles[j]; serverPuzzles[j] = tmp;
  orderDirty = true;
  renderLibrary();
}

/* raw JSON per level */
function applyRawJSON(id) {
  const ta = $('raw-' + id), errEl = $('raw-err-' + id);
  if (!ta) return;
  try {
    const obj = JSON.parse(ta.value);
    const p = serverPuzzles.find(x => x.id === id);
    if (!p) return;
    ['name','category','difficulty','date','series','premium','hint','data'].forEach(k => { if (k in obj) p[k] = obj[k]; });
    delete p.filler;
    if (errEl) errEl.textContent = '';
    renderLibrary();
    toast('JSON applied — remember to Save');
  } catch(e) { if (errEl) errEl.textContent = 'Invalid JSON'; }
}
function copyRawJSON(id) {
  const ta = $('raw-' + id);
  if (!ta) return;
  navigator.clipboard?.writeText(ta.value).then(() => toast('JSON copied')).catch(() => toast('Copy failed', 'err'));
}

/* drag-to-reorder */
function onDragStart(e) { dragSrcIdx = +e.currentTarget.dataset.idx; e.currentTarget.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; }
function onDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.classList.add('drag-over'); }
function onDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function onDrop(e) {
  e.preventDefault();
  const targetIdx = +e.currentTarget.dataset.idx;
  e.currentTarget.classList.remove('drag-over');
  if (dragSrcIdx === null || dragSrcIdx === targetIdx) return;
  const moved = serverPuzzles.splice(dragSrcIdx, 1)[0];
  serverPuzzles.splice(targetIdx, 0, moved);
  dragSrcIdx = null; orderDirty = true;
  renderLibrary();
}
function onDragEnd(e) { e.currentTarget.classList.remove('is-dragging'); dragSrcIdx = null; document.querySelectorAll('.list-item').forEach(el => el.classList.remove('drag-over')); }

/* category / series combobox — suggests existing values, allows new ones */
function comboEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function comboShow(field, id) {
  const dd = $('combo-' + field);
  if (!dd) return;
  const cur = dd.previousElementSibling ? dd.previousElementSibling.value : '';
  comboOpts(field, id, dd, cur);
  dd.style.display = 'block';
}
function comboInput(field, id, val) {
  metaUpdate(id, field, val);          // free-text edit; the list never filters
  const dd = $('combo-' + field);
  if (!dd) return;
  comboOpts(field, id, dd, val);       // val only used to highlight the current match
  dd.style.display = 'block';
}
function comboOpts(field, id, dd, selected) {
  // full, stable list of existing values (from other levels) — typing never filters it
  const all = uniqueValues(field, id);
  let html = all.map(c => `<div class="combo-opt${c === selected ? ' combo-opt--active' : ''}" onmousedown="comboPick('${field}','${id}','${comboEsc(c)}')">${escapeHtml(c)}</div>`).join('');
  if (!html) html = `<div class="combo-empty">No saved ${field === 'series' ? 'series' : 'categories'} yet — type to create one</div>`;
  dd.innerHTML = html;
}
function comboPick(field, id, val) {
  const dd = $('combo-' + field);
  const inp = dd ? dd.previousElementSibling : null;
  if (inp) inp.value = val;
  metaUpdate(id, field, val);
  if (dd) dd.style.display = 'none';
}
function comboHide() { document.querySelectorAll('.combo-dropdown').forEach(d => d.style.display = 'none'); }
