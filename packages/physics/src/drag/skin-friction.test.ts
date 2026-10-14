/** Skin friction (plan 0009, DRAG-1 to DRAG-4), Niskanen §3.4.2. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import { mach, metres } from '../units/si.js';
import {
  bodyFormFactor,
  compressibleSkinFriction,
  frictionDragCoefficient,
  ROUGHNESS_HEIGHTS,
  skinFrictionCoefficient,
} from './skin-friction.js';

const L = metres(0.6);
const RS = metres(60e-6);

describe('DRAG-1, DRAG-2 skin friction coefficient, eqs. (3.78) to (3.81)', () => {
  it('R_crit = 51 (10⁻⁴)^(−1.039) = 7.3042·10⁵ for 60 µm on 0.6 m; roughness-limited C_f = 0.032 (10⁻⁴)^0.2 = 5.0717·10⁻³', () => {
    // (10⁻⁴)^(−1.039) = 10^4.156 = 14 322; × 51 = 730 416. (10⁻⁴)^0.2 = 10^(−0.8) = 0.158489; × 0.032 = 0.0050717.
    const r = skinFrictionCoefficient(2.2e6, RS, L);
    expect(r.reynoldsCritical).toBeCloseTo(730416, -1);
    expect(r.regime).toBe('roughness-limited');
    expect(r.cf).toBeCloseTo(0.0050717, 7);
  });
  it('turbulent below R_crit: R = 2·10⁵ gives 1/(1.5 ln(2·10⁵) − 5.6)² = 1/(18.307 − 5.6)² = 6.192·10⁻³; below 10⁴ the constant 1.48·10⁻²', () => {
    // ln(2·10⁵) = 12.20607; × 1.5 = 18.30911; − 5.6 = 12.70911; squared 161.5215; inverse 6.19113·10⁻³.
    const t = skinFrictionCoefficient(2e5, RS, L);
    expect(t.regime).toBe('turbulent');
    expect(t.cf).toBeCloseTo(6.19113e-3, 7);
    const low = skinFrictionCoefficient(5000, RS, L);
    expect(low.regime).toBe('low-reynolds');
    expect(low.cf).toBe(1.48e-2);
    expect(ROUGHNESS_HEIGHTS.regularPaint60um).toBe(60e-6);
    expect(ROUGHNESS_HEIGHTS.averageGlass).toBe(0.1e-6);
  });
  it('a smooth surface (R_s = 0, plan 0073) is never roughness-limited: R = 10⁹ gives 1/(1.5 ln 10⁹ − 5.6)² = 1.53969·10⁻³', () => {
    // ln 10⁹ = 20.723266; × 1.5 = 31.084899; − 5.6 = 25.484899; squared 649.48006; inverse 1.539693·10⁻³.
    const r = skinFrictionCoefficient(1e9, metres(0), L);
    expect(r.regime).toBe('turbulent');
    expect(r.reynoldsCritical).toBe(Infinity);
    expect(r.cf).toBeCloseTo(1.539693e-3, 9);
  });
  it('rejects a negative roughness, a non-positive length or a negative Reynolds number', () => {
    expect(() => skinFrictionCoefficient(1e6, metres(-1e-6), L)).toThrow(InvalidInputError);
    expect(() => skinFrictionCoefficient(1e6, RS, metres(0))).toThrow(InvalidInputError);
    expect(() => skinFrictionCoefficient(-1, RS, L)).toThrow(InvalidInputError);
  });
});

describe('DRAG-3 compressibility, eqs. (3.82) to (3.84)', () => {
  const turbulent = skinFrictionCoefficient(2e5, RS, L);
  const rough = skinFrictionCoefficient(2.2e6, RS, L);
  it('subsonic: × (1 − 0.1 M²) = 0.975 at M = 0.5', () => {
    expect(compressibleSkinFriction(turbulent, mach(0.5), 2e5)).toBeCloseTo(
      turbulent.cf * 0.975,
      12,
    );
    expect(compressibleSkinFriction(rough, mach(0.5), 2.2e6)).toBeCloseTo(rough.cf * 0.975, 12);
  });
  it('supersonic M = 1.5: turbulent ÷ (1 + 0.3375)^0.58 = ÷ 1.18361; roughness ÷ 1.405 unless below the turbulent value', () => {
    // 1.3375^0.58 = e^(0.58 × 0.290803) = e^0.168666 = 1.18373.
    expect(compressibleSkinFriction(turbulent, mach(1.5), 2e5)).toBeCloseTo(
      turbulent.cf / 1.3375 ** 0.58,
      12,
    );
    // Roughness-limited 5.0717e-3/1.405 = 3.6097e-3; turbulent at R = 2.2e6 is 3.7535e-3/1.18373 = 3.1709e-3, smaller, so the roughness value stands.
    expect(compressibleSkinFriction(rough, mach(1.5), 2.2e6)).toBeCloseTo(5.0717e-3 / 1.405, 6);
  });
});

describe('DRAG-4 friction drag, eq. (3.85): R1 geometry', () => {
  it('C_fc = 5.0588·10⁻³ with f_B = 12, A_wet,body = 0.086636, fins 0.036 m² at t/c̄ = 0.003/0.077778 gives 0.33242', () => {
    // (1 + 1/24) × 0.086636 = 0.090246; (1 + 0.077143) × 0.036 = 0.038777; sum 0.129023; × 5.0588e-3 / 1.963495e-3 = 0.33242.
    const cd = frictionDragCoefficient(5.0588e-3, {
      finenessRatio: 12,
      wettedBodyArea: 0.0080957 + 0.0785398,
      finSets: [{ wettedArea: 0.036, thickness: 0.003, meanChord: 0.0777778 }],
      referenceArea: Math.PI * 0.025 ** 2,
    });
    expect(cd).toBeCloseTo(0.33242, 4);
  });
  it('is non-increasing with Reynolds number within the turbulent regime and constant when roughness-limited', () => {
    // Below R_crit = 7.304·10⁵ the turbulent value falls with R; at R_crit eq. (3.81) jumps up to the
    // roughness-limited constant (4.658·10⁻³ against 5.072·10⁻³ for 60 µm on 0.6 m), so the property
    // holds on each side separately.
    fc.assert(
      fc.property(
        fc.double({ min: 1e4, max: 7.3e5, noNaN: true }),
        fc.double({ min: 0, max: 1e5, noNaN: true }),
        (r, dr) => {
          fc.pre(r + dr < 7.3e5);
          return (
            skinFrictionCoefficient(r + dr, RS, L).cf <=
            skinFrictionCoefficient(r, RS, L).cf + 1e-15
          );
        },
      ),
      { numRuns: 200 },
    );
    expect(skinFrictionCoefficient(1e6, RS, L).cf).toBe(skinFrictionCoefficient(1e8, RS, L).cf);
    expect(skinFrictionCoefficient(7.3e5, RS, L).cf).toBeCloseTo(4.658e-3, 5);
  });
});

describe('plan 0076: DRAG-25 body form factor and DRAG-24 fin friction at the fin chord', () => {
  it('DRAG-25: Niskanen 1 + 1/(2f) and the DATCOM 1 + 60/f³ + 0.0025 f', () => {
    // f = 10: 1 + 1/20 = 1.05; 1 + 60/1000 + 0.025 = 1.085. f = 20: 1.025; 1 + 0.0075 + 0.05 = 1.0575.
    expect(bodyFormFactor(10, 'niskanen')).toBeCloseTo(1.05, 15);
    expect(bodyFormFactor(10, 'datcom')).toBeCloseTo(1.085, 15);
    expect(bodyFormFactor(20, 'niskanen')).toBeCloseTo(1.025, 15);
    expect(bodyFormFactor(20, 'datcom')).toBeCloseTo(1.0575, 15);
    expect(() => bodyFormFactor(0, 'datcom')).toThrow(InvalidInputError);
  });

  // A body of 0.2 m² wetted area and fineness 10, fins of 0.05 m² at t/c̄ = 0.003/0.1, A_ref = 0.002 m².
  // Rocket length 1 m at R = 10⁶: C_f = 1/(1.5 ln 10⁶ − 5.6)² = 1/15.12327² = 4.372289·10⁻³.
  // Fin chord 0.1 m at R = 10⁵: C_f = 1/(1.5 ln 10⁵ − 5.6)² = 1/11.66939² = 7.343512·10⁻³.
  const cfRocket = 4.372289e-3;
  const cfFin = 7.343512e-3;
  const geometry = {
    finenessRatio: 10,
    wettedBodyArea: 0.2,
    finSets: [{ wettedArea: 0.05, thickness: 0.003, meanChord: 0.1 }],
    referenceArea: 0.002,
  };

  it('eq. (3.85): (1.05 × 0.2 + 1.06 × 0.05) × 4.372289·10⁻³ / 0.002 = 0.574956', () => {
    expect(frictionDragCoefficient(cfRocket, geometry)).toBeCloseTo(0.574956, 5);
  });
  it('the DATCOM body factor: (1.085 × 0.2 + 1.06 × 0.05) × 4.372289·10⁻³ / 0.002 = 0.590259', () => {
    expect(
      frictionDragCoefficient(cfRocket, { ...geometry, bodyFormFactor: 'datcom' }),
    ).toBeCloseTo(0.590259, 5);
  });
  it('with each fin set at its own chord: (0.217 × 4.372289·10⁻³ + 0.053 × 7.343512·10⁻³) / 0.002 = 0.668996', () => {
    expect(
      frictionDragCoefficient(cfRocket, {
        ...geometry,
        bodyFormFactor: 'datcom',
        finFriction: (chord) => (chord === 0.1 ? cfFin : NaN),
      }),
    ).toBeCloseTo(0.668996, 5);
  });
  it("Niskanen's factor without fin friction is eq. (3.85) bit for bit (the comparison mode)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1e-4, max: 1e-2, noNaN: true }),
        fc.double({ min: 2, max: 40, noNaN: true }),
        fc.double({ min: 0.01, max: 1, noNaN: true }),
        (cfc, f, wet) => {
          const g = { ...geometry, finenessRatio: f, wettedBodyArea: wet };
          const fins = (1 + (2 * 0.003) / 0.1) * 0.05;
          const expected = (cfc * ((1 + 1 / (2 * f)) * wet + fins)) / 0.002;
          return (
            frictionDragCoefficient(cfc, g) === expected &&
            frictionDragCoefficient(cfc, { ...g, bodyFormFactor: 'niskanen' }) === expected
          );
        },
      ),
      { numRuns: 200 },
    );
  });
  it('a fin whose own C_fc equals the body’s gives eq. (3.85) again', () => {
    const a = frictionDragCoefficient(cfRocket, { ...geometry, bodyFormFactor: 'datcom' });
    const b = frictionDragCoefficient(cfRocket, {
      ...geometry,
      bodyFormFactor: 'datcom',
      finFriction: () => cfRocket,
    });
    expect(b).toBeCloseTo(a, 14);
  });
});
