import { describe, expect, it } from 'vitest';
import {
  InvalidInputError,
  NonFiniteResultError,
  NotImplementedError,
  PhysicsError,
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
