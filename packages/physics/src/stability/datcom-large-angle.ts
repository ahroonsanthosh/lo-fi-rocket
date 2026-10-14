/**
 * Normal force and centre of pressure of bodies and fins at large angles of
 * attack, 0 to 180° (plan 0033, HA-1 to HA-10, D-070), from the USAF DATCOM
 * (1978), `reference/docs/usaf-datcom-1978-dtic-adb072483-pp0495-0920.pdf`:
 *
 * - bodies: section 4.2.1.2 Method 3 (Jorgensen), eq. 4.2.1.2-c, and section
 *   4.2.2.2 Method 2, eqs. 4.2.2.2-b and -c (HA-1 to HA-3);
 * - fins: section 4.1.3.3 A, eqs. 4.1.3.3-a to -f (HA-7), with C_Lmax and
 *   α_CLmax from section 4.1.3.4 A Method 3, eqs. 4.1.3.4-f to -h (HA-4 to
 *   HA-6), and the centre of pressure from section 4.1.4.3 A Method 1 (HA-8);
 * - the fin-body combination: eq. 4.3.1.3-a without the body-vortex term (HA-9);
 * - reverse flow, 90 to 180°, by α′ = 180° − α on the reversed wing (HA-10).
 *
 * Validity, from the DATCOM: the fin charts are for subsonic speeds to Mach
 * 0.6, symmetric sections and Reynolds numbers 10⁶ to 10⁷ on the MAC; the body
 * method covers Mach 0 to 7 and is substantiated for constant cross-section
 * bodies, with no test verification above 60° at subsonic speeds (p. 4.2.1.2-6).
 */
import { InvalidInputError } from '../errors.js';
import type { FinCrossSection, TrapezoidFinSetComponent } from '../geometry/components.js';
import { finiteResult } from '../numerics/finite.js';
import {
  DATCOM_FIGURE_4133_55A,
  DATCOM_FIGURE_4134_23A,
  DATCOM_FIGURE_4134_23B,
  DATCOM_FIGURE_4134_24A,
  DATCOM_FIGURE_4134_24B_C1,
  DATCOM_FIGURE_4134_24B_C2,
  DATCOM_FIGURE_4134_25A,
  DATCOM_FIGURE_4134_25B,
  DATCOM_FIGURE_4143_21A,
  DATCOM_FIGURE_4143_21B,
  DATCOM_FIGURE_4143_22A,
  DATCOM_FIGURE_4143_22B,
  DATCOM_FIGURE_4143_23A,
  DATCOM_FIGURE_4143_23B,
  DATCOM_FIGURE_4143_24A,
  DATCOM_FIGURE_4143_24B_POST,
  DATCOM_FIGURE_4143_24B_PRE,
  DATCOM_FIGURE_4133_55A_D,
  DATCOM_FIGURE_4133_55B,
  DATCOM_FIGURE_4212_35A,
  DATCOM_FIGURE_4212_35B,
  type ChartPoints,
  type LabelledCurve,
  type TwoFamilyChart,
} from './datcom-large-angle-data.js';
import { trapezoidOf } from '../geometry/fin-planform.js';
import { exposedWing, tableValue } from './datcom-fin.js';

/** A chart reading, with `held` set when the argument lay beyond the drawn curve and the end value was used. */
export interface ChartReading {
  readonly value: number;
  readonly held: boolean;
}

/** Linear interpolation in a chart, holding the end values beyond the drawn range (reported as `held`). */
function heldValue(points: ChartPoints, x: number): ChartReading {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) throw new Error('empty chart');
  if (x < first[0]) return { value: first[1], held: true };
  if (x > last[0]) return { value: last[1], held: true };
  const v = tableValue(points, x);
  if (v === undefined) throw new Error('chart interpolation failed');
  return { value: v, held: false };
}

/** Linear interpolation between labelled curves at `label`, holding the extreme curves outside their range. */
function labelledValue(
  curves: readonly LabelledCurve[],
  label: number,
  x: number,
): { value: number; labelHeld: boolean; xHeld: boolean } {
  const lo = curves[0];
  const hi = curves[curves.length - 1];
  if (lo === undefined || hi === undefined) throw new Error('empty chart');
  if (label <= lo.label) {
    const r = heldValue(lo.points, x);
    return { value: r.value, labelHeld: label < lo.label, xHeld: r.held };
  }
  if (label >= hi.label) {
    const r = heldValue(hi.points, x);
    return { value: r.value, labelHeld: label > hi.label, xHeld: r.held };
  }
  for (let i = 1; i < curves.length; i++) {
    const a = curves[i - 1];
    const b = curves[i];
    if (a === undefined || b === undefined) continue;
    if (label <= b.label) {
      const ra = heldValue(a.points, x);
      const rb = heldValue(b.points, x);
      const t = (label - a.label) / (b.label - a.label);
      return {
        value: ra.value + t * (rb.value - ra.value),
        labelHeld: false,
        xHeld: ra.held || rb.held,
      };
    }
  }
  throw new Error('label interpolation failed');
}

