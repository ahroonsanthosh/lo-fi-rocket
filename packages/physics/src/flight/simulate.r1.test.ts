/**
 * R1 with the Estes D12 (plan 0010 part C): smoke, step-size convergence,
 * agreement of the two integrators, the 3DOF cross-check, modes, wind and
 * the drag property of CLAUDE.md 7.3. OpenRocket values from values.csv.
 */
import { describe, expect, it } from 'vitest';
import { R1_COMPONENTS, R5_COMPONENTS } from '../geometry/reference-rockets.js';
import { D12 } from '../motor/motor.test.js';
import {
  kilograms,
  metres,
  metresPerSecondSquared,
  newtons,
  radians,
  seconds,
} from '../units/si.js';
import { OPENROCKET_REFERENCE_GRAVITY_45N } from './gravity.js';
import { simulateFlight } from './simulate.js';
import type { FlightVehicle, SimulationOptions } from './vehicle.js';

const R1: FlightVehicle = {
  components: R1_COMPONENTS,
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
};
/** OpenRocket-equivalent modes (D-016, D-030, D-035) with the settings of reference/rockets/settings.md. */
const OR: SimulationOptions = {
  site: { altitude: metres(0) },
  rail: { length: metres(1.5), angleFromVertical: radians(0), azimuth: radians(0) },
  wind: { kind: 'vector', velocity: { x: 0, y: 0, z: 0 } },
  gravity: { seaLevel: OPENROCKET_REFERENCE_GRAVITY_45N, altitudeDependence: 'inverse-square' },
  aerodynamics: 'niskanen',
  finRollReduction: false,
  baseDragMotorRule: 'always',
  baseDragMethod: 'niskanen',
  largeAngleMethod: 'linear',
  integrator: { kind: 'rk4', timeStep: seconds(0.001) },
  maxTime: seconds(120),
  degreesOfFreedom: 6,
  recordInterval: seconds(0.01),
};
const OR_VALUES = {
  apogee: 167.045,
  timeToApogee: 5.83,
  maxVelocity: 61.972,
  maxMach: 0.1822,
  railExit: 18.456,
  groundHit: 6.934,
  flightTime: 30.264,
};

describe('R1 flight (OpenRocket-equivalent modes)', () => {
  const r = simulateFlight(R1, OR);
  it('events in order, no warnings, deployment at apogee, landing', () => {
    expect(r.events.map((e) => e.kind)).toEqual([
      'launch',
      'liftoff',
      'rail-exit',
      'burnout',
      'apogee',
      'deployment',
      'ejection-charge',
      'landing',
    ]);
    // The .ork fins carry no shear modulus, so the flutter check reports that it was not made (plan 0031).
    expect(r.warnings).toEqual([
      "Fin flutter not checked for the fin set (component 2): enter the fin material's shear modulus (its stiffness) to check whether the fins can flutter.",
    ]);
    expect(r.summary.endReason).toBe('landing');
    expect(r.summary.burnoutTime).toBe(1.65);
    expect(r.summary.deploymentTime).toBeCloseTo(r.summary.timeToApogee, 12);
    expect(r.modes.baseDragMotorRule).toBe('always');
  });
  it('apogee within 5 % and maximum velocity within 3 % of OpenRocket (observed: +1.1 % and +0.5 %)', () => {
    expect(Math.abs(r.summary.apogee - OR_VALUES.apogee) / OR_VALUES.apogee).toBeLessThan(0.05);
    expect(
      Math.abs(r.summary.maxVelocity - OR_VALUES.maxVelocity) / OR_VALUES.maxVelocity,
    ).toBeLessThan(0.03);
    expect(Math.abs(r.summary.apogee - OR_VALUES.apogee) / OR_VALUES.apogee).toBeLessThan(0.015);
    expect(
      Math.abs(r.summary.railExitVelocity - OR_VALUES.railExit) / OR_VALUES.railExit,
    ).toBeLessThan(0.003);
    expect(
      Math.abs(r.summary.timeToApogee - OR_VALUES.timeToApogee) / OR_VALUES.timeToApogee,
    ).toBeLessThan(0.01);
    expect(Math.abs(r.summary.maxMach - OR_VALUES.maxMach)).toBeLessThan(0.002);
    // The parachute descent: the same terminal velocity to the printed precision.
    expect(r.summary.groundHitVelocity).toBeCloseTo(OR_VALUES.groundHit, 3);
    expect(
      Math.abs(r.summary.flightTime - OR_VALUES.flightTime) / OR_VALUES.flightTime,
    ).toBeLessThan(0.02);
  });
  it('a vertical flight in still air keeps zero angle of attack and lands at the pad', () => {
    const flying = r.samples.filter(
      (s) => (s.phase === 'powered' || s.phase === 'coast') && s.speed > 1,
    );
    expect(Math.max(...flying.map((s) => s.angleOfAttack))).toBeLessThan(1e-9);
    expect(r.summary.landingDistance).toBeLessThan(1e-6);
    expect(r.summary.deploymentVelocity).toBeLessThan(1e-6); // apogee located where the vertical velocity is exactly zero
  });
});

