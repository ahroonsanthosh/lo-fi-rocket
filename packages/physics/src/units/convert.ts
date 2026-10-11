/**
 * Boundary conversions into SI.
 *
 * These are definitional (no measured data) and are the only non-SI inputs
 * the physics package understands. They exist for file parsers and the UI;
 * nothing inside the physics package calls them with its own values.
 *
 * Source for all four: BIPM, The International System of Units (SI),
 * 9th edition (2019), "the SI Brochure". Section references are given on
 * each function. Equation IDs refer to docs/equations.md.
 *
 * Numerics: dividing by an exactly representable integer is correctly
 * rounded (one rounding); multiplying by its inexact reciprocal is not.
 * So `x / 1000`, never `x * 1e-3` (docs/conventions.md, "Numerics").
 */
import {
  kelvin,
  metres,
  kilograms,
  radians,
  type Kelvin,
  type Kilograms,
  type Metres,
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
