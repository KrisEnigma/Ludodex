/* ===== CONSTANTS ===== */
const API_URL = '/api/puzzles';
const COLS = ['a','b','c','d'];
const ROWS = ['1','2','3','4'];
const CELL_ORDER = ROWS.flatMap(r => COLS.map(c => c + r));
const WC = ['#5b9bff','#f472b6','#4ade80','#fb923c','#c084fc','#34d399','#fbbf24','#f87171'];
const CATS = ['characters','titles','studios','franchises','consoles','composers','genres','decades'];
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
  } catch(e) {
    serverStatus('Load failed: ' + e.message, true);
  }
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
}
async function serverNew() {
  if (isDirty()) {
    const ok = await promptConfirm({ title: 'Discard changes?', message: 'You have unsaved changes. Start a new puzzle anyway?', confirmText: 'Discard', variant: 'danger' });
    if (!ok) return;
  }
  resetEditorState();
}

function resetEditorState() {
  editingId = null;
  S = { ...S, meta: { id:'', category: CATS[0], nameEn:'', nameEs:'', difficulty: DIFFS[0], date:'', hintEn:'', hintEs:'', premium: false }, letters: {}, words: [], drawIdx: null, path: [], newWord: '', importText: '', importErr: '' };
  syncSavedSnapshot();
  renderAll();
  serverStatus('');
}

async function serverSaveCurrent() {
  if (!token()) { serverStatus('Enter a token first', true); return; }
  const currentJson = toJSON(S.meta, S.words, S.letters);
  let current;
  try { current = JSON.parse(currentJson); } catch(e) { serverStatus('JSON error', true); return; }
  if (!current.id) { serverStatus('Set an ID first', true); return; }

  const { errors } = validate(S.meta, S.words, S.letters);
  if (errors.length) {
    const ok = await promptConfirm({ title: 'Save with errors?', message: `${errors.length} validation error(s) found. Save anyway?`, confirmText: 'Save anyway', variant: 'danger' });
    if (!ok) return;
  } else {
    const ok = await promptConfirm({ title: 'Save puzzle?', message: `Save "${current.id}" to the server?`, confirmText: 'Save' });
    if (!ok) return;
  }

  const existing = serverPuzzles.findIndex(p => p.id === current.id);
  const next = [...serverPuzzles];
  if (existing >= 0) next[existing] = current; else next.push(current);

  serverStatus('Saving…');
  try {
    const res = await fetch(API_URL, { method: 'POST', headers: authHeaders(), body: currentJson });
    const body = await readApiJson(res);
    serverPuzzles = next;
    editingId = current.id;
    syncSavedSnapshot();
    rebuildSelect();
    serverStatus(`✓ Saved — ${body.total || serverPuzzles.length} puzzles`);
    renderAll();
  } catch(e) {
    serverStatus('Save failed: ' + e.message, true);
  }
}

async function serverDeleteCurrent() {
  if (!editingId) { serverStatus('No puzzle loaded', true); return; }
  const ok = await promptConfirm({ title: 'Delete puzzle?', message: `Delete "${editingId}" from the server? This cannot be undone.`, confirmText: 'Delete', variant: 'danger' });
  if (!ok) return;
  serverStatus('Deleting…');
  try {
    const res = await fetch(`${API_URL}?id=${encodeURIComponent(editingId)}`, { method: 'DELETE', headers: authHeaders() });
    const body = await readApiJson(res);
    serverPuzzles = serverPuzzles.filter(p => p.id !== editingId);
    serverStatus(`✓ Deleted — ${body.remaining ?? serverPuzzles.length} puzzles remain`);
    resetEditorState();
    rebuildSelect();
  } catch(e) {
    serverStatus('Delete failed: ' + e.message, true);
  }
}

/* ===== PUZZLE LOGIC ===== */
function isAdj(a, b) {
  if (!a || !b || a === b) return false;
  return Math.abs(a.charCodeAt(0) - b.charCodeAt(0)) <= 1 && Math.abs(+a[1] - +b[1]) <= 1;
}

function buildOwn(words) {
  const o = {};
  words.forEach((w, i) => { (w.path.match(/.{2}/g) || []).forEach(c => { o[c] = o[c] || []; o[c].push(i); }); });
  return o;
}

