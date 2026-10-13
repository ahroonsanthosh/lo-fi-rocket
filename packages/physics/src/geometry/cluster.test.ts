/**
 * Motor clusters (plan 0057, GEO-15): mass and inertias of n motors off the axis, the base area
 * of n thrusting motors, the listed approximations, and a one-motor cluster flying exactly as one
 * motor. Expected values by hand; OpenRocket's from reference/rockets/cluster-probe/values.txt.
 */
import { describe, expect, it } from 'vitest';
import { baseDragArea } from '../drag/base-parasitic.js';
import { InvalidInputError } from '../errors.js';
import { clusterApproximations } from '../fidelity.js';
import { OPENROCKET_REFERENCE_GRAVITY_45N } from '../flight/gravity.js';
import { simulateFlight } from '../flight/simulate.js';
import type { FlightVehicle, SimulationOptions } from '../flight/vehicle.js';
import { D12 } from '../motor/motor.test.js';
import { kilograms, metres, radians, seconds, type Metres } from '../units/si.js';
import { motorMassPart, type ClusterOffset, type MotorMass } from './assembly.js';
import { R1_COMPONENTS } from './reference-rockets.js';

const at = (y: number, z: number): ClusterOffset => ({ y: metres(y), z: metres(z) });

// The probe's "3-ring" of 25 mm tubes: OpenRocket's unit points (±0.5, −0.288675), (0, 0.577350)
// times the 0.025 m outer diameter.
const RING3 = [at(-0.0125, -0.007216878), at(0.0125, -0.007216878), at(0, 0.014433757)];

// One Estes D12 at launch: 0.0426 kg, 24 mm × 70 mm, aft end at 0.76 m (the probe's rocket).
const D12_AT_LAUNCH: MotorMass = {
  mass: kilograms(0.0426),
  length: metres(0.07),
  diameter: metres(0.024),
  aftEnd: metres(0.76),
};

describe('GEO-15: a cluster of motors as one mass part', () => {
  it('three D12s in a 3-ring: mass, CG and inertias by hand', () => {
    const p = motorMassPart({ ...D12_AT_LAUNCH, cluster: RING3 });
    // m = 3 × 0.0426 = 0.1278 kg (OpenRocket 0.127800000), CG 0.76 − 0.035 = 0.725 m (0.725).
    expect(p.mass).toBeCloseTo(0.1278, 12);
    expect(p.cgX).toBeCloseTo(0.725, 12);
    // Σd² = 2 (0.0125² + 0.007216878²) + 0.014433757² = 2 × 2.0833333e-4 + 2.0833333e-4 = 6.25e-4 m².
    // One motor: I_x1 = ½ m r² = ½ 0.0426 × 0.012² = 3.0672e-6; I_y1 = m (3r² + l²)/12
    // = 0.0426 × (4.32e-4 + 4.9e-3)/12 = 1.89286e-5 kg·m² (OpenRocket's figures for one D12).
    // I_x = 3 × 3.0672e-6 + 0.0426 × 6.25e-4 = 9.2016e-6 + 2.6625e-5 = 3.58266e-5 (OpenRocket 3.582660e-5).
    expect(p.inertiaRotational).toBeCloseTo(3.58266e-5, 10);
    // I_y = 3 × 1.89286e-5 + 0.0426 × 6.25e-4 / 2 = 5.67858e-5 + 1.33125e-5 = 7.00983e-5. OpenRocket
    // leaves the offsets out of its pitch inertia (5.678580e-5); GEO-15 keeps them (D-086).
    expect(p.inertiaLongitudinal).toBeCloseTo(7.00983e-5, 10);
  });

  it('no cluster and a one-motor cluster on the axis are the same part', () => {
    expect(motorMassPart({ ...D12_AT_LAUNCH, cluster: [at(0, 0)] })).toEqual(
      motorMassPart(D12_AT_LAUNCH),
    );
  });

  it('an empty cluster or a non-finite offset is refused with what to fix', () => {
    expect(() => motorMassPart({ ...D12_AT_LAUNCH, cluster: [] })).toThrow(InvalidInputError);
    expect(() =>
      motorMassPart({ ...D12_AT_LAUNCH, cluster: [{ y: metres(0), z: Number.NaN as Metres }] }),
    ).toThrow(/motor cluster offset/);
  });
});

