/**
 * DRAG-26. The DATCOM's wing-body zero-lift drag build-up for the fins (plan 0081): USAF Stability and
 * Control DATCOM (1978 revision), eq. 4.3.3.1-a (section 4.3.3.1 A, p. 4.3.3.1-1), with the wing terms
 * of eq. 4.1.5.1-a (section 4.1.5.1 A, p. 4.1.5.1-1):
 *
 *   (C_D0)_WB = { C_f,W [1 + L(t/c) + 100(t/c)⁴] R_LS (S_wet)_e/S_ref
 *                 + C_f,B [1 + 60/(l_B/d)³ + 0.0025 l_B/d] (S_S)_e/S_ref } R_WB + C_Db S_B/S_ref
 *
 * - C_f,W at the Reynolds number of the fin's mean aerodynamic chord (DRAG-24), C_f,B at the body
 *   length's; both are Niskanen's eqs. (3.78) to (3.84).
 * - The thickness bracket: L = 1.2 when the maximum thickness lies at or behind 0.30c, 2.0 ahead of it.
 * - R_LS: the lifting-surface correlation factor, figure 4.1.5.1-28b (page 255 of the pp0495-0920
 *   file), against the Mach number and the cosine of the maximum-thickness line's sweep. Its solid
 *   curves come from wing-alone tests of round-nosed airfoil sections.
 * - R_WB: the wing-body interference correlation factor, figure 4.3.3.1-37 (page 244 of the
 *   pp0921-1350 file), against the Mach number and the body's Reynolds number on its length. "The
 *   correlation does not include data below M = 0.25" (p. 4.3.3.1-2); its curves begin at 2.8 × 10⁶.
 *
 * Both charts are subsonic and end at Mach 0.9. The DATCOM's transonic wing-body method (eq.
 * 4.3.3.1-c, with eq. 4.1.5.1-c for the wing) adds the isolated components with neither factor; here
 * both factors are faired linearly to 1 between Mach 0.9 and 1.0, a listed approximation as the base
 * drag's fairing is (D-069).
 *
 * The tables are generated from `reference/digitised/datcom-figure-4-1-5-1-28b.json` and
 * `datcom-figure-4-3-3-1-37.json` (two passes each; every reading the DATCOM's sample problems take
 * from either chart is reproduced within 0.005); a formats test checks them against the files.
 */
import type { FinCrossSection } from '../geometry/components.js';
import { InvalidInputError } from '../errors.js';
import { finiteResult } from '../numerics/finite.js';

/** Figure 4.1.5.1-28b: cos Λ_(t/c)max from 0.5 to 1.0 every 0.025. */
const RLS_COS: readonly number[] = Array.from({ length: 21 }, (_, i) => 0.5 + 0.025 * i);
/** Figure 4.1.5.1-28b, solid curves: [Mach, R_LS at each RLS_COS]. The first curve is "M ≤ 0.25". */
export const DATCOM_FIGURE_4151_28B: readonly (readonly [number, readonly number[]])[] =
  Object.freeze([
    [
      0.25,
      [
        0.8131, 0.8299, 0.8523, 0.8678, 0.8888, 0.906, 0.9267, 0.9438, 0.9648, 0.9814, 0.9997,
        1.0144, 1.0288, 1.0389, 1.0493, 1.0558, 1.0614, 1.0619, 1.0642, 1.067, 1.067,
      ],
    ],
    [
      0.6,
      [
        0.8852, 0.9038, 0.9224, 0.941, 0.9638, 0.9814, 1.0056, 1.0209, 1.0437, 1.0614, 1.0809,
        1.0935, 1.108, 1.1197, 1.13, 1.1371, 1.1427, 1.1437, 1.1455, 1.1484, 1.1484,
      ],
    ],
    [
      0.8,
      [
        0.9972, 1.0205, 1.0393, 1.0581, 1.0772, 1.0935, 1.1136, 1.1305, 1.1512, 1.1653, 1.1845,
        1.198, 1.2136, 1.2244, 1.2347, 1.2418, 1.2479, 1.2516, 1.2545, 1.2573, 1.2573,
      ],
    ],
    [
      0.9,
      [
        1.093, 1.1127, 1.1338, 1.1493, 1.17, 1.185, 1.2061, 1.2211, 1.2408, 1.2549, 1.2742, 1.2873,
        1.3022, 1.3168, 1.329, 1.3364, 1.3444, 1.35, 1.3547, 1.3575, 1.3575,
      ],
    ],
  ]);

