/**
 * Reader for RockSim `.rse` engine files (plan 0007).
 *
 * Source: Apogee Components, "RockSim & EngEdit – Engine File (.rse) Format
 * Guide" (reference/docs/apogee-rocksim-engine-file-format.pdf, p. 1): the
 * `<engine>` attributes, the `<data>` points `t`, `f` (required) and `m`,
 * `cg` (optional), the auto-calculation flags and the unit conventions
 * (length mm, mass "g or kg", thrust N, time s). ThrustCurve.org's Motor
 * Statistics page defines specific impulse as total impulse over the weight
 * of the propellant, in seconds, which this reader uses to tell grams from
 * kilograms (MOT-5, D-029).
 *
 * The guide leaves three things open, each handled explicitly rather than
 * guessed (D-029): the mass unit, what the `m` column measures, and the
 * reference point of the `cg` column.
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
import { RseParseError, RseUnsupportedError } from './errors.js';
import { NUMBER, parseXmlRoots, XmlSyntaxError, type XmlNode } from './xml.js';

/**
 * Standard acceleration due to gravity g_n = 980.665 cm/s² = 9.80665 m/s².
 * SI Brochure 9th ed., Appendix 1, 3rd CGPM (1901) declaration 3, printed
 * p. 154. Used only to turn a specific impulse in seconds into impulse per
 * propellant mass; it is not the simulator's gravity (docs/conventions.md).
 */
export const STANDARD_GRAVITY_GN = 9.80665;

/** Relative tolerance of the specific-impulse consistency check (MOT-5). */
export const RSE_ISP_TOLERANCE = 0.02;
/** A `cg` column is accepted when constant and within this distance of half the length (D-029). */
export const RSE_CG_TOLERANCE_M = 0.001;
/** Relative tolerance for recognising what the `m` column measures (D-029). */
export const RSE_MASS_COLUMN_TOLERANCE = 0.01;

export type RseMassUnit = 'g' | 'kg';

export interface RsePoint {
  readonly time: Seconds;
  readonly thrust: Newtons;
  /** From the `m` column, converted to propellant remaining; absent when the file has no `m`. */
  readonly propellantRemaining?: Kilograms;
}

export interface RseMotor {
  /** `code` */
  readonly designation: string;
  /** `mfg` */
  readonly manufacturer: string;
  /** `Type` (or `type`): single-use, reloadable, hybrid; as written. */
  readonly type: string | undefined;
  readonly diameter: Metres;
  readonly length: Metres;
  /** `initWt` */
  readonly totalMass: Kilograms;
  /** `propWt` */
  readonly propellantMass: Kilograms;
  /** `delays`, comma separated, seconds. */
  readonly delays: readonly Seconds[];
  /** `burn-time` as written (informational; the thrust points define the burn). */
  readonly burnTimeAttribute: Seconds;
  readonly totalImpulseAttribute: number | undefined;
  readonly specificImpulseAttribute: number | undefined;
  readonly averageThrustAttribute: number | undefined;
  readonly peakThrustAttribute: number | undefined;
  readonly autoCalcMass: boolean;
  readonly autoCalcCg: boolean;
  readonly massUnit: RseMassUnit;
  /** How the unit was decided: the caller's option, or the specific-impulse check. */
  readonly massUnitSource: 'option' | 'specific-impulse';
  /** What the `m` column measured in the file, or none. */
  readonly massColumn: 'propellant-remaining' | 'total-mass' | 'none';
  /** The constant `cg` of the file in metres from the forward end, or undefined without a column. */
  readonly cgColumn: Metres | undefined;
  readonly points: readonly RsePoint[];
  readonly comments: string;
}

export interface RseOptions {
  /** Unit of `initWt`, `propWt` and `m`; required when the file carries no `Isp` to decide it. */
  readonly massUnit?: RseMassUnit;
}

const ROOT = 'engine-database';

function num(file: string | undefined, where: string, name: string, text: string): number {
  if (!NUMBER.test(text))
    throw new RseParseError(file, where, `${name} is not a number: "${text}"`);
  const v = Number(text);
  if (!Number.isFinite(v)) throw new RseParseError(file, where, `${name} is not finite: "${text}"`);
  return v;
}

