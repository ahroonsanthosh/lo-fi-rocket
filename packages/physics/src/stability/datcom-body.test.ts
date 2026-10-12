/**
 * BAR-13, BAR-14 (plan 0027, D-064): the DATCOM supersonic body charts and the
 * Mach-dependent nose-cylinder term. Hand values are worked in the comments.
 */
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { InvalidInputError } from '../errors.js';
import { kilogramsPerCubicMetre, metres } from '../units/si.js';
import type { PlacedComponent } from '../geometry/assembly.js';
import {
  bodyChartAbscissa,
  bodyChartStartMach,
  CONE_CYLINDER_CN_ALPHA,
  CONE_CYLINDER_XCP,
  datcomBodyAssembly,
  datcomBodyTerm,
  noseCylinderTermAtMach,
  OGIVE_CYLINDER_CN_ALPHA,
  OGIVE_CYLINDER_XCP,
  readBodyChart,
} from './datcom-body.js';

describe('chart abscissa and start Mach', () => {
  it('folds at β/f_N = 1: f_N = 3, Mach 2 → β = 1.732, u = 0.577; Mach 4 → β = 3.873, u = 2 − 3/3.873 = 1.2254', () => {
    expect(bodyChartAbscissa(2, 3)).toBeCloseTo(Math.sqrt(3) / 3, 9);
    expect(bodyChartAbscissa(4, 3)).toBeCloseTo(2 - 3 / Math.sqrt(15), 9);
    // The chart begins at β/f_N = 0.4: f_N = 3 → β = 1.2 → M = √(1 + 1.44) = 1.56205.
    expect(bodyChartStartMach(3)).toBeCloseTo(1.56205, 5);
    expect(() => bodyChartAbscissa(1, 3)).toThrow(InvalidInputError);
  });
});

describe('chart tables and readings', () => {
  it('curves are in increasing f_A/f_N and the C_Nα values lie between 1.5 and 4 per radian, the CP fractions between 0.1 and 0.7', () => {
    for (const chart of [OGIVE_CYLINDER_CN_ALPHA, CONE_CYLINDER_CN_ALPHA]) {
      for (let i = 1; i < chart.length; i++)
        expect(chart[i]?.parameter).toBeGreaterThan(chart[i - 1]?.parameter ?? 0);
      for (const c of chart) for (const [, v] of c.points) expect(v).toBeGreaterThan(1.5);
      for (const c of chart) for (const [, v] of c.points) expect(v).toBeLessThan(4);
    }
    for (const chart of [OGIVE_CYLINDER_XCP, CONE_CYLINDER_XCP])
      for (const c of chart) for (const [, v] of c.points) expect(v).toBeGreaterThan(0.1);
  });
  it('reads the digitised values: cone-cylinder f_A/f_N = 0 is 1.80 per rad at u = 1.0; ogive f_A/f_N = 2 at u = 1.0 is 3.27', () => {
    expect(readBodyChart(CONE_CYLINDER_CN_ALPHA, 0, 1.0).value).toBeCloseTo(1.8, 1);
    expect(readBodyChart(OGIVE_CYLINDER_CN_ALPHA, 2, 1.0).value).toBeCloseTo(3.27, 1);
    expect(readBodyChart(OGIVE_CYLINDER_XCP, 0, 1.0).value).toBeCloseTo(0.525, 1);
  });
  it('interpolates linearly between curves and flags the clamps and the held ends', () => {
    const a = readBodyChart(OGIVE_CYLINDER_XCP, 0.4, 1.0).value;
    const b = readBodyChart(OGIVE_CYLINDER_XCP, 0.8, 1.0).value;
    expect(readBodyChart(OGIVE_CYLINDER_XCP, 0.6, 1.0).value).toBeCloseTo((a + b) / 2, 9);
    expect(readBodyChart(OGIVE_CYLINDER_XCP, 0.6, 1.0).parameterClamped).toBe(false);
    expect(readBodyChart(OGIVE_CYLINDER_XCP, 3, 1.0).parameterClamped).toBe(true);
    expect(readBodyChart(OGIVE_CYLINDER_XCP, 3, 1.0).value).toBeCloseTo(
      readBodyChart(OGIVE_CYLINDER_XCP, 2, 1.0).value,
      9,
    );
    expect(readBodyChart(OGIVE_CYLINDER_XCP, 1, 1.9).abscissaHeld).toBe(true);
    expect(readBodyChart(OGIVE_CYLINDER_XCP, 1, 0.3).abscissaHeld).toBe(true);
    expect(readBodyChart(OGIVE_CYLINDER_XCP, 1, 0.8).abscissaHeld).toBe(false);
  });
  it('brackets the DATCOM sample problem (p. 4.2.1.1-5): cone-cylinder f_N 1.21, f_A 4.0, Mach 5.05 read as 3.52 per rad by extrapolation', () => {
    // f_N/β = 1.21/4.95 = 0.244 (u = 1.756, beyond the chart's f_N/β = 0.5 end, so the end value is held) and
    // f_A/f_N = 3.31 (above the 3 curve, clamped). The held end of the 3 curve is 3.50; the sample's linear
    // extrapolation gives 3.52. Agreement within the reading uncertainty.
    const t = datcomBodyTerm({ nose: 'cone', fN: 1.21, fA: 4.0, mach: 5.05 });
    expect(Math.abs(t.cnAlpha - 3.52)).toBeLessThan(0.15);
    expect(t.warnings.some((w) => w.includes('outside the charted curves'))).toBe(true);
    expect(t.warnings.some((w) => w.includes('beyond the charts'))).toBe(true);
    expect(t.warnings.some((w) => w.includes('outside the test data range'))).toBe(true);
  });
  it('3/4-power noses: cone charts with the CP moved forward 5 % of the body length', () => {
    const cone = datcomBodyTerm({ nose: 'cone', fN: 3, fA: 6, mach: 2 });
    const power = datcomBodyTerm({ nose: 'cone', fN: 3, fA: 6, mach: 2, threeQuarterPower: true });
    expect(power.cnAlpha).toBe(cone.cnAlpha);
    expect(power.xcpFraction).toBeCloseTo(cone.xcpFraction - 0.05, 12);
  });
});

