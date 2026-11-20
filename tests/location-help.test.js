import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPlatform, locationHelp } from '../src/location-help.js';

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  iphoneGmailApp: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  ipadDesktopMode: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

test('detectPlatform', () => {
  assert.deepEqual(detectPlatform(UA.iphoneSafari), { os: 'ios', browser: 'safari' });
  assert.deepEqual(detectPlatform(UA.iphoneChrome), { os: 'ios', browser: 'chrome' });
  assert.deepEqual(detectPlatform(UA.iphoneGmailApp), { os: 'ios', browser: 'other' });
  assert.deepEqual(detectPlatform(UA.ipadDesktopMode, 5, 'MacIntel'), { os: 'ios', browser: 'safari' });
  assert.deepEqual(detectPlatform(UA.androidChrome), { os: 'android', browser: 'chrome' });
  assert.deepEqual(detectPlatform(UA.samsung), { os: 'android', browser: 'samsung' });
  assert.deepEqual(detectPlatform(UA.macChrome, 0, 'MacIntel'), { os: 'desktop', browser: 'chrome' });
});

test('locationHelp: tailored steps, Safari mentions Safari Websites and aA', () => {
  const s = locationHelp({ os: 'ios', browser: 'safari' }, 'kodinga.github.io');
  assert.match(s.title, /Safari/);
  assert.ok(s.steps.some((x) => x.includes('Safari Websites')));
  assert.ok(s.steps.some((x) => x.includes('aA') && x.includes('kodinga.github.io')));
  assert.match(locationHelp({ os: 'ios', browser: 'chrome' }).steps.join(' '), /Chrome<\/b> → <b>Location/);
  assert.match(locationHelp({ os: 'ios', browser: 'other' }).steps[0], /Open in Safari/);
  assert.match(locationHelp({ os: 'android', browser: 'chrome' }).steps.join(' '), /Site settings/);
  assert.match(locationHelp({ os: 'android', browser: 'samsung' }).title, /Samsung/);
  assert.match(locationHelp({ os: 'desktop', browser: 'chrome' }).title, /Computer/);
});
