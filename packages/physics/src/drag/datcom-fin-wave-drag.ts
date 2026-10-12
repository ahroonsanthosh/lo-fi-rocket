/**
 * Fin zero-lift wave drag across the transonic and supersonic regimes from
 * the USAF Stability and Control DATCOM (1978 revision), section 4.1.5.1
 * (plan 0025, DRAG-18, DRAG-19, D-062). Source pages are of the full DTIC
 * scan (ADB072483); the files in `reference/docs/` start at scan page 495.
 *
 * Transonic (section 4.1.5.1 B, pp. 4.1.5.1-5 to -10, scan pp. 726 to 731):
 * the wave drag of an unswept wing follows the transonic similarity chart,
 * figure 4.1.5.1-29 (scan p. 750): C_Dw/(t/c)^(5/3) against
 * ξ = √|M² − 1|/(t/c)^(1/3) for A (t/c)^(1/3) = 0.5 to 4.0, with C_Dw on the
 * wing planform area. A swept wing's curve is constructed from the unswept
 * one with eqs. 4.1.5.1-d, -e and -f (p. 4.1.5.1-7 and -8): the Mach number
 * of drag divergence and of the peak both scale by 1/√cos Λ_c/4 and the peak
 * by (cos Λ_c/4)^2.5. The construction used here, recorded in D-062, is
 * the stretch of the unswept curve in Mach by 1/√cos Λ and its scaling by
 * (cos Λ)^2.5, which honours the three equations exactly.
 *
 * Supersonic (section 4.1.5.1 C, pp. 4.1.5.1-12 to -16, scan pp. 733 to
 * 737): for sharp-nosed sections C_Dw = K (t/c)² /β (eq. 4.1.5.1-k, the
 * leading edge supersonic, β cot Λ_LE ≥ 1) or K cot Λ_LE (t/c)² (eq. -l,
 * subsonic leading edge), K = 16/3 for a biconvex section and
 * (c/x_t)/(1 − x_t/c) for a double wedge (table p. 4.1.5.1-16); for a
 * round-nosed section the wave drag of the biconvex shape behind the
 * leading edge is added to the leading-edge pressure drag (eqs. -n, -o),
 * the latter being the term the Niskanen model already carries (DRAG-10).
 *
 * Join (D-062): the transonic chart is used to Mach 1.2 (its ordinate held
 * beyond ξ = 1.4 where the chart ends, as the DATCOM sample problem does at
 * ξ = 1.45) and the supersonic formula from Mach 1.4; between 1.2 and 1.4
 * the two are faired linearly in Mach, the "fairing due to possible
 * mismatch between transonic and supersonic estimates" of sketch (a),
 * p. 4.2.3.1-5. Every value is the mean of two digitisation passes recorded
 * in `reference/digitised/datcom-figure-4-1-5-1-29.json`.
 */
import { InvalidInputError } from '../errors.js';
import { finiteResult } from '../numerics/finite.js';
import type { Mach } from '../units/si.js';

export interface WaveDragCurve {
  /** A (t/c)^(1/3) of the chart curve. */
  readonly aspectParameter: number;
  /** Reading uncertainty in the ordinate C_Dw/(t/c)^(5/3) (half the worst disagreement, floor 0.05). */
  readonly uncertainty: number;
  /** [ξ, C_Dw/(t/c)^(5/3)] in increasing ξ; ξ negative subsonic. */
  readonly points: readonly (readonly [number, number])[];
}

