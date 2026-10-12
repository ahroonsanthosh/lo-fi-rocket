/**
 * Boundary conversions into SI.
 *
 * These are definitional (no measured data) and are the only non-SI inputs
 * the physics package understands. They exist for file parsers and the UI;
 * nothing inside the physics package calls them with its own values.
 *
 * Source for UNIT-1 to UNIT-4: BIPM, The International System of Units (SI),
 * 9th edition (2019), "the SI Brochure". Source for UNIT-5 to UNIT-11 (the
 * customary units behind the UI units toggle, D-040): NIST Special
 * Publication 811 (2008), Appendix B (reference/docs/nist-sp811-2008.pdf;
 * printed page numbers, PDF page = printed + 12). Section references are
 * given on each function. Equation IDs refer to docs/equations.md.
 *
 * Numerics: dividing by an exactly representable integer is correctly
 * rounded (one rounding); multiplying by its inexact reciprocal is not.
 * So `x / 1000`, never `x * 1e-3` (docs/conventions.md, "Numerics").
 */
import {
  kelvin,
  metres,
  metresPerSecond,
  kilograms,
  newtons,
  radians,
  type Kelvin,
  type Kilograms,
  type Metres,
  type MetresPerSecond,
  type Newtons,
  type Radians,
} from './si.js';

/**
 * UNIT-1: millimetres to metres, x_m = x_mm / 1000.
 * Source: SI Brochure 9th ed. (2019), §3 "Decimal multiples and sub-multiples of SI units", Table 7 "SI prefixes": milli = 10^-3.
 * Validity: every finite float64. Tolerance: correctly rounded (≤ 0.5 ulp).
 */
export function millimetresToMetres(millimetres: number): Metres {
  return metres(millimetres / 1000);
}

/**
 * UNIT-2: grams to kilograms, x_kg = x_g / 1000.
 * Source: SI Brochure 9th ed. (2019), §3 "Decimal multiples and sub-multiples of SI units", Table 7 "SI prefixes": kilo = 10^3,
 * so 1 g = 10^-3 kg.
 * Validity: every finite float64. Tolerance: correctly rounded (≤ 0.5 ulp).
 */
export function gramsToKilograms(grams: number): Kilograms {
  return kilograms(grams / 1000);
}

/**
 * UNIT-3: degrees to radians, θ_rad = θ_deg × π / 180.
 * Source: SI Brochure 9th ed. (2019), §4 "Non-SI units that are accepted for use with the SI", Table 8 "Non-SI units accepted for use
 * with the SI units": 1° = (π/180) rad.
 * Validity: every finite float64. Tolerance: ≤ 1 ulp (one multiplication, one division,
 * each correctly rounded); exact for 180° and 90° (see tests).
 */
export function degreesToRadians(degrees: number): Radians {
  return radians((degrees * Math.PI) / 180);
}

/**
 * UNIT-4: degrees Celsius to kelvin, T_K = t_°C + 273.15.
 * Source: SI Brochure 9th ed. (2019), §2.3.1 (definition of the kelvin), T0 = 273.15 K and t/°C = T/K − 273.15.
 * Validity: every finite float64. Tolerance: ≤ 0.5 ulp of the result (one addition;
 * 273.15 itself is stored to 0.5 ulp, about 3 × 10^-14 K).
 */
export function celsiusToKelvin(celsius: number): Kelvin {
  return kelvin(celsius + 273.15);
}

/**
 * Exact factors of the customary units (NIST SP 811, 2008, Appendix B; B.2
 * p. 40: "A factor in boldface is exact"). Each is the SI value of one unit.
 * The UI divides by these for display (SP 811 B.3 note 2, p. 41).
 */
export const CUSTOMARY_UNIT_FACTORS = {
  /** UNIT-5: B.8 p. 50; the 1959 international inch (B.6 p. 42). */
  metresPerInch: 0.0254,
  /** UNIT-6: B.8 p. 49; B.6 p. 42, "the foot has been defined as being exactly equal to 0.3048 m". */
  metresPerFoot: 0.3048,
  /** UNIT-7: B.8 p. 53, footnote 22: "The exact conversion factor is 4.535 923 7 E−01". */
  kilogramsPerPound: 0.45359237,
  /** UNIT-8: 16 oz = 1 lb (B.8 p. 52 lists 2.834 952 E−02 kg, the rounded value). 0.45359237 / 16. */
  kilogramsPerOunce: 0.028349523125,
  /** UNIT-9: B.8 p. 53, footnote 23: "The exact conversion factor is 4.448 221 615 260 5 E+00" (0.45359237 × 9.80665). */
  newtonsPerPoundForce: 4.4482216152605,
  /** UNIT-10: B.8 p. 52, mile per hour 4.4704 E−01 (1609.344 m / 3600 s); foot per second 3.048 E−01 (p. 49). */
  metresPerSecondPerMilePerHour: 0.44704,
  metresPerSecondPerFootPerSecond: 0.3048,
} as const;

