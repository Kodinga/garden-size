/* global L */
import {
  polygonArea,
  simplify,
  isSelfIntersecting,
  shouldAddTracePoint,
  summarizeAreas,
  formatArea,
  formatLength,
} from './geometry.js';
import { GpsTracker } from './gps.js';
import { detectPlatform, locationHelp } from './location-help.js';
import { findLocalReleases, loadCaptureInfo, describeCapture, captureKey } from './wayback.js';
import { loadDraft, saveDraft, loadSaved, storeSaved, loadPrefs, savePrefs, newId } from './storage.js';

const $ = (id) => document.getElementById(id);

const CORNER_SAMPLE_MS = 5000;
const TRACE_MAX_ACCURACY = 15; // metres; fixes worse than this are ignored while tracing
const SIMPLIFY_TOLERANCE = 0.75; // metres
const MAX_UNDO = 100;
const PALETTE = ['#ffd54a', '#4fc3f7', '#81c784', '#f48fb1', '#ffb74d', '#ce93d8', '#80cbc4', '#e6ee9c'];

// ---------- State ----------
// An outline is a list of areas; points are added to the active one.
const prefs = loadPrefs();
const draft = loadDraft();
const state = {
  areas: draft.areas, // [{ id, name, color, subtract, vertices: [{ lat, lng, acc? }] }]
  activeId: draft.activeId,
  history: [], // snapshots of { areas, activeId } for undo
  mode: null, // 'walk' | 'draw' | null
  units: prefs.units === 'imperial' ? 'imperial' : 'metric',
  tracing: false,
  trace: [],
  sampling: false,
  centredOnFix: false,
};

function nextName() {
  const used = new Set(state.areas.map((a) => a.name));
  let n = 1;
  while (used.has(`Area ${n}`)) n++;
  return `Area ${n}`;
}
function nextColor() {
  const used = new Set(state.areas.map((a) => a.color));
  return PALETTE.find((c) => !used.has(c)) ?? PALETTE[state.areas.length % PALETTE.length];
}
const newArea = () => ({ id: newId(), name: nextName(), color: nextColor(), subtract: false, vertices: [] });

if (!state.areas.length) state.areas.push(newArea());
for (const a of state.areas) if (!a.color) a.color = nextColor();
if (!state.areas.some((a) => a.id === state.activeId)) state.activeId = state.areas[0].id;

const active = () => state.areas.find((a) => a.id === state.activeId);
const clone = (pts) => pts.map((p) => ({ ...p }));
const snapshot = () => ({
  activeId: state.activeId,
  areas: state.areas.map((a) => ({ ...a, vertices: clone(a.vertices) })),
});
const allVertices = () => state.areas.flatMap((a) => a.vertices);

function persist() {
  saveDraft({ areas: state.areas, activeId: state.activeId });
}
function pushHistory(snap = snapshot()) {
  state.history.push(snap);
  if (state.history.length > MAX_UNDO) state.history.shift();
}
/** Record an undo step, apply a change, save and redraw. */
function commit(mutate) {
  pushHistory();
  mutate();
  persist();
  render();
}
const setActiveVertices = (next) => commit(() => (active().vertices = next));

/** Active area's vertices plus the in-progress trace, used for live display. */
const livePoints = () => (state.tracing ? [...active().vertices, ...state.trace] : active().vertices);

// ---------- Map ----------
const map = L.map('map', { zoomControl: false, maxZoom: 22 }).setView([30, 0], 2);
L.control.zoom({ position: 'topright' }).addTo(map);

const satellite = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 22, maxNativeZoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' },
);
const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 22,
  maxNativeZoom: 19,
  attribution: '© OpenStreetMap contributors',
});
satellite.addTo(map);
L.control.layers({ Satellite: satellite, Streets: streets }, null, { position: 'topright' }).addTo(map);
L.control.scale({ imperial: true, metric: true, position: 'bottomleft' }).addTo(map);

const shapes = new Map(); // area id -> L.polygon
const handles = L.layerGroup().addTo(map);
const youAccuracy = L.circle([0, 0], { radius: 1, color: '#4fc3f7', weight: 1, fillOpacity: 0.12, interactive: false });
const youDot = L.circleMarker([0, 0], { radius: 7, color: '#fff', weight: 2, fillColor: '#2196f3', fillOpacity: 1, interactive: false });

