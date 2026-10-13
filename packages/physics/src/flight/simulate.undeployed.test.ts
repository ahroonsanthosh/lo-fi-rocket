/**
 * Review finding F-4: a recovery device that never opens must be reported,
 * with its trigger and the reason; before the fix the flight came out
 * ballistic and the result said nothing. Cases of the review on R1 with the
 * Estes D12 (apogee 168.9 m at 5.87 s in still air), OpenRocket-equivalent
 * modes, RK4 at 0.005 s.
 */
import { describe, expect, it } from 'vitest';
import { R1_COMPONENTS } from '../geometry/reference-rockets.js';
import { D12 } from '../motor/motor.test.js';
import { metres, radians, seconds } from '../units/si.js';
import { OPENROCKET_REFERENCE_GRAVITY_45N } from './gravity.js';
import { simulateFlight } from './simulate.js';
import type { FlightVehicle, RecoveryDevice, SimulationOptions } from './vehicle.js';

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
const device = (
  name: string,
  diameter: number,
  deploy: RecoveryDevice['deploy'],
): RecoveryDevice => ({
  name,
  diameter: metres(diameter),
  dragCoefficient: 0.8,
  deploy,
});
const r1 = (recovery: RecoveryDevice[]): FlightVehicle => ({
  components: R1_COMPONENTS,
  motor: { kind: 'definition', definition: D12, aftEnd: metres(0.6), ejectionDelay: seconds(5) },
  recovery,
  roughnessHeight: metres(60e-6),
});
const neverOpened = (warnings: readonly string[], name: string): string | undefined =>
  warnings.find((w) => w.startsWith(`"${name}" never opened`));

describe('devices that never open are reported (review F-4)', () => {
  it('drogue at apogee, main at 500 m above a 168.9 m apogee: the main is named with both heights', () => {
    const r = simulateFlight(
      r1([
        device('Drogue', 0.15, { event: 'apogee', delay: seconds(0) }),
        device('Main', 0.6, { event: 'altitude', altitude: metres(500), delay: seconds(0) }),
      ]),
      OPTIONS,
    );
    expect(r.summary.endReason).toBe('landing');
    expect(neverOpened(r.warnings, 'Main')).toMatch(
      /set to open at 500\.0 m on the way down, but the apogee is only 168\.9 m\. Set it below the apogee\. The landing speed and drift shown are for a rocket coming down without it\.$/,
    );
    expect(neverOpened(r.warnings, 'Drogue')).toBeUndefined();
  });

  it('a single parachute at 500 m: the flight ends at the model limit and the device is still named', () => {
    const r = simulateFlight(
      r1([
        device('Parachute', 0.3, { event: 'altitude', altitude: metres(500), delay: seconds(0) }),
      ]),
      OPTIONS,
    );
    expect(r.summary.endReason).toBe('model-limit');
    expect(neverOpened(r.warnings, 'Parachute')).toMatch(/the apogee is only 168\.9 m/);
  });

  it('a parachute 100 s after apogee in 5 m/s wind: lands first, with the time it was due', () => {
    const r = simulateFlight(
      r1([device('Parachute', 0.3, { event: 'apogee', delay: seconds(100) })]),
      {
        ...OPTIONS,
        wind: { kind: 'vector', velocity: { x: 5, y: 0, z: 0 } },
        largeAngleMethod: 'datcom',
      },
    );
    expect(r.summary.endReason).toBe('landing');
    const apogee = r.summary.timeToApogee;
    expect(neverOpened(r.warnings, 'Parachute')).toContain(
      `it opens 100.00 s after apogee (at ${(apogee + 100).toFixed(2)} s), but the rocket landed at ${r.summary.flightTime.toFixed(2)} s first. Use a shorter delay`,
    );
  });

  it('a main 30 s after descending through 50 m under a drogue: lands first', () => {
    const r = simulateFlight(
      r1([
        device('Drogue', 0.15, { event: 'apogee', delay: seconds(0) }),
        device('Main', 0.6, { event: 'altitude', altitude: metres(50), delay: seconds(30) }),
      ]),
      OPTIONS,
    );
    expect(neverOpened(r.warnings, 'Main')).toMatch(
      /it opens 30\.00 s after descending through 50\.0 m \(at \d+\.\d\d s\), but the rocket landed at \d+\.\d\d s first/,
    );
  });

  it('no such warning when every device opens, or for a device set to never', () => {
    const r = simulateFlight(
      r1([
        device('Parachute', 0.3, { event: 'apogee', delay: seconds(0) }),
        device('Spare', 0.3, { event: 'never', delay: seconds(0) }),
      ]),
      OPTIONS,
    );
    expect(r.warnings.some((w) => w.includes('never opened'))).toBe(false);
  });
});
