/**
 * Phase 2 acceptance (CLAUDE.md 7.4 and 10): flights of the reference
 * rockets built from the .ork and .eng files, in OpenRocket-equivalent
 * modes (no fin roll reduction, OpenRocket's base-drag rule, rail button drag and gravity),
 * against reference/rockets/values.csv: apogee within 5 %, maximum
 * velocity within 3 %. The tighter bounds are the observed agreement.
 */
import { readFileSync, writeFileSync } from 'node:fs';
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

// R5 flies to Mach 1.1 at 0.002 s: above the 5 s default under a loaded suite.
vi.setConfig({ testTimeout: 120_000 });
import { parseEng } from './eng.js';
import { motorFromEng } from './motor-definition.js';
import { orkRecoveryDevice, parseOrk } from './ork.js';

const REFERENCE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'reference');

interface Expected {
  apogee: number;
  timeToApogee: number;
  maxVelocity: number;
  railExit: number;
  groundHit: number;
  flightTime: number;
}
const CASES: {
  file: string;
  motorFile: string;
  delay: number;
  wind0: Expected;
  wind5: Expected;
}[] = [
  {
    file: 'r1-three-fin-conical',
    motorFile: 'Estes_D12',
    delay: 5,
    wind0: {
      apogee: 167.045,
      timeToApogee: 5.83,
      maxVelocity: 61.972,
      railExit: 18.456,
      groundHit: 6.934,
      flightTime: 30.264,
    },
    wind5: {
      apogee: 160.329,
      timeToApogee: 5.74,
      maxVelocity: 61.16,
      railExit: 18.45,
      groundHit: 8.549,
      flightTime: 29.317,
    },
  },
  {
    file: 'r2-ogive-boattail',
    motorFile: 'AeroTech_G80T',
    delay: 7,
    wind0: {
      apogee: 820.806,
      timeToApogee: 10.342,
      maxVelocity: 245.821,
      railExit: 26.611,
      groundHit: 6.594,
      flightTime: 132.837,
    },
    wind5: {
      apogee: 813.612,
      timeToApogee: 10.328,
      maxVelocity: 245.364,
      railExit: 26.594,
      groundHit: 8.275,
      flightTime: 131.86,
    },
  },
  {
    file: 'r3-minimum-diameter-24',
    motorFile: 'AeroTech_F39T',
    delay: 6,
    wind0: {
      apogee: 832.929,
      timeToApogee: 10.684,
      maxVelocity: 233.975,
      railExit: 31.639,
      groundHit: 6.499,
      flightTime: 136.741,
    },
    wind5: {
      apogee: 826.785,
      timeToApogee: 10.66,
      maxVelocity: 233.568,
      railExit: 31.624,
      groundHit: 8.2,
      flightTime: 135.894,
    },
  },
  {
    file: 'r4-scratch-38mm',
    motorFile: 'AeroTech_H123W',
    delay: 10,
    wind0: {
      apogee: 692.685,
      timeToApogee: 11.388,
      maxVelocity: 136.122,
      railExit: 16.825,
      groundHit: 6.245,
      flightTime: 120.889,
    },
    wind5: {
      apogee: 674.261,
      timeToApogee: 11.236,
      maxVelocity: 135.558,
      railExit: 16.818,
      groundHit: 8.0,
      flightTime: 118.045,
    },
  },
  {
    file: 'r5-transonic-min-dia-29',
    motorFile: 'AeroTech_H238T',
    delay: 6,
    wind0: {
      apogee: 1560.531,
      timeToApogee: 14.516,
      maxVelocity: 369.487,
      railExit: 36.684,
      groundHit: 8.768,
      flightTime: 186.551,
    },
    wind5: {
      apogee: 1555.05,
      timeToApogee: 14.504,
      maxVelocity: 369.22,
      railExit: 36.677,
      groundHit: 10.094,
      flightTime: 186.039,
    },
  },
];

function vehicleFor(c: (typeof CASES)[number]): FlightVehicle {
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
  baseDragMotorRule: 'never',
  railButtonDragMethod: 'openrocket',
  baseDragMethod: 'niskanen',
  bodyFormFactor: 'niskanen',
  largeAngleMethod: 'linear',
  integrator: { kind: 'rk4', timeStep: seconds(0.002) },
  maxTime: seconds(200),
  degreesOfFreedom: 6,
  recordInterval: seconds(0.05),
});

