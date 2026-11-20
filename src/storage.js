// localStorage helpers. Every access is guarded: private mode or blocked
// storage must never break the app.
//
// Data model:
//   area   = { id, name, color, subtract, vertices: [{ lat, lng, acc? }] }
//   draft  = { areas: area[], activeId }
//   saved  = [{ id, name, areas: area[], savedAt }]
// Older versions stored a single outline as a bare vertex array; those are
// migrated to a one-area list on read.

const DRAFT_KEY = 'garden-size:draft:v1';
const SAVED_KEY = 'garden-size:saved:v1';
const PREFS_KEY = 'garden-size:prefs:v1';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Random id that also works outside secure contexts (no crypto.randomUUID). */
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

const isPoint = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

/** Cadastre parcel an area was imported from (France). */
function cleanParcel(p) {
  if (!p || typeof p !== 'object' || typeof p.id !== 'string') return undefined;
  return {
    id: p.id,
    label: typeof p.label === 'string' ? p.label : '',
    commune: typeof p.commune === 'string' ? p.commune : null,
    contenance: Number.isFinite(p.contenance) ? p.contenance : null,
  };
}

function cleanArea(a, i) {
  const area = {
    id: typeof a.id === 'string' && a.id ? a.id : newId(),
    name: typeof a.name === 'string' && a.name.trim() ? a.name : `Area ${i + 1}`,
    color: typeof a.color === 'string' ? a.color : null,
    subtract: Boolean(a.subtract),
    vertices: (Array.isArray(a.vertices) ? a.vertices : []).filter(isPoint),
  };
  const parcel = cleanParcel(a.parcel);
  if (parcel) area.parcel = parcel;
  return area;
}

/** Accepts a list of areas, or a legacy bare vertex array. Always returns areas. */
export function normalizeAreas(raw) {
  if (!Array.isArray(raw)) return [];
  if (raw.length && isPoint(raw[0])) return [cleanArea({ vertices: raw }, 0)];
  return raw.filter((a) => a && typeof a === 'object' && Array.isArray(a.vertices)).map(cleanArea);
}

export function loadDraft() {
  const d = read(DRAFT_KEY, null);
  if (Array.isArray(d)) return { areas: normalizeAreas(d), activeId: null };
  return { areas: normalizeAreas(d?.areas), activeId: typeof d?.activeId === 'string' ? d.activeId : null };
}
export const saveDraft = (draft) => write(DRAFT_KEY, draft);

export const loadSaved = () =>
  read(SAVED_KEY, [])
    .filter((g) => g && (Array.isArray(g.areas) || Array.isArray(g.vertices)))
    .map((g) => ({ ...g, areas: normalizeAreas(g.areas ?? g.vertices) }));
export const storeSaved = (list) => write(SAVED_KEY, list);

export const loadPrefs = () => read(PREFS_KEY, {});
export const savePrefs = (prefs) => write(PREFS_KEY, prefs);
