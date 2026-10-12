/**
 * Barrowman normal force coefficient derivatives, centre of pressure and
 * stability margin (plan 0006; register entries BAR-1 to BAR-9 in
 * docs/equations.md).
 *
 * Source: Niskanen, S. (2009), Development of an Open Source model rocket
 * simulation software, chapter 3 (printed page = PDF page − 10). Every
 * function cites its equation. Assumptions of the method (p. 21): angle of
 * attack very close to zero, steady irrotational flow, rigid body, sharp
 * nose tip, flat-plate fins, axially symmetric body.
 *
 * Conventions (docs/conventions.md): positions from the nose tip, positive
 * aft; C_Nα referred to the reference area π d²/4 with d the reference
 * diameter (the maximum body diameter unless given).
 */
import { InvalidInputError, NotImplementedError } from '../errors.js';
import type { PlacedComponent } from '../geometry/assembly.js';
import { rocketMassProperties, type MotorMass } from '../geometry/assembly.js';
import type {
  Component,
  NoseConeComponent,
  TransitionComponent,
  TrapezoidFinSetComponent,
} from '../geometry/components.js';
import { noseProfile, transitionProfile, type Profile } from '../geometry/profiles.js';
import { DEFAULT_PANELS, integrate } from '../geometry/revolution.js';
import { finiteResult } from '../numerics/finite.js';
import { datcomBodyAssembly, noseCylinderTermAtMach } from './datcom-body.js';
import {
  metres,
  squareMetres,
  type Mach,
  type Metres,
  type Radians,
  type SquareMetres,
} from '../units/si.js';

/** One component's contribution: C_Nα (referred to A_ref) and CP from the component's forward end. */
export interface AerodynamicTerm {
  readonly cnAlpha: number;
  /** Centre of pressure from the component's forward end, metres. NaN only when cnAlpha is 0 (unused). */
  readonly cpX: number;
}

export interface FinSetTerm extends AerodynamicTerm {
  /** (C_Nα)₁ of a single fin, eq. (3.40) subsonic or eq. (3.49) supersonic. */
  readonly cnAlphaSingleFin: number;
  /** Fraction of the mean aerodynamic chord at which the CP lies, 0.25 below Mach 0.5 (BAR-10). */
  readonly chordFraction: number;
  /** 'subsonic' (3.40), 'transonic' (BAR-12 interpolation) or 'supersonic' (3.49). */
  readonly regime: 'subsonic' | 'transonic' | 'supersonic';
  /** Multiplier of (C_Nα)₁ for the fin count and roll angle, eq. (3.54). */
  readonly finCountFactor: number;
  /** K_T(B), eq. (3.56). */
  readonly interferenceFactor: number;
  /** Roll angle actually used (the worst case when requested), radians. */
  readonly rollAngle: number;
}

export type RollAngle = Radians | 'worst';

/**
 * BAR-12. The interpolation of the single-fin normal force derivative across
 * the transonic band 0.8 < M < 1.2, where the thesis gives no formula
 * (p. 19: "some suitable interpolation function that corresponds reasonably
 * to actual measurements"). The candidates were compared against the
 * held-out ARCAS wind tunnel data (D-056); `DEFAULT_TRANSONIC_FIN_INTERPOLATION`
 * is the one chosen. Every candidate joins eq. (3.40) at Mach 0.8 and
 * eq. (3.49) at Mach 1.2:
 * - 'linear': a straight line between the two end values;
 * - 'cubic-hermite': the cubic matching the end values and the end slopes of
 *   both formulas (continuous derivative at both ends);
 * - 'quadratic-subsonic': the parabola matching the subsonic value and slope
 *   at 0.8 and the supersonic value at 1.2.
 */
export type TransonicFinInterpolation = 'linear' | 'cubic-hermite' | 'quadratic-subsonic';
export const DEFAULT_TRANSONIC_FIN_INTERPOLATION: TransonicFinInterpolation = 'cubic-hermite';

