/**
 * Comparison against the published tables of the U.S. Standard Atmosphere,
 * 1976 (reference/docs/ussa1976-nasa-ntrs-19770009539.pdf). Each row was
 * transcribed from a 200 dpi rendering of the cited printed page (PDF page =
 * printed page + 15 for the tables). Table I lists T, T_M, P (mb) and ρ;
 * Table III lists C_s, μ and η. 1 mb = 100 Pa.
 *
 * Tolerances, established from the residuals of every row below (see
 * docs/known-limitations.md, "Published tables"): the fixed-point columns
 * (T_M to 3 decimals, C_s to 2 decimals) agree to half a unit in the last
 * digit except one row (85 500 m, 0.00053 K), so they are checked to 0.0006 K
 * and 0.005 m/s. The five-significant-figure floating-point columns (P, ρ,
 * μ, η) scatter within 1.2 units of the last printed digit, with pressure
 * biased positive (the original computation truncated some columns and
 * rounded others, and ran in limited precision), so they are checked to
 * 1.25 units of the last printed digit, i.e. 1.25 parts in 10⁴ at worst and
 * typically 1.25 parts in 10⁵. The strict checks on the formulas are the
 * hand calculations and consistency properties in ussa1976.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { metres } from '../units/si.js';
import { standardAtmosphere1976 } from './ussa1976.js';

interface TableIRow {
  readonly z: number;
  readonly page: number;
  /** H as printed (m′), used only as a label. */
  readonly h: number;
  /** T_M in K, 3 decimals (equals the printed T below 80 km). */
  readonly tM: number;
  /** P in mb as printed, 5 significant figures. */
  readonly pMb: number;
  /** ρ in kg/m³ as printed, 5 significant figures (4 at 86 km). */
  readonly rho: number;
  readonly rhoDigits?: number;
}

/** One unit in the last place of a mantissa printed with `sig` significant figures. */
function ulpPrinted(value: number, sig: number): number {
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  return 10 ** (exponent - sig + 1);
}

/** Fixed-point column: |actual − printed| ≤ tol. */
function expectRounded(actual: number, printed: number, tol: number): void {
  expect(
    Math.abs(actual - printed),
    `expected ${String(printed)} ± ${String(tol)}, got ${String(actual)}`,
  ).toBeLessThanOrEqual(tol);
}

/** Floating-point column with `sig` significant figures: |actual − printed| ≤ 1.25 units in the last digit. */
function expectTruncated(actual: number, printed: number, sig: number): void {
  const tol = 1.25 * ulpPrinted(printed, sig);
  expect(
    Math.abs(actual - printed),
    `expected ${String(printed)} ± ${String(tol)}, got ${String(actual)}`,
  ).toBeLessThanOrEqual(tol);
}

