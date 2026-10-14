/**
 * Multi-stage flights (plan 0064, D-091). In vacuum with constant gravity and motors of constant
 * thrust and (all but) constant mass, the flight is piecewise constant acceleration, so every figure
 * has a closed form, worked by hand below. Ignition follows Niskanen (2009) Table 4.2 p. 69; the
 * separation drops the stage and every stage below it.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import { rocketMassProperties, type PlacedComponent } from '../geometry/assembly.js';
import { R1_COMPONENTS } from '../geometry/reference-rockets.js';
import type { MotorDefinition } from '../motor/motor.js';
import {
  kilograms,
  kilogramsPerCubicMetre,
  metres,
  metresPerSecondSquared,
  newtons,
  radians,
  seconds,
} from '../units/si.js';
import { simulateFlight } from './simulate.js';
import type { FlightVehicle, SimulationOptions, StagedMotor, StageSeparation } from './vehicle.js';

const G = 9.80665;

/** Constant thrust F for tb seconds; the propellant is 1e-9 kg, so the mass is constant to 1e-8. */
function constantMotor(
  designation: string,
  thrust: number,
  burn: number,
  mass: number,
): MotorDefinition {
  return {
    designation,
    manufacturer: 'Test',
    diameter: metres(0.024),
    length: metres(0.07),
    totalMass: kilograms(mass),
    propellantMass: kilograms(1e-9),
    points: [
      { time: seconds(0), thrust: newtons(thrust) },
      { time: seconds(burn), thrust: newtons(thrust) },
    ],
    massRule: 'linear-in-time',
    sourceFormat: 'custom',
  };
}

// The booster: a 0.3 m paper tube (700 kg/m³, 50 mm outside, 1 mm wall) behind R1's 0.6 m body.
// Its mass by hand: π (0.025² − 0.024²) × 0.3 × 700 = π × 0.000049 × 210 = 0.0323270 kg.
const BOOSTER_TUBE: PlacedComponent = {
  position: metres(0.6),
  component: {
    kind: 'bodyTube',
    length: metres(0.3),
    outerRadius: metres(0.025),
    wallThickness: metres(0.001),
    density: kilogramsPerCubicMetre(700),
  },
};
const COMPONENTS = [...R1_COMPONENTS, BOOSTER_TUBE];
const TOP_STRUCTURE: number = rocketMassProperties(R1_COMPONENTS).mass; // 0.148304 kg
const ALL_STRUCTURE: number = rocketMassProperties(COMPONENTS).mass;

const booster = constantMotor('B', 20, 1, 0.1);
const sustainer = constantMotor('S', 8, 1.5, 0.05);

function staged(
  sustainerIgnition: StagedMotor['ignition'],
  separation: 'upper-ignition' | 'burnout' | 'ejection' | 'never' = 'upper-ignition',
  boosterDelay?: number,
): FlightVehicle {
  return {
    components: COMPONENTS,
    motor: { kind: 'ideal', thrust: newtons(0), burnTime: seconds(1) },
    recovery: [],
    roughnessHeight: metres(60e-6),
    stages: {
      componentStage: [...R1_COMPONENTS.map(() => 0), 1],
      motors: [
        {
          name: 'Booster B',
          stage: 1,
          motor: {
            kind: 'definition',
            definition: booster,
            aftEnd: metres(0.9),
            ...(boosterDelay === undefined ? {} : { ejectionDelay: seconds(boosterDelay) }),
          },
          ignition: { event: 'launch', delay: seconds(0) },
        },
        {
          name: 'Sustainer S',
          stage: 0,
          motor: { kind: 'definition', definition: sustainer, aftEnd: metres(0.6) },
          ignition: sustainerIgnition,
        },
      ],
      separation: [
        { event: 'never', delay: seconds(0) },
        { event: separation, delay: seconds(0) },
      ],
      names: ['Sustainer', 'Booster'],
    },
  };
}

