/**
 * Supersonic fin normal force, body carry-over and its centre of pressure
 * from the USAF Stability and Control DATCOM (1978 revision) (plan 0028,
 * BAR-15, BAR-16, BAR-17, D-065). Page numbers are of the full DTIC scan
 * (ADB072483); the file `usaf-datcom-1978-dtic-adb072483-pp0495-0920.pdf`
 * starts at scan page 495 and `...-pp0921-1350.pdf` at 921.
 *
 * DATCOM treats a pair of opposite fins as a wing: the "exposed wing" is the
 * two fin panels joined at their roots, with span b_e = 2s, area
 * S_e = s(c_r + c_t), aspect ratio A_e = b_e²/S_e = 4s/(c_r + c_t), taper
 * ratio λ_e = c_t/c_r and leading-edge sweep tan Λ_LE = x_t/s.
 *
 * - BAR-15, section 4.1.3.2 C (scan p. 519), figure 4.1.3.2-56 (scan pp. 556
 *   to 559): the wing normal-force-curve slope C_Nα on S_e from linear theory,
 *   against β/tan Λ_LE (subsonic leading edge, ordinate tan Λ_LE C_Nα) and
 *   tan Λ_LE/β (supersonic leading edge, ordinate β C_Nα), curves of
 *   A tan Λ_LE, one panel per taper ratio; panel (g) covers rectangular
 *   wings. Per fin, (C_Nα)₁ = C_Nα S_e/(2 A_ref) = C_Nα A_fin/A_ref.
 * - BAR-16, section 4.3.1.2 C (scan p. 1041, eq. 4.3.1.2-a):
 *   (C_Lα)_WB = [K_N + K_W(B) + K_B(W)](C_Lα)_e S_e/S_W. K_W(B) is figure
 *   4.3.1.2-10, which is the factor 1 + d/b already used (Niskanen eq. 3.56,
 *   1 + r_t/(s + r_t)); K_B(W) comes from slender-body theory (figure
 *   4.3.1.2-10, K_W(B) + K_B(W) = (1 + d/b)², p. 4.3.1.2-4) when
 *   β A_e (1 + λ_e)(tan Λ_LE/β + 1) ≤ 4 and otherwise from figures
 *   4.3.1.2-11a (body extends behind the fin trailing edge) or 4.3.1.2-11b
 *   (it does not), which give K_B(W) β (C_Lα)_e (λ_e + 1)(b/d − 1) against
 *   β d/c_r for curves of β cot Λ_LE.
 * - BAR-17, section 4.3.2.2 C step 6 (scan p. 1102): the carry-over acts at
 *   x′_ac aft of the exposed root-chord leading edge, from figure 4.3.2.2-37
 *   (scan p. 1127) when the parameter above is ≥ 4 and from the slender-body
 *   result, figure 4.3.2.2-36b (scan p. 1126), x′_ac/c_r =
 *   min(0.5, ⅛ A_e (1 + λ_e) tan Λ_LE), below it.
 *
 * Conservative choices (D-065): figures 4.3.1.2-11a is used only when the body
 * behind the fin trailing edge is at least β d long (the carry-over region of
 * sketch (e), p. 4.3.1.2-5, ends one Mach-line crossing of the body behind the
 * root trailing edge); otherwise 11b, which gives the smaller carry-over.
 * Figure 4.3.2.2-37 uses its most forward curve for every sweep. Outside the
 * digitised charts the carry-over is left out (the Niskanen fin term alone,
 * which understates the fin-region force) and a warning says so.
 *
 * Step 2 of 4.1.3.2 C: near the sonic-leading-edge condition the theoretical
 * C_Nα is multiplied by the thickness correction of figure 4.1.3.2-60
 * (scan p. 560) for sharp-nosed sections; 'airfoil' fins are taken as
 * circular-arc sections (D-065). Blunt ('square', 'rounded') leading edges
 * are outside that chart and get no correction, with a warning.
 *
 * Validity: linear theory, small angles of attack; the charts are to be used
 * for M ≥ 1.4 (step 1, scan p. 520), so `finSetTerm` fairs from the Niskanen
 * value at Mach 0.8 to the DATCOM value at Mach 1.4 (BAR-12).
 */
