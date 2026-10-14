/**
 * Three-component vectors in metres, metres per second, newtons, or any
 * other unit the caller tracks. Plain definitions of vector algebra; no
 * physics. Components are plain numbers (branding is applied by the
 * records that hold vectors, docs/conventions.md).
 */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const ZERO3: Vec3 = { x: 0, y: 0, z: 0 };

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}
export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
export function scale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}
export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
export function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
export function norm(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}
/** Unit vector; returns undefined for the zero vector (the caller decides what that means). */
export function normalise(a: Vec3): Vec3 | undefined {
  const n = norm(a);
  if (n === 0) return undefined;
  // Plan 0065: below 2⁻⁵⁰⁰ (down to the subnormal numbers) 1/n can overflow; the direction is the
  // same after an exact power-of-two scaling, whose norm is taken afresh.
  if (n < 2 ** -500) {
    const b = scale(a, 2 ** 600);
    return scale(b, 1 / norm(b));
  }
  return scale(a, 1 / n);
}
export function isFiniteVec3(a: Vec3): boolean {
  return Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z);
}
