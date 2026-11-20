// Esri World Imagery Wayback: the archive of every past version of Esri's
// satellite basemap (2014 onwards). Different versions are often captured
// in different seasons, so a winter / early-spring ("leaf-off") image can
// show fences and hedges that summer tree canopy hides.
//
// How we find the distinct images for one spot:
//  1. waybackconfig.json lists every release (number, publish date, tile URL).
//  2. For a tile, /tilemap/{release}/{z}/{y}/{x} answers which release that
//     tile's pixels really come from (`select`). Most releases just reuse an
//     older image, so we can jump straight to it and keep walking back in time.
//  3. Each release's metadata service gives the real capture date and source.

const CONFIG_URL = 'https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json';
const TILEMAP_URL = 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tilemap';

/** Slippy-map tile containing a point. */
export function tileXY(lat, lng, z) {
  const n = 2 ** z;
  const latRad = (lat * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x: Math.min(n - 1, Math.max(0, x)), y: Math.min(n - 1, Math.max(0, y)) };
}

/** Turn waybackconfig.json into releases sorted newest first, with Leaflet tile URLs. */
export function parseReleases(config) {
  return Object.entries(config ?? {})
    .map(([key, v]) => ({
      release: Number(key),
      releaseDate: v?.itemTitle?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null,
      url: v?.itemURL?.replace('{level}', '{z}').replace('{row}', '{y}').replace('{col}', '{x}') ?? null,
      metadataUrl: v?.metadataLayerUrl ?? null,
    }))
    .filter((r) => Number.isFinite(r.release) && r.releaseDate && r.url)
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate) || b.release - a.release);
}

/** Metadata layers go from 0 (1.9 cm, zoom 23) to 13 (150 m); one per zoom level. */
export const metadataLayerForZoom = (z) => Math.max(0, Math.min(13, 23 - Math.round(z)));

/**
 * Season of a capture date, accounting for hemisphere. `leafOff` is true when
 * deciduous trees are likely bare (Nov–Mar north, May–Sep south). It is never
 * set in the tropics, where there is no reliable leaf-off season.
 */
export function season(date, lat) {
  const month = new Date(date).getUTCMonth(); // 0 = Jan
  const m = lat >= 0 ? month : (month + 6) % 12; // shift southern hemisphere
  const name = m === 11 || m <= 1 ? 'Winter' : m <= 4 ? 'Spring' : m <= 7 ? 'Summer' : 'Autumn';
  const leafOff = Math.abs(lat) > 23.5 && (m >= 10 || m <= 2);
  return { name, leafOff };
}

/**
 * Walk back through releases and return the distinct ones whose imagery
 * differs at this tile, newest first. `fetchJson(url)` is injectable for tests.
 */
export async function findDistinctReleases(releases, lat, lng, z, fetchJson, onProgress) {
  const { x, y } = tileXY(lat, lng, z);
  const found = [];
  for (let i = 0; i < releases.length; i++) {
    onProgress?.(found.length);
    const res = await fetchJson(`${TILEMAP_URL}/${releases[i].release}/${z}/${y}/${x}`);
    if (!res?.data?.[0]) break; // no imagery this far back for this tile
    const actual = res.select?.[0] ?? releases[i].release;
    let idx = releases.findIndex((r) => r.release === actual);
    if (idx === -1) idx = i; // unknown release number: use the one we asked for
    if (!found.includes(releases[idx])) found.push(releases[idx]);
    if (idx > i) i = idx; // skip the releases that merely reuse this image
  }
  return found;
}

/** Capture date / source of a release's imagery at a point. */
export async function captureInfo(release, lat, lng, z, fetchJson) {
  if (!release.metadataUrl) return null;
  for (let layer = metadataLayerForZoom(z); layer <= 13; layer++) {
    const q = new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'SRC_DATE2,NICE_DESC,SRC_RES,SRC_ACC',
      returnGeometry: 'false',
      f: 'json',
    });
    const res = await fetchJson(`${release.metadataUrl}/${layer}/query?${q}`);
    const a = res?.features?.[0]?.attributes;
    if (a) {
      return {
        captureDate: Number.isFinite(a.SRC_DATE2) ? a.SRC_DATE2 : null,
        provider: a.NICE_DESC || null,
        resolution: Number.isFinite(a.SRC_RES) ? a.SRC_RES : null,
        accuracy: Number.isFinite(a.SRC_ACC) ? a.SRC_ACC : null,
      };
    }
  }
  return null;
}

/** captureInfo with retries: Esri's metadata services are often slow to wake up. */
export async function captureInfoWithRetry(release, lat, lng, z, fetchJson, retries = 2) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await captureInfo(release, lat, lng, z, fetchJson);
    } catch (err) {
      if (attempt >= retries) throw err;
    }
  }
}

/** Merge capture metadata into a release. Without metadata, falls back to the publish date. */
export function describeCapture(release, info, lat) {
  const captureDate = info?.captureDate ?? null;
  return {
    ...release,
    captureDate,
    provider: info?.provider ?? null,
    resolution: info?.resolution ?? null,
    accuracy: info?.accuracy ?? null,
    season: captureDate ? season(captureDate, lat) : null,
  };
}

/** Same capture re-published in several releases gets the same key. */
export const captureKey = (c) => (c.captureDate ? `${c.captureDate}|${c.provider ?? ''}` : `release:${c.release}`);

let releasesPromise = null;

/** Phase 1 (fast, ~1–3 s): distinct releases at a point, newest first, without capture dates. */
export async function findLocalReleases(lat, lng, z, { fetchJson = defaultFetchJson, onProgress } = {}) {
  releasesPromise ??= fetchJson(CONFIG_URL).then(parseReleases).catch((err) => {
    releasesPromise = null; // allow a retry later
    throw err;
  });
  const releases = await releasesPromise;
  return findDistinctReleases(releases, lat, lng, z, fetchJson, onProgress);
}

/**
 * Phase 2 (slow, a few seconds per cold service): look up capture metadata,
 * a few at a time. `onInfo(index, info | null)` fires as each arrives.
 */
export async function loadCaptureInfo(releases, lat, lng, z, { fetchJson = defaultFetchJson, onInfo, concurrency = 4 } = {}) {
  let next = 0;
  const worker = async () => {
    while (next < releases.length) {
      const i = next++;
      const info = await captureInfoWithRetry(releases[i], lat, lng, z, fetchJson).catch(() => null);
      onInfo?.(i, info);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, releases.length) }, worker));
}

/**
 * Both phases in one call: all distinct captures at a point, newest first,
 * duplicates removed.
 */
export async function localImagery(lat, lng, z, { fetchJson = defaultFetchJson, onProgress } = {}) {
  const releases = await findLocalReleases(lat, lng, z, { fetchJson, onProgress });
  const described = releases.map((r) => describeCapture(r, null, lat));
  await loadCaptureInfo(releases, lat, lng, z, {
    fetchJson,
    onInfo: (i, info) => (described[i] = describeCapture(releases[i], info, lat)),
  });
  const seen = new Set();
  return described.filter((c) => {
    const key = captureKey(c);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function defaultFetchJson(url) {
  const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json?.error) throw new Error(json.error.message ?? 'service error');
  return json;
}