import { InvalidInputError } from '../errors.js';
import type { PlacedComponent } from '../geometry/assembly.js';
import { finiteResult } from '../numerics/finite.js';
import {
  DATCOM_FIGURE_4132_56,
  DATCOM_FIGURE_4132_56G_LEFT,
  DATCOM_FIGURE_4132_60,
  DATCOM_FIGURE_4312_11A,
  DATCOM_FIGURE_4312_11B,
  DATCOM_FIGURE_4322_37A,
  DATCOM_FIGURE_4322_37B,
  type CarryOverChartCurve,
  type SonicLeadingEdgeCurve,
  type WingChartPanel,
} from './datcom-fin-data.js';

/** Linear interpolation in a table sorted by x; undefined outside [x₀, x_n]. */
export function tableValue(
  points: readonly (readonly [number, number])[],
  x: number,
): number | undefined {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return undefined;
  if (x < first[0] - 1e-12 || x > last[0] + 1e-12) return undefined;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a === undefined || b === undefined) continue;
    if (x <= b[0] + 1e-12) {
      if (b[0] === a[0]) return a[1];
      return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
    }
  }
  return last[1];
}

/** The exposed-wing quantities of a trapezoidal fin pair (module comment). */
export interface ExposedWing {
  readonly aspectRatio: number;
  readonly taperRatio: number;
  readonly tanLeadingEdge: number;
}

export function exposedWing(
  rootChord: number,
  tipChord: number,
  span: number,
  sweep: number,
): ExposedWing {
  if (!(rootChord > 0))
    throw new InvalidInputError('fin root chord', rootChord, 'must be greater than 0 m');
  if (!(tipChord >= 0))
    throw new InvalidInputError('fin tip chord', tipChord, 'must be 0 m or greater');
  if (!(span > 0)) throw new InvalidInputError('fin span', span, 'must be greater than 0 m');
  if (!Number.isFinite(sweep)) throw new InvalidInputError('fin sweep', sweep, 'must be finite');
  return {
    aspectRatio: (4 * span) / (rootChord + tipChord),
    taperRatio: tipChord / rootChord,
    tanLeadingEdge: sweep / span,
  };
}

/** One panel of figure 4.1.3.2-56 at (u, A tan Λ_LE); undefined outside the curves. */
function panelOrdinate(panel: WingChartPanel, u: number, aTan: number): number | undefined {
  const curves = panel.curves;
  for (let i = 1; i < curves.length; i++) {
    const a = curves[i - 1];
    const b = curves[i];
    if (a === undefined || b === undefined) continue;
    if (aTan >= a.aTanLe - 1e-12 && aTan <= b.aTanLe + 1e-12) {
      const va = tableValue(a.points, u);
      const vb = tableValue(b.points, u);
      if (va === undefined || vb === undefined) return undefined;
      return va + ((vb - va) * (aTan - a.aTanLe)) / (b.aTanLe - a.aTanLe);
    }
  }
  return undefined;
}

/** BAR-15, panel (g): C_Nα of a rectangular wing on its area. */
export function rectangularWingCnAlpha(aspectRatio: number, beta: number): number {
  const ab = aspectRatio * beta;
  if (!(ab > 0)) throw new InvalidInputError('A β', ab, 'must be greater than 0');
  if (ab <= 1) {
    const perA = tableValue(DATCOM_FIGURE_4132_56G_LEFT, ab);
    if (perA === undefined) throw new InvalidInputError('A β', ab, 'is outside panel (g)');
    return perA * aspectRatio;
  }
  // The right half of panel (g) is the straight line β C_Nα = 4 − 2/(A β).
  return (4 - 2 / ab) / beta;
}

