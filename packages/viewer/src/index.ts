/**
 * @lo-fi-rocket/viewer
 *
 * A three.js replay of simulation results (plan 0034). It draws the
 * simulator's stored output and computes no physics: positions, attitudes,
 * velocities and events come from `FlightResult`; the geometry from the
 * design's components through the physics profiles. The DOM side (the
 * renderer and the controls) is the separate entry `@lo-fi-rocket/viewer/dom`.
 */
export {
  buildRocketObject,
  buttonGeometry,
  finGeometry,
  PART_COLOURS,
  PROFILE_SAMPLES,
  REVOLUTION_SEGMENTS,
  revolveOutline,
  rocketModelExtent,
  rocketModelParts,
  UNPLACED_PART_ANGLE,
  type ButtonPart,
  type FinPart,
  type ModelExtent,
  type ModelPart,
  type OutlinePoint,
  type RevolvedPart,
  type RocketObject,
} from './geometry/rocket-model.js';
export {
  displayPose,
  nearestStep,
  REPLAY_SPEEDS,
  ReplayController,
  type DisplayPose,
  type ReplayState,
} from './replay/clock.js';
export {
  EVENT_LABELS,
  eventMarkers,
  readoutsAt,
  readoutsNearest,
  type EventMarker,
  type Readouts,
} from './replay/readouts.js';
export {
  CAMERA_MODES,
  cameraPose,
  EVENT_COLOURS,
  FlightScene,
  gridSpacing,
  horizontalExtent,
  verticalExtent,
  type CameraMode,
  type CameraPose,
  type FlightExtents,
  type LabelKind,
  type RailInputs,
  type SceneInputs,
  type SceneLabel,
  type WindInputs,
} from './scene/flight-scene.js';
export {
  buildLandingObjects,
  circleOutline,
  covarianceEllipse,
  ellipseOutline,
  landingPoints,
  type CovarianceEllipse,
  type LandingObjects,
  type LandingPoint,
  type LandingResultLike,
  type LandingRunLike,
  type LandingSummaryLike,
} from './dispersion/landing-scatter.js';
export { SI_FORMATTER, type FormatKind, type Formatter } from './units.js';
