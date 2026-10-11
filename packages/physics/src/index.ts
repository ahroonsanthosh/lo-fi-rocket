/**
 * @lo-fi-rocket/physics
 *
 * Pure, deterministic rocket physics. See CLAUDE.md (repository root) for the
 * rules this package is written under, docs/conventions.md for units and
 * coordinate frames, and docs/equations.md for every equation and its source.
 *
 * Implemented: units (plan 0001 Part A) and the U.S. Standard Atmosphere
 * 1976 (plan 0001 Part B).
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
  USSA1976_CONSTANTS,
  USSA1976_MAX_ALTITUDE,
  USSA1976_MIN_ALTITUDE,
  USSA1976_TOP_GEOPOTENTIAL,
  geometricToGeopotential,
  geopotentialToGeometric,
  molecularWeightRatio,
  standardAtmosphere1976,
  ussa1976Layers,
  type StandardAtmosphereState,
} from './atmosphere/ussa1976.js';
export { finiteResult } from './numerics/finite.js';
export {
  InvalidInputError,
  NonFiniteResultError,
  NotImplementedError,
  PhysicsError,
} from './errors.js';