// Table I, "Geometric Altitude, Metric Units" pages.
const TABLE_I: readonly TableIRow[] = [
  { z: -5000, page: 51, h: -5004, tM: 320.676, pMb: 1.7776e3, rho: 1.9311 },
  { z: -1000, page: 53, h: -1000, tM: 294.651, pMb: 1.1393e3, rho: 1.347 },
  { z: 0, page: 53, h: 0, tM: 288.15, pMb: 1.01325e3, rho: 1.225 },
  { z: 500, page: 53, h: 500, tM: 284.9, pMb: 9.5461e2, rho: 1.1673 },
  { z: 1000, page: 53, h: 1000, tM: 281.651, pMb: 8.9876e2, rho: 1.1117 },
  { z: 2000, page: 53, h: 1999, tM: 275.154, pMb: 7.9501e2, rho: 1.0066 },
  { z: 2500, page: 53, h: 2499, tM: 271.906, pMb: 7.4691e2, rho: 9.5695e-1 },
  { z: 7000, page: 57, h: 6992, tM: 242.7, pMb: 4.1105e2, rho: 5.9002e-1 },
  { z: 8000, page: 57, h: 7990, tM: 236.215, pMb: 3.5651e2, rho: 5.2579e-1 },
  { z: 9000, page: 57, h: 8987, tM: 229.733, pMb: 3.08e2, rho: 4.6706e-1 },
  { z: 10000, page: 57, h: 9984, tM: 223.252, pMb: 2.6499e2, rho: 4.1351e-1 },
  { z: 11000, page: 59, h: 10981, tM: 216.774, pMb: 2.2699e2, rho: 3.648e-1 },
  { z: 12000, page: 59, h: 11977, tM: 216.65, pMb: 1.9399e2, rho: 3.1194e-1 },
  { z: 15000, page: 59, h: 14965, tM: 216.65, pMb: 1.2111e2, rho: 1.9476e-1 },
  { z: 18000, page: 59, h: 17949, tM: 216.65, pMb: 7.5652e1, rho: 1.2165e-1 },
  { z: 20000, page: 61, h: 19937, tM: 216.65, pMb: 5.5293e1, rho: 8.891e-2 },
  { z: 21000, page: 61, h: 20931, tM: 217.581, pMb: 4.7289e1, rho: 7.5715e-2 },
  { z: 25000, page: 61, h: 24902, tM: 221.552, pMb: 2.5492e1, rho: 4.0084e-2 },
  { z: 30000, page: 63, h: 29859, tM: 226.509, pMb: 1.197e1, rho: 1.841e-2 },
  { z: 32000, page: 63, h: 31840, tM: 228.49, pMb: 8.8906, rho: 1.3555e-2 },
  { z: 36000, page: 63, h: 35797, tM: 239.282, pMb: 4.9852, rho: 7.2579e-3 },
  { z: 40000, page: 65, h: 39750, tM: 250.35, pMb: 2.8714, rho: 3.9957e-3 },
  { z: 47000, page: 65, h: 46655, tM: 269.684, pMb: 1.1585, rho: 1.4965e-3 },
  { z: 48000, page: 65, h: 47640, tM: 270.65, pMb: 1.0229, rho: 1.3167e-3 },
  { z: 50000, page: 65, h: 49610, tM: 270.65, pMb: 7.9779e-1, rho: 1.0269e-3 },
  { z: 52000, page: 65, h: 51578, tM: 269.031, pMb: 6.2214e-1, rho: 8.0562e-4 },
  { z: 55000, page: 65, h: 54528, tM: 260.771, pMb: 4.2525e-1, rho: 5.681e-4 },
  { z: 60000, page: 67, h: 59439, tM: 247.021, pMb: 2.1958e-1, rho: 3.0968e-4 },
  { z: 70000, page: 67, h: 69238, tM: 219.585, pMb: 5.2209e-2, rho: 8.2829e-5 },
  { z: 72000, page: 67, h: 71194, tM: 214.263, pMb: 3.8362e-2, rho: 6.2374e-5 },
  { z: 75000, page: 67, h: 74125, tM: 208.399, pMb: 2.3881e-2, rho: 3.9921e-5 },
  { z: 80000, page: 67, h: 79006, tM: 198.639, pMb: 1.0524e-2, rho: 1.8458e-5 },
  { z: 85000, page: 67, h: 83878, tM: 188.893, pMb: 4.4568e-3, rho: 8.2196e-6 },
  { z: 85500, page: 67, h: 84365, tM: 187.92, pMb: 4.0802e-3, rho: 7.5641e-6 },
  { z: 86000, page: 68, h: 84852, tM: 186.95, pMb: 3.7338e-3, rho: 6.958e-6, rhoDigits: 4 },
];

describe('Table I (temperature, pressure, density versus geometric altitude)', () => {
  for (const row of TABLE_I) {
    it(`Z = ${String(row.z)} m (H = ${String(row.h)} m′), printed page ${String(row.page)}`, () => {
      const s = standardAtmosphere1976(metres(row.z));
      // T_M printed to 3 decimals (2 decimals on page 68), rounded.
      expectRounded(s.molecularScaleTemperature, row.tM, row.page === 68 ? 0.005 : 0.0006);
      expectTruncated(s.pressure / 100, row.pMb, 5);
      expectTruncated(s.density, row.rho, row.rhoDigits ?? 5);
    });
  }
});

interface TableIIIRow {
  readonly z: number;
  readonly page: number;
  /** C_s in m/s, 2 decimals. */
  readonly cs: number;
  /** μ in N·s/m², 5 significant figures. */
  readonly mu: number;
  /** η in m²/s, 5 significant figures. */
  readonly eta: number;
}

