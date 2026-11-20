import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ignUrl, parseIgn, nominatimUrl, parseNominatim, suggest, search } from '../src/geocode.js';

const ignJson = {
  features: [
    {
      geometry: { type: 'Point', coordinates: [3.097624, 50.267721] },
      properties: { label: '12 Rue de la Paix 62860 Palluel', name: '12 Rue de la Paix', postcode: '62860', city: 'Palluel', context: '62, Pas-de-Calais, Hauts-de-France', type: 'housenumber' },
    },
    {
      geometry: { type: 'Point', coordinates: [4.88, 45.77] },
      properties: { label: 'Villeurbanne', name: 'Villeurbanne', postcode: '69100', city: 'Villeurbanne', context: '69, Rhône, Auvergne-Rhône-Alpes', type: 'municipality' },
    },
    { geometry: null, properties: {} },
  ],
};

test('ignUrl: autocomplete and location bias', () => {
  const u = new URL(ignUrl('12 rue de la paix', { near: { lat: 48.8566, lng: 2.3522 } }));
  assert.equal(u.searchParams.get('q'), '12 rue de la paix');
  assert.equal(u.searchParams.get('autocomplete'), '1');
  assert.equal(u.searchParams.get('lat'), '48.85660');
  assert.equal(u.searchParams.get('lon'), '2.35220');
  assert.equal(new URL(ignUrl('x', { autocomplete: false })).searchParams.has('autocomplete'), false);
});

test('parseIgn: addresses and towns, GeoJSON lon/lat swapped', () => {
  const [addr, town, ...rest] = parseIgn(ignJson);
  assert.equal(rest.length, 0);
  assert.deepEqual(addr, { label: '12 Rue de la Paix', sub: '62860 Palluel · Pas-de-Calais, Hauts-de-France', lat: 50.267721, lng: 3.097624, zoom: 19, source: 'ign' });
  assert.equal(town.label, '69100 Villeurbanne');
  assert.equal(town.zoom, 14);
});

test('parseNominatim: label, bounds, zoom', () => {
  const [r] = parseNominatim([
    { lat: '51.5034878', lon: '-0.1276965', name: 'Downing Street', place_rank: 26, display_name: '10, Downing Street, Westminster, London, United Kingdom', boundingbox: ['51.50', '51.51', '-0.13', '-0.12'] },
  ]);
  assert.equal(r.label, '10 Downing Street');
  assert.equal(r.sub, 'Westminster, London, United Kingdom');
  assert.deepEqual(r.bounds, [[51.5, -0.13], [51.51, -0.12]]);
  assert.equal(r.zoom, 19);
  assert.equal(r.source, 'osm');
  assert.match(nominatimUrl('a b', 'fr'), /accept-language=fr/);
  assert.deepEqual(parseNominatim({ error: 'x' }), []);
});

test('suggest: needs 3 characters, uses IGN', async () => {
  const urls = [];
  const fetchJson = async (u) => (urls.push(u), ignJson);
  assert.deepEqual(await suggest('12', { fetchJson }), []);
  assert.equal(urls.length, 0);
  assert.equal((await suggest('12 rue', { fetchJson })).length, 2);
  assert.match(urls[0], /geopf\.fr/);
});

test('search: IGN in France, falls back to Nominatim when IGN finds nothing or fails', async () => {
  const osm = [{ lat: '1', lon: '2', display_name: 'Somewhere' }];
  const calls = [];
  const make = (ign) => async (u) => {
    calls.push(u.includes('geopf') ? 'ign' : 'osm');
    if (u.includes('geopf')) return typeof ign === 'function' ? ign() : ign;
    return osm;
  };
  assert.equal((await search('12 rue de la paix', { france: true, fetchJson: make(ignJson) }))[0].source, 'ign');
  assert.equal((await search('Brussels', { france: true, fetchJson: make({ features: [] }) }))[0].source, 'osm');
  assert.equal((await search('x', { france: true, fetchJson: make(() => { throw new Error('HTTP 500'); }) }))[0].source, 'osm');
  calls.length = 0;
  await search('London', { france: false, fetchJson: make(ignJson) });
  assert.deepEqual(calls, ['osm']);
});
