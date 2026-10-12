/**
 * C_D versus Mach tables from CSV (CLAUDE.md 6.7 item 2, D-047). Any CSV
 * with a Mach column and a C_D column: by header names (a column whose
 * name contains "mach"; the C_D column named "cd", "cd power off",
 * "cd_power_off" or the first other numeric column), or, without a
 * header, the first two numeric columns. Rows with Mach not increasing,
 * negative C_D or non-numeric values are errors, never skipped.
 */
import { validateDragCurve, type DragCurve } from '@lo-fi-rocket/physics';
import { FormatError } from '../errors.js';

export class DragCurveCsvError extends FormatError {
  readonly line: number;
  constructor(fileName: string | undefined, line: number, problem: string) {
    super(`${fileName ?? 'drag curve CSV'}, line ${String(line)}: ${problem}`);
    this.line = line;
  }
}

const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

function split(line: string): string[] {
  return line.split(/[,;\t]/).map((f) => f.trim());
}

function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function parseDragCurveCsv(text: string, label: string, fileName?: string): DragCurve {
  const lines = text.split(/\r?\n/);
  let machCol: number | undefined;
  let cdCol: number | undefined;
  const points: { mach: number; cd: number }[] = [];
  let first = true;
  lines.forEach((raw, index) => {
    const line = index + 1;
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#')) return;
    const fields = split(trimmed);
    const numeric = fields.map((f) => NUMBER.test(f));
    const isFirst = first;
    first = false;
    if (isFirst && !numeric.some(Boolean)) {
      // A header line: pick the columns by name.
      const names = fields.map(normalise);
      const mach = names.findIndex((n) => n.includes('mach'));
      if (mach >= 0) {
        machCol = mach;
        const cdNamed = names.findIndex(
          (n, i) =>
            i !== mach &&
            (n === 'cd' ||
              n === 'cd power off' ||
              n === 'cd total' ||
              n.startsWith('cd ') ||
              n.endsWith(' cd')),
        );
        cdCol = cdNamed >= 0 ? cdNamed : names.findIndex((_, i) => i !== mach);
        if (cdCol < 0)
          throw new DragCurveCsvError(fileName, line, 'no C_D column beside the Mach column');
      }
      return;
    }
    if (machCol === undefined || cdCol === undefined) {
      const first = numeric.indexOf(true);
      const second = numeric.indexOf(true, first + 1);
      if (first < 0 || second < 0) {
        throw new DragCurveCsvError(
          fileName,
          line,
          `expected at least two numeric columns, found "${trimmed}"`,
        );
      }
      machCol = first;
      cdCol = second;
    }
    const m = fields[machCol];
    const c = fields[cdCol];
    if (m === undefined || c === undefined || !NUMBER.test(m) || !NUMBER.test(c)) {
      throw new DragCurveCsvError(
        fileName,
        line,
        `expected numbers in the Mach and C_D columns, found "${trimmed}"`,
      );
    }
    const mach = Number(m);
    const cd = Number(c);
    const previous = points[points.length - 1];
    if (previous !== undefined && !(mach > previous.mach)) {
      throw new DragCurveCsvError(
        fileName,
        line,
        `Mach ${String(mach)} is not greater than the previous ${String(previous.mach)}`,
      );
    }
    if (cd < 0) throw new DragCurveCsvError(fileName, line, `C_D ${String(cd)} is negative`);
    points.push({ mach, cd });
  });
  if (points.length < 2)
    throw new DragCurveCsvError(fileName, lines.length, 'at least two data rows are required');
  const curve: DragCurve = { label, points };
  validateDragCurve(curve);
  return curve;
}
