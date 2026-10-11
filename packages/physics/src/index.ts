/**
 * @lo-fi-rocket/physics
 *
 * Pure, deterministic rocket physics. See CLAUDE.md (repository root) for the
 * rules this package is written under, docs/conventions.md for units and
 * coordinate frames, and docs/equations.md for every equation and its source.
 *
 * Nothing physical is implemented yet. The next step (units system and
 * U.S. Standard Atmosphere 1976) is planned in docs/plans/0001-units-and-atmosphere.md
 * and awaits approval.
 */
export type { Quantity, QuantityConstructor } from './units/quantity.js';
export { defineQuantity } from './units/quantity.js';
export * from './units/si.js';
export {
  celsiusToKelvin,
  degreesToRadians,
  gramsToKilograms,
  millimetresToMetres,
} from './units/convert.js';
export {
  InvalidInputError,
  NonFiniteResultError,
  NotImplementedError,
  PhysicsError,
} from './errors.js';