describe('step-size convergence and integrator agreement (CLAUDE.md 6.5)', () => {
  it('halving the RK4 step from 0.01 s to 0.005 s changes the apogee by less than 0.05 m (observed 0.010 m); 0.001 s agrees within 0.01 m', () => {
    const a01 = simulateFlight(R1, { ...OR, integrator: { kind: 'rk4', timeStep: seconds(0.01) } })
      .summary.apogee;
    const a005 = simulateFlight(R1, {
      ...OR,
      integrator: { kind: 'rk4', timeStep: seconds(0.005) },
    }).summary.apogee;
    const a001 = simulateFlight(R1, OR).summary.apogee;
    expect(Math.abs(a01 - a005)).toBeLessThan(0.05);
    expect(Math.abs(a005 - a001)).toBeLessThan(0.01);
  });
  it('Dormand–Prince at 1e-8 agrees with RK4 at 0.001 s within 0.005 m in apogee and 0.005 m/s in maximum velocity, with far fewer steps', () => {
    const dp = simulateFlight(R1, {
      ...OR,
      integrator: {
        kind: 'dormand-prince',
        relativeTolerance: 1e-8,
        absoluteTolerance: 1e-10,
        initialStep: seconds(0.001),
        maxStep: seconds(0.05),
      },
    });
    const rk = simulateFlight(R1, OR);
    expect(Math.abs(dp.summary.apogee - rk.summary.apogee)).toBeLessThan(0.005);
    expect(Math.abs(dp.summary.maxVelocity - rk.summary.maxVelocity)).toBeLessThan(0.005);
    expect(Math.abs(dp.summary.timeToApogee - rk.summary.timeToApogee)).toBeLessThan(0.002);
    expect(dp.modes.integrator).toContain('Dormand');
  });
  it('the 3DOF cross-check equals the 6DOF result in still air (zero angle of attack)', () => {
    const three = simulateFlight(R1, { ...OR, degreesOfFreedom: 3 });
    const six = simulateFlight(R1, OR);
    expect(three.summary.apogee).toBeCloseTo(six.summary.apogee, 3);
    expect(three.summary.maxVelocity).toBeCloseTo(six.summary.maxVelocity, 3);
    expect(three.modes.degreesOfFreedom).toBe(3);
    // Two full flights: the same allowance as the other full-flight tests.
  }, 30000);
});

