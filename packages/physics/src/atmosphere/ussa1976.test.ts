/**
 * Hand-calculation and property tests for the U.S. Standard Atmosphere 1976.
 * Every expected value below is worked by hand or with an independent tool
 * (Python, shown in the comments), never by running the code under test.
 * Document page numbers refer to reference/docs/ussa1976-nasa-ntrs-19770009539.pdf
 * (printed page numbers).
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import { metres } from '../units/si.js';
import {
  USSA1976_CONSTANTS,
  USSA1976_MAX_ALTITUDE,
  USSA1976_MIN_ALTITUDE,
  USSA1976_TOP_GEOPOTENTIAL,
  geometricToGeopotential,
  geopotentialToGeometric,
  molecularWeightRatio,
  standardAtmosphere1976,
  ussa1976Layers,
} from './ussa1976.js';

const FAST_CHECK_SEED = 19760101;

/** |a − b| ≤ tol·|b| */
function closeRel(actual: number, expected: number, relTol: number): boolean {
  return Math.abs(actual - expected) <= relTol * Math.abs(expected);
}

describe('USSA1976 constants (Table 2 p. 2, p. 3 to 4, p. 9, p. 19)', () => {
  it('holds the adopted values', () => {
    expect(USSA1976_CONSTANTS.seaLevelGravityG0).toBe(9.80665);
    expect(USSA1976_CONSTANTS.effectiveEarthRadiusR0).toBe(6356766);
    expect(USSA1976_CONSTANTS.seaLevelPressureP0).toBe(101325);
    expect(USSA1976_CONSTANTS.seaLevelTemperatureT0).toBe(288.15);
    expect(USSA1976_CONSTANTS.seaLevelMolecularWeightM0).toBe(28.9644);
    expect(USSA1976_CONSTANTS.universalGasConstantRStar).toBe(8314.32);
    expect(USSA1976_CONSTANTS.ratioOfSpecificHeatsGamma).toBe(1.4);
    expect(USSA1976_CONSTANTS.sutherlandBeta).toBe(1.458e-6);
    expect(USSA1976_CONSTANTS.sutherlandS).toBe(110.4);
  });
});

describe('USSA1976 layer table (Table 4 p. 3; T_M,b by eq. 23 p. 10; P_b by eqs. 33a/33b p. 12)', () => {
  const layers = ussa1976Layers();

  it('has the seven layers of Table 4 with bases in m′ and gradients in K/m′', () => {
    expect(layers.map((l) => l.baseGeopotential)).toEqual([
      0, 11000, 20000, 32000, 47000, 51000, 71000,
    ]);
    expect(layers.map((l) => l.gradient)).toEqual([-0.0065, 0, 0.001, 0.0028, 0, -0.0028, -0.002]);
    expect(USSA1976_TOP_GEOPOTENTIAL).toBe(84852);
  });

  it('chains the base temperatures by hand: 288.15 − 6.5·11 = 216.65; +1.0·12 = 228.65; +2.8·15 = 270.65; −2.8·20 = 214.65', () => {
    const expected = [288.15, 216.65, 216.65, 228.65, 270.65, 270.65, 214.65];
    layers.forEach((l, i) => {
      expect(l.baseTemperature).toBeCloseTo(expected[i]!, 10);
    });
  });

  it('reproduces the tropopause pressure by hand (eq. 33a)', () => {
    // Exponent g₀′ M₀ / (R* L) = 9.80665 × 28.9644 / (8314.32 × (−0.0065))
    //   = 284.04272… / (−54.04308) = −5.255876113.
    // T₀/T₁ = 288.15 / 216.65 = 1.3300253866; ln = 0.2851980297;
    // × exponent = −1.4989724; exp = 0.22335863; × 101325 = 22632.064 Pa.
    // Table I, geopotential page 58 (H = 11 000 m′): 2.2632 × 10² mb = 22 632 Pa.
    expect(layers[1]!.basePressure).toBeCloseTo(22632.064, 2);
  });

  it('reproduces the remaining base pressures by hand (eqs. 33a and 33b chained)', () => {
    // Isothermal 11 → 20 km′ (eq. 33b): 22632.064 × exp(−284.04272 × 9000 / (8314.32 × 216.65))
    //   = 22632.064 × exp(−1.4191957) = 22632.064 × 0.24190372 = 5474.889 Pa.
    expect(layers[2]!.basePressure).toBeCloseTo(5474.889, 2);
    // 20 → 32 km′ (eq. 33a, L = +1.0): 5474.889 × (216.65/228.65)^(−34.16319) = 868.0187 Pa.
    expect(layers[3]!.basePressure).toBeCloseTo(868.0187, 3);
    // 32 → 47 km′ (L = +2.8): 868.0187 × (228.65/270.65)^(−12.20114) = 110.9063 Pa.
    expect(layers[4]!.basePressure).toBeCloseTo(110.9063, 3);
    // 47 → 51 km′ (eq. 33b): 110.9063 × exp(−284.04272 × 4000 / (8314.32 × 270.65)) = 66.93887 Pa.
    expect(layers[5]!.basePressure).toBeCloseTo(66.93887, 4);
    // 51 → 71 km′ (L = −2.8): 66.93887 × (270.65/214.65)^(12.20114) = 3.956420 Pa.
    expect(layers[6]!.basePressure).toBeCloseTo(3.95642, 5);
  });
});

