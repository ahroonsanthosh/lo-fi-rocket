import { describe, expect, it } from 'vitest';
import { displayValue, formatQuantity, parseQuantity, unitFor } from './display.js';

describe('display units (plan 0012, UNIT-5 to UNIT-11 and their inverses)', () => {
  it('metric: mm, g, °C, hPa, degrees', () => {
    expect(parseQuantity('25.4', 'mm', 'metric')).toBeCloseTo(0.0254, 15);
    expect(formatQuantity(0.0254, 'mm', 'metric')).toBe('25.4 mm');
    expect(formatQuantity(0.0426, 'g', 'metric')).toBe('42.6 g');
    expect(parseQuantity('20', 'temperature', 'metric')).toBeCloseTo(293.15, 12);
    expect(formatQuantity(101325, 'pressure', 'metric')).toBe('1013.3 hPa');
    expect(formatQuantity(Math.PI / 6, 'angle', 'metric')).toBe('30.0 °');
    expect(parseQuantity('90', 'angle', 'metric')).toBeCloseTo(Math.PI / 2, 15);
  });
  it('imperial: 1 in = 25.4 mm, 1 ft, 1 oz, 1 lb, 1 ft/s, 1 lbf, 68 °F = 20 °C', () => {
    expect(parseQuantity('1', 'mm', 'imperial')).toBe(0.0254);
    expect(displayValue(0.0254, 'mm', 'imperial')).toBe(1);
    expect(parseQuantity('1', 'm', 'imperial')).toBe(0.3048);
    expect(parseQuantity('1', 'g', 'imperial')).toBe(0.028349523125);
    expect(parseQuantity('1', 'kg', 'imperial')).toBe(0.45359237);
    expect(parseQuantity('1', 'velocity', 'imperial')).toBe(0.3048);
    expect(parseQuantity('1', 'force', 'imperial')).toBe(4.4482216152605);
    // (68 + 459.67) × 5/9 = 527.67 × 5/9 = 293.15
    expect(parseQuantity('68', 'temperature', 'imperial')).toBeCloseTo(293.15, 12);
    expect(displayValue(293.15, 'temperature', 'imperial')).toBeCloseTo(68, 12);
    expect(formatQuantity(0.1, 'mm', 'imperial')).toBe('3.937 in');
  });
  it('derived units from the exact factors: lb/ft³ and psi agree with the printed SP 811 factors', () => {
    // 0.45359237 / 0.3048³ = 0.45359237 / 0.028316846592 = 16.018463373960
    expect(unitFor('density', 'imperial').toSI(1)).toBeCloseTo(16.01846337396, 10);
    expect(Math.abs(unitFor('density', 'imperial').toSI(1) - 16.01846)).toBeLessThan(0.5e-5);
    // 4.4482216152605 / 0.0254² = 4.4482216152605 / 0.00064516 = 6894.757293168
    expect(unitFor('pressure', 'imperial').toSI(1)).toBeCloseTo(6894.757293168, 8);
    expect(Math.abs(unitFor('pressure', 'imperial').toSI(1) - 6894.757)).toBeLessThan(0.5e-3);
  });
  it('a streamer’s material (plan 0073): g/m², and oz/yd² = 0.028349523125/0.9144² kg/m² (SP 811 B.8 p. 52 prints 3.390 575 E−02)', () => {
    expect(unitFor('surfaceDensity', 'metric').toSI(41)).toBeCloseTo(0.041, 15);
    expect(unitFor('surfaceDensity', 'metric').label).toBe('g/m²');
    // 0.028349523125/0.83612736 = 0.033905747...
    expect(unitFor('surfaceDensity', 'imperial').toSI(1)).toBeCloseTo(0.0339057475, 10);
    expect(Math.abs(unitFor('surfaceDensity', 'imperial').toSI(1) - 0.03390575)).toBeLessThan(5e-9);
  });
  it('parse rejects blanks, words, NaN and Infinity', () => {
    expect(parseQuantity('', 'mm', 'metric')).toBeUndefined();
    expect(parseQuantity('abc', 'mm', 'metric')).toBeUndefined();
    expect(parseQuantity('NaN', 'mm', 'metric')).toBeUndefined();
    expect(parseQuantity('Infinity', 'mm', 'metric')).toBeUndefined();
    expect(parseQuantity('1e400', 'mm', 'metric')).toBeUndefined();
    expect(parseQuantity(' -2.5e1 ', 'mm', 'metric')).toBe(-0.025);
  });
});
