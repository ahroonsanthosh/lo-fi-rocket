/**
 * Plan 0080 step 1: the real-flight benchmark, at the core of the project's accuracy. Every flown
 * rocket among RASAero II's examples, whose notes give the apogee it really reached, is flown in
 * both modes and compared. The examples are fetched by `reference/rasaero/fetch-examples.sh` (CI
 * runs it; locally the test is skipped without them, unless REAL_FLIGHTS_REQUIRED=1).
 *
 * The ratios in `real-flights.ts` must match the flights: a physics change that moves them fails
 * here until they are regenerated with REAL_FLIGHTS_WRITE=1, which also rewrites
 * `docs/reports/real-flights.md`, and the commit names the change (as the goldens, CLAUDE.md 7.6).
 * Nothing is fitted to these flights (CLAUDE.md 7.4).
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { simulateFlight, type FlightResult } from '@lo-fi-rocket/physics';
import { describe, expect, it, vi } from 'vitest';
import type { MeasuringInstrument } from '../cdx1.js';
import { designSimulationOptions, designVehicle, type PhysicsMode } from '../design/to-physics.js';
import { rasaeroExamples, rasaeroExamplesPresent, REPO_ROOT } from './rasaero-examples.js';
import {
  REAL_FLIGHT_MACH_SPLIT,
  REAL_FLIGHTS,
  realFlightRange,
  type RealFlightRatios,
} from './real-flights.js';

vi.setConfig({ testTimeout: 900_000 });

const FT = 0.3048;
const present = rasaeroExamplesPresent();
const required = process.env['REAL_FLIGHTS_REQUIRED'] === '1';
const write = process.env['REAL_FLIGHTS_WRITE'] === '1';

interface Flight {
  readonly name: string;
  readonly measured: number;
  readonly instrument: MeasuringInstrument | undefined;
  readonly windMph: number;
  readonly displayed: FlightResult;
  readonly comparison: FlightResult;
}

/**
 * Plan 0081 (ATM-13): what the flight's own instrument would have read on the predicted flight. A
 * barometric altimeter converts pressure with the standard atmosphere, so it is compared with the
 * predicted barometric reading; GPS, optical tracking and accelerometers with the true apogee.
 */
const predicted = (f: Flight, r: FlightResult): number =>
  f.instrument === 'barometric' ? r.summary.barometricApogee : r.summary.apogee;

/** The ratios of a set, rounded to 4 decimals as `real-flights.ts` keeps them. */
function ratios(set: readonly Flight[]): RealFlightRatios {
  const xs = set.map((f) => f.measured / predicted(f, f.displayed)).sort((a, b) => a - b);
  const n = xs.length;
  const at = (i: number): number => xs[i] ?? NaN;
  const median = n % 2 === 1 ? at((n - 1) / 2) : (at(n / 2 - 1) + at(n / 2)) / 2;
  const round = (x: number): number => Math.round(x * 1e4) / 1e4;
  return n === 0
    ? { flights: 0, low: 1, median: 1, high: 1 }
    : { flights: n, low: round(at(0)), median: round(median), high: round(at(n - 1)) };
}

/** Predicted (for the flight's instrument) over measured, minus one, in per cent. */
const error = (f: Flight, r: FlightResult): number => (predicted(f, r) / f.measured - 1) * 100;
/** The true apogee over measured, minus one, in per cent: the comparison before plan 0081. */
const trueError = (f: Flight, r: FlightResult): number => (r.summary.apogee / f.measured - 1) * 100;

function stats(xs: readonly number[]): string {
  if (xs.length === 0) return 'none';
  const sorted = [...xs].sort((a, b) => a - b);
  const n = sorted.length;
  const median =
    n % 2 === 1
      ? (sorted[(n - 1) / 2] ?? NaN)
      : ((sorted[n / 2 - 1] ?? NaN) + (sorted[n / 2] ?? NaN)) / 2;
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  const rms = Math.sqrt(xs.reduce((s, x) => s + x * x, 0) / n);
  const sign = (x: number): string => `${x >= 0 ? '+' : ''}${x.toFixed(1)}`;
  return `${String(n)} flights: mean ${sign(mean)} %, median ${sign(median)} %, rms ${rms.toFixed(1)} %, from ${sign(sorted[0] ?? NaN)} to ${sign(sorted[n - 1] ?? NaN)} %`;
}

