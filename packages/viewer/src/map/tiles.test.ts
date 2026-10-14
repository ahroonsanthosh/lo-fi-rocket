/**
 * Map tile arithmetic (plan 3d-0001, D-3D-2). Expected values by hand from
 * the Web Mercator definitions: world size 256·2^z pixels, x = (λ + 180)/360,
 * y = (1 − ln(tan φ + sec φ)/π)/2, ground resolution 2πR cos φ/(256·2^z).
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  chooseZoom,
  decodeTerrarium,
  ElevationGrid,
  localToPixel,
  lonLatOfPixel,
  mapLevels,
  metresPerPixel,
  pixelToLocal,
  terrainDeviation,
  TILE_SIZE,
  tileRange,
  validateSite,
  worldPixel,
} from './tiles.js';

describe('worldPixel and metresPerPixel by hand', () => {
  it('puts (0°, 0°) at the centre of the zoom-0 tile and 180° E at its right edge', () => {
    expect(worldPixel({ lon: 0, lat: 0 }, 0)).toEqual({ x: 128, y: 128 });
    expect(worldPixel({ lon: 180, lat: 0 }, 0).x).toBe(256);
    expect(worldPixel({ lon: -180, lat: 0 }, 3).x).toBe(0);
    // The latitude limit maps to the top edge: ln(tan φ + sec φ) = π there.
    expect(worldPixel({ lon: 0, lat: 85.05112878 }, 0).y).toBeCloseTo(0, 6);
  });
  it('lonLatOfPixel inverts worldPixel (property) and maps the zoom-0 centre to (0°, 0°)', () => {
    expect(lonLatOfPixel(128, 128, 0)).toEqual({ lon: 0, lat: 0 });
    fc.assert(
      fc.property(
        fc.double({ min: -85, max: 85, noNaN: true }),
        fc.double({ min: -180, max: 180, noNaN: true }),
        fc.integer({ min: 0, max: 19 }),
        (lat, lon, z) => {
          const p = worldPixel({ lat, lon }, z);
          const back = lonLatOfPixel(p.x, p.y, z);
          expect(Math.abs(back.lat - lat)).toBeLessThan(1e-9);
          expect(Math.abs(back.lon - lon)).toBeLessThan(1e-9);
        },
      ),
    );
  });
  it('gives 2π × 6 378 137 / 256 = 156 543.034 m per pixel at zoom 0 on the equator, and half at 60°', () => {
    expect(metresPerPixel(0, 0)).toBeCloseTo(156543.03392804097, 6);
    expect(metresPerPixel(60, 0)).toBeCloseTo(156543.03392804097 / 2, 6);
    expect(metresPerPixel(0, 10)).toBeCloseTo(152.87405657, 6); // / 1024
  });
});

describe('local projection', () => {
  it('maps the site to (0, 0); east is +x, north is +y', () => {
    const site = { lon: -106.858, lat: 39.2465 };
    const p = worldPixel(site, 15);
    const o = pixelToLocal(site, 15, p.x, p.y);
    expect(o.x === 0 && o.y === 0).toBe(true); // ±0

    const east = pixelToLocal(site, 15, p.x + 1, p.y);
    expect(east.x).toBeCloseTo(metresPerPixel(site.lat, 15), 9);
    expect(pixelToLocal(site, 15, p.x, p.y - 1).y).toBeCloseTo(metresPerPixel(site.lat, 15), 9);
  });
  it('round-trips local metres through world pixels (property)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -80, max: 80, noNaN: true }),
        fc.double({ min: -179, max: 179, noNaN: true }),
        fc.double({ min: -20_000, max: 20_000, noNaN: true }),
        fc.double({ min: -20_000, max: 20_000, noNaN: true }),
        fc.integer({ min: 5, max: 18 }),
        (lat, lon, x, y, z) => {
          const site = { lat, lon };
          const p = localToPixel(site, z, x, y);
          const back = pixelToLocal(site, z, p.x, p.y);
          expect(Math.abs(back.x - x)).toBeLessThan(1e-6);
          expect(Math.abs(back.y - y)).toBeLessThan(1e-6);
        },
      ),
    );
  });
});

describe('tile ranges', () => {
  it('cover the requested square and respect the tile budget (property)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -75, max: 75, noNaN: true }),
        fc.double({ min: -170, max: 170, noNaN: true }),
        fc.double({ min: 100, max: 30_000, noNaN: true }),
        (lat, lon, half) => {
          const site = { lat, lon };
          const z = chooseZoom(site, half, 8, 18);
          const r = tileRange(site, half, z);
          expect(r.cols).toBeLessThanOrEqual(8);
          expect(r.rows).toBeLessThanOrEqual(8);
          const nw = localToPixel(site, z, -half, half);
          const se = localToPixel(site, z, half, -half);
          expect(r.x0 * TILE_SIZE).toBeLessThanOrEqual(nw.x);
          expect(r.y0 * TILE_SIZE).toBeLessThanOrEqual(nw.y);
          expect((r.x0 + r.cols) * TILE_SIZE).toBeGreaterThanOrEqual(se.x);
          expect((r.y0 + r.rows) * TILE_SIZE).toBeGreaterThanOrEqual(se.y);
        },
      ),
    );
  });
  it('map levels by hand: inner max(400, 1.6 r), mid min(outer, 4 inner), outer max(8 km, 4 r) up to 40 km, far 120 km', () => {
    expect(mapLevels(250)).toEqual({
      inner: 400,
      mid: 1600,
      outer: 8000,
      far: 120_000,
      nearElevation: 8000,
    });
    // r = 3000: inner 4800, outer 12 000, mid min(12 000, 19 200) = 12 000.
    expect(mapLevels(3000)).toEqual({
      inner: 4800,
      mid: 12_000,
      outer: 12_000,
      far: 120_000,
      nearElevation: 12_000,
    });
    expect(mapLevels(20_000).outer).toBe(40_000);
  });
});

describe('decodeTerrarium by hand (R·256 + G + B/256 − 32768)', () => {
  it('decodes sea level, the minimum and a mountain', () => {
    expect(decodeTerrarium(128, 0, 0)).toBe(0);
    expect(decodeTerrarium(0, 0, 0)).toBe(-32768);
    // 137·256 + 45 + 128/256 − 32768 = 35072 + 45 + 0.5 − 32768 = 2349.5
    expect(decodeTerrarium(137, 45, 128)).toBe(2349.5);
  });
});

describe('ElevationGrid', () => {
  it('interpolates a plane exactly (bilinear) and clamps at the edge', () => {
    const site = { lon: 10, lat: 45 };
    const range = tileRange(site, 500, 14);
    const w = range.cols * TILE_SIZE;
    const h = range.rows * TILE_SIZE;
    const m = new Float32Array(w * h);
    // Elevation 100 + 0.5 per pixel column (east) − 0.25 per pixel row (south), at pixel centres.
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) m[j * w + i] = 100 + 0.5 * i - 0.25 * j;
    const grid = new ElevationGrid(site, range, m);
    const p = worldPixel(site, 14);
    const u = p.x - range.x0 * TILE_SIZE - 0.5;
    const v = p.y - range.y0 * TILE_SIZE - 0.5;
    expect(grid.at(0, 0)).toBeCloseTo(100 + 0.5 * u - 0.25 * v, 3);
    // 30 m east is 30/s pixels: +0.5 m per pixel.
    const s = metresPerPixel(45, 14);
    expect(grid.at(30, 0) - grid.at(0, 0)).toBeCloseTo((0.5 * 30) / s, 3);
    expect(() => new ElevationGrid(site, range, new Float32Array(3))).toThrow();
  });
  it('terrainDeviation reports the largest signed difference from the pad and where it is', () => {
    const height = (x: number, y: number): number => 1000 + 0.1 * x - 0.02 * y;
    const d = terrainDeviation(height, [
      { x: 0, y: 0 },
      { x: 50, y: 0 }, // +5
      { x: -80, y: 100 }, // −8 − 2 = −10
    ]);
    expect(d.metres).toBeCloseTo(-10, 12);
    expect(d.at).toEqual({ x: -80, y: 100 });
  });
});

describe('validateSite', () => {
  it('accepts a normal site and names the problem otherwise', () => {
    expect(validateSite({ lat: 39.2, lon: -106.8 })).toBeUndefined();
    expect(validateSite({ lat: 88, lon: 0 })).toContain('latitude');
    expect(validateSite({ lat: 0, lon: 200 })).toContain('longitude');
    expect(validateSite({ lat: Number.NaN, lon: 0 })).toContain('numbers');
  });
});
