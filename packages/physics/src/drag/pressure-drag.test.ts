/** Pressure, fin, base and parasitic drag (plan 0009, DRAG-5 to DRAG-12). */
import { describe, expect, it } from 'vitest';
import { InvalidInputError, NotImplementedError } from '../errors.js';
import type { NoseShape } from '../geometry/profiles.js';
import { mach } from '../units/si.js';
import { baseDragArea, launchLugDrag, railButtonDrag } from './base-parasitic.js';
import { finPressureDrag, roundedLeadingEdgeDrag } from './fin-drag.js';
import {
  baseDragCoefficient,
  boatTailPressureDrag,
  noseConePressureDrag,
  shoulderPressureDrag,
  stagnationDragCoefficient,
  stagnationPressureRatio,
} from './pressure-drag.js';

describe('DRAG-5 stagnation pressure, eqs. (B.1), (B.2)', () => {
  it('M = 0.5: 1 + 0.0625 + 0.0015625 = 1.0640625, × 0.85 = 0.904453; M = 2: 1.84 − 0.19 + 0.010375 + 0.000547 = 1.660922', () => {
    expect(stagnationPressureRatio(mach(0.5))).toBeCloseTo(1.0640625, 12);
    expect(stagnationDragCoefficient(mach(0.5))).toBeCloseTo(0.904453125, 9);
    expect(stagnationPressureRatio(mach(2))).toBeCloseTo(1.66092188, 8);
    expect(stagnationPressureRatio(mach(0))).toBe(1);
  });
});

describe('DRAG-6 to DRAG-8 nose cone pressure drag', () => {
  // Cone with f_N = 2: tan ε = 0.25, ε = 0.244979 rad, sin ε = 0.242536, joint angle φ = ε.
  const EPS = Math.atan(0.25);
  it('conical, supersonic M = 2 (B.4): 2.1 sin²ε + 0.5 sin ε/√3 = 0.123529 + 0.070014 = 0.193543', () => {
    const r = noseConePressureDrag('conical', undefined, 2, EPS, mach(2));
    expect(r.cd).toBeCloseTo(0.193543, 6);
    expect(r.method).toBe('conical-supersonic');
  });
  it('conical at M = 1 equals sin ε (B.6) = 0.242536; the transonic cubic is continuous at 1 and 1.3', () => {
    expect(noseConePressureDrag('conical', undefined, 2, EPS, mach(1)).cd).toBeCloseTo(0.242536, 6);
    const below = noseConePressureDrag('conical', undefined, 2, EPS, mach(1.3 - 1e-9)).cd;
    const at = noseConePressureDrag('conical', undefined, 2, EPS, mach(1.3)).cd;
    expect(Math.abs(below - at)).toBeLessThan(1e-6);
    // Just below M = 1 the subsonic interpolation meets sin ε too.
    expect(
      Math.abs(noseConePressureDrag('conical', undefined, 2, EPS, mach(1 - 1e-9)).cd - 0.242536),
    ).toBeLessThan(1e-5);
  });
  it('conical subsonic (3.87): C₀ = 0.8 sin²ε = 0.047059; b = 1.464554/0.195477 = 7.4922; at M = 0.5: 0.195477 × 0.5^7.4922 + 0.047059 = 0.0481445', () => {
    // 0.5^7.4922 = e^(−7.4922 × 0.693147) = e^(−5.19320) = 0.0055523; × 0.195477 = 0.0010854.
    const r = noseConePressureDrag('conical', undefined, 2, EPS, mach(0.5));
    expect(r.cd).toBeCloseTo(0.0481445, 6);
    expect(r.method).toBe('subsonic-interpolation');
    expect(noseConePressureDrag('conical', undefined, 2, EPS, mach(0)).cd).toBeCloseTo(0.047059, 6);
  });
  it('ogive: conical value × (0.72(κ − 0.5)² + 0.82): κ = 1 → 1.0, κ = 0.5 → 0.82; joint angle 0 for a tangent ogive gives C₀ = 0', () => {
    const cone = noseConePressureDrag('conical', undefined, 2, 0, mach(2)).cd;
    expect(noseConePressureDrag('ogive', 1, 2, 0, mach(2)).cd).toBeCloseTo(cone, 12);
    expect(noseConePressureDrag('ogive', 0.5, 2, 0, mach(2)).cd).toBeCloseTo(0.82 * cone, 12);
    expect(noseConePressureDrag('ogive', 1, 2, 0, mach(0)).cd).toBe(0);
  });
});