/** DATCOM figure 4.1.5.1-29, digitised twice (D-062); checked against the JSON file by a formats test. */
export const DATCOM_FIGURE_4151_29: readonly WaveDragCurve[] = Object.freeze([
  {
    aspectParameter: 0.5,
    uncertainty: 0.092,
    points: [
      [-1.42, 0.0],
      [-1.2, 0.067],
      [-1.1, 0.115],
      [-1.0, 0.168],
      [-0.9, 0.261],
      [-0.85, 0.309],
      [-0.8, 0.364],
      [-0.75, 0.418],
      [-0.7, 0.474],
      [-0.6, 0.583],
      [-0.5, 0.667],
      [-0.4, 0.74],
      [-0.2, 0.851],
      [0.0, 0.931],
      [0.4, 1.033],
      [0.8, 1.142],
      [1.2, 1.239],
      [1.4, 1.28],
    ],
  },
  {
    aspectParameter: 1.0,
    uncertainty: 0.114,
    points: [
      [-1.42, 0.0],
      [-1.2, 0.127],
      [-1.1, 0.213],
      [-1.0, 0.315],
      [-0.9, 0.534],
      [-0.85, 0.705],
      [-0.8, 0.887],
      [-0.75, 1.094],
      [-0.7, 1.301],
      [-0.6, 1.712],
      [-0.5, 1.895],
      [-0.4, 2.029],
      [-0.2, 2.199],
      [0.0, 2.308],
      [0.4, 2.466],
      [0.8, 2.587],
      [1.2, 2.683],
      [1.4, 2.728],
    ],
  },
  {
    aspectParameter: 1.5,
    uncertainty: 0.208,
    points: [
      [-1.42, 0.0],
      [-1.2, 0.169],
      [-1.1, 0.296],
      [-1.0, 0.458],
      [-0.9, 0.797],
      [-0.85, 1.066],
      [-0.8, 1.345],
      [-0.75, 1.688],
      [-0.7, 2.031],
      [-0.6, 2.614],
      [-0.5, 2.867],
      [-0.4, 2.952],
      [-0.2, 2.987],
      [0.0, 3.007],
      [0.4, 3.026],
      [0.8, 3.048],
      [1.2, 3.053],
      [1.4, 3.053],
    ],
  },
  {
    aspectParameter: 2.0,
    uncertainty: 0.277,
    points: [
      [-1.42, 0.0],
      [-1.2, 0.197],
      [-1.1, 0.361],
      [-1.0, 0.577],
      [-0.9, 1.075],
      [-0.85, 1.465],
      [-0.8, 1.854],
      [-0.75, 2.308],
      [-0.7, 2.712],
      [-0.6, 3.136],
      [-0.5, 3.268],
      [-0.4, 3.296],
      [-0.2, 3.303],
      [0.0, 3.308],
      [0.4, 3.303],
      [0.8, 3.296],
      [1.2, 3.255],
      [1.4, 3.218],
    ],
  },
  {
    aspectParameter: 3.0,
    uncertainty: 0.337,
    points: [
      [-1.42, 0.0],
      [-1.2, 0.228],
      [-1.1, 0.408],
      [-1.0, 0.738],
      [-0.9, 1.413],
      [-0.85, 1.925],
      [-0.8, 2.438],
      [-0.75, 2.841],
      [-0.7, 3.109],
      [-0.6, 3.364],
      [-0.5, 3.418],
      [-0.4, 3.441],
      [-0.2, 3.46],
      [0.0, 3.478],
      [0.4, 3.473],
      [0.8, 3.446],
      [1.2, 3.402],
      [1.4, 3.375],
    ],
  },
  {
    aspectParameter: 4.0,
    uncertainty: 0.401,
    points: [
      [-1.42, 0.0],
      [-1.2, 0.256],
      [-1.1, 0.492],
      [-1.0, 0.901],
      [-0.9, 1.802],
      [-0.85, 2.388],
      [-0.8, 2.877],
      [-0.75, 3.218],
      [-0.7, 3.401],
      [-0.6, 3.514],
      [-0.5, 3.545],
      [-0.4, 3.565],
      [-0.2, 3.587],
      [0.0, 3.607],
      [0.4, 3.602],
      [0.8, 3.558],
      [1.2, 3.479],
      [1.4, 3.436],
    ],
  },
]);

/** Mach number from the similarity abscissa: ξ < 0 subsonic, ξ > 0 supersonic. */
function xiOf(M: number, thicknessParameter: number): number {
  const s = Math.sqrt(Math.abs(M * M - 1)) / thicknessParameter;
  return M < 1 ? -s : s;
}

function interpolate(points: readonly (readonly [number, number])[], x: number): number {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) throw new Error('empty curve');
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (a === undefined || b === undefined) continue;
    if (x <= b[0]) return a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0]);
  }
  return last[1];
}

export interface ChartReading {
  /** C_Dw/(t/c)^(5/3). */
  readonly value: number;
  /** True when A (t/c)^(1/3) lay outside the chart's 0.5 to 4.0 and the nearest curve was used. */
  readonly clamped: boolean;
  /** Reading uncertainty of the curves used, in the ordinate. */
  readonly uncertainty: number;
}

