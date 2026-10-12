/**
 * Frames, orientation conventions and flight parameters (plan 0008,
 * DYN-6 to DYN-8). The conventions are fixed in docs/conventions.md.
 *
 * Sources: Niskanen (2009) §4.2 and §4.2.1 pp. 60 to 62 (world frame with
 * z up at the launch position, flat Earth, rocket frame of chapter 3,
 * reference orientation with the nose along +z); §4.2.4 p. 65 (airspeed =
 * rocket velocity plus local wind, rotated into rocket coordinates, then
 * the angle of attack); §2.4 p. 11 (angle of attack: between the rocket
 * centreline and the velocity); eq. (3.11) p. 18 (Mach number M = v₀/c);
 * §3.1.1 p. 16 (dynamic pressure q = ½ρv₀²); eq. (3.12) p. 19 (Reynolds
 * number R = v₀L/ν); Table 3.1 p. 19 (velocity regions).
 */
import { InvalidInputError } from '../errors.js';
import { finiteResult } from '../numerics/finite.js';
import {
  mach,
  pascals,
  radians,
  type Mach,
  type Metres,
  type Pascals,
  type Radians,
} from '../units/si.js';
import {
  quaternionFromAxisAngle,
  quaternionMultiply,
  rotateVector,
  rotateVectorInverse,
  type Quaternion,
} from './quaternion.js';
import { cross, dot, norm, normalise, sub, vec3, type Vec3 } from './vector.js';

/** World frame unit vectors: East, North, Up (DYN-6, docs/conventions.md). */
export const EAST: Vec3 = vec3(1, 0, 0);
export const NORTH: Vec3 = vec3(0, 1, 0);
export const UP: Vec3 = vec3(0, 0, 1);

/** Body frame: x aft from the nose tip; the nose direction is −x. */
export const BODY_AFT: Vec3 = vec3(1, 0, 0);
export const BODY_NOSE: Vec3 = vec3(-1, 0, 0);

/**
 * Reference orientation (Niskanen p. 62: "the rocket pointing towards the
 * positive z-axis"): a rotation by +90° about the body y axis, which sends
 * body +x (aft) to world −z, body y to north and body z to east.
 */
export const REFERENCE_ORIENTATION: Quaternion = quaternionFromAxisAngle(
  vec3(0, 1, 0),
  Math.PI / 2,
);

/**
 * Unit vector along a launch rail tilted by `angleFromVertical` towards the
 * compass azimuth `azimuth` (clockwise from north): (sin θ sin ψ, sin θ cos ψ, cos θ).
 */
export function railDirection(angleFromVertical: Radians, azimuth: Radians): Vec3 {
  const th: number = angleFromVertical;
  const psi: number = azimuth;
  if (!(th >= 0 && th < Math.PI / 2)) {
    throw new InvalidInputError('rail angle from vertical', th, 'must be between 0 and 90 degrees');
  }
  if (!Number.isFinite(psi)) throw new InvalidInputError('rail azimuth', psi, 'must be finite');
  return vec3(Math.sin(th) * Math.sin(psi), Math.sin(th) * Math.cos(psi), Math.cos(th));
}

/**
 * Initial orientation on the rail: q₀ = q_tilt · q_ref, where q_tilt rotates
 * world +z onto the rail direction about the axis ẑ × d̂ (eq. 4.13). With a
 * vertical rail q₀ = q_ref.
 */
export function initialOrientation(angleFromVertical: Radians, azimuth: Radians): Quaternion {
  const d = railDirection(angleFromVertical, azimuth);
  const axis = normalise(cross(UP, d));
  if (axis === undefined) return REFERENCE_ORIENTATION;
  const tilt = quaternionFromAxisAngle(axis, Math.atan2(norm(cross(UP, d)), dot(UP, d)));
  return quaternionMultiply(tilt, REFERENCE_ORIENTATION);
}

/** Body vector to world vector (DYN-4, eq. 4.14). */
export function bodyToWorld(orientation: Quaternion, v: Vec3): Vec3 {
  return rotateVector(orientation, v);
}
/** World vector to body vector (DYN-4, eq. 4.15). */
export function worldToBody(orientation: Quaternion, v: Vec3): Vec3 {
  return rotateVectorInverse(orientation, v);
}