/**
 * HA-1. η, the ratio of the cross-flow drag of a finite cylinder to that of an
 * infinite one, against the body fineness ratio ℓ_B/d (DATCOM figure
 * 4.2.1.2-35a, drawn from 2.05 to 27.9).
 */
export function crossflowDragProportionality(finenessRatio: number): ChartReading {
  if (!(finenessRatio > 0))
    throw new InvalidInputError('body fineness ratio', finenessRatio, 'must be greater than 0');
  return heldValue(DATCOM_FIGURE_4212_35A, finenessRatio);
}

/**
 * HA-2. c_dc, the steady cross-flow drag coefficient of a circular cylinder,
 * against the cross-flow Mach number M_c = M sin α (DATCOM figure
 * 4.2.1.2-35b; the chart folds at M_c = 1 into 1/M_c and is drawn to M_c ≈ 9).
 */
export function crossflowDragCoefficient(crossflowMach: number): ChartReading {
  if (!(crossflowMach >= 0) || !Number.isFinite(crossflowMach))
    throw new InvalidInputError('cross-flow Mach number', crossflowMach, 'must be 0 or greater');
  const k = crossflowMach <= 1 ? 10 * crossflowMach : 20 - 10 / crossflowMach;
  return heldValue(DATCOM_FIGURE_4212_35B, k);
}

/** α′ of eqs. 4.2.1.2-c and 4.2.2.2-b, -c: α up to 90°, 180° − α beyond. */
export function incidenceAngle(angleOfAttack: number): number {
  if (!(angleOfAttack >= 0 && angleOfAttack <= Math.PI))
    throw new InvalidInputError(
      'angle of attack',
      angleOfAttack,
      'must be between 0 and 180 degrees',
    );
  return angleOfAttack <= Math.PI / 2 ? angleOfAttack : Math.PI - angleOfAttack;
}

/**
 * HA-3, potential term. The factor sin 2α′ cos(α′/2)/2 that multiplies a
 * zero-angle slope C_Nα (per radian) in eq. 4.2.1.2-c: (S_b/S) sin 2α′
 * cos(α′/2) with C_Nα = 2 S_b/S (slender-body theory, section 4.2.1.1). It
 * equals α′ to first order.
 */
export function jorgensenPotentialFactor(angleOfAttack: number): number {
  const a = incidenceAngle(angleOfAttack);
  return (Math.sin(2 * a) * Math.cos(a / 2)) / 2;
}

/**
 * HA-3, viscous term. η c_dc sin²α′ of eq. 4.2.1.2-c, the coefficient that
 * multiplies S_p/S, with η from the body fineness ratio (HA-1) and c_dc at
 * M sin α (HA-2).
 */
export function jorgensenViscousFactor(
  angleOfAttack: number,
  mach: number,
  finenessRatio: number,
): { factor: number; eta: ChartReading; cdc: ChartReading } {
  const a = incidenceAngle(angleOfAttack);
  if (!(mach >= 0)) throw new InvalidInputError('Mach number', mach, 'must be 0 or greater');
  const eta = crossflowDragProportionality(finenessRatio);
  const cdc = crossflowDragCoefficient(mach * Math.sin(angleOfAttack));
  return { factor: eta.value * cdc.value * Math.sin(a) ** 2, eta, cdc };
}

/** Where a section reaches its maximum thickness, which selects figure 4.1.3.4-23a or -23b. */
export type MaximumThicknessChart = '23a' | '23b';

export interface LeadingEdgeParameter {
  /** Δy, percent chord. */
  readonly deltaY: number;
  /** The maximum-lift chart for the position of maximum thickness; undefined when neither covers it. */
  readonly chart: MaximumThicknessChart | undefined;
}

/**
 * HA-5. Δy, "the difference between the upper-surface ordinates expressed in
 * percent chord at the 6-percent- and 0.15-percent-chord stations" (DATCOM
 * p. 4.1.3.2-19), on the chord `chord` (the MAC, as the charts state), for the
 * fin sections of D-070. Square edges give 0 (the ordinate is t/2 from the
 * edge on); rounded edges are semicircles of radius t/2 (Niskanen p. 55);
 * 'airfoil' is the circular arc of D-065 (thickness t at mid-chord); a double
 * wedge rises linearly to t/2 at mid-chord; a single wedge rises to t/2 at the
 * trailing edge. Maximum thickness: square and rounded at the edge (figure
 * 23a), circular arc and double wedge at 50 % (23b, "between 35 and 50
 * percent"), single wedge at 100 % (neither).
 */