/** One curve of figure 4.1.3.2-60 at z: 1 outside the drawn curve (its ends lie on the 1.0 line); the 70° curve holds its last value beyond z = 1.68. */
function sonicCurveValue(curve: SonicLeadingEdgeCurve, z: number): number {
  const first = curve.points[0];
  const last = curve.points[curve.points.length - 1];
  if (first === undefined || last === undefined) return 1;
  if (z <= first[0]) return 1;
  if (z >= last[0]) return last[1];
  return tableValue(curve.points, z) ?? 1;
}

/**
 * BAR-15, step 2 of section 4.1.3.2 C (scan p. 520): the sonic-leading-edge
 * thickness correction C_Nα/(C_Nα)_theory of figure 4.1.3.2-60 for a
 * sharp-nosed section with leading-edge semiwedge angle δ⊥ (radians, normal
 * to the leading edge), at z = β/tan Λ_LE (≤ 1) or 2 − tan Λ_LE/β. Linear in
 * δ⊥ between the curves (4° to 70°) and between the flat plate (δ⊥ = 0,
 * factor 1) and the 4° curve. Undefined above 70°.
 */
export function sonicLeadingEdgeFactor(deltaPerp: number, z: number): number | undefined {
  if (!(deltaPerp >= 0)) {
    throw new InvalidInputError('leading-edge semiwedge angle', deltaPerp, 'must be 0 or greater');
  }
  const deg = (deltaPerp * 180) / Math.PI;
  const curves = DATCOM_FIGURE_4132_60;
  let previous: { deltaPerpDeg: number; value: number } = { deltaPerpDeg: 0, value: 1 };
  for (const curve of curves) {
    const value = sonicCurveValue(curve, z);
    if (deg <= curve.deltaPerpDeg + 1e-12) {
      const w = (deg - previous.deltaPerpDeg) / (curve.deltaPerpDeg - previous.deltaPerpDeg);
      return previous.value + (value - previous.value) * w;
    }
    previous = { deltaPerpDeg: curve.deltaPerpDeg, value };
  }
  return undefined;
}

/**
 * The leading-edge semiwedge angle normal to the leading edge of a
 * circular-arc (biconvex) section of thickness t on a streamwise chord c with
 * leading-edge sweep Λ: the normal section has t/c⊥ = τ = t/(c cos Λ), and
 * the arc through the chord ends with height t/2 has tan(δ⊥/2) = τ.
 */
export function circularArcSemiwedge(
  thickness: number,
  chord: number,
  tanLeadingEdge: number,
): number {
  if (!(thickness >= 0 && chord > 0)) {
    throw new InvalidInputError(
      'fin thickness and chord',
      thickness,
      'need thickness ≥ 0 and chord > 0',
    );
  }
  const cosLe = 1 / Math.sqrt(1 + tanLeadingEdge * tanLeadingEdge);
  return 2 * Math.atan(thickness / (chord * cosLe));
}

export type WingCnAlphaResult =
  | { readonly cnAlpha: number; readonly source: string }
  | { readonly cnAlpha: undefined; readonly reason: string };

/**
 * BAR-15. C_Nα per radian of the exposed wing on S_e at M > 1 from figure
 * 4.1.3.2-56, interpolating linearly in A tan Λ_LE between curves and in λ
 * between the digitised panels (λ = 0, 1/4, 1/2, 1; panels (b) 1/5 and
 * (d) 1/3 are not digitised). Rectangular wings (Λ_LE = 0, λ = 1) use panel
 * (g); between Λ_LE = 0 and the A tan Λ_LE = 0.25 curve of panel (f) the
 * value is interpolated linearly in A tan Λ_LE. Other planforms outside
 * 0.25 ≤ A tan Λ_LE ≤ 6 and forward-swept leading edges are not covered.
 * With `deltaPerp` (sharp-nosed sections) the result includes the step 2
 * correction of figure 4.1.3.2-60.
 */