const options = (over: Partial<SimulationOptions> = {}): SimulationOptions => ({
  site: { altitude: metres(0) },
  rail: { length: metres(1.5), angleFromVertical: radians(0), azimuth: radians(0) },
  wind: { kind: 'vector', velocity: { x: 0, y: 0, z: 0 } },
  gravity: { seaLevel: metresPerSecondSquared(G), altitudeDependence: 'constant' },
  aerodynamics: 'none',
  finRollReduction: false,
  baseDragMotorRule: 'while-thrusting',
  integrator: { kind: 'rk4', timeStep: seconds(0.01) },
  maxTime: seconds(120),
  degreesOfFreedom: 6,
  ...over,
});

describe('two stages in vacuum: the piecewise closed form', () => {
  // Stage 1: M1 = structure of both stages + both motors; a1 = 20/M1 − g for 1 s.
  // Stage 2 (separation at the sustainer's ignition, at booster burnout): M2 = top structure + 0.05;
  // a2 = 8/M2 − g for 1.5 s. Then a vacuum coast: apogee = z2 + v2²/(2g).
  const M1 = ALL_STRUCTURE + 0.1 + 0.05;
  const M2 = TOP_STRUCTURE + 0.05;
  const a1 = 20 / M1 - G;
  const a2 = 8 / M2 - G;
  const v1 = a1; // a1 × 1 s
  const z1 = 0.5 * a1;
  const v2 = v1 + a2 * 1.5;
  const z2 = z1 + v1 * 1.5 + 0.5 * a2 * 1.5 * 1.5;
  const apogee = z2 + (v2 * v2) / (2 * G);

  it('matches the closed form at burnout, separation and apogee', () => {
    // By hand (R1's structure rounded to 0.148304 kg): M1 = 0.148304 + 0.032327 + 0.15 = 0.330631 kg,
    // a1 = 20/0.330631 − 9.80665 = 50.6837 m/s²; M2 = 0.198304 kg, a2 = 8/0.198304 − 9.80665 =
    // 30.5355 m/s²; v1 = 50.6837 m/s, z1 = 25.3419 m; v2 = 50.6837 + 1.5 × 30.5355 = 96.4869 m/s,
    // z2 = 25.3419 + 1.5 × 50.6837 + 0.5 × 30.5355 × 2.25 = 135.7199 m; apogee = 135.7199 +
    // 96.4869²/19.6133 = 135.7199 + 474.6639 = 610.3838 m (checked in an independent script).
    expect(M1).toBeCloseTo(0.330631, 5);
    expect(apogee).toBeCloseTo(610.38, 1);
    const r = simulateFlight(staged({ event: 'burnout', of: 0, delay: seconds(0) }), options());
    expect(r.summary.apogee).toBeCloseTo(apogee, 4);
    expect(r.summary.timeToApogee).toBeCloseTo(2.5 + v2 / G, 6);
    expect(r.summary.burnoutTime).toBeCloseTo(2.5, 9);
    expect(r.summary.burnoutVelocity).toBeCloseTo(v2, 5);
    const at = (kind: string): number => r.events.find((e) => e.kind === kind)?.time as number;
    expect(at('separation')).toBeCloseTo(1, 12);
    expect(r.events.filter((e) => e.kind === 'ignition').map((e) => e.time as number)).toEqual([
      0, 1,
    ]);
    expect(r.events.map((e) => e.kind)).toEqual([
      'launch',
      'ignition',
      'liftoff',
      'rail-exit',
      'burnout',
      'ignition',
      'separation',
      'burnout',
      'apogee',
      'landing',
    ]);
    // The mass drops by the booster's tube and motor at separation, and never rises.
    const sep = r.events.find((e) => e.kind === 'separation');
    expect(sep?.detail).toMatch(
      /Booster separated \(Sustainer S ignition\); 0\.1323 kg left the vehicle, 0\.1983 kg flies on/,
    );
    for (let i = 1; i < r.samples.length; i++) {
      expect(r.samples[i]?.mass ?? 0).toBeLessThanOrEqual((r.samples[i - 1]?.mass ?? 0) + 1e-12);
    }
    // Every staged flight lists the separation approximations.
    expect(r.approximations.filter((a) => a.subject === 'Stage separation')).toHaveLength(3);
  });

  it('ignites at the booster’s ejection charge plus a delay, after a coast', () => {
    // Booster charge 0.5 s after its burnout, sustainer 0.2 s later: a vacuum coast of c = 0.7 s
    // with the booster still attached (it separates at the sustainer's ignition), then stage 2.
    const c = 0.7;
    const v1c = v1 - G * c;
    const z1c = z1 + v1 * c - 0.5 * G * c * c;
    const v2c = v1c + a2 * 1.5;
    const z2c = z1c + v1c * 1.5 + 0.5 * a2 * 1.5 * 1.5;
    const r = simulateFlight(
      staged({ event: 'ejection', of: 0, delay: seconds(0.2) }, 'upper-ignition', 0.5),
      options(),
    );
    expect(r.events.find((e) => e.kind === 'ignition' && (e.time as number) > 0)?.time).toBeCloseTo(
      1.7,
      12,
    );
    expect(r.summary.apogee).toBeCloseTo(z2c + (v2c * v2c) / (2 * G), 4);
    // A booster charge is a staging charge: the summary's ejection charge is the top stage's (none here).
    expect(r.summary.ejectionCharge).toBeUndefined();
  });

  it('separates at the booster’s burnout when set so, before the sustainer lights', () => {
    // Separation at booster burnout (1 s), sustainer ignited 0.5 s later: coast with M2 alone.
    const r = simulateFlight(
      staged({ event: 'burnout', of: 0, delay: seconds(0.5) }, 'burnout'),
      options(),
    );
    const v1c = v1 - G * 0.5;
    const z1c = z1 + v1 * 0.5 - 0.5 * G * 0.25;
    const v2c = v1c + a2 * 1.5;
    const z2c = z1c + v1c * 1.5 + 0.5 * a2 * 2.25;
    expect(r.events.find((e) => e.kind === 'separation')?.time).toBeCloseTo(1, 12);
    expect(r.summary.apogee).toBeCloseTo(z2c + (v2c * v2c) / (2 * G), 4);
  });

  it('carries the spent booster when it never separates', () => {
    const r = simulateFlight(
      staged({ event: 'burnout', of: 0, delay: seconds(0) }, 'never'),
      options(),
    );
    // a2' = 8/(M1 − 0 propellant) − g: the booster's dead weight stays (propellant 1e-9 kg).
    const a2n = 8 / M1 - G;
    const v2n = v1 + a2n * 1.5;
    const z2n = z1 + v1 * 1.5 + 0.5 * a2n * 2.25;
    expect(r.events.some((e) => e.kind === 'separation')).toBe(false);
    expect(r.summary.apogee).toBeCloseTo(z2n + (v2n * v2n) / (2 * G), 4);
  });
});

