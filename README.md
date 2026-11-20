# Garden Size

Measure the area of your garden from your phone. You can walk around its edge using GPS, or tap its corners on a satellite map. Then adjust the outline by dragging points.

No build step, no backend and no tracking. Everything stays in your browser's local storage.

## Features

- **Walk the edge**
  - **Mark corner:** stand on a corner and the app averages about 5 s of GPS readings, weighted by accuracy. Best for straight-sided gardens.
  - **Trace:** records your path as you walk. Fixes worse than ±15 m are ignored, and jitter is removed with Douglas–Peucker simplification. Best for curved borders.
  - Live GPS accuracy indicator, and the screen stays awake while you walk (Wake Lock API).
- **Draw on map:** tap corners on Esri satellite imagery (OpenStreetMap is also available).
- **Multiple areas:** add as many areas as you like (lawn, beds, a separate front garden), each with its own name and colour. The big number is the total. Mark an area **−** to subtract it, for example a shed or patio drawn inside the lawn. Tap an area on the map or in the list to select it. New points always go into the selected area.
- **Imagery dates:** trees hiding the boundary? Tap 🗓 on the map to flip through every archived satellite photo of that spot (Esri World Imagery Wayback, 2014 onwards). Each photo shows its capture date, season, resolution and source. Winter or early-spring photos are marked 🍂, and the app switches to the newest of them automatically, because bare trees usually reveal fences and hedges.
- **Edit:** drag points, drag a midpoint to insert a point, double-tap a point to delete it, and undo.
- **Results:** area (m², ha, ft², acres), perimeter, an estimate of GPS uncertainty, and a warning if the outline crosses itself.
- **Save / export:** name and save gardens (with all their areas) on the device, and export them as a GeoJSON FeatureCollection with one feature per area.

## Run locally

```bash
cp .env.example .env   # optional, sets PORT/HOST
npm start              # http://127.0.0.1:5173
npm test               # geometry unit tests
```

Browsers only allow GPS on HTTPS or `localhost`. To use the app on your phone, deploy it (see below) or put an HTTPS tunnel in front of the dev server.

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` runs the tests and publishes `src/` on every push to `main`. To turn it on, go to the repo's **Settings → Pages → Source: GitHub Actions**. The app will be at `https://<user>.github.io/garden-size/`.

## Tips for accurate GPS measurements

Phone GPS is typically accurate to ±3–5 m in open sky and is worse near buildings and trees. For a small garden that error is significant. To get a good result:

1. Wait until the indicator is green (±5 m or better) before marking corners.
2. Prefer **Mark corner** over tracing for straight edges, because averaging helps.
3. Afterwards, switch on the satellite layer and drag any misplaced points onto the visible boundary.

See [docs/how-it-works.md](docs/how-it-works.md) for the maths.