function validate(meta, words, letters) {
  const er = [], wa = [];
  if (!meta.id) er.push('Puzzle ID is required');
  if (!meta.nameEn) wa.push('Name (EN) is missing');
  const own = buildOwn(words);
  const tileLetters = {};
  words.forEach(w => {
    const coords = (w.path.match(/.{2}/g) || []);
    const exp = w.display.replace(/ /g,'').split('');
    if (!w.path) { er.push(`"${w.display}": no path drawn`); return; }
    if (coords.length !== exp.length) er.push(`"${w.display}": path ${coords.length} steps ≠ ${exp.length} letters`);
    for (let i = 1; i < coords.length; i++) {
      if (!isAdj(coords[i-1], coords[i])) { er.push(`"${w.display}": ${coords[i-1]}→${coords[i]} not adjacent`); break; }
    }
    coords.forEach((c, i) => {
      const gl = letters[c], el = exp[i];
      if (gl && el && gl !== el) er.push(`"${w.display}": cell ${c} letter conflict (grid:${gl} word:${el})`);
      tileLetters[c] = el || gl;
    });
  });
  const filled = CELL_ORDER.filter(c => letters[c]).length;
  if (filled < 16) wa.push(`${filled}/16 tiles filled — filler tiles may be needed`);
  return { errors: er, warnings: wa, valid: er.length === 0 };
}

function toJSON(meta, words, letters) {
  const pathTiles = new Set();
  const data = {};
  words.forEach((w, i) => {
    const coords = (w.path.match(/.{2}/g) || []);
    coords.forEach(c => pathTiles.add(c));
    data[w.display] = w.path;  // API format: { "WORD": "pathstring" }
  });
  const filler = {};
  CELL_ORDER.forEach(c => { if (letters[c] && !pathTiles.has(c)) filler[c] = letters[c]; });
  return JSON.stringify({
    id: meta.id,
    name: { en: meta.nameEn, ...(meta.nameEs && { es: meta.nameEs }) },
    category: meta.category,
    difficulty: meta.difficulty,
    date: meta.date || null,
    series: null,
    premium: meta.premium,
    hint: (meta.hintEn || meta.hintEs) ? { en: meta.hintEn, ...(meta.hintEs && { es: meta.hintEs }) } : null,
    ...(Object.keys(filler).length && { filler }),
    data,
  }, null, 2);
}

/* ===== IMPORT ===== */
function doImport() {
  const txt = (document.getElementById('import-text')?.value || '').trim();
  if (!txt) return;
  try {
    const p = JSON.parse(txt);
    loadPuzzleIntoEditor(p, p.id || '');
    document.getElementById('import-text').value = '';
    S.importText = ''; S.importErr = '';
    document.getElementById('import-error').textContent = '';
    serverStatus('✓ Imported');
  } catch(e) {
    const errEl = document.getElementById('import-error');
    if (errEl) errEl.textContent = 'Invalid JSON: ' + e.message;
  }
}

/* ===== TILE INPUT ===== */
let pf = null;

function tileInput(coord, el) {
  const raw = el.value;
  const letter = raw ? raw[raw.length - 1].toUpperCase() : '';
  S.letters = { ...S.letters, [coord]: letter };
  if (letter) { const i = CELL_ORDER.indexOf(coord); pf = i < CELL_ORDER.length - 1 ? CELL_ORDER[i+1] : coord; }
  renderGrid();
  updateDirtyChip();
  saveLocalState();
}

function tileKeydown(coord, e) {
  if (e.key === 'Backspace' && !S.letters[coord]) {
    const i = CELL_ORDER.indexOf(coord);
    if (i > 0) { const prev = CELL_ORDER[i-1]; S.letters = { ...S.letters, [prev]: '' }; pf = prev; renderGrid(); updateDirtyChip(); saveLocalState(); }
    e.preventDefault(); return;
  }
  if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const i = CELL_ORDER.indexOf(coord);
    const next = (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) ? CELL_ORDER[Math.max(0, i-1)] : CELL_ORDER[Math.min(CELL_ORDER.length-1, i+1)];
    const el = document.getElementById('t-' + next);
    if (el) { el.focus(); el.select(); e.preventDefault(); }
  }
}

function cellClick(coord) {
  const w = S.words[S.drawIdx];
  if (!w) return;
  const expectedLetters = w.display.replace(/ /g, '');
  const maxLen = expectedLetters.length;
  const ei = S.path.indexOf(coord);
  if (ei >= 0) { S.path = S.path.slice(0, ei); renderGrid(); renderDrawContext(); return; }
  if (S.path.length >= maxLen) return;
  const last = S.path[S.path.length - 1];
  if (S.path.length > 0 && !isAdj(last, coord)) return;
  S.path = [...S.path, coord];
  const nextLetter = expectedLetters[S.path.length - 1];
  if (nextLetter) S.letters = { ...S.letters, [coord]: nextLetter };
  renderGrid();
  renderDrawContext();
  saveLocalState();
}