export function wingSupersonicCnAlpha(
  wing: ExposedWing,
  mach: number,
  deltaPerp?: number,
): WingCnAlphaResult {
  const theory = wingTheoryCnAlpha(wing, mach);
  if (theory.cnAlpha === undefined || deltaPerp === undefined || wing.tanLeadingEdge === 0) {
    return theory;
  }
  const beta = Math.sqrt(mach * mach - 1);
  const t = wing.tanLeadingEdge;
  const z = beta <= t ? beta / t : 2 - t / beta;
  const factor = sonicLeadingEdgeFactor(deltaPerp, z);
  if (factor === undefined) {
    return {
      cnAlpha: undefined,
      reason: `leading-edge semiwedge angle ${((deltaPerp * 180) / Math.PI).toFixed(1)}° is above the largest curve (70°) of DATCOM figure 4.1.3.2-60`,
    };
  }
  return {
    cnAlpha: theory.cnAlpha * factor,
    source: `${theory.source} × figure 4.1.3.2-60 (${factor.toFixed(3)})`,
  };
}

function wingTheoryCnAlpha(wing: ExposedWing, mach: number): WingCnAlphaResult {
  if (!(mach > 1))
    throw new InvalidInputError(
      'Mach number',
      mach,
      'must be greater than 1 for figure 4.1.3.2-56',
    );
  const beta = Math.sqrt(mach * mach - 1);
  const { aspectRatio: A, taperRatio: lambda, tanLeadingEdge: t } = wing;
  if (!(lambda >= 0 && lambda <= 1)) {
    return {
      cnAlpha: undefined,
      reason: `taper ratio ${lambda.toFixed(3)} is outside the DATCOM figure 4.1.3.2-56 panels (0 to 1)`,
    };
  }
  if (t < 0) {
    return {
      cnAlpha: undefined,
      reason: 'a forward-swept leading edge is outside DATCOM figure 4.1.3.2-56',
    };
  }
  const aTan = A * t;
  const rectangular = lambda === 1;
  if (aTan > 6) {
    return {
      cnAlpha: undefined,
      reason: `A tan Λ_LE = ${aTan.toFixed(2)} is above the largest curve (6) of DATCOM figure 4.1.3.2-56`,
    };
  }
  if (aTan < 0.25) {
    if (!rectangular) {
      return {
        cnAlpha: undefined,
        reason: `A tan Λ_LE = ${aTan.toFixed(3)} is below the smallest curve (0.25) of DATCOM figure 4.1.3.2-56 for a taper ratio below 1`,
      };
    }
    const g = rectangularWingCnAlpha(A, beta);
    if (t === 0) return { cnAlpha: g, source: 'figure 4.1.3.2-56 (g)' };
    const f = panelCnAlpha(DATCOM_FIGURE_4132_56[3], beta, t, 0.25);
    if (f === undefined)
      return { cnAlpha: undefined, reason: 'outside DATCOM figure 4.1.3.2-56 (f)' };
    return {
      cnAlpha: g + ((f - g) * aTan) / 0.25,
      source: 'figure 4.1.3.2-56 (g) to (f), interpolated in A tan Λ_LE',
    };
  }
  const panels = DATCOM_FIGURE_4132_56;
  for (let i = 1; i < panels.length; i++) {
    const p0 = panels[i - 1];
    const p1 = panels[i];
    if (p0 === undefined || p1 === undefined) continue;
    if (lambda <= p1.taperRatio + 1e-12) {
      const v0 = panelCnAlpha(p0, beta, t, aTan);
      const v1 = panelCnAlpha(p1, beta, t, aTan);
      if (v0 === undefined || v1 === undefined)
        return { cnAlpha: undefined, reason: 'outside DATCOM figure 4.1.3.2-56' };
      const w = (lambda - p0.taperRatio) / (p1.taperRatio - p0.taperRatio);
      return {
        cnAlpha: finiteResult('DATCOM wing normal force slope', v0 + (v1 - v0) * w),
        source: 'figure 4.1.3.2-56',
      };
    }
  }
  return { cnAlpha: undefined, reason: 'outside DATCOM figure 4.1.3.2-56' };
}

