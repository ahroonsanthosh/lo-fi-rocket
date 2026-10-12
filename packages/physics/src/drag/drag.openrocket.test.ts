/**
 * Black-box comparison of C_D0 with OpenRocket 24.12's drag coefficient
 * column in reference/rockets/timeseries (zero wind, so α = 0 and C_D = C_A).
 * The bounds asserted are the observed agreement recorded in plan 0009; they
 * are not tolerances the model was tuned to.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { standardAtmosphere1976 } from '../atmosphere/ussa1976.js';
import {
  R1_COMPONENTS,
  R2_COMPONENTS,
  R3_COMPONENTS,
  R4_COMPONENTS,
  REFERENCE_MOTORS,
} from '../geometry/reference-rockets.js';
import { ROUGHNESS_HEIGHTS } from './skin-friction.js';
import { mach, metres } from '../units/si.js';
import { dragCoefficient, type DragInputs } from './drag.js';

const TIMESERIES = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'reference',
  'rockets',
  'timeseries',
);

const CASES = [
  {
    name: 'r1-three-fin-conical',
    components: R1_COMPONENTS,
    motor: REFERENCE_MOTORS.r1,
    apogee: 5.83,
    thrustingBound: 0.06,
    coastingBoundOr: 0.06,
    meanBoundOr: 0.03,
  },
  {
    name: 'r2-ogive-boattail',
    components: R2_COMPONENTS,
    motor: REFERENCE_MOTORS.r2,
    apogee: 10.342,
    thrustingBound: 0.065,
    coastingBoundOr: 0.065,
    meanBoundOr: 0.05,
  },
  {
    name: 'r3-minimum-diameter-24',
    components: R3_COMPONENTS,
    motor: REFERENCE_MOTORS.r3,
    apogee: 10.684,
    thrustingBound: 0.1,
    coastingBoundOr: 0.1,
    meanBoundOr: 0.075,
  },
  {
    name: 'r4-scratch-38mm',
    components: R4_COMPONENTS,
    motor: REFERENCE_MOTORS.r4,
    apogee: 11.388,
    thrustingBound: 0.035,
    coastingBoundOr: 0.035,
    meanBoundOr: 0.01,
  },
] as const;

describe('C_D0 against OpenRocket time series (R1 to R4, ascent above 15 m/s)', () => {
  for (const c of CASES) {
    it(`${c.name}: thrusting within ${String(100 * c.thrustingBound)} %; coasting within ${String(100 * c.coastingBoundOr)} % under the OpenRocket base rule (D-035)`, () => {
      const rows = readFileSync(join(TIMESERIES, `${c.name}-wind0.csv`), 'utf8')
        .trim()
        .split('\n')
        .slice(1)
        .map((l) => l.split(',').map(Number));
      const length = c.components.reduce(
        (s, p) =>
          p.component.kind === 'noseCone' ||
          p.component.kind === 'bodyTube' ||
          p.component.kind === 'transition'
            ? s + (p.component.length as number)
            : s,
        0,
      );
      let worstThrusting = 0;
      let worstCoastingOr = 0;
      let sumCoastingOr = 0;
      let nCoasting = 0;
      let sourceRuleJump = 0;
      for (const r of rows) {
        const [t, alt, , v, , M, thrust, , cdOr] = r as [
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
        ];
        if (t > c.apogee || v < 15) continue;
        const atm = standardAtmosphere1976(metres(alt));
        const reynolds = (v * length) / atm.kinematicViscosity;
        const inputs: DragInputs = {
          components: c.components,
          mach: mach(M),
          reynolds,
          roughnessHeight: metres(ROUGHNESS_HEIGHTS.regularPaint60um),
          motor: { diameter: metres(c.motor.diameter), thrusting: thrust > 0 },
          baseDragMotorRule: 'always',
        };
        const relOr = (dragCoefficient(inputs).cd0 - cdOr) / cdOr;
        if (thrust > 0) {
          worstThrusting = Math.max(worstThrusting, Math.abs(relOr));
        } else {
          worstCoastingOr = Math.max(worstCoastingOr, Math.abs(relOr));
          sumCoastingOr += Math.abs(relOr);
          nCoasting++;
          const source = dragCoefficient({ ...inputs, baseDragMotorRule: 'while-thrusting' }).cd0;
          sourceRuleJump = Math.max(sourceRuleJump, (source - cdOr) / cdOr);
        }
      }
      expect(nCoasting).toBeGreaterThan(100);
      expect(worstThrusting).toBeLessThan(c.thrustingBound);
      expect(worstCoastingOr).toBeLessThan(c.coastingBoundOr);
      expect(sumCoastingOr / nCoasting).toBeLessThan(c.meanBoundOr);
      // Under the source's rule (full base after burnout) OpenRocket is lower by the motor's share of the base drag.
      expect(sourceRuleJump).toBeGreaterThan(0);
    });
  }
});