const vertexIcon = (color, first) =>
  L.divIcon({
    className: 'vertex',
    iconSize: [18, 18],
    html: `<span style="background:${first ? '#fff' : color}"></span>`,
  });
const midIcon = L.divIcon({ className: 'midpoint', iconSize: [12, 12] });

// ---------- Helpers ----------
let toastTimer;
function toast(msg, ms = 2800) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/** First tap arms the button, second tap within 3 s runs the action. */
function confirmable(btn, label, confirmLabel, action) {
  let armed = null;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (armed) {
      clearTimeout(armed);
      armed = null;
      btn.textContent = label;
      action();
      return;
    }
    btn.textContent = confirmLabel;
    armed = setTimeout(() => {
      armed = null;
      btn.textContent = label;
    }, 3000);
  });
}

function fitTo(points) {
  if (points.length) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 20 });
}

// ---------- Areas ----------
function selectArea(id) {
  if (id === state.activeId || !state.areas.some((a) => a.id === id)) return;
  stopTracing();
  state.activeId = id;
  persist();
  render();
}

function addArea() {
  stopTracing();
  let created;
  commit(() => {
    created = newArea();
    state.areas.push(created);
    state.activeId = created.id;
  });
  toast(`${created.name} added — ${state.mode === 'walk' ? 'mark its corners' : 'tap the map to draw it'}`);
  if (!state.mode) setMode('draw');
}

function deleteArea(id) {
  stopTracing();
  commit(() => {
    if (state.areas.length === 1) {
      state.areas[0].vertices = [];
      return;
    }
    const idx = state.areas.findIndex((a) => a.id === id);
    state.areas.splice(idx, 1);
    if (state.activeId === id) state.activeId = state.areas[Math.min(idx, state.areas.length - 1)].id;
  });
}

function shapeStyle(a, isActive) {
  return {
    color: a.color,
    weight: isActive ? 3 : 2,
    opacity: isActive ? 1 : 0.75,
    fillColor: a.subtract ? '#ff5252' : a.color,
    fillOpacity: a.subtract ? 0.18 : isActive ? 0.25 : 0.12,
    dashArray: a.subtract ? '6 6' : null,
  };
}

/** Create/update/remove one polygon per area, plus labels when there are several. */
function syncShapes(live) {
  const ids = new Set(state.areas.map((a) => a.id));
  for (const [id, poly] of shapes) {
    if (!ids.has(id)) {
      poly.remove();
      shapes.delete(id);
    }
  }
  const showLabels = state.areas.filter((a) => a.vertices.length >= 3).length > 1;
  for (const a of state.areas) {
    let poly = shapes.get(a.id);
    if (!poly) {
      const id = a.id;
      poly = L.polygon([], {}).addTo(map);
      // Outside draw mode, tapping an area selects it. In draw mode the click
      // falls through to the map so you can draw an area inside another one.
      poly.on('click', () => state.mode !== 'draw' && selectArea(id));
      shapes.set(id, poly);
    }
    const isActive = a.id === state.activeId;
    const pts = isActive ? live : a.vertices;
    poly.setLatLngs(pts.map((p) => [p.lat, p.lng]));
    poly.setStyle(shapeStyle(a, isActive));

    if (showLabels && pts.length >= 3) {
      const text = `${a.subtract ? '− ' : ''}${a.name} · ${formatArea(polygonArea(pts), state.units).main}`;
      if (poly.getTooltip()) poly.setTooltipContent(text);
      else poly.bindTooltip(text, { permanent: true, direction: 'center', className: 'area-label-tip' });
      poly.openTooltip();
    } else if (poly.getTooltip()) {
      poly.unbindTooltip();
    }
  }
}

/** Stack polygons largest-first so smaller (nested) ones stay tappable. */
function orderShapes() {
  [...state.areas]
    .sort((a, b) => polygonArea(b.vertices) - polygonArea(a.vertices))
    .forEach((a) => shapes.get(a.id)?.bringToFront());
}