/**
 * UNIT-5: inches to metres, x_m = x_in × 0.0254 (exact factor).
 * Source: NIST SP 811 (2008) B.8 p. 50; B.6 p. 42.
 * Validity: every finite float64. Tolerance: ≤ 0.5 ulp (one multiplication by an exactly stated constant,
 * which itself is stored to 0.5 ulp).
 */
export function inchesToMetres(inches: number): Metres {
  return metres(inches * CUSTOMARY_UNIT_FACTORS.metresPerInch);
}

/**
 * UNIT-6: feet to metres, x_m = x_ft × 0.3048 (exact factor).
 * Source: NIST SP 811 (2008) B.8 p. 49; B.6 p. 42.
 * Validity and tolerance as UNIT-5.
 */
export function feetToMetres(feet: number): Metres {
  return metres(feet * CUSTOMARY_UNIT_FACTORS.metresPerFoot);
}

/**
 * UNIT-7: avoirdupois pounds to kilograms, m_kg = m_lb × 0.45359237 (exact factor).
 * Source: NIST SP 811 (2008) B.8 p. 53, footnote 22.
 * Validity and tolerance as UNIT-5.
 */
export function poundsToKilograms(pounds: number): Kilograms {
  return kilograms(pounds * CUSTOMARY_UNIT_FACTORS.kilogramsPerPound);
}

/**
 * UNIT-8: avoirdupois ounces to kilograms, m_kg = m_oz × 0.45359237 / 16.
 * Source: NIST SP 811 (2008) B.8 p. 52 (2.834 952 E−02, rounded) with footnote 22 for the exact pound; 16 oz = 1 lb.
 * Validity and tolerance as UNIT-5 (the factor 0.028349523125 is the exact quotient).
 */
export function ouncesToKilograms(ounces: number): Kilograms {
  return kilograms(ounces * CUSTOMARY_UNIT_FACTORS.kilogramsPerOunce);
}

/**
 * UNIT-9: pounds-force to newtons, F_N = F_lbf × 4.4482216152605 (exact factor).
 * Source: NIST SP 811 (2008) B.8 p. 53, footnote 23.
 * Validity and tolerance as UNIT-5.
 */
export function poundsForceToNewtons(poundsForce: number): Newtons {
  return newtons(poundsForce * CUSTOMARY_UNIT_FACTORS.newtonsPerPoundForce);
}

/**
 * UNIT-10: miles per hour to metres per second, v = v_mph × 0.44704 (exact factor).
 * Source: NIST SP 811 (2008) B.8 p. 52.
 * Validity and tolerance as UNIT-5.
 */
export function milesPerHourToMetresPerSecond(milesPerHour: number): MetresPerSecond {
  return metresPerSecond(milesPerHour * CUSTOMARY_UNIT_FACTORS.metresPerSecondPerMilePerHour);
}

/**
 * UNIT-10: feet per second to metres per second, v = v_fps × 0.3048 (exact factor).
 * Source: NIST SP 811 (2008) B.8 p. 49.
 * Validity and tolerance as UNIT-5.
 */
export function feetPerSecondToMetresPerSecond(feetPerSecond: number): MetresPerSecond {
  return metresPerSecond(feetPerSecond * CUSTOMARY_UNIT_FACTORS.metresPerSecondPerFootPerSecond);
}

/**
 * UNIT-11: degrees Fahrenheit to kelvin, T_K = (t_°F + 459.67) × 5/9.
 * Source: NIST SP 811 (2008) B.8 p. 48: a Fahrenheit degree is 5/9 of a Celsius degree (5.555 556 E−01,
 * rounded); 32 °F = 0 °C; UNIT-4 (SI Brochure §2.3.1) gives 0 °C = 273.15 K, so the offset is
 * 273.15 × 9/5 − 32 = 459.67.
 * Validity: every finite float64. Tolerance: ≤ 1.5 ulp (an addition, a multiplication and a division,
 * each correctly rounded); exact at 32 °F and 212 °F (see tests).
 */
export function fahrenheitToKelvin(fahrenheit: number): Kelvin {
  return kelvin(((fahrenheit + 459.67) * 5) / 9);
}