export interface CentreOfPressureOptions {
  readonly mach: Mach;
  /** Roll angle θ of eq. (3.54), or 'worst' for the most forward CP over θ. */
  readonly rollAngle: RollAngle;
  /**
   * true: eq. (3.54) as written, with the empirical roll-angle reductions for
   * three and four fins (the displayed figure, D-016).
   * false: OpenRocket-equivalent, the bracketed reductions removed (1.50 and
   * 2.00); for reference comparisons only.
   */
  readonly finRollReduction: boolean;
  /** Reference diameter d; defaults to the maximum body diameter (BAR-9). */
  readonly referenceDiameter?: Metres;
  /** BAR-12 candidate; defaults to `DEFAULT_TRANSONIC_FIN_INTERPOLATION` (D-056). */
  readonly transonicFinInterpolation?: TransonicFinInterpolation;
}

export interface ComponentContribution {
  readonly index: number;
  readonly kind: Component['kind'];
  readonly cnAlpha: number;
  /** CP from the nose tip. */
  readonly cp: Metres;
}

export interface CentreOfPressureResult {
  readonly cp: Metres;
  readonly cnAlpha: number;
  readonly mach: Mach;
  readonly rollAngle: RollAngle;
  readonly finRollReduction: boolean;
  readonly referenceDiameter: Metres;
  readonly referenceArea: SquareMetres;
  readonly contributions: readonly ComponentContribution[]; /** Validity notes of the Mach-dependent body term (BAR-13, BAR-14). */
  readonly warnings: readonly string[];
}

function requireMach(mach: number): void {
  if (!Number.isFinite(mach) || mach < 0) {
    throw new InvalidInputError('Mach number', mach, 'must be a finite number of 0 or greater');
  }
}

/**
 * BAR-1. Niskanen eq. (3.13), p. 20, subsonic branch: β = √(1 − M²) for
 * M < 1. The supersonic branch (√(M² − 1)) belongs to the Phase 2 fin model
 * (eqs. 3.41 to 3.49) and is not implemented.
 */
export function prandtlBeta(mach: Mach): number {
  const M: number = mach;
  requireMach(M);
  if (M >= 1) {
    throw new NotImplementedError(
      `fin normal force at Mach ${String(M)}: supersonic fins (Niskanen eqs. 3.41 to 3.49) are Phase 2`,
    );
  }
  return Math.sqrt(1 - M * M);
}

/**
 * BAR-2 and BAR-3. Niskanen eq. (3.19), p. 22: C_Nα = (2/A_ref)[A(l) − A(0)]
 * with sin α/α → 1 as α → 0; eq. (3.28), p. 24: X_B = [l A(l) − V]/[A(l) − A(0)].
 * C_Nα is taken as independent of Mach (p. 22). When A(l) = A(0) the
 * component produces no normal force and its CP is undefined (NaN, unused
 * in the moment sum).
 */
export function bodyTerm(
  foreArea: number,
  aftArea: number,
  volume: number,
  length: number,
  referenceArea: number,
): AerodynamicTerm {
  const dA = aftArea - foreArea;
  const cnAlpha = (2 * dA) / referenceArea;
  if (dA === 0) return { cnAlpha: 0, cpX: Number.NaN };
  return { cnAlpha, cpX: (length * aftArea - volume) / dA };
}

/** Volume of the outer profile: ∫ π r(x)² dx (plan 0003 integrator). */
function profileVolume(profile: Profile): number {
  return integrate((x) => Math.PI * profile.radius(x) ** 2, profile.length, DEFAULT_PANELS);
}

/** BAR-2, BAR-3 for a nose cone: A(0) = 0, A(l) = π R². The shoulder is inside the tube and ignored. */
export function noseConeTerm(c: NoseConeComponent, referenceArea: SquareMetres): AerodynamicTerm {
  const profile = noseProfile(c.shape, c.length, c.baseRadius, c.shapeParameter);
  const R: number = c.baseRadius;
  return bodyTerm(0, Math.PI * R * R, profileVolume(profile), profile.length, referenceArea);
}

/** BAR-2, BAR-3 for a shoulder or boat tail: A(0) = π r_f², A(l) = π r_a². */
export function transitionTerm(
  c: TransitionComponent,
  referenceArea: SquareMetres,
): AerodynamicTerm {
  const profile = transitionProfile(c.shape, c.length, c.foreRadius, c.aftRadius, c.shapeParameter);
  const rf: number = c.foreRadius;
  const ra: number = c.aftRadius;
  return bodyTerm(
    Math.PI * rf * rf,
    Math.PI * ra * ra,
    profileVolume(profile),
    profile.length,
    referenceArea,
  );
}