describe.skipIf(!present && !required)('real flights (plan 0080)', () => {
  it('flies every flown example in both modes, and the published ratios match', () => {
    expect(present, 'run reference/rasaero/fetch-examples.sh first').toBe(true);
    const { examples, motors, skipped } = rasaeroExamples();
    const fly = (e: (typeof examples)[number], mode: PhysicsMode): FlightResult => {
      const d = e.imported.design;
      return simulateFlight(designVehicle(d), designSimulationOptions(d, mode));
    };
    const flights: Flight[] = examples
      .filter((e) => e.imported.measuredApogee !== undefined)
      .map((e) => ({
        name: e.file.replace(/\.cdx1$/i, ''),
        measured: e.imported.measuredApogee ?? NaN,
        instrument: e.imported.measuredBy,
        windMph: e.imported.design.launch.wind.speed / 0.44704,
        displayed: fly(e, 'displayed'),
        comparison: fly(e, 'openrocket-equivalent'),
      }));
    expect(flights.length).toBe(24);
    const below = flights.filter((f) => f.displayed.summary.maxMach < REAL_FLIGHT_MACH_SPLIT);
    const above = flights.filter((f) => f.displayed.summary.maxMach >= REAL_FLIGHT_MACH_SPLIT);
    const computed = { below: ratios(below), above: ratios(above) };

    if (write) {
      writeFileSync(
        join(REPO_ROOT, 'packages', 'formats', 'src', 'validation', 'real-flights.data.json'),
        `${JSON.stringify(computed, null, 2)}\n`,
      );
      const ft = (m: number): string => (m / FT).toFixed(0);
      const sign = (x: number): string => `${x >= 0 ? '+' : ''}${x.toFixed(1)}`;
      const lines = [
        '# Real flights',
        '',
        'Generated by `packages/formats/src/validation/real-flights.test.ts` (plans 0080 and 0081, D-119, D-121); do not edit by hand.',
        '',
        `The flown rockets among RASAero II 1.0.2.0's example designs, read by the \`.CDX1\` importer and flown with RASAero's own \`rasp.eng\` (${String(motors)} motors read, ${String(skipped.length)} malformed entries skipped), against the apogee each really reached as its notes give it. Apogees above the pad, in feet as the files give them. Error is predicted over measured, minus one: positive means the simulator predicts too high. "Displayed" is the figure the app shows; "OpenRocket-equivalent" is the comparison mode (D-016).`,
        '',
        "**Like with like (plan 0081, D-121).** A barometric altimeter converts the pressure it measures to height with the standard atmosphere, \"a basis for pressure altimeter calibrations\" (U.S. Standard Atmosphere 1976, foreword p. xiv). On a day warmer than standard the air column is taller for the same pressure drop, so it reads below the true height. Each file gives its launch day's temperature, which the simulation uses. A flight measured barometrically is therefore compared with what a barometric altimeter would have read on the predicted flight (ATM-13); GPS, optical tracking and accelerometer flights with the true apogee. The day's atmosphere is the site's temperature offset carried up at the standard lapse rate (ATM-11), and instruments differ: on the Kinsel flight two barometric altimeters read 42 231 and 40 113 ft, 5 % apart (the GPS 42 771 ft).",
        '',
        "Nothing is fitted to these flights (CLAUDE.md 7.4). They are RASAero II's own showcase set, so they measure agreement with its curation as much as with physics; the owner's own flights will join them (plan 0080 section 6).",
        '',
        '| Flight | Measured by | Wind in file (mph) | Max Mach | Measured (ft) | Displayed, true apogee (ft) | Displayed, as the instrument reads it (ft) | Error (%) | OpenRocket-equivalent, as the instrument reads it (ft) | Error (%) |',
        '|---|---|---|---|---|---|---|---|---|---|',
        ...[...flights]
          .sort((a, b) => a.displayed.summary.maxMach - b.displayed.summary.maxMach)
          .map(
            (f) =>
              `| ${f.name} | ${f.instrument ?? 'not stated'} | ${f.windMph.toFixed(0)} | ${f.displayed.summary.maxMach.toFixed(2)} | ${ft(f.measured)} | ${ft(f.displayed.summary.apogee)} | ${ft(predicted(f, f.displayed))} | ${sign(error(f, f.displayed))} | ${ft(predicted(f, f.comparison))} | ${sign(error(f, f.comparison))} |`,
          ),
        '',
        `## By speed range (split at Mach ${String(REAL_FLIGHT_MACH_SPLIT)})`,
        '',
        `- **Below, displayed:** ${stats(below.map((f) => error(f, f.displayed)))}`,
        `- **Below, OpenRocket-equivalent:** ${stats(below.map((f) => error(f, f.comparison)))}`,
        `- **Above, displayed:** ${stats(above.map((f) => error(f, f.displayed)))}`,
        `- **Above, OpenRocket-equivalent:** ${stats(above.map((f) => error(f, f.comparison)))}`,
        `- **Below, displayed, the true apogee against every instrument (the comparison before plan 0081):** ${stats(below.map((f) => trueError(f, f.displayed)))}`,
        `- **Above, displayed, the same:** ${stats(above.map((f) => trueError(f, f.displayed)))}`,
        '',
        '## The target (plan 0080 section 2)',
        '',
        "Below Mach 0.95: the mean and median within ±3 % and the rms within 6 %, RASAero II's own scatter on these flights. Until it is met, every flight result shows the range these flights give (D-119):",
        '',
        `- **Below Mach ${String(REAL_FLIGHT_MACH_SPLIT)}:** ${String(computed.below.flights)} rockets reached ${(computed.below.low * 100).toFixed(0)} to ${(computed.below.high * 100).toFixed(0)} % of the displayed apogee, each as its own instrument reads it (median ${(computed.below.median * 100).toFixed(0)} %).`,
        `- **Mach ${String(REAL_FLIGHT_MACH_SPLIT)} and above:** ${String(computed.above.flights)} rockets reached ${(computed.above.low * 100).toFixed(0)} to ${(computed.above.high * 100).toFixed(0)} % (median ${(computed.above.median * 100).toFixed(0)} %).`,
        '',
      ];
      writeFileSync(join(REPO_ROOT, 'docs', 'reports', 'real-flights.md'), lines.join('\n'));
    }
    expect(
      { below: REAL_FLIGHTS.below, above: REAL_FLIGHTS.above },
      'the flights moved: regenerate with REAL_FLIGHTS_WRITE=1 and name the change in the commit',
    ).toEqual(computed);
  });
});

describe('realFlightRange', () => {
  const data = {
    below: { flights: 13, low: 0.8, median: 0.86, high: 0.95 },
    above: { flights: 11, low: 0.65, median: 0.88, high: 1.02 },
  };

  it('scales the apogee by the ratios of its speed range', () => {
    // 1000 m below Mach 0.95: 0.8, 0.86 and 0.95 of it.
    expect(realFlightRange(1000, 0.6, data)).toEqual({
      below: true,
      flights: 13,
      lowRatio: 0.8,
      medianRatio: 0.86,
      highRatio: 0.95,
      low: 800,
      median: 860,
      high: 950,
    });
    expect(realFlightRange(1000, 0.95, data)?.below).toBe(false);
    expect(realFlightRange(1000, 2, data)?.flights).toBe(11);
  });

  it('gives nothing without flights or without a finite apogee', () => {
    const none = { ...data, below: { flights: 0, low: 1, median: 1, high: 1 } };
    expect(realFlightRange(1000, 0.5, none)).toBeUndefined();
    expect(realFlightRange(Number.NaN, 0.5, data)).toBeUndefined();
  });
});
