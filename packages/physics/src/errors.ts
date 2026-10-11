/**
 * Error types shared by the whole physics package.
 *
 * CLAUDE.md rules these implement:
 *  - Rule 2: nothing is stubbed. Unimplemented functionality throws
 *    `NotImplementedError` instead of returning a placeholder number.
 *  - Rule 3: invalid or out-of-range input is reported, never clamped or
 *    defaulted. `InvalidInputError` carries the offending value so the UI
 *    can show the user exactly what was wrong.
 *  - Section 8: the simulator never returns NaN or Infinity silently.
 *    `NonFiniteResultError` is thrown the moment one is detected.
 */

/** Base class so callers can catch every physics-package error in one clause. */
export class PhysicsError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/**
 * Thrown by any function whose physics is not implemented yet.
 * The message must say what is missing so the gap is visible to the user.
 */
export class NotImplementedError extends PhysicsError {
  constructor(what: string) {
    super(`Not implemented: ${what}`);
  }
}

/**
 * Thrown when an input is invalid, out of range, or outside the validity
 * range of the model being used. `parameter` is the human-readable name of
 * the input and `value` is what was received.
 */
export class InvalidInputError extends PhysicsError {
  readonly parameter: string;
  readonly value: unknown;

  constructor(parameter: string, value: unknown, requirement: string) {
    super(`${parameter} is invalid: received ${formatValue(value)}; ${requirement}`);
    this.parameter = parameter;
    this.value = value;
  }
}

/**
 * Thrown when a computation produces NaN or ±Infinity. `where` identifies
 * the calculation so the user can be told what went wrong and when.
 */
export class NonFiniteResultError extends PhysicsError {
  readonly where: string;
  readonly value: number;

  constructor(where: string, value: number) {
    super(`${where} produced a non-finite value (${formatValue(value)})`);
    this.where = where;
    this.value = value;
  }
}

function formatValue(value: unknown): string {
  if (typeof value === 'number') {
    return Object.is(value, -0) ? '-0' : String(value);
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (value === null || value === undefined) {
    return String(value);
  }
  if (typeof value === 'bigint' || typeof value === 'boolean' || typeof value === 'symbol') {
    return String(value);
  }
  return Object.prototype.toString.call(value);
}