export function leadingEdgeParameter(
  section: FinCrossSection,
  thickness: number,
  chord: number,
): LeadingEdgeParameter {
  if (!(thickness > 0))
    throw new InvalidInputError('fin thickness', thickness, 'must be greater than 0 m');
  if (!(chord > 0)) throw new InvalidInputError('fin chord', chord, 'must be greater than 0 m');
  const half = thickness / 2;
  let ordinate: (x: number) => number;
  let chart: MaximumThicknessChart | undefined;
  switch (section) {
    case 'square':
      ordinate = () => half;
      chart = '23a';
      break;
    case 'rounded':
      ordinate = (x) => (x >= half ? half : Math.sqrt(half * half - (half - x) ** 2));
      chart = '23a';
      break;
    case 'airfoil': {
      // Circular arc through the edges with height t/2 at mid-chord: R = (c²/4 + (t/2)²)/t.
      const R = (chord * chord) / 4 / thickness + thickness / 4;
      ordinate = (x) => Math.sqrt(R * R - (x - chord / 2) ** 2) - (R - half);
      chart = '23b';
      break;
    }
    case 'double-wedge':
      ordinate = (x) =>
        x <= chord / 2 ? (x * thickness) / chord : ((chord - x) * thickness) / chord;
      chart = '23b';
      break;
    case 'wedge':
      ordinate = (x) => (x * half) / chord;
      chart = undefined;
      break;
  }
  const deltaY = (100 * (ordinate(0.06 * chord) - ordinate(0.0015 * chord))) / chord;
  return { deltaY: finiteResult('leading-edge parameter', deltaY), chart };
}

/** HA-7 inputs: the wing quantities eqs. 4.1.3.3-a to -f need. */
export interface WingNonlinearInputs {
  /** C_Nα of the wing at the Mach number, per radian (section 4.1.3.2; C_Lα for C_Nα). */
  readonly cnAlpha: number;
  /** C_Lmax and α_CLmax (radians) of the wing (section 4.1.3.4). */
  readonly cLmax: number;
  readonly alphaCLmax: number;
  /** C*_Lmax, the low-aspect-ratio maximum lift (equal to C_Lmax for a low-aspect-ratio wing). */
  readonly cLmaxStar: number;
  /** The wing-shape parameter J of eq. 4.1.3.3-e. */
  readonly j: number;
  /** β = √(1 − M²). */
  readonly beta: number;
  /** C_N at 90° (figure 4.1.3.3-55b). */
  readonly cn90: number;
}

export interface WingNormalForce {
  /** C′_N = C_L/cos α of eq. 4.1.3.3-a, on the wing area. */
  readonly cn: number;
  readonly cnaa: number;
  readonly beyondStall: boolean;
  /** J outside the charted −4 to 3 ("≥ 3" is charted) and held at −4. */
  readonly jHeld: boolean;
}

/**
 * HA-7 helper. J of eq. 4.1.3.3-e: 0.3 (C₁ + 1)(A/β) cos Λ_LE {(C₁ + 1)(C₂ + 1)
 * − [(C₂ + 1) A tan Λ_LE/7]³}.
 */
export function wingShapeParameter(
  c1: number,
  c2: number,
  aspectRatio: number,
  beta: number,
  tanLeadingEdge: number,
): number {
  const cos = 1 / Math.sqrt(1 + tanLeadingEdge * tanLeadingEdge);
  return (
    0.3 *
    (c1 + 1) *
    (aspectRatio / beta) *
    cos *
    ((c1 + 1) * (c2 + 1) - (((c2 + 1) * aspectRatio * tanLeadingEdge) / 7) ** 3)
  );
}

/**
 * HA-7 helper. C_N at 90° against the aspect ratio (figure 4.1.3.3-55b, drawn
 * from A = 0.013 to 50 on a scale folded at A = 1).
 */
export function normalForceAt90(aspectRatio: number): ChartReading {
  if (!(aspectRatio > 0))
    throw new InvalidInputError('aspect ratio', aspectRatio, 'must be greater than 0');
  const k = aspectRatio <= 1 ? 10 * aspectRatio : 20 - 10 / aspectRatio;
  return heldValue(DATCOM_FIGURE_4133_55B, k);
}

/**
 * HA-7. The subsonic wing normal force from 0 to 90° (DATCOM section 4.1.3.3
 * A, steps 1 and 2): C′_N = C_Nα sin 2α/2 + C_Naa sin α |sin α| (eq. a) with
 * C_Naa = (C_Naa)_ref + ΔC_Naa up to the stall (eq. b; ΔC_Naa from figure
 * 4.1.3.3-55a at J and tan α/tan α_CLmax) and, beyond it, eq. f:
 * C_Naa = (C_Naa)_ref + [(C_Naa)_90 − (C_Naa)_ref][1 − tan α_CLmax/tan α]
 * + β² D (C_Nα/2.3)(C_Lmax/C*_Lmax)², D from figure 4.1.3.3-55a (right) at
 * tan α_CLmax/tan α and (C_Naa)_90 = C_N at 90° (figure 55b). (C_Naa)_ref is
 * eq. d with C′_N at C_Lmax = C_Lmax/cos α_CLmax (eq. c). C_Nα is per radian
 * here; the DATCOM's 2.3 is printed for C_Nα per radian in its sample (p. 4.1.3.3-18).
 * ΔC_Naa below tan α/tan α_CLmax = 0.2 (where the curves start) is held at
 * the 0.2 value; it multiplies sin²α, which vanishes there (D-070).
 */
