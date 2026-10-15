/**
 * Issue #32: a parachute set to open at launch used to switch the flight to the
 * thrustless descent model on the pad, so the rocket never left it and the
 * summary was NaN. Such a device is now refused while the motor burns (D-075);
 * "at launch + delay" after burnout is a timer deployment and is flown. A
 * rocket that never leaves the rail is reported. R1 with the Estes D12
 * (burnout 1.65 s).
 */
import { describe, expect, it } from 'vitest';
import { R1_COMPONENTS } from '../geometry/reference-rockets.js';
import { D12 } from '../motor/motor.test.js';
import { InvalidInputError } from '../errors.js';
import { metres, newtons, radians, seconds } from '../units/si.js';
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
  bodyFormFactor: 'niskanen',
  finFrictionLength: 'rocket',
  largeAngleMethod: 'linear',
  integrator: { kind: 'rk4', timeStep: seconds(0.005) },
  maxTime: seconds(120),
  degreesOfFreedom: 6,
  recordInterval: seconds(0.05),
};
const chute = (deploy: RecoveryDevice['deploy']): RecoveryDevice => ({
  name: 'Parachute',
  diameter: metres(0.3),
  dragCoefficient: 0.8,
  deploy,
});
const r1 = (deploy: RecoveryDevice['deploy']): FlightVehicle => ({
  components: R1_COMPONENTS,
  motor: { kind: 'definition', definition: D12, aftEnd: metres(0.6), ejectionDelay: seconds(5) },
  recovery: [chute(deploy)],
  roughnessHeight: metres(60e-6),
});

describe('deployment at launch (issue #32)', () => {
  it('at launch: refused before flying, naming the device, the burnout time and what to do', () => {
    const run = (): unknown => simulateFlight(r1({ event: 'launch', delay: seconds(0) }), OPTIONS);
    expect(run).toThrow(InvalidInputError);
    expect(run).toThrow(
      /"Parachute" deployment time is invalid: .*the parachute would open at launch, while the motor is still burning \(burnout at 1\.65 s\), and flight with a parachute open under thrust is not modelled\. Set it to open at apogee, at the motor's ejection charge, at an altitude, or at least 1\.65 s after launch/,
    );
  });

  it('1 s after launch, still under thrust: refused', () => {
    expect(() => simulateFlight(r1({ event: 'launch', delay: seconds(1) }), OPTIONS)).toThrow(
      /would open 1\.00 s after launch, while the motor is still burning/,
    );
  });

  it('5 s after launch (a timer, after burnout): flown, and the parachute opens at 5 s', () => {
    const r = simulateFlight(r1({ event: 'launch', delay: seconds(5) }), OPTIONS);
    const d = r.events.find((e) => e.kind === 'deployment');
    expect(d?.time).toBeCloseTo(5, 12);
    expect(r.summary.endReason).toBe('landing');
    expect(Number.isFinite(r.summary.railExitVelocity)).toBe(true);
  });
});

describe('a rocket that never leaves the rail (issue #32)', () => {
  it('is reported in plain words', () => {
    // 2.5 N for 0.3 s against about 1.9 N of weight: it creeps up the rail and slides back.
    const weak: FlightVehicle = {
      ...r1({ event: 'apogee', delay: seconds(0) }),
      motor: { kind: 'ideal', thrust: newtons(2.5), burnTime: seconds(0.3) },
    };
    const r = simulateFlight(weak, OPTIONS);
    expect(r.events.some((e) => e.kind === 'rail-exit')).toBe(false);
    expect(r.warnings).toContainEqual(
      expect.stringMatching(/^The rocket never left the launch rail/),
    );
  });

  it('a normal flight has no such warning', () => {
    const r = simulateFlight(r1({ event: 'apogee', delay: seconds(0) }), OPTIONS);
    expect(r.warnings.some((w) => w.startsWith('The rocket never left the launch rail'))).toBe(
      false,
    );
  });
});
