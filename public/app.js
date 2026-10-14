/* ============================================================
   Diccionari de correspondències entre transcripcions xineses
   ============================================================ */

const PAGE_SIZE = 20;
const FILTER_DEBOUNCE_MS = 250;

/* Rutas relativas: imprescindibles detrás de un reverse-proxy
   que sirve la app bajo un subpath (p. ej. /es/transcripciones). */
const CSV_URL = './content/transcripcion.csv';
const INTRO_URL = './content/intro.txt';
const SOUND_BASE = './content/sounds/';

/* Referencia al <audio> que está sonando en este momento, para
   poder pararlo cuando el usuario pulsa play en otra fila. */
let currentAudio = null;
let currentButton = null;

const state = {
  allRows: [],
  headers: [],
  filtered: [],
  sorted: [],
  visibleCount: PAGE_SIZE,
  sort: { column: null, direction: null },
  columnFilters: {},
  globalFilter: '',
  displayHeaders: [],
};

/* ---------------- Utilitats ---------------- */

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalize(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function debounce(fn, wait) {
  let t = null;
  return function (...args) {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn.apply(this, args);
    }, wait);
  };
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(field);
        field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
        if (ch === '\r') i++;
      } else if (ch !== '\r') {
        field += ch;
      }
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/* ---------------- Càrrega de dades ---------------- */

async function loadCSV() {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error('Error carregant el CSV');
  const text = await res.text();
  const raw = parseCSV(text).filter(r => r.some(c => c.trim() !== ''));
  if (raw.length === 0) return;

  state.headers = raw[0].map(h => h.trim());
  state.allRows = raw.slice(1).map(r => {
    const obj = {};
    state.headers.forEach((h, i) => {
      obj[h] = (r[i] ?? '').trim();
    });
    return obj;
  });

  state.displayHeaders = [...state.headers, 'sonido'];
  state.sort = { column: state.headers[0], direction: 'desc' };
}

/* ---------------- Filtres ---------------- */

function applyFilters() {
  const global = normalize(state.globalFilter);

  state.filtered = state.allRows.filter(row => {
    for (const [col, value] of Object.entries(state.columnFilters)) {
      if (!value) continue;
      const cell = normalize(row[col] ?? '');
      if (!cell.includes(normalize(value))) return false;
    }
    if (global) {
      const found = state.headers.some(h =>
        normalize(row[h] ?? '').includes(global)
      );
      if (!found) return false;
    }
    return true;
  });
}

/* ---------------- Ordre ---------------- */

