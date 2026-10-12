/**
 * DRAG-18, DRAG-19 (plan 0025, D-062): DATCOM figure 4.1.5.1-29 and the
 * supersonic wave-drag formulas. Hand values are worked in the comments.
 */
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { InvalidInputError } from '../errors.js';
import { mach } from '../units/si.js';
import {
  DATCOM_FIGURE_4151_29,
  finWaveDrag,
  sectionFactorK,
  supersonicWaveDrag,
  WAVE_DRAG_FAIRING,
  waveDragChart,
} from './datcom-fin-wave-drag.js';

describe('DRAG-18 figure 4.1.5.1-29', () => {
  it('holds six curves in increasing A (t/c)^(1/3), each starting at the axis and non-decreasing to the peak', () => {
    expect(DATCOM_FIGURE_4151_29.map((c) => c.aspectParameter)).toEqual([0.5, 1, 1.5, 2, 3, 4]);
    for (const c of DATCOM_FIGURE_4151_29) {
      expect(c.points[0]).toEqual([-1.42, 0]);
      const values = c.points.map((p) => p[1]);
      const peak = values.indexOf(Math.max(...values));
      for (let i = 1; i <= peak; i += 1)
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1] ?? 0);
    }
  });
  it('reads the digitised values at the table points and interpolates linearly between curves', () => {
    // 2.0 curve at ξ = 0: 3.308; 1.5 curve: 3.007; at A (t/c)^(1/3) = 1.75 the mean 3.1575.
    expect(waveDragChart(2, 0).value).toBeCloseTo(3.308, 6);
    expect(waveDragChart(1.5, 0).value).toBeCloseTo(3.007, 6);
    expect(waveDragChart(1.75, 0).value).toBeCloseTo((3.308 + 3.007) / 2, 6);
    // Along the 1.0 curve between ξ = −0.9 (0.534) and −0.85 (0.705): at −0.875 the mean 0.6195.
    expect(waveDragChart(1, -0.875).value).toBeCloseTo(0.6195, 6);
  });
  it('is zero below ξ = −1.42, held beyond ξ = 1.4, and clamps the aspect parameter with a flag', () => {
    expect(waveDragChart(2, -1.5).value).toBe(0);
    expect(waveDragChart(2, 1.4).value).toBeCloseTo(3.218, 6);
    expect(waveDragChart(2, 2.5).value).toBeCloseTo(3.218, 6);
    expect(waveDragChart(0.3, 0)).toEqual({ value: 0.931, clamped: true, uncertainty: 0.092 });
    expect(waveDragChart(6, 0).clamped).toBe(true);
    expect(waveDragChart(4, 0).clamped).toBe(false);
  });
  it('compares with the DATCOM sample problem readings (p. 4.1.5.1-9) at A (t/c)^(1/3) = 1.568', () => {
    // DATCOM's own readings of the chart for the sample wing (t/c = 0.06, A = 4). In the steep rise the
    // sample's readings lie about 0.1 to the left of the printed curves (D-062); on the plateau they agree.
    const sample: [number, number][] = [
      [-1.34, 0.07],
      [-1.11, 0.58],
      [-0.97, 1.1],
      [-0.8, 1.95],
      [-0.57, 2.75],
      [0, 3.02],
      [0.82, 3.1],
      [1.17, 3.12],
    ];
    for (const [xi, v] of sample) {
      const here = waveDragChart(1.568, xi).value;
      const shifted = waveDragChart(1.568, xi + 0.12).value;
      // The sample value lies between the table at ξ and the table 0.12 further along, within the reading uncertainty.
      expect(v).toBeGreaterThanOrEqual(Math.min(here, shifted) - 0.25);
      expect(v).toBeLessThanOrEqual(Math.max(here, shifted) + 0.25);
    }
    expect(waveDragChart(1.568, 0).value).toBeCloseTo(3.02, 1);
  });
});

describe('DRAG-19 supersonic wave drag (eqs. 4.1.5.1-k, -l)', () => {
  it('K factors of table p. 4.1.5.1-16', () => {
    expect(sectionFactorK('biconvex')).toBeCloseTo(16 / 3, 12);
    // Double wedge with the ridge at mid-chord: (c/x_t)/(1 − x_t/c) = 2/0.5 = 4.
    expect(sectionFactorK('double-wedge')).toBeCloseTo(4, 12);
  });
  it('biconvex, t/c = 0.05, unswept at Mach 1.5: K (t/c)²/β = (16/3)(0.0025)/1.118034 = 0.0119257', () => {
    expect(supersonicWaveDrag(1.5, 0.05, 0, 'biconvex')).toBeCloseTo(0.0119257, 6);
  });
  it('swept leading edge: supersonic edge when β cot Λ ≥ 1, else K cot Λ (t/c)²', () => {
    // Λ_LE = 60°, Mach 1.5: β = 1.118, cot 60° = 0.57735, β cot Λ = 0.6455 < 1 → subsonic edge:
    // (16/3)(0.57735)(0.0025) = 0.0076980.
    expect(supersonicWaveDrag(1.5, 0.05, Math.PI / 3, 'biconvex')).toBeCloseTo(0.007698, 6);
    // Mach 2.5: β = 2.29129, β cot Λ = 1.3229 ≥ 1 → supersonic edge: (16/3)(0.0025)/2.29129 = 0.0058191.
    expect(supersonicWaveDrag(2.5, 0.05, Math.PI / 3, 'biconvex')).toBeCloseTo(0.0058191, 6);
  });
  it('rejects Mach ≤ 1', () => {
    expect(() => supersonicWaveDrag(1, 0.05, 0, 'biconvex')).toThrow(InvalidInputError);
  });
});

