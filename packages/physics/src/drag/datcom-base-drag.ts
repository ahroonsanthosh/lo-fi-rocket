/**
 * Body base drag from the USAF Stability and Control DATCOM (1978 revision),
 * section 4.2.3.1 (plan 0032, DRAG-21, DRAG-22, D-069). Page numbers: the file
 * `usaf-datcom-1978-dtic-adb072483-pp0921-1350.pdf` starts at scan page 921.
 *
 * Subsonic (paragraph A, eqs. 4.2.3.1-a and -b, page 20 of the file):
 * C_Db = 0.029 (d_b/d)³/√(C_Df)_b on the maximum frontal area S_B, with
 * (C_Df)_b = C_f [1 + 60/(l_B/d)³ + 0.0025 l_B/d] S_S/S_B the body's
 * zero-lift drag without the base (C_f the turbulent flat-plate skin friction
 * with roughness on the body length, S_S the body wetted area). Transonic
 * (paragraph B step 3, p. 4.2.3.1-4): the subsonic value at Mach 0.6 is
 * carried through the transonic range along the guide curves of figure
 * 4.2.3.1-24 (C_Db/(d_b/d)² against Mach 0.76 to 1.3, digitised twice), here
 * by linear interpolation between the two curves that bracket it at their
 * start, and held constant between Mach 0.6 and 0.76 (as the DATCOM sample
 * problem does at Mach 0.8). The DATCOM notes that fins and stings raise the
 * base pressure (less drag) without giving a correction.
 *
 * Generated from `reference/digitised/datcom-figure-4-2-3-1-24.json`; a
 * formats test checks the table against it.
 */
import { InvalidInputError } from '../errors.js';
import { finiteResult } from '../numerics/finite.js';

export interface BaseDragGuideCurve {
  /** C_Db/(d_b/d)² at Mach 0.76. */
  readonly start: number;
  /** [Mach, C_Db/(d_b/d)²]. */
  readonly points: readonly (readonly [number, number])[];
}

/** DATCOM figure 4.2.3.1-24, top to bottom. */
export const DATCOM_FIGURE_4231_24: readonly BaseDragGuideCurve[] = Object.freeze([
  {
    start: 0.1225,
    points: [
      [0.76, 0.1225],
      [0.7875, 0.1239],
      [0.8125, 0.1249],
      [0.8375, 0.1273],
      [0.8625, 0.13],
      [0.8875, 0.1337],
      [0.9125, 0.1411],
      [0.9375, 0.1497],
      [0.9625, 0.1639],
      [0.9875, 0.1878],
      [1.0125, 0.2198],
      [1.025, 0.2338],
      [1.0375, 0.2253],
      [1.0625, 0.1843],
      [1.0875, 0.1412],
      [1.1125, 0.116],
      [1.1375, 0.1038],
      [1.1625, 0.1],
      [1.1875, 0.1001],
      [1.2125, 0.1001],
      [1.2625, 0.1006],
      [1.2875, 0.1006],
      [1.295, 0.1006],
    ],
  },
  {
    start: 0.065,
    points: [
      [0.76, 0.065],
      [0.7875, 0.0665],
      [0.8125, 0.0679],
      [0.8375, 0.07],
      [0.8625, 0.0724],
      [0.8875, 0.0746],
      [0.9125, 0.0789],
      [0.9375, 0.0864],
      [0.9625, 0.1003],
      [0.9875, 0.1276],
      [1.0125, 0.1489],
      [1.025, 0.1287],
      [1.0375, 0.1023],
      [1.0625, 0.073],
      [1.0875, 0.0588],
      [1.1125, 0.0504],
      [1.1375, 0.0471],
      [1.1625, 0.0443],
      [1.1875, 0.0439],
      [1.2125, 0.0452],
      [1.2375, 0.0476],
      [1.2625, 0.0479],
    ],
  },
  {
    start: 0.0099,
    points: [
      [0.76, 0.0099],
      [0.7875, 0.0107],
      [0.8125, 0.0116],
      [0.8375, 0.0132],
      [0.8625, 0.0142],
      [0.8875, 0.0159],
      [0.9125, 0.0198],
      [0.9375, 0.0263],
      [0.9625, 0.0373],
      [0.9875, 0.0595],
      [1.0125, 0.0451],
      [1.025, 0.0237],
      [1.0375, 0.0105],
      [1.0625, -0.0058],
      [1.0875, -0.0096],
      [1.1125, -0.0076],
      [1.1375, -0.0066],
      [1.1625, -0.0052],
      [1.1875, -0.0038],
      [1.2125, -0.0035],
      [1.295, -0.0048],
    ],
  },
  {
    start: -0.0511,
    points: [
      [0.76, -0.0511],
      [0.7875, -0.0511],
      [0.8125, -0.0511],
      [0.8375, -0.0511],
      [0.8625, -0.0511],
      [0.8875, -0.0511],
      [0.9125, -0.0488],
      [0.9375, -0.0432],
      [0.9625, -0.0345],
      [0.9875, -0.02],
      [1.0125, -0.0224],
      [1.025, -0.0367],
      [1.0375, -0.0493],
      [1.0625, -0.0656],
      [1.0875, -0.0721],
      [1.1125, -0.0705],
      [1.1375, -0.0683],
      [1.1625, -0.0653],
      [1.1875, -0.0619],
      [1.2125, -0.0588],
      [1.2375, -0.0548],
      [1.2625, -0.0515],
      [1.2875, -0.0486],
      [1.295, -0.0473],
    ],
  },
  {
    start: -0.1205,
    points: [
      [0.76, -0.1205],
      [0.7875, -0.1191],
      [0.8125, -0.119],
      [0.8375, -0.1184],
      [0.8625, -0.1193],
      [0.8875, -0.1209],
      [0.9125, -0.124],
      [0.9375, -0.1303],
      [0.9625, -0.1415],
      [0.9875, -0.1598],
      [1.0125, -0.1875],
      [1.025, -0.2001],
      [1.0375, -0.2075],
      [1.0625, -0.2124],
      [1.0875, -0.2057],
      [1.1125, -0.2005],
      [1.1375, -0.1982],
      [1.1625, -0.1958],
      [1.1875, -0.1933],
      [1.2125, -0.1918],
      [1.2375, -0.1907],
      [1.2625, -0.19],
      [1.2875, -0.1897],
      [1.295, -0.1894],
    ],
  },
  {
    start: -0.1886,
    points: [
      [0.76, -0.1886],
      [0.7875, -0.1861],
      [0.8125, -0.1847],
      [0.8375, -0.1838],
      [0.8625, -0.184],
      [0.8875, -0.186],
      [0.9125, -0.19],
      [0.9375, -0.2003],
      [0.9625, -0.217],
      [0.9875, -0.2418],
      [1.0125, -0.2606],
      [1.025, -0.2661],
      [1.0375, -0.2685],
      [1.0625, -0.2649],
      [1.0875, -0.2568],
      [1.1125, -0.2504],
      [1.1375, -0.2486],
      [1.1875, -0.246],
      [1.2125, -0.2436],
      [1.2375, -0.2415],
      [1.2625, -0.2401],
      [1.2875, -0.2387],
      [1.295, -0.2381],
    ],
  },
]);

