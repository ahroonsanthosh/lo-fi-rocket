/** The launch guide chosen from the design (plan 3d-0002, D-3D-4), by hand. */
import { describe, expect, it } from 'vitest';
import { launchGuide, RAIL_1010, RAIL_1515, railProfile } from './launcher.js';

describe('launchGuide', () => {
  it('puts a rod of 90 % of the bore through a launch lug, on the lug axis', () => {
    // Lug bore radius 2.5 mm → rod diameter 2 × 2.5 × 0.9 = 4.5 mm.
    const g = launchGuide(0.025, { bore: 0.0025, offset: 0.028 }, undefined);
    expect(g.kind).toBe('rod');
    expect(g.size).toBeCloseTo(0.0045, 15);
    expect(g.offset).toBe(0.028);
  });
  it('chooses 1010 for buttons up to 12 mm and 1515 above, the face under the flange', () => {
    const small = launchGuide(0.027, undefined, { outerDiameter: 0.0102, baseHeight: 0.002 });
    expect(small.kind).toBe('rail-1010');
    expect(small.size).toBe(RAIL_1010);
    // 0.027 + 0.002 + 0.0005 + 0.0127 = 0.0422
    expect(small.offset).toBeCloseTo(0.0422, 12);
    const big = launchGuide(0.05, undefined, { outerDiameter: 0.0165, baseHeight: 0.003 });
    expect(big.kind).toBe('rail-1515');
    expect(big.size).toBe(RAIL_1515);
  });
  it('falls back to a 1010 rail beside the body without lugs or buttons', () => {
    expect(launchGuide(0.02, undefined, undefined).kind).toBe('rail-1010');
  });
  it('the rail profile fits the square of its side and has four slots and a bore', () => {
    const s = railProfile(RAIL_1010);
    const pts = s.getPoints();
    for (const p of pts) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(RAIL_1010 / 2 + 1e-12);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(RAIL_1010 / 2 + 1e-12);
    }
    // Each face: 8 points of its slot and the corner; 4 faces plus the start.
    expect(pts.length).toBe(4 * 9 + 1);
    expect(s.holes).toHaveLength(1);
  });
});