/* ===== WORD ACTIONS ===== */
window.addWord = () => {
  const d = S.newWord.trim().toUpperCase();
  if (!d) return;
  S.words = [...S.words, { id: Math.random().toString(36).slice(2), display: d, path: '', color: WC[S.words.length % WC.length] }];
  S.newWord = '';
  const nw = document.getElementById('nw');
  if (nw) nw.value = '';
  renderWords();
  renderGrid();
  renderExport();
  updateDirtyChip();
  saveLocalState();
};

window.startDraw = (i) => { S.drawIdx = i; S.path = (S.words[i].path.match(/.{2}/g) || []); renderGrid(); renderDrawContext(); };
window.finishDraw = () => {
  if (S.drawIdx === null) return;
  const u = [...S.words];
  u[S.drawIdx] = { ...u[S.drawIdx], path: S.path.join('') };
  S.words = u; S.drawIdx = null; S.path = [];
  renderGrid(); renderWords(); renderDrawContext(); renderExport(); updateDirtyChip(); saveLocalState();
};
window.clearCP = () => { S.path = []; renderGrid(); renderDrawContext(); };
window.cancelDraw = () => { S.drawIdx = null; S.path = []; renderGrid(); renderWords(); renderDrawContext(); };
window.clearPath = (i) => {
  const u = [...S.words]; u[i] = { ...u[i], path: '' }; S.words = u;
  if (S.drawIdx === i) { S.drawIdx = null; S.path = []; }
  renderGrid(); renderWords(); renderDrawContext(); renderExport(); updateDirtyChip(); saveLocalState();
};
window.rmWord = (i) => {
  if (S.drawIdx === i) { S.drawIdx = null; S.path = []; }
  else if (S.drawIdx !== null && S.drawIdx > i) S.drawIdx--;
  S.words = S.words.filter((_, idx) => idx !== i);
  renderGrid(); renderWords(); renderDrawContext(); renderExport(); updateDirtyChip(); saveLocalState();
};

window.upM = (key, val) => {
  S.meta = { ...S.meta, [key]: val };
  renderExport(); updateDirtyChip(); saveLocalState();
};
window.upMCheck = (key, val) => upM(key, val);
window.doReset = async () => {
  if (isDirty()) {
    const ok = await promptConfirm({ title: 'Reset editor?', message: 'All unsaved changes will be lost.', confirmText: 'Reset', variant: 'danger' });
    if (!ok) return;
  }
  resetEditorState();
};

