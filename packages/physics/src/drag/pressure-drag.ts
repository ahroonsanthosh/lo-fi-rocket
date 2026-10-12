/**
 * Pressure drag of body components (plan 0009, DRAG-5 to DRAG-9; plan 0020,
 * DRAG-15 to DRAG-17).
 *
 * Sources: Niskanen (2009) §3.4.3 pp. 46 to 49 and Appendix B pp. 106 to
 * 110; NASA TR R-100 Figure 12 for the data of Appendix B.3 (D-053, D-055). Every coefficient here is referred to the component's own reference
 * area (its frontal area, p. 41) and must be scaled by the caller (eq. 3.75).
 */
import { InvalidInputError, NotImplementedError } from '../errors.js';
import type { NoseShape } from '../geometry/profiles.js';
import { finiteResult } from '../numerics/finite.js';
import { mach, type Mach } from '../units/si.js';
import { STONEY_NOSES, type StoneyCurve, type StoneyNose } from './stoney-noses.js';

/** γ = 1.4, the specific heat ratio of air used in eq. (B.5) p. 108. */
const GAMMA_AIR = 1.4;

function requireMach(M: number): void {
  if (!(M >= 0) || !Number.isFinite(M))
    throw new InvalidInputError('Mach number', M, 'must be 0 or greater');
}

/**
 * DRAG-5. Eq. (B.1) p. 106 (Hoerner pp. 15-2, 16-3): q_stag/q = 1 + M²/4 +
 * M⁴/40 for M < 1; 1.84 − 0.76/M² + 0.166/M⁴ + 0.035/M⁶ for M > 1.
 */
export function stagnationPressureRatio(mach: Mach): number {
  const M: number = mach;
  requireMach(M);
  if (M < 1) return 1 + (M * M) / 4 + M ** 4 / 40;
  return 1.84 - 0.76 / (M * M) + 0.166 / M ** 4 + 0.035 / M ** 6;
}

/**
 * The derivative in M of eq. (B.1), used for the slope of the scaled data
 * at the lower boundary of the transonic method (DRAG-16): M/2 + M³/10 for
 * M < 1; 1.52/M³ − 0.664/M⁵ − 0.21/M⁷ for M > 1.
 */
function stagnationPressureRatioSlope(M: number): number {
  if (M < 1) return M / 2 + M ** 3 / 10;
  return 1.52 / M ** 3 - 0.664 / M ** 5 - 0.21 / M ** 7;
}

/** DRAG-5. Eq. (B.2) p. 107: (C_D•)stag = 0.85 q_stag/q, referred to the frontal area. */
export function stagnationDragCoefficient(mach: Mach): number {
  return finiteResult('stagnation drag coefficient', 0.85 * stagnationPressureRatio(mach));
}

/** Cubic Hermite interpolation on [x0, x1] with values and slopes at both ends. */
function hermite(
  x: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  m0: number,
  m1: number,
): number {
  const h = x1 - x0;
  const u = (x - x0) / h;
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    (2 * u3 - 3 * u2 + 1) * y0 +
    (u3 - 2 * u2 + u) * h * m0 +
    (-2 * u3 + 3 * u2) * y1 +
    (u3 - u2) * h * m1
  );
}

/** Eq. (B.4) p. 107 and its derivative in M, for M > 1. */
function conicalSupersonic(sinE: number, M: number): { value: number; slope: number } {
  const root = Math.sqrt(M * M - 1);
  return {
    value: 2.1 * sinE * sinE + (0.5 * sinE) / root,
    slope: (-0.5 * sinE * M) / root ** 3,
  };
}

/**
 * The transonic and supersonic part of DRAG-7 (Appendix B.2): value at M ≥ 1.
 * B.6 at M = 1: C = sin ε; B.5 slope 4/(γ+1)(1 − 0.5 C_M=1); B.4 for
 * M ≥ 1.3; cubic interpolation with both end values and slopes on [1, 1.3].
 */
function conicalTransonic(sinE: number, M: number): number {
  if (M >= 1.3) return conicalSupersonic(sinE, M).value;
  const c1 = sinE;
  const s1 = (4 / (GAMMA_AIR + 1)) * (1 - 0.5 * c1);
  const end = conicalSupersonic(sinE, 1.3);
  return hermite(M, 1, 1.3, c1, end.value, s1, end.slope);
}