/** Figure 4.3.3.1-37: log₁₀ of the body's Reynolds number. */
const RWB_LOG_RE: readonly number[] = [
  6.45, 6.5, 6.6, 6.7, 6.8, 6.9, 7.0, 7.1, 7.2, 7.3, 7.4, 7.45, 7.5, 7.55, 7.6, 7.65, 7.7, 7.75,
  7.8, 7.9, 8.0, 8.5, 9.0,
];
/** Figure 4.3.3.1-37: [Mach, R_WB at each RWB_LOG_RE]. */
export const DATCOM_FIGURE_4331_37: readonly (readonly [number, readonly number[]])[] =
  Object.freeze([
    [
      0.25,
      [
        1.0653, 1.066, 1.0682, 1.0708, 1.0734, 1.0753, 1.0761, 1.0752, 1.0721, 1.0663, 1.0571,
        1.0512, 1.0392, 1.0228, 1.0065, 0.9908, 0.9759, 0.9622, 0.95, 0.9319, 0.9244, 0.9201,
        0.9201,
      ],
    ],
    [
      0.4,
      [
        1.0221, 1.0215, 1.022, 1.0243, 1.0279, 1.0324, 1.0373, 1.042, 1.0462, 1.0492, 1.0507,
        1.0504, 1.0418, 1.0312, 1.0186, 1.0028, 0.9978, 0.9933, 0.9892, 0.9824, 0.9772, 0.9762,
        0.9762,
      ],
    ],
    [
      0.6,
      [
        0.9815, 0.9815, 0.9826, 0.9851, 0.9884, 0.9922, 0.9957, 0.9987, 1.0006, 1.0009, 0.999,
        0.9991, 1.0006, 1.0023, 1.0043, 1.0064, 1.0089, 1.0115, 1.0126, 1.0124, 1.0122, 1.0112,
        1.0102,
      ],
    ],
    [
      0.7,
      [
        0.9577, 0.9573, 0.958, 0.9603, 0.9638, 0.9682, 0.973, 0.978, 0.9827, 0.9868, 0.9898, 0.9911,
        0.9949, 0.9985, 1.0019, 1.0051, 1.0081, 1.0109, 1.0126, 1.0124, 1.0122, 1.0112, 1.0102,
      ],
    ],
    [
      0.8,
      [
        0.9258, 0.9264, 0.928, 0.9303, 0.9335, 0.9375, 0.9424, 0.9482, 0.9551, 0.963, 0.9721,
        0.9815, 0.9865, 0.9913, 0.996, 1.0006, 1.0051, 1.0095, 1.0126, 1.0124, 1.0122, 1.0112,
        1.0102,
      ],
    ],
    [
      0.85,
      [
        0.9019, 0.9034, 0.906, 0.9086, 0.9114, 0.9148, 0.9192, 0.925, 0.9325, 0.9422, 0.9544,
        0.9631, 0.9723, 0.9809, 0.9887, 0.9959, 1.0025, 1.0083, 1.0126, 1.0124, 1.0122, 1.0112,
        1.0102,
      ],
    ],
    [
      0.9,
      [
        0.8691, 0.8697, 0.871, 0.8729, 0.8758, 0.8801, 0.8863, 0.8948, 0.906, 0.9204, 0.9384,
        0.9536, 0.9661, 0.9773, 0.9871, 0.9955, 1.0027, 1.0084, 1.0126, 1.0124, 1.0122, 1.0112,
        1.0102,
      ],
    ],
  ]);

