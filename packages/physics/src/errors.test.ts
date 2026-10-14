import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  IntegrationUnstableError,
  InvalidInputError,
  NonFiniteResultError,
  NotImplementedError,
  PhysicsError,
  stepRoundedDown,
} from './errors.js';

describe('NotImplementedError', () => {
  it('names what is missing and is a PhysicsError', () => {
    const err = new NotImplementedError('supersonic fin pressure drag');
    expect(err).toBeInstanceOf(PhysicsError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('NotImplementedError');
    expect(err.message).toBe('Not implemented: supersonic fin pressure drag');
  });
});

describe('InvalidInputError', () => {
  it('reports parameter, received value and requirement', () => {
    const err = new InvalidInputError('fin root chord', -0.01, 'must be greater than 0 m');
    expect(err).toBeInstanceOf(PhysicsError);
    expect(err.name).toBe('InvalidInputError');
    expect(err.parameter).toBe('fin root chord');
    expect(err.value).toBe(-0.01);
    expect(err.message).toBe('fin root chord is invalid: received -0.01; must be greater than 0 m');
  });

  it('formats NaN, -0, strings and objects legibly', () => {
    expect(new InvalidInputError('x', Number.NaN, 'r').message).toContain('received NaN');
    expect(new InvalidInputError('x', -0, 'r').message).toContain('received -0');
    expect(new InvalidInputError('x', 'abc', 'r').message).toContain('received "abc"');
    expect(new InvalidInputError('x', undefined, 'r').message).toContain('received undefined');
    expect(new InvalidInputError('x', { a: 1 }, 'r').message).toContain('received [object Object]');
  });
});

describe('NonFiniteResultError', () => {
  it('names the calculation and the offending value', () => {
    const err = new NonFiniteResultError('atmosphere density at 12000 m', Number.POSITIVE_INFINITY);
    expect(err).toBeInstanceOf(PhysicsError);
    expect(err.name).toBe('NonFiniteResultError');
    expect(err.where).toBe('atmosphere density at 12000 m');
    expect(err.value).toBe(Number.POSITIVE_INFINITY);
    expect(err.message).toBe(
      'atmosphere density at 12000 m produced a non-finite value (Infinity)',
    );
  });
});

describe('IntegrationUnstableError (plan 0073)', () => {
  it('advises a step rounded down to two figures, never above the safe one', () => {
    // The validation campaign's case: a safe step of 0.00199 s was printed "0.0020", the step
    // just refused.
    expect(stepRoundedDown(0.00199)).toBe('0.0019');
    expect(stepRoundedDown(0.0123)).toBe('0.012');
    expect(stepRoundedDown(0.5)).toBe('0.50');
    expect(stepRoundedDown(0.00999999)).toBe('0.0099');
    const e = new IntegrationUnstableError(1.5, 'roll', 0.00199, 'detail.');
    expect(e.message).toContain('Use a time step of at most 0.0019 s');
    expect(e.safeStep).toBe(0.00199);
  });

  it('every advised step is at most the safe step', () => {
    fc.assert(
      fc.property(fc.double({ min: 1e-7, max: 10, noNaN: true }), (step) => {
        expect(Number(stepRoundedDown(step))).toBeLessThanOrEqual(step);
      }),
    );
  });
});