const rel = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b);

describe('reference flights against OpenRocket (apogee 5 %, maximum velocity 3 %)', () => {
  for (const c of CASES) {
    for (const [wind, expected] of [
      [0, c.wind0],
      [5, c.wind5],
    ] as const) {
      it(`${c.file}, wind ${String(wind)} m/s`, () => {
        const r = simulateFlight(vehicleFor(c), options(wind));
        const s = r.summary;
        expect(s.endReason).toBe('landing');
        expect(rel(s.apogee, expected.apogee), 'apogee').toBeLessThan(0.05);
        expect(rel(s.maxVelocity, expected.maxVelocity), 'max velocity').toBeLessThan(0.03);
        // Observed agreement since D-108 (OpenRocket's full base and its own rail button drag,
        // plan 0071): apogee within 1.2 %, maximum velocity within 0.41 %, time to apogee within
        // 0.9 %. Regression guards, not tuning targets:
        expect(rel(s.apogee, expected.apogee), 'apogee (observed)').toBeLessThan(0.015);
        expect(rel(s.maxVelocity, expected.maxVelocity), 'max velocity (observed)').toBeLessThan(
          0.005,
        );
        expect(rel(s.railExitVelocity, expected.railExit), 'rail exit').toBeLessThan(0.003);
        expect(rel(s.timeToApogee, expected.timeToApogee), 'time to apogee').toBeLessThan(0.025);
        expect(
          rel(s.groundHitVelocity ?? Number.NaN, expected.groundHit),
          'ground hit',
        ).toBeLessThan(0.002);
        expect(rel(s.flightTime, expected.flightTime), 'flight time').toBeLessThan(0.025);
      });
    }
  }
});

/**
 * The displayed mode (roll reduction, the base drag motor rule while thrusting, DATCOM base drag D-069, the
 * DATCOM large-angle model D-070) against the same OpenRocket references, within the Phase 2 tolerances. The
 * table (REFERENCE_REPORT=<path>) also shows the displayed mode with the small-angle model, to isolate D-070.
 */
const displayed = (windX: number, largeAngleMethod: 'datcom' | 'linear'): SimulationOptions => ({
  ...options(windX),
  finRollReduction: true,
  baseDragMotorRule: 'while-thrusting',
  railButtonDragMethod: 'niskanen',
  baseDragMethod: 'datcom',
  largeAngleMethod,
});
const displayedRows: string[] = [
  '| rocket | wind | OpenRocket apogee | displayed apogee | difference | with the small-angle model | OpenRocket max velocity | displayed | difference |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
];
describe('displayed mode against OpenRocket (Phase 2 tolerances: apogee 5 %, maximum velocity 3 %)', () => {
  for (const c of CASES) {
    for (const [wind, expected] of [
      [0, c.wind0],
      [5, c.wind5],
    ] as const) {
      it(`${c.file}, wind ${String(wind)} m/s`, () => {
        const s = simulateFlight(vehicleFor(c), displayed(wind, 'datcom')).summary;
        const lin = simulateFlight(vehicleFor(c), displayed(wind, 'linear')).summary;
        expect(s.endReason).toBe('landing');
        expect(rel(s.apogee, expected.apogee), 'apogee').toBeLessThan(0.05);
        expect(rel(s.maxVelocity, expected.maxVelocity), 'max velocity').toBeLessThan(0.03);
        const pct = (a: number, b: number): string => `${(((a - b) / b) * 100).toFixed(2)} %`;
        displayedRows.push(
          `| ${c.file} | ${String(wind)} | ${expected.apogee.toFixed(1)} m | ${s.apogee.toFixed(1)} m | ${pct(s.apogee, expected.apogee)} | ${lin.apogee.toFixed(1)} m (${pct(lin.apogee, expected.apogee)}) | ${expected.maxVelocity.toFixed(1)} m/s | ${s.maxVelocity.toFixed(1)} m/s | ${pct(s.maxVelocity, expected.maxVelocity)} |`,
        );
      });
    }
  }
  it('writes the table', () => {
    const path = process.env['REFERENCE_REPORT'];
    if (path !== undefined && path !== '') writeFileSync(path, `${displayedRows.join('\n')}\n`);
    expect(displayedRows.length).toBe(2 + 2 * CASES.length);
  });
});