describe('the stages of a vehicle', () => {
  it('drop a separated stage’s recovery device without calling it unopened', () => {
    const v = staged({ event: 'burnout', of: 0, delay: seconds(0) });
    const r = simulateFlight(
      {
        ...v,
        recovery: [
          {
            name: 'Booster chute',
            diameter: metres(0.3),
            dragCoefficient: 0.8,
            deploy: { event: 'apogee', delay: seconds(0) },
          },
          {
            name: 'Main',
            diameter: metres(0.5),
            dragCoefficient: 0.8,
            deploy: { event: 'apogee', delay: seconds(0) },
          },
        ],
        stages: { ...v.stages!, recoveryStage: [1, 0] },
      },
      options(),
    );
    const deployments = r.events.filter((e) => e.kind === 'deployment').map((e) => e.detail);
    expect(deployments).toHaveLength(1);
    expect(deployments[0]).toMatch(/^Main deployed/);
    expect(r.warnings.join(' ')).not.toMatch(/Booster chute/);
  });

  it('are checked, with plain messages', () => {
    const v = staged({ event: 'burnout', of: 0, delay: seconds(0) });
    const bad = (stages: Partial<NonNullable<FlightVehicle['stages']>>): FlightVehicle => ({
      ...v,
      stages: { ...v.stages!, ...stages },
    });
    expect(() => simulateFlight(bad({ componentStage: [0] }), options())).toThrow(
      new RegExp(`must give a stage for each of the ${String(COMPONENTS.length)} parts`),
    );
    expect(() =>
      simulateFlight(bad({ componentStage: [...R1_COMPONENTS.map(() => 1), 1] }), options()),
    ).toThrow(/top stage .* must hold at least one part/);
    const selfIgnition = v.stages!.motors.map((m, i) =>
      i === 1 ? { ...m, ignition: { event: 'burnout' as const, of: 1, delay: seconds(0) } } : m,
    );
    expect(() => simulateFlight(bad({ motors: selfIgnition }), options())).toThrow(
      InvalidInputError,
    );
    expect(() => simulateFlight(bad({ motors: [] }), options())).toThrow(/at least one motor/);
  });

  it('one stage with one motor at launch flies exactly as the unstaged vehicle (R1, D12-like motor, aerodynamics on)', () => {
    const motor = constantMotor('C', 12, 1.6, 0.04);
    const plain: FlightVehicle = {
      components: R1_COMPONENTS,
      motor: { kind: 'definition', definition: motor, aftEnd: metres(0.6) },
      recovery: [],
      roughnessHeight: metres(60e-6),
    };
    const oneStage: FlightVehicle = {
      ...plain,
      stages: {
        componentStage: R1_COMPONENTS.map(() => 0),
        motors: [
          {
            stage: 0,
            motor: { kind: 'definition', definition: motor, aftEnd: metres(0.6) },
            ignition: { event: 'launch', delay: seconds(0) },
          },
        ],
        separation: [{ event: 'never', delay: seconds(0) }],
      },
    };
    const o = options({
      aerodynamics: 'niskanen',
      finRollReduction: true,
      gravity: { seaLevel: metresPerSecondSquared(G), altitudeDependence: 'inverse-square' },
    });
    const a = simulateFlight(plain, o);
    const b = simulateFlight(oneStage, o);
    expect(b.summary.apogee).toBe(a.summary.apogee);
    expect(b.summary.maxVelocity).toBe(a.summary.maxVelocity);
    expect(b.summary.flightTime).toBe(a.summary.flightTime);
  });

  it('never gain mass, whatever the delays (property)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 2, noNaN: true }),
        fc.double({ min: 0, max: 2, noNaN: true }),
        (ign, sep) => {
          const v = staged({ event: 'burnout', of: 0, delay: seconds(ign) }, 'burnout');
          const r = simulateFlight(
            {
              ...v,
              stages: {
                ...v.stages!,
                separation: [
                  { event: 'never', delay: seconds(0) },
                  { event: 'burnout', delay: seconds(sep) },
                ],
              },
            },
            options({ integrator: { kind: 'rk4', timeStep: seconds(0.02) }, maxTime: seconds(40) }),
          );
          for (let i = 1; i < r.samples.length; i++) {
            if ((r.samples[i]?.mass ?? 0) > (r.samples[i - 1]?.mass ?? 0) + 1e-12) return false;
          }
          return true;
        },
      ),
      { seed: 20261014, numRuns: 15 },
    );
  });
});