describe('DRAG-11 with a cluster: the area of every thrusting motor is removed', () => {
  it('a 40 mm base less three 24 mm motors', () => {
    // π 0.04² − 3 π 0.024²/4 = 5.0265482e-3 − 1.3571680e-3 = 3.6693802e-3 m².
    expect(baseDragArea(0.04, 0.024, 3)).toBeCloseTo(3.6693802e-3, 10);
    expect(baseDragArea(0.04, 0.024, 1)).toBe(baseDragArea(0.04, 0.024));
    expect(() => baseDragArea(0.04, 0.024, 0)).toThrow(/motor count/);
  });
});

describe('cluster approximations', () => {
  it('centred layouts with three-fold symmetry or more: none', () => {
    expect(clusterApproximations(RING3)).toEqual([]);
    expect(
      clusterApproximations([at(-0.01, 0.01), at(0.01, 0.01), at(0.01, -0.01), at(-0.01, -0.01)]),
    ).toEqual([]);
    expect(clusterApproximations(undefined)).toEqual([]);
  });

  it('a row: the pitch and yaw inertias are averaged (minor)', () => {
    expect(clusterApproximations([at(-0.0125, 0), at(0.0125, 0)]).map((a) => a.impact)).toEqual([
      'minor',
    ]);
  });

  it('a layout off the axis: the thrust moment is not simulated (major)', () => {
    // Centre (0.01, 0.005) m, 11.2 mm from the axis.
    const list = clusterApproximations([at(0.01, 0), at(0.01, 0.01)]);
    expect(list[0]?.impact).toBe('major');
    expect(list[0]?.what).toMatch(/11\.2 mm off/);
  });
});

describe('a one-motor cluster on the axis flies exactly as one motor', () => {
  const options: SimulationOptions = {
    site: { altitude: metres(0) },
    rail: { length: metres(1.5), angleFromVertical: radians(0), azimuth: radians(0) },
    wind: { kind: 'vector', velocity: { x: 0, y: 0, z: 0 } },
    gravity: { seaLevel: OPENROCKET_REFERENCE_GRAVITY_45N, altitudeDependence: 'inverse-square' },
    aerodynamics: 'niskanen',
    finRollReduction: false,
    baseDragMotorRule: 'always',
    integrator: { kind: 'rk4', timeStep: seconds(0.005) },
    maxTime: seconds(120),
    degreesOfFreedom: 6,
    recordInterval: seconds(0.05),
  };
  const vehicle = (cluster?: readonly ClusterOffset[]): FlightVehicle => ({
    components: R1_COMPONENTS,
    motor: {
      kind: 'definition',
      definition: D12,
      aftEnd: metres(0.6),
      ejectionDelay: seconds(5),
      ...(cluster === undefined ? {} : { cluster }),
    },
    recovery: [],
    roughnessHeight: metres(60e-6),
  });

  it('bit-identical apogee and samples', () => {
    const one = simulateFlight(vehicle(), options);
    const cluster = simulateFlight(vehicle([at(0, 0)]), options);
    expect(cluster.summary.apogee).toBe(one.summary.apogee);
    expect(cluster.samples).toEqual(one.samples);
  }, 60000);

  it('base drag: all thrusting motors off the base by default, one in the OpenRocket rule (D-086)', () => {
    // Three motors on the axis, so only the base area differs between the rules.
    const three = [at(0, 0), at(0, 0), at(0, 0)];
    const all = simulateFlight(vehicle(three), options);
    const one = simulateFlight(vehicle(three), { ...options, baseDragClusterMotors: 'one' });
    expect(all.summary.apogee).toBeGreaterThan(one.summary.apogee);
  }, 60000);
});
