import { NonFiniteResultError } from '../errors.js';

/**
 * Returns `value` if it is a finite float64, otherwise throws
 * `NonFiniteResultError` naming the calculation (CLAUDE.md section 8: the
 * engine never returns NaN or ±Infinity silently). Every public physics
 * function passes its results through this before branding them.
 */
export function finiteResult(where: string, value: number): number {
  if (!Number.isFinite(value)) {
    throw new NonFiniteResultError(where, value);
  }
  return value;
}