export function wingNormalForce(
  input: WingNonlinearInputs,
  angleOfAttack: number,
): WingNormalForce {
  const a = angleOfAttack;
  if (!(a >= 0 && a <= Math.PI / 2 + 1e-12))
    throw new InvalidInputError('angle of attack', a, 'must be between 0 and 90 degrees (HA-7)');
  const { cnAlpha, cLmax, alphaCLmax, cLmaxStar, j, beta, cn90 } = input;
  if (!(alphaCLmax > 0 && alphaCLmax < Math.PI / 2))
    throw new InvalidInputError(
      'angle of attack at maximum lift',
      alphaCLmax,
      'must be between 0 and 90 degrees',
    );
  if (!(cLmax > 0 && cLmaxStar > 0 && cnAlpha > 0 && beta > 0 && beta <= 1 && cn90 > 0))
    throw new InvalidInputError(
      'wing nonlinear inputs',
      cLmax,
      'C_Lmax, C*_Lmax, C_Nα, β and C_N(90°) must be positive',
    );
  const sinS = Math.sin(alphaCLmax);
  const cnAtStall = cLmax / Math.cos(alphaCLmax); // eq. c
  const ref = (cnAtStall - (cnAlpha * Math.sin(2 * alphaCLmax)) / 2) / (sinS * Math.abs(sinS)); // eq. d
  const tanS = Math.tan(alphaCLmax);
  const s = Math.sin(a);
  const jHeld = j < -4;
  let cnaa: number;
  let beyondStall: boolean;
  if (a <= alphaCLmax) {
    const r = Math.max(0.2, Math.tan(a) / tanS);
    cnaa = ref + labelledValue(DATCOM_FIGURE_4133_55A, Math.min(j, 3), r).value; // eq. b
    beyondStall = false;
  } else {
    const rPrime = a >= Math.PI / 2 ? 0 : tanS / Math.tan(a);
    const d = heldValue(DATCOM_FIGURE_4133_55A_D, rPrime).value;
    cnaa =
      ref +
      (cn90 - ref) * (1 - rPrime) +
      beta * beta * d * (cnAlpha / 2.3) * (cLmax / cLmaxStar) ** 2; // eq. f
    beyondStall = true;
  }
  const cn = (cnAlpha * Math.sin(2 * a)) / 2 + cnaa * s * Math.abs(s); // eq. a
  return { cn: finiteResult('wing normal force coefficient', cn), cnaa, beyondStall, jHeld };
}

/** The fin charts stop at Mach 0.6; from 0.6 to 1 every chart quantity is read there (D-070, DATCOM 4.1.3.3 B). */
export const FIN_CHART_MAX_MACH = 0.6;

export const TRANSONIC_LARGE_ANGLE_WARNING =
  'fin beyond the stall between Mach 0.6 and 1: the DATCOM gives no transonic high-angle method (section 4.1.3.3 B); its Mach 0.6 charts are used with the lift-curve slope at the flight Mach number, as its guidance suggests (D-070)';

/**
 * HA-4. The taper-ratio factors C₁ and C₂ of DATCOM figure 4.1.3.4-24b.
 */
export function taperRatioFactors(taperRatio: number): { c1: number; c2: number } {
  if (!(taperRatio >= 0 && taperRatio <= 1))
    throw new InvalidInputError(
      'taper ratio',
      taperRatio,
      'must be between 0 and 1 (DATCOM figure 4.1.3.4-24b)',
    );
  const c1 = tableValue(DATCOM_FIGURE_4134_24B_C1, taperRatio);
  const c2 = tableValue(DATCOM_FIGURE_4134_24B_C2, taperRatio);
  if (c1 === undefined || c2 === undefined) throw new Error('figure 4.1.3.4-24b lookup failed');
  return { c1, c2 };
}

/** The planform quantities of one wing direction (forward, or reversed for HA-10). */
export interface WingPlanform {
  readonly aspectRatio: number;
  readonly taperRatio: number;
  /** tan Λ_LE as used (a forward-swept edge is evaluated as unswept, `sweepHeld`). */
  readonly tanLeadingEdge: number;
  readonly sweepHeld: boolean;
  readonly deltaY: number;
  readonly chart: MaximumThicknessChart | undefined;
}

/** The exposed two-panel wing of a fin set (BAR-15) for the given flow direction (HA-10). */
export function wingPlanform(fin: TrapezoidFinSetComponent, reverse: boolean): WingPlanform {
  const cached = PLANFORM_CACHE.get(fin)?.[reverse ? 1 : 0];
  if (cached !== undefined) return cached;
  const p = computeWingPlanform(fin, reverse);
  const entry = PLANFORM_CACHE.get(fin) ?? [undefined, undefined];
  entry[reverse ? 1 : 0] = p;
  PLANFORM_CACHE.set(fin, entry);
  return p;
}
const PLANFORM_CACHE = new WeakMap<
  TrapezoidFinSetComponent,
  [WingPlanform | undefined, WingPlanform | undefined]
