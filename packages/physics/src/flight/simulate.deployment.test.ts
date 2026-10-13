/**
 * Review finding F-1: the summary's deployment time and velocity are the
 * first deployment's, whatever its trigger. Before the fix an ejection-charge
 * deployment left both undefined, so the deployment-speed warning never ran.
 * Setup of the review: R1 with the Estes D12, a 0.3 m parachute with C_D 0.8,
 * a 1.5 m vertical rail, the OpenRocket-equivalent modes, RK4 at 0.005 s.
 */
import { describe, expect, it } from 'vitest';
import { R1_COMPONENTS } from '../geometry/reference-rockets.js';
import { D12 } from '../motor/motor.test.js';
import { metres, radians, seconds } from '../units/si.js';
import { OPENROCKET_REFERENCE_GRAVITY_45N } from './gravity.js';
import { simulateFlight } from './simulate.js';
import { norm } from './vector.js';
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
  recordInterval: seconds(0.01),
};

function vehicle(deploy: RecoveryDevice['deploy'], delay: number): FlightVehicle {
  return {
    components: R1_COMPONENTS,
    motor: {
      kind: 'definition',
      definition: D12,
      aftEnd: metres(0.6),
      ejectionDelay: seconds(delay),
    },
    recovery: [{ name: 'Parachute', diameter: metres(0.3), dragCoefficient: 0.8, deploy }],
    roughnessHeight: metres(60e-6),
  };
}

describe('summary deployment time and velocity (review F-1)', () => {
  it('an ejection-charge deployment sets both, at the ejection time (burnout 1.65 s + 2 s)', () => {
    const r = simulateFlight(vehicle({ event: 'ejection', delay: seconds(0) }, 2), OPTIONS);
    const deployment = r.events.find((e) => e.kind === 'deployment');
    expect(deployment?.time).toBeCloseTo(3.65, 12);
    expect(r.summary.deploymentTime).toBeCloseTo(3.65, 12);
    // The speed is the state's at that instant: the recorded sample at 3.65 s.
    const sample = r.samples.find((s) => Math.abs((s.time as number) - 3.65) < 1e-9);
    expect(sample).toBeDefined();
    expect(r.summary.deploymentVelocity).toBeCloseTo(
      norm(sample?.velocity ?? { x: 0, y: 0, z: 0 }),
      9,
    );
    // Still climbing 2 s after burnout (apogee is near 5.9 s): well above the 20 m/s default threshold.
    expect(r.summary.deploymentVelocity).toBeGreaterThan(20);
  });

  // Between apogee and a delayed deployment the rocket falls with no parachute; the large-angle model
  // (D-070) carries it past 90° angle of attack, where the small-angle model would end the flight (D-046).
  const LARGE_ANGLE: SimulationOptions = { ...OPTIONS, largeAngleMethod: 'datcom' };

  it('a device deployed a delay after apogee is recorded when it opens, not at apogee', () => {
    const r = simulateFlight(vehicle({ event: 'apogee', delay: seconds(1) }, 5), LARGE_ANGLE);
    expect(r.summary.deploymentTime).toBeCloseTo(r.summary.timeToApogee + 1, 9);
  });

  it('an altitude device with a delay is recorded when it opens, not when the altitude is crossed', () => {
    const r = simulateFlight(
      vehicle({ event: 'altitude', altitude: metres(100), delay: seconds(0.5) }, 5),
      LARGE_ANGLE,
    );
    const crossing = r.events.find((e) => e.kind === 'altitude');
    expect(crossing).toBeDefined();
    expect(r.summary.deploymentTime).toBeCloseTo((crossing?.time as number) + 0.5, 9);
    // The deployment event carries the same time (it was reported a further 0.5 s late before).
    expect(r.events.find((e) => e.kind === 'deployment')?.time).toBeCloseTo(
      (crossing?.time as number) + 0.5,
      9,
    );
  });

  it('apogee deployment is unchanged: at apogee with the speed there', () => {
    const r = simulateFlight(vehicle({ event: 'apogee', delay: seconds(0) }, 5), OPTIONS);
    expect(r.summary.deploymentTime).toBeCloseTo(r.summary.timeToApogee, 12);
    expect(r.summary.deploymentVelocity).toBeLessThan(1e-6);
  });
});

describe('deployment velocity is the airspeed (review F-3)', () => {
  // Wind blowing towards +x at 10 m/s (the review's case). At apogee in still air the rocket has no
  // velocity relative to the ground or the air; in wind it drifts with less than the wind speed, so the
  // airspeed |v − v_wind| exceeds the ground speed.
  const windy: SimulationOptions = {
    ...OPTIONS,
    wind: { kind: 'vector', velocity: { x: 10, y: 0, z: 0 } },
  };
  const r = simulateFlight(vehicle({ event: 'apogee', delay: seconds(0) }, 5), windy);

  it('equals |v − v_wind| at the deployment instant, not |v|', () => {
    const sample = r.samples.find(
      (s) => Math.abs((s.time as number) - (r.summary.deploymentTime ?? Number.NaN)) < 1e-12,
    );
    expect(sample).toBeDefined();
    const v = sample?.velocity ?? { x: Number.NaN, y: 0, z: 0 };
    const air = Math.hypot(v.x - 10, v.y, v.z);
    expect(r.summary.deploymentVelocity).toBeCloseTo(air, 9);
    expect(Math.abs((r.summary.deploymentVelocity ?? 0) - norm(v))).toBeGreaterThan(1);
  });

  it('descent samples report the airspeed, not the ground speed', () => {
    const descent = r.samples.filter((s) => s.phase === 'descent');
    expect(descent.length).toBeGreaterThan(10);
    for (const s of descent) {
      const v = s.velocity;
      expect(s.airspeed).toBeCloseTo(Math.hypot(v.x - 10, v.y, v.z), 9);
    }
  });
});