function renderAreaList() {
  const ul = $('area-list');
  ul.replaceChildren();
  for (const a of state.areas) {
    const li = document.createElement('li');
    li.dataset.id = a.id;
    li.classList.toggle('active', a.id === state.activeId);
    li.addEventListener('click', () => selectArea(a.id));

    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = a.color;
    if (a.subtract) swatch.classList.add('subtract');

    const name = document.createElement('input');
    name.className = 'area-name';
    name.value = a.name;
    name.maxLength = 40;
    name.setAttribute('aria-label', 'Area name');
    name.addEventListener('focus', () => selectArea(a.id));
    name.addEventListener('input', () => {
      a.name = name.value.trim() || 'Untitled';
      persist();
      updateStats();
    });

    const value = document.createElement('span');
    value.className = 'area-value';

    const sub = document.createElement('button');
    sub.className = 'icon-btn';
    sub.textContent = a.subtract ? '−' : '+';
    sub.title = a.subtract ? 'Subtracted from total (e.g. shed, patio). Tap to add instead.' : 'Added to total. Tap to subtract it instead (e.g. shed, patio).';
    sub.setAttribute('aria-label', sub.title);
    sub.addEventListener('click', (e) => {
      e.stopPropagation();
      const area = state.areas.find((x) => x.id === a.id);
      commit(() => (area.subtract = !area.subtract));
    });

    const del = document.createElement('button');
    del.className = 'icon-btn';
    del.textContent = '🗑';
    del.title = state.areas.length === 1 ? 'Clear this area' : 'Delete this area';
    del.setAttribute('aria-label', del.title);
    confirmable(del, '🗑', 'Sure?', () => deleteArea(a.id));

    li.append(swatch, name, value, sub, del);
    ul.append(li);
  }
}

// ---------- Rendering ----------
function updateStats() {
  const live = livePoints();
  syncShapes(live);

  const act = active();
  const areas = state.areas.map((a) => (a.id === act.id ? { ...a, vertices: live } : a));
  const sum = summarizeAreas(areas);
  const measured = areas.filter((a) => a.vertices.length >= 3);
  const actStats = sum.items[state.areas.indexOf(act)];
  const f = formatArea(sum.total, state.units);

  const label = $('area-label');
  label.hidden = measured.length < 2;
  label.textContent = `Total of ${measured.length} areas`;

  $('area-main').textContent = measured.length ? f.main : '—';
  $('area-sub').textContent = measured.length
    ? f.sub
    : live.length
      ? `Add ${3 - live.length} more point${live.length === 2 ? '' : 's'}`
      : "Walk or draw your garden's edge";

  $('perimeter').textContent = `${act.name}: perimeter ${live.length >= 2 ? formatLength(actStats.perimeter, state.units) : '—'}`;
  $('point-count').textContent = `${live.length} point${live.length === 1 ? '' : 's'}`;

  $('uncertainty').textContent =
    sum.uncertainty && sum.total > 0
      ? `GPS uncertainty ≈ ±${formatArea(sum.uncertainty, state.units).main} — drag points onto the imagery to refine`
      : '';

  const tangled = areas.filter((a) => isSelfIntersecting(a.vertices)).map((a) => a.name);
  const warn = $('warning');
  warn.hidden = !tangled.length;
  if (tangled.length) {
    warn.textContent = `${tangled.join(', ')} ${tangled.length > 1 ? 'cross themselves' : 'crosses itself'}, so its area is wrong. Drag or delete points to untangle it.`;
  }

  // Per-area figures in the list (updated in place so typing a name keeps focus).
  for (const li of $('area-list').children) {
    const i = state.areas.findIndex((a) => a.id === li.dataset.id);
    const pts = areas[i]?.vertices ?? [];
    const v = li.querySelector('.area-value');
    if (v) v.textContent = pts.length >= 3 ? formatArea(sum.items[i].area, state.units).main : `${pts.length} pts`;
  }

  const empty = !allVertices().length && !state.trace.length;
  $('undo-btn').disabled = !state.history.length;
  $('clear-btn').disabled = empty && state.areas.length === 1;
  $('export-btn').disabled = !measured.length;
  $('save-btn').disabled = !measured.length;
}

