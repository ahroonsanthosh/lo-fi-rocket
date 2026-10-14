/**
 * Plan 0075 (D-114): the comparison with RASAero II, opt-in. It needs RASAero's example designs
 * and motor file, which are not redistributed: run `reference/rasaero/fetch-examples.sh`, then
 * `RASAERO=1 pnpm vitest run packages/formats/src/rasaero-comparison.test.ts`. With RASAero's own
 * outputs for each example in `reference/rasaero/runs/<name>/` (from `run-rasaero.sh` under Wine),
 * it also flies our simulator on RASAero's drag curve and compares the drag term by term.
 *
 * It writes `docs/reports/rasaero-comparison-data.md`; `docs/reports/rasaero-comparison.md`
 * explains the differences. No constant is tuned to RASAero's results (CLAUDE.md 6.7).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  dragCoefficient,
  mach,
  simulateFlight,
  type FlightResult,
  type PlacedComponent,
} from '@lo-fi-rocket/physics';
import { describe, expect, it, vi } from 'vitest';
import { importCdx1, type Cdx1Import } from './cdx1.js';
import type { RocketDesign } from './design/model.js';
import {
  designPlacedComponents,
  designSimulationOptions,
  designVehicle,
  type PhysicsMode,
} from './design/to-physics.js';
import { RASAERO_DATA, raspLibrary } from './validation/rasaero-examples.js';

vi.setConfig({ testTimeout: 3_600_000 });

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const RASAERO = join(ROOT, 'reference', 'rasaero');
const DATA = RASAERO_DATA;
const RUNS = process.env['RASAERO_RUNS'] ?? join(RASAERO, 'runs');
const OUT = join(ROOT, 'docs', 'reports', 'rasaero-comparison-data.md');
const FT = 0.3048;

/** The run directory's name for an example, as run-rasaero.sh writes it. */
const runName = (file: string): string =>
  file.replace(/\.cdx1$/i, '').replace(/[^A-Za-z0-9_-]/g, '_');

/** RASAero's zero-angle power-off C_D against Mach (its Aero Plots CSV export). */
function rasaeroDragCurve(name: string): { mach: number; cd: number }[] | undefined {
  const file = join(RUNS, name, 'aero.csv');
  if (!existsSync(file)) return undefined;
  const rows = readFileSync(file, 'latin1')
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.split(',').map(Number))
    .filter((r) => r[1] === 0 && Number.isFinite(r[0]) && Number.isFinite(r[3]));
  const points = rows.map((r) => ({ mach: r[0] ?? NaN, cd: r[3] ?? NaN }));
  const first = points[0];
  return first === undefined ? undefined : [{ mach: 0, cd: first.cd }, ...points];
}

/** RASAero's Run Test drag breakdown at a Mach number (manual p. 90, subsonic table). */
function rasaeroBreakdown(name: string, at: number): number[] | undefined {
  const file = join(RUNS, name, 'runtest_a0.txt');
  if (!existsSync(file)) return undefined;
  return readFileSync(file, 'latin1')
    .split(/\r?\n/)
    .map((l) => l.trim().split(/\s+/).map(Number))
    .find((v) => v.length === 12 && Math.abs((v[0] ?? 0) - at) < 1e-9 && v[1] === 0);
}

interface Row {
  readonly file: string;
  readonly imported: Cdx1Import;
  readonly displayed: FlightResult;
  readonly comparison: FlightResult;
  readonly withRasaeroDrag?: FlightResult;
}

const pct = (a: number | undefined, b: number | undefined): string =>
  a === undefined || b === undefined
    ? 'n/a'
    : `${a >= b ? '+' : ''}${((a / b - 1) * 100).toFixed(1)}`;

function stats(values: readonly (number | undefined)[]): string {
  const xs = values.filter((x): x is number => x !== undefined && Number.isFinite(x));
  if (xs.length === 0) return 'none';
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  const rms = Math.sqrt(xs.reduce((s, x) => s + x * x, 0) / xs.length);
  const sign = (x: number): string => `${x >= 0 ? '+' : ''}${x.toFixed(1)}`;
  return `${String(xs.length)} designs, mean ${sign(mean)} %, rms ${rms.toFixed(1)} %, from ${sign(Math.min(...xs))} to ${sign(Math.max(...xs))} %`;
}

