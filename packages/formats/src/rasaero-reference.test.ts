/**
 * Plan 0077: the reference rockets R1 to R5 in three simulators, opt-in.
 *
 * 1. `RASAERO_EXPORT=1`: writes each rocket as a `.CDX1` (`exportCdx1`) into
 *    `reference/rasaero/runs-ref/<name>/`, and `lofi-motors.eng`: our motor files under names of
 *    their own ("LF-D12", maker "LoFi"), so that RASAero II flies exactly our thrust curves once
 *    they are appended to its `rasp.eng` (its manual, p. 93, allows adding motors).
 * 2. Run `reference/rasaero/run-rasaero.sh` on each file (see `reference/rasaero/README.md`).
 * 3. `RASAERO=1`: compares RASAero II's apogee, maximum velocity, C_D and CP with ours and with
 *    OpenRocket 24.12's reference values, and writes `docs/reports/rasaero-reference-rockets.md`.
 *
 * The exported file is read back by our importer and flown, so that both programs fly the same
 * inputs: the finish class RASAero has (the nearest to the design's), the same lift-off weight
 * and CG, the same motor. No constant is tuned to RASAero's results (CLAUDE.md 6.7).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { centreOfPressure, dragCoefficient, mach, simulateFlight } from '@lo-fi-rocket/physics';
import { describe, expect, it, vi } from 'vitest';
import { importCdx1 } from './cdx1.js';
import { exportCdx1 } from './cdx1-export.js';
import { orkToDesign, type LibraryMotorRef } from './design/from-ork.js';
import type { RocketDesign } from './design/model.js';
import {
  designPlacedComponents,
  designSimulationOptions,
  designVehicle,
} from './design/to-physics.js';
import { parseEng } from './eng.js';
import { motorFromEng } from './motor-definition.js';
import { parseOrk } from './ork.js';

vi.setConfig({ testTimeout: 1_800_000 });

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const REFERENCE = join(ROOT, 'reference');
const RUNS = join(REFERENCE, 'rasaero', 'runs-ref');
const OUT = join(ROOT, 'docs', 'reports', 'rasaero-reference-rockets.md');
const FT = 0.3048;

/** OpenRocket 24.12's results without wind (simulate.openrocket.test.ts, reference/rockets/). */
const ROCKETS = [
  { name: 'r1-three-fin-conical', motor: 'Estes_D12', apogee: 167.045, maxVelocity: 61.972 },
  { name: 'r2-ogive-boattail', motor: 'AeroTech_G80T', apogee: 820.806, maxVelocity: 245.821 },
  { name: 'r3-minimum-diameter-24', motor: 'AeroTech_F39T', apogee: 832.929, maxVelocity: 233.975 },
  { name: 'r4-scratch-38mm', motor: 'AeroTech_H123W', apogee: 692.685, maxVelocity: 136.122 },
  {
    name: 'r5-transonic-min-dia-29',
    motor: 'AeroTech_H238T',
    apogee: 1560.531,
    maxVelocity: 369.487,
  },
] as const;

const engText = (file: string): string =>
  readFileSync(join(REFERENCE, 'motors', `${file}.eng`), 'utf8');

const library: LibraryMotorRef[] = ROCKETS.map((r) => {
  const eng = parseEng(engText(r.motor))[0];
  if (eng === undefined) throw new Error(r.motor);
  return { definition: motorFromEng(eng), provenance: { kind: 'bundled', file: `${r.motor}.eng` } };
});

function rocket(name: string): RocketDesign {
  let n = 0;
  const file = join(REFERENCE, 'rockets', `${name}.ork`);
  return orkToDesign(parseOrk(new Uint8Array(readFileSync(file)), name), library, name, () => {
    n += 1;
    return `${name}-${String(n)}`;
  }).design;
}

/** Our motor file renamed for RASAero's list: "LF-<designation>", maker "LoFi". */
function renamed(file: string): { text: string; name: string } {
  const lines = engText(file).split(/\r?\n/);
  const i = lines.findIndex((l) => l.trim() !== '' && !l.trim().startsWith(';'));
  const header = (lines[i] ?? '').trim().split(/\s+/);
  const name = `LF-${header[0] ?? '?'}`;
  header[0] = name;
  header[header.length - 1] = 'LoFi';
  lines[i] = header.join(' ');
  // RASAero's own list separates motors by ';' comment lines and has no blank lines.
  const body = lines.filter((l) => l.trim() !== '' && !l.trim().startsWith(';'));
  return {
    text: [';', `; ${file}.eng (lo-fi-rocket reference motor)`, ...body].join('\r\n'),
    name,
  };
}

describe.skipIf(process.env['RASAERO_EXPORT'] !== '1')('R1 to R5 written for RASAero II', () => {
  it('writes the .CDX1 files and the motor list', () => {
    const motors: string[] = [];
    for (const r of ROCKETS) {
      const { text, name } = renamed(r.motor);
      motors.push(text);
      const dir = join(RUNS, r.name);
      mkdirSync(dir, { recursive: true });
      const exported = exportCdx1(rocket(r.name), { motorName: `${name}  (LoFi)` });
      writeFileSync(join(dir, `${r.name}.CDX1`), exported.text);
      writeFileSync(join(dir, 'notices.txt'), exported.notices.join('\n'));
    }
    writeFileSync(join(RUNS, 'lofi-motors.eng'), motors.join('\r\n') + '\r\n');
    expect(existsSync(join(RUNS, 'lofi-motors.eng'))).toBe(true);
  });
});

