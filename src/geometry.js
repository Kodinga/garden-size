// Pure geometry helpers for small (garden-scale) polygons on the Earth.
// Points are plain objects: { lat, lng, acc? } where acc is GPS accuracy in metres.
//
// For areas this small (< a few km across), projecting onto a local flat plane
// centred on the polygon (equirectangular) is accurate to well under 0.1%.

export const EARTH_RADIUS = 6371008.8; // mean Earth radius, metres

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/** Great-circle distance in metres (haversine). */
export function distance(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Arithmetic mean of lat/lng. Fine for small areas away from the antimeridian. */
export function centroid(points) {
  if (!points.length) return null;
  let lat = 0;
  let lng = 0;
  for (const p of points) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / points.length, lng: lng / points.length };
}

/** Local flat-plane projection (metres) around an origin. */
export function projector(origin) {
  const k = Math.cos(toRad(origin.lat));
  return {
    toXY: (p) => ({
      x: toRad(p.lng - origin.lng) * EARTH_RADIUS * k,
      y: toRad(p.lat - origin.lat) * EARTH_RADIUS,
    }),
    fromXY: (q) => ({
      lat: origin.lat + toDeg(q.y / EARTH_RADIUS),
      lng: origin.lng + toDeg(q.x / (EARTH_RADIUS * k)),
    }),
  };
}

/** Polygon area in square metres (shoelace on the local plane). */
export function polygonArea(points) {
  if (!points || points.length < 3) return 0;
  const { toXY } = projector(centroid(points));
  const xy = points.map(toXY);
  let sum = 0;
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i];
    const b = xy[(i + 1) % xy.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Total edge length in metres. Closed adds the edge from last back to first. */
export function perimeter(points, closed = true) {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  if (closed && points.length >= 3) total += distance(points[points.length - 1], points[0]);
  return total;
}

function perpendicularDistance(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Douglas–Peucker simplification of a path. Removes GPS jitter while keeping
 * corners. Tolerance in metres. Returns a subset of the original point objects.
 */
export function simplify(points, tolerance = 0.75) {
  if (!points || points.length <= 2) return points ? [...points] : [];
  const { toXY } = projector(centroid(points));
  const xy = points.map(toXY);
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(xy[i], xy[start], xy[end]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > tolerance) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function segmentsIntersect(p1, p2, p3, p4) {
  const d = (a, b, c) => (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** True if any two non-adjacent edges of the closed polygon cross. */
export function isSelfIntersecting(points) {
  const n = points?.length ?? 0;
  if (n < 4) return false;
  const { toXY } = projector(centroid(points));
  const xy = points.map(toXY);
  for (let i = 0; i < n; i++) {
    const a1 = xy[i];
    const a2 = xy[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // adjacent via closing edge
      if (segmentsIntersect(a1, a2, xy[j], xy[(j + 1) % n])) return true;
    }
  }
  return false;
}

/**
 * Combine several GPS fixes taken while standing still into one point,
 * weighting each by 1/accuracy². Reported accuracy is the weighted mean
 * accuracy (conservative: GPS errors are correlated over short periods).
 */
export function weightedAverage(fixes) {
  if (!fixes?.length) return null;
  let wSum = 0;
  let lat = 0;
  let lng = 0;
  let acc = 0;
  for (const f of fixes) {
    const a = Math.max(f.acc ?? 10, 1);
    const w = 1 / (a * a);
    wSum += w;
    lat += f.lat * w;
    lng += f.lng * w;
    acc += a * w;
  }
  return { lat: lat / wSum, lng: lng / wSum, acc: acc / wSum };
}

/**
 * Decide whether a new GPS fix should be appended to a traced path:
 * it must be accurate enough, and far enough from the previous point
 * that we are recording movement rather than jitter.
 */
export function shouldAddTracePoint(last, fix, { maxAccuracy = 15, minStep = 1 } = {}) {
  if (!fix || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)) return false;
  if ((fix.acc ?? Infinity) > maxAccuracy) return false;
  if (!last) return true;
  return distance(last, fix) >= Math.max(minStep, fix.acc * 0.5);
}

/**
 * 1-sigma area uncertainty (m²) from per-vertex GPS accuracy, by first-order
 * error propagation of the shoelace formula:
 *   ∂A/∂x_i = ½(y_{i+1} − y_{i−1}),  ∂A/∂y_i = ½(x_{i−1} − x_{i+1})
 *   σ_A² = Σ σ_i² · ¼ · |p_{i+1} − p_{i−1}|²
 * Each vertex's `acc` is used as its per-axis σ (conservative). Vertices
 * without accuracy (placed by hand) contribute nothing. Returns null when
 * fewer than half the vertices have GPS accuracy.
 */
export function areaUncertainty(points) {
  if (!points || points.length < 3) return null;
  const withAcc = points.filter((p) => Number.isFinite(p.acc)).length;
  if (withAcc < points.length / 2) return null;
  const { toXY } = projector(centroid(points));
  const xy = points.map(toXY);
  const n = xy.length;
  let variance = 0;
  for (let i = 0; i < n; i++) {
    const s = points[i].acc;
    if (!Number.isFinite(s)) continue;
    const prev = xy[(i - 1 + n) % n];
    const next = xy[(i + 1) % n];
    const d2 = (next.x - prev.x) ** 2 + (next.y - prev.y) ** 2;
    variance += (s * s * d2) / 4;
  }
  return Math.sqrt(variance);
}

/**
 * Combine several areas into one total. Areas flagged `subtract` (a shed,
 * patio, pond…) are taken away from the total. Uncertainties are combined
 * in quadrature (independent per area). Returns per-area figures in `items`,
 * in the same order as the input.
 */
export function summarizeAreas(areas) {
  let total = 0;
  let variance = 0;
  const items = (areas ?? []).map((a) => {
    const pts = a.vertices ?? [];
    const area = polygonArea(pts);
    const uncertainty = areaUncertainty(pts);
    total += a.subtract ? -area : area;
    if (uncertainty) variance += uncertainty * uncertainty;
    return { area, perimeter: perimeter(pts), uncertainty };
  });
  return { total: Math.max(0, total), uncertainty: variance ? Math.sqrt(variance) : null, items };
}

const SQ_FT_PER_M2 = 10.7639104;
const FT_PER_M = 3.2808399;
const M2_PER_ACRE = 4046.8564224;

const fmt = (n, digits) =>
  n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export function formatArea(m2, units = 'metric') {
  const ft2 = m2 * SQ_FT_PER_M2;
  const m2Str = `${fmt(m2, m2 < 100 ? 1 : 0)} m²`;
  const ft2Str = `${fmt(ft2, ft2 < 100 ? 1 : 0)} ft²`;
  if (units === 'imperial') {
    return { main: ft2Str, sub: `${fmt(m2 / M2_PER_ACRE, 3)} acres · ${m2Str}` };
  }
  return { main: m2Str, sub: `${fmt(m2 / 10000, 3)} ha · ${ft2Str}` };
}

export function formatLength(m, units = 'metric') {
  if (units === 'imperial') return `${fmt(m * FT_PER_M, 0)} ft`;
  return `${fmt(m, m < 100 ? 1 : 0)} m`;
}
