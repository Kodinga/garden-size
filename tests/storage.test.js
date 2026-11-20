import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAreas } from '../src/storage.js';

test('normalizeAreas: migrates a legacy single-outline vertex array', () => {
  const areas = normalizeAreas([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, { lat: 5, lng: 6, acc: 3 }]);
  assert.equal(areas.length, 1);
  assert.equal(areas[0].name, 'Area 1');
  assert.equal(areas[0].subtract, false);
  assert.equal(areas[0].vertices.length, 3);
  assert.equal(typeof areas[0].id, 'string');
});

test('normalizeAreas: keeps areas, drops junk, fills defaults', () => {
  const areas = normalizeAreas([
    { id: 'a', name: 'Lawn', color: '#fff', subtract: false, vertices: [{ lat: 1, lng: 1 }, { lat: 'x', lng: 1 }] },
    { id: 'b', name: '', subtract: 1, vertices: [] },
    null,
    { name: 'no vertices' },
  ]);
  assert.equal(areas.length, 2);
  assert.equal(areas[0].name, 'Lawn');
  assert.equal(areas[0].vertices.length, 1, 'invalid point removed');
  assert.equal(areas[1].name, 'Area 2');
  assert.equal(areas[1].subtract, true);
  assert.equal(areas[1].color, null);
});

test('normalizeAreas: keeps a valid cadastre parcel tag, drops a broken one', () => {
  const [a, b] = normalizeAreas([
    { name: 'Parcelle BY 88', vertices: [], parcel: { id: '78646000BY0088', label: 'BY 88', commune: 'Versailles', contenance: 301, junk: 1 } },
    { name: 'x', vertices: [], parcel: { label: 'no id' } },
  ]);
  assert.deepEqual(a.parcel, { id: '78646000BY0088', label: 'BY 88', commune: 'Versailles', contenance: 301 });
  assert.equal('parcel' in b, false);
});

test('normalizeAreas: non-array input gives empty list', () => {
  assert.deepEqual(normalizeAreas(undefined), []);
  assert.deepEqual(normalizeAreas({}), []);
  assert.deepEqual(normalizeAreas([]), []);
});
