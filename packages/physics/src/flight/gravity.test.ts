/** Gravity (plan 0008, GRAV-1, GRAV-C), USSA76 eq. (17) p. 8. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import { metres, metresPerSecondSquared, radians } from '../units/si.js';
import {
  gravityAt,
  GRAVITY_EFFECTIVE_EARTH_RADIUS,
  OPENROCKET_REFERENCE_GRAVITY_45N,
  STANDARD_GRAVITY,
  STANDARD_GRAVITY_MODEL,
  seaLevelGravity,
  WGS84,
  wgs84NormalGravity,
  wgs84NormalGravityAbove,
  type GravityModel,
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

describe('GRAV-2 and GRAV-3: WGS 84 normal gravity (NGA.STND.0036, D-060)', () => {
  it('equator gives γ_e = 9.7803253359; the pole gives γ_e(1 + k)/√(1 − e²) = 9.8321849379 (Table 3.6)', () => {
    expect(wgs84NormalGravity(radians(0))).toBe(9.7803253359);
    // 9.7803253359 × 1.001931852652458 / √(1 − 0.006694379990141) = 9.79922178… / 0.99664718… = 9.83218494
    expect(wgs84NormalGravity(radians(Math.PI / 2))).toBeCloseTo(9.8321849379, 9);
    // k = bγ_p/(aγ_e) − 1 with b = a(1 − f): 0.996647189 × 9.8321849379/9.7803253359 − 1 = 0.00193185266 (Table 3.6 k).
    expect(
      (1 - WGS84.flattening) * (WGS84.normalGravityPole / WGS84.normalGravityEquator) - 1,
    ).toBeCloseTo(WGS84.somiglianaK, 9);
  });
  it('45°: sin²φ = 0.5: 9.7803253359 × 1.000965926326/√(1 − 0.003347189995) = 9.7897719…/0.99832560… = 9.806197769', () => {
    expect(wgs84NormalGravity(radians(Math.PI / 4))).toBeCloseTo(9.806197769, 8);
    // OpenRocket's 9.8061992025 is the GRS 80 closed formula (γ_e = 9.7803267715): 1.4 µm/s² apart (D-060).
    expect(Math.abs(wgs84NormalGravity(radians(Math.PI / 4)) - 9.8061992025)).toBeLessThan(2e-6);
  });
  it('(4-3) at 45° and 1000 m: factor 1 − (2/6378137)(1 + 0.00335281 + 0.00344979 − 0.00335281) × 1000 + 3 × 10⁶/6378137² = 0.99968542; γ_h = 9.80311294', () => {
    expect(wgs84NormalGravityAbove(radians(Math.PI / 4), metres(1000))).toBeCloseTo(9.803112944, 8);
    expect(wgs84NormalGravityAbove(radians(Math.PI / 4), metres(0))).toBe(
      wgs84NormalGravity(radians(Math.PI / 4)),
    );
  });
  it('the model form: gravityAt and seaLevelGravity; invalid latitudes throw', () => {
    const model: GravityModel = { altitudeDependence: 'wgs84', latitude: radians(Math.PI / 4) };
    expect(gravityAt(model, metres(1000))).toBeCloseTo(9.803112944, 8);
    expect(seaLevelGravity(model)).toBeCloseTo(9.806197769, 8);
    expect(seaLevelGravity(STANDARD_GRAVITY_MODEL)).toBe(9.80665);
    expect(() => wgs84NormalGravity(radians(2))).toThrow(InvalidInputError);
  });
});
