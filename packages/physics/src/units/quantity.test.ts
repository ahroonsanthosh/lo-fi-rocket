import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import { defineQuantity } from './quantity.js';
import {
  cubicMetres,
  dimensionless,
  kelvin,
  kilogramSquareMetres,
  kilograms,
  kilogramsPerCubicMetre,
  mach,
  metres,
  metresPerSecond,
  metresPerSecondSquared,
  newtonSeconds,
  newtons,
  pascalSeconds,
  pascals,
  radians,
  radiansPerSecond,
  seconds,
  squareMetres,
  squareMetresPerSecond,
} from './si.js';

const FAST_CHECK_SEED = 20261011;

const constructors = {
  metres,
  squareMetres,
  cubicMetres,
  kilograms,
  kilogramsPerCubicMetre,
  kilogramSquareMetres,
  seconds,
  metresPerSecond,
  metresPerSecondSquared,
  newtons,
  newtonSeconds,
  kelvin,
  pascals,
  pascalSeconds,
  squareMetresPerSecond,
  radians,
  radiansPerSecond,
  mach,
  dimensionless,
} as const;

describe('defineQuantity', () => {
  const length = defineQuantity('Length', 'm');

  it('returns the input unchanged for finite values', () => {
    expect(length(0)).toBe(0);
    expect(length(-12.5)).toBe(-12.5);
    expect(Object.is(length(-0), -0)).toBe(true);
    expect(length(Number.MAX_VALUE)).toBe(Number.MAX_VALUE);
    expect(length(Number.MIN_VALUE)).toBe(Number.MIN_VALUE);
  });

  it('throws InvalidInputError naming the quantity for NaN and infinities', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      let caught: unknown;
      try {
        length(bad);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(InvalidInputError);
      const err = caught as InvalidInputError;
      expect(err.parameter).toBe('Length');
      expect(err.value).toBe(bad);
      expect(err.message).toBe(
        `Length is invalid: received ${String(bad)}; must be a finite number in m`,
      );
    }
  });
});

describe('SI quantity constructors', () => {
  const finiteDouble = fc.double({ noNaN: true, noDefaultInfinity: true });

  for (const [name, construct] of Object.entries(constructors)) {
    it(`${name} is the identity on every finite float64`, () => {
      fc.assert(
        fc.property(finiteDouble, (x) => Object.is(construct(x), x)),
        { seed: FAST_CHECK_SEED },
      );
    });

    it(`${name} rejects NaN and infinities`, () => {
      expect(() => construct(Number.NaN)).toThrow(InvalidInputError);
      expect(() => construct(Number.POSITIVE_INFINITY)).toThrow(InvalidInputError);
      expect(() => construct(Number.NEGATIVE_INFINITY)).toThrow(InvalidInputError);
    });
  }
});
