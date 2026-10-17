/**
 * Plan 0083: the CP of the five reference rockets to 0.01 % and better. Each component's CP equals
 * its closed form from the source, worked by hand below; the 0.016 to 0.034 % residual against
 * OpenRocket 24.12 is all OpenRocket's numerical evaluation of the fin and nose geometry
 * (`reference/rockets/cp-probe/`, docs/reports/openrocket-issues.md item 7).
 */
import { describe, expect, it } from 'vitest';
import type { PlacedComponent } from '../geometry/assembly.js';
import {
  R1_COMPONENTS,
  R2_COMPONENTS,
  R3_COMPONENTS,
  R4_COMPONENTS,
  R5_COMPONENTS,
} from '../geometry/reference-rockets.js';
import { mach } from '../units/si.js';
import { centreOfPressure } from './barrowman.js';

/**
 * Fin CP, Niskanen eq. (3.34), p. 27, from the root leading edge x_r:
 *   x_r + (x_t/3)(c_r + 2c_t)/(c_r + c_t) + (1/6)(c_r² + c_t² + c_r c_t)/(c_r + c_t).
 * R1 c_r 0.1, c_t 0.05, x_t 0.05, x_r 0.5: 0.0222222 + 0.0194444 → 0.5416667.
 * R2 0.12, 0.04, 0.08, 0.63: 0.0333333 + 0.0216667 → 0.685.
 * R3 0.07, 0.03, 0.045, 0.48: 0.0195 + 0.0131667 → 0.5126667.
 * R4 0.15, 0.06, 0.09, 0.85: 0.0385714 + 0.0278571 → 0.9164286.
 * R5 0.075, 0.025, 0.05, 0.605: 0.0208333 + 0.0135417 → 0.639375.
 * Nose CP, eq. (3.28), p. 24, X = L − V/A(L):
 *   cone 2L/3 (R1 0.0666667); Von Kármán L/2 (R3 0.05, R5 0.065);
 *   tangent ogive by Simpson's rule on 200 000 intervals in an independent script
 *   (R2 L 0.15, R 0.027: 0.069263381; R4 L 0.2, R 0.033: 0.092507347).
 * OpenRocket's values are its component analysis at Mach 0.3 (`reference/rockets/cp-probe/`).
 */
const CASES: readonly {
  readonly name: string;
  readonly components: readonly PlacedComponent[];
  readonly fin: number;
  readonly nose: number;
  readonly openRocketFin: number;
  readonly openRocketNose: number;
}[] = [
  {
    name: 'R1',
    components: R1_COMPONENTS,
    fin: 0.5 + (0.05 / 3) * (0.2 / 0.15) + (0.01 + 0.0025 + 0.005) / 0.15 / 6,
    nose: 0.2 / 3,
    openRocketFin: 0.541578014,
    openRocketNose: 0.066666667,
  },
  {
    name: 'R2',
    components: R2_COMPONENTS,
    fin: 0.685,
    nose: 0.069263381,
    openRocketFin: 0.684787234,
    openRocketNose: 0.069265443,
  },
  {
    name: 'R3',
    components: R3_COMPONENTS,
    fin: 0.48 + 0.0195 + 0.079 / 6,
    nose: 0.05,
    openRocketFin: 0.512567376,
    openRocketNose: 0.050001378,
  },
  {
    name: 'R4',
    components: R4_COMPONENTS,
    fin: 0.85 + 0.03 * (0.27 / 0.21) + 0.0351 / 0.21 / 6,
    nose: 0.092507347,
    openRocketFin: 0.916223404,
    openRocketNose: 0.09251009,
  },
  {
    name: 'R5',
    components: R5_COMPONENTS,
    fin: 0.605 + (0.05 / 3) * 1.25 + 0.08125 / 6,
    nose: 0.065,
    openRocketFin: 0.639242021,
    openRocketNose: 0.065001792,
  },
];

const OR_MODE = { mach: mach(0.3), rollAngle: 'worst', finRollReduction: false } as const;

describe('CP of R1 to R5: every component at its closed form (plan 0083)', () => {
  for (const c of CASES) {
    it(`${c.name}: fin and nose CP equal the source's closed forms within 1e-6 %; OpenRocket's are 0.1 to 0.2 mm forward`, () => {
      const r = centreOfPressure(c.components, OR_MODE);
      const fin = r.contributions.find((x) => x.kind === 'finSet');
      const nose = r.contributions.find((x) => x.kind === 'noseCone');
      expect(Math.abs((fin?.cp as number) / c.fin - 1)).toBeLessThan(1e-8);
      expect(Math.abs((nose?.cp as number) / c.nose - 1)).toBeLessThan(1e-8);
      // OpenRocket integrates numerically: its fin CP is 0.09 to 0.21 mm forward of eq. (3.34),
      // its nose CP 3e-5 of the nose CP aft (0 for the cone, whose CP it gets exactly).
      const finGap = c.openRocketFin - c.fin;
      expect(finGap).toBeLessThan(-0.00008);
      expect(finGap).toBeGreaterThan(-0.00022);
      expect(Math.abs(c.openRocketNose / c.nose - 1)).toBeLessThan(4e-5);
    });
  }
});