function renderHandles() {
  handles.clearLayers();
  const act = active();
  const v = act.vertices;

  v.forEach((p, i) => {
    const m = L.marker([p.lat, p.lng], { icon: vertexIcon(act.color, i === 0), draggable: true, autoPan: true });
    let before;
    m.on('dragstart', () => (before = snapshot()));
    m.on('drag', (e) => {
      const { lat, lng } = e.target.getLatLng();
      act.vertices[i] = { lat, lng }; // manual placement drops GPS accuracy
      updateStats();
    });
    m.on('dragend', () => {
      pushHistory(before);
      persist();
      render();
    });
    m.on('dblclick', (e) => {
      L.DomEvent.stop(e);
      setActiveVertices(v.filter((_, j) => j !== i));
    });
    handles.addLayer(m);
  });

  // Midpoint handles: drag to insert a new vertex on an edge.
  if (v.length >= 2 && v.length < 150 && !state.tracing) {
    const edges = v.length >= 3 ? v.length : 1;
    for (let i = 0; i < edges; i++) {
      const a = v[i];
      const b = v[(i + 1) % v.length];
      const mid = L.marker([(a.lat + b.lat) / 2, (a.lng + b.lng) / 2], { icon: midIcon, draggable: true });
      let before;
      mid.on('dragstart', () => {
        before = snapshot();
        act.vertices.splice(i + 1, 0, { ...mid.getLatLng() });
      });
      mid.on('drag', (e) => {
        const { lat, lng } = e.target.getLatLng();
        act.vertices[i + 1] = { lat, lng };
        updateStats();
      });
      mid.on('dragend', () => {
        pushHistory(before);
        persist();
        render();
      });
      handles.addLayer(mid);
    }
  }
}

function render() {
  renderAreaList();
  renderHandles();
  updateStats();
  orderShapes();
}

// ---------- GPS / walk mode ----------
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    /* wake lock is a nicety; ignore failures */
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.mode === 'walk') keepAwake(true);
});

function setGpsStatus(text, quality = '') {
  const el = $('gps-status');
  el.textContent = text;
  el.className = `gps-status ${quality}`;
}

const gps = new GpsTracker({
  onFix(fix) {
    const ll = [fix.lat, fix.lng];
    youDot.setLatLng(ll).addTo(map);
    youAccuracy.setLatLng(ll).setRadius(fix.acc).addTo(map);

    if (fix.acc > APPROXIMATE_ACCURACY) {
      // Hundreds of metres: the OS is only giving "approximate" location.
      setGpsStatus(`Approximate location only (±${Math.round(fix.acc)} m) — Precise Location is off`, 'poor');
      showLocationHelpButton('approximate');
      if (!state.warnedApproximate) {
        state.warnedApproximate = true;
        openLocationHelp('approximate');
      }
    } else {
      const quality = fix.acc <= 5 ? 'good' : fix.acc <= 12 ? 'ok' : 'poor';
      const label = quality === 'good' ? 'good' : quality === 'ok' ? 'fair' : 'poor — wait or move into the open';
      setGpsStatus(`GPS ±${fix.acc.toFixed(1)} m (${label})`, quality);
      $('loc-help-btn').hidden = true;
    }

    if (!state.centredOnFix) {
      state.centredOnFix = true;
      map.setView(ll, Math.max(map.getZoom(), 19));
    }

    if (state.tracing) {
      const v = active().vertices;
      const last = state.trace[state.trace.length - 1] ?? v[v.length - 1];
      if (shouldAddTracePoint(last, fix, { maxAccuracy: TRACE_MAX_ACCURACY })) {
        state.trace.push({ lat: fix.lat, lng: fix.lng, acc: fix.acc });
        updateStats();
      }
    }
  },
  onError(err) {
    if (err.code === 1) {
      setGpsStatus('Location is blocked for this site', 'poor');
      showLocationHelpButton('denied');
      openLocationHelp('denied');
      return;
    }
    const messages = {
      2: 'Location unavailable. Check location is switched on, and try outdoors.',
      3: 'Waiting for GPS…',
    };
    const msg = messages[err.code] ?? err.message;
    setGpsStatus(msg, 'poor');
    if (err.code !== 3) toast(msg, 5000);
  },
});

// ---------- Location help ----------
// Once a site is denied location, browsers never ask again; the user has to
// find the switch in OS/browser settings. Show steps for their device.
const APPROXIMATE_ACCURACY = 500; // metres; worse than this means "Precise Location" is off
const helpDialog = $('loc-help');
let helpReason = 'denied';

function showLocationHelpButton(reason) {
  helpReason = reason;
  const btn = $('loc-help-btn');
  btn.textContent = reason === 'approximate' ? 'How do I turn on precise location?' : 'How do I allow location?';
  btn.hidden = false;
}