function required(
  file: string | undefined,
  where: string,
  attrs: Readonly<Record<string, string>>,
  name: string,
): string {
  const v = attrs[name];
  if (v === undefined || v === '')
    throw new RseParseError(file, where, `missing attribute ${name}`);
  return v;
}

function optionalNumber(
  file: string | undefined,
  where: string,
  attrs: Readonly<Record<string, string>>,
  name: string,
): number | undefined {
  const v = attrs[name];
  return v === undefined || v === '' ? undefined : num(file, where, name, v);
}

function flag(
  file: string | undefined,
  where: string,
  attrs: Readonly<Record<string, string>>,
  name: string,
): boolean {
  const v = attrs[name];
  if (v === undefined) return false;
  if (v === '1' || v === 'true') return true;
  if (v === '0' || v === 'false') return false;
  throw new RseParseError(file, where, `${name} must be 0 or 1, got "${v}"`);
}

function trapezoid(points: readonly { t: number; f: number }[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a === undefined || b === undefined) continue;
    sum += ((a.f + b.f) / 2) * (b.t - a.t);
  }
  return sum;
}

/**
 * MOT-5: decide grams or kilograms. With an `Isp` attribute, exactly one
 * unit must make I_total / (m_prop g_n) agree with it within the tolerance;
 * the caller's option, when given, must agree too.
 */
function decideMassUnit(
  file: string | undefined,
  where: string,
  option: RseMassUnit | undefined,
  isp: number | undefined,
  propWtRaw: number,
  impulse: number,
): { unit: RseMassUnit; source: 'option' | 'specific-impulse' } {
  if (isp === undefined) {
    if (option === undefined) {
      throw new RseParseError(
        file,
        where,
        'the file has no Isp attribute and the guide allows masses in g or kg: pass massUnit ("g" or "kg")',
      );
    }
    return { unit: option, source: 'option' };
  }
  const consistent = (unit: RseMassUnit): boolean => {
    const mp = unit === 'g' ? propWtRaw / 1000 : propWtRaw;
    const predicted = impulse / (mp * STANDARD_GRAVITY_GN);
    return Math.abs(predicted - isp) <= RSE_ISP_TOLERANCE * Math.abs(isp);
  };
  const g = consistent('g');
  const kg = consistent('kg');
  if (option !== undefined) {
    if (!(option === 'g' ? g : kg)) {
      throw new RseParseError(
        file,
        where,
        `massUnit "${option}" disagrees with the file: Isp=${String(isp)} s implies ${g ? 'grams' : kg ? 'kilograms' : 'neither unit'} (I_total ${impulse.toFixed(3)} N·s, propWt ${String(propWtRaw)})`,
      );
    }
    return { unit: option, source: 'option' };
  }
  if (g === kg) {
    throw new RseParseError(
      file,
      where,
      `cannot decide the mass unit from Isp=${String(isp)} s (I_total ${impulse.toFixed(3)} N·s, propWt ${String(propWtRaw)}): ${g ? 'both units fit' : 'neither unit fits within 2 %'}; pass massUnit`,
    );
  }
  return { unit: g ? 'g' : 'kg', source: 'specific-impulse' };
}