>();

function computeWingPlanform(shaped: TrapezoidFinSetComponent, reverse: boolean): WingPlanform {
  // D-087: a trapezoid method; other planforms use their equivalent trapezoid.
  const fin = trapezoidOf(shaped);
  const cr: number = fin.rootChord;
  const ct: number = fin.tipChord;
  const s: number = fin.span;
  const sweep: number = reverse ? cr - (fin.sweep as number) - ct : fin.sweep;
  const wing = exposedWing(cr, ct, s, sweep);
  const mac = ((2 / 3) * (cr * cr + cr * ct + ct * ct)) / (cr + ct);
  const section = fin.crossSection;
  if (section === undefined)
    throw new InvalidInputError(
      'fin cross-section',
      'undefined',
      'is needed for the large-angle model',
    );
  // HA-5: a single wedge in reverse flow leads with its square base and reaches its maximum thickness there.
  const le =
    reverse && section === 'wedge'
      ? leadingEdgeParameter('square', fin.thickness, mac)
      : leadingEdgeParameter(section, fin.thickness, mac);
  return {
    aspectRatio: wing.aspectRatio,
    taperRatio: wing.taperRatio,
    // An unswept edge computed as c_r − x_t − c_t can round to −1e-17: only a real forward sweep is reported.
    tanLeadingEdge: Math.max(0, wing.tanLeadingEdge),
    sweepHeld: wing.tanLeadingEdge < -1e-9,
    deltaY: le.deltaY,
    chart: le.chart,
  };
}

/** HA-6 and HA-7 quantities of a wing at a chart Mach number. */
export interface WingAnalysis {
  readonly planform: WingPlanform;
  readonly c1: number;
  readonly c2: number;
  readonly cLmax: number;
  /** Radians. */
  readonly alphaCLmax: number;
  readonly j: number;
  readonly cn90: number;
  readonly chartBeta: number;
  /** Chart readings held at an end, or other approximations, named for the warnings. */
  readonly notes: readonly string[];
}

/** One two-family chart (figure 4.1.3.4-23a/b) at X and Δy, the label held at the drawn extremes. */
function twoFamilyValue(
  chart: TwoFamilyChart,
  x: number,
  deltaY: number,
  name: string,
  notes: string[],
): number {
  const family = x <= chart.leftUntil ? chart.left : chart.right;
  const r = labelledValue(family, deltaY, x);
  if (r.labelHeld && deltaY < (family[0]?.label ?? 0))
    notes.push(
      `Δy = ${deltaY.toFixed(2)} % is below the lowest curve drawn at this abscissa in DATCOM figure ${name}; that curve was used`,
    );
  if (r.xHeld)
    notes.push(
      `(C₁ + 1)(A/β) cos Λ_LE = ${x.toFixed(2)} is outside the curves of DATCOM figure ${name}; the end value was used`,
    );
  return r.value;
}

/**
 * HA-6. Low-aspect-ratio maximum lift (DATCOM section 4.1.3.4 A Method 3):
 * C_Lmax = (C_Lmax)_base + ΔC_Lmax (eq. g) and α_CLmax = (α_CLmax)_base +
 * Δα_CLmax (eq. h), from figures 4.1.3.4-23a or -23b at (C₁ + 1)(A/β) cos Λ_LE
 * and Δy, -24a at (C₂ + 1) A tan Λ_LE and M, -25a at (C₁ + 1)(A/β) cos Λ_LE
 * and -25b at (C₂ + 1) A tan Λ_LE with A cos Λ_LE [1 + (2λ)²] or M. Valid for
 * A < 4/((C₁ + 1) cos Λ_LE) (eqs. f and c); the J of eq. 4.1.3.3-e and the C_N
 * at 90° (figure 4.1.3.3-55b) complete the HA-7 inputs. `chartMach` is at most
 * 0.6, the charts' limit.
 */
export function wingAnalysis(planform: WingPlanform, chartMach: number): WingAnalysis {
  // The last result per planform is kept: from Mach 0.6 on the chart Mach number is constant.
  const last = ANALYSIS_CACHE.get(planform);
  if (last?.chartMach === chartMach) return last.analysis;
  const analysis = computeWingAnalysis(planform, chartMach);
  ANALYSIS_CACHE.set(planform, { chartMach, analysis });
  return analysis;
}
const ANALYSIS_CACHE = new WeakMap<WingPlanform, { chartMach: number; analysis: WingAnalysis }>();

