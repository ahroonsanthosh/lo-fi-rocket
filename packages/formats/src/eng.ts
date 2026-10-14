/**
 * Minimal reader for RASP `.eng` motor files.
 *
 * Source: ThrustCurve.org, "RASP File Format"
 * (reference/docs/thrustcurve-api/raspformat.html). The rules applied here
 * are quoted in docs/plans/0004-eng-reader.md. Phase 1 needs only the header
 * (masses and dimensions) and the data points; thrust interpolation and mass
 * during burn are Phase 2.
 */
import {
  kilograms,
  millimetresToMetres,
  newtons,
  seconds,
  type Kilograms,
  type Metres,
  type Newtons,
  type Seconds,
} from '@lo-fi-rocket/physics';
import { EngParseError } from './errors.js';
import { MAX_INPUT_BYTES, requireWithin } from './limits.js';

export interface ThrustPoint {
  readonly time: Seconds;
  readonly thrust: Newtons;
}

export interface EngMotor {
  /** Common name, e.g. "D12" (header field 1). */
  readonly designation: string;
  /** Manufacturer abbreviation (header field 7). */
  readonly manufacturer: string;
  /** Casing diameter (header field 2, given in mm). */
  readonly diameter: Metres;
  /** Casing length (header field 3, given in mm). */
  readonly length: Metres;
  /** Available delays in seconds; `plugged` if the motor has no ejection charge ("P"). */
  readonly delays: readonly Seconds[] | 'plugged';
  /** Whether "P" appeared alongside numeric delays (a plugged option). */
  readonly pluggedOption: boolean;
  /** Mass of all consumables (header field 5). */
  readonly propellantMass: Kilograms;
  /** Loaded mass (header field 6). */
  readonly totalMass: Kilograms;
  /** Data points with the implicit (0 s, 0 N) origin prepended. */
  readonly points: readonly ThrustPoint[];
  /** Time of the final (zero-thrust) point. */
  readonly burnTime: Seconds;
  /** Trapezoidal integral of thrust over time, informational. */
  readonly totalImpulse: number;
  /** Comment lines (without the semicolon) that preceded the header. */
  readonly comments: readonly string[];
}

