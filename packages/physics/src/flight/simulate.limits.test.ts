/**
 * Model limits in flight (plan 0014, D-046): a flight that leaves the
 * aerodynamic model's angle-of-attack range ends there with an explicit
 * reason instead of continuing on extrapolated forces, and the adaptive
 * integrator reports a stall instead of crawling.
 */
import { describe, expect, it } from 'vitest';
import { R1_COMPONENTS } from '../geometry/reference-rockets.js';
import { D12 } from '../motor/motor.test.js';
import { OPENROCKET_REFERENCE_GRAVITY_45N } from './gravity.js';
import { metres, radians, seconds } from '../units/si.js';
import { simulateFlight } from './simulate.js';
import type { FlightVehicle, SimulationOptions } from './vehicle.js';

const BALLISTIC: FlightVehicle = {
  components: R1_COMPONENTS,
  motor: { kind: 'definition', definition: D12, aftEnd: metres(0.6), ejectionDelay: seconds(5) },
  recovery: [],
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
  integrator: { kind: 'rk4', timeStep: seconds(0.002) },
  maxTime: seconds(60),
  degreesOfFreedom: 6,
  recordInterval: seconds(0.05),
};

describe('angle-of-attack limit of the aerodynamic model (D-046)', () => {
  it('a ballistic R1 ends at apogee with reason model-limit, keeping the apogee and the ascent', () => {
    const r = simulateFlight(BALLISTIC, OR);
    expect(r.summary.endReason).toBe('model-limit');
    expect(r.summary.apogee).toBeCloseTo(168.866, 1);
    expect(r.summary.flightTime).toBeCloseTo(r.summary.timeToApogee, 2);
    expect(r.summary.groundHitVelocity).toBeUndefined();
    const last = r.events.at(-1);
    expect(last?.kind).toBe('model-limit');
    expect(last?.detail).toMatch(/angle of attack .* 90°/);
    expect(r.warnings.some((w) => w.includes('small angles of attack'))).toBe(true);
    // Every moving sample before the limit point stays within the model; at the bisected apogee the
    // velocity is ~0 and its direction (hence the angle) is not meaningful, and the last sample is the limit state.
    for (const s of r.samples.slice(0, -1)) {
      if (s.speed > 1e-6) expect(s.angleOfAttack).toBeLessThanOrEqual(Math.PI / 2 + 1e-6);
    }
  });
  it('the adaptive integrator reaches the same limit quickly instead of stalling', () => {
    const start = performance.now();
    const r = simulateFlight(BALLISTIC, {
      ...OR,
      integrator: {
        kind: 'dormand-prince',
        relativeTolerance: 1e-8,
        absoluteTolerance: 1e-10,
        initialStep: seconds(0.001),
        maxStep: seconds(0.05),
      },
    });
    expect(r.summary.endReason).toBe('model-limit');
    expect(r.summary.apogee).toBeCloseTo(168.866, 1);
    expect(performance.now() - start).toBeLessThan(5000);
  });
  it('a flight with recovery at apogee still lands (the descent is drag-only, DYN-14)', () => {
    const r = simulateFlight(
      {
        ...BALLISTIC,
        recovery: [
          {
            name: 'chute',
            diameter: metres(0.3),
            dragCoefficient: 0.8,
            deploy: { event: 'apogee', delay: seconds(0) },
          },
        ],
      },
      OR,
    );
    expect(r.summary.endReason).toBe('landing');
  });
});