function computeWingAnalysis(planform: WingPlanform, chartMach: number): WingAnalysis {
  if (!(chartMach >= 0 && chartMach <= FIN_CHART_MAX_MACH))
    throw new InvalidInputError('chart Mach number', chartMach, 'must be between 0 and 0.6');
  const { aspectRatio: A, taperRatio: lambda, tanLeadingEdge: tan, deltaY } = planform;
  const notes: string[] = [];
  // Plan 0066 (D-102): a single wedge leads with its sharp edge and is thickest at the trailing
  // edge, outside both families; the 23b family (thickest at 35 to 50 %), the nearer, is used.
  const chart = planform.chart ?? '23b';
  if (planform.chart === undefined) notes.push(WEDGE_SECTION_NOTE);
  if (planform.sweepHeld)
    notes.push(
      'the leading edge in this flow direction is swept forward, which the DATCOM charts do not cover; it was evaluated as unswept',
    );
  const { c1, c2 } = taperRatioFactors(lambda);
  const cos = 1 / Math.sqrt(1 + tan * tan);
  // Plan 0066 (D-102): above the low-aspect-ratio limit the high-aspect-ratio method needs section
  // maximum-lift data a flat fin does not have; the low-aspect-ratio method is used, its charts
  // held at their ends.
  if (!(A * (c1 + 1) * cos < 4)) notes.push(highAspectRatioNote(A, 4 / ((c1 + 1) * cos)));
  const beta = Math.sqrt(1 - chartMach * chartMach);
  const x = (c1 + 1) * (A / beta) * cos;
  const xs = (c2 + 1) * A * tan;
  const base = twoFamilyValue(
    chart === '23a' ? DATCOM_FIGURE_4134_23A : DATCOM_FIGURE_4134_23B,
    x,
    deltaY,
    `4.1.3.4-${chart}`,
    notes,
  );
  const dCl = labelledValue(DATCOM_FIGURE_4134_24A, Math.max(0.2, chartMach), xs);
  if (dCl.xHeld)
    notes.push(
      `(C₂ + 1) A tan Λ_LE = ${xs.toFixed(2)} is outside DATCOM figure 4.1.3.4-24a; the end value was used`,
    );
  const aBase = heldValue(DATCOM_FIGURE_4134_25A, x);
  if (aBase.held)
    notes.push(
      `(C₁ + 1)(A/β) cos Λ_LE = ${x.toFixed(2)} is outside DATCOM figure 4.1.3.4-25a; the end value was used`,
    );
  const param = A * cos * (1 + (2 * lambda) ** 2);
  const da =
    xs <= DATCOM_FIGURE_4134_25B.leftUntil
      ? labelledValue(DATCOM_FIGURE_4134_25B.left, param, xs)
      : labelledValue(DATCOM_FIGURE_4134_25B.right, Math.max(0.2, chartMach), xs);
  if (da.xHeld || da.labelHeld)
    notes.push(
      `(C₂ + 1) A tan Λ_LE = ${xs.toFixed(2)}, A cos Λ_LE [1 + (2λ)²] = ${param.toFixed(2)} lie outside DATCOM figure 4.1.3.4-25b; the nearest curve was used`,
    );
  const cLmax = base + dCl.value;
  const alphaCLmax = ((aBase.value + da.value) * Math.PI) / 180;
  const cn90 = normalForceAt90(A);
  if (cn90.held)
    notes.push(
      `aspect ratio ${A.toFixed(2)} is outside DATCOM figure 4.1.3.3-55b; the end value was used`,
    );
  const j = wingShapeParameter(c1, c2, A, beta, tan);
  if (j < -4)
    notes.push(
      `J = ${j.toFixed(2)} is below the lowest curve (−4) of DATCOM figure 4.1.3.3-55a; that curve was used`,
    );
  return {
    planform,
    c1,
    c2,
    cLmax: finiteResult('maximum lift coefficient', cLmax),
    alphaCLmax: finiteResult('angle of attack at maximum lift', alphaCLmax),
    j,
    cn90: cn90.value,
    chartBeta: beta,
    notes,
  };
}

/** Linear interpolation over a ratio between labelled curves, with zero at ratio 1 (DATCOM 4.1.4.3 steps 3c, 3d). */
function ratioCurveValue(
  curves: readonly LabelledCurve[],
  ratio: number,
  x: number,
): { value: number; held: boolean } {
  const last = curves[curves.length - 1];
  if (last !== undefined && ratio > last.label) {
    const r = heldValue(last.points, x);
    return { value: (r.value * (1 - ratio)) / (1 - last.label), held: r.held };
  }
  const v = labelledValue(curves, ratio, x);
  return { value: v.value, held: v.xHeld };
}

