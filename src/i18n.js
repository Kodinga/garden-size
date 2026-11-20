// English / French UI strings. `t(key, params)` looks a key up in the current
// language (falling back to English); values are strings with {placeholders}
// or functions of the params (for plurals and word order).
//
// Static text in index.html is marked with data-i18n attributes:
//   data-i18n="key"             → textContent
//   data-i18n-html="key"        → innerHTML (only for our own trusted strings)
//   data-i18n-title="key"       → title + aria-label
//   data-i18n-placeholder="key" → placeholder

export const LANGS = ['en', 'fr'];

const plural = (n, word, pluralWord = `${word}s`) => (n === 1 ? word : pluralWord);
const pluralFr = (n, word, pluralWord = `${word}s`) => (n <= 1 ? word : pluralWord);

const en = {
  'app.title': 'Garden Size',
  'app.description': "Measure the area of your garden by walking its edge with your phone's GPS, drawing it on a satellite map, or (in France) from the cadastre.",
  locate: 'Centre on my location',
  'imagery.btn': 'Imagery dates: find older photos, e.g. winter without leaves',
  'imagery.older': 'Older imagery',
  'imagery.newer': 'Newer imagery',
  'imagery.close': 'Back to latest imagery',
  'imagery.select': 'Imagery date',
  'help.retry': 'Try again',
  'help.reload': 'Reload page',
  'help.close': 'Close',
  'help.noGps': 'You can still measure without GPS: use <b>Draw on map</b>.',
  'start.hint': "Walk or draw your garden's edge",
  'areas.add': '＋ New area',
  'areas.aria': 'Areas',
  'mode.walk': '🚶 Walk the edge',
  'mode.draw': '✏️ Draw on map',
  'mode.parcel': '🏠 Parcel',
  'gps.off': 'GPS off',
  'walk.corner': '📍 Mark corner',
  'walk.traceStart': '〰️ Start tracing',
  'walk.traceStop': '■ Stop tracing',
  'walk.hint':
    '<strong>Straight edges:</strong> stand on each corner and tap <em>Mark corner</em> (averages 5&nbsp;s of GPS). ' +
    '<strong>Curvy edges:</strong> tap <em>Start tracing</em> and walk slowly along the edge. ' +
    'You can mix both, and drag points afterwards to fix them against the satellite image. Points go into the selected area.',
  'draw.hint':
    'Tap the map to add corners to the selected area. Drag a point to move it, drag a small midpoint to insert one, double-tap a point to delete it.',
  'draw.trees':
    '<strong>Trees hiding the boundary?</strong> Tap the 🗓 button on the map to flip through older photos. ' +
    'Winter ones (🍂) often show fences and hedges under bare trees. In France, also try the <em>Parcel</em> mode.',
  'parcel.hint':
    'Tap your parcel on the map to add its <strong>official cadastre outline</strong> as an area. ' +
    'The orange lines are parcel boundaries (IGN cadastre, France only). ' +
    'The cadastre is a tax record, not a survey: the real boundary can differ slightly.',
  undo: '↶ Undo',
  'undo.title': 'Undo (Ctrl+Z / ⌘Z)',
  clear: '✕ Clear all',
  'clear.confirm': 'Tap again to clear all',
  export: '⇩ GeoJSON',
  'save.placeholder': 'Name this garden',
  save: '💾 Save',
  'saved.title': 'Saved gardens',
  units: 'Units',
  'units.metric': 'Metric (m²)',
  'units.imperial': 'Imperial (ft²)',
  lang: 'Language',
  privacy: 'Data stays on this device.',

  'area.default': ({ n }) => `Area ${n}`,
  'area.added': ({ name, mode }) => `${name} added — ${mode === 'walk' ? 'mark its corners' : 'tap the map to draw it'}`,
  'area.nameAria': 'Area name',
  'area.untitled': 'Untitled',
  'area.subtracted': 'Subtracted from total (e.g. shed, patio). Tap to add instead.',
  'area.counted': 'Added to total. Tap to subtract it instead (e.g. shed, patio).',
  'area.clear': 'Clear this area',
  'area.delete': 'Delete this area',
  sure: 'Sure?',

  'stats.total': ({ n }) => `Total of ${n} areas`,
  'stats.more': ({ n }) => `Add ${n} more ${plural(n, 'point')}`,
  'stats.perimeter': ({ name, p }) => `${name}: perimeter ${p}`,
  'stats.points': ({ n }) => `${n} ${plural(n, 'point')}`,
  'stats.pts': ({ n }) => `${n} pts`,
  'stats.cadastre': ({ a }) => `official (cadastre): ${a}`,
  'stats.uncertainty': ({ a }) => `GPS uncertainty ≈ ±${a} — drag points onto the imagery to refine`,
  'stats.tangled': ({ names, n }) =>
    `${names} ${n > 1 ? 'cross themselves' : 'crosses itself'}, so its area is wrong. Drag or delete points to untangle it.`,

  'gps.approx': ({ acc }) => `Approximate location only (±${acc} m) — Precise Location is off`,
  'gps.status': ({ acc, label }) => `GPS ±${acc} m (${label})`,
  'gps.good': 'good',
  'gps.fair': 'fair',
  'gps.poor': 'poor — wait or move into the open',
  'gps.blocked': 'Location is blocked for this site',
  'gps.unavailable': 'Location unavailable. Check location is switched on, and try outdoors.',
  'gps.waiting': 'Waiting for GPS…',
  'gps.starting': 'Starting GPS…',
  'gps.noFix': 'No GPS fix received. Are you outdoors with location enabled?',
  'gps.unsupported': 'This browser has no GPS / geolocation support.',
  'gps.https': 'GPS needs HTTPS (or localhost). Open this page over https://',

  'help.btnApprox': 'How do I turn on precise location?',
  'help.btnDenied': 'How do I allow location?',
  'help.titleApprox': 'Precise location is off',
  'help.titleDenied': 'Location is blocked',
  'help.subApprox': ({ p }) =>
    `Your phone is only sharing an approximate position, which is far too rough to measure a garden. Steps for ${p}:`,
  'help.subDenied': ({ p }) => `Your browser has blocked location for this site and won't ask again by itself. Steps for ${p}:`,

  'trace.toast': ({ name }) => `Tracing ${name} — walk slowly along the edge`,
  'trace.added': ({ n, raw }) => `Added ${n} points (from ${raw} GPS fixes)`,
  'corner.hold': ({ s, n }) => `Hold still… ${s}s (${n})`,
  'corner.weak': ({ acc }) => `Corner added but GPS is weak (±${acc} m). Drag it to fix.`,
  'corner.added': ({ name, n, acc, k }) => `${name}: corner ${n} added (±${acc} m, ${k} readings)`,

  'saved.areas': ({ n }) => `${n} areas`,
  'saved.open': 'Open',
  'saved.delete': 'Delete',
  'undo.nothing': 'Nothing to undo',
  'garden.default': ({ date }) => `Garden ${date}`,
  'save.done': ({ name }) => `Saved “${name}”`,
  'save.failed': 'Could not save: browser storage is unavailable',
  'geo.unsupported': 'Geolocation is not supported here',
  'geo.finding': 'Finding you…',
  'geo.failed': 'Could not get your location',

  'imagery.zoomIn': 'Zoom in to your garden first, then tap 🗓',
  'imagery.looking': 'Looking for older photos of this spot…',
  'imagery.lookingN': ({ n }) => `Looking for older photos… ${n} found`,
  'imagery.error': ({ msg }) => `Could not reach the imagery archive (${msg})`,
  'imagery.none': 'No archive imagery found for this spot',
  'imagery.published': ({ latest, date }) => `${latest ? 'Latest' : 'Photo'}, published ${date}`,
  'imagery.dateLoading': 'date loading…',
  'imagery.count': ({ n }) => `${n} photos of this spot. Use ◀ ▶ to flip through them (loading dates…)`,
  'imagery.showingLeafOff': ({ date, n }) => `Showing ${date} (leaf-off 🍂). ${n} photos — ◀ ▶ to compare.`,
  'imagery.noLeafOff': ({ n }) => `${n} photos here, none from the leaf-off season.`,
  'imagery.attribution': 'Archive imagery: Esri World Imagery Wayback',
  'season.Winter': 'Winter',
  'season.Spring': 'Spring',
  'season.Summer': 'Summer',
  'season.Autumn': 'Autumn',

  'layer.satellite': 'Satellite (Esri)',
  'layer.ign': 'Aerial photo IGN (France)',
  'layer.streets': 'Streets',
  'layer.cadastre': 'Cadastre (France)',

  'parcel.outside': 'The cadastre is only available in France',
  'parcel.zoomIn': 'Zoom in closer to pick a parcel',
  'parcel.loading': 'Looking up the parcel…',
  'parcel.none': 'No parcel here (roads and public land are not in the cadastre)',
  'parcel.error': ({ msg }) => `Could not reach the cadastre service (${msg})`,
  'parcel.name': ({ label }) => `Parcel ${label}`,
  'parcel.added': ({ label, commune, area }) => `Parcel ${label}${commune ? ` (${commune})` : ''} added — official area ${area}`,
  'parcel.already': ({ name }) => `${name} is already in your list`,

  'search.placeholder': 'Search an address',
  'search.label': 'Search an address',
  'search.searching': 'Searching…',
  'search.none': 'No address found',
  'search.failed': 'Address search failed, check your connection',
  'search.worldwide': 'Press Enter to search worldwide',
  'search.creditFr': 'Addresses: IGN / BAN',
  'search.creditOsm': 'Addresses: © OpenStreetMap',

  'boot.restored': 'Restored your last outline',
  'boot.start': 'Choose “Walk the edge” or “Draw on map” to start',
  'boot.startFr': 'Choose “Walk the edge”, “Draw on map” or “Parcel” to start',
};