/** Roll angle at which each fin count gives its minimum normal force (BAR-7). */
function worstRollAngle(count: number): number {
  switch (count) {
    case 1:
    case 2:
      return 0; // Σ sin²(2πk/N + θ) = 0: the fins are edge-on to the lateral airflow
    case 3:
      return 0; // cos²(3θ/2) = 1
    case 4:
      return Math.PI / 4; // sin²(2θ) = 1
    default:
      return 0; // no dependence for N ≥ 5
  }
}

/**
 * BAR-7. Niskanen eq. (3.54), p. 34: the multiplier of (C_Nα)₁ for N
 * equally spaced fins at roll angle θ, where θ = 0 has one fin pointing into
 * the lateral airflow. N = 1, 2: Σ_k sin²Λ_k with Λ_k = 2πk/N + θ (eq. 3.53,
 * p. 32). N = 3: 1.50[1 − 0.15 cos²(3θ/2)]; N = 4: 2.00[1 − 0.06 sin²(2θ)];
 * N = 5 to 8: 2.37, 2.74, 2.99, 3.24. With `reduction` false the bracketed
 * empirical factors for N = 3 and 4 are omitted (D-016).
 */
export function finRollFactor(count: number, rollAngle: RollAngle, reduction: boolean): number {
  if (!Number.isInteger(count) || count < 1) {
    throw new InvalidInputError('fin count', count, 'must be a whole number of 1 or more');
  }
  if (count > 8) {
    throw new NotImplementedError(
      `${String(count)} fins: Niskanen eq. (3.54) gives factors for 1 to 8 fins only`,
    );
  }
  const theta: number = rollAngle === 'worst' ? worstRollAngle(count) : rollAngle;
  if (!Number.isFinite(theta)) {
    throw new InvalidInputError('roll angle', theta, 'must be a finite angle in radians');
  }
  switch (count) {
    case 1:
    case 2: {
      let sum = 0;
      for (let k = 1; k <= count; k++) sum += Math.sin((2 * Math.PI * k) / count + theta) ** 2;
      return sum;
    }
    case 3:
      return 1.5 * (reduction ? 1 - 0.15 * Math.cos(1.5 * theta) ** 2 : 1);
    case 4:
      return 2.0 * (reduction ? 1 - 0.06 * Math.sin(2 * theta) ** 2 : 1);
    case 5:
      return 2.37;
    case 6:
      return 2.74;
    case 7:
      return 2.99;
    default:
      return 3.24;
  }
}

/** Aspect ratio A = 2s²/A_fin (p. 27, p. 29). */
function aspectRatio(span: number, finArea: number): number {
  return (2 * span * span) / finArea;
}

/**
 * BAR-10. Niskanen eq. (3.35), p. 27: for M > 2 the CP lies at the fraction
 * (Aβ − 0.67)/(2Aβ − 1) of the MAC, β = √(M² − 1). Between Mach 0.5 and 2
 * a fifth-order polynomial p(M) with p(0.5) = 0.25, p′(0.5) = 0, p(2) = f(2),
 * p′(2) = f′(2), p″(2) = 0, p‴(2) = 0 (eq. 3.36). Below Mach 0.5 the
 * quarter chord (eq. 3.34).
 */
export function finChordFraction(mach: Mach, aspect: number): number {
  const M: number = mach;
  requireMach(M);
  if (!(aspect > 0))
    throw new InvalidInputError('fin aspect ratio', aspect, 'must be greater than 0');
  if (M <= 0.5) return 0.25;
  const f = (m: number): { value: number; slope: number } => {
    const beta = Math.sqrt(m * m - 1);
    const u = aspect * beta;
    return {
      value: (u - 0.67) / (2 * u - 1),
      slope: ((0.34 / (2 * u - 1) ** 2) * aspect * m) / beta,
    };
  };
  if (M >= 2) return finiteResult('fin chord fraction', f(M).value);
  // Solve for the six coefficients of p(M) = Σ a_k M^k from the six constraints (a small linear system).
  const f2 = f(2);
  const rows: number[][] = [];
  const rhs: number[] = [];
  const powers = (m: number, d: number): number[] => {
    // d-th derivative of M^k at m, for k = 0..5
    const out: number[] = [];
    for (let k = 0; k <= 5; k++) {
      let coeff = 1;
      for (let j = 0; j < d; j++) coeff *= k - j;
      out.push(k - d >= 0 ? coeff * m ** (k - d) : 0);
    }
    return out;
  };
  rows.push(powers(0.5, 0));
  rhs.push(0.25);
  rows.push(powers(0.5, 1));
  rhs.push(0);
  rows.push(powers(2, 0));
  rhs.push(f2.value);
  rows.push(powers(2, 1));
  rhs.push(f2.slope);
  rows.push(powers(2, 2));
  rhs.push(0);
  rows.push(powers(2, 3));
  rhs.push(0);
  const a = solveLinear(rows, rhs);
  let p = 0;
  for (let k = 0; k <= 5; k++) p += (a[k] ?? 0) * M ** k;
  return finiteResult('fin chord fraction', p);
}