/**
 * HA-8. Wing centre of pressure from 0 to 90°, in root chords from the apex
 * (DATCOM section 4.1.4.3 A Method 1): step 1 the zero-lift CP (here the
 * existing fin CP, BAR-10); step 2 (x/c_r)_CLmax = (x/c_r)₁ + Δ(x/c_r)₂
 * (eq. b, figures 21a at Δy and 22a at (C₃ + 1) A tan Λ_LE with C₃ from 21b);
 * step 3 up to α = tan⁻¹(tan α_CLmax/0.6): x/c_r = (x/c_r)₀ cos α +
 * [(x/c_r)_ref + Δ₃ + Δ₄] sin α (eq. d) with (x/c_r)_ref = (x/c_r)_CLmax/sin
 * α_CLmax − (x/c_r)₀ cot α_CLmax (eq. c), Δ₃ from figure 23 at the stability
 * index (22b) and Δ₄ from 24b at the aspect-ratio index (24a); step 4 the area
 * centroid at 90°, (1/3)[λ + σ + (1 + σλ)/(1 + λ)], σ = A(1 + λ) tan Λ_LE/4
 * (eqs. e, f); step 5 linear in α between steps 3 and 4 (D-070). Below
 * tan α/tan α_CLmax = 0.2, where figures 23(a) and 24b start, the 0.2 curves
 * are held; they multiply sin α.
 */
export function wingCentreOfPressure(
  analysis: WingAnalysis,
  angleOfAttack: number,
  zeroLiftCp: number,
): { cp: number; notes: string[] } {
  const a = angleOfAttack;
  if (!(a >= 0 && a <= Math.PI / 2 + 1e-12))
    throw new InvalidInputError('angle of attack', a, 'must be between 0 and 90 degrees (HA-8)');
  const notes: string[] = [];
  const { aspectRatio: A, taperRatio: lambda, tanLeadingEdge: tan, deltaY } = analysis.planform;
  const cos = 1 / Math.sqrt(1 + tan * tan);
  const as = analysis.alphaCLmax;
  const tanS = Math.tan(as);
  // Step 2.
  const x1 = heldValue(DATCOM_FIGURE_4143_21A, deltaY);
  if (x1.held)
    notes.push(
      `Δy = ${deltaY.toFixed(2)} % is outside DATCOM figure 4.1.4.3-21a; the end value was used`,
    );
  const c3 = heldValue(DATCOM_FIGURE_4143_21B, lambda).value;
  const x2 = labelledValue(DATCOM_FIGURE_4143_22A, A, (c3 + 1) * A * tan);
  if (x2.xHeld || x2.labelHeld)
    notes.push('DATCOM figure 4.1.4.3-22a was read at the nearest drawn curve');
  const xMax = x1.value + x2.value;
  // Steps 3a, 3b.
  const stability = labelledValue(DATCOM_FIGURE_4143_22B, A * tan, lambda);
  const arIndex = labelledValue(DATCOM_FIGURE_4143_24A, A * cos, lambda);
  if (stability.labelHeld || arIndex.labelHeld)
    notes.push('DATCOM figure 4.1.4.3-22b or -24a was read at the nearest drawn curve');
  const xRef = xMax / Math.sin(as) - zeroLiftCp / Math.tan(as);
  const step3 = (alpha: number): number => {
    const pre = alpha <= as;
    const ratio = pre ? Math.max(0.2, Math.tan(alpha) / tanS) : tanS / Math.tan(alpha);
    const d3 = ratioCurveValue(
      pre ? DATCOM_FIGURE_4143_23A : DATCOM_FIGURE_4143_23B,
      ratio,
      stability.value,
    );
    const d4 = ratioCurveValue(
      pre ? DATCOM_FIGURE_4143_24B_PRE : DATCOM_FIGURE_4143_24B_POST,
      ratio,
      arIndex.value,
    );
    if (d3.held || d4.held)
      notes.push(
        'DATCOM figure 4.1.4.3-23 or -24b was read at the end of its stability or aspect-ratio index range',
      );
    return zeroLiftCp * Math.cos(alpha) + (xRef + d3.value + d4.value) * Math.sin(alpha);
  };
  const alphaT = Math.atan(tanS / 0.6);
  let cp: number;
  if (a <= alphaT) cp = step3(a);
  else {
    const sigma = (A * (1 + lambda) * tan) / 4;
    const x90 = (lambda + sigma + (1 + sigma * lambda) / (1 + lambda)) / 3;
    const xT = step3(alphaT);
    cp = xT + ((x90 - xT) * (a - alphaT)) / (Math.PI / 2 - alphaT);
  }
  return { cp: finiteResult('wing centre of pressure', cp), notes };
}

/** C_Nα of the wing per radian at Mach M < 1: 2πA/(2 + √(4 + β²A²/cos²Λ_c/2)) (DATCOM 4.1.3.2, κ = 1; Niskanen eq. 3.40). */
export function wingLiftCurveSlope(shaped: TrapezoidFinSetComponent, mach: number): number {
  if (!(mach >= 0 && mach < 1))
    throw new InvalidInputError('Mach number', mach, 'must be between 0 and 1');
  const fin = trapezoidOf(shaped);
  const cr: number = fin.rootChord;
  const ct: number = fin.tipChord;
  const s: number = fin.span;
  const A = (4 * s) / (cr + ct);
  const tanMid = ((fin.sweep as number) + ct / 2 - cr / 2) / s;
  const beta2 = 1 - mach * mach;
  return (2 * Math.PI * A) / (2 + Math.sqrt(4 + beta2 * A * A * (1 + tanMid * tanMid)));
}

