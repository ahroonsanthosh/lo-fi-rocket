import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import {
  celsiusToKelvin,
  degreesToRadians,
  gramsToKilograms,
  millimetresToMetres,
} from './convert.js';

const FAST_CHECK_SEED = 20261011;

/** Distance between two doubles in units in the last place of `reference`. */
function ulpsApart(actual: number, reference: number): number {
  const ulp = ulpOf(reference);
  return Math.abs(actual - reference) / ulp;
}

/** Size of one ulp at `x` (for finite, non-zero x). */
function ulpOf(x: number): number {
  const exponent = Math.floor(Math.log2(Math.abs(x)));
  return 2 ** (exponent - 52);
}

describe('UNIT-1 millimetresToMetres', () => {
  it('is exact when the result is representable', () => {
    // 1500 / 1000 = 1.5 = 3 × 2^-1, exactly representable, and division is correctly rounded.
    expect(millimetresToMetres(1500)).toBe(1.5);
    // 250 / 1000 = 0.25 = 2^-2.
    expect(millimetresToMetres(250)).toBe(0.25);
    expect(millimetresToMetres(0)).toBe(0);
    expect(millimetresToMetres(-30)).toBe(-0.03);
  });

  it('round-trips through × 1000 within 1 ulp for normal numbers', () => {
    // Restricted to |x| ≥ 1e-300 so that x / 1000 stays a normal double: a
    // subnormal input (for example 5e-324) underflows to 0 and cannot round-trip.
    // No physical length is anywhere near that range.
    const normalDouble = fc
      .double({ noNaN: true, noDefaultInfinity: true, min: -1e300, max: 1e300 })
      .filter((x) => x === 0 || Math.abs(x) >= 1e-300);
    fc.assert(
      fc.property(normalDouble, (mm) => {
        const back = millimetresToMetres(mm) * 1000;
        return mm === 0 ? back === 0 : ulpsApart(back, mm) <= 1;
      }),
      { seed: FAST_CHECK_SEED },
    );
  });

  it('rejects non-finite input', () => {
    expect(() => millimetresToMetres(Number.NaN)).toThrow(InvalidInputError);
    expect(() => millimetresToMetres(Number.POSITIVE_INFINITY)).toThrow(InvalidInputError);
  });
});

describe('UNIT-2 gramsToKilograms', () => {
  it('is exact when the result is representable', () => {
    // 62.5 / 1000 = 0.0625 = 2^-4.
    expect(gramsToKilograms(62.5)).toBe(0.0625);
    // 1000 / 1000 = 1.
    expect(gramsToKilograms(1000)).toBe(1);
    expect(gramsToKilograms(0)).toBe(0);
  });

  it('matches an independent hand calculation for a typical motor mass', () => {
    // An Estes C6 motor: 24.0 g → 0.024 kg. 24/1000 = 0.024 (nearest double of 0.024).
    expect(gramsToKilograms(24)).toBe(0.024);
  });

  it('rejects non-finite input', () => {
    expect(() => gramsToKilograms(Number.NaN)).toThrow(InvalidInputError);
    expect(() => gramsToKilograms(Number.NEGATIVE_INFINITY)).toThrow(InvalidInputError);
  });
});

describe('UNIT-3 degreesToRadians', () => {
  it('is exact at 180° and 90°', () => {
    // 180 × π / 180: 180π is rounded once, then divided by 180; the test below
    // documents that this round-trips to Math.PI exactly in float64.
    expect(degreesToRadians(180)).toBe(Math.PI);
    // π/2 is π with the exponent decremented, exact.
    expect(degreesToRadians(90)).toBe(Math.PI / 2);
    expect(degreesToRadians(0)).toBe(0);
  });

  it('matches hand calculations to within 1 ulp', () => {
    // 45° = π/4 = 0.785398163397448309...; 30° = π/6 = 0.523598775598298873...
    expect(ulpsApart(degreesToRadians(45), Math.PI / 4)).toBeLessThanOrEqual(1);
    expect(ulpsApart(degreesToRadians(30), 0.5235987755982988)).toBeLessThanOrEqual(1);
    // A typical launch rail angle, 5°: 5π/180 = 0.0872664625997164788...
    expect(ulpsApart(degreesToRadians(5), 0.08726646259971647)).toBeLessThanOrEqual(1);
  });

  it('is an odd function, including at ±0', () => {
    // Negation commutes with the conversion exactly: (-d)·π/180 = -(d·π/180)
    // bit for bit, because IEEE 754 multiplication and division are sign-symmetric.
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }), (deg) =>
        Object.is(degreesToRadians(-deg), -degreesToRadians(deg)),
      ),
      { seed: FAST_CHECK_SEED },
    );
  });

  it('rejects non-finite input', () => {
    expect(() => degreesToRadians(Number.NaN)).toThrow(InvalidInputError);
  });
});

describe('UNIT-4 celsiusToKelvin', () => {
  it('maps the standard sea-level temperature', () => {
    // 15 °C + 273.15 = 288.15 K. The nearest double to 273.15 is used, so the
    // result is within 1 ulp of the nearest double to 288.15.
    expect(ulpsApart(celsiusToKelvin(15), 288.15)).toBeLessThanOrEqual(1);
  });

  it('maps absolute zero exactly', () => {
    // -273.15 + 273.15: x + (-x) is exactly 0 in IEEE 754.
    expect(celsiusToKelvin(-273.15)).toBe(0);
  });

  it('maps 0 °C to 273.15 K exactly', () => {
    expect(celsiusToKelvin(0)).toBe(273.15);
  });

  it('rejects non-finite input', () => {
    expect(() => celsiusToKelvin(Number.POSITIVE_INFINITY)).toThrow(InvalidInputError);
  });
});