/** Gaussian elimination with partial pivoting for the small systems above (deterministic). */
function solveLinear(rows: number[][], rhs: number[]): number[] {
  const n = rhs.length;
  const m = rows.map((r, i) => [...r, rhs[i] ?? 0]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r]?.[col] ?? 0) > Math.abs(m[pivot]?.[col] ?? 0)) pivot = r;
    }
    const pr = m[pivot];
    const cr = m[col];
    if (pr === undefined || cr === undefined) throw new Error('linear system malformed');
    m[pivot] = cr;
    m[col] = pr;
    const p = pr[col] ?? 0;
    if (p === 0)
      throw new InvalidInputError('fin CP polynomial', p, 'the constraint system is singular');
    for (let r = col + 1; r < n; r++) {
      const row = m[r];
      if (row === undefined) continue;
      const factor = (row[col] ?? 0) / p;
      for (let c = col; c <= n; c++) row[c] = (row[c] ?? 0) - factor * (pr[c] ?? 0);
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    const row = m[r];
    if (row === undefined) continue;
    let sum = row[n] ?? 0;
    for (let c = r + 1; c < n; c++) sum -= (row[c] ?? 0) * (x[c] ?? 0);
    x[r] = sum / (row[r] ?? 1);
  }
  return x;
}

/** γ = 1.4 for eqs. (3.43), (3.44). */
const GAMMA_AIR = 1.4;

/**
 * BAR-11. Niskanen eqs. (3.41) to (3.49), pp. 30 to 31: supersonic flat-plate
 * fin, Busemann third-order expansion. K₁ = 2/β, K₂ = ((γ+1)M⁴ − 4β²)/(4β⁴),
 * K₃ = ((γ+1)M⁸ + (2γ² − 7γ − 5)M⁶ + 10(γ+1)M⁴ + 8)/(6β⁷); with all strips at
 * the same inclination α, (C_Nα)₁ = (A_fin/A_ref)(K₁ + K₂α + K₃α²) (eq. 3.49).
 * The fin-tip Mach cone correction is ignored as in the thesis (p. 30).
 */
/**
 * BAR-11. Eqs. (3.42) to (3.44) p. 30: the Busemann coefficients K₁ = 2/β,
 * K₂ = ((γ+1)M⁴ − 4β²)/(4β⁴), K₃ = ((γ+1)M⁸ + (2γ² − 7γ − 5)M⁶ + 10(γ+1)M⁴ + 8)/(6β⁷),
 * β = √(M² − 1), γ = 1.4, for M > 1. Shared by the fin normal force (3.49)
 * and the supersonic roll damping (3.72, AERO-6).
 */
export function busemannCoefficients(M: number): { k1: number; k2: number; k3: number } {
  if (!(M > 1)) throw new InvalidInputError('Mach number', M, 'must be greater than 1');
  const beta = Math.sqrt(M * M - 1);
  const g = GAMMA_AIR;
  return {
    k1: 2 / beta,
    k2: ((g + 1) * M ** 4 - 4 * beta * beta) / (4 * beta ** 4),
    k3:
      ((g + 1) * M ** 8 + (2 * g * g - 7 * g - 5) * M ** 6 + 10 * (g + 1) * M ** 4 + 8) /
      (6 * beta ** 7),
  };
}

