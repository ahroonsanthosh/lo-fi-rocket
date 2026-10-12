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
 * different constants"). With a launch latitude the WGS 84 ellipsoidal
 * gravity formula gives the value instead (GRAV-2, GRAV-3, D-060).
 * Tolerance: a handful of operations; a few ulp.
 */
import { InvalidInputError } from '../errors.js';
import { finiteResult } from '../numerics/finite.js';
import {
  metresPerSecondSquared,
  type Metres,
  type MetresPerSecondSquared,
  type Radians,
} from '../units/si.js';

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

/**
 * WGS 84 constants, NGA.STND.0036_1.0.0_WGS84 (2014): Table 3.1 (printed
 * p. 3-5) a and 1/f; Table 3.5 (p. 3-8) e²; Table 3.6 (p. 3-9) γ_e, γ_p, k, m.
 */
export const WGS84 = {
  semiMajorAxis: 6378137.0,
  flattening: 1 / 298.257223563,
  firstEccentricitySquared: 6.694379990141e-3,
  normalGravityEquator: 9.7803253359,
  normalGravityPole: 9.8321849379,
  somiglianaK: 1.931852652458e-3,
  normalGravityFormulaM: 3.449786506841e-3,
} as const;

/**
 * GRAV-2. NGA.STND.0036 eq. (4-1), printed p. 4-1: Somigliana's closed
 * formula for normal gravity on the ellipsoid,
 * γ = γ_e (1 + k sin²φ)/√(1 − e² sin²φ), φ the geodetic latitude.
 */
export function wgs84NormalGravity(latitude: Radians): MetresPerSecondSquared {
  const phi: number = latitude;
  if (!Number.isFinite(phi) || Math.abs(phi) > Math.PI / 2) {
    throw new InvalidInputError('latitude', phi, 'must be between −90° and 90° (in radians)');
  }
  const s2 = Math.sin(phi) ** 2;
  return metresPerSecondSquared(
    finiteResult(
      'normal gravity',
      (WGS84.normalGravityEquator * (1 + WGS84.somiglianaK * s2)) /
        Math.sqrt(1 - WGS84.firstEccentricitySquared * s2),
    ),
  );
}

/**
 * GRAV-3. NGA.STND.0036 eq. (4-3), printed p. 4-3: the truncated Taylor
 * series for normal gravity at geodetic height h above the ellipsoid,
 * γ_h = γ [1 − (2/a)(1 + f + m − 2f sin²φ) h + (3/a²) h²], stated for small
 * h (the document recommends its ellipsoidal method at moderate and high
 * heights). The altitude above mean sea level is used as h (D-060).
 */
export function wgs84NormalGravityAbove(latitude: Radians, height: Metres): MetresPerSecondSquared {
  const gamma: number = wgs84NormalGravity(latitude);
  const h: number = height;
  if (!Number.isFinite(h)) throw new InvalidInputError('height', h, 'must be finite');
  const s2 = Math.sin(latitude) ** 2;
  const a = WGS84.semiMajorAxis;
  const f = WGS84.flattening;
  const m = WGS84.normalGravityFormulaM;
  return metresPerSecondSquared(
    finiteResult(
      'normal gravity above the ellipsoid',
      gamma * (1 - (2 / a) * (1 + f + m - 2 * f * s2) * h + (3 / (a * a)) * h * h),
    ),
  );
}

export interface ParameterGravityModel {
  /** g at mean sea level (Z = 0). */
  readonly seaLevel: MetresPerSecondSquared;
  /** 'inverse-square': GRAV-1; 'constant': g = seaLevel at every altitude (for analytical test cases). */
  readonly altitudeDependence: 'inverse-square' | 'constant';
}

/** WGS 84 normal gravity at the launch latitude (GRAV-2) and its height series (GRAV-3). */
export interface Wgs84GravityModel {
  readonly altitudeDependence: 'wgs84';
  readonly latitude: Radians;
}

export type GravityModel = ParameterGravityModel | Wgs84GravityModel;

/** The sea-level value of a model (for the result's record of modes). */
export function seaLevelGravity(model: GravityModel): MetresPerSecondSquared {
  return model.altitudeDependence === 'wgs84' ? wgs84NormalGravity(model.latitude) : model.seaLevel;
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
  if (model.altitudeDependence === 'wgs84') {
    return wgs84NormalGravityAbove(model.latitude, altitudeAboveSeaLevel);
  }
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
