/**
 * @lo-fi-rocket/physics
 *
 * Pure, deterministic rocket physics. See CLAUDE.md (repository root) for the
 * rules this package is written under, docs/conventions.md for units and
 * coordinate frames, and docs/equations.md for every equation and its source.
 *
 * Implemented: units (plan 0001 Part A), the U.S. Standard Atmosphere 1976
 * (plan 0001 Part B), and component geometry and mass properties (plan 0003).
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
  noseProfile,
  transitionProfile,
  type NoseShape,
  type Profile,
} from './geometry/profiles.js';
export {
  DEFAULT_PANELS,
  innerRadius,
  integrate,
  revolutionMassProperties,
  type MassProperties,
} from './geometry/revolution.js';
export {
  combine,
  componentMassProperties,
  type Component,
  type MassItemComponent,
  type NoseConeComponent,
  type RailButtonComponent,
  type RingComponent,
  type Shoulder,
  type TransitionComponent,
  type TrapezoidFinSetComponent,
  type TubeComponent,
} from './geometry/components.js';
export {
  R1_COMPONENTS,
  R2_COMPONENTS,
  R3_COMPONENTS,
  R4_COMPONENTS,
  R5_COMPONENTS,
  REFERENCE_MOTORS,
} from './geometry/reference-rockets.js';
export {
  rocketMassProperties,
  type MotorMass,
  type PlacedComponent,
  type RocketMassProperties,
} from './geometry/assembly.js';
export {
  bodyTerm,
  centreOfPressure,
  finRollFactor,
  finSetTerm,
  maximumBodyDiameter,
  noseConeTerm,
  prandtlBeta,
  rocketStability,
  stabilityMargin,
  transitionTerm,
  type AerodynamicTerm,
  type CentreOfPressureOptions,
  type CentreOfPressureResult,
  type ComponentContribution,
  type FinSetTerm,
  type RollAngle,
  type StabilityResult,
} from './stability/barrowman.js';
export {
  burnTime,
  impulseTo,
  motorMassAt,
  motorStateAt,
  propellantRemainingAt,
  thrustAt,
  totalImpulse,
  validateMotor,
  type MotorDefinition,
  type MotorMassProfilePoint,
  type MotorMassRule,
  type MotorState,
  type MotorThrustPoint,
} from './motor/motor.js';
export {
  InvalidInputError,
  NonFiniteResultError,
  NotImplementedError,
  PhysicsError,
} from './errors.js';