export function supersonicFinCnAlpha(
  mach: Mach,
  finArea: number,
  referenceArea: number,
  angleOfAttack: number,
): number {
  const M: number = mach;
  if (!(M > 1))
    throw new InvalidInputError(
      'Mach number',
      M,
      'must be greater than 1 for the supersonic fin formula',
    );
  const { k1, k2, k3 } = busemannCoefficients(M);
  const a = angleOfAttack;
  return finiteResult(
    'supersonic fin normal force',
    (finArea / referenceArea) * (k1 + k2 * a + k3 * a * a),
  );
}

/**
 * BAR-5, BAR-6, BAR-7, BAR-8 for a trapezoidal fin set.
 *
 * Eq. (3.34), p. 27: X_f from the root leading edge (valid below Mach 0.5,
 * p. 27; the rearward shift of eqs. 3.35 and 3.36 is Phase 2).
 * Eq. (3.40), p. 29: (C_Nα)₁ = 2π s²/A_ref / (1 + √(1 + (β s²/(A_fin cos Γ_c))²)),
 * Γ_c the mid-chord sweep angle (Figure 3.2(a), p. 26): tan Γ_c = (x_t + c_t/2 − c_r/2)/s.
 * Eq. (3.54): fin count and roll angle; eqs. (3.55), (3.56): K_T(B) = 1 + r_t/(s + r_t).
 */
export function finSetTerm(
  c: TrapezoidFinSetComponent,
  referenceArea: SquareMetres,
  mach: Mach,
  rollAngle: RollAngle,
  finRollReduction: boolean,
  angleOfAttack = 0,
  transonic: TransonicFinInterpolation = DEFAULT_TRANSONIC_FIN_INTERPOLATION,
): FinSetTerm {
  const M: number = mach;
  requireMach(M);
  const cr: number = c.rootChord;
  const ct: number = c.tipChord;
  const xt: number = c.sweep;
  const s: number = c.span;
  const rt: number = c.bodyRadius;
  if (!(cr > 0)) throw new InvalidInputError('fin root chord', cr, 'must be greater than 0 m');
  if (!(ct >= 0)) throw new InvalidInputError('fin tip chord', ct, 'must be 0 m or greater');
  if (!(s > 0)) throw new InvalidInputError('fin span', s, 'must be greater than 0 m');
  if (!(rt >= 0))
    throw new InvalidInputError('body radius at the fins', rt, 'must be 0 m or greater');
  if (!Number.isFinite(xt)) throw new InvalidInputError('fin sweep', xt, 'must be finite');
  const Aref: number = referenceArea;
  const Afin = ((cr + ct) / 2) * s;
  // eq. (3.34): the quarter-MAC position; eq. (3.30) MAC c̄ = (2/3)(c_r² + c_r c_t + c_t²)/(c_r + c_t).
  const quarterChord =
    ((xt / 3) * (cr + 2 * ct)) / (cr + ct) + (cr * cr + ct * ct + cr * ct) / (6 * (cr + ct));
  const mac = ((2 / 3) * (cr * cr + cr * ct + ct * ct)) / (cr + ct);
  // BAR-10: the CP moves aft of the quarter chord above Mach 0.5 (eqs. 3.35, 3.36).
  const chordFraction = finChordFraction(mach, aspectRatio(s, Afin));
  const cpX = quarterChord + (chordFraction - 0.25) * mac;
  // eq. (3.40): (C_Nα)₁ = C/(1 + √(1 + (β k)²)), C = 2π s²/A_ref, k = s²/(A_fin cos Γ_c).
  const gammaC = Math.atan((xt + ct / 2 - cr / 2) / s);
  const k = (s * s) / (Afin * Math.cos(gammaC));
  const C = (2 * Math.PI * s * s) / Aref;
  const subsonic = (m: number): number => C / (1 + Math.sqrt(1 + (Math.sqrt(1 - m * m) * k) ** 2));
  let cnAlphaSingleFin: number;
  let regime: 'subsonic' | 'transonic' | 'supersonic';
  if (M <= 0.8) {
    cnAlphaSingleFin = subsonic(M);
    regime = 'subsonic';
  } else if (M >= 1.2) {
    cnAlphaSingleFin = supersonicFinCnAlpha(mach, Afin, Aref, angleOfAttack);
    regime = 'supersonic';
  } else {
    cnAlphaSingleFin = transonicSingleFin(
      transonic,
      M,
      subsonic,
      k,
      C,
      supersonicFinCnAlpha(mach_(1.2), Afin, Aref, angleOfAttack),
      Afin / Aref,
    );
    regime = 'transonic';
  }
  // eq. (3.54)
  const finCountFactor = finRollFactor(c.count, rollAngle, finRollReduction);
  // eqs. (3.55), (3.56)
  const interferenceFactor = 1 + rt / (s + rt);
  return {
    cnAlpha: interferenceFactor * finCountFactor * cnAlphaSingleFin,
    cpX,
    cnAlphaSingleFin,
    chordFraction,
    regime,
    finCountFactor,
    interferenceFactor,
    rollAngle: rollAngle === 'worst' ? worstRollAngle(c.count) : rollAngle,
  };
}