/** RASAero's flight: its apogee and maximum velocity (ft, ft/s columns of the flight CSV). */
function rasaeroFlight(name: string): { apogee: number; maxVelocity: number } | undefined {
  const file = join(RUNS, name, 'flight.csv');
  if (!existsSync(file)) return undefined;
  const rows = readFileSync(file, 'latin1')
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.split(','))
    .filter((r) => r.length > 20);
  return {
    apogee: Math.max(...rows.map((r) => Number(r[22]))) * FT,
    maxVelocity: Math.max(...rows.map((r) => Number(r[17]))) * FT,
  };
}

/** RASAero's Run Test at a Mach number: power-off C_D and the CP (in). */
function rasaeroAero(name: string, at: number): { cd: number; cp: number } | undefined {
  const file = join(RUNS, name, 'runtest_a0.txt');
  if (!existsSync(file)) return undefined;
  const rows = readFileSync(file, 'latin1')
    .split(/\r?\n/)
    .map((l) => l.trim().split(/\s+/).map(Number));
  const drag = rows.find((v) => v.length === 12 && Math.abs((v[0] ?? 0) - at) < 1e-9 && v[1] === 0);
  const cp = rows.find((v) => v.length === 3 && Math.abs((v[0] ?? 0) - at) < 1e-9);
  return drag === undefined || cp === undefined
    ? undefined
    : { cd: drag[2] ?? NaN, cp: (cp[2] ?? NaN) * 0.0254 };
}

const pct = (a: number, b: number): string =>
  `${a >= b ? '+' : ''}${((a / b - 1) * 100).toFixed(1)}`;

describe.skipIf(process.env['RASAERO'] !== '1')(
  'R1 to R5 against RASAero II and OpenRocket',
  () => {
    it('compares and writes the report', () => {
      const lines: string[] = [
        '# R1 to R5 in three simulators: data',
        '',
        'Generated by `packages/formats/src/rasaero-reference.test.ts` (plan 0077); do not edit by hand.',
        '',
        "Each rocket is written as a `.CDX1` file, flown in RASAero II 1.0.2.0 with our own motor files, and read back by our importer, so that our simulator flies the same inputs: RASAero's nearest finish class, the same lift-off weight and CG, the same thrust curve. OpenRocket 24.12's figures are its own runs of the original `.ork` files, whose finish is 60 µm; the exported finish is RASAero's \"Rough Camouflage Paint\", 30.5 µm. No wind.",
        '',
        '| Rocket | RASAero apogee (m) | Ours, displayed | Ours vs RASAero (%) | Ours, OpenRocket-equivalent (60 µm) | OpenRocket 24.12 | RASAero vs OpenRocket (%) | RASAero v_max (m/s) | Ours v_max | OpenRocket v_max |',
        '|---|---|---|---|---|---|---|---|---|---|',
      ];
      const aero: string[] = [
        '',
        '## C_D and CP at Mach 0.3 (power off, no motor, same inputs)',
        '',
        '| Rocket | RASAero C_D | Ours C_D | RASAero CP (m) | Ours CP (m) |',
        '|---|---|---|---|---|',
      ];
      for (const r of ROCKETS) {
        const ras = rasaeroFlight(r.name);
        const exportedFile = join(RUNS, r.name, `${r.name}.CDX1`);
        if (ras === undefined || !existsSync(exportedFile)) {
          lines.push(`| ${r.name} | not run | | | | | | | | |`);
          continue;
        }
        const lfLibrary = library.map((m) => ({
          ...m,
          definition: {
            ...m.definition,
            designation: `LF-${m.definition.designation}`,
            manufacturer: 'LoFi',
          },
        }));
        const back = importCdx1(
          readFileSync(exportedFile, 'utf8'),
          lfLibrary,
          r.name,
          r.name,
        ).design;
        const ours = simulateFlight(designVehicle(back), designSimulationOptions(back));
        const original = rocket(r.name);
        const orMode = simulateFlight(
          designVehicle(original),
          designSimulationOptions(original, 'openrocket-equivalent'),
        );
        lines.push(
          `| ${r.name} | ${ras.apogee.toFixed(1)} | ${ours.summary.apogee.toFixed(1)} | ${pct(ours.summary.apogee, ras.apogee)} | ${orMode.summary.apogee.toFixed(1)} | ${r.apogee.toFixed(1)} | ${pct(ras.apogee, r.apogee)} | ${ras.maxVelocity.toFixed(1)} | ${ours.summary.maxVelocity.toFixed(1)} | ${r.maxVelocity.toFixed(1)} |`,
        );
        const a = rasaeroAero(r.name, 0.3);
        if (a !== undefined) {
          const parts = designPlacedComponents(back);
          const length = Math.max(
            ...parts.map(
              (p) =>
                (p.position as number) +
                ('length' in p.component ? (p.component.length as number) : 0),
            ),
          );
          // RASAero's Run Test Reynolds number is on the rocket's length at sea level.
          const d = dragCoefficient({
            components: parts,
            mach: mach(0.3),
            reynolds: (0.3 * 340.294 * length) / 1.4607e-5,
            roughnessHeight: back.finish.roughnessHeight,
            baseDragMotorRule: 'never',
          });
          const cp = centreOfPressure(parts, {
            mach: mach(0.3),
            rollAngle: 'worst',
            finRollReduction: false,
          });
          aero.push(
            `| ${r.name} | ${a.cd.toFixed(3)} | ${(d.cd0 as number).toFixed(3)} | ${a.cp.toFixed(4)} | ${(cp.cp as number).toFixed(4)} |`,
          );
        }
        expect(Number.isFinite(ours.summary.apogee)).toBe(true);
      }
      mkdirSync(dirname(OUT), { recursive: true });
      writeFileSync(OUT, [...lines, ...aero, ''].join('\n'));
    });
  },
);
