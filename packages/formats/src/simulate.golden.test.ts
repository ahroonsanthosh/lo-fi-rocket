/**
 * Golden flight time series (CLAUDE.md 7.6, plan 0023): R1 to R5 with winds
 * 0 and 5 m/s in the OpenRocket-equivalent modes, RK4 at 0.002 s. Each file
 * holds the summary, the events and a sample every second, with full double
 * precision, compared exactly. Regenerate with UPDATE_GOLDEN=1 only when a
 * physics change is intended, and explain the change in the commit message.
 * Bit-exactness holds for one JavaScript engine; a change of Node version
 * that alters Math results is flagged by this test and is to be examined,
 * not silently accepted.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  metres,
  OPENROCKET_REFERENCE_GRAVITY_45N,
  radians,
  seconds,
  simulateFlight,
  type FlightVehicle,
  type SimulationOptions,
} from '@lo-fi-rocket/physics';
import { describe, expect, it, vi } from 'vitest';
import { parseEng } from './eng.js';
import { motorFromEng } from './motor-definition.js';
import { orkRecoveryDevice, parseOrk } from './ork.js';

// Each case flies a full 6DOF flight; under a parallel test run R5 takes about 5 s.
vi.setConfig({ testTimeout: 60_000 });

const HERE = dirname(fileURLToPath(import.meta.url));
const REFERENCE = join(HERE, '..', '..', '..', 'reference');
const GOLDEN = join(HERE, '..', 'golden', 'flights');
const ROCKETS = [
  { file: 'r1-three-fin-conical', motorFile: 'Estes_D12', delay: 5 },
  { file: 'r2-ogive-boattail', motorFile: 'AeroTech_G80T', delay: 7 },
  { file: 'r3-minimum-diameter-24', motorFile: 'AeroTech_F39T', delay: 6 },
  { file: 'r4-scratch-38mm', motorFile: 'AeroTech_H123W', delay: 10 },
  { file: 'r5-transonic-min-dia-29', motorFile: 'AeroTech_H238T', delay: 6 },
] as const;

function vehicle(c: (typeof ROCKETS)[number]): FlightVehicle {
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
const options = (windX: number): SimulationOptions => ({
  site: { altitude: metres(0) },
  rail: { length: metres(1.5), angleFromVertical: radians(0), azimuth: radians(0) },
  wind: { kind: 'vector', velocity: { x: windX, y: 0, z: 0 } },
  gravity: { seaLevel: OPENROCKET_REFERENCE_GRAVITY_45N, altitudeDependence: 'inverse-square' },
  aerodynamics: 'niskanen',
  finRollReduction: false,
  baseDragMotorRule: 'always',
  baseDragMethod: 'niskanen',
  bodyFormFactor: 'niskanen',
  finFrictionLength: 'rocket',
  liftingSurfaceFactors: 'none',
  largeAngleMethod: 'linear',
  integrator: { kind: 'rk4', timeStep: seconds(0.002) },
  maxTime: seconds(200),
  degreesOfFreedom: 6,
  recordInterval: seconds(0.05),
});

interface GoldenSample {
  t: number;
  phase: string;
  x: number;
  y: number;
  z: number;
  speed: number;
  mach: number;
  aoa: number;
  mass: number;
  cg: number;
  /** NaN is stored as the string "NaN". */
  cp: number | string;
  cd0: number | string;
}
interface Golden {
  rocket: string;
  motor: string;
  wind: number;
  modes: {
    integrator: string;
    timeStep: number;
    finRollReduction: boolean;
    baseDragMotorRule: string;
  };
  summary: Record<string, number | string | undefined>;
  events: { kind: string; time: number }[];
  samples: GoldenSample[];
}

/** NaN is not JSON: it is stored as the string "NaN" and restored. */
const encode = (v: number): number | string => (Number.isNaN(v) ? 'NaN' : v);
const decode = (v: number | string): number => (v === 'NaN' ? Number.NaN : (v as number));

function compute(c: (typeof ROCKETS)[number], wind: number): Golden {
  const r = simulateFlight(vehicle(c), options(wind));
  const s = r.summary;
  return {
    rocket: c.file,
    motor: c.motorFile,
    wind,
    modes: {
      integrator: r.modes.integrator,
      timeStep: 0.002,
      finRollReduction: r.modes.finRollReduction,
      baseDragMotorRule: r.modes.baseDragMotorRule,
    },
    summary: {
      apogee: s.apogee,
      timeToApogee: s.timeToApogee,
      maxVelocity: s.maxVelocity,
      maxMach: s.maxMach,
      maxAcceleration: s.maxAcceleration,
      railExitVelocity: s.railExitVelocity,
      railExitTime: s.railExitTime,
      burnoutTime: s.burnoutTime,
      burnoutVelocity: s.burnoutVelocity,
      deploymentVelocity: s.deploymentVelocity,
      deploymentTime: s.deploymentTime,
      descentRate: s.descentRate,
      groundHitVelocity: s.groundHitVelocity,
      landingDistance: s.landingDistance,
      landingDirection: s.landingDirection,
      flightTime: s.flightTime,
      endReason: s.endReason,
    },
    events: r.events.map((e) => ({ kind: e.kind, time: e.time })),
    samples: wholeSeconds(r.samples).map((p) => ({
      t: p.time,
      phase: p.phase,
      x: p.position.x,
      y: p.position.y,
      z: p.position.z,
      speed: p.speed,
      mach: p.mach,
      aoa: p.angleOfAttack,
      mass: p.mass,
      cg: p.cg,
      cp: encode(p.cp),
      cd0: encode(p.cd0),
    })),
  };
}

/** The first sample at or after each whole second (the record times drift by rounding). */
function wholeSeconds<T extends { time: number }>(samples: readonly T[]): T[] {
  const out: T[] = [];
  let next = 0;
  for (const p of samples) {
    if (p.time >= next - 1e-9) {
      out.push(p);
      next = Math.floor(p.time + 1e-9) + 1;
    }
  }
  return out;
}

function restore(raw: Golden): Golden {
  return {
    ...raw,
    samples: raw.samples.map((p) => ({ ...p, cp: decode(p.cp), cd0: decode(p.cd0) })),
  };
}

describe('golden flight time series (exact)', () => {
  for (const c of ROCKETS) {
    for (const wind of [0, 5] as const) {
      it(`${c.file}, wind ${String(wind)} m/s`, () => {
        const path = join(GOLDEN, `${c.file}-wind${String(wind)}.json`);
        const actual = compute(c, wind);
        if (process.env['UPDATE_GOLDEN'] === '1' || !existsSync(path)) {
          writeFileSync(path, `${JSON.stringify(actual, null, 1)}\n`);
        }
        const golden = restore(JSON.parse(readFileSync(path, 'utf8')) as Golden);
        expect(restore(JSON.parse(JSON.stringify(actual)) as Golden)).toEqual(golden);
      });
    }
  }
});

describe('one stored sample per instant', () => {
  // A timed event that fell exactly on a step boundary used to be stored twice with the same time
  // (found when merging the 3D viewer: R2, R3 and R5 at the ejection charge).
  for (const c of ROCKETS) {
    for (const wind of [0, 5] as const) {
      it(`${c.file}, wind ${String(wind)} m/s: sample times strictly increase`, () => {
        const times = simulateFlight(vehicle(c), options(wind)).samples.map(
          (p) => p.time as number,
        );
        const repeats = times.filter((t, i) => i > 0 && !(t > times[i - 1]!));
        expect(repeats).toEqual([]);
      });
    }
  }
});