/**
 * DRAG-6. Eq. (3.87) p. 48: the subsonic pressure drag a M^b + C₀ fitted to
 * the transonic value C_t and slope C_t′ at the lower bound M_t of the
 * transonic method: b = C_t′ M_t/(C_t − C₀), a = (C_t − C₀)/M_t^b. The
 * result is non-decreasing with zero derivative at M = 0 as required.
 */
function subsonicInterpolation(
  M: number,
  c0: number,
  mt: number,
  ct: number,
  ctSlope: number,
): number {
  const rise = ct - c0;
  if (!(rise > 0) || !(ctSlope >= 0)) {
    throw new InvalidInputError(
      'transonic boundary',
      { ct, c0, ctSlope },
      'the transonic value must exceed the low-speed value with a non-negative slope for eq. (3.87)',
    );
  }
  const b = (ctSlope * mt) / rise;
  const a = rise / mt ** b;
  return a * M ** b + c0;
}

export interface NosePressureDrag {
  /** Referred to the nose base area. */
  readonly cd: number;
  readonly method:
    | 'low-subsonic-constant'
    | 'subsonic-interpolation'
    | 'conical-transonic'
    | 'conical-supersonic'
    | 'stoney-data'
    | 'stoney-data-held';
  readonly warnings: readonly string[];
}

/**
 * DRAG-15. C₃(M) of a measured curve: linear interpolation in Mach between
 * the data points; the last value held above the data (Stoney's curves are
 * nearly flat there, and holding it is the conservative choice, D-055).
 * Below the first point the curve is undefined (returns undefined).
 */
function curveValue(curve: StoneyCurve, M: number): number | undefined {
  const pts = curve.points;
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (first === undefined || last === undefined) throw new Error('empty Stoney curve');
  if (M < first[0]) return undefined;
  if (M >= last[0]) return last[1];
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    if (a === undefined || b === undefined) continue;
    if (M <= b[0]) return a[1] + ((b[1] - a[1]) * (M - a[0])) / (b[0] - a[0]);
  }
  throw new Error('unreachable');
}

/** Right-hand slope dC₃/dM of a measured curve at M (zero beyond the last point). */
function curveSlope(curve: StoneyCurve, M: number): number {
  const pts = curve.points;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    if (a === undefined || b === undefined) continue;
    if (M >= a[0] && M < b[0]) return (b[1] - a[1]) / (b[0] - a[0]);
  }
  return 0;
}

/** The curves between which a parametrised shape interpolates (DRAG-17), by shape parameter. */
interface CurveFamily {
  /** Increasing parameter values with their curves. */
  readonly members: readonly (readonly [number, StoneyNose])[];
  readonly parameterName: string;
}

/**
 * DRAG-17. Stoney's figure covers the power series at x^1/4, x^1/2, x^3/4
 * and the cone (κ = 1), the parabolic series at κ = 1/2, 3/4, 1 and the cone
 * (κ = 0), and the Haack series at κ = 0 (Von Kármán) and 1/3 (L-V Haack).
 * A parameter between two measured curves interpolates linearly between them
 * (N09 p. 110, "interpolate the data between parameter values"); the cone
 * endpoint is Stoney's own cone curve (configuration 56) so that every
 * endpoint is measured data of the same figure (D-055).
 */
const FAMILIES: Readonly<Record<'power' | 'parabolic' | 'haack', CurveFamily>> = {
  power: {
    members: [
      [0.25, 'power-1/4'],
      [0.5, 'power-1/2'],
      [0.75, 'power-3/4'],
      [1, 'cone'],
    ],
    parameterName: 'power series shape parameter',
  },
  parabolic: {
    members: [
      [0, 'cone'],
      [0.5, 'parabola-1/2'],
      [0.75, 'parabola-3/4'],
      [1, 'parabola'],
    ],
    parameterName: 'parabolic shape parameter',
  },
  haack: {
    members: [
      [0, 'von-karman'],
      [1 / 3, 'lv-haack'],
    ],
    parameterName: 'Haack series shape parameter',
  },
};

/** The one or two curves a nose uses with their weights (DRAG-17). */
interface CurveBlend {
  readonly curves: readonly { readonly name: StoneyNose; readonly weight: number }[];
}

