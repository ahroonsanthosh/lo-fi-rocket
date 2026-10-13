/**
 * Issue #9: the motor's ejection charge firing while the rocket still climbs
 * must be reported, whatever the recovery devices are set to (without an
 * altimeter the charge is the deployment). R1 with the Estes D12: burnout
 * 1.65 s, apogee about 5.87 s in still air, so a 2 s delay fires at 3.65 s on
 * the way up and the standard 5 s delay fires at 6.65 s, after apogee.
 */
import { describe, expect, it } from 'vitest';
import { R1_COMPONENTS } from '../geometry/reference-rockets.js';
import { D12 } from '../motor/motor.test.js';
import { metres, radians, seconds } from '../units/si.js';
import { OPENROCKET_REFERENCE_GRAVITY_45N } from './gravity.js';
import { simulateFlight } from './simulate.js';
import type { FlightVehicle, SimulationOptions } from './vehicle.js';

const OPTIONS: SimulationOptions = {
  site: { altitude: metres(0) },
  rail: { length: metres(1.5), angleFromVertical: radians(0), azimuth: radians(0) },
  wind: { kind: 'vector', velocity: { x: 0, y: 0, z: 0 } },
  gravity: { seaLevel: OPENROCKET_REFERENCE_GRAVITY_45N, altitudeDependence: 'inverse-square' },
  aerodynamics: 'niskanen',
  finRollReduction: false,
  baseDragMotorRule: 'always',
  baseDragMethod: 'niskanen',
  largeAngleMethod: 'linear',
  integrator: { kind: 'rk4', timeStep: seconds(0.005) },
  maxTime: seconds(120),
  degreesOfFreedom: 6,
  recordInterval: seconds(0.05),
};
const r1 = (delay: number): FlightVehicle => ({
  components: R1_COMPONENTS,
  motor: {
    kind: 'definition',
    definition: D12,
    aftEnd: metres(0.6),
    ejectionDelay: seconds(delay),
  },
  recovery: [
    {
      name: 'Parachute',
      diameter: metres(0.3),
      dragCoefficient: 0.8,
      deploy: { event: 'apogee', delay: seconds(0) },
    },
  ],
  roughnessHeight: metres(60e-6),
});
const early = (w: readonly string[]): string | undefined =>
  w.find((x) => x.startsWith("The motor's ejection charge fires"));

describe('ejection charge before apogee (issue #9)', () => {
  it('a 2 s delay fires at 3.65 s while climbing: warned, with the time to apogee and a better delay', () => {
    const r = simulateFlight(r1(2), OPTIONS);
    const e = r.summary.ejectionCharge;
    expect(e?.time).toBeCloseTo(3.65, 12);
    expect(e?.verticalVelocity).toBeGreaterThan(0);
    const apogee = r.summary.timeToApogee;
    expect(early(r.warnings)).toContain(
      `fires at 3.65 s while the rocket is still climbing at ${(e?.airspeed ?? Number.NaN).toFixed(1)} m/s, ${(apogee - 3.65).toFixed(1)} s before apogee (a delay of about ${(apogee - 1.65).toFixed(1)} s after burnout would fire it near apogee)`,
    );
  });

  it('the standard 5 s delay fires after apogee: no warning; the summary still records the charge', () => {
    const r = simulateFlight(r1(5), OPTIONS);
    expect(r.summary.ejectionCharge?.time).toBeCloseTo(6.65, 12);
    expect(r.summary.ejectionCharge?.verticalVelocity).toBeLessThan(0);
    expect(early(r.warnings)).toBeUndefined();
  });

  it('the airspeed at the charge is |v − v_wind|', () => {
    const r = simulateFlight(r1(2), {
      ...OPTIONS,
      wind: { kind: 'vector', velocity: { x: 5, y: 0, z: 0 } },
    });
    const e = r.summary.ejectionCharge;
    // The charge's state is the one recorded at the step boundary that lands on its time.
    const s = r.samples.find((x) => Math.abs((x.time as number) - (e?.time ?? Number.NaN)) < 1e-9);
    expect(s).toBeDefined();
    const v = s?.velocity ?? { x: Number.NaN, y: 0, z: 0 };
    expect(e?.airspeed).toBeCloseTo(Math.hypot(v.x - 5, v.y, v.z), 9);
  });
});