describe('ATM-1 and ATM-2: geopotential conversion (eqs. 18 and 19, p. 8)', () => {
  it('matches the Table 8 pairs (p. 9): Z = 86 000 m ↔ H = 84 852.0 m′, Z = 80 000 m ↔ H = 79 005.7 m′', () => {
    // H = 6 356 766 × 86 000 / (6 356 766 + 86 000) = 546 681 876 000 / 6 442 766 = 84 852.046 m′.
    expect(geometricToGeopotential(metres(86000))).toBeCloseTo(84852.046, 2);
    // H = 6 356 766 × 80 000 / 6 436 766 = 79 005.68 m′ (Table 8: 79 005.7).
    expect(geometricToGeopotential(metres(80000))).toBeCloseTo(79005.7, 1);
    // Z = r₀ H / (r₀ − H) with H = 79 000: 6 356 766 × 79 000 / 6 277 766 = 79 994.1 m (Table 8: 79 994.1).
    expect(geopotentialToGeometric(metres(79000))).toBeCloseTo(79994.1, 1);
  });

  it('round-trips within 1e-9 relative', () => {
    fc.assert(
      fc.property(fc.double({ min: -5000, max: 86000, noNaN: true }), (z) => {
        const back = geopotentialToGeometric(geometricToGeopotential(metres(z)));
        return z === 0 ? back === 0 : closeRel(back, z, 1e-9);
      }),
      { seed: FAST_CHECK_SEED },
    );
  });
});

describe('ATM-10: molecular-weight ratio (Table 8 p. 9)', () => {
  it('is exactly 1 at and below 80 km and 0.999579 at 86 km', () => {
    expect(molecularWeightRatio(metres(0))).toBe(1);
    expect(molecularWeightRatio(metres(80000))).toBe(1);
    expect(molecularWeightRatio(metres(86000))).toBe(0.999579);
    expect(molecularWeightRatio(metres(83000))).toBe(0.99987);
  });

  it('interpolates linearly: midway between 85 000 (0.999694) and 85 500 (0.999641) is 0.9996675', () => {
    expect(molecularWeightRatio(metres(85250))).toBeCloseTo(0.9996675, 12);
  });
});

