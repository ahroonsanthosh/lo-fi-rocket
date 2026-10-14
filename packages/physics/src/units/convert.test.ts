import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import {
  celsiusToKelvin,
  centimetresToMetres,
  CUSTOMARY_UNIT_FACTORS,
  degreesToRadians,
  fahrenheitToKelvin,
  feetPerSecondToMetresPerSecond,
  feetToMetres,
  gramsPerCubicCentimetreToKilogramsPerCubicMetre,
  gramsToKilograms,
  hectopascalsToPascals,
  inchesToMetres,
  kilometresPerHourToMetresPerSecond,
  kilopascalsToPascals,
  milesPerHourToMetresPerSecond,
  millimetresToMetres,
  millisecondsToSeconds,
  ouncesToKilograms,
  poundsForceToNewtons,
  poundsToKilograms,
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

describe('UNIT-5 to UNIT-11 customary units (NIST SP 811 Appendix B, D-040)', () => {
  it('the exact factors are the footnoted or boldface values of B.8', () => {
    // B.8 p. 50 inch 2.54 E−02 (exact); p. 49 foot 3.048 E−01 (exact).
    expect(CUSTOMARY_UNIT_FACTORS.metresPerInch).toBe(0.0254);
    expect(CUSTOMARY_UNIT_FACTORS.metresPerFoot).toBe(0.3048);
    // footnote 22: 4.535 923 7 E−01; printed 4.535 924 E−01 (rounded to 7 digits).
    expect(CUSTOMARY_UNIT_FACTORS.kilogramsPerPound).toBe(0.45359237);
    expect(Math.abs(CUSTOMARY_UNIT_FACTORS.kilogramsPerPound - 0.4535924)).toBeLessThan(0.5e-7);
    // 16 oz = 1 lb: 0.45359237 / 16 = 0.028349523125 exactly; printed 2.834 952 E−02.
    expect(CUSTOMARY_UNIT_FACTORS.kilogramsPerOunce).toBe(0.45359237 / 16);
    expect(Math.abs(CUSTOMARY_UNIT_FACTORS.kilogramsPerOunce - 0.02834952)).toBeLessThan(0.5e-8);
    // footnote 23: 4.448 221 615 260 5 = 0.45359237 × 9.80665; printed 4.448 222.
    expect(CUSTOMARY_UNIT_FACTORS.newtonsPerPoundForce).toBe(4.4482216152605);
    expect(ulpsApart(0.45359237 * 9.80665, 4.4482216152605)).toBeLessThan(2);
    expect(Math.abs(CUSTOMARY_UNIT_FACTORS.newtonsPerPoundForce - 4.448222)).toBeLessThan(0.5e-6);
    // mile per hour: 1609.344 m / 3600 s = 0.44704 exactly (p. 52).
    expect(CUSTOMARY_UNIT_FACTORS.metresPerSecondPerMilePerHour).toBe(0.44704);
    expect(ulpsApart(1609.344 / 3600, 0.44704)).toBeLessThan(2);
  });
  it('converts hand values: 1 in, 12 in = 1 ft, 2 lb, 16 oz = 1 lb, 10 lbf, 60 mi/h = 88 ft/s', () => {
    expect(inchesToMetres(1)).toBe(0.0254);
    // 12 × 0.0254 = 0.3048 (exact product in decimal; one rounding of the double product)
    expect(ulpsApart(inchesToMetres(12), feetToMetres(1))).toBeLessThan(2);
    expect(poundsToKilograms(2)).toBe(0.90718474);
    expect(ulpsApart(ouncesToKilograms(16), poundsToKilograms(1))).toBeLessThan(2);
    expect(poundsForceToNewtons(10)).toBeCloseTo(44.482216152605, 12);
    // 60 mi/h = 26.8224 m/s = 88 ft/s (88 × 0.3048 = 26.8224)
    expect(milesPerHourToMetresPerSecond(60)).toBeCloseTo(26.8224, 12);
    expect(
      ulpsApart(feetPerSecondToMetresPerSecond(88), milesPerHourToMetresPerSecond(60)),
    ).toBeLessThan(4);
    expect(inchesToMetres(0)).toBe(0);
    expect(() => inchesToMetres(Number.NaN)).toThrow(InvalidInputError);
    expect(() => poundsToKilograms(Number.POSITIVE_INFINITY)).toThrow(InvalidInputError);
  });
  it('Fahrenheit: 32 °F = 273.15 K, 212 °F = 373.15 K, −40 °F = −40 °C, −459.67 °F = 0 K', () => {
    // (32 + 459.67) × 5/9 = 491.67 × 5/9 = 273.15
    expect(fahrenheitToKelvin(32)).toBeCloseTo(273.15, 12);
    // (212 + 459.67) × 5/9 = 671.67 × 5/9 = 373.15
    expect(fahrenheitToKelvin(212)).toBeCloseTo(373.15, 12);
    expect(fahrenheitToKelvin(-40)).toBeCloseTo(celsiusToKelvin(-40), 12);
    expect(fahrenheitToKelvin(-459.67)).toBeCloseTo(0, 12);
    expect(() => fahrenheitToKelvin(Number.NaN)).toThrow(InvalidInputError);
  });
});

describe('UNIT-12 SI prefixes (SI Brochure Table 7, p. 138)', () => {
  it('matches hand values', () => {
    // 250 cm / 100 = 2.5 m (exactly representable).
    expect(centimetresToMetres(250)).toBe(2.5);
    // 2.54 cm = 1 in = 0.0254 m (UNIT-5); one correctly rounded division.
    expect(centimetresToMetres(2.54)).toBe(2.54 / 100);
    // 1500 ms = 1.5 s.
    expect(millisecondsToSeconds(1500)).toBe(1.5);
    // 1013.25 hPa = 101 325 Pa, the standard sea-level pressure (USSA76 Table 2); 1013.25 = 4053/4 is
    // exactly representable, so the product is exact.
    expect(hectopascalsToPascals(1013.25)).toBe(101325);
    // 101.325 kPa = 101 325 Pa; 101.325 is not exactly representable, so the product is within 1e-9.
    expect(kilopascalsToPascals(101.325)).toBeCloseTo(101325, 9);
    // Water, 1 g/cm³ = 1000 kg/m³; balsa about 0.16 g/cm³ = 160 kg/m³.
    expect(gramsPerCubicCentimetreToKilogramsPerCubicMetre(1)).toBe(1000);
    expect(gramsPerCubicCentimetreToKilogramsPerCubicMetre(0.16)).toBeCloseTo(160, 12);
  });
  it('rejects non-finite input', () => {
    expect(() => centimetresToMetres(Number.NaN)).toThrow(InvalidInputError);
    expect(() => hectopascalsToPascals(Number.POSITIVE_INFINITY)).toThrow(InvalidInputError);
  });
});

describe('UNIT-13 kilometresPerHourToMetresPerSecond (SI Brochure Tables 7 and 8)', () => {
  it('matches hand values', () => {
    // 36 km/h = 36 000 m / 3600 s = 10 m/s exactly.
    expect(kilometresPerHourToMetresPerSecond(36)).toBe(10);
    // 18 km/h = 5 m/s; 0 stays 0.
    expect(kilometresPerHourToMetresPerSecond(18)).toBe(5);
    expect(kilometresPerHourToMetresPerSecond(0)).toBe(0);
    // 100 km/h = 27.777… m/s (100 000 / 3600, by hand 27.7777777777778).
    expect(kilometresPerHourToMetresPerSecond(100)).toBeCloseTo(27.7777777777778, 12);
  });
  it('rejects non-finite input', () => {
    expect(() => kilometresPerHourToMetresPerSecond(Number.NaN)).toThrow(InvalidInputError);
  });
});
