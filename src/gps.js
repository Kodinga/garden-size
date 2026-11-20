import { weightedAverage } from './geometry.js';

/** Thin wrapper around navigator.geolocation.watchPosition with sampling. */
export class GpsTracker {
  constructor({ onFix, onError } = {}) {
    this.onFix = onFix;
    this.onError = onError;
    this.watchId = null;
    this.last = null;
    this.listeners = new Set();
  }

  get running() {
    return this.watchId !== null;
  }

  start() {
    if (this.running) return;
    if (!('geolocation' in navigator)) {
      this.onError?.(Object.assign(new Error('This browser has no GPS / geolocation support.'), { code: 'unsupported' }));
      return;
    }
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: pos.coords.accuracy,
          time: pos.timestamp,
        };
        this.last = fix;
        for (const fn of this.listeners) fn(fix);
        this.onFix?.(fix);
      },
      (err) => this.onError?.(err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
    );
  }

  stop() {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    this.listeners.clear();
  }

  /**
   * Collect fixes for `durationMs` and return their accuracy-weighted average.
   * `onProgress(remainingMs, count)` is called every 250 ms.
   */
  sample(durationMs = 5000, onProgress) {
    return new Promise((resolve, reject) => {
      const fixes = [];
      const listener = (fix) => fixes.push(fix);
      this.listeners.add(listener);
      const startedAt = Date.now();
      const tick = setInterval(() => {
        onProgress?.(Math.max(0, durationMs - (Date.now() - startedAt)), fixes.length);
      }, 250);
      setTimeout(() => {
        clearInterval(tick);
        this.listeners.delete(listener);
        // Fall back to the latest fix if the device reported nothing new.
        if (!fixes.length && this.last && Date.now() - this.last.time < 10000) fixes.push(this.last);
        if (!fixes.length) {
          reject(Object.assign(new Error('No GPS fix received. Are you outdoors with location enabled?'), { code: 'no-fix' }));
        }
        else resolve({ ...weightedAverage(fixes), samples: fixes.length });
        return;
      }, durationMs);
    });
  }
}
