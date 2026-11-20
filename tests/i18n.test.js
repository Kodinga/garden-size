import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectLang, setLang, t, numberLocale, _dicts } from '../src/i18n.js';
import { locationHelp } from '../src/location-help.js';
import { formatArea } from '../src/geometry.js';

test('detectLang: URL beats saved preference beats browser', () => {
  assert.equal(detectLang({ search: '?lang=fr', saved: 'en', navigatorLanguages: ['en-GB'] }), 'fr');
  assert.equal(detectLang({ search: '?lang=xx', saved: 'fr', navigatorLanguages: ['en-GB'] }), 'fr');
  assert.equal(detectLang({ navigatorLanguages: ['fr-BE', 'en'] }), 'fr');
  assert.equal(detectLang({ navigatorLanguages: ['de-DE', 'fr-FR'] }), 'fr');
  assert.equal(detectLang({ navigatorLanguages: ['de-DE'] }), 'en');
  assert.equal(detectLang(), 'en');
});

test('every key exists in both languages, with the same kind of value', () => {
  const en = Object.keys(_dicts.en).sort();
  const fr = Object.keys(_dicts.fr).sort();
  assert.deepEqual(fr.filter((k) => !en.includes(k)), [], 'keys only in fr');
  assert.deepEqual(en.filter((k) => !fr.includes(k)), [], 'keys missing from fr');
  for (const k of en) assert.equal(typeof _dicts.fr[k], typeof _dicts.en[k], k);
});

test('t: plurals and parameters', () => {
  setLang('en');
  assert.equal(t('stats.points', { n: 1 }), '1 point');
  assert.equal(t('stats.points', { n: 2 }), '2 points');
  assert.equal(t('nope'), 'nope');
  setLang('fr');
  assert.equal(t('stats.points', { n: 0 }), '0 point');
  assert.equal(t('stats.points', { n: 1 }), '1 point');
  assert.equal(t('stats.points', { n: 3 }), '3 points');
  assert.equal(t('parcel.name', { label: 'BY 88' }), 'Parcelle BY 88');
  assert.equal(t('stats.perimeter', { name: 'Zone 1', p: '12 m' }), 'Zone 1 : périmètre 12 m');
  assert.equal(numberLocale(), 'fr-FR');
  setLang('en');
});

test('French number formatting', () => {
  const f = formatArea(1234.5, 'metric', 'fr-FR');
  assert.match(f.main, /^1\s1235 m²$|^1 235 m²$|^1 235 m²$/);
  assert.match(formatArea(12.34, 'metric', 'fr-FR').main, /^12,3 m²$/);
});

test('locationHelp in French uses French menu names', () => {
  const ios = locationHelp({ os: 'ios', browser: 'safari' }, 'kodinga.github.io', 'fr');
  assert.match(ios.steps.join(' '), /Réglages.*Service de localisation/);
  assert.match(ios.steps.join(' '), /Sites web Safari/);
  const android = locationHelp({ os: 'android', browser: 'chrome' }, 'x', 'fr');
  assert.match(android.steps.join(' '), /Paramètres des sites/);
  assert.equal(locationHelp({ os: 'desktop', browser: 'chrome' }, 'x', 'fr').title, 'Ordinateur');
  // Same number of steps as English for each platform.
  for (const p of [{ os: 'ios', browser: 'safari' }, { os: 'ios', browser: 'chrome' }, { os: 'ios', browser: 'other' }, { os: 'android', browser: 'samsung' }]) {
    assert.equal(locationHelp(p, 'x', 'fr').steps.length, locationHelp(p, 'x', 'en').steps.length);
  }
});
