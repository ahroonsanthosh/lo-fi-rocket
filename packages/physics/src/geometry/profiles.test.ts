import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { InvalidInputError, NotImplementedError } from '../errors.js';
import { metres } from '../units/si.js';
import { noseProfile, transitionProfile, type NoseShape } from './profiles.js';

const SHAPES: NoseShape[] = ['conical', 'ogive', 'elliptical', 'parabolic', 'power', 'haack'];

describe('nose cone profiles (Niskanen Appendix A, pp. 100 to 103)', () => {
  it('start at the tip (r = 0) and end at the base radius for every shape', () => {
    for (const shape of SHAPES) {
      const p = noseProfile(shape, metres(0.15), metres(0.027));
      expect(p.radius(0), shape).toBeCloseTo(0, 12);
      expect(p.radius(0.15), shape).toBeCloseTo(0.027, 12);
    }
  });

  it('conical, eq. (A.1): r(L/2) = R/2 and constant slope R/L', () => {
    const p = noseProfile('conical', metres(0.1), metres(0.025));
    expect(p.radius(0.05)).toBeCloseTo(0.0125, 15);
    expect(p.slope(0.03)).toBeCloseTo(0.25, 15);
  });

  it('tangent ogive, eqs. (A.2) and (A.5): R = 0.027, L = 0.15 gives ρ_t = (R² + L²)/(2R) = 0.43017 m and a circular arc', () => {
    // ρ_t = (0.000729 + 0.0225) / 0.054 = 0.0232290 / 0.054 = 0.430167 m; centre at (L, −(ρ_t − R)) = (0.15, −0.403167).
    // At x = 0.075: r = √(0.430167² − 0.075²) − 0.403167 = √(0.185044 − 0.005625) − 0.403167 = 0.423578 − 0.403167 = 0.020411.
    const p = noseProfile('ogive', metres(0.15), metres(0.027), 1);
    expect(p.radius(0.075)).toBeCloseTo(0.020411, 5);
    // Tangent at the base: slope 0 at x = L.
    expect(p.slope(0.15)).toBeCloseTo(0, 12);
    // Tip slope = L/(ρ_t − R)... the arc's tangent at the tip: (a − 0)/√(ρ² − a²) = L/c = 0.15/0.403167 = 0.37205.
    expect(p.slope(0)).toBeCloseTo(0.37205, 4);
  });

  it('secant ogives (κ < 1) still reach R at the base, and κ → small approaches the cone', () => {
    for (const kappa of [0.9, 0.5, 0.1, 0.01]) {
      const p = noseProfile('ogive', metres(0.15), metres(0.027), kappa);
      expect(p.radius(0.15), `κ = ${String(kappa)}`).toBeCloseTo(0.027, 10);
    }
    const nearCone = noseProfile('ogive', metres(0.15), metres(0.027), 1e-4);
    expect(nearCone.radius(0.075)).toBeCloseTo(0.0135, 5);
  });

  it('elliptical, eq. (A.6): r(L/2) = R √3/2 and vertical tip', () => {
    const p = noseProfile('elliptical', metres(0.1), metres(0.02));
    expect(p.radius(0.05)).toBeCloseTo((0.02 * Math.sqrt(3)) / 2, 12);
    expect(p.slope(0)).toBe(Number.POSITIVE_INFINITY);
    expect(p.slope(0.1)).toBeCloseTo(0, 12);
  });

  it('parabolic, eq. (A.7): κ = 0 is the cone and κ = 1 is tangent at the base', () => {
    const cone = noseProfile('parabolic', metres(0.1), metres(0.02), 0);
    expect(cone.radius(0.03)).toBeCloseTo(0.006, 15);
    const full = noseProfile('parabolic', metres(0.1), metres(0.02), 1);
    // r(L/2) = R (1/2)(2 − 1/2)/1 = 0.75 R.
    expect(full.radius(0.05)).toBeCloseTo(0.015, 15);
    expect(full.slope(0.1)).toBeCloseTo(0, 15);
  });

  it('power series, eq. (A.8): κ = 1 is the cone, κ = 0.5 gives r(L/4) = R/2', () => {
    const cone = noseProfile('power', metres(0.1), metres(0.02), 1);
    expect(cone.radius(0.03)).toBeCloseTo(0.006, 15);
    const half = noseProfile('power', metres(0.1), metres(0.02), 0.5);
    expect(half.radius(0.025)).toBeCloseTo(0.01, 15);
    expect(half.slope(0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('Haack, eqs. (A.9) and (A.10): Von Kármán r(L/2) = R/√2; LV-Haack r(L/2) = R √((π/2 + 1/3)/π)', () => {
    // θ(L/2) = arccos(0) = π/2; sin 2θ = 0; sin³θ = 1.
    const vk = noseProfile('haack', metres(0.13), metres(0.016), 0);
    expect(vk.radius(0.065)).toBeCloseTo(0.016 / Math.SQRT2, 12);
    const lv = noseProfile('haack', metres(0.13), metres(0.016), 1 / 3);
    expect(lv.radius(0.065)).toBeCloseTo(0.016 * Math.sqrt((Math.PI / 2 + 1 / 3) / Math.PI), 12);
    // Slope by central difference agrees with the analytic derivative.
    const h = 1e-6;
    const numeric = (vk.radius(0.04 + h) - vk.radius(0.04 - h)) / (2 * h);
    expect(vk.slope(0.04)).toBeCloseTo(numeric, 6);
  });

  it('analytic slopes agree with central differences for every shape in the interior', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SHAPES),
        fc.double({ min: 0.05, max: 0.95, noNaN: true }),
        (shape, u) => {
          const p = noseProfile(shape, metres(0.2), metres(0.03));
          const x = u * 0.2;
          const h = 1e-7;
          const numeric = (p.radius(x + h) - p.radius(x - h)) / (2 * h);
          return Math.abs(p.slope(x) - numeric) < 1e-5 * (1 + Math.abs(numeric));
        },
      ),
      { seed: 20260003 },
    );
  });

  it('rejects non-positive dimensions and out-of-range parameters', () => {
    expect(() => noseProfile('conical', metres(0), metres(0.02))).toThrow(InvalidInputError);
    expect(() => noseProfile('conical', metres(0.1), metres(-0.02))).toThrow(InvalidInputError);
    expect(() => noseProfile('ogive', metres(0.1), metres(0.02), 0)).toThrow(InvalidInputError);
    expect(() => noseProfile('ogive', metres(0.1), metres(0.02), 1.5)).toThrow(InvalidInputError);
    expect(() => noseProfile('haack', metres(0.1), metres(0.02), 0.5)).toThrow(InvalidInputError);
    expect(() => noseProfile('power', metres(0.1), metres(0.02), 0)).toThrow(InvalidInputError);
    expect(() => noseProfile('parabolic', metres(0.1), metres(0.02), -0.1)).toThrow(
      InvalidInputError,
    );
  });
});