function openLocationHelp(reason = helpReason) {
  helpReason = reason;
  const p = detectPlatform(navigator.userAgent, navigator.maxTouchPoints, navigator.platform);
  const help = locationHelp(p, location.host || 'this site');
  $('loc-help-title').textContent = reason === 'approximate' ? 'Precise location is off' : 'Location is blocked';
  $('loc-help-sub').textContent =
    reason === 'approximate'
      ? `Your phone is only sharing an approximate position, which is far too rough to measure a garden. Steps for ${help.title}:`
      : `Your browser has blocked location for this site and won't ask again by itself. Steps for ${help.title}:`;
  // Steps are static strings from location-help.js (only <b> markup), not user input.
  $('loc-help-steps').innerHTML = help.steps.map((s) => `<li>${s}</li>`).join('');
  if (helpDialog.open) return;
  if (typeof helpDialog.showModal === 'function') helpDialog.showModal();
  else helpDialog.setAttribute('open', '');
}

function closeLocationHelp() {
  if (typeof helpDialog.close === 'function') helpDialog.close();
  else helpDialog.removeAttribute('open');
}

$('loc-help-btn').addEventListener('click', () => openLocationHelp());
$('loc-close').addEventListener('click', closeLocationHelp);
$('loc-reload').addEventListener('click', () => location.reload());
$('loc-retry').addEventListener('click', () => {
  closeLocationHelp();
  state.warnedApproximate = false;
  if (state.mode === 'walk') {
    gps.stop();
    state.centredOnFix = false;
    setGpsStatus('Starting GPS…');
    gps.start();
  } else {
    $('locate-btn').click();
  }
});

function startTracing() {
  state.tracing = true;
  state.trace = [];
  $('trace-btn').textContent = '■ Stop tracing';
  $('trace-btn').classList.add('recording');
  renderHandles();
  toast(`Tracing ${active().name} — walk slowly along the edge`);
}

function stopTracing() {
  if (!state.tracing) return;
  state.tracing = false;
  $('trace-btn').textContent = '〰️ Start tracing';
  $('trace-btn').classList.remove('recording');
  const simplified = simplify(state.trace, SIMPLIFY_TOLERANCE);
  const raw = state.trace.length;
  state.trace = [];
  if (simplified.length) {
    setActiveVertices([...active().vertices, ...simplified]);
    toast(`Added ${simplified.length} points (from ${raw} GPS fixes)`);
  } else {
    render();
  }
}

async function markCorner() {
  if (state.sampling) return;
  if (!gps.running) gps.start();
  state.sampling = true;
  const targetId = state.activeId; // keep the area the user was on when they tapped
  const btn = $('corner-btn');
  btn.disabled = true;
  try {
    const avg = await gps.sample(CORNER_SAMPLE_MS, (remaining, count) => {
      btn.textContent = `Hold still… ${Math.ceil(remaining / 1000)}s (${count})`;
    });
    const target = state.areas.find((a) => a.id === targetId) ?? active();
    commit(() => target.vertices.push({ lat: avg.lat, lng: avg.lng, acc: avg.acc }));
    if (avg.acc > 15) toast(`Corner added but GPS is weak (±${avg.acc.toFixed(0)} m). Drag it to fix.`, 5000);
    else toast(`${target.name}: corner ${target.vertices.length} added (±${avg.acc.toFixed(1)} m, ${avg.samples} readings)`);
  } catch (err) {
    toast(err.message, 5000);
  } finally {
    state.sampling = false;
    btn.disabled = false;
    btn.textContent = '📍 Mark corner';
  }
}

// ---------- Modes ----------
function setMode(mode) {
  if (state.mode === mode) mode = null; // tapping the active mode toggles it off
  if (state.mode === 'walk' && mode !== 'walk') {
    stopTracing();
    gps.stop();
    keepAwake(false);
    youDot.remove();
    youAccuracy.remove();
    setGpsStatus('GPS off');
  }
  state.mode = mode;

  document.querySelectorAll('.mode').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
  $('walk-controls').hidden = mode !== 'walk';
  $('draw-controls').hidden = mode !== 'draw';

  if (mode === 'draw') map.doubleClickZoom.disable();
  else map.doubleClickZoom.enable();

  if (mode === 'walk') {
    if (!window.isSecureContext) {
      toast('GPS needs HTTPS (or localhost). Open this page over https://', 6000);
    }
    state.centredOnFix = false;
    setGpsStatus('Starting GPS…');
    gps.start();
    keepAwake(true);
  }
}

