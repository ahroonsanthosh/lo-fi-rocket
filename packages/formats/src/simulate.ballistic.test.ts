/**
 * Ballistic (no recovery) descents of every reference rocket (plan 0023,
 * Prompt 5 step 4). In the main six-degree-of-freedom simulation a rocket
 * without wind falls exactly tail-first after apogee and the run ends at the
 * 90° angle-of-attack limit (D-046) with the ascent intact; with wind it
 * weathercocks, noses over and lands nose-first within the model's range.
 * The three-degree-of-freedom cross-check mode (axis along the airspeed,
 * drag only) always lands; its fall is checked against the force balance
 * m g = ½ ρ v² C_D0 A_ref (the ground-hit speed never exceeds the terminal
 * speed and approaches it as the fall lengthens). The table is printed for
 * the report.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  maximumBodyDiameter,
  metres,
  OPENROCKET_REFERENCE_GRAVITY_45N,
  radians,
  seconds,
  simulateFlight,
  standardAtmosphere1976,
  type FlightVehicle,
  type SimulationOptions,
} from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { parseEng } from './eng.js';
import { motorFromEng } from './motor-definition.js';
import { parseOrk } from './ork.js';

const REFERENCE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'reference');
const ROCKETS = [
  { file: 'r1-three-fin-conical', motorFile: 'Estes_D12', delay: 5 },
  { file: 'r2-ogive-boattail', motorFile: 'AeroTech_G80T', delay: 7 },
  { file: 'r3-minimum-diameter-24', motorFile: 'AeroTech_F39T', delay: 6 },
  { file: 'r4-scratch-38mm', motorFile: 'AeroTech_H123W', delay: 10 },
  { file: 'r5-transonic-min-dia-29', motorFile: 'AeroTech_H238T', delay: 6 },
] as const;
const G: number = OPENROCKET_REFERENCE_GRAVITY_45N;

function vehicle(c: (typeof ROCKETS)[number], recovery: boolean): FlightVehicle {
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
    recovery: recovery
      ? rocket.recoveryDevices.map((d) => ({
          name: d.name,
          diameter: d.diameter,
          dragCoefficient: d.dragCoefficient,
          deploy: { event: d.deployEvent, altitude: d.deployAltitude, delay: d.deployDelay },
        }))
      : [],
    roughnessHeight: metres(60e-6),
  };
}
const options = (windX: number, dof: 3 | 6): SimulationOptions => ({
  site: { altitude: metres(0) },
  rail: { length: metres(1.5), angleFromVertical: radians(0), azimuth: radians(0) },
  wind: { kind: 'vector', velocity: { x: windX, y: 0, z: 0 } },
  gravity: { seaLevel: OPENROCKET_REFERENCE_GRAVITY_45N, altitudeDependence: 'inverse-square' },
  aerodynamics: 'niskanen',
  finRollReduction: false,
  baseDragMotorRule: 'always',
  baseDragMethod: 'niskanen',
  integrator: { kind: 'rk4', timeStep: seconds(0.002) },
  maxTime: seconds(400),
  degreesOfFreedom: dof,
  recordInterval: seconds(0.05),
});

const lines: string[] = [
  '| Rocket | wind | apogee | 6DOF end (reason, time, altitude, angle of attack, speed) | 3DOF landing speed | terminal speed from the force balance | 3DOF final acceleration | 3DOF landing distance |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
];

describe('ballistic descents of the reference rockets (plan 0023)', () => {
  for (const c of ROCKETS) {
    for (const wind of [0, 5] as const) {
      it(`${c.file}, wind ${String(wind)} m/s`, { timeout: 120_000 }, () => {
        const withRecovery = simulateFlight(vehicle(c, true), options(wind, 6));
        const six = simulateFlight(vehicle(c, false), options(wind, 6));
        const three = simulateFlight(vehicle(c, false), options(wind, 3));
        // The ascent is the same flight.
        expect(Math.abs(six.summary.apogee - withRecovery.summary.apogee)).toBeLessThan(1e-6);
        expect(six.summary.flightTime).toBeGreaterThanOrEqual(six.summary.timeToApogee);
        const last6 = six.samples[six.samples.length - 1];
        if (last6 === undefined) throw new Error('no samples');
        expect(Number.isFinite(last6.altitude)).toBe(true);
        if (wind === 0) {
          expect(six.summary.endReason).toBe('model-limit');
          expect(six.warnings.join('\n')).toContain('90°');
        } else {
          expect(six.summary.endReason).toBe('landing');
          const afterRail = six.samples.filter(
            (p) => p.time > six.summary.railExitTime && p.phase !== 'landed',
          );
          expect(afterRail.every((p) => p.angleOfAttack < Math.PI / 2)).toBe(true);
        }
        // 3DOF lands; just before landing m g ≈ ½ ρ v² C_D0 A_ref.
        expect(three.summary.endReason).toBe('landing');
        const inFlight = three.samples.filter((p) => p.phase !== 'landed');
        const last3 = inFlight[inFlight.length - 1];
        if (last3 === undefined) throw new Error('no samples');
        const rho: number = standardAtmosphere1976(metres(Math.max(last3.altitude, 0))).density;
        const d: number = maximumBodyDiameter(vehicle(c, false).components);
        const aRef = (Math.PI * d * d) / 4;
        const terminal = Math.sqrt((2 * last3.mass * G) / (rho * last3.cd0 * aRef));
        const ground = three.summary.groundHitVelocity ?? Number.NaN;
        // Short falls (R1 from 169 m, R4 from 690 m) land before the terminal speed is reached.
        expect(ground / terminal).toBeLessThan(1.005);
        expect(ground / terminal).toBeGreaterThan(0.85);
        expect(last3.acceleration).toBeLessThan(0.2 * G);
        if (wind !== 0) {
          // The nose-first 6DOF landing agrees with the 3DOF fall.
          const ground6 = six.summary.groundHitVelocity ?? Number.NaN;
          expect(Math.abs(ground6 - ground) / ground).toBeLessThan(0.05);
        }
        lines.push(
          `| ${c.file} | ${String(wind)} | ${six.summary.apogee.toFixed(1)} m | ${six.summary.endReason}, ${six.summary.flightTime.toFixed(2)} s, ${Math.max(last6.altitude, 0).toFixed(1)} m, ${((last6.angleOfAttack * 180) / Math.PI).toFixed(0)}°, ${(six.summary.groundHitVelocity ?? last6.speed).toFixed(1)} m/s | ${ground.toFixed(1)} m/s | ${terminal.toFixed(1)} m/s | ${(last3.acceleration / G).toFixed(3)} g | ${(three.summary.landingDistance ?? Number.NaN).toFixed(0)} m |`,
        );
      });
    }
  }
  it('prints the table', () => {
    console.log(lines.join('\n'));
    expect(lines.length).toBe(12);
  });
});