describe('modes, wind and properties', () => {
  it('the displayed mode (roll reduction, source base-drag rule) gives a slightly lower apogee and names its modes', () => {
    const shown = simulateFlight(R1, {
      ...OR,
      finRollReduction: true,
      baseDragMotorRule: 'while-thrusting',
      integrator: { kind: 'rk4', timeStep: seconds(0.005) },
    });
    const or = simulateFlight(R1, { ...OR, integrator: { kind: 'rk4', timeStep: seconds(0.005) } });
    expect(shown.summary.apogee).toBeLessThan(or.summary.apogee);
    expect(shown.summary.apogee).toBeGreaterThan(0.98 * or.summary.apogee);
    expect(shown.modes.finRollReduction).toBe(true);
  });
  it('a 5 m/s wind along +x (OpenRocket direction π/2): apogee 160.33 m within 2 %, the rocket weathercocks into the wind and lands downwind... upwind of the pad', () => {
    const w = simulateFlight(R1, {
      ...OR,
      wind: { kind: 'vector', velocity: { x: 5, y: 0, z: 0 } },
      integrator: { kind: 'rk4', timeStep: seconds(0.002) },
    });
    expect(Math.abs(w.summary.apogee - 160.329) / 160.329).toBeLessThan(0.02);
    expect(Math.abs(w.summary.maxVelocity - 61.16) / 61.16).toBeLessThan(0.01);
    expect(w.summary.groundHitVelocity).toBeCloseTo(8.549, 2);
    expect(w.summary.landingDistance).toBeGreaterThan(20);
    // Weathercocking turns the nose into the wind (towards −x); the rocket drifts with the wind towards +x under the parachute.
    expect(w.summary.landingDirection).toBeCloseTo(Math.PI / 2, 1);
    const flying = w.samples.filter((s) => s.phase === 'powered' && s.speed > 20);
    expect(Math.max(...flying.map((s) => s.angleOfAttack))).toBeGreaterThan(0.01);
  });
  it('increasing drag never increases apogee (CLAUDE.md 7.3): a rougher finish and an extra launch lug both lower it', () => {
    const fast = { ...OR, integrator: { kind: 'rk4' as const, timeStep: seconds(0.01) } };
    const base = simulateFlight(R1, fast).summary.apogee;
    const rough = simulateFlight({ ...R1, roughnessHeight: metres(500e-6) }, fast).summary.apogee;
    const lugged = simulateFlight(
      {
        ...R1,
        components: [
          ...R1_COMPONENTS,
          {
            position: metres(0.2),
            component: {
              kind: 'launchLug',
              length: metres(0.05),
              outerRadius: metres(0.005),
              wallThickness: metres(0.0005),
              density: kilograms(700) as never,
              radialOffset: metres(0.03),
            },
          },
        ],
      },
      fast,
    ).summary.apogee;
    expect(rough).toBeLessThan(base);
    expect(lugged).toBeLessThan(base);
  });
  it('R5 (Von Kármán nose, Mach 1.09) flies through the transonic band with the regime warnings (D-055, D-056, D-058)', () => {
    const r5: FlightVehicle = {
      components: R5_COMPONENTS,
      motor: { kind: 'ideal', thrust: newtons(238), burnTime: seconds(1.036) },
      recovery: [],
      roughnessHeight: metres(60e-6),
    };
    const r = simulateFlight(r5, { ...OR, integrator: { kind: 'rk4', timeStep: seconds(0.005) } });
    expect(r.summary.maxMach).toBeGreaterThan(0.8);
    // Issue #19: the regime is a summary flag (the design warnings give the plain message); the model's
    // accuracy statements are notes, not warnings.
    expect(r.summary.regimes.transonic).toBe(true);
    expect(r.notes.join('\n')).toContain('transonic regime');
    expect(r.warnings.some((w) => w.includes('transonic regime'))).toBe(false);
  });
  it('gravity and site inputs are validated', () => {
    expect(() =>
      simulateFlight(R1, {
        ...OR,
        gravity: { seaLevel: metresPerSecondSquared(0), altitudeDependence: 'constant' },
      }),
    ).toThrow();
    expect(() => simulateFlight(R1, { ...OR, maxTime: seconds(0) })).toThrow();
  });
});
