/**
 * Pressure drag of body components (plan 0009, DRAG-5 to DRAG-9).
 *
 * Sources: Niskanen (2009) §3.4.3 pp. 46 to 49 and Appendix B pp. 106 to
 * 110. Every coefficient here is referred to the component's own reference
 * area (its frontal area, p. 41) and must be scaled by the caller (eq. 3.75).
 */
import { InvalidInputError, NotImplementedError } from '../errors.js';
import type { NoseShape } from '../geometry/profiles.js';
import { finiteResult } from '../numerics/finite.js';
import type { Mach } from '../units/si.js';

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
    'low-subsonic-constant' | 'subsonic-interpolation' | 'conical-transonic' | 'conical-supersonic';
  readonly warnings: readonly string[];
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
  // Elliptical, parabolic, power and Haack series: Appendix B.3 takes the
  // transonic drag from Stoney's measured curves, which the thesis does not
  // reproduce. Above Mach 0.8 nothing can be computed from the approved
  // text; below it the low-subsonic value of eq. (3.86) is returned with a
  // warning that the rise towards the transonic value (eq. 3.87) is missing (D-034).
  if (M > 0.8) {
    throw new NotImplementedError(
      `pressure drag of a ${shape} nose cone at Mach ${String(M)}: Niskanen Appendix B.3 uses Stoney's measured curves (NASA TR R-100), not yet transcribed`,
    );
  }
  warnings.push(
    `${shape} nose: the subsonic rise of pressure drag towards the transonic value (eq. 3.87) is not included because the transonic data of Appendix B.3 are not transcribed; eq. (3.86) low-speed value used (D-034)`,
  );
  return { cd: finiteResult('nose pressure drag', c0), method: 'low-subsonic-constant', warnings };
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
