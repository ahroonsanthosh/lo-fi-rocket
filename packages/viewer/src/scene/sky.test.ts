/**
 * The sky photograph's mapping (plan 3d-0002, D-3D-3): the sun stands at the
 * elevation measured in the HDR and at the chosen azimuth, and the mapping
 * from directions to the photograph inverts the mapping back. By hand.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  SKY_SUN_ELEVATION,
  SKY_SUN_U,
  SKY_YAW,
  skyDirection,
  skyUv,
  SUN_AZIMUTH,
  SUN_DIRECTION,
} from './sky.js';

describe('the sun', () => {
  it('stands at 47.8° elevation, south-east (−45° from east)', () => {
    expect((Math.asin(SUN_DIRECTION.z) * 180) / Math.PI).toBeCloseTo(47.8, 9);
    expect(Math.atan2(SUN_DIRECTION.y, SUN_DIRECTION.x)).toBeCloseTo(-Math.PI / 4, 12);
    expect(SUN_DIRECTION.length()).toBeCloseTo(1, 12);
    // yaw = −π/4 − 2π (0.5952 − 0.5) = −0.785398 − 0.598159 = −1.383557 rad.
    expect(SKY_YAW).toBeCloseTo(-1.383557, 5);
    expect(SUN_AZIMUTH).toBe(-Math.PI / 4);
  });
  it("is at the photograph's sun pixel when mapped back", () => {
    const { u, v } = skyUv(SUN_DIRECTION);
    expect(u).toBeCloseTo(SKY_SUN_U, 9);
    expect(v).toBeCloseTo(0.5 + SKY_SUN_ELEVATION / Math.PI, 9);
  });
});

describe('skyUv and skyDirection', () => {
  it('maps the zenith to v = 1 and the horizon to v = 1/2', () => {
    expect(skyUv({ x: 0, y: 0, z: 1 }).v).toBeCloseTo(1, 12);
    expect(skyUv({ x: 1, y: 0, z: 0 }).v).toBeCloseTo(0.5, 12);
  });
  it('invert each other over the sphere (property)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 0.999, noNaN: true }),
        fc.double({ min: -1.5, max: 1.5, noNaN: true }),
        (u, e) => {
          const d = skyDirection(u, e);
          const back = skyUv(d);
          expect(Math.abs(back.u - u)).toBeLessThan(1e-9);
          expect(Math.abs(back.v - (0.5 + e / Math.PI))).toBeLessThan(1e-9);
        },
      ),
    );
  });
});
