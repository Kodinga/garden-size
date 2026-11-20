# How it works

## Area

A garden is at most a few hundred metres across. At that size, projecting lat/lng onto a flat local plane centred on the polygon is accurate to well under 0.1%:

```
x = Δlng · R · cos(lat₀)
y = Δlat · R
```

The area then comes from the shoelace formula, `A = ½ |Σ (xᵢ·yᵢ₊₁ − xᵢ₊₁·yᵢ)|`. The perimeter is the sum of haversine distances along the edges. See `src/geometry.js`.

## Multiple areas

The total is the sum of every area, minus any area marked as subtract, and it never goes below 0. The areas are treated as independent, so their uncertainties are combined in quadrature: `σ_total = √Σσᵢ²`. Overlaps are not detected. If two "add" areas overlap, the shared part is counted twice.

## Imagery dates (Esri Wayback)

Esri archives every version of its World Imagery basemap; there are about 200 releases since 2014. Most releases reuse older photos for any given place, so `src/wayback.js` finds the distinct photos in two phases.

1. **Distinct photos (fast).**
   - Releases are sorted newest first by the date in their title. Release numbers are not in date order.
   - For the tile under the map centre, `GET …/MapServer/tilemap/{release}/{z}/{y}/{x}` answers with `select: [n]`, the release whose pixels that tile really uses. The app jumps straight to release `n` and continues from the next older one, so a location with 8 distinct photos needs about 9 requests.
   - It stops when `data: [0]`, meaning no imagery that far back.
2. **Capture metadata (slow).**
   - Each release's metadata MapServer is queried at the layer for the current zoom (`layer = 23 − zoom`). This returns `SRC_DATE2` (capture date), `NICE_DESC` (provider), `SRC_RES` and `SRC_ACC`.
   - These services are often slow to start, taking 5–15 s on first hit. Requests run four at a time with a 12 s timeout and two retries. The UI shows the photo list straight after phase 1 and fills in dates as they arrive.
   - Releases that turn out to contain the same capture (same date and provider) are hidden as duplicates.

"Leaf-off" means November–March in the northern hemisphere and May–September in the southern. It is never flagged within the tropics.

## Corner averaging

**Mark corner** collects every `watchPosition` fix for 5 s and computes an average weighted by `1/accuracy²`. The reported accuracy of the averaged point is the weighted mean of the readings' accuracies, not the much smaller statistical combination. GPS errors are strongly correlated over a few seconds, so the smaller figure would be falsely optimistic.

## Tracing

A new fix is appended to the trace only when both of these hold:

- its accuracy is ±15 m or better, and
- it is at least `max(1 m, accuracy / 2)` from the previous point. This stops a stationary walker from adding jitter.

When tracing stops, the path is simplified with Douglas–Peucker (0.75 m tolerance), which keeps corners and removes noise.

## Uncertainty

The ± figure is a 1σ estimate from first-order error propagation of the shoelace formula:

```
σ_A² = Σ σᵢ² · ¼ · |pᵢ₊₁ − pᵢ₋₁|²
```

Each vertex's GPS accuracy is used as its per-axis σ. Points placed or moved by hand carry no GPS error. A constant GPS bias shifts the whole shape without changing its area, so the estimate covers only the random part of the error.
