// Step-by-step instructions for un-blocking location, tailored to the
// device and browser. Once a site's location permission is denied, browsers
// never prompt again, and the switches are buried in OS/browser settings.

/** Work out OS + browser from the user agent. */
export function detectPlatform(ua = '', maxTouchPoints = 0, platform = '') {
  // iPadOS 13+ pretends to be a Mac; touch support gives it away.
  const ios = /iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const os = ios ? 'ios' : android ? 'android' : 'desktop';
  let browser = 'other';
  if (ios) {
    if (/CriOS/.test(ua)) browser = 'chrome';
    else if (/FxiOS/.test(ua)) browser = 'firefox';
    else if (/EdgiOS/.test(ua)) browser = 'edge';
    else if (/Safari/.test(ua) && !/(GSA|FBAN|FBAV|Instagram)/.test(ua)) browser = 'safari';
  } else if (/SamsungBrowser/.test(ua)) browser = 'samsung';
  else if (/Firefox/.test(ua)) browser = 'firefox';
  else if (/Edg\//.test(ua)) browser = 'edge';
  else if (/Chrome/.test(ua)) browser = 'chrome';
  else if (/Safari/.test(ua)) browser = 'safari';
  return { os, browser };
}

const IOS_BROWSER_NAMES = { chrome: 'Chrome', firefox: 'Firefox', edge: 'Edge' };

/** { title, steps: [string] } — steps may contain <b> markup only. */
export function locationHelp({ os, browser }, host = 'this site') {
  if (os === 'ios') {
    const system = 'Open the <b>Settings</b> app → <b>Privacy &amp; Security</b> → <b>Location Services</b> and make sure it is <b>On</b>.';
    if (browser === 'safari') {
      return {
        title: 'iPhone / iPad – Safari',
        steps: [
          system,
          'In that same list, scroll down to <b>Safari Websites</b>, choose <b>While Using the App</b> and turn on <b>Precise Location</b>.',
          `Back in Safari, tap <b>aA</b> (or the page menu) in the address bar → <b>Website Settings</b> → <b>Location</b> → <b>Allow</b> (or Ask) for ${host}.`,
          'Reload this page and tap <b>Walk the edge</b> again.',
        ],
      };
    }
    const name = IOS_BROWSER_NAMES[browser];
    if (name) {
      return {
        title: `iPhone / iPad – ${name}`,
        steps: [
          system,
          `Go back to the main <b>Settings</b> list, scroll down to <b>${name}</b> → <b>Location</b> → <b>While Using the App</b>, and turn on <b>Precise Location</b>.`,
          `Return to ${name}, reload this page and accept the location prompt.`,
          'Still blocked? Open this page in <b>Safari</b> instead.',
        ],
      };
    }
    return {
      title: 'iPhone / iPad',
      steps: [
        'This looks like an in-app browser, which often can\'t use location. Open the page in <b>Safari</b> (share menu → <b>Open in Safari</b>).',
        system,
        'Then follow the prompt in Safari and choose <b>Allow</b>.',
      ],
    };
  }

  if (os === 'android') {
    const systemOn = 'Make sure the phone\'s location is on: swipe down from the top of the screen and turn on the <b>Location</b> tile.';
    if (browser === 'samsung') {
      return {
        title: 'Android – Samsung Internet',
        steps: [
          systemOn,
          `In Samsung Internet tap <b>≡</b> → <b>Settings</b> → <b>Sites and downloads</b> → <b>Site permissions</b> → <b>Location</b>, find ${host} and allow it.`,
          'Phone <b>Settings</b> → <b>Apps</b> → <b>Samsung Internet</b> → <b>Permissions</b> → <b>Location</b> → <b>Allow only while using the app</b>, with <b>Use precise location</b> on.',
          'Reload this page.',
        ],
      };
    }
    if (browser === 'firefox') {
      return {
        title: 'Android – Firefox',
        steps: [
          systemOn,
          `Tap the <b>lock icon</b> left of the address → <b>Location</b> → allow it for ${host}.`,
          'Phone <b>Settings</b> → <b>Apps</b> → <b>Firefox</b> → <b>Permissions</b> → <b>Location</b> → <b>Allow only while using the app</b>, with <b>Use precise location</b> on.',
          'Reload this page.',
        ],
      };
    }
    return {
      title: `Android – ${browser === 'edge' ? 'Edge' : 'Chrome'}`,
      steps: [
        systemOn,
        'Tap the icon left of the web address (a <b>lock</b> or <b>sliders</b> icon) → <b>Permissions</b> → <b>Location</b> → <b>Allow</b>.',
        `No Permissions entry? Tap <b>⋮</b> → <b>Settings</b> → <b>Site settings</b> → <b>Location</b>, find ${host} under <b>Blocked</b> and change it to <b>Allow</b>.`,
        'Still blocked? Phone <b>Settings</b> → <b>Apps</b> → <b>Chrome</b> → <b>Permissions</b> → <b>Location</b> → <b>Allow only while using the app</b>, with <b>Use precise location</b> on.',
        'Reload this page.',
      ],
    };
  }

  return {
    title: 'Computer',
    steps: [
      'Click the icon left of the web address (lock / sliders) → <b>Location</b> → <b>Allow</b>.',
      'On a Mac, also check <b>System Settings</b> → <b>Privacy &amp; Security</b> → <b>Location Services</b> is on for your browser. On Windows: <b>Settings</b> → <b>Privacy &amp; security</b> → <b>Location</b>.',
      'Reload this page. (Walking the edge works best on a phone.)',
    ],
  };
}