const mach_ = (m: number): Mach => m as Mach;

/**
 * BAR-12. The transonic band value of (C_Nα)₁ for one candidate. The end
 * slopes are those of the formulas at α = 0: eq. (3.40) with β = √(1 − M²),
 * dβ/dM = −M/β, gives d(C_Nα)₁/dM = −C (u/√(1 + u²)) (du/dM)/(1 + √(1 + u²))²
 * with u = β k, du/dM = −k M/β; eq. (3.49) at α = 0 is (A_fin/A_ref) 2/β with
 * β = √(M² − 1), slope −(A_fin/A_ref) 2M/β³. The supersonic end value keeps
 * the α terms of eq. (3.49) as `finSetTerm` evaluates them.
 */
function transonicSingleFin(
  candidate: TransonicFinInterpolation,
  M: number,
  subsonic: (m: number) => number,
  k: number,
  C: number,
  supersonicAt12: number,
  areaRatio: number,
): number {
  const m0 = 0.8;
  const m1 = 1.2;
  const lo = subsonic(m0);
  const hi = supersonicAt12;
  const beta0 = Math.sqrt(1 - m0 * m0);
  const u = beta0 * k;
  const root = Math.sqrt(1 + u * u);
  const loSlope = (-C * ((u / root) * ((-k * m0) / beta0))) / (1 + root) ** 2;
  const beta1 = Math.sqrt(m1 * m1 - 1);
  const hiSlope = (-areaRatio * 2 * m1) / beta1 ** 3;
  const h = m1 - m0;
  const t = (M - m0) / h;
  switch (candidate) {
    case 'linear':
      return lo + (hi - lo) * t;
    case 'cubic-hermite': {
      const t2 = t * t;
      const t3 = t2 * t;
      return (
        (2 * t3 - 3 * t2 + 1) * lo +
        (t3 - 2 * t2 + t) * h * loSlope +
        (-2 * t3 + 3 * t2) * hi +
        (t3 - t2) * h * hiSlope
      );
    }
    case 'quadratic-subsonic': {
      const c = (hi - lo - loSlope * h) / (h * h);
      return lo + loSlope * (M - m0) + c * (M - m0) ** 2;
    }
  }
}

/** BAR-9. The maximum body diameter (Niskanen p. 20: the caliber) over nose cones, body tubes and transitions. */
export function maximumBodyDiameter(components: readonly PlacedComponent[]): Metres {
  let r = 0;
  for (const { component: c } of components) {
    if (c.kind === 'noseCone') r = Math.max(r, c.baseRadius);
    else if (c.kind === 'bodyTube') r = Math.max(r, c.outerRadius);
    else if (c.kind === 'transition') r = Math.max(r, c.foreRadius, c.aftRadius);
  }
  if (!(r > 0)) {
    throw new InvalidInputError(
      'reference diameter',
      2 * r,
      'the rocket needs a nose cone, body tube or transition with a positive radius',
    );
  }
  return metres(2 * r);
}

/**
 * BAR-4. Niskanen eq. (3.29), p. 25: X = Σ X_i (C_Nα)_i / Σ (C_Nα)_i over the
 * aerodynamic components (nose cones, transitions, fin sets); body tubes
 * and internal parts contribute nothing (p. 23).
 */