/** The Mach number where both charts end and the fairing to the transonic method begins. */
export const DATCOM_WING_BODY_CHART_END_MACH = 0.9;
/** The Mach number where the fairing reaches the transonic method (factors of 1). Not from the DATCOM. */
export const DATCOM_WING_BODY_FAIRING_END_MACH = 1.0;

/** Linear interpolation on an increasing abscissa, held at the ends. */
function interpolate(xs: readonly number[], ys: readonly number[], x: number): number {
  const n = xs.length;
  const first = xs[0] ?? 0;
  const last = xs[n - 1] ?? 0;
  if (x <= first) return ys[0] ?? NaN;
  if (x >= last) return ys[n - 1] ?? NaN;
  for (let i = 1; i < n; i++) {
    const x1 = xs[i] ?? NaN;
    if (x <= x1) {
      const x0 = xs[i - 1] ?? NaN;
      const y0 = ys[i - 1] ?? NaN;
      const y1 = ys[i] ?? NaN;
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return ys[n - 1] ?? NaN;
}

/** Linear interpolation between a chart's Mach curves, each read at `x`; held at the end curves. */
function betweenCurves(
  curves: readonly (readonly [number, readonly number[]])[],
  xs: readonly number[],
  mach: number,
  x: number,
): number {
  const at = (i: number): number => interpolate(xs, curves[i]?.[1] ?? [], x);
  const last = curves.length - 1;
  if (mach <= (curves[0]?.[0] ?? 0)) return at(0);
  if (mach >= (curves[last]?.[0] ?? 0)) return at(last);
  for (let i = 1; i <= last; i++) {
    const m1 = curves[i]?.[0] ?? NaN;
    if (mach <= m1) {
      const m0 = curves[i - 1]?.[0] ?? NaN;
      return at(i - 1) + ((at(i) - at(i - 1)) * (mach - m0)) / (m1 - m0);
    }
  }
  return at(last);
}

/** A chart value, and where it was held at the chart's edge or faired (each is a listed approximation). */
export interface ChartFactor {
  readonly value: number;
  /** Above Mach 0.9: faired toward 1 (Mach 0.9 to 1.0) or 1 (Mach 1.0 and above). */
  readonly faired: boolean;
  /** An input outside the chart's range, held at its edge. */
  readonly outside: boolean;
}

/** The fairing from the chart's Mach 0.9 value to 1 at Mach 1.0 (linear; listed, not from the DATCOM). */
function faired(mach: number, chartValue: number): number {
  if (mach <= DATCOM_WING_BODY_CHART_END_MACH) return chartValue;
  if (mach >= DATCOM_WING_BODY_FAIRING_END_MACH) return 1;
  const s =
    (mach - DATCOM_WING_BODY_CHART_END_MACH) /
    (DATCOM_WING_BODY_FAIRING_END_MACH - DATCOM_WING_BODY_CHART_END_MACH);
  return chartValue + (1 - chartValue) * s;
}

function requireMach(mach: number): void {
  if (!(mach >= 0) || !Number.isFinite(mach))
    throw new InvalidInputError('Mach number', mach, 'must be 0 or greater');
}

/**
 * R_LS, figure 4.1.5.1-28b. Below cos Λ = 0.5 (sweep beyond 60°) the solid curves end and the value is
 * held (`outside`); the "M ≤ 0.25" curve serves every Mach number up to 0.25.
 */
export function liftingSurfaceFactor(mach: number, cosSweep: number): ChartFactor {
  requireMach(mach);
  if (!(cosSweep > 0) || !(cosSweep <= 1 + 1e-12))
    throw new InvalidInputError('cosine of the fin sweep', cosSweep, 'must be in (0, 1]');
  const m = Math.min(mach, DATCOM_WING_BODY_CHART_END_MACH);
  const chart = betweenCurves(DATCOM_FIGURE_4151_28B, RLS_COS, m, Math.min(cosSweep, 1));
  return {
    value: finiteResult('lifting-surface factor R_LS', faired(mach, chart)),
    faired: mach > DATCOM_WING_BODY_CHART_END_MACH,
    outside: cosSweep < 0.5,
  };
}

/**
 * R_WB, figure 4.3.3.1-37, at the body's Reynolds number on its length. Below Mach 0.25 the Mach 0.25
 * curve is held, and outside 2.8 × 10⁶ to 10⁹ the chart's edge (`outside`).
 */
export function wingBodyInterferenceFactor(mach: number, bodyReynolds: number): ChartFactor {
  requireMach(mach);
  if (!(bodyReynolds > 0) || !Number.isFinite(bodyReynolds))
    throw new InvalidInputError('body Reynolds number', bodyReynolds, 'must be greater than 0');
  const logRe = Math.log10(bodyReynolds);
  const m = Math.min(mach, DATCOM_WING_BODY_CHART_END_MACH);
  const chart = betweenCurves(DATCOM_FIGURE_4331_37, RWB_LOG_RE, m, logRe);
  return {
    value: finiteResult('wing-body interference factor R_WB', faired(mach, chart)),
    faired: mach > DATCOM_WING_BODY_CHART_END_MACH,
    outside: mach < 0.25 || logRe < (RWB_LOG_RE[0] ?? 0) || logRe > (RWB_LOG_RE.at(-1) ?? Infinity),
  };
}

/**
 * Where a fin section's maximum thickness lies (chord fraction x_t/c) and the DATCOM's thickness
 * location parameter L (eq. 4.1.5.1-a: 1.2 for x_t ≥ 0.30c, 2.0 ahead of it). A square or rounded
 * section is a flat plate whose full thickness starts at the leading edge; Niskanen's airfoil section
 * is taken with its maximum thickness at 0.30c; the double wedge peaks at mid-chord and the single
 * wedge at the trailing edge (D-066).
 */
export function maximumThicknessLine(crossSection: FinCrossSection): {
  readonly chordFraction: number;
  readonly location: 1.2 | 2;
} {
  switch (crossSection) {
    case 'square':
    case 'rounded':
      return { chordFraction: 0, location: 2 };
    case 'airfoil':
      return { chordFraction: 0.3, location: 1.2 };
    case 'double-wedge':
      return { chordFraction: 0.5, location: 1.2 };
    case 'wedge':
      return { chordFraction: 1, location: 1.2 };
  }
}

/**
 * The cosine of the sweep of the line at `chordFraction` of the chord on a trapezoid of root chord
 * c_r, tip chord c_t, leading-edge sweep length x_t (the tip leading edge behind the root's) and span
 * s: tan Λ_x = (x_t + x (c_t − c_r))/s.
 */
export function chordLineSweepCosine(
  rootChord: number,
  tipChord: number,
  sweepLength: number,
  span: number,
  chordFraction: number,
): number {
  if (!(span > 0)) throw new InvalidInputError('fin span', span, 'must be greater than 0 m');
  const tan = (sweepLength + chordFraction * (tipChord - rootChord)) / span;
  return finiteResult('sweep cosine', 1 / Math.sqrt(1 + tan * tan));
}

/** The DATCOM's thickness bracket 1 + L(t/c) + 100(t/c)⁴ (eq. 4.1.5.1-a, figure 4.1.5.1-28a). */
export function finThicknessBracket(location: number, thicknessRatio: number): number {
  if (!(thicknessRatio >= 0) || !Number.isFinite(thicknessRatio))
    throw new InvalidInputError('fin thickness ratio', thicknessRatio, 'must be 0 or greater');
  return 1 + location * thicknessRatio + 100 * thicknessRatio ** 4;
}