map.on('click', (e) => {
  if (state.mode !== 'draw') return;
  setActiveVertices([...active().vertices, { lat: e.latlng.lat, lng: e.latlng.lng }]);
});

// ---------- Saved gardens ----------
function renderSaved() {
  const list = loadSaved();
  $('saved-count').textContent = list.length;
  const ul = $('saved-list');
  ul.replaceChildren();
  for (const g of list) {
    const li = document.createElement('li');
    const info = document.createElement('div');
    info.className = 'info';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = g.name;
    const sub = document.createElement('span');
    sub.className = 'sub';
    const n = g.areas.filter((a) => a.vertices.length >= 3).length;
    sub.textContent = `${formatArea(summarizeAreas(g.areas).total, state.units).main}${n > 1 ? ` · ${n} areas` : ''} · ${new Date(g.savedAt).toLocaleDateString()}`;
    info.append(name, sub);

    const load = document.createElement('button');
    load.textContent = 'Open';
    load.addEventListener('click', () => {
      if (!g.areas.length) return;
      stopTracing();
      commit(() => {
        state.areas = g.areas.map((a) => ({ ...a, vertices: clone(a.vertices) }));
        for (const a of state.areas) if (!a.color) a.color = nextColor();
        state.activeId = state.areas[0].id;
      });
      $('name-input').value = g.name;
      fitTo(allVertices());
    });
    const del = document.createElement('button');
    del.textContent = '🗑';
    del.title = 'Delete';
    confirmable(del, '🗑', 'Sure?', () => {
      storeSaved(loadSaved().filter((x) => x.id !== g.id));
      renderSaved();
    });
    li.append(info, load, del);
    ul.append(li);
  }
}

// ---------- Buttons ----------
document.querySelectorAll('.mode').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

$('add-area-btn').addEventListener('click', addArea);
$('corner-btn').addEventListener('click', markCorner);
$('trace-btn').addEventListener('click', () => (state.tracing ? stopTracing() : startTracing()));

function undo() {
  if (state.tracing) {
    state.trace = [];
    stopTracing();
  }
  const prev = state.history.pop();
  if (!prev) return false;
  state.areas = prev.areas;
  state.activeId = prev.activeId;
  persist();
  render();
  return true;
}

$('undo-btn').addEventListener('click', undo);

// Ctrl+Z (⌘Z on Mac) undoes the last map edit. Inside text fields the
// browser's own text undo is left alone.
document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 'z' || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
  const el = e.target;
  if (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
  e.preventDefault();
  if (!undo()) toast('Nothing to undo');
});

confirmable($('clear-btn'), '✕ Clear all', 'Tap again to clear all', () => {
  state.trace = [];
  if (state.tracing) stopTracing();
  commit(() => {
    state.areas = [];
    const fresh = newArea();
    state.areas.push(fresh);
    state.activeId = fresh.id;
  });
  $('name-input').value = '';
});

$('save-btn').addEventListener('click', () => {
  const name = $('name-input').value.trim() || `Garden ${new Date().toLocaleDateString()}`;
  const list = loadSaved();
  const existing = list.find((g) => g.name === name);
  const entry = { id: existing?.id ?? newId(), name, areas: snapshot().areas, savedAt: Date.now() };
  const next = existing ? list.map((g) => (g.id === entry.id ? entry : g)) : [entry, ...list];
  if (storeSaved(next)) toast(`Saved “${name}”`);
  else toast('Could not save: browser storage is unavailable', 5000);
  renderSaved();
});

