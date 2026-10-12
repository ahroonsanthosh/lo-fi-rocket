/**
 * Seeded pseudorandom numbers (plan 0016, RNG-1 and RNG-2; CLAUDE.md 5:
 * "any randomness must use a seeded generator, with the seed saved in
 * results"). Pure and deterministic: the same seed gives the same sequence
 * on every platform (32-bit integer arithmetic with Math.imul).
 *
 * RNG-1: xoshiro128** of Blackman and Vigna, "Scrambled Linear Pseudorandom
 * Number Generators", arXiv:1805.01407v3 (2022), §5 and the reference code
 * (reference/docs/blackman-vigna-2018-scrambled-linear-prngs-arxiv-1805.01407v3.pdf):
 * output rotl(s1 × 5, 7) × 9, then t = s1 << 9; s2 ^= s0; s3 ^= s1; s1 ^= s2;
 * s0 ^= s3; s2 ^= t; s3 = rotl(s3, 11). The 128-bit state is filled from a
 * 32-bit seed by the SplitMix-style mixer the authors recommend for seeding
 * (the 32-bit variant with the constants 0x9E3779B9, 0x85EBCA6B, 0xC2B2AE35).
 *
 * RNG-2: standard normal deviates by the Box–Muller transform
 * z = √(−2 ln u₁) cos(2π u₂), u₁ ∈ (0, 1], u₂ ∈ [0, 1) (Box and Muller 1958;
 * paper not in reference/, verified statistically, D-050).
 */
import { InvalidInputError } from '../errors.js';

export interface Random {
  /** The seed the generator was created from. */
  readonly seed: number;
  /** Next 32-bit unsigned integer. */
  nextUint32(): number;
  /** Uniform in [0, 1) with 53 random bits. */
  nextFloat(): number;
  /** Standard normal deviate (mean 0, variance 1). */
  nextNormal(): number;
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** SplitMix32 step: returns the next 32-bit output and the advanced state. */
function splitMix32(state: number): { out: number; state: number } {
  const next = (state + 0x9e3779b9) >>> 0;
  let z = next;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
  z = (z ^ (z >>> 16)) >>> 0;
  return { out: z, state: next };
}

export function createRandom(seed: number): Random {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new InvalidInputError('random seed', seed, 'must be an integer between 0 and 4294967295');
  }
  const s = new Uint32Array(4);
  let mix = seed >>> 0;
  for (let i = 0; i < 4; i++) {
    const r = splitMix32(mix);
    mix = r.state;
    s[i] = r.out;
  }
  const nextUint32 = (): number => {
    const s0 = s[0] ?? 0;
    const s1 = s[1] ?? 0;
    const s2 = s[2] ?? 0;
    const s3 = s[3] ?? 0;
    const result = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (s1 << 9) >>> 0;
    const n2 = (s2 ^ s0) >>> 0;
    const n3 = (s3 ^ s1) >>> 0;
    const n1 = (s1 ^ n2) >>> 0;
    const n0 = (s0 ^ n3) >>> 0;
    s[0] = n0;
    s[1] = n1;
    s[2] = (n2 ^ t) >>> 0;
    s[3] = rotl(n3, 11);
    return result;
  };
  // 53 bits from two draws: top 27 bits of the first, top 26 of the second (the authors' float recipe scaled to 53 bits).
  const nextFloat = (): number => {
    const a = nextUint32() >>> 5;
    const b = nextUint32() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  };
  const nextNormal = (): number => {
    // u1 in (0, 1]: 1 − float avoids ln 0.
    const u1 = 1 - nextFloat();
    const u2 = nextFloat();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  return { seed, nextUint32, nextFloat, nextNormal };
}