function readEngine(
  node: XmlNode,
  index: number,
  file: string | undefined,
  options: RseOptions,
): RseMotor {
  const a = node.attributes;
  const where = `engine ${String(index + 1)}${a['code'] === undefined ? '' : ` "${a['code']}"`}`;
  const designation = required(file, where, a, 'code');
  const manufacturer = required(file, where, a, 'mfg');
  const type = a['Type'] ?? a['type'];
  const diaMm = num(file, where, 'dia', required(file, where, a, 'dia'));
  const lenMm = num(file, where, 'len', required(file, where, a, 'len'));
  const initWt = num(file, where, 'initWt', required(file, where, a, 'initWt'));
  const propWt = num(file, where, 'propWt', required(file, where, a, 'propWt'));
  const burnTimeAttr = num(file, where, 'burn-time', required(file, where, a, 'burn-time'));
  if (!(diaMm > 0))
    throw new RseParseError(file, where, `dia must be greater than 0 mm, got ${String(diaMm)}`);
  if (!(lenMm > 0))
    throw new RseParseError(file, where, `len must be greater than 0 mm, got ${String(lenMm)}`);
  if (!(propWt > 0))
    throw new RseParseError(file, where, `propWt must be greater than 0, got ${String(propWt)}`);
  if (!(initWt > propWt)) {
    throw new RseParseError(
      file,
      where,
      `initWt (${String(initWt)}) must be greater than propWt (${String(propWt)})`,
    );
  }
  const delays = required(file, where, a, 'delays')
    .split(',')
    .map((s) => s.trim())
    .map((s) => {
      if (!/^\d+(\.\d+)?$/.test(s)) {
        throw new RseParseError(
          file,
          where,
          `delays must be numbers separated by commas, got "${a['delays'] ?? ''}"`,
        );
      }
      return seconds(Number(s));
    });
  const autoCalcMass = flag(file, where, a, 'auto-calc-mass');
  const autoCalcCg = flag(file, where, a, 'auto-calc-cg');
  const itot = optionalNumber(file, where, a, 'Itot');
  const isp = optionalNumber(file, where, a, 'Isp');
  const avg = optionalNumber(file, where, a, 'avgThrust');
  const peak = optionalNumber(file, where, a, 'peakThrust');

  let comments = '';
  let data: XmlNode | undefined;
  for (const child of node.children) {
    if (child.name === 'comments') comments = child.text;
    else if (child.name === 'data') {
      if (data !== undefined) throw new RseParseError(file, where, '<data> appears twice');
      data = child;
    } else throw new RseUnsupportedError(file, where, `element <${child.name}>`);
  }
  if (data === undefined) throw new RseParseError(file, where, 'missing <data>');

  const raw: { t: number; f: number; m: number | undefined; cg: number | undefined }[] = [];
  data.children.forEach((pt, i) => {
    const pw = `${where}, data point ${String(i + 1)}`;
    if (pt.name !== 'eng-data') throw new RseUnsupportedError(file, pw, `element <${pt.name}>`);
    const t = num(file, pw, 't', required(file, pw, pt.attributes, 't'));
    const f = num(file, pw, 'f', required(file, pw, pt.attributes, 'f'));
    const m = optionalNumber(file, pw, pt.attributes, 'm');
    const cg = optionalNumber(file, pw, pt.attributes, 'cg');
    if (f < 0) throw new RseParseError(file, pw, `f must be 0 N or greater, got ${String(f)}`);
    const prev = raw[raw.length - 1];
    if (prev !== undefined && t < prev.t) {
      throw new RseParseError(
        file,
        pw,
        `t=${String(t)} is before the previous point (${String(prev.t)})`,
      );
    }
    raw.push({ t, f, m, cg });
  });
  const first = raw[0];
  if (first === undefined || raw.length < 2)
    throw new RseParseError(file, where, '<data> needs at least two points');
  if (first.t !== 0) {
    throw new RseParseError(
      file,
      where,
      `the first data point must be at t=0 (the guide's example starts there), got t=${String(first.t)}`,
    );
  }
  const last = raw[raw.length - 1];
  if (last === undefined || !(last.t > 0))
    throw new RseParseError(file, where, 'the burn must end after t=0');

  // Unit of initWt, propWt and m (MOT-5, D-029).
  const impulse = trapezoid(raw);
  const { unit, source } = decideMassUnit(file, where, options.massUnit, isp, propWt, impulse);
  const toKg = (v: number): number => (unit === 'g' ? v / 1000 : v);

  // The m column: propellant remaining or total mass (D-029).
  const hasM = raw.map((p) => p.m !== undefined);
  let massColumn: RseMotor['massColumn'] = 'none';
  if (hasM.some(Boolean)) {
    if (!hasM.every(Boolean))
      throw new RseParseError(file, where, 'the m column is present on some points only');
    const m0 = first.m ?? Number.NaN;
    const mEnd = last.m ?? Number.NaN;
    const tol = RSE_MASS_COLUMN_TOLERANCE;
    if (Math.abs(m0 - propWt) <= tol * propWt && Math.abs(mEnd) <= tol * propWt) {
      massColumn = 'propellant-remaining';
    } else if (
      Math.abs(m0 - initWt) <= tol * initWt &&
      Math.abs(mEnd - (initWt - propWt)) <= tol * initWt
    ) {
      massColumn = 'total-mass';
    } else {
      throw new RseParseError(
        file,
        where,
        `the m column runs from ${String(m0)} to ${String(mEnd)}, which is neither propellant remaining (propWt ${String(propWt)} to 0) nor total mass (initWt ${String(initWt)} to ${String(initWt - propWt)})`,
      );
    }
  }

  // The cg column: only a constant value at the engine centre is documented (D-029).
  const hasCg = raw.map((p) => p.cg !== undefined);
  let cgColumn: Metres | undefined;
  if (hasCg.some(Boolean)) {
    if (!hasCg.every(Boolean))
      throw new RseParseError(file, where, 'the cg column is present on some points only');
    const values = raw.map((p) => p.cg ?? Number.NaN);
    const minCg = Math.min(...values);
    const maxCg = Math.max(...values);
    const half = lenMm / 2;
    if (maxCg - minCg > 1e-9 * Math.max(1, Math.abs(maxCg))) {
      throw new RseUnsupportedError(
        file,
        where,
        `a cg column that varies with time (${String(minCg)} to ${String(maxCg)} mm; its reference point is not documented)`,
      );
    }
    if (Math.abs(minCg - half) > RSE_CG_TOLERANCE_M * 1000) {
      throw new RseUnsupportedError(
        file,
        where,
        `a cg column away from the engine centre (${String(minCg)} mm against len/2 = ${String(half)} mm)`,
      );
    }
    cgColumn = millimetresToMetres(minCg);
  }

  const casingKg = toKg(initWt - propWt);
  const points: RsePoint[] = raw.map((p) => {
    const base = { time: seconds(p.t), thrust: newtons(p.f) };
    if (massColumn === 'none' || p.m === undefined) return base;
    const remaining = massColumn === 'propellant-remaining' ? toKg(p.m) : toKg(p.m) - casingKg;
    return { ...base, propellantRemaining: kilograms(Math.max(0, remaining)) };
  });

  return {
    designation,
    manufacturer,
    type,
    diameter: millimetresToMetres(diaMm),
    length: millimetresToMetres(lenMm),
    totalMass: kilograms(toKg(initWt)),
    propellantMass: kilograms(toKg(propWt)),
    delays,
    burnTimeAttribute: seconds(burnTimeAttr),
    totalImpulseAttribute: itot,
    specificImpulseAttribute: isp,
    averageThrustAttribute: avg,
    peakThrustAttribute: peak,
    autoCalcMass,
    autoCalcCg,
    massUnit: unit,
    massUnitSource: source,
    massColumn,
    cgColumn,
    points,
    comments,
  };
}

/** Parse every `<engine>` of an `.rse` document. */
export function parseRse(text: string, options: RseOptions = {}, fileName?: string): RseMotor[] {
  let roots: XmlNode[];
  try {
    roots = parseXmlRoots(text);
  } catch (error) {
    if (error instanceof XmlSyntaxError) {
      throw new RseParseError(fileName, 'document', error.message, { cause: error });
    }
    throw error;
  }
  const root = roots.find((n) => n.name === ROOT);
  if (root === undefined)
    throw new RseParseError(fileName, 'document', `root element is not <${ROOT}>`);
  const engines: XmlNode[] = [];
  for (const list of root.children) {
    if (list.name !== 'engine-list')
      throw new RseUnsupportedError(fileName, 'document', `element <${list.name}>`);
    for (const e of list.children) {
      if (e.name !== 'engine')
        throw new RseUnsupportedError(fileName, 'engine-list', `element <${e.name}>`);
      engines.push(e);
    }
  }
  if (engines.length === 0) throw new RseParseError(fileName, 'document', 'no <engine> element');
  return engines.map((e, i) => readEngine(e, i, fileName, options));
}
