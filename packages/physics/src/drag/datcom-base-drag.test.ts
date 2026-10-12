/**
 * DRAG-21, DRAG-22 (plan 0032, D-069), against the DATCOM's own sample
 * problem for section 4.2.3.1 (pp. 4.2.3.1-6 and -7): (C_Df)_b = 0.0857,
 * d_b/d = 0.5, C_Db = 0.029 (0.5)³/√0.0857 = 0.0124 on S_B, i.e. 0.0496 on
 * the base area, then C_Db/(d_b/d)² read along figure 4.2.3.1-24 as 0.0496
 * (Mach 0.8), 0.06 (0.9), 0.075 (0.95), 0.115 (1.0), 0.038 (1.1), 0.035 (1.2).
 */
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import {
  datcomBaseDragAtMach,
  datcomSubsonicBaseDrag,
  DATCOM_FIGURE_4231_24,
} from './datcom-base-drag.js';

describe('DRAG-21 subsonic base drag, eq. 4.2.3.1-b', () => {
  it('reproduces the sample problem: 0.029 × 0.5/√0.0857 = 0.049532 on the base area', () => {
    // l_B/d = 10: 1 + 60/1000 + 0.025 = 1.085; with C_f = 0.0026, S_B = π (R = 1) the wetted area giving
    // (C_Df)_b = 0.0857 is 0.0857 π/(0.0026 × 1.085) = 95.4381.
    const wetted = (0.0857 * Math.PI) / (0.0026 * 1.085);
    const v = datcomSubsonicBaseDrag({
      skinFriction: 0.0026,
      wettedArea: wetted,
      length: 20,
      maxRadius: 1,
      baseRadius: 0.5,
    });
    expect(v).toBeCloseTo(0.049532, 5);
    // On S_B: × (d_b/d)² = 0.012383, the sample's 0.0124.
    expect(v * 0.25).toBeCloseTo(0.0124, 4);
  });
  it('rejects a base wider than the body', () => {
    expect(() =>
      datcomSubsonicBaseDrag({
        skinFriction: 0.003,
        wettedArea: 1,
        length: 1,
        maxRadius: 0.1,
        baseRadius: 0.2,
      }),
    ).toThrow(InvalidInputError);
  });
});

describe('DRAG-22 transonic guide curves, figure 4.2.3.1-24', () => {
  it("follows the sample problem's readings within 0.005", () => {
    const v0 = 0.0496;
    const sample: [number, number][] = [
      [0.8, 0.0496],
      [0.9, 0.06],
      [0.95, 0.075],
      [1.0, 0.115],
      [1.1, 0.038],
      [1.2, 0.035],
    ];
    for (const [m, expected] of sample) {
      expect(Math.abs((datcomBaseDragAtMach(v0, m) ?? Number.NaN) - expected)).toBeLessThan(0.006);
    }
  });
  it('is the subsonic value up to Mach 0.76 and lies on a curve when it starts on one', () => {
    expect(datcomBaseDragAtMach(0.0496, 0.5)).toBe(0.0496);
    const c2 = DATCOM_FIGURE_4231_24[1];
    if (c2 === undefined) throw new Error('curve missing');
    // Starting at curve 2's own value, the result is curve 2's reading (1.0125: 0.1489).
    expect(datcomBaseDragAtMach(c2.start, 1.0125)).toBeCloseTo(0.1489, 9);
  });
  it('is undefined outside the curves and rejects Mach above the chart', () => {
    expect(datcomBaseDragAtMach(0.2, 1)).toBeUndefined();
    expect(() => datcomBaseDragAtMach(0.05, 1.4)).toThrow(InvalidInputError);
  });
});