describe('standardAtmosphere1976 hand calculations', () => {
  it('sea level (Table 10 p. 20): ρ₀ = 1.2250, C_s = 340.294, μ₀ = 1.7894e-5, η₀ = 1.4607e-5', () => {
    const s = standardAtmosphere1976(metres(0));
    expect(s.temperature).toBe(288.15);
    expect(s.pressure).toBe(101325);
    // ρ = P M₀ / (R* T) = 101325 × 28.9644 / (8314.32 × 288.15) = 2 934 817.83 / 2 395 771.308 = 1.2249992.
    expect(s.density).toBeCloseTo(1.2249992, 6);
    // C_s = √(1.4 × 8314.32 × 288.15 / 28.9644) = √115 800.080 = 340.29411 m/s.
    expect(s.speedOfSound).toBeCloseTo(340.29411, 4);
    // μ = 1.458e-6 × 288.15^1.5 / (288.15 + 110.4) = 1.458e-6 × 4891.3409 / 398.55 = 1.7893803e-5.
    expect(s.dynamicViscosity).toBeCloseTo(1.7893803e-5, 11);
    // η = μ / ρ = 1.7893803e-5 / 1.2249992 = 1.4607196e-5.
    expect(s.kinematicViscosity).toBeCloseTo(1.4607196e-5, 11);
  });

  it('Z = 10 000 m, inside the troposphere (eq. 33a)', () => {
    // H = 6 356 766 × 10 000 / 6 366 766 = 9 984.2934 m′.
    // T_M = 288.15 − 0.0065 × 9 984.2934 = 223.25209 K.
    // P = 101325 × (288.15 / 223.25209)^(−5.255876) = 101325 × 0.26153359 = 26 499.90 Pa.
    // ρ = 26 499.90 × 28.9644 / (8314.32 × 223.25209) = 0.4135104 kg/m³.
    const s = standardAtmosphere1976(metres(10000));
    expect(s.geopotentialAltitude).toBeCloseTo(9984.2934, 3);
    expect(s.molecularScaleTemperature).toBeCloseTo(223.25209, 4);
    expect(s.pressure).toBeCloseTo(26499.9, 1);
    expect(s.density).toBeCloseTo(0.4135104, 6);
  });

  it('H = 15 000 m′ in the isothermal layer (eq. 33b)', () => {
    // Use the geometric altitude whose geopotential is exactly 15 000 m′: Z = r₀ H/(r₀ − H).
    const z = geopotentialToGeometric(metres(15000));
    // P = 22632.064 × exp(−284.04272 × 4000 / (8314.32 × 216.65)) = 22632.064 × 0.53219056 = 12 044.571 Pa.
    const s = standardAtmosphere1976(z);
    expect(s.molecularScaleTemperature).toBeCloseTo(216.65, 9);
    expect(s.pressure).toBeCloseTo(12044.571, 2);
  });

  it('Z = −5 000 m, below sea level (Table I p. 51: T 320.676, P 1777.6 hPa, ρ 1.9311)', () => {
    // H = 6 356 766 × (−5000) / 6 351 766 = −5 003.936 m′; T_M = 288.15 + 0.0065 × 5003.936 = 320.67558 K.
    const s = standardAtmosphere1976(metres(-5000));
    expect(s.molecularScaleTemperature).toBeCloseTo(320.67558, 4);
    expect(s.pressure).toBeCloseTo(177761.5, 0);
    expect(s.density).toBeCloseTo(1.93112, 4);
  });

  it('Z = 86 000 m: T_M = 186.946 K (eq. 23 at 84 852 m′) and T = 186.8673 K (p. 10)', () => {
    // T_M = 214.65 − 0.002 × (84 852.046 − 71 000) = 214.65 − 27.70409 = 186.94591 K.
    // T = T_M × 0.999579 = 186.8672 K (p. 10 states 186.8673 K using the unrounded ratio 0.9995788).
    const s = standardAtmosphere1976(metres(86000));
    expect(s.molecularScaleTemperature).toBeCloseTo(186.94591, 4);
    expect(s.temperature).toBeCloseTo(186.8673, 3);
    expect(s.molecularWeightRatio).toBe(0.999579);
    // P = 3.956420 × (214.65 / 186.94591)^(17.08160) ... = 0.37338 Pa (Table I p. 68: 3.7338e-3 mb).
    expect(s.pressure).toBeCloseTo(0.37338, 5);
  });
});

describe('standardAtmosphere1976 domain', () => {
  it('rejects altitudes outside −5 000 m to 86 000 m with InvalidInputError', () => {
    expect(() => standardAtmosphere1976(metres(USSA1976_MIN_ALTITUDE - 0.001))).toThrow(
      InvalidInputError,
    );
    expect(() => standardAtmosphere1976(metres(USSA1976_MAX_ALTITUDE + 0.001))).toThrow(
      InvalidInputError,
    );
    expect(() => standardAtmosphere1976(metres(1e6))).toThrow(InvalidInputError);
    // A forged brand carrying NaN is still rejected.
    expect(() =>
      standardAtmosphere1976(Number.NaN as unknown as ReturnType<typeof metres>),
    ).toThrow(InvalidInputError);
  });

  it('accepts both ends of the domain', () => {
    expect(standardAtmosphere1976(metres(USSA1976_MIN_ALTITUDE)).pressure).toBeGreaterThan(101325);
    expect(standardAtmosphere1976(metres(USSA1976_MAX_ALTITUDE)).pressure).toBeGreaterThan(0);
  });
});

