/**
 * The five reference rockets flown through the simulator for the viewer
 * tests (plan 0034): the `.ork` and `.eng` files of `reference/`, read by
 * the formats package exactly as the golden flight test does, in the
 * OpenRocket-equivalent modes with 5 m/s of wind from the west and a rail
 * tilted 0.05 rad towards azimuth 0.3 rad, so that the attitude is not
 * trivially vertical. The results are cached per process.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { motorFromEng, orkRecoveryDevice, parseEng, parseOrk } from '@lo-fi-rocket/formats';
import {
  metres,
  OPENROCKET_REFERENCE_GRAVITY_45N,
  radians,
  seconds,
  simulateFlight,
  type FlightResult,
  type FlightVehicle,
  type PlacedComponent,
  type SimulationOptions,
} from '@lo-fi-rocket/physics';

const HERE = dirname(fileURLToPath(import.meta.url));
const REFERENCE = join(HERE, '..', '..', '..', '..', 'reference');

export const REFERENCE_ROCKETS = [
  { id: 'r1', file: 'r1-three-fin-conical', motorFile: 'Estes_D12', delay: 5 },
  { id: 'r2', file: 'r2-ogive-boattail', motorFile: 'AeroTech_G80T', delay: 7 },
  { id: 'r3', file: 'r3-minimum-diameter-24', motorFile: 'AeroTech_F39T', delay: 6 },
  { id: 'r4', file: 'r4-scratch-38mm', motorFile: 'AeroTech_H123W', delay: 10 },
  { id: 'r5', file: 'r5-transonic-min-dia-29', motorFile: 'AeroTech_H238T', delay: 6 },
] as const;

export type ReferenceRocket = (typeof REFERENCE_ROCKETS)[number];

export interface ReferenceFlight {
  readonly rocket: ReferenceRocket;
  readonly components: readonly PlacedComponent[];
  readonly vehicle: FlightVehicle;
  readonly options: SimulationOptions;
  readonly result: FlightResult;
}

export function referenceComponents(rocket: ReferenceRocket): readonly PlacedComponent[] {
  return parseOrk(new Uint8Array(readFileSync(join(REFERENCE, 'rockets', `${rocket.file}.ork`))))
    .components;
}

function vehicle(c: ReferenceRocket): FlightVehicle {
  const rocket = parseOrk(
    new Uint8Array(readFileSync(join(REFERENCE, 'rockets', `${c.file}.ork`))),
  );
  const eng = parseEng(readFileSync(join(REFERENCE, 'motors', `${c.motorFile}.eng`), 'utf8'))[0];
  const mount = rocket.motorMount;
  if (eng === undefined || mount === undefined) throw new Error('missing motor');
  return {
    components: rocket.components,
    motor: {
      kind: 'definition',
      definition: motorFromEng(eng),
      aftEnd: mount.aftEnd,
      ejectionDelay: seconds(c.delay),
    },
    recovery: rocket.recoveryDevices.map(orkRecoveryDevice),
    roughnessHeight: metres(60e-6),
  };
}

export const REFERENCE_OPTIONS: SimulationOptions = {
  site: { altitude: metres(0) },
  rail: { length: metres(1.5), angleFromVertical: radians(0.05), azimuth: radians(0.3) },
  wind: { kind: 'vector', velocity: { x: 5, y: 0, z: 0 } },
  gravity: { seaLevel: OPENROCKET_REFERENCE_GRAVITY_45N, altitudeDependence: 'inverse-square' },
  aerodynamics: 'niskanen',
  finRollReduction: false,
  baseDragMotorRule: 'always',
  // 0.002 s as the golden flight test: RK4 at 0.01 s is unstable for R2's pitch dynamics (see docs/progress.md).
  integrator: { kind: 'rk4', timeStep: seconds(0.002) },
  maxTime: seconds(200),
  degreesOfFreedom: 6,
  recordInterval: seconds(0.05),
};

const cache = new Map<string, ReferenceFlight>();

export function referenceFlight(rocket: ReferenceRocket): ReferenceFlight {
  const hit = cache.get(rocket.id);
  if (hit !== undefined) return hit;
  const v = vehicle(rocket);
  const flight: ReferenceFlight = {
    rocket,
    components: v.components,
    vehicle: v,
    options: REFERENCE_OPTIONS,
    result: simulateFlight(v, REFERENCE_OPTIONS),
  };
  cache.set(rocket.id, flight);
  return flight;
}