describe("DRAG-15 to DRAG-17 nose pressure drag from Stoney's curves (NASA TR R-100 Figure 12, D-055)", () => {
  it('C₀ at Mach 1.2 from (B.1), (B.2): 1.84 − 0.527778 + 0.080054 + 0.011721 = 1.403998, × 0.85 = 1.193398', () => {
    expect(stagnationDragCoefficient(mach(1.2))).toBeCloseTo(1.193398, 6);
  });
  it('Von Kármán (Haack κ = 0) at f_N = 3 and Mach 1.2 returns the table value 0.0741 exactly ((B.9) exponent log₄4 = 1)', () => {
    const r = noseConePressureDrag('haack', 0, 3, 0, mach(1.2));
    expect(r.cd).toBeCloseTo(0.0741, 12);
    expect(r.method).toBe('stoney-data');
    expect(r.warnings.join('\n')).toContain('TR R-100');
    expect(r.warnings.join('\n')).toContain('±0.005');
  });
  it('(B.9) at f_N = 1: exponent log₄2 = 0.5, C = √(C₀ C₃) = √(1.193398 × 0.0741) = 0.297373; at f_N = 5: exponent 1.292481, C = 1.193398 × (0.0741/1.193398)^1.292481 = 0.032870', () => {
    expect(noseConePressureDrag('haack', 0, 1, 0, mach(1.2)).cd).toBeCloseTo(0.297373, 6);
    expect(noseConePressureDrag('haack', 0, 5, 0, mach(1.2)).cd).toBeCloseTo(0.03287, 6);
  });
  it('linear interpolation in Mach between points: x^1/2 at f_N = 3 and Mach 1.3 = 0.0924 + (0.0835 − 0.0924) × 0.05/0.15 = 0.089433; x^1/2 is the default κ = 0.5', () => {
    expect(noseConePressureDrag('power', 0.5, 3, 0, mach(1.3)).cd).toBeCloseTo(0.089433, 6);
    expect(noseConePressureDrag('power', undefined, 3, 0, mach(1.3)).cd).toBeCloseTo(0.089433, 6);
  });
  it('shape-parameter interpolation (DRAG-17): Haack κ = 1/6 at Mach 1.6, f_N = 3 = (0.0871 + 0.1139)/2 = 0.1005; power κ = 0.6 at Mach 1.4 = 0.6 × 0.0835 + 0.4 × 0.0875 = 0.0851', () => {
    expect(noseConePressureDrag('haack', 1 / 6, 3, 0, mach(1.6)).cd).toBeCloseTo(0.1005, 6);
    expect(noseConePressureDrag('power', 0.6, 3, 0, mach(1.4)).cd).toBeCloseTo(0.0851, 6);
  });
  it('beyond the data the last value is held with a warning: x^1/2 at Mach 2.5 = 0.0899', () => {
    const r = noseConePressureDrag('power', 0.5, 3, 0, mach(2.5));
    expect(r.cd).toBeCloseTo(0.0899, 6);
    expect(r.method).toBe('stoney-data-held');
    expect(r.warnings.join('\n')).toContain('held');
  });
  it('the ellipsoid data begin at Mach 1.2: (3.87) fitted there with C_t = 0.1344 and slope (0.1435 − 0.1344)/0.1 = 0.091: b = 0.091 × 1.2/0.1344 = 0.8125, a = 0.1344/1.2^0.8125 = 0.115895; at Mach 0.6: 0.076527; a warning names the late start', () => {
    const r = noseConePressureDrag('elliptical', undefined, 3, 0, mach(0.6));
    expect(r.cd).toBeCloseTo(0.076527, 6);
    expect(r.method).toBe('subsonic-interpolation');
    expect(r.warnings.join('\n')).toContain('begin at Mach 1.2');
    expect(noseConePressureDrag('elliptical', undefined, 3, 0, mach(0.3)).cd).toBeCloseTo(
      0.043574,
      6,
    );
    // Continuity at the join.
    const below = noseConePressureDrag('elliptical', undefined, 3, 0, mach(1.2 - 1e-9)).cd;
    expect(Math.abs(below - 0.1344)).toBeLessThan(1e-6);
  });
  it('the slope at the join includes the Mach dependence of C₀ when f_N ≠ 3: ellipsoid at f_N = 5: C(1.2) = 0.070960, dC/dM = 0.053906, b = 0.911606, a = 0.060094; at Mach 0.6: 0.037722', () => {
    // e = log₄6 = 1.292481; C₀′ = 0.85 (1.52/1.728 − 0.664/2.48832 − 0.21/3.583181) = 0.85 × 0.554107 = 0.470991;
    // dC/dM = C [(1 − e) C₀′/C₀ + e C₃′/C₃] = 0.070960 × (−0.292481 × 0.394664 + 1.292481 × 0.677083) = 0.053906.
    const r = noseConePressureDrag('elliptical', undefined, 5, 0, mach(0.6));
    expect(r.cd).toBeCloseTo(0.037722, 6);
    expect(noseConePressureDrag('elliptical', undefined, 5, 0, mach(1.2)).cd).toBeCloseTo(
      0.07096,
      6,
    );
  });
  it('the drag never falls below the low-speed value: x^3/4 with joint angle atan(0.125), C₀ = 0.8 sin²φ = 0.012308; at Mach 0.85 the scaled data give 0.0028 so C₀ is kept; at Mach 0.95 the data (0.0312) win', () => {
    const phi = Math.atan(0.125);
    const low = noseConePressureDrag('power', 0.75, 3, phi, mach(0.85));
    expect(low.cd).toBeCloseTo(0.012308, 6);
    expect(low.method).toBe('low-subsonic-constant');
    expect(noseConePressureDrag('power', 0.75, 3, phi, mach(0.5)).cd).toBeCloseTo(0.012308, 6);
    const high = noseConePressureDrag('power', 0.75, 3, phi, mach(0.95));
    expect(high.cd).toBeCloseTo(0.0312, 6);
    expect(high.method).toBe('stoney-data');
  });
  it('a smooth Von Kármán nose is 0 below its data (Mach 0.9) and continuous into them', () => {
    const r = noseConePressureDrag('haack', 0, 4, 0, mach(0.5));
    expect(r.cd).toBe(0);
    expect(r.method).toBe('low-subsonic-constant');
    expect(noseConePressureDrag('haack', 0, 4, 0, mach(0.9)).cd).toBe(0);
    expect(noseConePressureDrag('haack', 0, 4, 0, mach(0.95)).cd).toBeGreaterThan(0);
  });
  it('the cone endpoints of the parameter families delegate to the conical method at the exact cone parameter (D-055)', () => {
    const cone = noseConePressureDrag('conical', undefined, 3, Math.atan(1 / 6), mach(1.5)).cd;
    expect(noseConePressureDrag('power', 1, 3, Math.atan(1 / 6), mach(1.5)).cd).toBe(cone);
    expect(noseConePressureDrag('parabolic', 0, 3, Math.atan(1 / 6), mach(1.5)).cd).toBe(cone);
    // Just inside the family the cone endpoint is Stoney's cone curve: κ = 0.999 power at Mach 2, weight (0.999 − 0.75)/0.25 = 0.996: 0.004 × 0.0795 + 0.996 × 0.1018 = 0.101711.
    expect(noseConePressureDrag('power', 0.999, 3, Math.atan(1 / 6), mach(2)).cd).toBeCloseTo(
      0.004 * 0.0795 + 0.996 * 0.1018,
      6,
    );
  });
  it('parameters outside the measured range are not implemented: power κ = 0.2', () => {
    expect(() => noseConePressureDrag('power', 0.2, 3, 0, mach(0.5))).toThrow(NotImplementedError);
  });
  it('the curves are monotone in Mach where (3.87) applies and continuous everywhere (sampled)', () => {
    const shapes: [NoseShape, number | undefined][] = [
      ['elliptical', undefined],
      ['parabolic', 0.75],
      ['parabolic', 1],
      ['power', 0.25],
      ['power', 0.4],
      ['haack', 0],
      ['haack', 1 / 3],
    ];
    for (const [shape, k] of shapes) {
      let prev = noseConePressureDrag(shape, k, 4, 0.1, mach(0)).cd;
      let prevM = 0;
      for (let M = 0.001; M <= 4; M += 0.001) {
        const cd = noseConePressureDrag(shape, k, 4, 0.1, mach(M)).cd;
        expect(Number.isFinite(cd)).toBe(true);
        // No jump larger than the steepest data segment allows (0.2 per 0.05 Mach).
        expect(Math.abs(cd - prev)).toBeLessThan(4 * (M - prevM) + 1e-9);
        if (M < 0.8) expect(cd).toBeGreaterThanOrEqual(prev - 1e-12);
        prev = cd;
        prevM = M;
      }
    }
  });
  it('a very blunt nose is flagged; invalid inputs throw', () => {
    expect(noseConePressureDrag('conical', undefined, 0.4, 0.9, mach(0.3)).warnings[0]).toContain(
      'blunt',
    );
    expect(() => noseConePressureDrag('conical', undefined, 0, 0, mach(0.3))).toThrow(
      InvalidInputError,
    );
    expect(() => noseConePressureDrag('conical', undefined, 2, 2, mach(0.3))).toThrow(
      InvalidInputError,
    );
  });
});

