// Address search.
// - France: IGN Géoplateforme geocoder (Base Adresse Nationale). It is free, needs no key,
//   supports CORS and allows autocomplete, so the app suggests addresses while you type.
// - Elsewhere: OpenStreetMap Nominatim. Its usage policy forbids autocomplete, so it is
//   only queried when the user submits the search (Enter / button).

const IGN = 'https://data.geopf.fr/geocodage/search';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

// Zoom to use for each kind of result: an address shows the garden, a town shows the town.
const IGN_ZOOM = { housenumber: 19, street: 17, locality: 17, municipality: 14 };

/** IGN geocoder URL. `near` biases results towards the map centre. */
export function ignUrl(q, { near, autocomplete = true, limit = 6 } = {}) {
  const p = new URLSearchParams({ q, limit: String(limit), index: 'address' });
  if (autocomplete) p.set('autocomplete', '1');
  if (near) {
    p.set('lat', near.lat.toFixed(5));
    p.set('lon', near.lng.toFixed(5));
  }
  return `${IGN}?${p}`;
}

/** IGN GeoJSON → [{ label, sub, lat, lng, zoom }]. */
export function parseIgn(json) {
  return (json?.features ?? [])
    .map((f) => {
      const [lng, lat] = f?.geometry?.coordinates ?? [];
      const p = f?.properties ?? {};
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const town = [p.postcode, p.city].filter(Boolean).join(' ');
      const isTown = p.type === 'municipality';
      return {
        label: isTown ? town || p.label : p.name || p.label,
        sub: isTown ? p.context || '' : [town, p.context?.split(',').slice(1).join(',').trim()].filter(Boolean).join(' · '),
        lat,
        lng,
        zoom: IGN_ZOOM[p.type] ?? 17,
        source: 'ign',
      };
    })
    .filter(Boolean);
}

export const nominatimUrl = (q, lang = 'en', limit = 5) =>
  `${NOMINATIM}?${new URLSearchParams({ q, format: 'jsonv2', limit: String(limit), 'accept-language': lang })}`;

/** Nominatim JSON → [{ label, sub, lat, lng, zoom, bounds? }]. */
export function parseNominatim(json) {
  return (Array.isArray(json) ? json : [])
    .map((r) => {
      const lat = Number(r?.lat);
      const lng = Number(r?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const parts = String(r.display_name ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      // "10, Downing Street, …" reads better as "10 Downing Street, …"
      if (parts.length > 1 && /^\d+[a-z]?$/i.test(parts[0])) parts.splice(0, 2, `${parts[0]} ${parts[1]}`);
      const bb = (r.boundingbox ?? []).map(Number); // [south, north, west, east]
      const bounds = bb.length === 4 && bb.every(Number.isFinite) ? [[bb[0], bb[2]], [bb[1], bb[3]]] : null;
      return {
        label: r.name && !parts[0]?.includes(r.name) ? r.name : parts[0] ?? r.name ?? '',
        sub: parts.slice(1).join(', '),
        lat,
        lng,
        zoom: Number(r.place_rank) >= 26 ? 19 : 16,
        bounds,
        source: 'osm',
      };
    })
    .filter(Boolean);
}

/** Suggestions while typing (France only; returns [] elsewhere). */
export async function suggest(q, { near, fetchJson = defaultFetchJson, signal } = {}) {
  if (q.trim().length < 3) return [];
  return parseIgn(await fetchJson(ignUrl(q.trim(), { near }), signal));
}

/**
 * Full search on submit. French addresses go to IGN first; anything IGN does not
 * know (or any search when `france` is false) goes to Nominatim.
 */
export async function search(q, { france, near, lang, fetchJson = defaultFetchJson, signal } = {}) {
  const text = q.trim();
  if (!text) return [];
  if (france) {
    try {
      const hits = parseIgn(await fetchJson(ignUrl(text, { near, autocomplete: false }), signal));
      if (hits.length) return hits;
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      // fall through to Nominatim
    }
  }
  return parseNominatim(await fetchJson(nominatimUrl(text, lang), signal));
}

async function defaultFetchJson(url, signal) {
  const timeout = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined;
  const sig = signal && timeout && AbortSignal.any ? AbortSignal.any([signal, timeout]) : signal ?? timeout;
  const res = await fetch(url, { signal: sig });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