// Table III, "Geometric Altitude, Metric Units" pages.
const TABLE_III: readonly TableIIIRow[] = [
  { z: -1000, page: 101, cs: 344.11, mu: 1.8206e-5, eta: 1.3516e-5 },
  { z: 0, page: 101, cs: 340.29, mu: 1.7894e-5, eta: 1.4607e-5 },
  { z: 1000, page: 101, cs: 336.43, mu: 1.7579e-5, eta: 1.5813e-5 },
  { z: 2000, page: 101, cs: 332.53, mu: 1.726e-5, eta: 1.7147e-5 },
  { z: 8000, page: 105, cs: 308.11, mu: 1.5271e-5, eta: 2.9044e-5 },
  { z: 10000, page: 105, cs: 299.53, mu: 1.4577e-5, eta: 3.5251e-5 },
  { z: 11000, page: 107, cs: 295.15, mu: 1.4223e-5, eta: 3.8988e-5 },
  { z: 15000, page: 107, cs: 295.07, mu: 1.4216e-5, eta: 7.2995e-5 },
  { z: 18000, page: 107, cs: 295.07, mu: 1.4216e-5, eta: 1.1686e-4 },
  { z: 40000, page: 113, cs: 317.19, mu: 1.6009e-5, eta: 4.0066e-3 },
  { z: 47000, page: 113, cs: 329.21, mu: 1.6989e-5, eta: 1.1352e-2 },
  { z: 50000, page: 113, cs: 329.8, mu: 1.7037e-5, eta: 1.6591e-2 },
  { z: 55000, page: 113, cs: 323.72, mu: 1.6541e-5, eta: 2.9117e-2 },
  { z: 60000, page: 115, cs: 315.07, mu: 1.5837e-5, eta: 5.1141e-2 },
  { z: 70000, page: 115, cs: 297.06, mu: 1.4377e-5, eta: 1.7357e-1 },
  { z: 80000, page: 115, cs: 282.54, mu: 1.3208e-5, eta: 7.1557e-1 },
];

describe('Table III (speed of sound, dynamic and kinematic viscosity versus geometric altitude)', () => {
  for (const row of TABLE_III) {
    it(`Z = ${String(row.z)} m, printed page ${String(row.page)}`, () => {
      const s = standardAtmosphere1976(metres(row.z));
      expectRounded(s.speedOfSound, row.cs, 0.005);
      expectTruncated(s.dynamicViscosity, row.mu, 5);
      expectTruncated(s.kinematicViscosity, row.eta, 5);
    });
  }

  it('Z = 85 000 m, page 115: the table used the uncorrected T, so μ is compared with T_M', () => {
    // Printed: C_s 275.52, μ 1.2647e-5, η 1.5386e0 computed from T = 188.893 K (uncorrected).
    // With the Table 8 correction T = 188.893 × 0.999694 = 188.835 K, μ is lower by about
    // 0.024 %: 1.2644e-5. Both are shown so the discrepancy is visible.
    const s = standardAtmosphere1976(metres(85000));
    expectRounded(s.speedOfSound, 275.52, 0.005);
    expect(s.dynamicViscosity).toBeLessThan(1.2647e-5);
    expect(s.dynamicViscosity).toBeGreaterThan(1.2647e-5 * (1 - 0.0005));
  });
});

describe('Table I geopotential pages at the layer bases', () => {
  // Rows from the "Geopotential Altitude" pages, reached through the exact geometric altitude
  // of each base. T_M printed to 3 decimals; P and ρ to 5 significant figures.
  const rows = [
    { h: 11000, page: 58, tM: 216.65, pMb: 2.2632e2, rho: 3.6392e-1 },
    { h: 32000, page: 62, tM: 228.65, pMb: 8.6801, rho: 1.3225e-2 },
    { h: 47000, page: 64, tM: 270.65, pMb: 1.109, rho: 1.4275e-3 },
    { h: 51000, page: 64, tM: 270.65, pMb: 6.6938e-1, rho: 8.616e-4 },
    { h: 71000, page: 66, tM: 214.65, pMb: 3.9564e-2, rho: 6.4211e-5 },
    { h: 84500, page: 66, tM: 187.65, pMb: 3.9814e-3, rho: 7.3914e-6 },
  ] as const;
  const r0 = 6356766;
  for (const row of rows) {
    it(`H = ${String(row.h)} m′, printed page ${String(row.page)}`, () => {
      const z = (r0 * row.h) / (r0 - row.h);
      const s = standardAtmosphere1976(metres(z));
      expectRounded(s.molecularScaleTemperature, row.tM, 0.0006);
      expectTruncated(s.pressure / 100, row.pMb, 5);
      expectTruncated(s.density, row.rho, 5);
    });
  }
});