const fr = {
  'app.title': 'Surface du jardin',
  'app.description':
    'Mesurez la surface de votre jardin en parcourant son contour avec le GPS de votre téléphone, en le dessinant sur une photo aérienne ou à partir du cadastre.',
  locate: 'Centrer sur ma position',
  'imagery.btn': 'Dates des photos : trouver d’anciennes photos, par ex. en hiver sans feuilles',
  'imagery.older': 'Photo plus ancienne',
  'imagery.newer': 'Photo plus récente',
  'imagery.close': 'Revenir à la photo actuelle',
  'imagery.select': 'Date de la photo',
  'help.retry': 'Réessayer',
  'help.reload': 'Recharger la page',
  'help.close': 'Fermer',
  'help.noGps': 'Vous pouvez mesurer sans GPS : utilisez <b>Dessiner</b> ou <b>Cadastre</b>.',
  'start.hint': 'Parcourez, dessinez ou choisissez le contour de votre jardin',
  'areas.add': '＋ Nouvelle zone',
  'areas.aria': 'Zones',
  'mode.walk': '🚶 Parcourir',
  'mode.draw': '✏️ Dessiner',
  'mode.parcel': '🏠 Cadastre',
  'gps.off': 'GPS désactivé',
  'walk.corner': '📍 Marquer un angle',
  'walk.traceStart': '〰️ Tracer',
  'walk.traceStop': '■ Arrêter le tracé',
  'walk.hint':
    '<strong>Bords droits :</strong> placez-vous sur chaque angle et touchez <em>Marquer un angle</em> (moyenne de 5&nbsp;s de GPS). ' +
    '<strong>Bords courbes :</strong> touchez <em>Tracer</em> et marchez lentement le long du bord. ' +
    'Vous pouvez combiner les deux, puis déplacer les points pour les caler sur la photo. Les points vont dans la zone sélectionnée.',
  'draw.hint':
    'Touchez la carte pour ajouter des angles à la zone sélectionnée. Faites glisser un point pour le déplacer, un petit point milieu pour en insérer un ; touchez deux fois un point pour le supprimer.',
  'draw.trees':
    '<strong>Des arbres cachent la limite ?</strong> Touchez le bouton 🗓 sur la carte pour parcourir d’anciennes photos. ' +
    'Celles d’hiver (🍂) montrent souvent clôtures et haies sous les arbres nus. Essayez aussi le mode <em>Cadastre</em>.',
  'parcel.hint':
    'Touchez votre parcelle sur la carte pour l’ajouter comme zone, avec son <strong>contour cadastral officiel</strong>. ' +
    'Les traits orange sont les limites des parcelles (cadastre IGN). ' +
    'Le cadastre n’a qu’une valeur fiscale, pas de bornage : la limite réelle peut légèrement différer.',
  undo: '↶ Annuler',
  'undo.title': 'Annuler (Ctrl+Z / ⌘Z)',
  clear: '✕ Tout effacer',
  'clear.confirm': 'Touchez encore pour tout effacer',
  export: '⇩ GeoJSON',
  'save.placeholder': 'Nom du jardin',
  save: '💾 Enregistrer',
  'saved.title': 'Jardins enregistrés',
  units: 'Unités',
  'units.metric': 'Métrique (m²)',
  'units.imperial': 'Impérial (ft²)',
  lang: 'Langue',
  privacy: 'Les données restent sur cet appareil.',

  'area.default': ({ n }) => `Zone ${n}`,
  'area.added': ({ name, mode }) =>
    `${name} ajoutée — ${mode === 'walk' ? 'marquez ses angles' : mode === 'parcel' ? 'touchez une parcelle' : 'touchez la carte pour la dessiner'}`,
  'area.nameAria': 'Nom de la zone',
  'area.untitled': 'Sans nom',
  'area.subtracted': 'Déduite du total (ex. abri, terrasse). Touchez pour l’ajouter.',
  'area.counted': 'Comptée dans le total. Touchez pour la déduire (ex. abri, terrasse).',
  'area.clear': 'Vider cette zone',
  'area.delete': 'Supprimer cette zone',
  sure: 'Sûr ?',

  'stats.total': ({ n }) => `Total de ${n} zones`,
  'stats.more': ({ n }) => `Ajoutez encore ${n} ${pluralFr(n, 'point')}`,
  'stats.perimeter': ({ name, p }) => `${name} : périmètre ${p}`,
  'stats.points': ({ n }) => `${n} ${pluralFr(n, 'point')}`,
  'stats.pts': ({ n }) => `${n} pts`,
  'stats.cadastre': ({ a }) => `contenance cadastrale : ${a}`,
  'stats.uncertainty': ({ a }) => `Incertitude GPS ≈ ±${a} — déplacez les points sur la photo pour affiner`,
  'stats.tangled': ({ names, n }) =>
    `${names} ${n > 1 ? 'se croisent' : 'se croise'} : la surface est fausse. Déplacez ou supprimez des points pour démêler le contour.`,

  'gps.approx': ({ acc }) => `Position approximative seulement (±${acc} m) — la position exacte est désactivée`,
  'gps.status': ({ acc, label }) => `GPS ±${acc} m (${label})`,
  'gps.good': 'bon',
  'gps.fair': 'moyen',
  'gps.poor': 'faible — patientez ou allez à découvert',
  'gps.blocked': 'La localisation est bloquée pour ce site',
  'gps.unavailable': 'Position indisponible. Vérifiez que la localisation est activée et essayez à l’extérieur.',
  'gps.waiting': 'En attente du GPS…',
  'gps.starting': 'Démarrage du GPS…',
  'gps.noFix': 'Aucune position GPS reçue. Êtes-vous à l’extérieur, avec la localisation activée ?',
  'gps.unsupported': 'Ce navigateur ne gère pas la géolocalisation.',
  'gps.https': 'Le GPS nécessite HTTPS (ou localhost). Ouvrez cette page en https://',

  'help.btnApprox': 'Comment activer la position exacte ?',
  'help.btnDenied': 'Comment autoriser la localisation ?',
  'help.titleApprox': 'La position exacte est désactivée',
  'help.titleDenied': 'La localisation est bloquée',
  'help.subApprox': ({ p }) =>
    `Votre téléphone ne partage qu’une position approximative, bien trop imprécise pour mesurer un jardin. Marche à suivre (${p}) :`,
  'help.subDenied': ({ p }) =>
    `Votre navigateur a bloqué la localisation pour ce site et ne la redemandera pas de lui-même. Marche à suivre (${p}) :`,

  'trace.toast': ({ name }) => `Tracé de ${name} — marchez lentement le long du bord`,
  'trace.added': ({ n, raw }) => `${n} points ajoutés (sur ${raw} positions GPS)`,
  'corner.hold': ({ s, n }) => `Ne bougez plus… ${s} s (${n})`,
  'corner.weak': ({ acc }) => `Angle ajouté, mais le GPS est faible (±${acc} m). Déplacez-le pour corriger.`,
  'corner.added': ({ name, n, acc, k }) => `${name} : angle ${n} ajouté (±${acc} m, ${k} mesures)`,

  'saved.areas': ({ n }) => `${n} zones`,
  'saved.open': 'Ouvrir',
  'saved.delete': 'Supprimer',
  'undo.nothing': 'Rien à annuler',
  'garden.default': ({ date }) => `Jardin du ${date}`,
  'save.done': ({ name }) => `« ${name} » enregistré`,
  'save.failed': 'Impossible d’enregistrer : le stockage du navigateur est indisponible',
  'geo.unsupported': 'La géolocalisation n’est pas disponible ici',
  'geo.finding': 'Recherche de votre position…',
  'geo.failed': 'Impossible d’obtenir votre position',

  'imagery.zoomIn': 'Zoomez d’abord sur votre jardin, puis touchez 🗓',
  'imagery.looking': 'Recherche d’anciennes photos de cet endroit…',
  'imagery.lookingN': ({ n }) => `Recherche d’anciennes photos… ${n} ${pluralFr(n, 'trouvée')}`,
  'imagery.error': ({ msg }) => `Archive de photos injoignable (${msg})`,
  'imagery.none': 'Aucune photo d’archive pour cet endroit',
  'imagery.published': ({ latest, date }) => `${latest ? 'Actuelle' : 'Photo'}, publiée en ${date}`,
  'imagery.dateLoading': 'date en cours…',
  'imagery.count': ({ n }) => `${n} photos de cet endroit. Utilisez ◀ ▶ pour les parcourir (chargement des dates…)`,
  'imagery.showingLeafOff': ({ date, n }) => `Affichage : ${date} (arbres sans feuilles 🍂). ${n} photos — ◀ ▶ pour comparer.`,
  'imagery.noLeafOff': ({ n }) => `${n} photos ici, aucune prise en saison sans feuilles.`,
  'imagery.attribution': 'Photos d’archive : Esri World Imagery Wayback',
  'season.Winter': 'Hiver',
  'season.Spring': 'Printemps',
  'season.Summer': 'Été',
  'season.Autumn': 'Automne',

  'layer.satellite': 'Satellite (Esri)',
  'layer.ign': 'Photo aérienne IGN',
  'layer.streets': 'Plan',
  'layer.cadastre': 'Cadastre',

  'parcel.outside': 'Le cadastre n’est disponible qu’en France',
  'parcel.zoomIn': 'Zoomez davantage pour choisir une parcelle',
  'parcel.loading': 'Recherche de la parcelle…',
  'parcel.none': 'Aucune parcelle ici (les routes et le domaine public ne sont pas cadastrés)',
  'parcel.error': ({ msg }) => `Service du cadastre injoignable (${msg})`,
  'parcel.name': ({ label }) => `Parcelle ${label}`,
  'parcel.added': ({ label, commune, area }) =>
    `Parcelle ${label}${commune ? ` (${commune})` : ''} ajoutée — contenance ${area}`,
  'parcel.already': ({ name }) => `${name} est déjà dans la liste`,

  'search.placeholder': 'Rechercher une adresse',
  'search.label': 'Rechercher une adresse',
  'search.searching': 'Recherche…',
  'search.none': 'Aucune adresse trouvée',
  'search.failed': 'La recherche d’adresse a échoué, vérifiez votre connexion',
  'search.worldwide': 'Appuyez sur Entrée pour chercher dans le monde entier',
  'search.creditFr': 'Adresses : IGN / BAN',
  'search.creditOsm': 'Adresses : © OpenStreetMap',

  'boot.restored': 'Dernier contour restauré',
  'boot.start': 'Choisissez « Parcourir », « Dessiner » ou « Cadastre » pour commencer',
  'boot.startFr': 'Choisissez « Parcourir », « Dessiner » ou « Cadastre » pour commencer',
};

const DICTS = { en, fr };
let current = 'en';

/** Language from (in order) ?lang=, saved preference, browser languages. */
export function detectLang({ search = '', saved, navigatorLanguages = [] } = {}) {
  const fromUrl = new URLSearchParams(search).get('lang');
  if (LANGS.includes(fromUrl)) return fromUrl;
  if (LANGS.includes(saved)) return saved;
  for (const l of navigatorLanguages) {
    const base = String(l).toLowerCase().split('-')[0];
    if (LANGS.includes(base)) return base;
  }
  return 'en';
}

export function setLang(lang) {
  current = LANGS.includes(lang) ? lang : 'en';
}
export const getLang = () => current;
/** Locale for number formatting. */
export const numberLocale = () => (current === 'fr' ? 'fr-FR' : 'en-US');

export function t(key, params = {}) {
  const value = DICTS[current][key] ?? en[key];
  if (value === undefined) return key;
  if (typeof value === 'function') return value(params);
  return value.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`);
}

/** Fill every data-i18n* element under root. */
export function applyStatic(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    el.title = t(el.dataset.i18nTitle);
    el.setAttribute('aria-label', el.title);
  }
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
}

export const _dicts = DICTS; // for tests
