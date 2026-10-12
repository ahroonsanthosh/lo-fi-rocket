/**
 * Gravity for the flight simulator (plan 0008, GRAV-1 and GRAV-C).
 *
 * Source of the altitude dependence: U.S. Standard Atmosphere, 1976, eq. (17)
 * printed p. 8 (PDF p. 24): g = g₀ (r₀/(r₀ + Z))², "the inverse-square law
 * of gravitation provides an expression for g as a function of altitude with
 * sufficient accuracy for most model-atmosphere computations", with r₀ =
 * 6 356 766 m, the effective radius of the Earth at a specific latitude
 * (Lambert's equations), consistent with g₀ = 9.80665 m/s².
 *
 * The sea-level value is a parameter of the model (D-030): the atmosphere
 * module's g₀ is never read here (docs/conventions.md, "Gravity: two
 * different constants"), and no latitude formula is implemented because
 * none is in an approved source. Tolerance: one division, one square, one
 * multiplication; a few ulp.
 */
import { InvalidInputError } from '../errors.js';
import { finiteResult } from '../numerics/finite.js';
import { metresPerSecondSquared, type Metres, type MetresPerSecondSquared } from '../units/si.js';

/** Standard acceleration due to gravity g_n, SI Brochure 9th ed., App. 1, 3rd CGPM 1901 declaration 3, p. 154. */
export const STANDARD_GRAVITY: MetresPerSecondSquared = metresPerSecondSquared(9.80665);

/**
 * The sea-level value OpenRocket 24.12 used for the reference flights at
 * latitude 45° (reference/rockets/settings.md, printed by the harness).
 * An observation of a black box, for like-for-like comparisons only (D-018).
 */
export const OPENROCKET_REFERENCE_GRAVITY_45N: MetresPerSecondSquared =
  metresPerSecondSquared(9.8061992025);

/** r₀ of USSA76 eq. (17), p. 8: 6 356 766 m. Kept separate from the atmosphere module's copy on purpose. */
export const GRAVITY_EFFECTIVE_EARTH_RADIUS: Metres = 6356766 as Metres;

export interface GravityModel {
  /** g at mean sea level (Z = 0). */
  readonly seaLevel: MetresPerSecondSquared;
  /** 'inverse-square': GRAV-1; 'constant': g = seaLevel at every altitude (for analytical test cases). */
  readonly altitudeDependence: 'inverse-square' | 'constant';
}

export const STANDARD_GRAVITY_MODEL: GravityModel = {
  seaLevel: STANDARD_GRAVITY,
  altitudeDependence: 'inverse-square',
};

/** GRAV-1. Magnitude of g at geometric altitude Z above mean sea level; the direction is world −z (DYN-6). */
export function gravityAt(
  model: GravityModel,
  altitudeAboveSeaLevel: Metres,
): MetresPerSecondSquared {
  const g0: number = model.seaLevel;
  const z: number = altitudeAboveSeaLevel;
  if (!(g0 > 0) || !Number.isFinite(g0)) {
    throw new InvalidInputError('sea-level gravity', g0, 'must be a positive finite number');
  }
  if (!Number.isFinite(z)) throw new InvalidInputError('altitude', z, 'must be finite');
  if (model.altitudeDependence === 'constant') return model.seaLevel;
  const r0: number = GRAVITY_EFFECTIVE_EARTH_RADIUS;
  if (!(z > -r0))
    throw new InvalidInputError('altitude', z, 'must be above the centre of the Earth');
  const ratio = r0 / (r0 + z);
  return metresPerSecondSquared(finiteResult('gravity', g0 * ratio * ratio));
}