/** The nose direction in world coordinates. */
export function noseDirection(orientation: Quaternion): Vec3 {
  return bodyToWorld(orientation, BODY_NOSE);
}

/** Velocity regions of Table 3.1 p. 19. */
export type VelocityRegion = 'subsonic' | 'transonic' | 'supersonic' | 'hypersonic';

export function velocityRegion(m: Mach): VelocityRegion {
  const v: number = m;
  if (v < 0.8) return 'subsonic';
  if (v < 1.2) return 'transonic';
  if (v < 5) return 'supersonic';
  return 'hypersonic';
}

export interface FlightParameters {
  /** Airspeed vector in world coordinates: rocket velocity minus wind. */
  readonly airspeedWorld: Vec3;
  /** The same in body coordinates. */
  readonly airspeedBody: Vec3;
  /** |airspeed|, m/s. */
  readonly airspeed: number;
  /** Angle between the nose direction and the airspeed, 0 to π (0 when the airspeed is zero). */
  readonly angleOfAttack: Radians;
  /**
   * Direction of the lateral airflow in the body (y, z) plane, from +y
   * towards +z; the roll angle θ of BAR-7 when fin 1 lies in the +y
   * half-plane. 0 when there is no lateral component.
   */
  readonly lateralAirflowAngle: Radians;
  readonly mach: Mach;
  readonly region: VelocityRegion;
  /** q = ½ ρ v₀², Pa. */
  readonly dynamicPressure: Pascals;
  /** Reynolds number R = v₀ L/ν for the given length. */
  readonly reynolds: number;
}

export interface FlightParameterInputs {
  readonly velocityWorld: Vec3;
  readonly windWorld: Vec3;
  readonly orientation: Quaternion;
  /** Local air density ρ, kg/m³. */
  readonly density: number;
  /** Local speed of sound c, m/s. */
  readonly speedOfSound: number;
  /** Local kinematic viscosity ν, m²/s. */
  readonly kinematicViscosity: number;
  /** Characteristic length for the Reynolds number (the rocket length, p. 19). */
  readonly referenceLength: Metres;
}

/** DYN-7, DYN-8. */
export function flightParameters(input: FlightParameterInputs): FlightParameters {
  const { density, speedOfSound, kinematicViscosity } = input;
  const L: number = input.referenceLength;
  if (!(density > 0))
    throw new InvalidInputError('air density', density, 'must be greater than 0 kg/m³');
  if (!(speedOfSound > 0)) {
    throw new InvalidInputError('speed of sound', speedOfSound, 'must be greater than 0 m/s');
  }
  if (!(kinematicViscosity > 0)) {
    throw new InvalidInputError(
      'kinematic viscosity',
      kinematicViscosity,
      'must be greater than 0 m²/s',
    );
  }
  if (!(L > 0)) throw new InvalidInputError('reference length', L, 'must be greater than 0 m');
  const airspeedWorld = sub(input.velocityWorld, input.windWorld);
  const airspeedBody = worldToBody(input.orientation, airspeedWorld);
  const v0 = finiteResult('airspeed', norm(airspeedWorld));
  // Nose-forward component is −x in the body frame; lateral is (y, z).
  const axial = -airspeedBody.x;
  const lateral = Math.hypot(airspeedBody.y, airspeedBody.z);
  const alpha = v0 === 0 ? 0 : Math.atan2(lateral, axial);
  const lateralAngle = lateral === 0 ? 0 : Math.atan2(airspeedBody.z, airspeedBody.y);
  const m = v0 / speedOfSound;
  return {
    airspeedWorld,
    airspeedBody,
    airspeed: v0,
    angleOfAttack: radians(finiteResult('angle of attack', alpha)),
    lateralAirflowAngle: radians(finiteResult('lateral airflow angle', lateralAngle)),
    mach: mach(finiteResult('Mach number', m)),
    region: velocityRegion(mach(m)),
    dynamicPressure: pascals(finiteResult('dynamic pressure', 0.5 * density * v0 * v0)),
    reynolds: finiteResult('Reynolds number', (v0 * L) / kinematicViscosity),
  };
}