const ratio = (a: number | undefined, b: number | undefined): number | undefined =>
  a === undefined || b === undefined ? undefined : (a / b - 1) * 100;

/** Our drag terms at a Mach number and Reynolds number, grouped as RASAero's Run Test groups them. */
function ourBreakdown(design: RocketDesign, at: number, reynolds: number): number[] {
  const parts = designPlacedComponents(design);
  const noFins: PlacedComponent[] = parts.filter((p) => p.component.kind !== 'finSet');
  const args = {
    mach: mach(at),
    reynolds,
    roughnessHeight: design.finish.roughnessHeight,
    baseDragMotorRule: 'never' as const,
    baseDragMethod: 'datcom' as const,
  };
  const d = dragCoefficient({ components: parts, ...args });
  const body = dragCoefficient({ components: noFins, ...args });
  const sum = (kinds: readonly string[]): number =>
    d.terms.filter((t) => kinds.includes(t.kind)).reduce((s, t) => s + t.cd, 0);
  return [
    d.cd0,
    body.skinFriction.cd,
    sum(['noseCone', 'transition']),
    sum(['base']),
    d.skinFriction.cd - body.skinFriction.cd,
    sum(['finSet']),
    sum(['railButton', 'launchLug']),
  ];
}

describe.skipIf(process.env['RASAERO'] !== '1')('RASAero II comparison (plan 0075)', () => {
  it('imports and flies every example, and writes the comparison', () => {
    const examples = join(DATA, 'Examples');
    expect(
      existsSync(examples),
      `run reference/rasaero/fetch-examples.sh first (${examples})`,
    ).toBe(true);
    const { library, skipped } = raspLibrary(readFileSync(join(DATA, 'rasp.eng'), 'latin1'));
    const rows: Row[] = [];
    for (const file of readdirSync(examples)
      .filter((f) => /\.cdx1$/i.test(f))
      .sort()) {
      const imported = importCdx1(
        readFileSync(join(examples, file), 'latin1'),
        library,
        file,
        file,
      );
      const fly = (mode: PhysicsMode, design: RocketDesign = imported.design): FlightResult =>
        simulateFlight(designVehicle(design), designSimulationOptions(design, mode));
      const curve = rasaeroDragCurve(runName(file));
      rows.push({
        file,
        imported,
        displayed: fly('displayed'),
        comparison: fly('openrocket-equivalent'),
        ...(curve === undefined
          ? {}
          : {
              withRasaeroDrag: fly('displayed', {
                ...imported.design,
                dragCurve: { label: 'RASAero II power-off', points: curve },
              }),
            }),
      });
    }

    const ft = (m: number | undefined): string => (m === undefined ? 'n/a' : (m / FT).toFixed(0));
    const lines: string[] = [
      '# RASAero II comparison: data',
      '',
      'Generated by `packages/formats/src/rasaero-comparison.test.ts` (plan 0075, D-114); do not edit by hand. `docs/reports/rasaero-comparison.md` explains it.',
      '',
      `RASAero II 1.0.2.0's ${String(rows.length)} example designs, read by the \`.CDX1\` importer and flown with RASAero's own \`rasp.eng\` (${String(library.length)} motors read; ${String(skipped.length)} malformed entries skipped). Apogees above the pad, in feet as the files give them. "Measured" is the altitude the file's notes give (altimeter or GPS). "Ours with RASAero's C_D" flies our simulator on RASAero's own power-off drag curve.`,
      '',
      "| Design | Max Mach | Measured | RASAero | Ours, displayed | Ours, OpenRocket-equivalent | Ours with RASAero's C_D | RASAero vs measured (%) | Displayed vs measured (%) | OpenRocket-equivalent vs measured (%) | Ours with RASAero's C_D vs RASAero (%) |",
      '|---|---|---|---|---|---|---|---|---|---|---|',
    ];
    const ordered = [...rows].sort(
      (a, b) => a.displayed.summary.maxMach - b.displayed.summary.maxMach,
    );
    for (const r of ordered) {
      const p = r.imported.prediction?.apogee;
      const m = r.imported.measuredApogee;
      lines.push(
        `| ${r.file.replace(/\.cdx1$/i, '')} | ${r.displayed.summary.maxMach.toFixed(2)} | ${ft(m)} | ${ft(p)} | ${ft(r.displayed.summary.apogee)} | ${ft(r.comparison.summary.apogee)} | ${ft(r.withRasaeroDrag?.summary.apogee)} | ${pct(p, m)} | ${pct(r.displayed.summary.apogee, m)} | ${pct(r.comparison.summary.apogee, m)} | ${pct(r.withRasaeroDrag?.summary.apogee, p)} |`,
      );
    }
    for (const [title, keep] of [
      ['Below Mach 0.95', (r: Row) => r.displayed.summary.maxMach < 0.95],
      ['Mach 0.95 and above', (r: Row) => r.displayed.summary.maxMach >= 0.95],
      ['All', () => true],
    ] as const) {
      const set = rows.filter(keep);
      const m = (r: Row): number | undefined => r.imported.measuredApogee;
      const p = (r: Row): number | undefined => r.imported.prediction?.apogee;
      lines.push(
        '',
        `**${title}:**`,
        '',
        `- RASAero against measured: ${stats(set.map((r) => ratio(p(r), m(r))))}`,
        `- Ours (displayed) against measured: ${stats(set.map((r) => ratio(r.displayed.summary.apogee, m(r))))}`,
        `- Ours (OpenRocket-equivalent) against measured: ${stats(set.map((r) => ratio(r.comparison.summary.apogee, m(r))))}`,
        `- Ours (displayed) against RASAero: ${stats(set.map((r) => ratio(r.displayed.summary.apogee, p(r))))}`,
        `- Ours with RASAero's C_D against RASAero: ${stats(set.map((r) => ratio(r.withRasaeroDrag?.summary.apogee, p(r))))}`,
        `- Ours with RASAero's C_D against measured: ${stats(set.map((r) => ratio(r.withRasaeroDrag?.summary.apogee, m(r))))}`,
        `- Maximum velocity, ours (displayed) against RASAero: ${stats(set.map((r) => ratio(r.displayed.summary.maxVelocity, r.imported.prediction?.maxVelocity)))}`,
      );
    }

    lines.push(
      '',
      '## Drag by term at Mach 0.3 and 0.6',
      '',
      "RASAero's Run Test breakdown (manual p. 90) beside ours in the displayed mode (DATCOM base drag, no motor), at RASAero's Reynolds number. Our fin friction is the friction with the fins less that without them; our pressure is the nose's and transitions'.",
      '',
      '| Design | Mach | RASAero C_D | body friction | body pressure | base | fin friction & pressure | fin interference | fin base | protuberances | Ours C_D | body friction | body pressure | base | fin friction | fin pressure | rail guides, lugs |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    );
    for (const r of rows) {
      for (const at of [0.3, 0.6]) {
        const ras = rasaeroBreakdown(runName(r.file), at);
        if (ras === undefined || r.imported.design.stages !== undefined) continue;
        const ours = ourBreakdown(r.imported.design, at, ras[11] ?? NaN);
        const f = (x: number | undefined): string => (x === undefined ? 'n/a' : x.toFixed(3));
        lines.push(
          `| ${r.file.replace(/\.cdx1$/i, '')} | ${String(at)} | ${[2, 4, 5, 6, 7, 8, 9, 10].map((i) => f(ras[i])).join(' | ')} | ${ours.map(f).join(' | ')} |`,
        );
      }
    }
    lines.push('', '## Motors skipped in `rasp.eng`', '', ...skipped.map((s) => `- ${s}`), '');
    writeFileSync(OUT, lines.join('\n'));

    // The trajectory alone: on RASAero's own drag, subsonic flights land within 1.5 % of its apogee.
    for (const r of rows) {
      const p = r.imported.prediction?.apogee;
      if (r.withRasaeroDrag === undefined || p === undefined) continue;
      if (r.displayed.summary.maxMach >= 0.95) continue;
      expect(Math.abs(r.withRasaeroDrag.summary.apogee / p - 1), r.file).toBeLessThan(0.015);
    }
  });
});