describe('transition profiles (Niskanen Appendix A.7, pp. 103 to 104)', () => {
  it('conical boat tail is linear between the radii', () => {
    const p = transitionProfile('conical', metres(0.05), metres(0.027), metres(0.018));
    expect(p.radius(0)).toBe(0.027);
    expect(p.radius(0.05)).toBeCloseTo(0.018, 15);
    expect(p.radius(0.025)).toBeCloseTo(0.0225, 15);
    expect(p.slope(0.01)).toBeCloseTo(-0.18, 12);
  });

  it('non-clipped ogive shoulder rises from the fore radius like a nose of base R₂ − R₁', () => {
    const p = transitionProfile('ogive', metres(0.1), metres(0.01), metres(0.03), 1);
    expect(p.radius(0)).toBeCloseTo(0.01, 15);
    expect(p.radius(0.1)).toBeCloseTo(0.03, 12);
    const nose = noseProfile('ogive', metres(0.1), metres(0.02), 1);
    expect(p.radius(0.04)).toBeCloseTo(0.01 + nose.radius(0.04), 15);
  });

  it('non-clipped boat tails mirror the nose so the tip is at the aft end', () => {
    const p = transitionProfile('elliptical', metres(0.1), metres(0.03), metres(0.01));
    expect(p.radius(0)).toBeCloseTo(0.03, 12);
    expect(p.radius(0.1)).toBeCloseTo(0.01, 12);
    expect(p.slope(0.05)).toBeLessThan(0);
  });

  it('clipped transitions are not implemented and say so', () => {
    expect(() =>
      transitionProfile('ogive', metres(0.1), metres(0.01), metres(0.03), 1, true),
    ).toThrow(NotImplementedError);
  });
});
