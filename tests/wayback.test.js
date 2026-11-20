import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tileXY,
  parseReleases,
  metadataLayerForZoom,
  season,
  findDistinctReleases,
  localImagery,
} from '../src/wayback.js';

test('tileXY: known tile for Westminster at z17', () => {
  assert.deepEqual(tileXY(51.5007, -0.1246, 17), { x: 65490, y: 43588 });
});

test('parseReleases: sorts newest first by date in title, converts URL template', () => {
  const r = parseReleases({
    10: { itemTitle: 'World Imagery (Wayback 2014-02-20)', itemURL: 'https://h/tile/10/{level}/{row}/{col}', metadataLayerUrl: 'm10' },
    3692: { itemTitle: 'World Imagery (Wayback 2026-11-18)', itemURL: 'https://h/tile/3692/{level}/{row}/{col}', metadataLayerUrl: 'm3692' },
    64776: { itemTitle: 'World Imagery (Wayback 2023-08-31)', itemURL: 'https://h/tile/64776/{level}/{row}/{col}' },
    bad: { itemTitle: 'no date' },
  });
  assert.deepEqual(r.map((x) => x.release), [3692, 64776, 10]);
  assert.equal(r[0].url, 'https://h/tile/3692/{z}/{y}/{x}');
});

test('metadataLayerForZoom', () => {
  assert.equal(metadataLayerForZoom(19), 4);
  assert.equal(metadataLayerForZoom(23), 0);
  assert.equal(metadataLayerForZoom(5), 13);
});

test('season: hemisphere aware, leaf-off only outside the tropics', () => {
  assert.deepEqual(season(Date.UTC(2024, 0, 15), 51.5), { name: 'Winter', leafOff: true });
  assert.deepEqual(season(Date.UTC(2024, 6, 15), 51.5), { name: 'Summer', leafOff: false });
  assert.deepEqual(season(Date.UTC(2024, 2, 20), 51.5), { name: 'Spring', leafOff: true });
  assert.deepEqual(season(Date.UTC(2024, 6, 15), -37.8), { name: 'Winter', leafOff: true });
  assert.deepEqual(season(Date.UTC(2024, 0, 15), 1.3), { name: 'Winter', leafOff: false });
});

// Fake archive: releases 5 (newest) … 1. Releases 5 and 4 reuse image 4,
// 3 and 2 reuse image 2, release 1 has no imagery for the tile.
const releases = [5, 4, 3, 2, 1].map((n) => ({
  release: n,
  releaseDate: `202${n}-01-01`,
  url: `t/${n}/{z}/{y}/{x}`,
  metadataUrl: `meta${n}`,
}));
const selectMap = { 5: 4, 4: 4, 3: 2, 2: 2 };
function fakeFetch(log = []) {
  return async (url) => {
    log.push(url);
    if (url.includes('waybackconfig')) {
      return Object.fromEntries(releases.map((r) => [r.release, { itemTitle: `W (Wayback ${r.releaseDate})`, itemURL: `t/${r.release}/{level}/{row}/{col}`, metadataLayerUrl: r.metadataUrl }]));
    }
    const tm = url.match(/tilemap\/(\d+)\//);
    if (tm) {
      const rel = Number(tm[1]);
      return selectMap[rel] ? { data: [1], select: [selectMap[rel]] } : { data: [0] };
    }
    const meta = url.match(/meta(\d+)\/(\d+)\/query/);
    if (meta) {
      const rel = Number(meta[1]);
      return { features: [{ attributes: { SRC_DATE2: Date.UTC(2020 + rel, rel === 2 ? 1 : 6, 1), NICE_DESC: 'Sat', SRC_RES: 0.3, SRC_ACC: 5 } }] };
    }
    throw new Error(`unexpected ${url}`);
  };
}

test('findDistinctReleases: jumps over releases that reuse an image', async () => {
  const log = [];
  const found = await findDistinctReleases(releases, 51.5, -0.12, 18, fakeFetch(log));
  assert.deepEqual(found.map((r) => r.release), [4, 2]);
  // asked 5 (→4, skip to 4), then 3 (→2, skip to 2), then 1 (none)
  assert.equal(log.length, 3);
});

test('captureInfoWithRetry: retries a failing metadata service', async () => {
  let calls = 0;
  const flaky = async () => {
    if (++calls < 3) throw new Error('timeout');
    return { features: [{ attributes: { SRC_DATE2: 1, NICE_DESC: 'X' } }] };
  };
  const { captureInfoWithRetry } = await import('../src/wayback.js');
  const info = await captureInfoWithRetry(releases[0], 51.5, -0.12, 19, flaky, 2);
  assert.equal(info.provider, 'X');
  assert.equal(calls, 3);
  await assert.rejects(captureInfoWithRetry(releases[0], 51.5, -0.12, 19, async () => { throw new Error('down'); }, 1));
});

test('localImagery: drops a capture re-published in an older release', async () => {
  // Make release 2 report the same capture as release 4.
  const base = fakeFetch();
  const fetchJson = async (url) => {
    if (/meta2\//.test(url)) return base(url.replace('meta2/', 'meta4/'));
    return base(url);
  };
  const list = await localImagery(48.85, 2.35, 18, { fetchJson });
  assert.deepEqual(list.map((c) => c.release), [4]);
});

test('localImagery: returns captures with dates and seasons', async () => {
  const list = await localImagery(51.5, -0.12, 18, { fetchJson: fakeFetch() });
  assert.equal(list.length, 2);
  assert.equal(list[0].release, 4);
  assert.equal(list[0].season.name, 'Summer');
  assert.equal(list[1].release, 2);
  assert.equal(list[1].season.name, 'Winter');
  assert.equal(list[1].season.leafOff, true);
  assert.equal(list[1].url, 't/2/{z}/{y}/{x}');
});