/** The Mach range of figure 4.2.3.1-24 and the Mach number at which the subsonic value is taken. */
export const DATCOM_BASE_SUBSONIC_MACH = 0.6;
export const DATCOM_BASE_GUIDE_END = 1.295;

export interface DatcomBodyBaseInput {
  /** Turbulent skin-friction coefficient of the body (with roughness and compressibility). */
  readonly skinFriction: number;
  /** Body wetted area S_S, m². */
  readonly wettedArea: number;
  /** Body length l_B, m. */
  readonly length: number;
  /** Maximum body radius, m. */
  readonly maxRadius: number;
  /** Base radius, m. */
  readonly baseRadius: number;
}

/**
 * DRAG-21. Eqs. 4.2.3.1-a (first term) and -b: the subsonic base drag on the
 * base area, C_Db/(d_b/d)² = 0.029 (d_b/d)/√(C_Df)_b.
 */
export function datcomSubsonicBaseDrag(input: DatcomBodyBaseInput): number {
  const { skinFriction: cf, wettedArea, length, maxRadius, baseRadius } = input;
  if (!(cf > 0))
    throw new InvalidInputError('skin-friction coefficient', cf, 'must be greater than 0');
  if (!(maxRadius > 0 && length > 0 && wettedArea > 0)) {
    throw new InvalidInputError(
      'body',
      maxRadius,
      'needs a positive radius, length and wetted area',
    );
  }
  if (!(baseRadius >= 0 && baseRadius <= maxRadius + 1e-12)) {
    throw new InvalidInputError(
      'base radius',
      baseRadius,
      'must be between 0 and the maximum radius',
    );
  }
  const f = length / (2 * maxRadius);
  const sB = Math.PI * maxRadius * maxRadius;
  const cdfb = cf * (1 + 60 / f ** 3 + 0.0025 * f) * (wettedArea / sB);
  const ratio = baseRadius / maxRadius;
  return finiteResult('DATCOM subsonic base drag', (0.029 * ratio) / Math.sqrt(cdfb));
}

function curveValue(c: BaseDragGuideCurve, mach: number): number {
  const p = c.points;
  const first = p[0];
  const last = p[p.length - 1];
  if (first === undefined || last === undefined) return Number.NaN;
  if (mach <= first[0]) return first[1];
  if (mach >= last[0]) return last[1];
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1];
    const b = p[i];
    if (a !== undefined && b !== undefined && mach <= b[0]) {
      return a[1] + ((b[1] - a[1]) * (mach - a[0])) / (b[0] - a[0]);
    }
  }
  return last[1];
}

/**
 * DRAG-22. The base drag on the base area at Mach `mach` (0 to 1.295) from
 * the subsonic value `subsonic` (DRAG-21): unchanged to Mach 0.76, then along
 * figure 4.2.3.1-24. Undefined when the subsonic value lies outside the
 * figure's curves (above 0.1225 or below −0.1886 at Mach 0.76).
 */
export function datcomBaseDragAtMach(subsonic: number, mach: number): number | undefined {
  if (!(mach >= 0) || mach > DATCOM_BASE_GUIDE_END + 1e-12) {
    throw new InvalidInputError(
      'Mach number',
      mach,
      'must be between 0 and 1.295 for figure 4.2.3.1-24',
    );
  }
  const curves = DATCOM_FIGURE_4231_24;
  for (let i = 1; i < curves.length; i++) {
    const upper = curves[i - 1];
    const lower = curves[i];
    if (upper === undefined || lower === undefined) continue;
    if (subsonic <= upper.start + 1e-12 && subsonic >= lower.start - 1e-12) {
      if (mach <= 0.76) return subsonic;
      const w = (subsonic - lower.start) / (upper.start - lower.start);
      return curveValue(lower, mach) + w * (curveValue(upper, mach) - curveValue(lower, mach));
    }
  }
  return undefined;
}
