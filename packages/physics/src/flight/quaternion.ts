/**
 * Unit quaternions for orientation (plan 0008, DYN-1 to DYN-5).
 *
 * Source: Niskanen (2009) §4.2.2, pp. 62 to 63, and eq. (4.24) p. 67.
 * q = w + xi + yj + zk (eq. 4.8). A unit quaternion rotates a vector by
 * v ↦ q v q⁻¹ (eq. 4.14); the inverse rotation is q⁻¹ v q (eq. 4.15).
 * Tolerance: products and rotations are a few multiplications and
 * additions each, a few ulp; `normalise` is applied by the integrator
 * after each update as the thesis does (p. 67).
 */
import { InvalidInputError } from '../errors.js';
import { finiteResult } from '../numerics/finite.js';
import { cross, dot, norm, scale, type Vec3 } from './vector.js';

export interface Quaternion {
  readonly w: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const IDENTITY_QUATERNION: Quaternion = { w: 1, x: 0, y: 0, z: 0 };

/** DYN-1. Niskanen eq. (4.11), p. 63: the Hamilton product a·b (non-commutative). */
export function quaternionMultiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

/** DYN-2. Niskanen eq. (4.12), p. 63. */
export function quaternionNorm(q: Quaternion): number {
  return Math.hypot(q.w, q.x, q.y, q.z);
}

/** DYN-2. Niskanen eq. (4.16), p. 63: for a unit quaternion the inverse is the conjugate. */
export function quaternionConjugate(q: Quaternion): Quaternion {
  return { w: q.w, x: -q.x, y: -q.y, z: -q.z };
}

/** Scale to unit norm (p. 67: "the quaternion is normalized to unit length"). */
export function quaternionNormalise(q: Quaternion): Quaternion {
  const n = quaternionNorm(q);
  if (!(n > 0) || !Number.isFinite(n)) {
    throw new InvalidInputError('quaternion norm', n, 'must be a positive finite number');
  }
  return { w: q.w / n, x: q.x / n, y: q.y / n, z: q.z / n };
}

/**
 * DYN-3. Niskanen eq. (4.13), p. 63: the rotation by angle φ about the
 * unit axis u is q = cos(φ/2) + u sin(φ/2). The axis must be a unit vector
 * (within 1e-9), as the equation requires.
 */
export function quaternionFromAxisAngle(axis: Vec3, angle: number): Quaternion {
  const n = norm(axis);
  if (!(Math.abs(n - 1) <= 1e-9)) {
    throw new InvalidInputError('rotation axis length', n, 'must be a unit vector');
  }
  if (!Number.isFinite(angle))
    throw new InvalidInputError('rotation angle', angle, 'must be finite');
  const s = Math.sin(angle / 2);
  return { w: Math.cos(angle / 2), x: axis.x * s, y: axis.y * s, z: axis.z * s };
}

/** DYN-4. Niskanen eq. (4.14), p. 63: v ↦ q v q⁻¹ with v as a pure quaternion. */
export function rotateVector(q: Quaternion, v: Vec3): Vec3 {
  const p: Quaternion = { w: 0, x: v.x, y: v.y, z: v.z };
  const r = quaternionMultiply(quaternionMultiply(q, p), quaternionConjugate(q));
  return {
    x: finiteResult('rotated vector x', r.x),
    y: finiteResult('rotated vector y', r.y),
    z: finiteResult('rotated vector z', r.z),
  };
}

/** DYN-4. Niskanen eq. (4.15), p. 63: the inverse rotation v ↦ q⁻¹ v q. */
export function rotateVectorInverse(q: Quaternion, v: Vec3): Vec3 {
  return rotateVector(quaternionConjugate(q), v);
}

/**
 * DYN-5. Niskanen eq. (4.24), p. 67: the orientation is advanced by the
 * unit quaternion of the rotation ω Δt, "as in equation (4.13)", applied
 * from the left. Eq. (4.13) gives cos(φ/2) + u sin(φ/2) for a rotation by
 * φ, so for φ = |ω|Δt the factor is cos(|ω|Δt/2) + ω̂ sin(|ω|Δt/2). The
 * printed eq. (4.24) omits the halves; the test "a 90° rotation about z"
 * shows that eq. (4.13) rotates by exactly φ, so the printed form would
 * rotate by twice the angle. Eq. (4.13) is followed (D-031).
 */
export function rotationFromAngularVelocity(omega: Vec3, dt: number): Quaternion {
  if (!Number.isFinite(dt)) throw new InvalidInputError('time step', dt, 'must be finite');
  const w = norm(omega);
  if (!Number.isFinite(w)) throw new InvalidInputError('angular velocity', omega, 'must be finite');
  if (w === 0) return IDENTITY_QUATERNION;
  // Plan 0065: below 2⁻⁵⁰⁰ rad/s (a roll rate decaying to nothing, down to the subnormal numbers)
  // 1/w can overflow; the axis is the same after an exact power-of-two scaling of ω.
  // The scaled vector's norm is taken afresh: a subnormal w carries too few bits for the axis.
  const scaled = w >= 2 ** -500 ? omega : scale(omega, 2 ** 600);
  const axis = scale(scaled, 1 / (scaled === omega ? w : norm(scaled)));
  return quaternionFromAxisAngle(axis, w * dt);
}

/** Apply eq. (4.24): o₁ = normalise(rotation · o₀). */
export function advanceOrientation(o: Quaternion, omega: Vec3, dt: number): Quaternion {
  return quaternionNormalise(quaternionMultiply(rotationFromAngularVelocity(omega, dt), o));
}

/** The rotation that takes unit vector `from` to unit vector `to` by the shortest arc (eq. 4.13 with axis from × to). */
export function quaternionBetween(from: Vec3, to: Vec3): Quaternion {
  const nf = norm(from);
  const nt = norm(to);
  if (!(Math.abs(nf - 1) <= 1e-9) || !(Math.abs(nt - 1) <= 1e-9)) {
    throw new InvalidInputError('vector lengths', [nf, nt], 'must both be unit vectors');
  }
  const c = Math.min(1, Math.max(-1, dot(from, to)));
  const axis = cross(from, to);
  const s = norm(axis);
  if (s < 1e-12) {
    if (c > 0) return IDENTITY_QUATERNION;
    throw new InvalidInputError(
      'rotation',
      [from, to],
      'opposite vectors have no unique shortest rotation',
    );
  }
  return quaternionFromAxisAngle(scale(axis, 1 / s), Math.atan2(s, c));
}
