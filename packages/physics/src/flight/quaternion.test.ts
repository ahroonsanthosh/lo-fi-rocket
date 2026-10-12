/** Quaternion and vector tests (plan 0008, DYN-1 to DYN-5), Niskanen §4.2.2. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import {
  advanceOrientation,
  IDENTITY_QUATERNION,
  quaternionBetween,
  quaternionConjugate,
  quaternionFromAxisAngle,
  quaternionMultiply,
  quaternionNorm,
  quaternionNormalise,
  rotateVector,
  rotateVectorInverse,
  rotationFromAngularVelocity,
  type Quaternion,
} from './quaternion.js';
import { add, cross, dot, norm, normalise, scale, sub, vec3, type Vec3 } from './vector.js';

const I: Quaternion = { w: 0, x: 1, y: 0, z: 0 };
const J: Quaternion = { w: 0, x: 0, y: 1, z: 0 };
const K: Quaternion = { w: 0, x: 0, y: 0, z: 1 };
const closeTo = (a: Vec3, b: Vec3, digits = 12): void => {
  expect(a.x).toBeCloseTo(b.x, digits);
  expect(a.y).toBeCloseTo(b.y, digits);
  expect(a.z).toBeCloseTo(b.z, digits);
};

describe('vector definitions', () => {
  it('add, sub, scale, dot, cross, norm, normalise by hand', () => {
    const a = vec3(1, 2, 3);
    const b = vec3(-2, 0, 4);
    expect(add(a, b)).toEqual(vec3(-1, 2, 7));
    expect(sub(a, b)).toEqual(vec3(3, 2, -1));
    expect(scale(a, 2)).toEqual(vec3(2, 4, 6));
    expect(dot(a, b)).toBe(10); // −2 + 0 + 12
    expect(cross(a, b)).toEqual(vec3(8, -10, 4)); // (2·4 − 3·0, 3·(−2) − 1·4, 1·0 − 2·(−2))
    expect(norm(vec3(3, 4, 12))).toBe(13);
    expect(normalise(vec3(0, 0, 0))).toBeUndefined();
    closeTo(normalise(vec3(0, 3, 4)) ?? vec3(0, 0, 0), vec3(0, 0.6, 0.8));
  });
});

describe('DYN-1, DYN-2 products and norm, eqs. (4.9) to (4.12), (4.16)', () => {
  it('ij = k, ji = −k, jk = i, ki = j, i² = −1', () => {
    expect(quaternionMultiply(I, J)).toEqual(K);
    expect(quaternionMultiply(J, I)).toEqual({ w: 0, x: 0, y: 0, z: -1 });
    expect(quaternionMultiply(J, K)).toEqual(I);
    expect(quaternionMultiply(K, I)).toEqual(J);
    expect(quaternionMultiply(I, I).w).toBe(-1);
  });
  it('eq. (4.11) by hand: (1 + 2i + 3j + 4k)(5 + 6i + 7j + 8k) = −60 + 12i + 30j + 24k', () => {
    // w: 5 − 12 − 21 − 32 = −60; x: 8 + 10 + 24 − 28 = 14?  Recompute per eq. (4.11):
    // (aw − bx − cy − dz) = 5 − 12 − 21 − 32 = −60
    // (ax + bw + cz − dy) = 6 + 10 + 24 − 28 = 12
    // (ay − bz + cw + dx) = 7 − 16 + 15 + 24 = 30
    // (az + by − cx + dw) = 8 + 14 − 18 + 20 = 24
    expect(quaternionMultiply({ w: 1, x: 2, y: 3, z: 4 }, { w: 5, x: 6, y: 7, z: 8 })).toEqual({
      w: -60,
      x: 12,
      y: 30,
      z: 24,
    });
  });
  it('norm √(1 + 4 + 9 + 16) = √30; conjugate; normalise; q q⁻¹ = 1 for a unit quaternion', () => {
    const q: Quaternion = { w: 1, x: 2, y: 3, z: 4 };
    expect(quaternionNorm(q)).toBeCloseTo(Math.sqrt(30), 12);
    expect(quaternionConjugate(q)).toEqual({ w: 1, x: -2, y: -3, z: -4 });
    const u = quaternionNormalise(q);
    expect(quaternionNorm(u)).toBeCloseTo(1, 15);
    const one = quaternionMultiply(u, quaternionConjugate(u));
    expect(one.w).toBeCloseTo(1, 15);
    expect(Math.hypot(one.x, one.y, one.z)).toBeLessThan(1e-15);
    expect(() => quaternionNormalise({ w: 0, x: 0, y: 0, z: 0 })).toThrow(InvalidInputError);
  });
});

describe('DYN-3, DYN-4 rotations, eqs. (4.13) to (4.15)', () => {
  it('a 90° rotation about z sends (1, 0, 0) to (0, 1, 0): q = cos 45° + k sin 45° (eq. 4.13 with the half angle)', () => {
    const q = quaternionFromAxisAngle(vec3(0, 0, 1), Math.PI / 2);
    expect(q.w).toBeCloseTo(Math.SQRT1_2, 15);
    expect(q.z).toBeCloseTo(Math.SQRT1_2, 15);
    closeTo(rotateVector(q, vec3(1, 0, 0)), vec3(0, 1, 0), 15);
    closeTo(rotateVector(q, vec3(0, 1, 0)), vec3(-1, 0, 0), 15);
    closeTo(rotateVector(q, vec3(0, 0, 5)), vec3(0, 0, 5), 15);
    // The inverse rotation (eq. 4.15) undoes it.
    closeTo(rotateVectorInverse(q, vec3(0, 1, 0)), vec3(1, 0, 0), 15);
  });
  it('composition: rotating by q₂ after q₁ equals rotating by q₂·q₁', () => {
    const q1 = quaternionFromAxisAngle(vec3(1, 0, 0), 0.4);
    const q2 = quaternionFromAxisAngle(vec3(0, 1, 0), -1.1);
    const v = vec3(0.3, -2, 1.5);
    closeTo(rotateVector(q2, rotateVector(q1, v)), rotateVector(quaternionMultiply(q2, q1), v), 13);
  });
  it('rejects a non-unit axis', () => {
    expect(() => quaternionFromAxisAngle(vec3(0, 0, 2), 1)).toThrow(InvalidInputError);
  });
  it('quaternionBetween takes x to y with a 90° rotation about z; identity for equal vectors', () => {
    const q = quaternionBetween(vec3(1, 0, 0), vec3(0, 1, 0));
    closeTo(rotateVector(q, vec3(1, 0, 0)), vec3(0, 1, 0), 15);
    expect(quaternionBetween(vec3(0, 0, 1), vec3(0, 0, 1))).toEqual(IDENTITY_QUATERNION);
    expect(() => quaternionBetween(vec3(0, 0, 1), vec3(0, 0, -1))).toThrow(InvalidInputError);
  });
});

describe('DYN-5 orientation update, eq. (4.24) with the half angle of eq. (4.13)', () => {
  it('ω = (0, 0, π) rad/s for 0.5 s is a 90° rotation about z', () => {
    const q = rotationFromAngularVelocity(vec3(0, 0, Math.PI), 0.5);
    closeTo(rotateVector(q, vec3(1, 0, 0)), vec3(0, 1, 0), 15);
    expect(rotationFromAngularVelocity(vec3(0, 0, 0), 1)).toEqual(IDENTITY_QUATERNION);
  });
  it('advanceOrientation applies the rotation from the left and normalises', () => {
    const o0 = quaternionFromAxisAngle(vec3(1, 0, 0), 0.3);
    const o1 = advanceOrientation(o0, vec3(0, 0, Math.PI), 0.5);
    const expected = quaternionMultiply(quaternionFromAxisAngle(vec3(0, 0, 1), Math.PI / 2), o0);
    expect(o1.w).toBeCloseTo(expected.w, 15);
    expect(o1.z).toBeCloseTo(expected.z, 15);
    expect(quaternionNorm(o1)).toBeCloseTo(1, 15);
  });
});

describe('properties', () => {
  const unitQuaternion = fc
    .tuple(
      fc.double({ min: -1, max: 1, noNaN: true }),
      fc.double({ min: -1, max: 1, noNaN: true }),
      fc.double({ min: -1, max: 1, noNaN: true }),
      fc.double({ min: -1, max: 1, noNaN: true }),
    )
    .filter(([w, x, y, z]) => Math.hypot(w, x, y, z) > 0.1)
    .map(([w, x, y, z]) => quaternionNormalise({ w, x, y, z }));
  const vector = fc.tuple(
    fc.double({ min: -100, max: 100, noNaN: true }),
    fc.double({ min: -100, max: 100, noNaN: true }),
    fc.double({ min: -100, max: 100, noNaN: true }),
  );
  it('rotation preserves length and the inverse rotation round-trips', () => {
    fc.assert(
      fc.property(unitQuaternion, vector, (q, [x, y, z]) => {
        const v = vec3(x, y, z);
        const r = rotateVector(q, v);
        const back = rotateVectorInverse(q, r);
        const n = norm(v);
        return Math.abs(norm(r) - n) <= 1e-12 * (1 + n) && norm(sub(back, v)) <= 1e-12 * (1 + n);
      }),
      { numRuns: 300 },
    );
  });
  it('the product of unit quaternions is a unit quaternion', () => {
    fc.assert(
      fc.property(unitQuaternion, unitQuaternion, (a, b) => {
        return Math.abs(quaternionNorm(quaternionMultiply(a, b)) - 1) <= 1e-12;
      }),
      { numRuns: 300 },
    );
  });
});
