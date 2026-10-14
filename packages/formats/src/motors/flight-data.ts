/**
 * Recorded altimeter data from CSV (CLAUDE.md 7.5). A time column and an
 * altitude column by header names ("time", "alt"), or the first two
 * numeric columns; the altitude unit (metres or feet, UNIT-6) is chosen by
 * the caller; time must increase. Nothing is smoothed or offset.
 */
import { feetToMetres, metres, seconds } from '@lo-fi-rocket/physics';
import type { RecordedFlight } from '../design/model.js';
import { FormatError } from '../errors.js';
import { MAX_INPUT_BYTES, requireWithin } from '../limits.js';

export class FlightDataCsvError extends FormatError {
  readonly line: number;
  constructor(fileName: string | undefined, line: number, problem: string) {
    super(`${fileName ?? 'flight data CSV'}, line ${String(line)}: ${problem}`);
    this.line = line;
  }
}

const NUMBER = /^[-+]?(\d+(?:\.\d*)?|\.\d+)([eE][-+]?\d+)?$/;

export function parseFlightDataCsv(
  text: string,
  label: string,
  altitudeUnit: 'm' | 'ft',
  fileName?: string,
): RecordedFlight {
  requireWithin(fileName ?? 'The flight data', text.length, MAX_INPUT_BYTES);
  const lines = text.split(/\r?\n/);
  let timeCol: number | undefined;
  let altCol: number | undefined;
  const points: { time: number; altitude: number }[] = [];
  let first = true;
  lines.forEach((raw, index) => {
    const line = index + 1;
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#')) return;
    const fields = trimmed.split(/[,;\t]/).map((f) => f.trim());
    const numeric = fields.map((f) => NUMBER.test(f));
    const isFirst = first;
    first = false;
    if (isFirst && !numeric.some(Boolean)) {
      const names = fields.map((f) => f.toLowerCase());
      const t = names.findIndex((n) => n.includes('time'));
      const a = names.findIndex((n) => n.includes('alt') || n.includes('height'));
      if (t >= 0 && a >= 0) {
        timeCol = t;
        altCol = a;
      }
      return;
    }
    if (timeCol === undefined || altCol === undefined) {
      const first = numeric.indexOf(true);
      const second = numeric.indexOf(true, first + 1);
      if (first < 0 || second < 0) {
        throw new FlightDataCsvError(
          fileName,
          line,
          `expected a time and an altitude column, found "${trimmed}"`,
        );
      }
      timeCol = first;
      altCol = second;
    }
    const t = fields[timeCol];
    const a = fields[altCol];
    if (t === undefined || a === undefined || !NUMBER.test(t) || !NUMBER.test(a)) {
      throw new FlightDataCsvError(
        fileName,
        line,
        `expected numbers in the time and altitude columns, found "${trimmed}"`,
      );
    }
    const time = Number(t);
    const previous = points[points.length - 1];
    if (previous !== undefined && !(time > previous.time)) {
      throw new FlightDataCsvError(
        fileName,
        line,
        `time ${String(time)} s is not after the previous ${String(previous.time)} s`,
      );
    }
    const altitude: number = altitudeUnit === 'ft' ? feetToMetres(Number(a)) : Number(a);
    points.push({ time, altitude });
  });
  if (points.length < 2)
    throw new FlightDataCsvError(fileName, lines.length, 'at least two data rows are required');
  return {
    label,
    points: points.map((p) => ({ time: seconds(p.time), altitude: metres(p.altitude) })),
  };
}