function parseNumber(
  fileName: string | undefined,
  line: number,
  field: string,
  text: string,
): number {
  // RASP numbers are plain decimals, possibly without a leading zero (".0108").
  if (!/^[+-]?(\d+(?:\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(text)) {
    throw new EngParseError(fileName, line, `${field} must be a number, got "${text}"`);
  }
  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw new EngParseError(fileName, line, `${field} must be a finite number, got "${text}"`);
  }
  return value;
}

function parseHeader(
  fileName: string | undefined,
  line: number,
  text: string,
  comments: string[],
): Omit<EngMotor, 'points' | 'burnTime' | 'totalImpulse'> {
  const fields = text.trim().split(/\s+/);
  if (fields.length !== 7) {
    throw new EngParseError(
      fileName,
      line,
      `the header must have exactly 7 space-separated fields (name, diameter mm, length mm, delays, propellant kg, total kg, manufacturer), got ${String(fields.length)}: "${text.trim()}"`,
    );
  }
  const [
    designation,
    diameterText,
    lengthText,
    delaysText,
    propellantText,
    totalText,
    manufacturer,
  ] = fields as [string, string, string, string, string, string, string];
  const diameterMm = parseNumber(fileName, line, 'diameter (mm)', diameterText);
  const lengthMm = parseNumber(fileName, line, 'length (mm)', lengthText);
  const propellant = parseNumber(fileName, line, 'propellant mass (kg)', propellantText);
  const total = parseNumber(fileName, line, 'total mass (kg)', totalText);
  if (!(diameterMm > 0))
    throw new EngParseError(
      fileName,
      line,
      `diameter must be greater than 0 mm, got ${diameterText}`,
    );
  if (!(lengthMm > 0))
    throw new EngParseError(fileName, line, `length must be greater than 0 mm, got ${lengthText}`);
  if (!(propellant > 0))
    throw new EngParseError(
      fileName,
      line,
      `propellant mass must be greater than 0 kg, got ${propellantText}`,
    );
  if (!(total > propellant)) {
    throw new EngParseError(
      fileName,
      line,
      `total mass (${totalText} kg) must be greater than the propellant mass (${propellantText} kg)`,
    );
  }

  let delays: Seconds[] | 'plugged';
  let pluggedOption = false;
  if (delaysText === 'P') {
    delays = 'plugged';
  } else {
    const tokens = delaysText.split('-');
    const numeric: Seconds[] = [];
    for (const token of tokens) {
      if (token === 'P') {
        pluggedOption = true;
        continue;
      }
      if (!/^\d+(\.\d+)?$/.test(token)) {
        throw new EngParseError(
          fileName,
          line,
          `delays must be numbers separated by dashes, or "P" for plugged, got "${delaysText}"`,
        );
      }
      numeric.push(seconds(Number(token)));
    }
    if (numeric.length === 0) {
      throw new EngParseError(fileName, line, `delays field "${delaysText}" lists no delay`);
    }
    delays = numeric;
  }

  return {
    designation,
    manufacturer,
    diameter: millimetresToMetres(diameterMm),
    length: millimetresToMetres(lengthMm),
    delays,
    pluggedOption,
    propellantMass: kilograms(propellant),
    totalMass: kilograms(total),
    comments: [...comments],
  };
}

/**
 * Parses every motor entry in a RASP file. Throws `EngParseError` on the first
 * rule violation, naming the line.
 */
export function parseEng(text: string, fileName?: string): EngMotor[] {
  requireWithin(fileName ?? 'The motor file', text.length, MAX_INPUT_BYTES);
  const lines = text.split(/\r?\n/);
  const motors: EngMotor[] = [];
  let comments: string[] = [];
  let header: ReturnType<typeof parseHeader> | undefined;
  let points: ThrustPoint[] = [];
  let finished = false;

  const finish = (): void => {
    if (header === undefined) return;
    const last = points[points.length - 1];
    if (last?.thrust !== 0) {
      throw new EngParseError(
        fileName,
        lines.length,
        `motor "${header.designation}" has no final data point with zero thrust`,
      );
    }
    const all: ThrustPoint[] = [{ time: seconds(0), thrust: newtons(0) }, ...points];
    let impulse = 0;
    for (let i = 1; i < all.length; i++) {
      const a = all[i - 1];
      const b = all[i];
      if (a === undefined || b === undefined) break;
      impulse += ((a.thrust + b.thrust) / 2) * (b.time - a.time);
    }
    motors.push({ ...header, points: all, burnTime: last.time, totalImpulse: impulse });
    header = undefined;
    points = [];
    comments = [];
    finished = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i] ?? '';
    const trimmed = raw.trim();
    if (trimmed === '') {
      if (header !== undefined && !finished) {
        // A blank line inside the data is tolerated only after the final point.
        continue;
      }
      continue;
    }
    if (trimmed.startsWith(';')) {
      if (header !== undefined) {
        if (!finished) {
          throw new EngParseError(
            fileName,
            lineNo,
            `comment inside the data points of "${header.designation}" before the final zero-thrust point`,
          );
        }
        finish();
      }
      comments.push(trimmed.slice(1).trim());
      continue;
    }
    if (header === undefined) {
      header = parseHeader(fileName, lineNo, trimmed, comments);
      continue;
    }
    if (finished) {
      throw new EngParseError(
        fileName,
        lineNo,
        `unexpected text after the final data point of "${header.designation}": "${trimmed}"`,
      );
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length !== 2) {
      throw new EngParseError(
        fileName,
        lineNo,
        `a data point must be "time thrust", got "${trimmed}"`,
      );
    }
    const [timeText, thrustText] = parts as [string, string];
    const time = parseNumber(fileName, lineNo, 'time (s)', timeText);
    const thrust = parseNumber(fileName, lineNo, 'thrust (N)', thrustText);
    const previous = points[points.length - 1];
    if (previous === undefined) {
      if (time < 0)
        throw new EngParseError(
          fileName,
          lineNo,
          `the first data point is at negative time ${timeText}`,
        );
      if (time === 0 && thrust === 0) {
        throw new EngParseError(
          fileName,
          lineNo,
          'the origin (0, 0) is implicit and must not be given',
        );
      }
    } else if (time < previous.time) {
      throw new EngParseError(
        fileName,
        lineNo,
        `time ${timeText} is before the previous point at ${String(previous.time)}`,
      );
    }
    if (thrust < 0)
      throw new EngParseError(fileName, lineNo, `thrust must not be negative, got ${thrustText}`);
    points.push({ time: seconds(time), thrust: newtons(thrust) });
    if (thrust === 0) {
      finished = true;
    }
  }
  if (header !== undefined) {
    finish();
  }
  if (motors.length === 0) {
    throw new EngParseError(
      fileName,
      1,
      'no motor entry found (a header line with 7 fields is required)',
    );
  }
  return motors;
}