function applySort() {
  const { column, direction } = state.sort;
  if (!column || !direction) {
    state.sorted = [...state.filtered];
    return;
  }
  const dir = direction === 'asc' ? 1 : -1;
  state.sorted = [...state.filtered].sort((a, b) => {
    const va = normalize(a[column] ?? '');
    const vb = normalize(b[column] ?? '');
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
}

/* ---------------- Reproductor de audio ---------------- */

/* Parar el audio que esté sonando (si lo hay) y resetear su botón. */
function stopCurrentAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  if (currentButton) {
    currentButton.classList.remove('playing');
    currentButton.innerHTML = '<i class="fa-solid fa-play"></i>';
    currentButton.setAttribute('aria-label', 'Reproducir audio');
    currentButton.setAttribute('title', 'Reproducir audio');
  }
  currentAudio = null;
  currentButton = null;
}

/* Crea un reproductor compacto: botón con icono + <audio> oculto. */
function createAudioPlayer(src, label) {
  const wrapper = document.createElement('span');
  wrapper.className = 'audio-player';

  const audio = document.createElement('audio');
  audio.preload = 'none';
  audio.src = src;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'audio-play-btn';
  button.innerHTML = '<i class="fa-solid fa-play"></i>';
  button.setAttribute('aria-label', `Reproducir ${label}`);
  button.setAttribute('title', `Reproducir ${label}`);

  button.addEventListener('click', (e) => {
    e.stopPropagation();

    if (currentAudio === audio && !audio.paused) {
      // Está sonando este: lo paramos.
      stopCurrentAudio();
      return;
    }

    // Si hay otro sonando, lo paramos primero.
    if (currentAudio && currentAudio !== audio) {
      stopCurrentAudio();
    }

    audio.play().then(() => {
      currentAudio = audio;
      currentButton = button;
      button.classList.add('playing');
      button.innerHTML = '<i class="fa-solid fa-pause"></i>';
      button.setAttribute('aria-label', `Pausar ${label}`);
      button.setAttribute('title', `Pausar ${label}`);
    }).catch(err => {
      console.warn('No se pudo reproducir el audio:', err);
    });
  });

  audio.addEventListener('ended', () => {
    if (currentAudio === audio) {
      currentAudio = null;
      currentButton = null;
    }
    button.classList.remove('playing');
    button.innerHTML = '<i class="fa-solid fa-play"></i>';
    button.setAttribute('aria-label', `Reproducir ${label}`);
    button.setAttribute('title', `Reproducir ${label}`);
  });

  audio.addEventListener('error', () => {
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    button.setAttribute('title', `Audio no disponible: ${label}`);
  });

  wrapper.appendChild(button);
  wrapper.appendChild(audio);
  return wrapper;
}

/* ---------------- Render ---------------- */

function renderHeader() {
  const headerRow = document.getElementById('header-row');
  headerRow.innerHTML = '';

  state.displayHeaders.forEach(col => {
    const th = document.createElement('th');
    const isSorted = state.sort.column === col;
    if (isSorted) th.classList.add('sorted');

    let indicator = '';
    if (isSorted) {
      indicator = `<span class="sort-indicator">${state.sort.direction === 'asc' ? '▲' : '▼'}</span>`;
    }
    th.innerHTML = `${escapeHtml(col)}${indicator}`;

    if (col !== 'sonido') {
      th.title = 'Clic para ordenar';
      th.addEventListener('click', () => {
        if (state.sort.column === col) {
          state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
        } else {
          state.sort = { column: col, direction: 'asc' };
        }
        state.visibleCount = PAGE_SIZE;
        refresh();
        updateURL();
      });
    } else {
      th.style.cursor = 'default';
    }
    headerRow.appendChild(th);
  });
}

function renderFilterRow() {
  const filterRow = document.getElementById('filter-row');
  filterRow.innerHTML = '';

  state.displayHeaders.forEach(col => {
    const th = document.createElement('th');
    if (col === 'sonido') {
      th.innerHTML = '';
      filterRow.appendChild(th);
      return;
    }
    const active = !!state.columnFilters[col];
    if (active) th.classList.add('filtered');

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Filtrar';
    input.value = state.columnFilters[col] ?? '';
    input.dataset.column = col;

    input.addEventListener('input', debounce(e => {
      const val = e.target.value;
      if (val) {
        state.columnFilters[col] = val;
        th.classList.add('filtered');
      } else {
        delete state.columnFilters[col];
        th.classList.remove('filtered');
      }
      state.visibleCount = PAGE_SIZE;
      refresh();
      updateURL();
    }, FILTER_DEBOUNCE_MS));

    th.appendChild(input);
    filterRow.appendChild(th);
  });
}

function renderBody() {
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';

  const visible = state.sorted.slice(0, state.visibleCount);

  if (visible.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = state.displayHeaders.length;
    td.className = 'no-results';
    td.textContent = 'No se han encontrado resultados.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  const activeColName = state.sort.column;
  const activeColIndex = activeColName
    ? state.headers.indexOf(activeColName)
    : -1;

  for (const row of visible) {
    const tr = document.createElement('tr');
    state.headers.forEach((h, idx) => {
      const td = document.createElement('td');
      td.textContent = row[h] ?? '';
      if (idx === activeColIndex) {
        td.classList.add('sorted-col');
      }
      tr.appendChild(td);
    });

    const tdSound = document.createElement('td');
    tdSound.className = 'audio-cell';
    const pinyin = row['Hanyu Pinyin'];
    if (pinyin) {
      const src = `${SOUND_BASE}${pinyin}.mp3`;
      const player = createAudioPlayer(src, pinyin);
      tdSound.appendChild(player);
    }
    tr.appendChild(tdSound);
    tbody.appendChild(tr);
  }
}

function renderCounter() {
  const total = state.sorted.length;
  const showing = Math.min(state.visibleCount, total);
  document.getElementById('counter').textContent =
    `Mostrando ${showing} de ${total} resultados`;
}

function renderEndStates() {
  const total = state.sorted.length;
  const showing = Math.min(state.visibleCount, total);
  const loading = document.getElementById('loading-indicator');
  const endList = document.getElementById('end-of-list');

  if (total === 0) {
    loading.classList.add('hidden');
    endList.classList.add('hidden');
    return;
  }

  if (showing >= total) {
    loading.classList.add('hidden');
    endList.classList.remove('hidden');
  } else {
    loading.classList.remove('hidden');
    endList.classList.add('hidden');
  }
}

function refresh() {
  applyFilters();
  applySort();
  renderHeader();
  renderFilterRow();
  renderBody();
  renderCounter();
  renderEndStates();
}

/* ---------------- Scroll infinit ---------------- */

function setupInfiniteScroll() {
  window.addEventListener('scroll', () => {
    const nearBottom =
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;
    if (!nearBottom) return;

    if (state.visibleCount < state.sorted.length) {
      state.visibleCount += PAGE_SIZE;
      renderBody();
      renderCounter();
      renderEndStates();
    }
  }, { passive: true });
}

/* ---------------- URL <-> estat ---------------- */

function updateURL() {
  const params = new URLSearchParams();
  if (state.sort.column) {
    params.set('sort', state.sort.column);
    params.set('dir', state.sort.direction);
  }
  if (state.globalFilter) params.set('q', state.globalFilter);
  for (const [col, val] of Object.entries(state.columnFilters)) {
    if (val) params.set(`f_${col}`, val);
  }
  const newUrl = `${location.pathname}?${params.toString()}`;
  history.replaceState(null, '', newUrl);
}

function readURL() {
  const params = new URLSearchParams(location.search);
  const sortCol = params.get('sort');
  const dir = params.get('dir');
  if (sortCol && dir) {
    state.sort = { column: sortCol, direction: dir };
  }
  const q = params.get('q');
  if (q) {
    state.globalFilter = q;
    document.getElementById('global-filter-input').value = q;
  }
  for (const [key, val] of params.entries()) {
    if (key.startsWith('f_')) {
      const col = key.slice(2);
      state.columnFilters[col] = val;
    }
  }
}

/* ---------------- Controls globals ---------------- */

function setupControls() {
  const globalInput = document.getElementById('global-filter-input');

  globalInput.addEventListener('input', debounce(e => {
    state.globalFilter = e.target.value;
    state.visibleCount = PAGE_SIZE;
    refresh();
    updateURL();
  }, FILTER_DEBOUNCE_MS));

  document.getElementById('clear-all-filters').addEventListener('click', () => {
    state.columnFilters = {};
    state.globalFilter = '';
    globalInput.value = '';
    state.visibleCount = PAGE_SIZE;
    refresh();
    updateURL();
  });

  document.getElementById('close-intro').addEventListener('click', () => {
    document.getElementById('intro-panel').classList.add('hidden');
  });
}

/* ---------------- Introducció ---------------- */

async function loadIntro() {
  try {
    const res = await fetch(INTRO_URL);
    const html = await res.text();
    document.getElementById('intro-content').innerHTML = html;
  } catch {
    document.getElementById('intro-content').textContent =
      'No se ha podido cargar la introducción.';
  }
}

/* ---------------- Inicialització ---------------- */

async function init() {
  try {
    await Promise.all([loadCSV(), loadIntro()]);
    readURL();
    setupControls();
    setupInfiniteScroll();
    refresh();
  } catch (err) {
    console.error(err);
    document.getElementById('counter').textContent =
      'Error cargando los datos.';
  }
}

document.addEventListener('DOMContentLoaded', init);
