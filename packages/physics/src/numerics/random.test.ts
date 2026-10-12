/**
 * RNG-1 against an independent Python implementation of the paper's
 * reference code (scratch script, outputs copied here); RNG-2 by its
 * distribution (D-050).
 */
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import { createRandom } from './random.js';

describe('RNG-1 xoshiro128** (Blackman and Vigna)', () => {
  it('seed 20261012: SplitMix32 state [3240137307, 1257499134, 2702711557, 166011] gives the Python reference outputs', () => {
    const r = createRandom(20261012);
    const got = Array.from({ length: 8 }, () => r.nextUint32());
    expect(got).toEqual([
      1880151315, 3757970362, 1119474537, 2206109359, 3934089440, 1951653345, 2178336187,
      1824281162,
    ]);
  });
  it('is deterministic and seeds differ', () => {
    const a = createRandom(7);
    const b = createRandom(7);
    const c = createRandom(8);
    const xa = [a.nextFloat(), a.nextFloat(), a.nextNormal()];
    const xb = [b.nextFloat(), b.nextFloat(), b.nextNormal()];
    expect(xa).toEqual(xb);
    expect(c.nextFloat()).not.toBe(xa[0]);
    expect(() => createRandom(-1)).toThrow(InvalidInputError);
    expect(() => createRandom(1.5)).toThrow(InvalidInputError);
  });
  it('uniform floats lie in [0, 1) with mean ≈ 1/2 and variance ≈ 1/12 over 10⁵ draws', () => {
    const r = createRandom(1);
    const n = 100000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const x = r.nextFloat();
      expect(x >= 0 && x < 1).toBe(true);
      sum += x;
      sumSq += x * x;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    // Standard error of the mean is √(1/12/n) ≈ 0.0009; allow 5 standard errors.
    expect(Math.abs(mean - 0.5)).toBeLessThan(0.0046);
    expect(Math.abs(variance - 1 / 12)).toBeLessThan(0.002);
  });
});

describe('RNG-2 Box–Muller normal deviates (D-050)', () => {
  it('mean ≈ 0, variance ≈ 1, and 4.55 % beyond ±2 and 0.27 % beyond ±3 over 10⁵ draws', () => {
    const r = createRandom(42);
    const n = 100000;
    let sum = 0;
    let sumSq = 0;
    let beyond2 = 0;
    let beyond3 = 0;
    for (let i = 0; i < n; i++) {
      const z = r.nextNormal();
      expect(Number.isFinite(z)).toBe(true);
      sum += z;
      sumSq += z * z;
      if (Math.abs(z) > 2) beyond2++;
      if (Math.abs(z) > 3) beyond3++;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    // Standard error of the mean 1/√n ≈ 0.0032; of the variance √(2/n) ≈ 0.0045: allow 5 standard errors.
    expect(Math.abs(mean)).toBeLessThan(0.016);
    expect(Math.abs(variance - 1)).toBeLessThan(0.023);
    // Tail fractions: 2 × (1 − Φ(2)) = 0.04550, 2 × (1 − Φ(3)) = 0.00270 (standard normal table).
    expect(Math.abs(beyond2 / n - 0.0455)).toBeLessThan(0.0035);
    expect(Math.abs(beyond3 / n - 0.0027)).toBeLessThan(0.001);
  });
});
