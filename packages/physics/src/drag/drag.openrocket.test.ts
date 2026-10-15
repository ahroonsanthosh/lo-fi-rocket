/**
 * Black-box comparison of C_D0 with OpenRocket 24.12's drag coefficient
 * column in reference/rockets/timeseries (zero wind, so α = 0 and C_D = C_A),
 * under OpenRocket's own base and rail button rules (D-108, plan 0071). The
 * bounds asserted are the observed agreement (mean 0.5 to 1.2 %; the worst
 * samples are at the highest Mach numbers, where OpenRocket's nose pressure
 * drag departs from Niskanen's, plan 0071 section 6); they are regression
 * guards, not tolerances the model was tuned to.
 */
import { readFileSync, writeFileSync } from 'node:fs';
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
    worstBound: 0.025,
    meanBound: 0.013,
  },
  {
    name: 'r2-ogive-boattail',
    components: R2_COMPONENTS,
    motor: REFERENCE_MOTORS.r2,
    apogee: 10.342,
    worstBound: 0.05,
    meanBound: 0.008,
  },
  {
    name: 'r3-minimum-diameter-24',
    components: R3_COMPONENTS,
    motor: REFERENCE_MOTORS.r3,
    apogee: 10.684,
    worstBound: 0.045,
    meanBound: 0.008,
  },
  {
    name: 'r4-scratch-38mm',
    components: R4_COMPONENTS,
    motor: REFERENCE_MOTORS.r4,
    apogee: 11.388,
    worstBound: 0.045,
    meanBound: 0.006,
  },
] as const;

describe('C_D0 against OpenRocket time series (R1 to R4, ascent above 15 m/s)', () => {
  for (const c of CASES) {
    it(`${c.name}: within ${String(100 * c.worstBound)} % at every sample, ${String(100 * c.meanBound)} % on average, under OpenRocket's base and rail button rules (D-108)`, () => {
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
      let worst = 0;
      let sum = 0;
      let n = 0;
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
        // D-108: OpenRocket keeps the whole base, thrusting or not, and has its own rail button
        // drag (DRAG-23); its time series is its static drag coefficient at each Mach number.
        const inputs: DragInputs = {
          components: c.components,
          mach: mach(M),
          reynolds,
          roughnessHeight: metres(ROUGHNESS_HEIGHTS.regularPaint60um),
          motor: { diameter: metres(c.motor.diameter), thrusting: thrust > 0 },
          baseDragMotorRule: 'never',
          railButtonDragMethod: 'openrocket',
          baseDragMethod: 'niskanen',
          bodyFormFactor: 'niskanen',
          finFrictionLength: 'rocket',
        };
        const rel = Math.abs((dragCoefficient(inputs).cd0 - cdOr) / cdOr);
        worst = Math.max(worst, rel);
        sum += rel;
        n++;
      }
      expect(n).toBeGreaterThan(100);
      if (process.env['DRAG_TIMESERIES_REPORT'] !== undefined) {
        writeFileSync(
          process.env['DRAG_TIMESERIES_REPORT'],
          `${c.name} worst ${worst.toFixed(5)} mean ${(sum / n).toFixed(5)} n ${String(n)}\n`,
          { flag: 'a' },
        );
      }
      expect(worst).toBeLessThan(c.worstBound);
      expect(sum / n).toBeLessThan(c.meanBound);
    });
  }
});
