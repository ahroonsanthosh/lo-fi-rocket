/**
 * Review finding M-4: a recovery device on the motor's ejection charge never
 * opens when the motor is plugged, or when the charge is due after the
 * flight has ended; before the fix the result was a ballistic flight with no
 * warning. R1 with the Estes D12 (burnout 1.65 s), OpenRocket-equivalent
 * modes; the DATCOM large-angle model (D-070) lets the unrecovered rocket
 * fall to the ground instead of stopping at the 90° limit (D-046).
 */
import { describe, expect, it } from 'vitest';
import { R1_COMPONENTS } from '../geometry/reference-rockets.js';
import { D12 } from '../motor/motor.test.js';
import { metres, newtons, radians, seconds } from '../units/si.js';
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
  bodyFormFactor: 'niskanen',
  largeAngleMethod: 'datcom',
  integrator: { kind: 'rk4', timeStep: seconds(0.005) },
  maxTime: seconds(120),
  degreesOfFreedom: 6,
  recordInterval: seconds(0.05),
};
const CHUTE = {
  name: 'Main chute',
  diameter: metres(0.3),
  dragCoefficient: 0.8,
  deploy: { event: 'ejection' as const, delay: seconds(0) },
};
function r1(ejectionDelay: number | undefined): FlightVehicle {
  return {
    components: R1_COMPONENTS,
    motor: {
      kind: 'definition',
      definition: D12,
      aftEnd: metres(0.6),
      ...(ejectionDelay === undefined ? {} : { ejectionDelay: seconds(ejectionDelay) }),
    },
    recovery: [CHUTE],
    roughnessHeight: metres(60e-6),
  };
}

describe('ejection-charge devices that can never open (review M-4)', () => {
  it('plugged motor: the device is named and the reason given; nothing deploys', () => {
    const r = simulateFlight(r1(undefined), OPTIONS);
    expect(r.events.some((e) => e.kind === 'deployment')).toBe(false);
    expect(r.warnings).toContainEqual(
      expect.stringMatching(
        /^"Main chute" is set to open at the motor's ejection charge, but the motor is plugged \(it has no ejection delay\), so it never opens/,
      ),
    );
  });

  it('ideal motor (no charge at all): the same warning names the motor model', () => {
    const vehicle: FlightVehicle = {
      ...r1(undefined),
      motor: { kind: 'ideal', thrust: newtons(20), burnTime: seconds(1) },
    };
    const r = simulateFlight(vehicle, OPTIONS);
    expect(r.warnings).toContainEqual(
      expect.stringMatching(/"Main chute" .* this motor model has no ejection charge/),
    );
  });

  it('a 100 s delay: the flight lands before the charge, and the warning says so with the apogee time', () => {
    const r = simulateFlight(r1(100), OPTIONS);
    expect(r.summary.endReason).toBe('landing');
    expect(r.events.some((e) => e.kind === 'ejection-charge')).toBe(false);
    expect(r.events.some((e) => e.kind === 'deployment')).toBe(false);
    const w = r.warnings.find((x) => x.startsWith('"Main chute"'));
    // Due at burnout 1.65 s + 100 s = 101.65 s.
    expect(w).toMatch(
      /due at 101\.65 s, but the flight landed at \d+\.\d\d s, before the charge fired/,
    );
    expect(w).toMatch(/near apogee \(5\.\d\d s, 4\.\d s after burnout\)/);
  });

  it('no warning when the charge fires and the device opens', () => {
    const r = simulateFlight(r1(5), OPTIONS);
    expect(r.events.some((e) => e.kind === 'deployment')).toBe(true);
    expect(r.warnings.some((x) => x.startsWith('"Main chute"'))).toBe(false);
  });
});
