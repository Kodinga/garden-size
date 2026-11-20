// French cadastre (IGN Géoplateforme): parcel boundaries as map tiles, and
// a lookup that returns the parcel under a point with its official outline
// and its "contenance" (official area in m², a tax figure, not a survey).

import { polygonArea } from './geometry.js';

const WMTS = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
export const CADASTRE_TILE_URL = `${WMTS}&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&STYLE=PCI%20vecteur&FORMAT=image/png`;
export const IGN_ORTHO_TILE_URL = `${WMTS}&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg`;
export const IGN_ATTRIBUTION = '© IGN – Géoplateforme';

// [south, west, north, east] for metropolitan France + Corsica and the overseas départements.
const FRANCE_BOXES = [
  [41.2, -5.6, 51.2, 9.8], // métropole + Corse
  [15.8, -61.9, 16.6, -60.9], // Guadeloupe
  [14.3, -61.3, 14.95, -60.75], // Martinique
  [2.1, -54.7, 5.9, -51.5], // Guyane
  [-21.45, 55.2, -20.85, 55.9], // La Réunion
  [-13.05, 44.95, -12.6, 45.35], // Mayotte
];

/** Rough check (bounding boxes); good enough to decide whether to offer the cadastre. */
export const inFrance = (lat, lng) => FRANCE_BOXES.some(([s, w, n, e]) => lat >= s && lat <= n && lng >= w && lng <= e);

/** Géoplateforme WFS: parcel intersecting a point (EPSG:4326 axis order is lat, lon). */
export function wfsUrl(lat, lng) {
  const params = {
    SERVICE: 'WFS',
    VERSION: '2.0.0',
    REQUEST: 'GetFeature',
    TYPENAMES: 'CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle',
    OUTPUTFORMAT: 'application/json',
    COUNT: '1',
    CQL_FILTER: `INTERSECTS(geom,POINT(${lat} ${lng}))`,
  };
  // encodeURIComponent (space → %20), not URLSearchParams (space → '+'): CQL needs a real space.
  const q = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return `https://data.geopf.fr/wfs/ows?${q}`;
}

/** API Carto (IGN), used as a fallback. GeoJSON is lon, lat. */
export const apiCartoUrl = (lat, lng) =>
  `https://apicarto.ign.fr/api/cadastre/parcelle?geom=${encodeURIComponent(JSON.stringify({ type: 'Point', coordinates: [lng, lat] }))}`;

/** GeoJSON parcel feature → { id, label, section, numero, commune, contenance, vertices }. */
export function parseParcel(feature) {
  const p = feature?.properties ?? {};
  const g = feature?.geometry;
  const polygons = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
  let best = [];
  for (const poly of polygons) {
    const ring = (poly?.[0] ?? [])
      .filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
      .map(([lng, lat]) => ({ lat, lng }));
    // GeoJSON rings repeat the first point at the end.
    if (ring.length > 1) {
      const a = ring[0];
      const b = ring[ring.length - 1];
      if (a.lat === b.lat && a.lng === b.lng) ring.pop();
    }
    if (ring.length >= 3 && polygonArea(ring) > polygonArea(best)) best = ring;
  }
  if (best.length < 3) return null;
  const section = String(p.section ?? '').trim();
  const numero = String(p.numero ?? '').replace(/^0+(?=\d)/, '');
  return {
    id: String(p.idu ?? p.id ?? `${p.code_insee ?? ''}${section}${numero}`),
    label: [section, numero].filter(Boolean).join(' ') || '?',
    section,
    numero,
    commune: p.nom_com || null,
    contenance: Number.isFinite(p.contenance) ? p.contenance : null,
    vertices: best,
  };
}

/** Parcel under a point, or null if there is none (roads, rivers, public land). */
export async function parcelAt(lat, lng, { fetchJson = defaultFetchJson } = {}) {
  let lastError;
  for (const url of [wfsUrl(lat, lng), apiCartoUrl(lat, lng)]) {
    try {
      const json = await fetchJson(url);
      const feature = json?.features?.[0];
      return feature ? parseParcel(feature) : null;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function defaultFetchJson(url) {
  const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