/**
 * Whether the DATCOM large-angle model can evaluate a fin set (D-070), and why not: it needs the
 * cross-section. Since plan 0066 (D-102) single wedges and high aspect ratios are evaluated with
 * a listed approximation (finLargeAngleApproximation) instead of being refused.
 */
export function finLargeAngleAvailability(
  fin: TrapezoidFinSetComponent,
): { available: true } | { available: false; reason: string } {
  if (fin.crossSection === undefined)
    return { available: false, reason: 'the fin cross-section is not set' };
  return { available: true };
}

const WEDGE_SECTION_NOTE =
  'a single-wedge section, thickest at the trailing edge, lies outside DATCOM figures 4.1.3.4-23a and -23b; the 23b family (thickest at 35 to 50 %), the nearer, was used';

const HIGH_ASPECT_RATIO_NOTE_TAIL =
  'the low-aspect-ratio method was used, its charts held at their ends (the high-aspect-ratio method needs section maximum-lift data a flat fin does not have)';

function highAspectRatioNote(aspectRatio: number, limit: number): string {
  return `the exposed fin pair's aspect ratio ${aspectRatio.toFixed(2)} is above the low-aspect-ratio limit 4/((C₁ + 1) cos Λ_LE) = ${limit.toFixed(2)} of DATCOM eq. 4.1.3.4-c; ${HIGH_ASPECT_RATIO_NOTE_TAIL}`;
}

/**
 * Plan 0067: whether a flight warning is a D-102 approximation note. finLargeAngle gives these as
 * warnings only beyond the stall, so a flight with one used the approximated part of the model.
 */
export function isLargeAngleApproximationWarning(warning: string): boolean {
  return warning.includes(WEDGE_SECTION_NOTE) || warning.includes(HIGH_ASPECT_RATIO_NOTE_TAIL);
}

/**
 * Plan 0066 (D-102): what the large-angle fin model approximates for this fin set, if anything:
 * a single-wedge section (the nearer chart family) or an aspect ratio above the low-aspect-ratio
 * method's limit (that method beyond its range). Undefined when the DATCOM covers it.
 */
export function finLargeAngleApproximation(fin: TrapezoidFinSetComponent): string | undefined {
  if (fin.crossSection === undefined) return undefined;
  const reasons: string[] = [];
  if (fin.crossSection === 'wedge') reasons.push(WEDGE_SECTION_NOTE);
  for (const reverse of [false, true]) {
    const p = wingPlanform(fin, reverse);
    const { c1 } = taperRatioFactors(p.taperRatio);
    const cos = 1 / Math.sqrt(1 + p.tanLeadingEdge ** 2);
    if (!(p.aspectRatio * (c1 + 1) * cos < 4)) {
      reasons.push(highAspectRatioNote(p.aspectRatio, 4 / ((c1 + 1) * cos)));
      break;
    }
  }
  return reasons.length === 0 ? undefined : reasons.join('; ');
}

/**
 * HA-7 to HA-10 for one fin set: the wing normal-force shape C′_N/C_Nα at
 * α′ (multiplying the fin set's slope, eq. 4.3.1.3-a) and the panel CP in root
 * chords from this direction's apex, below Mach 1. `zeroLiftCp` is step 1 of
 * HA-8 (the fin's own small-angle CP in root chords, for the reversed planform
 * when `reverse`). Chart notes become warnings once α′ passes the stall.
 */
export function finLargeAngle(
  fin: TrapezoidFinSetComponent,
  mach: number,
  alphaPrime: number,
  reverse: boolean,
  zeroLiftCp: number,
): { shape: number; cpOverRoot: number; beyondStall: boolean; warnings: string[] } {
  if (!(mach >= 0 && mach < 1))
    throw new InvalidInputError('Mach number', mach, 'must be between 0 and 1 (HA-7)');
  const analysis = wingAnalysis(wingPlanform(fin, reverse), Math.min(mach, FIN_CHART_MAX_MACH));
  const cnAlpha = wingLiftCurveSlope(fin, mach);
  const n = wingNormalForce(
    {
      cnAlpha,
      cLmax: analysis.cLmax,
      alphaCLmax: analysis.alphaCLmax,
      cLmaxStar: analysis.cLmax,
      j: analysis.j,
      beta: analysis.chartBeta,
      cn90: analysis.cn90,
    },
    alphaPrime,
  );
  const cp = wingCentreOfPressure(analysis, alphaPrime, zeroLiftCp);
  const warnings: string[] = [];
  if (n.beyondStall) {
    for (const note of [...analysis.notes, ...cp.notes])
      warnings.push(`large-angle fin model: ${note} (D-070)`);
    if (mach > FIN_CHART_MAX_MACH) warnings.push(TRANSONIC_LARGE_ANGLE_WARNING);
  }
  return { shape: n.cn / cnAlpha, cpOverRoot: cp.cp, beyondStall: n.beyondStall, warnings };
}
