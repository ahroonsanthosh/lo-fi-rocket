/**
 * Imported drag curves (CLAUDE.md 6.7 item 2, D-047): interpolation, the
 * no-extrapolation rule, and a self-consistency check where R1's own
 * computed C_D0, sampled into a table, reproduces its flight.
 */
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import { R1_COMPONENTS } from '../geometry/reference-rockets.js';
import { D12 } from '../motor/motor.test.js';
import { OPENROCKET_REFERENCE_GRAVITY_45N } from './gravity.js';
import { metres, radians, seconds } from '../units/si.js';
import { dragCurveAt, simulateFlight, validateDragCurve } from './simulate.js';
import type { DragCurve, FlightVehicle, SimulationOptions } from './vehicle.js';

const R1: FlightVehicle = {
  components: R1_COMPONENTS,
  motor: { kind: 'definition', definition: D12, aftEnd: metres(0.6), ejectionDelay: seconds(5) },
  recovery: [
    {
      name: 'chute',
      diameter: metres(0.3),
      dragCoefficient: 0.8,
      deploy: { event: 'apogee', delay: seconds(0) },
    },
  ],
  roughnessHeight: metres(60e-6),
};
const OR: SimulationOptions = {
  site: { altitude: metres(0) },
  rail: { length: metres(1.5), angleFromVertical: radians(0), azimuth: radians(0) },
  wind: { kind: 'vector', velocity: { x: 0, y: 0, z: 0 } },
  gravity: { seaLevel: OPENROCKET_REFERENCE_GRAVITY_45N, altitudeDependence: 'inverse-square' },
  aerodynamics: 'niskanen',
  finRollReduction: false,
  baseDragMotorRule: 'always',
  baseDragMethod: 'niskanen',
  largeAngleMethod: 'linear',
  integrator: { kind: 'rk4', timeStep: seconds(0.002) },
  maxTime: seconds(60),
  degreesOfFreedom: 6,
  recordInterval: seconds(0.02),
};

describe('drag curve interpolation (D-047)', () => {
  const curve: DragCurve = {
    label: 'test',
    points: [
      { mach: 0, cd: 0.5 },
      { mach: 0.5, cd: 0.4 },
      { mach: 1, cd: 0.8 },
    ],
  };
  it('interpolates linearly: at Mach 0.25, 0.5 + (0.4 − 0.5) × 0.5 = 0.45; at 0.75, 0.4 + 0.4 × 0.5 = 0.6', () => {
    expect(dragCurveAt(curve, 0.25)).toBeCloseTo(0.45, 12);
    expect(dragCurveAt(curve, 0.75)).toBeCloseTo(0.6, 12);
    expect(dragCurveAt(curve, 0)).toBe(0.5);
    expect(dragCurveAt(curve, 1)).toBe(0.8);
  });
  it('never extrapolates, and rejects unordered or negative tables', () => {
    expect(() => dragCurveAt(curve, 1.2)).toThrow(InvalidInputError);
    expect(() => dragCurveAt(curve, 1.2)).toThrow(/must lie within the table, 0 to 1/);
    expect(() => {
      validateDragCurve({ label: 'x', points: [{ mach: 0, cd: 1 }] });
    }).toThrow(/at least two/);
    expect(() => {
      validateDragCurve({
        label: 'x',
        points: [
          { mach: 0.5, cd: 1 },
          { mach: 0.2, cd: 1 },
        ],
      });
    }).toThrow(/must increase/);
    expect(() => {
      validateDragCurve({
        label: 'x',
        points: [
          { mach: 0, cd: -1 },
          { mach: 1, cd: 1 },
        ],
      });
    }).toThrow(/0 or greater/);
  });
  it('R1 with its own computed C_D0 sampled into a table reproduces its apogee within 0.5 %, labelled', () => {
    const computed = simulateFlight(R1, OR);
    // Sample the coasting C_D0 (burnout to apogee; the drag model's Mach dependence) into a monotonic table.
    const pts = new Map<number, number>();
    for (const s of computed.samples) {
      if (s.phase === 'coast' || s.phase === 'powered') pts.set(Number(s.mach.toFixed(3)), s.cd0);
    }
    const points = [...pts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([mach, cd]) => ({ mach, cd }));
    const last = points[points.length - 1];
    const table: DragCurve = {
      label: 'R1 sampled',
      // Rounded keys: close the table at Mach 0.3 with the last value so the flight stays inside it.
      points: [
        { mach: 0, cd: points[0]?.cd ?? 0 },
        ...points.filter((p) => p.mach > 0),
        { mach: 0.3, cd: last?.cd ?? 0 },
      ],
    };
    const imported = simulateFlight(R1, { ...OR, dragCurve: table });
    expect(imported.modes.dragCurve).toBe('R1 sampled');
    expect(
      Math.abs(imported.summary.apogee - computed.summary.apogee) / computed.summary.apogee,
    ).toBeLessThan(0.005);
    expect(computed.modes.dragCurve).toBeUndefined();
  });
});
