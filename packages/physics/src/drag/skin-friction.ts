/**
 * Skin friction drag (plan 0009, DRAG-1 to DRAG-4).
 *
 * Source: Niskanen (2009) §3.4.1 to §3.4.2, pp. 41 to 46. A fully turbulent
 * boundary layer is assumed (p. 43: the partially laminar variant changed
 * apogee by under 5 % and was dropped). Tolerance: a few ulp per formula.
 */
import { InvalidInputError } from '../errors.js';
import { finiteResult } from '../numerics/finite.js';
import type { Mach, Metres } from '../units/si.js';

/**
 * Approximate roughness heights, Table 3.2 p. 44 (from Hoerner p. 5-3), plus
 * the values of Figure 3.10 p. 45. In metres. "regular paint" 60 µm is the
 * finish OpenRocket applied to the reference rockets (settings.md).
 */
export const ROUGHNESS_HEIGHTS = {
  averageGlass: 0.1e-6,
  finishedAndPolishedSurface: 0.5e-6,
  optimumPaintSprayedSurface: 5e-6,
  planedWoodenBoards: 15e-6,
  paintInAircraftMassProduction: 20e-6,
  smoothCementSurface: 50e-6,
  regularPaint60um: 60e-6,
  dipGalvanizedMetalSurface: 150e-6,
  incorrectlySprayedAircraftPaint: 200e-6,
  rawWoodenBoards: 500e-6,
  averageConcreteSurface: 1000e-6,
} as const;

export type SkinFrictionRegime = 'low-reynolds' | 'turbulent' | 'roughness-limited';

export interface SkinFriction {
  /** C_f, referred to the wetted area (eq. 3.77). */
  readonly cf: number;
  readonly regime: SkinFrictionRegime;
  /** R_crit of eq. (3.79). */
  readonly reynoldsCritical: number;
}

/**
 * DRAG-1, DRAG-2. Eq. (3.81) p. 44: C_f = 1.48·10⁻² for R < 10⁴; eq. (3.78)
 * 1/(1.50 ln R − 5.6)² for 10⁴ < R < R_crit; eq. (3.80) 0.032 (R_s/L)^0.2
 * above R_crit = 51 (R_s/L)^(−1.039) (eq. 3.79).
 */
export function skinFrictionCoefficient(
  reynolds: number,
  roughnessHeight: Metres,
  rocketLength: Metres,
): SkinFriction {
  const R = reynolds;
  const rs: number = roughnessHeight;
  const L: number = rocketLength;
  if (!(R >= 0) || !Number.isFinite(R)) {
    throw new InvalidInputError('Reynolds number', R, 'must be 0 or greater and finite');
  }
  if (!(rs > 0) || !Number.isFinite(rs)) {
    throw new InvalidInputError(
      'surface roughness height',
      rs,
      'must be greater than 0 m (Table 3.2 lists typical values)',
    );
  }
  if (!(L > 0)) throw new InvalidInputError('rocket length', L, 'must be greater than 0 m');
  const ratio = rs / L;
  const reynoldsCritical = 51 * ratio ** -1.039;
  if (R < 1e4) return { cf: 1.48e-2, regime: 'low-reynolds', reynoldsCritical };
  if (R > reynoldsCritical) {
    return {
      cf: finiteResult('roughness-limited skin friction', 0.032 * ratio ** 0.2),
      regime: 'roughness-limited',
      reynoldsCritical,
    };
  }
  const d = 1.5 * Math.log(R) - 5.6;
  return {
    cf: finiteResult('turbulent skin friction', 1 / (d * d)),
    regime: 'turbulent',
    reynoldsCritical,
  };
}

/**
 * DRAG-3. Compressibility, eqs. (3.82) to (3.84) p. 45: subsonic
 * C_fc = C_f (1 − 0.1 M²) for both regimes; supersonic turbulent
 * C_f/(1 + 0.15 M²)^0.58, roughness-limited C_f/(1 + 0.18 M²) but never
 * below the corrected turbulent value (p. 45). The low-Reynolds constant is
 * treated as the turbulent regime.
 */
export function compressibleSkinFriction(
  friction: SkinFriction,
  mach: Mach,
  reynolds: number,
): number {
  const M: number = mach;
  if (!(M >= 0) || !Number.isFinite(M))
    throw new InvalidInputError('Mach number', M, 'must be 0 or greater');
  if (M < 1) return finiteResult('compressible skin friction', friction.cf * (1 - 0.1 * M * M));
  if (friction.regime === 'roughness-limited') {
    const roughness = friction.cf / (1 + 0.18 * M * M);
    // The turbulent value at the same Reynolds number, eq. (3.78), corrected by eq. (3.83).
    const d = 1.5 * Math.log(Math.max(reynolds, 1e4)) - 5.6;
    const turbulent = 1 / (d * d) / (1 + 0.15 * M * M) ** 0.58;
    return finiteResult('compressible skin friction', Math.max(roughness, turbulent));
  }
  return finiteResult('compressible skin friction', friction.cf / (1 + 0.15 * M * M) ** 0.58);
}

export interface FrictionDragGeometry {
  /** Rocket length over maximum body diameter (p. 20). */
  readonly finenessRatio: number;
  /** Wetted area of the body, m². */
  readonly wettedBodyArea: number;
  /** Fin sets: wetted area (both sides, all fins), thickness and mean aerodynamic chord. */
  readonly finSets: readonly {
    readonly wettedArea: number;
    readonly thickness: number;
    readonly meanChord: number;
  }[];
  readonly referenceArea: number;
}

/**
 * DRAG-4. Eq. (3.85) p. 46: (C_D)friction = C_fc [(1 + 1/(2 f_B)) A_wet,body
 * + (1 + 2t/c̄) A_wet,fins]/A_ref. With several fin sets each set's thickness
 * correction applies to its own area (the thesis writes one fin set).
 */
export function frictionDragCoefficient(cfc: number, g: FrictionDragGeometry): number {
  if (!(g.finenessRatio > 0))
    throw new InvalidInputError('fineness ratio', g.finenessRatio, 'must be greater than 0');
  if (!(g.referenceArea > 0))
    throw new InvalidInputError('reference area', g.referenceArea, 'must be greater than 0 m²');
  let fins = 0;
  for (const f of g.finSets) {
    if (!(f.meanChord > 0))
      throw new InvalidInputError(
        'fin mean aerodynamic chord',
        f.meanChord,
        'must be greater than 0 m',
      );
    fins += (1 + (2 * f.thickness) / f.meanChord) * f.wettedArea;
  }
  const body = (1 + 1 / (2 * g.finenessRatio)) * g.wettedBodyArea;
  return finiteResult('friction drag coefficient', (cfc * (body + fins)) / g.referenceArea);
}
