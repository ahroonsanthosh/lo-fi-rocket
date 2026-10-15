/**
 * Review finding F-2: a deployment before apogee (here a drogue on an early
 * ejection charge) switched the phase to descent, where apogee was not
 * detected; the main parachute on an altitude trigger, armed only after
 * apogee, then never opened. Setup of the review: R1 with the Estes D12
 * (burnout 1.65 s), ejection delay 2 s, a 1.5 m vertical rail, the
 * OpenRocket-equivalent modes, RK4 at 0.005 s.
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
  recordInterval: seconds(0.01),
};

const DUAL_DEPLOY: FlightVehicle = {
  components: R1_COMPONENTS,
  motor: { kind: 'definition', definition: D12, aftEnd: metres(0.6), ejectionDelay: seconds(2) },
  recovery: [
    {
      name: 'Drogue',
      diameter: metres(0.15),
      dragCoefficient: 0.8,
      deploy: { event: 'ejection', delay: seconds(0) },
    },
    {
      name: 'Main',
      diameter: metres(0.6),
      dragCoefficient: 0.8,
      deploy: { event: 'altitude', altitude: metres(50), delay: seconds(0) },
    },
  ],
  roughnessHeight: metres(60e-6),
};

describe('apogee after an early deployment (review F-2)', () => {
  const r = simulateFlight(DUAL_DEPLOY, OPTIONS);
  const kinds = r.events.map((e) => e.kind);

  it('the drogue opens at the ejection charge while climbing, then apogee is still detected', () => {
    const drogue = r.events.find((e) => e.detail.startsWith('Drogue deployed'));
    const apogee = r.events.find((e) => e.kind === 'apogee');
    expect(drogue?.time).toBeCloseTo(3.65, 12);
    expect(apogee).toBeDefined();
    expect(apogee?.time as number).toBeGreaterThan(3.65);
    expect(r.summary.timeToApogee).toBeCloseTo(apogee?.time as number, 12);
    // At the detected apogee the vertical velocity crosses zero (bisected to 1e-10 s).
    const at = r.samples.find((s) => s.time === apogee?.time);
    expect(Math.abs(at?.velocity.z ?? Number.NaN)).toBeLessThan(1e-6);
    expect(r.summary.apogee).toBeCloseTo(at?.altitude ?? Number.NaN, 12);
  });

  it('the main opens on the way down through 50 m, before landing', () => {
    const main = r.events.find((e) => e.detail.startsWith('Main deployed'));
    const crossing = r.events.find((e) => e.kind === 'altitude');
    const landing = r.events.find((e) => e.kind === 'landing');
    expect(main).toBeDefined();
    expect(crossing?.time).toBe(main?.time);
    expect(main?.time as number).toBeLessThan(landing?.time as number);
    expect(kinds.indexOf('apogee')).toBeLessThan(kinds.lastIndexOf('deployment'));
  });

  it('it lands under drogue and main: slower than under the drogue alone', () => {
    const drogueOnly = simulateFlight(
      { ...DUAL_DEPLOY, recovery: DUAL_DEPLOY.recovery.slice(0, 1) },
      OPTIONS,
    );
    // Terminal descent speed falls as 1/√(Σ C_D A): (0.15² + 0.6²)/0.15² = 17, so √17 ≈ 4.1 times slower
    // at the ground in still air; require at least a factor 3 so the test does not depend on the transient.
    const both = r.summary.groundHitVelocity ?? Number.NaN;
    const one = drogueOnly.summary.groundHitVelocity ?? Number.NaN;
    expect(one / both).toBeGreaterThan(3);
  });
});
