import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distance,
  polygonArea,
  perimeter,
  simplify,
  isSelfIntersecting,
  weightedAverage,
  shouldAddTracePoint,
  areaUncertainty,
  formatArea,
  formatLength,
  projector,
  summarizeAreas,
} from '../src/geometry.js';

// Build a rectangle of w × h metres around a given lat/lng.
function rect(lat, lng, w, h) {
  const { fromXY } = projector({ lat, lng });
  return [
    fromXY({ x: 0, y: 0 }),
    fromXY({ x: w, y: 0 }),
    fromXY({ x: w, y: h }),
    fromXY({ x: 0, y: h }),
  ];
}

const close = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ''} expected ${expected} ± ${tol}, got ${actual}`);

test('distance: one degree of latitude ≈ 111.2 km', () => {
  close(distance({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }), 111195, 5);
});

test('polygonArea: 20 m × 10 m garden in London is 200 m²', () => {
  close(polygonArea(rect(51.5, -0.12, 20, 10)), 200, 0.1);
});

test('polygonArea: works at high latitude and is orientation independent', () => {
  const r = rect(64.1, -21.9, 35, 12);
  close(polygonArea(r), 420, 0.2);
  close(polygonArea([...r].reverse()), 420, 0.2);
});

test('polygonArea: fewer than 3 points is 0', () => {
  assert.equal(polygonArea([]), 0);
  assert.equal(polygonArea([{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }]), 0);
});

test('polygonArea: L-shaped garden', () => {
  const { fromXY } = projector({ lat: 48.85, lng: 2.35 });
  const L = [
    [0, 0], [20, 0], [20, 8], [8, 8], [8, 15], [0, 15],
  ].map(([x, y]) => fromXY({ x, y }));
  close(polygonArea(L), 20 * 8 + 8 * 7, 0.1);
});

test('perimeter: closed and open', () => {
  const r = rect(51.5, -0.12, 20, 10);
  close(perimeter(r), 60, 0.05);
  close(perimeter(r, false), 50, 0.05); // 20 + 10 + 20, no closing edge
});

test('simplify: removes jitter along a straight edge but keeps corners', () => {
  const { fromXY } = projector({ lat: 51.5, lng: -0.12 });
  const path = [];
  for (let x = 0; x <= 20; x++) path.push(fromXY({ x, y: (x % 2 ? 0.2 : -0.2) }));
  for (let y = 1; y <= 10; y++) path.push(fromXY({ x: 20 + (y % 2 ? 0.2 : -0.2), y }));
  const s = simplify(path, 0.75);
  assert.equal(s.length, 3, 'start, corner, end');
  assert.equal(s[0], path[0]);
  assert.equal(s[s.length - 1], path[path.length - 1]);
});

test('isSelfIntersecting: bow-tie vs rectangle', () => {
  const [a, b, c, d] = rect(51.5, -0.12, 20, 10);
  assert.equal(isSelfIntersecting([a, b, c, d]), false);
  assert.equal(isSelfIntersecting([a, c, b, d]), true);
});

test('weightedAverage: favours the more accurate fix', () => {
  const avg = weightedAverage([
    { lat: 0, lng: 0, acc: 2 },
    { lat: 0.001, lng: 0.001, acc: 20 },
  ]);
  assert.ok(avg.lat < 0.00002 && avg.lng < 0.00002);
  assert.ok(avg.acc >= 2 && avg.acc < 3);
  assert.equal(weightedAverage([]), null);
});

test('shouldAddTracePoint: rejects inaccurate and stationary fixes', () => {
  const origin = { lat: 51.5, lng: -0.12, acc: 4 };
  const { fromXY } = projector(origin);
  const near = { ...fromXY({ x: 1, y: 0 }), acc: 4 };
  const far = { ...fromXY({ x: 3, y: 0 }), acc: 4 };
  assert.equal(shouldAddTracePoint(null, origin), true);
  assert.equal(shouldAddTracePoint(null, { ...origin, acc: 40 }), false);
  assert.equal(shouldAddTracePoint(origin, near), false, '1 m < acc/2 = 2 m');
  assert.equal(shouldAddTracePoint(origin, far), true);
  assert.equal(shouldAddTracePoint(origin, { lat: NaN, lng: 0, acc: 1 }), false);
});

test('areaUncertainty: error propagation, null without accuracy', () => {
  const sq = rect(51.5, -0.12, 20, 20);
  assert.equal(areaUncertainty(sq), null);
  // 20 m square, σ = 3 m: each |p(i+1) − p(i−1)|² = 800 → σ_A = sqrt(4 · 9 · 800 / 4) ≈ 84.9
  close(areaUncertainty(sq.map((p) => ({ ...p, acc: 3 }))), Math.sqrt(7200), 0.1);
});

test('summarizeAreas: adds areas, subtracts excluded ones, combines uncertainty', () => {
  const lawn = rect(51.5, -0.12, 20, 10); // 200
  const bed = rect(51.5005, -0.12, 5, 4); // 20, elsewhere
  const shed = rect(51.50001, -0.11998, 3, 2); // 6, inside the lawn
  const s = summarizeAreas([
    { vertices: lawn },
    { vertices: bed },
    { vertices: shed, subtract: true },
    { vertices: [] },
  ]);
  close(s.total, 214, 0.1);
  assert.equal(s.items.length, 4);
  close(s.items[2].area, 6, 0.01);
  assert.equal(s.items[3].area, 0);
  assert.equal(s.uncertainty, null, 'no GPS accuracy → no uncertainty');

  const gpsSq = rect(51.5, -0.12, 20, 20).map((p) => ({ ...p, acc: 3 }));
  const two = summarizeAreas([{ vertices: gpsSq }, { vertices: gpsSq }]);
  close(two.uncertainty, Math.sqrt(2 * 7200), 0.1);
});

test('summarizeAreas: total never goes negative', () => {
  const s = summarizeAreas([{ vertices: rect(0, 0, 10, 10), subtract: true }]);
  assert.equal(s.total, 0);
});

test('formatting', () => {
  assert.deepEqual(formatArea(200, 'metric'), { main: '200 m²', sub: '0.02 ha · 2,153 ft²' });
  assert.equal(formatArea(4046.8564224, 'imperial').sub.startsWith('1 acres'), true);
  assert.equal(formatLength(12.34, 'metric'), '12.3 m');
  assert.equal(formatLength(10, 'imperial'), '33 ft');
});