function selectCurves(
  shape: 'elliptical' | 'parabolic' | 'power' | 'haack',
  kappa: number,
): CurveBlend {
  if (shape === 'elliptical') return { curves: [{ name: 'ellipsoid', weight: 1 }] };
  const family = FAMILIES[shape];
  const first = family.members[0];
  const last = family.members[family.members.length - 1];
  if (first === undefined || last === undefined) throw new Error('empty family');
  if (!(kappa >= first[0] && kappa <= last[0])) {
    throw new NotImplementedError(
      `${family.parameterName} ${String(kappa)}: NASA TR R-100 Figure 12 has no pressure drag data outside ${String(first[0])} to ${String(last[0])} (Niskanen Appendix B.3)`,
    );
  }
  for (let i = 1; i < family.members.length; i += 1) {
    const lo = family.members[i - 1];
    const hi = family.members[i];
    if (lo === undefined || hi === undefined) continue;
    if (kappa === lo[0]) return { curves: [{ name: lo[1], weight: 1 }] };
    if (kappa === hi[0]) return { curves: [{ name: hi[1], weight: 1 }] };
    if (kappa < hi[0]) {
      const w = (kappa - lo[0]) / (hi[0] - lo[0]);
      return {
        curves: [
          { name: lo[1], weight: 1 - w },
          { name: hi[1], weight: w },
        ],
      };
    }
  }
  throw new Error('unreachable');
}

/**
 * DRAG-16. Eq. (B.9) p. 110: C = C₀ (C₃/C₀)^{log₄(f_N + 1)}, C₀ the blunt
 * cylinder value of eq. (B.2) at this Mach number and C₃ the measured value
 * at fineness ratio 3. At f_N = 3 the exponent is 1 and C = C₃.
 */
function finenessScaling(c0Blunt: number, c3: number, finenessRatio: number): number {
  const exponent = Math.log(finenessRatio + 1) / Math.log(4);
  return c0Blunt * (c3 / c0Blunt) ** exponent;
}

/**
 * DRAG-15 to DRAG-17 for the shapes of Appendix B.3. Returns the transonic
 * and supersonic value C(M) of eq. (B.9) for M at or above the first data
 * point of every curve the nose uses, else undefined.
 */
function stoneyTransonic(
  blend: CurveBlend,
  finenessRatio: number,
  M: number,
): { value: number; held: boolean } | undefined {
  let c3 = 0;
  let held = false;
  for (const { name, weight } of blend.curves) {
    const curve = STONEY_NOSES[name];
    const v = curveValue(curve, M);
    if (v === undefined) return undefined;
    const lastPoint = curve.points[curve.points.length - 1];
    if (lastPoint !== undefined && M > lastPoint[0]) held = true;
    c3 += weight * v;
  }
  const value = finenessScaling(stagnationDragCoefficient(mach(M)), c3, finenessRatio);
  return { value, held };
}

/**
 * Right-hand derivative dC/dM of eq. (B.9) at M (DRAG-16): with e = log₄(f_N + 1),
 * C = C₀^(1−e) C₃^e, so dC/dM = C [(1 − e) C₀′/C₀ + e C₃′/C₃], C₀′ = 0.85 d(q_stag/q)/dM
 * and C₃′ the slope of the data segment. Requires C₃ > 0.
 */
function stoneySlope(blend: CurveBlend, finenessRatio: number, M: number): number {
  let c3 = 0;
  let c3Slope = 0;
  for (const { name, weight } of blend.curves) {
    const curve = STONEY_NOSES[name];
    const v = curveValue(curve, M);
    if (v === undefined) throw new Error('unreachable: slope below the data');
    c3 += weight * v;
    c3Slope += weight * curveSlope(curve, M);
  }
  const c0Blunt = stagnationDragCoefficient(mach(M));
  const c0Slope = 0.85 * stagnationPressureRatioSlope(M);
  const e = Math.log(finenessRatio + 1) / Math.log(4);
  const c = finenessScaling(c0Blunt, c3, finenessRatio);
  return c * (((1 - e) * c0Slope) / c0Blunt + (e * c3Slope) / c3);
}

/** The Mach number of the first data point shared by every curve of the blend. */
function dataStart(blend: CurveBlend): number {
  let start = 0;
  for (const { name } of blend.curves) {
    const first = STONEY_NOSES[name].points[0];
    if (first !== undefined && first[0] > start) start = first[0];
  }
  return start;
}

/** The uncertainty the nose inherits: the largest of its curves' (D-055). */
function dataUncertainty(blend: CurveBlend): number {
  let u = 0;
  for (const { name } of blend.curves) u = Math.max(u, STONEY_NOSES[name].uncertainty);
  return u;
}

/** Shape parameter defaults as in `noseProfile` (GEO-3 to GEO-6). */
function defaultParameter(shape: 'parabolic' | 'power' | 'haack'): number {
  switch (shape) {
    case 'parabolic':
      return 1;
    case 'power':
      return 0.5;
    case 'haack':
      return 0;
  }
}