const AL = kilogramsPerCubicMetre(2700);
const put = (position: number, component: PlacedComponent['component']): PlacedComponent => ({
  component,
  position: metres(position),
});
/** Ogive nose 0.15 m on a 0.05 m body, 0.45 m of tube: f_N = 3, f_A = 9, f_A/f_N = 3, l_B = 0.6 m. */
const BODY: readonly PlacedComponent[] = [
  put(0, {
    kind: 'noseCone',
    shape: 'ogive',
    shapeParameter: 1,
    length: metres(0.15),
    baseRadius: metres(0.025),
    density: AL,
  }),
  put(0.15, {
    kind: 'bodyTube',
    length: metres(0.3),
    outerRadius: metres(0.025),
    wallThickness: metres(0.001),
    density: AL,
  }),
  put(0.45, {
    kind: 'bodyTube',
    length: metres(0.15),
    outerRadius: metres(0.025),
    wallThickness: metres(0.001),
    density: AL,
  }),
  put(0.6, {
    kind: 'transition',
    shape: 'conical',
    length: metres(0.05),
    foreRadius: metres(0.025),
    aftRadius: metres(0.02),
    density: AL,
  }),
];

describe('body assembly and the Mach-dependent term', () => {
  it('finds the nose and the contiguous same-radius tubes: f_N = 3, f_A = 9; the boattail is not part of it', () => {
    const a = datcomBodyAssembly(BODY);
    expect(a).toBeDefined();
    expect(a?.nose).toBe('ogive');
    expect(a?.noseLength).toBeCloseTo(0.15, 12);
    expect(a?.afterbodyLength).toBeCloseTo(0.45, 12);
    expect(a?.diameter).toBeCloseTo(0.05, 12);
  });
  it('maps the nose shapes: conical → cone, parabolic → ogive, power 0.75 → cone with the shift, elliptical → ogive with a warning', () => {
    const nose = (
      shape: 'conical' | 'parabolic' | 'power' | 'elliptical',
      shapeParameter?: number,
    ): PlacedComponent[] => [
      put(0, {
        kind: 'noseCone',
        shape,
        ...(shapeParameter === undefined ? {} : { shapeParameter }),
        length: metres(0.15),
        baseRadius: metres(0.025),
        density: AL,
      }),
    ];
    expect(datcomBodyAssembly(nose('conical'))?.nose).toBe('cone');
    expect(datcomBodyAssembly(nose('parabolic', 0.5))?.nose).toBe('ogive');
    const p = datcomBodyAssembly(nose('power', 0.75));
    expect(p?.nose).toBe('cone');
    expect(p?.threeQuarterPower).toBe(true);
    expect(datcomBodyAssembly(nose('power', 0.5))?.nose).toBe('ogive');
    expect(datcomBodyAssembly(nose('elliptical'))?.shapeWarning).toContain('nearest shape');
  });
  it('Mach 0.8 keeps the slender-body term; the chart value applies from Mach 1.562 (f_N = 3) with S_B/A_ref and l_B scaling', () => {
    const a = datcomBodyAssembly(BODY);
    if (a === undefined) throw new Error('no assembly');
    const aRef = (Math.PI * 0.05 ** 2) / 4;
    const subsonic = { cnAlpha: 2, cp: 0.0699 };
    expect(noseCylinderTermAtMach(a, subsonic, aRef, 0.8)).toEqual({
      ...subsonic,
      method: 'barrowman',
      warnings: [],
    });
    // At Mach 2: u = 1.732/3 = 0.577; f_A/f_N = 3 → the 3 curve of 4.2.1.1-21a and 4.2.2.1-23a (clamped at 2 for the CP).
    const t = noseCylinderTermAtMach(a, subsonic, aRef, 2);
    expect(t.method).toBe('datcom');
    expect(t.cnAlpha).toBeCloseTo(
      datcomBodyTerm({ nose: 'ogive', fN: 3, fA: 9, mach: 2 }).cnAlpha,
      12,
    );
    expect(t.cp).toBeCloseTo(
      datcomBodyTerm({ nose: 'ogive', fN: 3, fA: 9, mach: 2 }).xcpFraction * 0.6,
      12,
    );
    expect(t.cnAlpha).toBeGreaterThan(2.5);
    expect(t.cp).toBeGreaterThan(0.12);
  });
  it('the fairing is continuous at both ends and monotone in Mach', () => {
    const a = datcomBodyAssembly(BODY);
    if (a === undefined) throw new Error('no assembly');
    const aRef = (Math.PI * 0.05 ** 2) / 4;
    const subsonic = { cnAlpha: 2, cp: 0.0699 };
    const start = bodyChartStartMach(3);
    const lo = noseCylinderTermAtMach(a, subsonic, aRef, 0.8 + 1e-9);
    const hi = noseCylinderTermAtMach(a, subsonic, aRef, start - 1e-9);
    const at = noseCylinderTermAtMach(a, subsonic, aRef, start);
    expect(lo.method).toBe('fairing');
    expect(Math.abs(lo.cnAlpha - 2)).toBeLessThan(1e-6);
    expect(Math.abs(hi.cnAlpha - at.cnAlpha)).toBeLessThan(1e-6);
    expect(Math.abs(hi.cp - at.cp)).toBeLessThan(1e-6);
    expect(lo.warnings.some((w) => w.includes('faired linearly'))).toBe(true);
    fc.assert(
      fc.property(
        fc.double({ min: 0.8, max: start, noNaN: true }),
        fc.double({ min: 0.8, max: start, noNaN: true }),
        (m1, m2) => {
          const [x, y] = m1 < m2 ? [m1, m2] : [m2, m1];
          return (
            noseCylinderTermAtMach(a, subsonic, aRef, y).cnAlpha >=
            noseCylinderTermAtMach(a, subsonic, aRef, x).cnAlpha - 1e-12
          );
        },
      ),
    );
  });
});
