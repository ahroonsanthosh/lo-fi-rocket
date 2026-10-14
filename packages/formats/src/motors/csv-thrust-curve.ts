/**
 * Custom thrust curves from CSV (plan 0013, CLAUDE.md 6.6). There is no
 * published specification for such files, so the rules are the project's
 * own and are stated here and in docs/decisions.md (D-044):
 *
 * - Columns: time (s), thrust (N), optionally propellant remaining (kg) and,
 *   for engines with tanks, the motor's CG from its fore end (m) (MOT-6,
 *   plan 0018), separated by commas, semicolons, tabs or spaces; a header
 *   line of non-numeric words is allowed and ignored; blank lines and lines
 *   starting with # or ; are ignored.
 * - Times strictly increase; the first point is at 0 s (a curve that does
 *   not start at zero is rejected rather than extended); thrust is never
 *   negative; the last thrust must be 0 N (burnout).
 * - With a third column the motor uses the 'mass-profile' rule (MOT-4);
 *   without it the impulse-proportional rule of RASP motors (MOT-3,
 *   D-028). The casing masses, diameter and length come from the caller.
 */
import {
  kilograms,
  metres,
  newtons,
  seconds,
  validateMotor,
  type Kilograms,
  type Metres,
  type MotorDefinition,
} from '@lo-fi-rocket/physics';
import { FormatError } from '../errors.js';
import { MAX_INPUT_BYTES, requireWithin } from '../limits.js';

export class CsvThrustCurveError extends FormatError {
  readonly line: number;
  constructor(fileName: string | undefined, line: number, problem: string) {
    super(`${fileName ?? 'thrust curve CSV'}, line ${String(line)}: ${problem}`);
    this.line = line;
  }
}

export interface CustomMotorMetadata {
  readonly designation: string;
  readonly manufacturer: string;
  readonly diameter: Metres;
  readonly length: Metres;
  readonly totalMass: Kilograms;
  readonly propellantMass: Kilograms;
}

const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

export function parseThrustCurveCsv(
  text: string,
  meta: CustomMotorMetadata,
  fileName?: string,
): MotorDefinition {
  requireWithin(fileName ?? 'The thrust curve', text.length, MAX_INPUT_BYTES);
  const rows: { line: number; values: number[] }[] = [];
  let columns: number | undefined;
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = index + 1;
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith(';')) return;
    const fields = trimmed.split(/[,;\t ]+/).filter((f) => f !== '');
    const numeric = fields.every((f) => NUMBER.test(f));
    if (!numeric) {
      if (rows.length === 0 && fields.every((f) => !NUMBER.test(f))) return; // header line
      throw new CsvThrustCurveError(fileName, line, `expected numbers, found "${trimmed}"`);
    }
    if (fields.length < 2 || fields.length > 4) {
      throw new CsvThrustCurveError(
        fileName,
        line,
        `expected 2 to 4 columns (time, thrust[, propellant remaining[, CG from the fore end]]), found ${String(fields.length)}`,
      );
    }
    columns ??= fields.length;
    if (fields.length !== columns) {
      throw new CsvThrustCurveError(
        fileName,
        line,
        `expected ${String(columns)} columns like the first data line, found ${String(fields.length)}`,
      );
    }
    rows.push({ line, values: fields.map(Number) });
  });
  if (rows.length < 2) {
    throw new CsvThrustCurveError(fileName, lines.length, 'at least two data lines are required');
  }
  const first = rows[0];
  if (first?.values[0] !== 0) {
    throw new CsvThrustCurveError(
      fileName,
      first?.line ?? 1,
      'the first point must be at time 0 s (the curve is not extended to zero)',
    );
  }
  let previous = -1;
  for (const r of rows) {
    const [t, f, m, cg] = r.values;
    if (t === undefined || f === undefined)
      throw new CsvThrustCurveError(fileName, r.line, 'missing value');
    if (!(t > previous)) {
      throw new CsvThrustCurveError(
        fileName,
        r.line,
        `time ${String(t)} s is not after the previous point`,
      );
    }
    if (f < 0) throw new CsvThrustCurveError(fileName, r.line, `thrust ${String(f)} N is negative`);
    if (m !== undefined && m < 0) {
      throw new CsvThrustCurveError(
        fileName,
        r.line,
        `propellant remaining ${String(m)} kg is negative`,
      );
    }
    if (cg !== undefined && (cg < 0 || cg > meta.length)) {
      throw new CsvThrustCurveError(
        fileName,
        r.line,
        `CG from the fore end ${String(cg)} m lies outside the motor (0 to ${String(meta.length)} m)`,
      );
    }
    previous = t;
  }
  const last = rows[rows.length - 1];
  if (last !== undefined && last.values[1] !== 0) {
    throw new CsvThrustCurveError(
      fileName,
      last.line,
      'the last point must have 0 N thrust (burnout)',
    );
  }
  const points = rows.map((r) => ({
    time: seconds(r.values[0] ?? 0),
    thrust: newtons(r.values[1] ?? 0),
  }));
  const def: MotorDefinition =
    columns === 3 || columns === 4
      ? {
          ...meta,
          points,
          massRule: 'mass-profile',
          massProfile: rows.map((r) => ({
            time: seconds(r.values[0] ?? 0),
            propellantRemaining: kilograms(r.values[2] ?? 0),
            ...(columns === 4 ? { cgFromForeEnd: metres(r.values[3] ?? 0) } : {}),
          })),
          sourceFormat: 'custom',
        }
      : { ...meta, points, massRule: 'impulse-proportional', sourceFormat: 'custom' };
  validateMotor(def);
  return def;
}