/**
 * DRAG-6 to DRAG-8. Nose cone pressure drag referred to the base area.
 * `jointAngle` is φ of eq. (3.86) (the angle between the surface at the
 * base and the body); `finenessRatio` f_N = L/d; `shapeParameter` κ.
 */
export function noseConePressureDrag(
  shape: NoseShape,
  shapeParameter: number | undefined,
  finenessRatio: number,
  jointAngle: number,
  mach: Mach,
): NosePressureDrag {
  const M: number = mach;
  requireMach(M);
  if (!(finenessRatio > 0))
    throw new InvalidInputError('nose fineness ratio', finenessRatio, 'must be greater than 0');
  if (!(jointAngle >= 0 && jointAngle <= Math.PI / 2)) {
    throw new InvalidInputError('nose joint angle', jointAngle, 'must be between 0 and 90 degrees');
  }
  const warnings: string[] = [];
  // Eq. (3.86) p. 47.
  const c0 = 0.8 * Math.sin(jointAngle) ** 2;
  if (finenessRatio < 0.5) {
    warnings.push(
      'nose cone shorter than half its diameter: eq. (3.86) does not cover extremely blunt noses (Niskanen p. 47)',
    );
  }
  if (shape === 'conical' || shape === 'ogive') {
    // B.3: tan ε = 1/(2 f_N). Ogives use the conical value with the B.8 shape factor.
    const sinE = Math.sin(Math.atan(1 / (2 * finenessRatio)));
    let factor = 1;
    if (shape === 'ogive') {
      const k = shapeParameter ?? 1;
      factor = 0.72 * (k - 0.5) ** 2 + 0.82;
    }
    if (M >= 1.3)
      return {
        cd: finiteResult('nose pressure drag', factor * conicalTransonic(sinE, M)),
        method: 'conical-supersonic',
        warnings,
      };
    if (M >= 1)
      return {
        cd: finiteResult('nose pressure drag', factor * conicalTransonic(sinE, M)),
        method: 'conical-transonic',
        warnings,
      };
    // Lower bound of the transonic method: M = 1 (B.6 value, B.5 slope), scaled by the ogive factor.
    const ct = factor * sinE;
    const slope = factor * (4 / (GAMMA_AIR + 1)) * (1 - 0.5 * sinE);
    return {
      cd: finiteResult('nose pressure drag', subsonicInterpolation(M, c0, 1, ct, slope)),
      method: 'subsonic-interpolation',
      warnings,
    };
  }
  // Elliptical, parabolic, power and Haack series: Appendix B.3 (B.5 "other
  // shapes", p. 110) with Stoney's measured curves (DRAG-15 to DRAG-17).
  const kappa = shape === 'elliptical' ? 0 : (shapeParameter ?? defaultParameter(shape));
  if (shape === 'power' && kappa === 1) {
    // x^1 is a cone: the conical method applies to the geometry (D-055).
    return noseConePressureDrag('conical', undefined, finenessRatio, jointAngle, mach);
  }
  if (shape === 'parabolic' && kappa === 0) {
    return noseConePressureDrag('conical', undefined, finenessRatio, jointAngle, mach);
  }
  const blend = selectCurves(shape, kappa);
  const start = dataStart(blend);
  const dataWarning = `${shape} nose: transonic and supersonic pressure drag from NASA TR R-100 Figure 12 (fineness ratio 3, digitised, reading uncertainty ±${dataUncertainty(blend).toFixed(3)} in C_D,N) scaled to the nose by Niskanen eq. (B.9); D-055`;
  const transonic = stoneyTransonic(blend, finenessRatio, M);
  if (transonic !== undefined) {
    warnings.push(dataWarning);
    if (transonic.held) {
      warnings.push(
        `${shape} nose: beyond the end of the TR R-100 data the last measured value is held (D-055)`,
      );
    }
    if (transonic.value < c0) {
      // The scaled data lie below the low-speed value of eq. (3.86) (within the
      // reading floor); the drag never falls below the low-speed value (D-055).
      return {
        cd: finiteResult('nose pressure drag', c0),
        method: 'low-subsonic-constant',
        warnings,
      };
    }
    return {
      cd: finiteResult('nose pressure drag', transonic.value),
      method: transonic.held ? 'stoney-data-held' : 'stoney-data',
      warnings,
    };
  }
  // Below the data: eq. (3.87) matched to the value and the right-hand slope
  // of the scaled data at their first point (B.5 p. 109). When the first
  // point is not above the low-speed value the rise has nothing to fit and
  // the low-speed value is kept (D-055).
  const at = stoneyTransonic(blend, finenessRatio, start);
  if (at === undefined) throw new Error('unreachable: data start');
  if (start > 1) {
    warnings.push(
      `${shape} nose: the TR R-100 data for this shape begin at Mach ${String(start)}; the subsonic rise of eq. (3.87) is fitted from there and may overestimate the pressure drag below Mach 1 (D-055)`,
    );
  }
  if (!(at.value > c0)) {
    return {
      cd: finiteResult('nose pressure drag', c0),
      method: 'low-subsonic-constant',
      warnings,
    };
  }
  const slope = stoneySlope(blend, finenessRatio, start);
  return {
    cd: finiteResult('nose pressure drag', subsonicInterpolation(M, c0, start, at.value, slope)),
    method: 'subsonic-interpolation',
    warnings,
  };
}

