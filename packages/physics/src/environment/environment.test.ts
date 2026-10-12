/** Wind and launch (plan 0008, ENV-1, ENV-2) and the atmosphere's launch-site conditions (ATM-11). */
import { describe, expect, it } from 'vitest';
import {
  atmosphereModel,
  seaLevelEquivalent,
  standardAtmosphere1976,
} from '../atmosphere/ussa1976.js';
import { InvalidInputError, NotImplementedError } from '../errors.js';
import { vec3, type Vec3 } from '../flight/vector.js';
import { kelvin, metres, metresPerSecond, pascals, radians } from '../units/si.js';
import { NAR_MAX_LAUNCH_ANGLE, validateLaunch } from './launch.js';
import { openRocketWind, windVelocity } from './wind.js';

const closeTo = (a: Vec3, b: Vec3, digits = 12): void => {
  expect(a.x).toBeCloseTo(b.x, digits);
  expect(a.y).toBeCloseTo(b.y, digits);
  expect(a.z).toBeCloseTo(b.z, digits);
};

describe('ENV-1 wind', () => {
  it('5 m/s from the north blows south: (0, −5, 0); from the east: (−5, 0, 0); from 225°: (3.5355, 3.5355, 0)', () => {
    closeTo(
      windVelocity({ kind: 'constant', speed: metresPerSecond(5), from: radians(0) }, 0),
      vec3(0, -5, 0),
      12,
    );
    closeTo(
      windVelocity({ kind: 'constant', speed: metresPerSecond(5), from: radians(Math.PI / 2) }, 0),
      vec3(-5, 0, 0),
      12,
    );
    closeTo(
      windVelocity(
        { kind: 'constant', speed: metresPerSecond(5), from: radians((5 * Math.PI) / 4) },
        100,
      ),
      vec3(3.5355339, 3.5355339, 0),
      6,
    );
  });
  it('OpenRocket direction π/2 gives a wind along +x; vector winds pass through; profiles and turbulence are plan 0016 models', () => {
    closeTo(windVelocity(openRocketWind(5, Math.PI / 2), 0), vec3(5, 0, 0), 12);
    closeTo(windVelocity({ kind: 'vector', velocity: vec3(1, 2, 0) }, 0), vec3(1, 2, 0), 15);
    expect(() =>
      windVelocity({ kind: 'constant', speed: metresPerSecond(-1), from: radians(0) }, 0),
    ).toThrow(InvalidInputError);
  });
});

describe('ENV-2 launch site and rail', () => {
  const site = { altitude: metres(0) };
  it('a 1.5 m vertical rail is valid with no warnings; the azimuth is normalised', () => {
    const v = validateLaunch(site, {
      length: metres(1.5),
      angleFromVertical: radians(0),
      azimuth: radians(-Math.PI / 2),
    });
    expect(v.warnings).toEqual([]);
    expect(v.rail.azimuth).toBeCloseTo((3 * Math.PI) / 2, 12);
    closeTo(v.railDirection, vec3(0, 0, 1), 15);
  });
  it('35° from vertical warns with the NAR 30° limit; 90° or a zero-length rail is invalid', () => {
    const v = validateLaunch(site, {
      length: metres(2),
      angleFromVertical: radians((35 * Math.PI) / 180),
      azimuth: radians(0),
    });
    expect(v.warnings.map((w) => w.code)).toEqual(['rail-angle-above-nar-limit']);
    expect(v.warnings[0]?.message).toContain('30°');
    expect(NAR_MAX_LAUNCH_ANGLE).toBeCloseTo(Math.PI / 6, 15);
    expect(() =>
      validateLaunch(site, {
        length: metres(0),
        angleFromVertical: radians(0),
        azimuth: radians(0),
      }),
    ).toThrow(InvalidInputError);
    expect(() =>
      validateLaunch(site, {
        length: metres(1),
        angleFromVertical: radians(Math.PI / 2),
        azimuth: radians(0),
      }),
    ).toThrow(InvalidInputError);
    expect(() =>
      validateLaunch(
        { altitude: metres(0), latitude: radians(2) },
        { length: metres(1), angleFromVertical: radians(0), azimuth: radians(0) },
      ),
    ).toThrow(InvalidInputError);
  });
});

describe('ATM-11 launch-site conditions (Niskanen p. 55)', () => {
  it('standard values at sea level reproduce the standard atmosphere exactly', () => {
    const base = {
      at: 'sea-level' as const,
      temperature: kelvin(288.15),
      pressure: pascals(101325),
    };
    for (const z of [0, 1000, 5000, 20000, 50000]) {
      expect(standardAtmosphere1976(metres(z), base)).toEqual(standardAtmosphere1976(metres(z)));
    }
  });
  it('T₀ = 300 K at sea level: density P₀M₀/(R*·300) = 101325 × 28.9644/(8314.32 × 300) = 1.176612 kg/m³', () => {
    const hot = standardAtmosphere1976(metres(0), {
      at: 'sea-level',
      temperature: kelvin(300),
      pressure: pascals(101325),
    });
    expect(hot.temperature).toBe(300);
    expect(hot.density).toBeCloseTo(1.176612, 6);
    // The lapse rate is unchanged: at 1 000 m′ the temperature is 300 − 6.5 = 293.5 K (geopotential 999.84 m′ → 293.501).
    const up = standardAtmosphere1976(metres(1000), {
      at: 'sea-level',
      temperature: kelvin(300),
      pressure: pascals(101325),
    });
    expect(up.molecularScaleTemperature).toBeCloseTo(300 - 0.0065 * 999.8427, 5);
  });
  it('site at 1 000 m with 280 K and 90 000 Pa: sea-level equivalent T₀ = 286.4990 K, P₀ = 101 535.4 Pa; the site values round-trip', () => {
    // H = 6 356 766 × 1000 / 6 357 766 = 999.8427 m′; T₀ = 280 + 0.0065 × 999.8427 = 286.49898 K;
    // exponent g₀′M₀/(R* L₀) = 0.0341632/(−0.0065) = −5.255876; P₀ = 90 000 × (280/286.49898)^(−5.255876) = 101 535.42 Pa.
    const base = {
      at: { altitude: metres(1000) },
      temperature: kelvin(280),
      pressure: pascals(90000),
    };
    const sl = seaLevelEquivalent(base);
    expect(sl.temperature).toBeCloseTo(286.49898, 5);
    expect(sl.pressure).toBeCloseTo(101535.42, 1);
    const atSite = atmosphereModel(base)(metres(1000));
    expect(atSite.temperature).toBeCloseTo(280, 9);
    expect(atSite.pressure).toBeCloseTo(90000, 6);
    // Above the site the standard lapse rate continues.
    const higher = atmosphereModel(base)(metres(2000));
    expect(higher.temperature).toBeLessThan(280);
  });
  it('rejects non-physical values and sites above the first layer', () => {
    expect(() =>
      seaLevelEquivalent({ at: 'sea-level', temperature: kelvin(0), pressure: pascals(1e5) }),
    ).toThrow(InvalidInputError);
    expect(() =>
      seaLevelEquivalent({ at: 'sea-level', temperature: kelvin(288), pressure: pascals(0) }),
    ).toThrow(InvalidInputError);
    expect(() =>
      seaLevelEquivalent({
        at: { altitude: metres(12000) },
        temperature: kelvin(220),
        pressure: pascals(20000),
      }),
    ).toThrow(NotImplementedError);
  });
});
