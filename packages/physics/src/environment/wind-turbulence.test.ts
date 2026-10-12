/**
 * ENV-3 to ENV-5 (plan 0016): profile interpolation by hand, the filter
 * coefficients of eq. (4.6), the 2.252 scaling, the turbulence statistics,
 * step-size independence and determinism.
 */
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import { metresPerSecond, radians } from '../units/si.js';
import {
  PINK_NOISE_COEFFICIENTS,
  pinkNoiseSequence,
  profileWindAt,
  windField,
  windVelocity,
  type ProfileWind,
  type TurbulentWind,
} from './wind.js';

const PROFILE: ProfileWind = {
  kind: 'profile',
  layers: [
    { altitude: 0, speed: metresPerSecond(2), from: radians(0) },
    { altitude: 100, speed: metresPerSecond(6), from: radians(Math.PI / 2) },
  ],
};

describe('ENV-3 wind profile by altitude (D-049)', () => {
  it('interpolates speed and direction linearly: at 50 m, 4 m/s from 45°; holds the ends', () => {
    const m = profileWindAt(PROFILE.layers, 50);
    expect(m.speed).toBeCloseTo(4, 12);
    expect(m.from).toBeCloseTo(Math.PI / 4, 12);
    expect(profileWindAt(PROFILE.layers, -5).speed).toBe(2);
    expect(profileWindAt(PROFILE.layers, 500).from).toBeCloseTo(Math.PI / 2, 12);
    // From the north at the pad: velocity towards the south, (0, −2, 0).
    const v = windVelocity(PROFILE, 0);
    expect(v.x).toBeCloseTo(0, 12);
    expect(v.y).toBeCloseTo(-2, 12);
  });
  it('takes the short way round the compass: 350° to 10° passes through 0°', () => {
    const m = profileWindAt(
      [
        { altitude: 0, speed: metresPerSecond(1), from: radians((350 * Math.PI) / 180) },
        { altitude: 10, speed: metresPerSecond(1), from: radians((10 * Math.PI) / 180) },
      ],
      5,
    );
    expect(((m.from * 180) / Math.PI + 360) % 360).toBeCloseTo(0, 9);
  });
  it('rejects a table that does not start at the pad or does not increase', () => {
    expect(() =>
      windVelocity(
        { kind: 'profile', layers: [{ altitude: 5, speed: metresPerSecond(1), from: radians(0) }] },
        0,
      ),
    ).toThrow(InvalidInputError);
    expect(() =>
      windVelocity(
        {
          kind: 'profile',
          layers: [
            { altitude: 0, speed: metresPerSecond(1), from: radians(0) },
            { altitude: 0, speed: metresPerSecond(1), from: radians(0) },
          ],
        },
        0,
      ),
    ).toThrow(/must increase/);
  });
});

describe('ENV-4 pink noise filter (Niskanen eqs. 4.5, 4.6)', () => {
  it('coefficients: a₁ = (0 − 5/6)/1 = −0.833333, a₂ = (1 − 5/6)(−0.833333)/2 = −0.0694444', () => {
    expect(PINK_NOISE_COEFFICIENTS[0]).toBe(1);
    expect(PINK_NOISE_COEFFICIENTS[1]).toBeCloseTo(-0.8333333333, 10);
    expect(PINK_NOISE_COEFFICIENTS[2]).toBeCloseTo(-0.0694444444, 10);
  });
  it('a long unscaled sequence has a standard deviation near 2.252 (p. 60 step 2), so the scaled one is near 1', () => {
    const x = pinkNoiseSequence(123, 200000);
    let sum = 0;
    let sumSq = 0;
    for (const v of x) {
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / x.length;
    const sd = Math.sqrt(sumSq / x.length - mean * mean);
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.abs(sd - 1)).toBeLessThan(0.03);
  });
});

describe('ENV-5 turbulent wind', () => {
  const model: TurbulentWind = {
    kind: 'turbulent',
    mean: { kind: 'constant', speed: metresPerSecond(5), from: radians(Math.PI / 2) },
    intensity: 0.2,
    seed: 2026,
  };
  it('mean speed ≈ U and standard deviation ≈ I_u U over a long field; direction fixed', () => {
    const field = windField(model, 10000);
    let sum = 0;
    let sumSq = 0;
    const n = 200000;
    for (let i = 0; i < n; i++) {
      const v = field(0, i * 0.05);
      expect(v.y).toBeCloseTo(0, 9); // from the east: velocity along −x only
      const u = -v.x;
      sum += u;
      sumSq += u * u;
    }
    const mean = sum / n;
    const sd = Math.sqrt(sumSq / n - mean * mean);
    expect(Math.abs(mean - 5)).toBeLessThan(0.05);
    expect(Math.abs(sd - 1)).toBeLessThan(0.05);
  });
  it("is the same function of time whatever the caller's step, interpolated between the 20 Hz samples, and deterministic", () => {
    const a = windField(model, 30);
    const b = windField(model, 30);
    expect(a(0, 1.234).x).toBe(b(0, 1.234).x);
    // Midway between two samples is the average of the samples.
    const mid = a(0, 1.025).x;
    expect(mid).toBeCloseTo((a(0, 1.0).x + a(0, 1.05).x) / 2, 12);
    const other = windField({ ...model, seed: 2027 }, 30);
    expect(other(0, 1.234).x).not.toBe(a(0, 1.234).x);
    expect(() => a(0, -1)).toThrow(InvalidInputError);
  });
  it('rides on a profile mean', () => {
    const field = windField({ ...model, mean: PROFILE, intensity: 0 }, 10);
    expect(field(50, 2).x).toBeCloseTo(-4 * Math.sin(Math.PI / 4), 12);
  });
});