function escapeHtml(text) {
  return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ===== COPY JSON ===== */
window.copyJSON = () => {
  const json = toJSON(S.meta, S.words, S.letters);
  navigator.clipboard?.writeText(json).then(() => {
    const btn = document.getElementById('copy-btn');
    if (btn) { btn.textContent = '✓ Copied'; setTimeout(() => { btn.textContent = 'Copy'; }, 2000); }
  });
};

/* ===== RENDERERS ===== */
function renderGrid() {
  const wrap = document.getElementById('grid-wrap');
  if (!wrap) return;
  const own = buildOwn(S.words);
  const { drawIdx, path, letters, words } = S;
  const wD = drawIdx !== null ? words[drawIdx] : null;

  let html = `<div class="tile-grid-legend">${COLS.map(c => `<div class="tile-legend-cell">${c}</div>`).join('')}</div>`;

  ROWS.forEach(r => {
    html += `<div class="tile-grid-row">`;
    COLS.forEach(c => {
      const coord = c + r;
      const letter = letters[coord] || '';
      const inPath = path.includes(coord);
      const pos = path.indexOf(coord);
      const owners = own[coord] || [];
      const last = path[path.length - 1];
      const maxLen = wD ? wD.display.replace(/ /g,'').length : 0;
      const canAdd = drawIdx !== null && !inPath && path.length < maxLen && (path.length === 0 || isAdj(last, coord));

      let bg = 'var(--color-surface-2)';
      let border = '1px solid var(--color-border)';
      let lc = 'var(--color-text)';

      if (drawIdx !== null && inPath) {
        bg = wD.color + '22'; border = `2px solid ${wD.color}`; lc = wD.color;
      } else if (drawIdx !== null && canAdd) {
        border = `1.5px dashed ${wD.color}88`;
      } else if (drawIdx === null && owners.length > 0) {
        const wc = words[owners[0]]?.color;
        bg = wc + '18'; border = `1.5px solid ${wc}55`; lc = wc;
      }

      const posNum = drawIdx !== null && inPath ? `<span class="tile-pos" style="color:${wD.color}">${pos+1}</span>` : '';
      const overlapBadge = drawIdx === null && owners.length > 1 ? `<span class="tile-overlap">2+</span>` : '';

      let inner;
      if (drawIdx !== null) {
        const canClick = inPath || canAdd;
        inner = `<div class="tile-click" onclick="cellClick('${coord}')" style="color:${lc};${!canClick ? 'opacity:0.5;cursor:not-allowed' : ''}">${escapeHtml(letter)}</div>`;
      } else {
        inner = `<input id="t-${coord}" class="tile-input" type="text" maxlength="1" value="${escapeHtml(letter)}"
          oninput="tileInput('${coord}',this)" onkeydown="tileKeydown('${coord}',event)"
          autocomplete="off" spellcheck="false" autocapitalize="characters" style="color:${lc}"
          aria-label="Tile ${coord}">`;
      }

      html += `<div class="tile" style="background:${bg};border:${border}" data-coord="${coord}">
        ${inner}
        ${posNum}
        ${overlapBadge}
        <span class="tile-coord">${coord}</span>
      </div>`;
    });
    html += `</div>`;
  });

  wrap.innerHTML = html;

  // Update fill count
  const filled = CELL_ORDER.filter(c => S.letters[c]).length;
  const label = document.getElementById('grid-fill-label');
  if (label) label.textContent = `${filled}/16 filled`;

  // Refocus
  if (pf && S.drawIdx === null) {
    const el = document.getElementById('t-' + pf);
    if (el) { el.focus(); el.select(); }
    pf = null;
  }
}

function renderDrawContext() {
  const ctx = document.getElementById('draw-context');
  if (!ctx) return;
  if (S.drawIdx === null) { ctx.classList.remove('is-active'); ctx.innerHTML = ''; return; }
  const wD = S.words[S.drawIdx];
  if (!wD) { ctx.classList.remove('is-active'); return; }
  ctx.classList.add('is-active');
  ctx.style.borderColor = wD.color + '55';
  ctx.style.background = wD.color + '0d';
  ctx.innerHTML = `
    <div class="draw-context-header">
      <div>
        <div class="draw-context-name">${escapeHtml(wD.display)}</div>
        <div class="draw-context-path">${S.path.join(' ') || '—'} (${S.path.length}/${wD.display.replace(/ /g,'').length})</div>
      </div>
      <div class="color-dot" style="background:${wD.color};margin-top:4px"></div>
    </div>
    <div class="draw-context-actions">
      <button class="btn btn-primary" onclick="finishDraw()" style="background:${wD.color};border-color:${wD.color};color:#111">Done</button>
      <button class="btn btn-ghost" onclick="clearCP()">Clear</button>
      <button class="btn btn-ghost" onclick="cancelDraw()">Cancel</button>
    </div>`;
}

function renderWords() {
  const list = document.getElementById('words-list');
  const countLabel = document.getElementById('word-count-label');
  if (!list) return;
  if (countLabel) countLabel.textContent = `${S.words.length} total`;

  if (!S.words.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✦</div><p>No words yet. Type a word above and press Add.</p></div>`;
    return;
  }

  list.innerHTML = S.words.map((w, idx) => `
    <div class="word-row${S.drawIdx === idx ? ' is-drawing' : ''}" style="${S.drawIdx === idx ? `border-color:${w.color}55;background:${w.color}0d` : ''}">
      <div class="color-dot" style="background:${w.color}"></div>
      <span class="word-name">${escapeHtml(w.display)}</span>
      <span class="word-path-badge${!w.path ? ' no-path' : ''}">${w.path ? w.path.replace(/.{2}/g, m => m + ' ').trim() : 'no path'}</span>
      ${S.drawIdx === idx
        ? `<span class="word-drawing-label" style="color:${w.color}">Drawing…</span>`
        : `<div class="word-actions">
            <button class="btn btn-ghost" onclick="startDraw(${idx})">Draw</button>
            <button class="btn btn-ghost" onclick="clearPath(${idx})">Clear</button>
            <button class="btn btn-danger" onclick="rmWord(${idx})" aria-label="Remove ${escapeHtml(w.display)}">✕</button>
          </div>`}
    </div>`).join('');
}

function renderMeta() {
  const form = document.getElementById('meta-form');
  if (!form) return;
  const m = S.meta;
  form.innerHTML = `
    <div class="form-field">
      <label class="form-label" for="m-id">ID</label>
      <input class="form-input mono" id="m-id" type="text" value="${escapeHtml(m.id)}" placeholder="sonic-the-hedgehog"
        oninput="upM('id',this.value.toLowerCase().replace(/[^a-z0-9-]/g,''))" autocomplete="off">
    </div>
    <div class="form-field">
      <label class="form-label" for="m-cat">Category</label>
      <select class="form-select" id="m-cat" onchange="upM('category',this.value)">
        ${CATS.map(c => `<option value="${c}"${m.category===c?' selected':''}>${c}</option>`).join('')}
      </select>
    </div>
    <div class="form-field">
      <label class="form-label" for="m-nameEn">Name (EN)</label>
      <input class="form-input" id="m-nameEn" type="text" value="${escapeHtml(m.nameEn)}" placeholder="Sonic the Hedgehog" oninput="upM('nameEn',this.value)">
    </div>
    <div class="form-field">
      <label class="form-label" for="m-nameEs">Name (ES)</label>
      <input class="form-input" id="m-nameEs" type="text" value="${escapeHtml(m.nameEs)}" placeholder="Sonic el Erizo" oninput="upM('nameEs',this.value)">
    </div>
    <div class="form-field">
      <label class="form-label" for="m-diff">Difficulty</label>
      <select class="form-select" id="m-diff" onchange="upM('difficulty',this.value)">
        ${DIFFS.map(d => `<option value="${d}"${m.difficulty===d?' selected':''}>${d}</option>`).join('')}
      </select>
    </div>
    <div class="form-field">
      <label class="form-label" for="m-date">Date</label>
      <input class="form-input" id="m-date" type="date" value="${escapeHtml(m.date)}" oninput="upM('date',this.value)">
    </div>
    <div class="form-field span-2">
      <label class="form-label" for="m-hintEn">Hint (EN)</label>
      <textarea class="form-textarea" id="m-hintEn" placeholder="A blue blur from SEGA…" oninput="upM('hintEn',this.value)">${escapeHtml(m.hintEn)}</textarea>
    </div>
    <div class="form-field span-2">
      <label class="form-label" for="m-hintEs">Hint (ES)</label>
      <textarea class="form-textarea" id="m-hintEs" placeholder="Un erizo azul de SEGA…" oninput="upM('hintEs',this.value)">${escapeHtml(m.hintEs)}</textarea>
    </div>
    <div class="form-field span-2">
      <div class="form-checkbox-row">
        <input type="checkbox" id="m-premium" ${m.premium ? 'checked' : ''} onchange="upMCheck('premium',this.checked)">
        <label class="form-checkbox-label" for="m-premium">Premium puzzle</label>
      </div>
    </div>`;
}

function renderExport() {
  const json = toJSON(S.meta, S.words, S.letters);
  const { errors, warnings, valid } = validate(S.meta, S.words, S.letters);

  const valBlock = document.getElementById('validation-block');
  if (valBlock) {
    if (valid && !warnings.length) {
      valBlock.innerHTML = `<div class="validation-block valid"><div class="validation-title">✓ Puzzle is valid</div></div>`;
    } else if (errors.length) {
      valBlock.innerHTML = `<div class="validation-block has-errors"><div class="validation-title">✗ ${errors.length} error(s)</div>${errors.map(e => `<div>• ${escapeHtml(e)}</div>`).join('')}${warnings.map(w => `<div class="text-warning">⚠ ${escapeHtml(w)}</div>`).join('')}</div>`;
    } else {
      valBlock.innerHTML = `<div class="validation-block has-warnings"><div class="validation-title">⚠ ${warnings.length} warning(s)</div>${warnings.map(w => `<div>• ${escapeHtml(w)}</div>`).join('')}</div>`;
    }
  }

  const out = document.getElementById('json-output');
  if (out) out.textContent = json;
}

function renderAll() {
  renderGrid();
  renderDrawContext();
  renderWords();
  renderMeta();
  renderExport();
  updateDirtyChip();
}

/* ===== INIT ===== */
loadLocalState();
syncSavedSnapshot();
renderAll();