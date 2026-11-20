# Garden Size

Static web app for measuring garden area, either by walking the edge (GPS) or by drawing on a satellite map. It uses vanilla ES modules with Leaflet 1.9.4 from unpkg (SRI-pinned). There is no build step and no runtime dependencies.

## Layout

- `src/`: the deployed site
  - `index.html`, `styles.css`
  - `app.js`: UI, map, modes, saving and exporting
  - `geometry.js`: pure maths (area, perimeter, simplification, uncertainty, formatting). Fully unit tested.
  - `gps.js`: `GpsTracker`, which wraps `watchPosition` and does corner sampling
  - `storage.js`: localStorage helpers, guarded with try/catch
  - `i18n.js`: English and French strings. `t(key, params)` looks a string up, and `data-i18n*` attributes in `index.html` are filled by `applyStatic()`. Every key must exist in both languages; a test enforces this.
  - `cadastre.js`: French cadastre (IGN Géoplateforme). It provides the parcel tile layer, the IGN aerial photo layer, and `parcelAt()`, which tries WFS first and falls back to API Carto.
  - `location-help.js`: per-device steps for unblocking location, in English and French
  - `wayback.js`: Esri World Imagery Wayback lookup, which lists the distinct archived photos at a point and their capture dates and seasons. `fetchJson` is injectable for tests.
- `tests/`: `node:test` tests for `geometry.js`
- `scripts/serve.js`: zero-dependency dev server for `src/`. Reads `.env` for PORT/HOST.
- `docs/how-it-works.md`: the maths
- `.github/workflows/pages.yml`: tests, then deploys `src/` to GitHub Pages

## Commands

- `npm start`: dev server at http://127.0.0.1:5173
- `npm test`: unit tests

## Conventions

- Points are `{ lat, lng, acc? }`. `acc` is GPS accuracy in metres and is absent for points placed by hand.
- An outline is a list of areas: `{ id, name, color, subtract, vertices }`. Exactly one area is active (`state.activeId`), and all point edits go to it. `summarizeAreas()` computes the total, with subtract areas removed.
- An area imported from the cadastre has `parcel: { id, label, commune, contenance }`. Any manual edit to its outline removes that tag.
- New user-facing text goes into both `en` and `fr` in `i18n.js`. Never hard-code text in `app.js`.
- Storage migrates the old single-outline format (a bare vertex array) through `normalizeAreas()`.
- Keep `geometry.js` pure (no DOM), so it stays testable in Node.
- Every state change goes through `commit(mutate)` in `app.js`. It snapshots `{ areas, activeId }` for undo, saves the draft and re-renders.
- Geolocation requires a secure context (HTTPS or localhost).