export function centreOfPressure(
  components: readonly PlacedComponent[],
  options: CentreOfPressureOptions,
): CentreOfPressureResult {
  requireMach(options.mach);
  const referenceDiameter = options.referenceDiameter ?? maximumBodyDiameter(components);
  const d: number = referenceDiameter;
  if (!(d > 0)) {
    throw new InvalidInputError('reference diameter', d, 'must be greater than 0 m');
  }
  const referenceArea = squareMetres((Math.PI * d * d) / 4);
  const contributions: ComponentContribution[] = [];
  let sumCn = 0;
  let sumMoment = 0;
  const assembly = datcomBodyAssembly(components);
  const warnings: string[] = [];
  components.forEach(({ component: c, position }, index) => {
    let term: AerodynamicTerm | undefined;
    if (c.kind === 'noseCone') {
      term = noseConeTerm(c, referenceArea);
      if (assembly?.noseIndex === index && (options.mach as number) > 0.8) {
        // BAR-13, BAR-14: the nose-cylinder body term against Mach (D-064).
        const m = noseCylinderTermAtMach(
          assembly,
          { cnAlpha: term.cnAlpha, cp: (position as number) + term.cpX },
          referenceArea,
          options.mach,
        );
        warnings.push(...m.warnings);
        term = { cnAlpha: m.cnAlpha, cpX: m.cp - (position as number) };
      }
    } else if (c.kind === 'transition') term = transitionTerm(c, referenceArea);
    else if (c.kind === 'finSet') {
      term = finSetTerm(
        c,
        referenceArea,
        options.mach,
        options.rollAngle,
        options.finRollReduction,
        0,
        options.transonicFinInterpolation ?? DEFAULT_TRANSONIC_FIN_INTERPOLATION,
      );
    }
    if (term === undefined || term.cnAlpha === 0) return;
    const cp = (position as number) + term.cpX;
    contributions.push({ index, kind: c.kind, cnAlpha: term.cnAlpha, cp: metres(cp) });
    sumCn += term.cnAlpha;
    sumMoment += term.cnAlpha * cp;
  });
  if (contributions.length === 0) {
    throw new InvalidInputError(
      'components',
      components.length,
      'at least one nose cone, transition or fin set is needed to define a centre of pressure',
    );
  }
  if (!(sumCn > 0)) {
    throw new InvalidInputError(
      'total normal force coefficient derivative',
      sumCn,
      'must be greater than 0 for the centre of pressure to be defined (Niskanen eq. 3.29)',
    );
  }
  return {
    cp: metres(finiteResult('centre of pressure', sumMoment / sumCn)),
    cnAlpha: finiteResult('total normal force coefficient derivative', sumCn),
    mach: options.mach,
    rollAngle: options.rollAngle,
    finRollReduction: options.finRollReduction,
    referenceDiameter,
    referenceArea,
    contributions,
    warnings,
  };
}

/** BAR-9. Stability margin in calibers: (X_CP − X_CG)/d. Positive means the CP is aft of the CG. */
export function stabilityMargin(cp: Metres, cg: Metres, referenceDiameter: Metres): number {
  const d: number = referenceDiameter;
  if (!(d > 0)) throw new InvalidInputError('reference diameter', d, 'must be greater than 0 m');
  return finiteResult('stability margin', ((cp as number) - (cg as number)) / d);
}

export interface StabilityResult {
  readonly centreOfPressure: CentreOfPressureResult;
  readonly cgLiftoff: Metres;
  readonly cgBurnout: Metres;
  /** Calibers, at the liftoff and burnout CG (the CP is the same at both: the motor is not aerodynamic). */
  readonly marginLiftoff: number;
  readonly marginBurnout: number;
}

/** CP, CG and margins at liftoff and burnout (CLAUDE.md 6.2). The motor masses come from the motor file. */
export function rocketStability(
  components: readonly PlacedComponent[],
  motorLiftoff: MotorMass,
  motorBurnout: MotorMass,
  options: CentreOfPressureOptions,
): StabilityResult {
  const cpResult = centreOfPressure(components, options);
  const cgLiftoff = rocketMassProperties(components, motorLiftoff).cg;
  const cgBurnout = rocketMassProperties(components, motorBurnout).cg;
  return {
    centreOfPressure: cpResult,
    cgLiftoff,
    cgBurnout,
    marginLiftoff: stabilityMargin(cpResult.cp, cgLiftoff, cpResult.referenceDiameter),
    marginBurnout: stabilityMargin(cpResult.cp, cgBurnout, cpResult.referenceDiameter),
  };
}