/**
 * DRAG-9, shoulder (p. 48): the nose rule with the reference area
 * π(r_aft² − r_fore²); the joint is the aft end of the shoulder. The fineness
 * ratio for the conical formulas uses the half-apex angle of the shoulder,
 * tan ε = (r_aft − r_fore)/l. A warning is issued in transonic flight (p. 48).
 */
export function shoulderPressureDrag(
  shape: NoseShape,
  shapeParameter: number | undefined,
  length: number,
  foreRadius: number,
  aftRadius: number,
  jointAngle: number,
  mach: Mach,
): NosePressureDrag {
  if (!(aftRadius > foreRadius)) {
    throw new InvalidInputError(
      'shoulder radii',
      { foreRadius, aftRadius },
      'a shoulder must widen towards the aft end',
    );
  }
  const equivalentFineness = length / (2 * (aftRadius - foreRadius));
  const r = noseConePressureDrag(shape, shapeParameter, equivalentFineness, jointAngle, mach);
  const M: number = mach;
  const warnings = [...r.warnings];
  if (M >= 0.8) {
    warnings.push(
      'shoulder pressure drag above Mach 0.8 uses the nose cone assumption; Niskanen p. 48 warns that it is dubious at supersonic speeds',
    );
  }
  return { cd: r.cd, method: r.method, warnings };
}

/**
 * DRAG-11 base drag coefficient (needed by the boat tail), eq. (3.94) p. 50:
 * 0.12 + 0.13 M² for M < 1, 0.25/M for M ≥ 1 (continuous at M = 1).
 */
export function baseDragCoefficient(mach: Mach): number {
  const M: number = mach;
  requireMach(M);
  return finiteResult('base drag coefficient', M < 1 ? 0.12 + 0.13 * M * M : 0.25 / M);
}

export interface BoatTailPressureDrag {
  /** Referred to the annulus π(r_fore² − r_aft²) (D-032). */
  readonly cd: number;
  /** γ = l/(d₁ − d₂). */
  readonly lengthToHeight: number;
  readonly warnings: readonly string[];
}

/**
 * DRAG-9, boat tail, eq. (3.88) p. 49: (C_D•)base × {1 if γ < 1; (3 − γ)/2
 * if 1 ≤ γ ≤ 3; 0 if γ > 3}, γ = l/(d₁ − d₂). The area ratio A_base/A_boattail
 * of the printed equation is taken as 1 (D-032). A warning is issued in
 * transonic flight (p. 49).
 */
export function boatTailPressureDrag(
  length: number,
  foreRadius: number,
  aftRadius: number,
  mach: Mach,
): BoatTailPressureDrag {
  if (!(foreRadius > aftRadius)) {
    throw new InvalidInputError(
      'boat tail radii',
      { foreRadius, aftRadius },
      'a boat tail must narrow towards the aft end',
    );
  }
  if (!(length > 0))
    throw new InvalidInputError('boat tail length', length, 'must be greater than 0 m');
  const gamma = length / (2 * (foreRadius - aftRadius));
  const factor = gamma < 1 ? 1 : gamma > 3 ? 0 : (3 - gamma) / 2;
  const M: number = mach;
  const warnings: string[] = [];
  if (M >= 0.8)
    warnings.push(
      'boat tail pressure drag in transonic or supersonic flight uses the subsonic estimate of eq. (3.88); Niskanen p. 49 warns about expansion fans',
    );
  return {
    cd: finiteResult('boat tail pressure drag', baseDragCoefficient(mach) * factor),
    lengthToHeight: gamma,
    warnings,
  };
}
