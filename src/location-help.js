// Step-by-step instructions for un-blocking location, tailored to the
// device and browser, in English or French. Once a site's location
// permission is denied, browsers never prompt again, and the switches are
// buried in OS/browser settings (whose menu names differ per language).

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

// Each entry builds { title, steps } for one platform; steps may contain <b> only.
const TEXT = {
  en: {
    iosSystem: 'Open the <b>Settings</b> app → <b>Privacy &amp; Security</b> → <b>Location Services</b> and make sure it is <b>On</b>.',
    iosSafari: (host) => ({
      title: 'iPhone / iPad – Safari',
      steps: [
        'In that same list, scroll down to <b>Safari Websites</b>, choose <b>While Using the App</b> and turn on <b>Precise Location</b>.',
        `Back in Safari, tap <b>aA</b> (or the page menu) in the address bar → <b>Website Settings</b> → <b>Location</b> → <b>Allow</b> (or Ask) for ${host}.`,
        'Reload this page and tap <b>Walk the edge</b> again.',
      ],
    }),
    iosOtherBrowser: (name) => ({
      title: `iPhone / iPad – ${name}`,
      steps: [
        `Go back to the main <b>Settings</b> list, scroll down to <b>${name}</b> → <b>Location</b> → <b>While Using the App</b>, and turn on <b>Precise Location</b>.`,
        `Return to ${name}, reload this page and accept the location prompt.`,
        'Still blocked? Open this page in <b>Safari</b> instead.',
      ],
    }),
    iosInApp: {
      title: 'iPhone / iPad',
      first: "This looks like an in-app browser, which often can't use location. Open the page in <b>Safari</b> (share menu → <b>Open in Safari</b>).",
      last: 'Then follow the prompt in Safari and choose <b>Allow</b>.',
    },
    androidOn: "Make sure the phone's location is on: swipe down from the top of the screen and turn on the <b>Location</b> tile.",
    reload: 'Reload this page.',
    samsung: (host) => ({
      title: 'Android – Samsung Internet',
      steps: [
        `In Samsung Internet tap <b>≡</b> → <b>Settings</b> → <b>Sites and downloads</b> → <b>Site permissions</b> → <b>Location</b>, find ${host} and allow it.`,
        'Phone <b>Settings</b> → <b>Apps</b> → <b>Samsung Internet</b> → <b>Permissions</b> → <b>Location</b> → <b>Allow only while using the app</b>, with <b>Use precise location</b> on.',
      ],
    }),
    androidFirefox: (host) => ({
      title: 'Android – Firefox',
      steps: [
        `Tap the <b>lock icon</b> left of the address → <b>Location</b> → allow it for ${host}.`,
        'Phone <b>Settings</b> → <b>Apps</b> → <b>Firefox</b> → <b>Permissions</b> → <b>Location</b> → <b>Allow only while using the app</b>, with <b>Use precise location</b> on.',
      ],
    }),
    androidChrome: (host, name) => ({
      title: `Android – ${name}`,
      steps: [
        'Tap the icon left of the web address (a <b>lock</b> or <b>sliders</b> icon) → <b>Permissions</b> → <b>Location</b> → <b>Allow</b>.',
        `No Permissions entry? Tap <b>⋮</b> → <b>Settings</b> → <b>Site settings</b> → <b>Location</b>, find ${host} under <b>Blocked</b> and change it to <b>Allow</b>.`,
        `Still blocked? Phone <b>Settings</b> → <b>Apps</b> → <b>${name}</b> → <b>Permissions</b> → <b>Location</b> → <b>Allow only while using the app</b>, with <b>Use precise location</b> on.`,
      ],
    }),
    desktop: {
      title: 'Computer',
      steps: [
        'Click the icon left of the web address (lock / sliders) → <b>Location</b> → <b>Allow</b>.',
        'On a Mac, also check <b>System Settings</b> → <b>Privacy &amp; Security</b> → <b>Location Services</b> is on for your browser. On Windows: <b>Settings</b> → <b>Privacy &amp; security</b> → <b>Location</b>.',
        'Reload this page. (Walking the edge works best on a phone.)',
      ],
    },
  },
  fr: {
    iosSystem: 'Ouvrez l’app <b>Réglages</b> → <b>Confidentialité et sécurité</b> → <b>Service de localisation</b> et vérifiez qu’il est <b>activé</b>.',
    iosSafari: (host) => ({
      title: 'iPhone / iPad – Safari',
      steps: [
        'Dans cette même liste, descendez jusqu’à <b>Sites web Safari</b>, choisissez <b>Lorsque l’app est active</b> et activez <b>Position exacte</b>.',
        `De retour dans Safari, touchez <b>aA</b> (ou le menu de la page) dans la barre d’adresse → <b>Réglages du site web</b> → <b>Position</b> → <b>Autoriser</b> (ou Demander) pour ${host}.`,
        'Rechargez cette page et touchez de nouveau <b>Parcourir</b>.',
      ],
    }),
    iosOtherBrowser: (name) => ({
      title: `iPhone / iPad – ${name}`,
      steps: [
        `Revenez à la liste principale des <b>Réglages</b>, descendez jusqu’à <b>${name}</b> → <b>Position</b> → <b>Lorsque l’app est active</b>, et activez <b>Position exacte</b>.`,
        `Retournez dans ${name}, rechargez cette page et acceptez la demande de localisation.`,
        'Toujours bloqué ? Ouvrez plutôt cette page dans <b>Safari</b>.',
      ],
    }),
    iosInApp: {
      title: 'iPhone / iPad',
      first: 'Cette page semble ouverte dans le navigateur d’une app, qui ne peut souvent pas utiliser la localisation. Ouvrez-la dans <b>Safari</b> (menu partager → <b>Ouvrir dans Safari</b>).',
      last: 'Ensuite, dans Safari, répondez <b>Autoriser</b> à la demande.',
    },
    androidOn: 'Vérifiez que la localisation du téléphone est activée : balayez l’écran vers le bas depuis le haut et activez la vignette <b>Localisation</b>.',
    reload: 'Rechargez cette page.',
    samsung: (host) => ({
      title: 'Android – Samsung Internet',
      steps: [
        `Dans Samsung Internet, touchez <b>≡</b> → <b>Paramètres</b> → <b>Sites et téléchargements</b> → <b>Autorisations du site</b> → <b>Position</b>, trouvez ${host} et autorisez-le.`,
        '<b>Paramètres</b> du téléphone → <b>Applications</b> → <b>Samsung Internet</b> → <b>Autorisations</b> → <b>Position</b> → <b>Autoriser uniquement pendant l’utilisation</b>, avec <b>Utiliser la position exacte</b> activé.',
      ],
    }),
    androidFirefox: (host) => ({
      title: 'Android – Firefox',
      steps: [
        `Touchez l’<b>icône de cadenas</b> à gauche de l’adresse → <b>Position</b> → autorisez-la pour ${host}.`,
        '<b>Paramètres</b> du téléphone → <b>Applications</b> → <b>Firefox</b> → <b>Autorisations</b> → <b>Position</b> → <b>Autoriser uniquement pendant l’utilisation</b>, avec <b>Utiliser la position exacte</b> activé.',
      ],
    }),
    androidChrome: (host, name) => ({
      title: `Android – ${name}`,
      steps: [
        'Touchez l’icône à gauche de l’adresse web (un <b>cadenas</b> ou des <b>curseurs</b>) → <b>Autorisations</b> → <b>Position</b> → <b>Autoriser</b>.',
        `Pas d’entrée Autorisations ? Touchez <b>⋮</b> → <b>Paramètres</b> → <b>Paramètres des sites</b> → <b>Position</b>, trouvez ${host} sous <b>Bloqués</b> et passez-le à <b>Autoriser</b>.`,
        `Toujours bloqué ? <b>Paramètres</b> du téléphone → <b>Applications</b> → <b>${name}</b> → <b>Autorisations</b> → <b>Position</b> → <b>Autoriser uniquement pendant l’utilisation</b>, avec <b>Utiliser la position exacte</b> activé.`,
      ],
    }),
    desktop: {
      title: 'Ordinateur',
      steps: [
        'Cliquez sur l’icône à gauche de l’adresse web (cadenas / curseurs) → <b>Position</b> → <b>Autoriser</b>.',
        'Sur Mac, vérifiez aussi <b>Réglages Système</b> → <b>Confidentialité et sécurité</b> → <b>Service de localisation</b> pour votre navigateur. Sous Windows : <b>Paramètres</b> → <b>Confidentialité et sécurité</b> → <b>Localisation</b>.',
        'Rechargez cette page. (Parcourir le bord fonctionne mieux sur téléphone.)',
      ],
    },
  },
};

/** { title, steps: [string] } — steps may contain <b> markup only. */
export function locationHelp({ os, browser }, host = 'this site', lang = 'en') {
  const T = TEXT[lang] ?? TEXT.en;
  if (os === 'ios') {
    if (browser === 'safari') {
      const s = T.iosSafari(host);
      return { title: s.title, steps: [T.iosSystem, ...s.steps] };
    }
    const name = IOS_BROWSER_NAMES[browser];
    if (name) {
      const s = T.iosOtherBrowser(name);
      return { title: s.title, steps: [T.iosSystem, ...s.steps] };
    }
    return { title: T.iosInApp.title, steps: [T.iosInApp.first, T.iosSystem, T.iosInApp.last] };
  }
  if (os === 'android') {
    const s =
      browser === 'samsung'
        ? T.samsung(host)
        : browser === 'firefox'
          ? T.androidFirefox(host)
          : T.androidChrome(host, browser === 'edge' ? 'Edge' : 'Chrome');
    return { title: s.title, steps: [T.androidOn, ...s.steps, T.reload] };
  }
  return { title: T.desktop.title, steps: [...T.desktop.steps] };
}