describe('the further staging events (plan 0064 part 2)', () => {
  // As above: M1 = 0.330631 kg, a1 = 20/M1 − g = 50.6837 m/s², v1 = 50.6837 m/s, z1 = 25.3419 m at
  // the booster's burnout (1 s); M2 = 0.198304 kg, a2 = 8/M2 − g = 30.5355 m/s².
  const M1 = ALL_STRUCTURE + 0.1 + 0.05;
  const M2 = TOP_STRUCTURE + 0.05;
  const a1 = 20 / M1 - G;
  const a2 = 8 / M2 - G;
  const v1 = a1;
  const z1 = 0.5 * a1;
  const withStages = (
    sustainerIgnition: StagedMotor['ignition'],
    separation: StageSeparation,
    boosterIgnition?: StagedMotor['ignition'],
  ): FlightVehicle => {
    const v = staged(sustainerIgnition);
    const st = v.stages!;
    return {
      ...v,
      stages: {
        ...st,
        motors: st.motors.map((m, i) =>
          i === 0 && boosterIgnition !== undefined ? { ...m, ignition: boosterIgnition } : m,
        ),
        separation: [{ event: 'never', delay: seconds(0) }, separation],
      },
    };
  };
  const never: StagedMotor['ignition'] = { event: 'never', delay: seconds(0) };
  const at = (r: ReturnType<typeof simulateFlight>, kind: string): number =>
    r.events.find((e) => e.kind === kind)?.time as number;

  it('separate at apogee, the sustainer never lit and carried as dead weight', () => {
    // The ascent is M1 throughout: apogee = z1 + v1²/(2g) = 25.3419 + 2568.84/19.6133 = 156.316 m at
    // 1 + v1/g = 6.16830 s, where 0.1323 kg (the tube and the spent booster) leaves.
    const r = simulateFlight(
      withStages(never, { event: 'apogee', delay: seconds(0) }),
      options({ integrator: { kind: 'rk4', timeStep: seconds(0.01) } }),
    );
    expect(r.summary.apogee).toBeCloseTo(z1 + (v1 * v1) / (2 * G), 4);
    expect(at(r, 'separation')).toBeCloseTo(1 + v1 / G, 6);
    expect(r.events.find((e) => e.kind === 'separation')?.detail).toMatch(
      /Booster separated \(apogee\); 0\.1323 kg left the vehicle, 0\.1983 kg flies on/,
    );
    // 'never' is a choice: no warning that the sustainer did not light.
    expect(r.warnings.join(' ')).not.toMatch(/never ignited/);
  });

  it('separate when climbing through an altitude, part way through the sustainer’s burn', () => {
    // After the booster's burnout the sustainer burns on M1: a2n = 8/M1 − g = 14.3895 m/s². Climbing to
    // 50 m: 25.3419 + 50.6837 τ + 7.19475 τ² = 50, so τ = 0.456878 s (separation at 1.456878 s) with
    // v = 50.6837 + 14.3895 τ = 57.2580 m/s. Then M2 for the 1.043122 s left of the burn:
    // v2 = 57.2580 + 30.5355 × 1.043122 = 89.1102 m/s, z2 = 50 + 57.2580 × 1.043122 + 0.5 × 30.5355
    // × 1.043122² = 126.3399 m; apogee = 126.3399 + 89.1102²/19.6133 = 531.199 m.
    const a2n = 8 / M1 - G;
    const tau = (-v1 + Math.sqrt(v1 * v1 - 2 * a2n * (z1 - 50))) / a2n;
    const vs = v1 + a2n * tau;
    const rest = 1.5 - tau;
    const v2 = vs + a2 * rest;
    const z2 = 50 + vs * rest + 0.5 * a2 * rest * rest;
    expect(tau).toBeCloseTo(0.456878, 6);
    // (R1's structure rounded to 0.148304 kg in the working; the code uses the exact figure.)
    expect(z2 + (v2 * v2) / (2 * G)).toBeCloseTo(531.2, 2);
    const r = simulateFlight(
      withStages(
        { event: 'burnout', of: 0, delay: seconds(0) },
        { event: 'altitude-ascending', delay: seconds(0), altitude: metres(50) },
      ),
      options(),
    );
    expect(at(r, 'separation')).toBeCloseTo(1 + tau, 8);
    expect(r.summary.apogee).toBeCloseTo(z2 + (v2 * v2) / (2 * G), 4);
  });

  it('separate when descending through an altitude, after apogee', () => {
    // Apogee 156.316 m at 6.16830 s; falling 56.316 m from rest takes √(2 × 56.316/g) = 3.38900 s.
    const apogee = z1 + (v1 * v1) / (2 * G);
    const r = simulateFlight(
      withStages(never, { event: 'altitude-descending', delay: seconds(0), altitude: metres(100) }),
      options(),
    );
    expect(at(r, 'separation')).toBeCloseTo(1 + v1 / G + Math.sqrt((2 * (apogee - 100)) / G), 6);
    expect(at(r, 'separation')).toBeCloseTo(9.5573, 4);
  });

  it('separate 0.5 s after the stage’s own ignition, both motors lit at launch', () => {
    // 0 to 0.5 s: 28 N on M1, a = 28/M1 − g = 74.8799 m/s², v = 37.4400 m/s, z = 9.3600 m. The booster
    // and its motor leave at 0.5 s (its burnout at 1 s never comes); 0.5 to 1.5 s: 8 N on M2,
    // v = 67.9754 m/s, z = 62.0677 m; apogee = 62.0677 + 67.9754²/19.6133 = 297.656 m.
    const a = 28 / M1 - G;
    const va = 0.5 * a;
    const za = 0.125 * a;
    const vb = va + a2;
    const zb = za + va + 0.5 * a2;
    expect(zb + (vb * vb) / (2 * G)).toBeCloseTo(297.656, 3);
    const r = simulateFlight(
      withStages(
        { event: 'launch', delay: seconds(0) },
        { event: 'ignition', delay: seconds(0.5) },
      ),
      options(),
    );
    expect(at(r, 'separation')).toBeCloseTo(0.5, 12);
    expect(r.events.filter((e) => e.kind === 'burnout')).toHaveLength(1);
    expect(r.summary.apogee).toBeCloseTo(zb + (vb * vb) / (2 * G), 4);
  });

  it('say why a motor never lit and a stage never separated', () => {
    // The booster is plugged: the sustainer, set to light at its charge, never does, and the booster,
    // set to separate at the sustainer's ignition, stays on.
    const r = simulateFlight(
      withStages(
        { event: 'ejection', of: 0, delay: seconds(0) },
        { event: 'upper-ignition', delay: seconds(0) },
      ),
      options(),
    );
    const text = r.warnings.join(' ');
    expect(text).toMatch(
      /Sustainer S never ignited: it is set to ignite at the ejection charge of Booster B, which is plugged \(it has no ejection charge\)\. The flight shown is without its thrust, carrying the unburnt motor as dead weight/,
    );
    expect(text).toMatch(
      /Booster never separated: it is set to separate at the ignition of the stage above it, which did not happen before the rocket landed at/,
    );
    expect(r.summary.apogee).toBeCloseTo(z1 + (v1 * v1) / (2 * G), 4);
  });

  it('stop on the pad, saying so, when no motor is set to light at launch', () => {
    const r = simulateFlight(
      withStages(
        { event: 'burnout', of: 0, delay: seconds(0) },
        { event: 'upper-ignition', delay: seconds(0) },
        never,
      ),
      options(),
    );
    expect(r.summary.endReason).toBe('no-ignition');
    expect(r.summary.flightTime).toBe(0);
    expect(r.warnings.join(' ')).toMatch(/No motor is set to ignite at launch/);
    expect(r.warnings.join(' ')).toMatch(
      /Sustainer S never ignited: .* Booster B, which never ignited/,
    );
  });

  it('check a separation altitude', () => {
    expect(() =>
      simulateFlight(
        withStages(never, { event: 'altitude-ascending', delay: seconds(0) }),
        options(),
      ),
    ).toThrow(/separation altitude of stage 2 .* must be greater than 0 m above the pad/);
  });
});