describe('DRAG-9 shoulders and boat tails', () => {
  it('shoulder: the nose rule with the half-apex angle of the step; a warning from Mach 0.8', () => {
    // Fore 0.02, aft 0.03, length 0.05: equivalent f_N = 0.05/(2 × 0.01) = 2.5.
    const r = shoulderPressureDrag(
      'conical',
      undefined,
      0.05,
      0.02,
      0.03,
      Math.atan(0.2),
      mach(0.3),
    );
    expect(r.cd).toBeCloseTo(
      noseConePressureDrag('conical', undefined, 2.5, Math.atan(0.2), mach(0.3)).cd,
      12,
    );
    expect(r.warnings).toEqual([]);
    expect(
      shoulderPressureDrag(
        'conical',
        undefined,
        0.05,
        0.02,
        0.03,
        Math.atan(0.2),
        mach(0.9),
      ).warnings.join(),
    ).toContain('dubious');
    expect(() =>
      shoulderPressureDrag('conical', undefined, 0.05, 0.03, 0.02, 0, mach(0.3)),
    ).toThrow(InvalidInputError);
  });
  it('boat tail R2: γ = 0.05/(0.054 − 0.036) = 2.7778, factor (3 − γ)/2 = 0.11111; × base 0.12 at M = 0 gives 0.013333', () => {
    const r = boatTailPressureDrag(0.05, 0.027, 0.018, mach(0));
    expect(r.lengthToHeight).toBeCloseTo(2.77778, 5);
    expect(r.cd).toBeCloseTo(0.0133333, 7);
    expect(boatTailPressureDrag(0.01, 0.027, 0.018, mach(0)).cd).toBeCloseTo(0.12, 12); // γ = 0.556 < 1
    expect(boatTailPressureDrag(0.1, 0.027, 0.018, mach(0)).cd).toBe(0); // γ = 5.56 > 3
    expect(boatTailPressureDrag(0.05, 0.027, 0.018, mach(0.9)).warnings.join()).toContain(
      'expansion fans',
    );
    expect(() => boatTailPressureDrag(0.05, 0.018, 0.027, mach(0))).toThrow(InvalidInputError);
  });
});

