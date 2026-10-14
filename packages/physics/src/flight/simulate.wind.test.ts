/**
 * Wind models in flight (plan 0016): a profile equal to a constant wind
 * reproduces the constant-wind flight; a turbulent flight is deterministic
 * for its seed, records it, and differs for another seed.
 */
import { describe, expect, it } from 'vitest';
import { R1_COMPONENTS } from '../geometry/reference-rockets.js';
import { D12 } from '../motor/motor.test.js';
import { OPENROCKET_REFERENCE_GRAVITY_45N } from './gravity.js';
import { metres, metresPerSecond, radians, seconds } from '../units/si.js';
import { simulateFlight } from './simulate.js';
import type { FlightVehicle, SimulationOptions } from './vehicle.js';

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
const base: SimulationOptions = {
  site: { altitude: metres(0) },
  rail: { length: metres(1.5), angleFromVertical: radians(0), azimuth: radians(0) },
  wind: { kind: 'constant', speed: metresPerSecond(5), from: radians(Math.PI / 2) },
  gravity: { seaLevel: OPENROCKET_REFERENCE_GRAVITY_45N, altitudeDependence: 'inverse-square' },
  aerodynamics: 'niskanen',
  finRollReduction: false,
  baseDragMotorRule: 'always',
  baseDragMethod: 'niskanen',
  bodyFormFactor: 'niskanen',
  largeAngleMethod: 'linear',
  integrator: { kind: 'rk4', timeStep: seconds(0.005) },
  maxTime: seconds(60),
  degreesOfFreedom: 6,
  recordInterval: seconds(0.1),
};

describe('wind models in flight', () => {
  it('a one-row profile reproduces the constant wind exactly; a sheared profile changes the landing', () => {
    const constant = simulateFlight(R1, base);
    const profile = simulateFlight(R1, {
      ...base,
      wind: {
        kind: 'profile',
        layers: [{ altitude: 0, speed: metresPerSecond(5), from: radians(Math.PI / 2) }],
      },
    });
    expect(profile.summary.apogee).toBe(constant.summary.apogee);
    expect(profile.summary.landingDistance).toBe(constant.summary.landingDistance);
    expect(constant.modes.windSeed).toBeUndefined();
    const sheared = simulateFlight(R1, {
      ...base,
      wind: {
        kind: 'profile',
        layers: [
          { altitude: 0, speed: metresPerSecond(5), from: radians(Math.PI / 2) },
          { altitude: 100, speed: metresPerSecond(10), from: radians(Math.PI / 2) },
        ],
      },
    });
    expect(sheared.summary.landingDistance ?? 0).toBeGreaterThan(
      constant.summary.landingDistance ?? 0,
    );
  });
  it('turbulence: deterministic for a seed, recorded in the modes, different for another seed', () => {
    const wind = (seed: number): SimulationOptions['wind'] => ({
      kind: 'turbulent',
      mean: { kind: 'constant', speed: metresPerSecond(5), from: radians(Math.PI / 2) },
      intensity: 0.2,
      seed,
    });
    const a = simulateFlight(R1, { ...base, wind: wind(11) });
    const b = simulateFlight(R1, { ...base, wind: wind(11) });
    const c = simulateFlight(R1, { ...base, wind: wind(12) });
    expect(a.summary).toEqual(b.summary);
    expect(a.modes.windSeed).toBe(11);
    expect(a.summary.landingDistance).not.toBe(c.summary.landingDistance);
    // Gusts change the landing by a modest amount at 20 % intensity, not the apogee by much.
    const still = simulateFlight(R1, base);
    expect(Math.abs(a.summary.apogee - still.summary.apogee) / still.summary.apogee).toBeLessThan(
      0.05,
    );
  });
});