describe('standardAtmosphere1976 properties', () => {
  const altitude = fc.double({
    min: USSA1976_MIN_ALTITUDE,
    max: USSA1976_MAX_ALTITUDE,
    noNaN: true,
  });

  it('every output is finite and positive', () => {
    fc.assert(
      fc.property(altitude, (z) => {
        const s = standardAtmosphere1976(metres(z));
        return [
          s.molecularScaleTemperature,
          s.temperature,
          s.pressure,
          s.density,
          s.speedOfSound,
          s.dynamicViscosity,
          s.kinematicViscosity,
        ].every((v) => Number.isFinite(v) && v > 0);
      }),
      { seed: FAST_CHECK_SEED },
    );
  });

  it('pressure and density strictly decrease with altitude', () => {
    fc.assert(
      fc.property(altitude, altitude, (a, b) => {
        // Altitudes closer than 1 mm need not give different float64 pressures.
        if (Math.abs(a - b) < 1e-3) return true;
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const sLo = standardAtmosphere1976(metres(lo));
        const sHi = standardAtmosphere1976(metres(hi));
        return sLo.pressure > sHi.pressure && sLo.density > sHi.density;
      }),
      { seed: FAST_CHECK_SEED },
    );
  });

  it('temperature and pressure are continuous across every layer boundary', () => {
    for (const layer of ussa1976Layers().slice(1)) {
      const below = standardAtmosphere1976(
        geopotentialToGeometric(metres(layer.baseGeopotential - 1e-3)),
      );
      const above = standardAtmosphere1976(
        geopotentialToGeometric(metres(layer.baseGeopotential + 1e-3)),
      );
      expect(
        Math.abs(below.molecularScaleTemperature - above.molecularScaleTemperature),
      ).toBeLessThan(1e-4);
      expect(closeRel(below.pressure, above.pressure, 1e-6)).toBe(true);
    }
  });

  it('satisfies the gas law ρ R* T_M / M₀ = P (eq. 42) within 1e-12 relative', () => {
    fc.assert(
      fc.property(altitude, (z) => {
        const s = standardAtmosphere1976(metres(z));
        const p =
          (s.density * USSA1976_CONSTANTS.universalGasConstantRStar * s.molecularScaleTemperature) /
          USSA1976_CONSTANTS.seaLevelMolecularWeightM0;
        return closeRel(p, s.pressure, 1e-12);
      }),
      { seed: FAST_CHECK_SEED },
    );
  });

  it('is hydrostatic: dP/dH = −ρ g₀′ within 1e-6 relative (central difference over ±1 m′)', () => {
    fc.assert(
      fc.property(
        fc.double({
          min: USSA1976_MIN_ALTITUDE + 10,
          max: USSA1976_MAX_ALTITUDE - 10,
          noNaN: true,
        }),
        (z) => {
          const h: number = geometricToGeopotential(metres(z));
          const pUp = standardAtmosphere1976(geopotentialToGeometric(metres(h + 1))).pressure;
          const pDown = standardAtmosphere1976(geopotentialToGeometric(metres(h - 1))).pressure;
          const s = standardAtmosphere1976(metres(z));
          const dPdH = (pUp - pDown) / 2;
          return closeRel(dPdH, -s.density * USSA1976_CONSTANTS.seaLevelGravityG0, 1e-6);
        },
      ),
      { seed: FAST_CHECK_SEED },
    );
  });

  it('kinetic temperature equals T_M below 80 km and is lower above it', () => {
    fc.assert(
      fc.property(altitude, (z) => {
        const s = standardAtmosphere1976(metres(z));
        return z <= 80000
          ? s.temperature === s.molecularScaleTemperature
          : s.temperature < s.molecularScaleTemperature;
      }),
      { seed: FAST_CHECK_SEED },
    );
  });

  it('is deterministic: repeated calls are bit-identical', () => {
    fc.assert(
      fc.property(altitude, (z) => {
        const a = standardAtmosphere1976(metres(z));
        const b = standardAtmosphere1976(metres(z));
        return (
          Object.is(a.pressure, b.pressure) &&
          Object.is(a.density, b.density) &&
          Object.is(a.temperature, b.temperature) &&
          Object.is(a.speedOfSound, b.speedOfSound) &&
          Object.is(a.dynamicViscosity, b.dynamicViscosity) &&
          Object.is(a.kinematicViscosity, b.kinematicViscosity)
        );
      }),
      { seed: FAST_CHECK_SEED },
    );
  });
});