$('export-btn').addEventListener('click', () => {
  const name = $('name-input').value.trim() || 'garden';
  const sum = summarizeAreas(state.areas);
  const features = state.areas
    .map((a, i) => ({ a, stats: sum.items[i] }))
    .filter(({ a }) => a.vertices.length >= 3)
    .map(({ a, stats }) => ({
      type: 'Feature',
      properties: {
        name: a.name,
        role: a.subtract ? 'subtract' : 'add',
        area_m2: Math.round(stats.area * 100) / 100,
        perimeter_m: Math.round(stats.perimeter * 100) / 100,
      },
      geometry: { type: 'Polygon', coordinates: [[...a.vertices, a.vertices[0]].map((p) => [p.lng, p.lat])] },
    }));
  if (!features.length) return;
  const geojson = {
    type: 'FeatureCollection',
    name,
    total_area_m2: Math.round(sum.total * 100) / 100,
    exported_at: new Date().toISOString(),
    features,
  };
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${name.replace(/[^\w-]+/g, '_')}.geojson`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

$('units').value = state.units;
$('units').addEventListener('change', (e) => {
  state.units = e.target.value;
  savePrefs({ ...loadPrefs(), units: state.units });
  updateStats();
  renderSaved();
});

$('locate-btn').addEventListener('click', () => {
  if (gps.last && gps.running) {
    map.setView([gps.last.lat, gps.last.lng], Math.max(map.getZoom(), 19));
    return;
  }
  if (!('geolocation' in navigator)) return toast('Geolocation is not supported here');
  toast('Finding you…');
  navigator.geolocation.getCurrentPosition(
    (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 19),
    (err) => {
      if (err.code === 1) openLocationHelp('denied');
      else toast('Could not get your location', 4000);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
  );
});

// ---------- Imagery dates (Esri World Imagery Wayback) ----------
// Lets the user flip through older satellite captures of the current spot,
// e.g. a winter image where bare trees no longer hide the fence line.
//
// Loading is two-phase because Esri's metadata services are often slow to
// wake up: (1) find which distinct photos exist here (fast) and show the bar
// immediately; (2) fill in capture dates / seasons as they arrive.
const imagery = {
  list: [], // [{ ...release, captureDate, provider, resolution, season, pending, hidden }]
  index: 0,
  loading: false, // phase 1 in progress
  center: null,
  layer: null,
  gen: 0, // bumps on every load/close so stale async results are ignored
  touched: false, // user has picked a date themselves
};
const imageryBar = $('imagery-bar');
map.getContainer().append(imageryBar); // keeps it over the map on desktop too
L.DomEvent.disableClickPropagation(imageryBar); // don't add draw points through the bar
L.DomEvent.disableScrollPropagation(imageryBar);

const monthYear = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });

function imageryLabel(c, i) {
  if (!c.captureDate) {
    const when = `${i === 0 ? 'Latest' : 'Photo'}, published ${monthYear(Date.parse(c.releaseDate))}`;
    return c.pending ? `${when} · date loading…` : when;
  }
  const parts = [monthYear(c.captureDate), `${c.season.name}${c.season.leafOff ? ' 🍂' : ''}`];
  if (c.resolution) parts.push(`${c.resolution < 1 ? Number(c.resolution.toFixed(2)) : c.resolution} m/px`);
  if (c.provider) parts.push(c.provider);
  return parts.join(' · ');
}

/** Hide later copies of a capture that was re-published in several releases. */
function markDuplicates() {
  const seen = new Set();
  for (const c of imagery.list) {
    const key = captureKey(c);
    c.hidden = seen.has(key);
    seen.add(key);
  }
}

const visibleIndex = (from, step) => {
  for (let i = from + step; i >= 0 && i < imagery.list.length; i += step) if (!imagery.list[i].hidden) return i;
  return -1;
};

function refreshImageryControls() {
  const select = $('img-select');
  imagery.list.forEach((c, i) => {
    const opt = select.options[i];
    if (!opt) return;
    opt.textContent = imageryLabel(c, i);
    // Keep the currently shown one selectable even if it turned out to be a duplicate.
    opt.hidden = opt.disabled = c.hidden && i !== imagery.index;
  });
  select.value = String(imagery.index);
  $('img-older').disabled = visibleIndex(imagery.index, 1) === -1;
  $('img-newer').disabled = visibleIndex(imagery.index, -1) === -1;
}

function showImagery(i) {
  const c = imagery.list[i];
  if (!c) return;
  imagery.index = i;
  if (imagery.layer) imagery.layer.setUrl(c.url);
  else {
    imagery.layer = L.tileLayer(c.url, {
      maxZoom: 22,
      maxNativeZoom: 19,
      zIndex: 5, // above the base layers
      attribution: 'Archive imagery: Esri World Imagery Wayback',
    }).addTo(map);
  }
  refreshImageryControls();
}

function closeImagery() {
  imagery.gen++;
  imagery.loading = false;
  imagery.layer?.remove();
  imagery.layer = null;
  imagery.list = [];
  imagery.center = null;
  imageryBar.hidden = true;
  $('imagery-btn').classList.remove('on');
  $('imagery-btn').disabled = false;
}

async function loadImagery({ keepRelease } = {}) {
  if (imagery.loading) return;
  if (map.getZoom() < 15) {
    toast('Zoom in to your garden first, then tap 🗓', 4000);
    return;
  }
  const gen = ++imagery.gen;
  imagery.loading = true;
  $('imagery-btn').disabled = true;
  const center = map.getCenter();
  const { lat, lng } = center;
  const z = Math.min(19, Math.round(map.getZoom()));
  if (!keepRelease) toast('Looking for older photos of this spot…', 15000);

  // Phase 1: which distinct photos exist here.
  let releases;
  try {
    releases = await findLocalReleases(lat, lng, z, {
      onProgress: (n) => n && !keepRelease && gen === imagery.gen && toast(`Looking for older photos… ${n} found`, 15000),
    });
  } catch (err) {
    if (gen === imagery.gen) toast(`Could not reach the imagery archive (${err.message})`, 5000);
    return;
  } finally {
    if (gen === imagery.gen) {
      imagery.loading = false;
      $('imagery-btn').disabled = false;
    }
  }
  if (gen !== imagery.gen) return; // closed or superseded meanwhile
  if (!releases.length) {
    toast('No archive imagery found for this spot', 4000);
    return;
  }

  imagery.list = releases.map((r) => ({ ...describeCapture(r, null, lat), pending: true, hidden: false }));
  imagery.center = center;
  if (!keepRelease) imagery.touched = false;
  $('img-select').replaceChildren(
    ...imagery.list.map((_, i) => Object.assign(document.createElement('option'), { value: String(i) })),
  );
  imageryBar.hidden = false;
  $('imagery-btn').classList.add('on');
  const keep = keepRelease ? imagery.list.findIndex((c) => c.release === keepRelease) : -1;
  showImagery(Math.max(0, keep));
  if (!keepRelease) toast(`${releases.length} photos of this spot. Use ◀ ▶ to flip through them (loading dates…)`, 5000);

  // Phase 2: capture dates and seasons, filled in as they arrive.
  await loadCaptureInfo(releases, lat, lng, z, {
    onInfo: (i, info) => {
      if (gen !== imagery.gen) return;
      imagery.list[i] = { ...describeCapture(releases[i], info, lat), pending: false, hidden: false };
      markDuplicates();
      refreshImageryControls();
    },
  });
  if (gen !== imagery.gen || keepRelease) return;

  const visible = imagery.list.filter((c) => !c.hidden);
  const leafOff = imagery.list.findIndex((c) => !c.hidden && c.season?.leafOff);
  if (leafOff >= 0 && !imagery.touched) {
    // A leaf-off photo is what usually reveals the boundary: switch to it.
    showImagery(leafOff);
    toast(`Showing ${monthYear(imagery.list[leafOff].captureDate)} (leaf-off 🍂). ${visible.length} photos — ◀ ▶ to compare.`, 6000);
  } else if (leafOff < 0) {
    toast(`${visible.length} photos here, none from the leaf-off season.`, 5000);
  }
}

function pickImagery(i) {
  if (i < 0) return;
  imagery.touched = true;
  showImagery(i);
}

$('imagery-btn').addEventListener('click', () => (imageryBar.hidden ? loadImagery() : closeImagery()));
$('img-close').addEventListener('click', closeImagery);
$('img-older').addEventListener('click', () => pickImagery(visibleIndex(imagery.index, 1)));
$('img-newer').addEventListener('click', () => pickImagery(visibleIndex(imagery.index, -1)));
$('img-select').addEventListener('change', (e) => pickImagery(Number(e.target.value)));

// Different places have different archives: refresh the list after a big pan.
map.on('moveend', () => {
  if (imageryBar.hidden || imagery.loading || !imagery.center || map.getZoom() < 15) return;
  if (map.distance(map.getCenter(), imagery.center) > 400) {
    loadImagery({ keepRelease: imagery.list[imagery.index]?.release });
  }
});

// Keep map size in sync with the panel / viewport.
new ResizeObserver(() => map.invalidateSize()).observe($('map'));

// ---------- Boot ----------
persist(); // writes migrated/normalised draft back
render();
renderSaved();
if (allVertices().length) {
  fitTo(allVertices());
  toast('Restored your last outline');
} else {
  toast('Choose “Walk the edge” or “Draw on map” to start', 4000);
}