function panelCnAlpha(
  panel: WingChartPanel | undefined,
  beta: number,
  tanLe: number,
  aTan: number,
): number | undefined {
  if (panel === undefined || !(tanLe > 0)) return undefined;
  const subsonicLe = beta <= tanLe;
  const u = subsonicLe ? beta / tanLe : 2 - tanLe / beta;
  const ordinate = panelOrdinate(panel, u, aTan);
  if (ordinate === undefined) return undefined;
  return subsonicLe ? ordinate / tanLe : ordinate / beta;
}

/** DATCOM 4.3.1.2 C, nontriangular planforms: the switch between figure 4.3.1.2-10 and figures 11a/11b. */
export function carryOverParameter(wing: ExposedWing, beta: number): number {
  return beta * wing.aspectRatio * (1 + wing.taperRatio) * (wing.tanLeadingEdge / beta + 1);
}

function carryOverChartValue(
  chart: readonly CarryOverChartCurve[],
  v: number,
  w: number,
): number | undefined {
  // Curves in order of w = tan Λ_LE/β = 1/(β cot Λ_LE): ∞ ↦ 0, 10 ↦ 0.1, ..., 0.1 ↦ 10.
  const ws = chart.map((c) => (c.betaCotLe === Infinity ? 0 : 1 / c.betaCotLe));
  for (let i = 1; i < chart.length; i++) {
    const a = chart[i - 1];
    const b = chart[i];
    const wa = ws[i - 1];
    const wb = ws[i];
    if (a === undefined || b === undefined || wa === undefined || wb === undefined) continue;
    if (w >= wa - 1e-12 && w <= wb + 1e-12) {
      const ya = tableValue(a.points, v);
      const yb = tableValue(b.points, v);
      if (ya === undefined || yb === undefined) return undefined;
      return ya + ((yb - ya) * (w - wa)) / (wb - wa);
    }
  }
  return undefined;
}

export interface CarryOver {
  /** K_W(B), figure 4.3.1.2-10 = 1 + d/b. */
  readonly kWB: number;
  /** K_B(W); 0 when the method is 'not applied'. */
  readonly kBW: number;
  readonly method:
    | 'slender-body (figure 4.3.1.2-10)'
    | 'figure 4.3.1.2-11a'
    | 'figure 4.3.1.2-11b'
    | 'not applied';
  /** x′_ac of the carry-over aft of the root-chord leading edge, metres (NaN when not applied). */
  readonly acFromRootLe: number;
  readonly parameter: number;
  readonly warnings: readonly string[];
}

/**
 * BAR-16 and BAR-17. Body carry-over of one fin pair. `wingCnAlpha` is
 * (C_Lα)_e per radian on S_e (BAR-15); `bodyRadius` the body radius at the
 * fins; `afterbodyLength` the body length behind the fin root trailing edge.
 */
