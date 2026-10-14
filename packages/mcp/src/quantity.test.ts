/**
 * Quantity strings against hand values (plan 0062). Each unit's factor is the sourced conversion
 * of the physics package (UNIT-1 to UNIT-13); the expected values are worked by hand here.
 */
import { describe, expect, it } from 'vitest';
import { QuantityError, toSi } from './quantity.js';

describe('toSi', () => {
  it('takes SI numbers as they are, and plain number strings', () => {
    expect(toSi('x', 'length', 0.038)).toBe(0.038);
    expect(toSi('x', 'length', '0.038')).toBe(0.038);
    expect(toSi('x', 'number', '3')).toBe(3);
  });

  it('converts each accepted unit to its hand value', () => {
    // 38 mm = 0.038 m; 2.5 cm = 0.025 m; 1.5 in = 1.5 × 0.0254 = 0.0381 m; 2 ft = 0.6096 m.
    expect(toSi('x', 'length', '38 mm')).toBe(0.038);
    expect(toSi('x', 'length', '2.5cm')).toBe(0.025);
    expect(toSi('x', 'length', '1.5 in')).toBeCloseTo(0.0381, 15);
    expect(toSi('x', 'length', '1.5"')).toBeCloseTo(0.0381, 15);
    expect(toSi('x', 'length', '2 ft')).toBeCloseTo(0.6096, 15);
    // 120 g = 0.12 kg; 4 oz = 4 × 0.028349523125 = 0.1133980925 kg; 1 lb = 0.45359237 kg.
    expect(toSi('x', 'mass', '120 g')).toBe(0.12);
    expect(toSi('x', 'mass', '4 oz')).toBeCloseTo(0.1133980925, 15);
    expect(toSi('x', 'mass', '1 lb')).toBe(0.45359237);
    // 3° = 3π/180 = 0.0523598775598299 rad.
    expect(toSi('x', 'angle', '3 deg')).toBeCloseTo(0.0523598775598299, 15);
    expect(toSi('x', 'angle', '3°')).toBeCloseTo(0.0523598775598299, 15);
    // 20 °C = 293.15 K; 68 °F = (68 + 459.67) × 5/9 = 293.15 K.
    expect(toSi('x', 'temperature', '20 C')).toBeCloseTo(293.15, 12);
    expect(toSi('x', 'temperature', '68 °F')).toBeCloseTo(293.15, 12);
    // 1013.25 hPa = 101 325 Pa; 36 km/h = 10 m/s; 10 mph = 4.4704 m/s; 0.68 g/cm³ = 680 kg/m³.
    expect(toSi('x', 'pressure', '1013.25 hPa')).toBe(101325);
    expect(toSi('x', 'speed', '36 km/h')).toBe(10);
    expect(toSi('x', 'speed', '10 mph')).toBeCloseTo(4.4704, 14);
    expect(toSi('x', 'density', '0.68 g/cm3')).toBeCloseTo(680, 12);
    // 1500 ms = 1.5 s.
    expect(toSi('x', 'time', '1500 ms')).toBe(1.5);
  });

  it('refuses unknown units, words and non-finite numbers, naming the field and the units', () => {
    expect(() => toSi('fins.span', 'length', '3 furlongs')).toThrow(
      'fins.span: unit "furlongs" is not accepted; give a number in m or one of m, cm, mm, in',
    );
    expect(() => toSi('x', 'length', 'long')).toThrow(QuantityError);
    expect(() => toSi('x', 'length', Number.NaN)).toThrow(/finite/);
    expect(() => toSi('x', 'mass', '3 mm')).toThrow(/unit "mm" is not accepted/);
    expect(() => toSi('x', 'number', '3 mm')).toThrow(/a plain number/);
  });
});

describe('toSi on hostile input (CodeQL js/polynomial-redos)', () => {
  it('rejects a long digit run with many spaces in linear time', () => {
    const start = performance.now();
    expect(() => toSi('x', 'length', `.9${' '.repeat(50_000)}x`)).toThrow(QuantityError);
    expect(() => toSi('x', 'length', `${'9'.repeat(50_000)}x`)).toThrow(QuantityError);
    // 50 001 nines is beyond float64: refused as not finite, quickly.
    expect(() => toSi('x', 'length', `9${'9'.repeat(50_000)}\n`)).toThrow(/finite/);
    expect(() => toSi('x', 'length', `9${'9'.repeat(50_000)}\nx`)).toThrow(QuantityError);
    expect(performance.now() - start).toBeLessThan(500);
  });
});
