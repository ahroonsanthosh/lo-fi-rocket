/**
 * The illustrative scenery (plan 3d-0001, D-3D-1): the terrain is exactly
 * flat over everything the flight touches, its triangles face up, it is
 * deterministic, and the real-world terrain is drawn relative to the pad.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { REFERENCE_ROCKETS, referenceFlight } from '../test-support/reference-flights.js';
import { horizontalExtent, verticalExtent } from './flight-scene.js';
import { mapTerrainGeometry } from './map-terrain.js';
import { sceneryLayout, terrainGeometry, terrainHeight } from './scenery.js';

describe('sceneryLayout by hand', () => {
  it('flat radius = max(250, 1.4 h + 30, apogee/2); hills at 2.2 flat radii; outer 10 hill radii', () => {
    const a = sceneryLayout({ horizontal: 40, vertical: 170 }, -0.3);
    expect(a.flatRadius).toBe(250);
    expect(a.hillRadius).toBeCloseTo(550, 12);
    expect(a.outerRadius).toBeCloseTo(5500, 12);
    expect(a.groundZ).toBe(-0.3);
    const b = sceneryLayout({ horizontal: 400, vertical: 900 }, 0);
    expect(b.flatRadius).toBe(590); // 1.4 × 400 + 30
    const c = sceneryLayout({ horizontal: 100, vertical: 3000 }, 0);
    expect(c.flatRadius).toBe(1500);
  });
});

describe('terrainHeight', () => {
  const layout = sceneryLayout({ horizontal: 120, vertical: 600 }, -0.4);
  it('is exactly 0 everywhere inside the flat radius (property)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }),
        (f, phi) => {
          const r = f * layout.flatRadius;
          expect(terrainHeight(r * Math.cos(phi), r * Math.sin(phi), layout)).toBe(0);
        },
      ),
    );
  });
  it('is never negative and is the same on every call (deterministic)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -20_000, max: 20_000, noNaN: true }),
        fc.double({ min: -20_000, max: 20_000, noNaN: true }),
        (x, y) => {
          const h = terrainHeight(x, y, layout);
          expect(h).toBeGreaterThanOrEqual(0);
          expect(terrainHeight(x, y, layout)).toBe(h);
        },
      ),
    );
  });
  it('rises into hills outside the flat radius', () => {
    let max = 0;
    for (let k = 0; k < 64; k++) {
      const phi = (2 * Math.PI * k) / 64;
      const r = 1.5 * layout.hillRadius;
      max = Math.max(max, terrainHeight(r * Math.cos(phi), r * Math.sin(phi), layout));
    }
    expect(max).toBeGreaterThan(0.2 * layout.peakHeight);
  });
});

describe.each(REFERENCE_ROCKETS)('the flat ground covers the flight of $id', (rocket) => {
  it('every stored position lies over terrain of height 0 with at least 30 m to spare', () => {
    const { result } = referenceFlight(rocket);
    const layout = sceneryLayout(
      { horizontal: horizontalExtent(result), vertical: verticalExtent(result) },
      0,
    );
    for (const s of result.samples) {
      expect(Math.hypot(s.position.x, s.position.y)).toBeLessThanOrEqual(layout.flatRadius - 30);
      expect(terrainHeight(s.position.x, s.position.y, layout)).toBe(0);
    }
  });
});

describe('terrainGeometry', () => {
  const layout = sceneryLayout({ horizontal: 50, vertical: 200 }, -0.25);
  const g = terrainGeometry(layout, 48);
  const pos = g.getAttribute('position');
  it('puts every vertex inside the flat radius at the drawn ground exactly', () => {
    let inside = 0;
    for (let v = 0; v < pos.count; v++) {
      if (Math.hypot(pos.getX(v), pos.getY(v)) <= layout.flatRadius * (1 - 1e-6)) {
        expect(pos.getZ(v)).toBe(Math.fround(layout.groundZ));
        inside++;
      }
    }
    expect(inside).toBeGreaterThan(100);
  });
  it('faces up: every triangle of the flat disc has a +z geometric normal (front face seen from above)', () => {
    const idx = g.getIndex();
    expect(idx).not.toBeNull();
    let checked = 0;
    for (let t = 0; t < (idx?.count ?? 0); t += 3) {
      const a = idx?.getX(t) ?? 0;
      const b = idx?.getX(t + 1) ?? 0;
      const c = idx?.getX(t + 2) ?? 0;
      if (Math.hypot(pos.getX(c), pos.getY(c)) > layout.flatRadius) continue;
      const ux = pos.getX(b) - pos.getX(a);
      const uy = pos.getY(b) - pos.getY(a);
      const vx = pos.getX(c) - pos.getX(a);
      const vy = pos.getY(c) - pos.getY(a);
      const nz = ux * vy - uy * vx;
      if (Math.abs(nz) < 1e-12) continue; // degenerate at the centre
      expect(nz).toBeGreaterThan(0);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });
});

describe('mapTerrainGeometry', () => {
  it('draws z = groundZ + (elevation − elevation at the pad), so the pad sits on the drawn ground', () => {
    const height = (x: number, y: number): number => 2400 + 0.05 * x + 0.1 * y;
    const g = mapTerrainGeometry(height, 1000, -0.3, 10);
    const pos = g.getAttribute('position');
    // 11 × 11 vertices from −1000 to 1000 m (graded towards the centre); the centre one (index 60) is the pad.
    expect(pos.count).toBe(121);
    expect(pos.getX(60)).toBe(0);
    expect(pos.getY(60)).toBe(0);
    expect(pos.getZ(60)).toBeCloseTo(-0.3, 6);
    // Vertex 0 at (−1000, −1000): −0.3 + (−50 − 100) = −150.3
    expect(pos.getZ(0)).toBeCloseTo(-150.3, 3);
    // Vertex 1: u = −0.8 → x = −1000 × 0.8^1.7 = −684.4 m.
    expect(pos.getX(1)).toBeCloseTo(-1000 * 0.8 ** 1.7, 3);
    // Front faces up.
    const n = g.getAttribute('normal');
    expect(n.getZ(60)).toBeGreaterThan(0.99);
  });
});