describe('DRAG-10 fin pressure drag, eqs. (3.89) to (3.93)', () => {
  it('rounded leading edge at M = 0.5: 0.75^(−0.417) − 1 = 0.1274556; at 0.95: 1 − 1.785 × 0.05 = 0.91075; at 2: 1.214 − 0.1255 + 0.006844 = 1.095344', () => {
    expect(roundedLeadingEdgeDrag(mach(0.5))).toBeCloseTo(0.1274556, 6);
    expect(roundedLeadingEdgeDrag(mach(0.95))).toBeCloseTo(0.91075, 6);
    expect(roundedLeadingEdgeDrag(mach(2))).toBeCloseTo(1.095344, 6);
  });
  it('square fins, sweep tan Γ_L = 0.625 (cos² = 0.719101), M = 0.5: LE 0.904453 × 0.719101 = 0.650393, TE 0.1525, total 0.802893', () => {
    const r = finPressureDrag('square', Math.atan(0.625), mach(0.5));
    expect(r.leadingEdge).toBeCloseTo(0.650393, 6);
    expect(r.trailingEdge).toBeCloseTo(0.1525, 12);
    expect(r.cd).toBeCloseTo(0.802893, 6);
  });
  it('rounded: half the base drag at the trailing edge; airfoil: none', () => {
    const rounded = finPressureDrag('rounded', 0, mach(0.5));
    expect(rounded.leadingEdge).toBeCloseTo(0.1274556, 6);
    expect(rounded.trailingEdge).toBeCloseTo(0.07625, 12);
    const airfoil = finPressureDrag('airfoil', 0, mach(0.5));
    expect(airfoil.trailingEdge).toBe(0);
    expect(() => finPressureDrag('square', Math.PI / 2, mach(0.5))).toThrow(InvalidInputError);
  });
});

