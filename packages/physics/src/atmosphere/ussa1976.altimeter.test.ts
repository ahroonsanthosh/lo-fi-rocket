import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { kelvin, metres, pascals } from '../units/si.js';
import {
  atmosphereModel,
  barometricAltimeterReading,
  standardAtmosphere1976,
  standardPressureAltitude,
} from './ussa1976.js';

describe('ATM-12 and ATM-13: what a barometric altimeter reads (plan 0081)', () => {
  it("inverts the standard's pressure at its layer bases and inside a layer (eqs. 33a, 33b)", () => {
    // The base pressures by hand in ussa1976.test.ts: 22632.064 Pa at 11 km′, 5474.889 Pa at 20 km′,
    // 868.0187 Pa at 32 km′, and 12044.571 Pa at 15 km′ (isothermal layer).
    expect(standardPressureAltitude(pascals(101325))).toBeCloseTo(0, 6);
    expect(standardPressureAltitude(pascals(22632.064))).toBeCloseTo(11000, 1);
    expect(standardPressureAltitude(pascals(12044.571))).toBeCloseTo(15000, 1);
    expect(standardPressureAltitude(pascals(5474.889))).toBeCloseTo(20000, 1);
    expect(standardPressureAltitude(pascals(868.0187))).toBeCloseTo(32000, 1);
    expect(() => standardPressureAltitude(pascals(0))).toThrow();
    expect(() => standardPressureAltitude(pascals(0.1))).toThrow();
  });

  it('a 100 °F day at 2750 ft: a true 1327.7 m climb reads 1206.60 m', () => {
    // By hand (independent of the code): r₀ = 6356766 m, g₀′M₀/R* = 0.0341632 K/m′, L = −0.0065 K/m′.
    // Site Z 838.2 m → H 838.0895 m′; standard T 282.7024 K, so P_site = 101325 (288.15/282.7024)^(−5.25588)
    //   = 91653.73 Pa (the importer's standard pressure at the site, ATM-11).
    // The day: T_site 310.9278 K (100 °F); sea-level equivalent 316.3755 K; at Z 2165.9 m (H 2165.1623 m′)
    //   T 302.3018 K and P = 91653.73 (302.3018/310.9278)^5.25588 = 79055.07 Pa.
    // The altimeter: H(P) = (288.15/−0.0065) [(P/101325)^0.190263 − 1]: 838.0895 m′ and 2044.6934 m′.
    // Reading 1206.6040 m; the true climb is 1327.7 m (9.1 % more).
    const site = metres(838.2);
    const hot = atmosphereModel({
      at: { altitude: site },
      temperature: kelvin(310.92778),
      pressure: standardAtmosphere1976(site).pressure,
    });
    expect(barometricAltimeterReading(hot, site, metres(1327.7))).toBeCloseTo(1206.604, 2);
    // A standard day: the reading is the geopotential climb, 1327.0728 m′.
    const standard = atmosphereModel();
    expect(barometricAltimeterReading(standard, site, metres(1327.7))).toBeCloseTo(1327.0728, 3);
  });

  it('properties: the reading rises with height, and a warmer day never reads higher', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1500, noNaN: true }),
        fc.double({ min: 250, max: 320, noNaN: true }),
        fc.double({ min: 0, max: 5, noNaN: true }),
        fc.double({ min: 10, max: 20000, noNaN: true }),
        fc.double({ min: 1, max: 1000, noNaN: true }),
        (z, t, dt, h, dh) => {
          const site = metres(z);
          const day = (temperature: number): ReturnType<typeof atmosphereModel> =>
            atmosphereModel({
              at: { altitude: site },
              temperature: kelvin(temperature),
              pressure: standardAtmosphere1976(site).pressure,
            });
          const a = day(t);
          const lower = barometricAltimeterReading(a, site, metres(h)) as number;
          const higher = barometricAltimeterReading(a, site, metres(h + dh)) as number;
          const warmer = barometricAltimeterReading(day(t + dt), site, metres(h)) as number;
          return higher > lower && warmer <= lower + 1e-9;
        },
      ),
    );
  });
});