export function finCarryOver(
  wing: ExposedWing,
  rootChord: number,
  span: number,
  bodyRadius: number,
  afterbodyLength: number,
  wingCnAlpha: number,
  mach: number,
): CarryOver {
  if (!(mach > 1)) throw new InvalidInputError('Mach number', mach, 'must be greater than 1');
  if (!(bodyRadius >= 0))
    throw new InvalidInputError('body radius at the fins', bodyRadius, 'must be 0 m or greater');
  if (!(afterbodyLength >= 0))
    throw new InvalidInputError('afterbody length', afterbodyLength, 'must be 0 m or greater');
  const beta = Math.sqrt(mach * mach - 1);
  const d = 2 * bodyRadius;
  const b = d + 2 * span;
  const tau = d / b;
  const kWB = 1 + tau;
  const parameter = carryOverParameter(wing, beta);
  if (bodyRadius === 0) {
    return {
      kWB,
      kBW: 0,
      method: 'not applied',
      acFromRootLe: Number.NaN,
      parameter,
      warnings: [],
    };
  }
  const v = (beta * d) / rootChord;
  if (parameter <= 4) {
    // Figure 4.3.1.2-10 (slender-body theory): K_W(B) + K_B(W) = (1 + d/b)².
    const kBW = (1 + tau) ** 2 - kWB;
    // Figure 4.3.2.2-36b: x′_ac/c_r = min(0.5, (1/8) A_e (1 + λ_e) tan Λ_LE).
    const frac = Math.min(
      0.5,
      (wing.aspectRatio * (1 + wing.taperRatio) * wing.tanLeadingEdge) / 8,
    );
    return {
      kWB,
      kBW,
      method: 'slender-body (figure 4.3.1.2-10)',
      acFromRootLe: frac * rootChord,
      parameter,
      warnings: [],
    };
  }
  const withAfterbody = afterbodyLength >= beta * d;
  const chart = withAfterbody ? DATCOM_FIGURE_4312_11A : DATCOM_FIGURE_4312_11B;
  const name = withAfterbody ? 'figure 4.3.1.2-11a' : 'figure 4.3.1.2-11b';
  const w = wing.tanLeadingEdge / beta;
  const y = carryOverChartValue(chart, v, w);
  if (y === undefined) {
    return {
      kWB,
      kBW: 0,
      method: 'not applied',
      acFromRootLe: Number.NaN,
      parameter,
      warnings: [
        `Fin-body carry-over left out: β d/c_r or β cot Λ_LE is outside the digitised DATCOM ${name}; the fin force is understated there, so the CP is placed conservatively forward.`,
      ],
    };
  }
  const kBW = y / (beta * wingCnAlpha * (1 + wing.taperRatio) * (b / d - 1));
  const acTable = withAfterbody ? DATCOM_FIGURE_4322_37A : DATCOM_FIGURE_4322_37B;
  const last = acTable[acTable.length - 1];
  const warnings: string[] = [];
  let frac = tableValue(acTable, v);
  if (frac === undefined) {
    // Above the chart's β d/c_r = 2.8 the a.c. moves further aft; its value at 2.8 is the conservative bound.
    frac = last?.[1] ?? 0.5;
    warnings.push(
      'Fin-body carry-over: β d/c_r is beyond DATCOM figure 4.3.2.2-37 (2.8); the carry-over is placed at the chart value for 2.8, ahead of its likely position.',
    );
  }
  return {
    kWB,
    kBW: finiteResult('carry-over factor K_B(W)', kBW),
    method: withAfterbody ? 'figure 4.3.1.2-11a' : 'figure 4.3.1.2-11b',
    acFromRootLe: frac * rootChord,
    parameter,
    warnings,
  };
}

/**
 * The body length behind the root trailing edge of the fin set at
 * `finIndex`: the aft end of the last nose cone, body tube or transition
 * minus the fin set's position plus root chord (0 when the fins overhang).
 */
export function finAfterbodyLength(
  components: readonly PlacedComponent[],
  finIndex: number,
): number {
  const placed = components[finIndex];
  if (placed?.component.kind !== 'finSet') {
    throw new InvalidInputError('fin set index', finIndex, 'must point at a fin set');
  }
  let bodyEnd = 0;
  for (const { component: c, position } of components) {
    if (c.kind === 'noseCone' || c.kind === 'bodyTube' || c.kind === 'transition') {
      bodyEnd = Math.max(bodyEnd, (position as number) + (c.length as number));
    }
  }
  const te = (placed.position as number) + (placed.component.rootChord as number);
  return Math.max(0, bodyEnd - te);
}
