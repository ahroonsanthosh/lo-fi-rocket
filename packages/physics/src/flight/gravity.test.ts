/** Gravity (plan 0008, GRAV-1, GRAV-C), USSA76 eq. (17) p. 8. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import { metres, metresPerSecondSquared } from '../units/si.js';
import {
  gravityAt,
  GRAVITY_EFFECTIVE_EARTH_RADIUS,
  OPENROCKET_REFERENCE_GRAVITY_45N,
  STANDARD_GRAVITY,
  STANDARD_GRAVITY_MODEL,
} from './gravity.js';

describe('GRAV-1 inverse-square law', () => {
  it('g₀ at sea level; at 86 km: 9.80665 × (6 356 766 / 6 442 766)² = 9.80665 × 0.986652² = 9.546593', () => {
    // ratio = 0.98665170; squared = 0.97348157; × 9.80665 = 9.5465930 m/s².
    expect(gravityAt(STANDARD_GRAVITY_MODEL, metres(0))).toBe(9.80665);
    expect(gravityAt(STANDARD_GRAVITY_MODEL, metres(86000))).toBeCloseTo(9.546593, 6);
    expect(GRAVITY_EFFECTIVE_EARTH_RADIUS).toBe(6356766);
    expect(STANDARD_GRAVITY).toBe(9.80665);
  });
  it('the OpenRocket-equivalent sea-level value, and a constant model for analytical cases', () => {
    const or = {
      seaLevel: OPENROCKET_REFERENCE_GRAVITY_45N,
      altitudeDependence: 'inverse-square' as const,
    };
    expect(gravityAt(or, metres(0))).toBe(9.8061992025);
    // 2 km: × (6356766/6358766)² = × 0.99937095 → 9.800030
    expect(gravityAt(or, metres(2000))).toBeCloseTo(9.80003, 5);
    const constant = {
      seaLevel: metresPerSecondSquared(9.81),
      altitudeDependence: 'constant' as const,
    };
    expect(gravityAt(constant, metres(5000))).toBe(9.81);
  });
  it('rejects a non-positive sea-level value and non-finite altitude', () => {
    expect(() =>
      gravityAt({ seaLevel: metresPerSecondSquared(0), altitudeDependence: 'constant' }, metres(0)),
    ).toThrow(InvalidInputError);
    expect(() => gravityAt(STANDARD_GRAVITY_MODEL, metres(Number.NaN))).toThrow(InvalidInputError);
  });
  it('decreases monotonically with altitude', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -5000, max: 1e6, noNaN: true }),
        fc.double({ min: 0, max: 1e5, noNaN: true }),
        (z, dz) => {
          return (
            gravityAt(STANDARD_GRAVITY_MODEL, metres(z + dz)) <=
            gravityAt(STANDARD_GRAVITY_MODEL, metres(z))
          );
        },
      ),
      { numRuns: 200 },
    );
  });
});
