/**
 * Analytical cases (CLAUDE.md 7.2) and basic behaviour of the simulator
 * (plan 0010 part B). The ideal motor has constant thrust and no mass,
 * 'none' aerodynamics removes every aerodynamic force, and the constant
 * gravity model makes the motion polynomial in time, which RK4 integrates
 * exactly up to rounding.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { R1_COMPONENTS } from '../geometry/reference-rockets.js';
import { rocketMassProperties } from '../geometry/assembly.js';
import { metres, metresPerSecondSquared, newtons, radians, seconds } from '../units/si.js';
import { simulateFlight } from './simulate.js';
import type { FlightVehicle, SimulationOptions } from './vehicle.js';

const G = 9.80665;
const structureMass: number = rocketMassProperties(R1_COMPONENTS).mass; // 0.148304 kg

const vehicle = (thrust: number, burn: number): FlightVehicle => ({
  components: R1_COMPONENTS,
  motor: { kind: 'ideal', thrust: newtons(thrust), burnTime: seconds(burn) },
  recovery: [],
  roughnessHeight: metres(60e-6),
});

const options = (over: Partial<SimulationOptions> = {}): SimulationOptions => ({
  site: { altitude: metres(0) },
  rail: { length: metres(1.5), angleFromVertical: radians(0), azimuth: radians(0) },
  wind: { kind: 'vector', velocity: { x: 0, y: 0, z: 0 } },
  gravity: { seaLevel: metresPerSecondSquared(G), altitudeDependence: 'constant' },
  aerodynamics: 'none',
  finRollReduction: false,
  baseDragMotorRule: 'while-thrusting',
  integrator: { kind: 'rk4', timeStep: seconds(0.01) },
  maxTime: seconds(60),
  degreesOfFreedom: 6,
  ...over,
});

describe('constant thrust, constant mass, no drag: the kinematic solution', () => {
  // F = 5 N on m = 0.148304 kg: a = 5/0.148304 − 9.80665 = 33.7145 − 9.80665 = 23.9078 m/s² for 1 s.
  // v_b = 23.9078 m/s, z_b = 11.9539 m; apogee = z_b + v_b²/(2g) = 11.9539 + 29.1430 = 41.0969 m at t = 1 + 2.4379 = 3.4379 s;
  // rail exit at z = 1.5 m: v = √(2 a L) = √(71.7234) = 8.4690 m/s at t = v/a = 0.35423 s;
  // landing: fall from 41.0969 m: 2.8949 s after apogee, at t = 6.3328 s, hitting at √(2 g z) = 28.3920 m/s.
  const a = 5 / structureMass - G;
  const vb = a;
  const zb = 0.5 * a;
  const apogee = zb + (vb * vb) / (2 * G);
  it('rail exit, burnout, apogee and landing match the closed forms', () => {
    const r = simulateFlight(vehicle(5, 1), options());
    expect(r.summary.railExitVelocity).toBeCloseTo(Math.sqrt(2 * a * 1.5), 6);
    expect(r.summary.railExitTime).toBeCloseTo(Math.sqrt((2 * 1.5) / a), 6);
    expect(r.summary.burnoutVelocity).toBeCloseTo(vb, 6);
    // The maximum speed over the whole flight is the free-fall landing speed here (no recovery device).
    expect(r.summary.maxVelocity).toBeCloseTo(Math.sqrt(2 * G * apogee), 5);
    const ascent = r.samples.filter((s) => (s.time as number) <= r.summary.timeToApogee);
    expect(Math.max(...ascent.map((s) => s.speed))).toBeCloseTo(vb, 6);
    expect(r.summary.apogee).toBeCloseTo(apogee, 5);
    expect(r.summary.timeToApogee).toBeCloseTo(1 + vb / G, 6);
    expect(r.summary.flightTime).toBeCloseTo(1 + vb / G + Math.sqrt((2 * apogee) / G), 5);
    expect(r.summary.groundHitVelocity).toBeCloseTo(Math.sqrt(2 * G * apogee), 5);
    expect(r.summary.endReason).toBe('landing');
    expect(r.summary.landingDistance).toBeCloseTo(0, 9);
    expect(r.events.map((e) => e.kind)).toEqual([
      'launch',
      'liftoff',
      'rail-exit',
      'burnout',
      'apogee',
      'landing',
    ]);
    expect(r.summary.apogee).toBeCloseTo(41.0969, 3);
  });
  it('the Dormand–Prince integrator gives the same closed forms', () => {
    const r = simulateFlight(
      vehicle(5, 1),
      options({
        integrator: {
          kind: 'dormand-prince',
          relativeTolerance: 1e-10,
          absoluteTolerance: 1e-12,
          initialStep: seconds(0.01),
          maxStep: seconds(0.5),
        },
      }),
    );
    expect(r.summary.apogee).toBeCloseTo(apogee, 5);
    expect(r.summary.railExitVelocity).toBeCloseTo(Math.sqrt(2 * a * 1.5), 6);
  });
  it('vacuum coast: apogee above burnout = v²/2g, and energy is conserved in the coast', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 2, max: 20, noNaN: true }),
        fc.double({ min: 0.2, max: 2, noNaN: true }),
        (F, tau) => {
          // The rocket must clear the 1.5 m rail during the burn for the closed form to apply.
          fc.pre(0.5 * (F / structureMass - G) * tau * tau > 1.6);
          const r = simulateFlight(
            vehicle(F, tau),
            options({ integrator: { kind: 'rk4', timeStep: seconds(0.005) } }),
          );
          const burnoutSample = r.samples.find((s) => (s.time as number) >= tau);
          if (burnoutSample === undefined) return false;
          const expected = burnoutSample.altitude + burnoutSample.velocity.z ** 2 / (2 * G);
          const coast = r.samples.filter((s) => s.phase === 'coast');
          const e0 = coast[0];
          if (e0 === undefined) return false;
          const energy = (s: typeof e0): number => 0.5 * s.speed ** 2 + G * s.altitude;
          const drift = coast.reduce(
            (m, s) => Math.max(m, Math.abs(energy(s) - energy(e0)) / energy(e0)),
            0,
          );
          return Math.abs(r.summary.apogee - expected) < 1e-6 * expected + 1e-9 && drift < 1e-9;
        },
      ),
      { numRuns: 20 },
    );
  });
  it('a thrust below the weight never leaves the pad', () => {
    const r = simulateFlight(vehicle(1, 1), options({ maxTime: seconds(2) }));
    expect(r.summary.endReason).toBe('max-time');
    expect(r.summary.maxVelocity).toBe(0);
    expect(r.events.map((e) => e.kind)).toEqual(['launch', 'burnout', 'max-time']);
  });
});

describe('the rail and the frames', () => {
  it('a rail 20° towards east sends the rocket east with zero crossrange, exiting at the rail length', () => {
    const r = simulateFlight(
      vehicle(5, 1),
      options({
        rail: {
          length: metres(2),
          angleFromVertical: radians((20 * Math.PI) / 180),
          azimuth: radians(Math.PI / 2),
        },
      }),
    );
    const exit = r.samples.find((s) => s.phase !== 'on-rail');
    if (exit === undefined) throw new Error('no rail exit');
    expect(Math.hypot(exit.position.x, exit.position.y, exit.position.z)).toBeCloseTo(2, 6);
    expect(exit.position.x / exit.position.z).toBeCloseTo(Math.tan((20 * Math.PI) / 180), 6);
    expect(Math.abs(exit.position.y)).toBeLessThan(1e-9);
    expect(r.summary.landingDirection).toBeCloseTo(Math.PI / 2, 6);
    expect(r.summary.landingDistance).toBeGreaterThan(10);
  });
  it('two runs are identical (determinism)', () => {
    const a = simulateFlight(vehicle(5, 1), options());
    const b = simulateFlight(vehicle(5, 1), options());
    expect(b.samples).toEqual(a.samples);
    expect(b.summary).toEqual(a.summary);
  });
});