/**
 * DRAG-18. Figure 4.1.5.1-29: the ordinate at ξ for A (t/c)^(1/3), linear in
 * ξ along each curve and linear in A (t/c)^(1/3) between the two nearest
 * curves; outside 0.5 to 4.0 the nearest curve is used and flagged (below
 * 0.5 this overstates the wave drag, the conservative side); the ordinate is
 * held beyond the chart's end at ξ = 1.4 and is 0 below ξ = −1.42.
 */
export function waveDragChart(aspectParameter: number, xi: number): ChartReading {
  if (!(aspectParameter > 0) || !Number.isFinite(aspectParameter))
    throw new InvalidInputError('A (t/c)^(1/3)', aspectParameter, 'must be greater than 0');
  if (!Number.isFinite(xi))
    throw new InvalidInputError('similarity abscissa', xi, 'must be finite');
  const curves = DATCOM_FIGURE_4151_29;
  const lo = curves[0];
  const hi = curves[curves.length - 1];
  if (lo === undefined || hi === undefined) throw new Error('no chart');
  if (aspectParameter <= lo.aspectParameter)
    return {
      value: interpolate(lo.points, xi),
      clamped: aspectParameter < lo.aspectParameter,
      uncertainty: lo.uncertainty,
    };
  if (aspectParameter >= hi.aspectParameter)
    return {
      value: interpolate(hi.points, xi),
      clamped: aspectParameter > hi.aspectParameter,
      uncertainty: hi.uncertainty,
    };
  for (let i = 1; i < curves.length; i += 1) {
    const a = curves[i - 1];
    const b = curves[i];
    if (a === undefined || b === undefined) continue;
    if (aspectParameter <= b.aspectParameter) {
      const w = (aspectParameter - a.aspectParameter) / (b.aspectParameter - a.aspectParameter);
      return {
        value: (1 - w) * interpolate(a.points, xi) + w * interpolate(b.points, xi),
        clamped: false,
        uncertainty: Math.max(a.uncertainty, b.uncertainty),
      };
    }
  }
  throw new Error('unreachable');
}

/** Sharp-nosed section shapes of the DATCOM K table (p. 4.1.5.1-16) that the fin model offers. */
export type WaveDragSection = 'biconvex' | 'double-wedge' | 'wedge';

/**
 * K of table p. 4.1.5.1-16: biconvex 16/3; double wedge (c/x_t)/(1 − x_t/c)
 * = c/x_t + c/(c − x_t), the ridge at mid-chord. The two terms are the
 * forward and the rearward faces; a single wedge (ridge at the trailing edge,
 * x_t = c) keeps the forward-face term c/x_t = 1 and its blunt base is the
 * trailing-edge base drag of DRAG-10 instead of the rear faces (D-066).
 */
export function sectionFactorK(section: WaveDragSection): number {
  switch (section) {
    case 'biconvex':
      return 16 / 3;
    case 'double-wedge':
      return 1 / 0.5 / (1 - 0.5);
    case 'wedge':
      return 1;
  }
}

export interface FinWaveDragInput {
  readonly mach: Mach;
  /** Thickness ratio t/c of the section (mean chord). */
  readonly thicknessRatio: number;
  /** Aspect ratio of the fin as half a wing, 2 s²/S_fin. */
  readonly aspectRatio: number;
  /** Quarter-chord sweep Λ_c/4, radians, for the transonic chart. */
  readonly quarterChordSweep: number;
  /** Leading-edge sweep Λ_LE, radians, for the supersonic formulas. */
  readonly leadingEdgeSweep: number;
  readonly section: WaveDragSection;
}

export interface FinWaveDrag {
  /** C_Dw referred to the fin planform area (one side), DRAG-18/19. */
  readonly cd: number;
  readonly method: 'transonic-chart' | 'fairing' | 'supersonic-linear';
  readonly warnings: readonly string[];
}

/** Mach number above which the transonic chart is left for the supersonic formulas, and the end of the fairing. */
export const WAVE_DRAG_FAIRING = Object.freeze({ start: 1.2, end: 1.4 });

/**
 * DRAG-19. Supersonic wave drag of eqs. 4.1.5.1-k and -l on the planform area:
 * K (t/c)² /β when β cot Λ_LE ≥ 1 (supersonic leading edge), else
 * K cot Λ_LE (t/c)²; an unswept leading edge is always supersonic.
 */
