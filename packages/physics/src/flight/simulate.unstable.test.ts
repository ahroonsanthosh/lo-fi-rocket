/**
 * Issue #17: R1 with its fins removed has its CP far ahead of its CG (the
 * review lane's app check showed −5.70 calibers static). In still air nothing
 * disturbs it, so the simulator flies it straight to a normal-looking apogee;
 * the result must say first that the rocket is unstable and that the flight
 * is not a prediction.
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
  bodyFormFactor: 'niskanen',
  finFrictionLength: 'rocket',
  liftingSurfaceFactors: 'none',
  largeAngleMethod: 'linear',
  integrator: { kind: 'rk4', timeStep: seconds(0.005) },
  maxTime: seconds(120),
  degreesOfFreedom: 6,
  recordInterval: seconds(0.05),
};
const r1 = (components: FlightVehicle['components']): FlightVehicle => ({
  components,
  motor: { kind: 'definition', definition: D12, aftEnd: metres(0.6), ejectionDelay: seconds(5) },
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

describe('an unstable rocket is reported first (issue #17)', () => {
  it('R1 without fins: summary.unstable is set and the first warning says the flight is not a prediction', () => {
    const r = simulateFlight(
      r1(R1_COMPONENTS.filter((p) => p.component.kind !== 'finSet')),
      OPTIONS,
    );
    const u = r.summary.unstable;
    expect(u).toBeDefined();
    expect(u?.calibers).toBeLessThan(-1);
    // The point is the most negative of the powered and coast minima.
    const minima = [r.summary.minimumStability.powered, r.summary.minimumStability.coast]
      .filter((p) => p !== undefined)
      .map((p) => p.calibers);
    expect(u?.calibers).toBe(Math.min(...minima));
    expect(r.warnings[0]).toBe(
      `This rocket is unstable: at ${(u?.time ?? Number.NaN).toFixed(2)} s its centre of pressure is ${(-(u?.calibers ?? Number.NaN)).toFixed(2)} calibers ahead of its centre of mass, so it turns sideways or tumbles instead of flying straight. The apogee, speeds and landing point shown are not a prediction of its flight. Add or enlarge the fins, or add nose weight, until the margin is positive (1 to 2 calibers is the usual target).`,
    );
    // The weaker in-flight margin warning is not repeated for the negative phases.
    expect(r.warnings.some((w) => w.startsWith('In-flight stability margin fell to -'))).toBe(
      false,
    );
  });

  it('R1 as built is stable: no statement, summary.unstable undefined', () => {
    const r = simulateFlight(r1(R1_COMPONENTS), OPTIONS);
    expect(r.summary.unstable).toBeUndefined();
    expect(r.warnings.some((w) => w.startsWith('This rocket is unstable'))).toBe(false);
  });
});

describe('the in-flight margin covers the ascent only (plan 0030)', () => {
  it('R1 with no recovery falling after apogee (large-angle model): no margin after apogee, not unstable', () => {
    const ballistic: FlightVehicle = { ...r1(R1_COMPONENTS), recovery: [] };
    const r = simulateFlight(ballistic, { ...OPTIONS, largeAngleMethod: 'datcom' });
    expect(r.summary.endReason).toBe('landing');
    const coast = r.summary.minimumStability.coast;
    expect(coast).toBeDefined();
    // Before the fix the fall after apogee set the coast minimum (0.73 calibers at Mach 0.04, 54°).
    expect(coast?.time ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(r.summary.timeToApogee);
    expect(r.summary.unstable).toBeUndefined();
    expect(r.warnings.some((w) => w.startsWith('In-flight stability margin fell to'))).toBe(false);
  });
});
