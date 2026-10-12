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
  CUSTOMARY_UNIT_FACTORS,
  degreesToRadians,
  fahrenheitToKelvin,
  feetPerSecondToMetresPerSecond,
  feetToMetres,
  gramsToKilograms,
  inchesToMetres,
  milesPerHourToMetresPerSecond,
  millimetresToMetres,
  ouncesToKilograms,
  poundsForceToNewtons,
  poundsToKilograms,
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
  atmosphereModel,
  seaLevelEquivalent,
  ussa1976Layers,
  type AtmosphereBaseConditions,
  type StandardAtmosphereState,
} from './atmosphere/ussa1976.js';
export * from './flight/vector.js';
export {
  advanceOrientation,
  IDENTITY_QUATERNION,
  quaternionBetween,
  quaternionConjugate,
  quaternionFromAxisAngle,
  quaternionMultiply,
  quaternionNorm,
  quaternionNormalise,
  rotateVector,
  rotateVectorInverse,
  rotationFromAngularVelocity,
  type Quaternion,
} from './flight/quaternion.js';
export {
  BODY_AFT,
  BODY_NOSE,
  bodyToWorld,
  EAST,
  flightParameters,
  initialOrientation,
  NORTH,
  noseDirection,
  railDirection,
  REFERENCE_ORIENTATION,
  UP,
  velocityRegion,
  worldToBody,
  type FlightParameterInputs,
  type FlightParameters,
  type VelocityRegion,
} from './flight/frames.js';
export {
  gravityAt,
  GRAVITY_EFFECTIVE_EARTH_RADIUS,
  OPENROCKET_REFERENCE_GRAVITY_45N,
  STANDARD_GRAVITY,
  STANDARD_GRAVITY_MODEL,
  type GravityModel,
} from './flight/gravity.js';
export {
  openRocketWind,
  PINK_NOISE_COEFFICIENTS,
  PINK_NOISE_STANDARD_DEVIATION,
  pinkNoiseSequence,
  profileWindAt,
  TURBULENCE_SAMPLE_RATE_HZ,
  validateWindLayers,
  windField,
  windVelocity,
  type ConstantWind,
  type ProfileWind,
  type TurbulentWind,
  type VectorWind,
  type WindField,
  type WindLayer,
  type WindModel,
} from './environment/wind.js';
export { createRandom, type Random } from './numerics/random.js';
export {
  NAR_MAX_LAUNCH_ANGLE,
  validateLaunch,
  type LaunchRail,
  type LaunchSite,
  type LaunchWarning,
  type ValidatedLaunch,
} from './environment/launch.js';
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
  type FinCrossSection,
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
  combineRocket,
  motorMassPart,
  rocketMassProperties,
  structuralMassParts,
  type MotorMass,
  type PlacedComponent,
  type RocketMassProperties,
} from './geometry/assembly.js';
export {
  bodyTerm,
  centreOfPressure,
  finChordFraction,
  finRollFactor,
  finSetTerm,
  supersonicFinCnAlpha,
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
  motorCgAt,
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
  compressibleSkinFriction,
  frictionDragCoefficient,
  ROUGHNESS_HEIGHTS,
  skinFrictionCoefficient,
  type FrictionDragGeometry,
  type SkinFriction,
  type SkinFrictionRegime,
} from './drag/skin-friction.js';
export {
  baseDragCoefficient,
  boatTailPressureDrag,
  noseConePressureDrag,
  shoulderPressureDrag,
  stagnationDragCoefficient,
  stagnationPressureRatio,
  type BoatTailPressureDrag,
  type NosePressureDrag,
} from './drag/pressure-drag.js';
export { STONEY_NOSES, type StoneyCurve, type StoneyNose } from './drag/stoney-noses.js';
export { finPressureDrag, roundedLeadingEdgeDrag, type FinPressureDrag } from './drag/fin-drag.js';
export {
  baseDragArea,
  launchLugDrag,
  railButtonDrag,
  type ParasiticDrag,
} from './drag/base-parasitic.js';
export {
  axialDragCoefficient,
  axialDragScaling,
  dragCoefficient,
  jointAngle,
  meanAerodynamicChord,
  wettedArea,
  type DragInputs,
  type DragResult,
  type DragTerm,
} from './drag/drag.js';
export {
  aerodynamicForcesAndMoments,
  normalForceAtAngle,
  pitchDampingMoment,
  rollDampingMoment,
  type AeroContribution,
  type AeroInputs,
  type AeroModeOptions,
  type AeroResult,
} from './flight/aerodynamics.js';
export {
  DORMAND_PRINCE_TABLEAU,
  dormandPrinceStep,
  errorNorm,
  nextStepSize,
  rk4Step,
  type AdaptiveOptions,
  type Derivative,
  type DormandPrinceStep,
} from './flight/integrators.js';
export type {
  DragCurve,
  FlightVehicle,
  IntegratorOptions,
  MotorSource,
  RecoveryDevice,
  SimulationOptions,
} from './flight/vehicle.js';
export {
  AERO_MAX_ANGLE_OF_ATTACK,
  dragCurveAt,
  simulateFlight,
  validateDragCurve,
  type FlightEvent,
  type FlightEventKind,
  type FlightPhase,
  type FlightResult,
  type FlightSample,
  type FlightSummary,
} from './flight/simulate.js';
export {
  InvalidInputError,
  NonFiniteResultError,
  NotImplementedError,
  PhysicsError,
  SimulationStalledError,
} from './errors.js';