export function supersonicWaveDrag(
  M: number,
  thicknessRatio: number,
  leadingEdgeSweep: number,
  section: WaveDragSection,
): number {
  if (!(M > 1))
    throw new InvalidInputError('Mach number', M, 'must exceed 1 for the supersonic wave drag');
  const beta = Math.sqrt(M * M - 1);
  const K = sectionFactorK(section);
  const tc = thicknessRatio;
  const cot = leadingEdgeSweep > 0 ? 1 / Math.tan(leadingEdgeSweep) : Number.POSITIVE_INFINITY;
  if (beta * cot >= 1) return (K * tc * tc) / beta;
  return K * cot * tc * tc;
}

/** Transonic wave drag on the planform area from the chart with the sweep construction of D-062. */
function transonicWaveDrag(input: FinWaveDragInput, M: number): { cd: number; clamped: boolean } {
  const tc = input.thicknessRatio;
  const p = Math.cbrt(tc);
  const cosL = Math.cos(input.quarterChordSweep);
  // Stretch in Mach by 1/√cos Λ (eqs. 4.1.5.1-d, -f) and scale by (cos Λ)^2.5 (eq. -e).
  const unsweptMach = M * Math.sqrt(cosL);
  const reading = waveDragChart(input.aspectRatio * p, xiOf(unsweptMach, p));
  // The chart is the biconvex family's (D-062); other sections take it in the ratio of their supersonic K (D-066).
  const sectionScale = sectionFactorK(input.section) / sectionFactorK('biconvex');
  return {
    cd: reading.value * tc ** (5 / 3) * cosL ** 2.5 * sectionScale,
    clamped: reading.clamped,
  };
}

/**
 * DRAG-18/19. Fin wave drag on the planform area: the transonic chart to
 * Mach 1.2, the supersonic formula from Mach 1.4, a linear fairing between.
 */
export function finWaveDrag(input: FinWaveDragInput): FinWaveDrag {
  const M: number = input.mach;
  if (!(M >= 0) || !Number.isFinite(M))
    throw new InvalidInputError('Mach number', M, 'must be 0 or greater');
  const tc = input.thicknessRatio;
  if (!(tc > 0 && tc < 1))
    throw new InvalidInputError('fin thickness ratio', tc, 'must be between 0 and 1');
  if (!(input.aspectRatio > 0))
    throw new InvalidInputError('fin aspect ratio', input.aspectRatio, 'must be greater than 0');
  if (!(input.quarterChordSweep > -Math.PI / 2 && input.quarterChordSweep < Math.PI / 2))
    throw new InvalidInputError(
      'quarter-chord sweep',
      input.quarterChordSweep,
      'must be between -90 and 90 degrees',
    );
  if (!(input.leadingEdgeSweep >= 0 && input.leadingEdgeSweep < Math.PI / 2))
    throw new InvalidInputError(
      'leading-edge sweep',
      input.leadingEdgeSweep,
      'must be between 0 and 90 degrees',
    );
  const warnings: string[] = [];
  const note = (clamped: boolean): void => {
    if (clamped)
      warnings.push(
        `fin wave drag: A (t/c)^(1/3) = ${(input.aspectRatio * Math.cbrt(tc)).toFixed(2)} is outside the 0.5 to 4.0 of DATCOM figure 4.1.5.1-29; the nearest curve is used (D-062)`,
      );
  };
  if (M <= WAVE_DRAG_FAIRING.start) {
    const t = transonicWaveDrag(input, M);
    note(t.clamped);
    return { cd: finiteResult('fin wave drag', t.cd), method: 'transonic-chart', warnings };
  }
  const sup = supersonicWaveDrag(M, tc, input.leadingEdgeSweep, input.section);
  if (M >= WAVE_DRAG_FAIRING.end) {
    return { cd: finiteResult('fin wave drag', sup), method: 'supersonic-linear', warnings };
  }
  const t = transonicWaveDrag(input, WAVE_DRAG_FAIRING.start);
  note(t.clamped);
  const supEnd = supersonicWaveDrag(
    WAVE_DRAG_FAIRING.end,
    tc,
    input.leadingEdgeSweep,
    input.section,
  );
  const w = (M - WAVE_DRAG_FAIRING.start) / (WAVE_DRAG_FAIRING.end - WAVE_DRAG_FAIRING.start);
  warnings.push(
    'fin wave drag: faired linearly between the DATCOM transonic chart at Mach 1.2 and the supersonic linear-theory formula at Mach 1.4 (D-062)',
  );
  return {
    cd: finiteResult('fin wave drag', (1 - w) * t.cd + w * supEnd),
    method: 'fairing',
    warnings,
  };
}