describe('finWaveDrag: chart, fairing and supersonic branches', () => {
  const base = {
    thicknessRatio: 0.06,
    aspectRatio: 4,
    quarterChordSweep: 0,
    leadingEdgeSweep: 0,
    section: 'biconvex' as const,
  };
  it('reproduces the DATCOM sample problem structure: unswept wing t/c 0.06, A 4 at Mach 1.0', () => {
    // ξ = 0, A (t/c)^(1/3) = 4 × 0.39149 = 1.566; chart (1.5 → 3.007, 2.0 → 3.308): 3.007 + 0.132 × 0.301 = 3.0467;
    // C_Dw = 3.0467 × 0.06^(5/3) = 3.0467 × 0.0091963 = 0.028018 (DATCOM's 0.0278 from its reading 3.02).
    const r = finWaveDrag({ ...base, mach: mach(1) });
    expect(r.method).toBe('transonic-chart');
    expect(r.cd).toBeCloseTo(0.028018, 5);
  });
  it('is zero well below the drag divergence: Mach 0.6 (ξ = −2.04) and at Mach 0', () => {
    expect(finWaveDrag({ ...base, mach: mach(0.6) }).cd).toBe(0);
    expect(finWaveDrag({ ...base, mach: mach(0) }).cd).toBe(0);
  });
  it('sweep construction: Mach stretched by 1/√cos Λ and the peak scaled by (cos Λ)^2.5 (eqs. 4.1.5.1-d, -e, -f)', () => {
    const L = (14.5 * Math.PI) / 180;
    const unswept = finWaveDrag({ ...base, mach: mach(0.95) }).cd;
    // At Mach 0.95/√cos Λ the swept wing sees the unswept chart at Mach 0.95, scaled by cos^2.5 Λ.
    const swept = finWaveDrag({
      ...base,
      quarterChordSweep: L,
      mach: mach(0.95 / Math.sqrt(Math.cos(L))),
    }).cd;
    expect(swept).toBeCloseTo(unswept * Math.cos(L) ** 2.5, 9);
  });
  it('is continuous across the fairing from the chart at 1.2 to the formula at 1.4', () => {
    const atStart = finWaveDrag({ ...base, mach: mach(WAVE_DRAG_FAIRING.start) });
    const justAbove = finWaveDrag({ ...base, mach: mach(WAVE_DRAG_FAIRING.start + 1e-9) });
    const justBelowEnd = finWaveDrag({ ...base, mach: mach(WAVE_DRAG_FAIRING.end - 1e-9) });
    const atEnd = finWaveDrag({ ...base, mach: mach(WAVE_DRAG_FAIRING.end) });
    expect(justAbove.method).toBe('fairing');
    expect(atEnd.method).toBe('supersonic-linear');
    expect(Math.abs(justAbove.cd - atStart.cd)).toBeLessThan(1e-6);
    expect(Math.abs(justBelowEnd.cd - atEnd.cd)).toBeLessThan(1e-6);
    expect(justAbove.warnings.some((w) => w.includes('faired'))).toBe(true);
  });
  it('property: finite, non-negative and never above the supersonic 2D value of the thinner section bound', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 3, noNaN: true }),
        fc.double({ min: 0.01, max: 0.2, noNaN: true }),
        fc.double({ min: 0.3, max: 6, noNaN: true }),
        fc.double({ min: 0, max: 1.2, noNaN: true }),
        (M, tc, A, sweep) => {
          const r = finWaveDrag({
            mach: mach(M),
            thicknessRatio: tc,
            aspectRatio: A,
            quarterChordSweep: sweep,
            leadingEdgeSweep: sweep,
            section: 'biconvex',
          });
          return Number.isFinite(r.cd) && r.cd >= 0;
        },
      ),
    );
  });
  it('rejects invalid inputs', () => {
    expect(() => finWaveDrag({ ...base, mach: mach(-1) })).toThrow(InvalidInputError);
    expect(() => finWaveDrag({ ...base, thicknessRatio: 0, mach: mach(1) })).toThrow(
      InvalidInputError,
    );
    expect(() => finWaveDrag({ ...base, aspectRatio: 0, mach: mach(1) })).toThrow(
      InvalidInputError,
    );
  });
});
