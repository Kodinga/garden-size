import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inFrance, parseParcel, parcelAt, wfsUrl, apiCartoUrl } from '../src/cadastre.js';
import { polygonArea, projector } from '../src/geometry.js';

test('inFrance', () => {
  assert.equal(inFrance(48.8566, 2.3522), true); // Paris
  assert.equal(inFrance(42.7, 9.45), true); // Corse
  assert.equal(inFrance(-21.1, 55.5), true); // La Réunion
  assert.equal(inFrance(51.5, -0.12), false); // London
  assert.equal(inFrance(40.4, -3.7), false); // Madrid
});

test('wfsUrl uses lat lon axis order; apiCartoUrl uses GeoJSON lon,lat', () => {
  assert.match(decodeURIComponent(wfsUrl(48.8, 2.1)), /POINT\(48\.8 2\.1\)/);
  assert.match(decodeURIComponent(apiCartoUrl(48.8, 2.1)), /"coordinates":\[2\.1,48\.8\]/);
});

// A 20 m × 15 m parcel plus a tiny detached piece, as a MultiPolygon.
const { fromXY } = projector({ lat: 48.8049, lng: 2.1204 });
const ring = (pts) => {
  const r = pts.map(([x, y]) => fromXY({ x, y })).map((p) => [p.lng, p.lat]);
  return [...r, r[0]]; // closed, as in GeoJSON
};
const feature = {
  type: 'Feature',
  properties: { idu: '78646000BY0088', section: 'BY', numero: '0088', nom_com: 'Versailles', contenance: 301 },
  geometry: {
    type: 'MultiPolygon',
    coordinates: [
      [ring([[100, 100], [101, 100], [101, 101]])],
      [ring([[0, 0], [20, 0], [20, 15], [0, 15]])],
    ],
  },
};

test('parseParcel: picks the largest polygon, drops the closing point, tidies the label', () => {
  const p = parseParcel(feature);
  assert.equal(p.id, '78646000BY0088');
  assert.equal(p.label, 'BY 88');
  assert.equal(p.commune, 'Versailles');
  assert.equal(p.contenance, 301);
  assert.equal(p.vertices.length, 4);
  assert.ok(Math.abs(polygonArea(p.vertices) - 300) < 0.1);
  assert.equal(parseParcel({ geometry: { type: 'Point', coordinates: [0, 0] } }), null);
  assert.equal(parseParcel(null), null);
});

test('parcelAt: WFS first, falls back to API Carto, null when no parcel', async () => {
  const calls = [];
  const ok = await parcelAt(48.8, 2.1, {
    fetchJson: async (url) => {
      calls.push(url.includes('geopf') ? 'wfs' : 'apicarto');
      if (url.includes('geopf')) throw new Error('HTTP 503');
      return { features: [feature] };
    },
  });
  assert.deepEqual(calls, ['wfs', 'apicarto']);
  assert.equal(ok.label, 'BY 88');

  assert.equal(await parcelAt(48.8, 2.1, { fetchJson: async () => ({ features: [] }) }), null);
  await assert.rejects(parcelAt(48.8, 2.1, { fetchJson: async () => { throw new Error('down'); } }), /down/);
});