describe('DRAG-11, DRAG-12 base and parasitic drag', () => {
  it('base coefficient: 0.1525 at M = 0.5, 0.25 at M = 1 from both sides, 0.125 at M = 2', () => {
    expect(baseDragCoefficient(mach(0.5))).toBeCloseTo(0.1525, 12);
    expect(baseDragCoefficient(mach(1))).toBe(0.25);
    expect(baseDragCoefficient(mach(1 - 1e-12))).toBeCloseTo(0.25, 9);
    expect(baseDragCoefficient(mach(2))).toBe(0.125);
  });
  it('base area: R1 base π 0.025² minus the D12 π 0.012² = 1.96350·10⁻³ − 4.5239·10⁻⁴ = 1.51111·10⁻³ m²; never negative', () => {
    expect(baseDragArea(0.025, 0.024)).toBeCloseTo(1.51111e-3, 8);
    expect(baseDragArea(0.025, undefined)).toBeCloseTo(1.9635e-3, 8);
    expect(baseDragArea(0.01, 0.024)).toBe(0);
  });
  it('R1 launch lug (l = 50 mm, d = 6 mm, l/d = 8.33): factor 1, area π 0.003² = 2.8274·10⁻⁵; a wire loop (l = 0): factor 1.3 and the annulus', () => {
    const lug = launchLugDrag(0.05, 0.003, 0.0025, mach(0));
    expect(lug.cd).toBeCloseTo(0.85, 12);
    expect(lug.area).toBeCloseTo(2.8274e-5, 9);
    const loop = launchLugDrag(0, 0.003, 0.0025, mach(0));
    expect(loop.cd).toBeCloseTo(1.105, 12);
    expect(loop.area).toBeCloseTo(Math.PI * (0.003 ** 2 - 0.0025 ** 2), 12);
    // l = d/2: factor 1.15, half the inner area removed.
    const half = launchLugDrag(0.003, 0.003, 0.0025, mach(0));
    expect(half.cd).toBeCloseTo(1.15 * 0.85, 12);
    expect(half.area).toBeCloseTo(Math.PI * 0.003 ** 2 - Math.PI * 0.0025 ** 2 * 0.5, 12);
  });
  it('rail button: stagnation drag on the frontal area D × h', () => {
    const b = railButtonDrag(0.01, 0.01, mach(0.5));
    expect(b.cd).toBeCloseTo(0.904453, 6);
    expect(b.area).toBeCloseTo(1e-4, 12);
    expect(() => railButtonDrag(0, 0.01, mach(0))).toThrow(InvalidInputError);
  });
});
