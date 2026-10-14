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
  railButtonGeometry,
  tubeOutline,
  buttonGeometry,
  finGeometry,
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
  type RocketLook,
  type RocketObject,
} from './geometry/rocket-model.js';
export {
  displayPose,
  frameStep,
  MAX_FRAME_STEP,
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
export {
  bracket,
  deployedCanopies,
  displayThrust,
  displayVelocity,
  inflation,
  maxThrust,
  smokeEmissions,
  smokePuffs,
  windVelocity,
  type CanopyState,
  type RecoveryInputs,
  type SmokeEmission,
  type SmokeOptions,
  type SmokePuff,
} from './scene/effects.js';
export {
  fbm,
  sceneryLayout,
  terrainHeight,
  valueNoise,
  type SceneryLayout,
} from './scene/scenery.js';
export {
  chooseZoom,
  decodeTerrarium,
  ElevationGrid,
  ELEVATION_SOURCE,
  IMAGERY_SOURCES,
  localToPixel,
  lonLatOfPixel,
  mapLevels,
  metresPerPixel,
  pixelToLocal,
  terrainDeviation,
  TILE_SIZE,
  tileRange,
  validateSite,
  worldPixel,
  type ImagerySource,
  type LaunchSite,
  type LonLat,
  type TileRange,
} from './map/tiles.js';
export {
  buildMapTerrain,
  curvatureDrop,
  EARTH_MEAN_RADIUS,
  mapTerrainGeometry,
  rangeBounds,
} from './scene/map-terrain.js';
export {
  PAINT_SCHEME_IDS,
  PAINT_SCHEMES,
  type Finish,
  type FinishKind,
  type PaintScheme,
  type PaintSchemeId,
} from './geometry/finish.js';
export {
  buildMotors,
  caseOutline,
  motorNozzles,
  motorStyle,
  nozzleOutline,
  type MotorInputs,
  type MotorNozzle,
  type MotorStyle,
} from './geometry/motor-model.js';
export { chordAt, finSectionGeometry, sectionHalfThickness } from './geometry/fin-section.js';
export {
  launchGuide,
  railProfile,
  RAIL_1010,
  RAIL_1515,
  type LaunchGuide,
} from './scene/launcher.js';
export {
  SKY_HAZE,
  SKY_SUN_ELEVATION,
  SKY_SUN_U,
  SKY_YAW,
  skyDirection,
  skyUv,
  SUN_AZIMUTH,
  SUN_DIRECTION,
} from './scene/sky.js';
export { placeTrees, TREE_VARIANTS, type TreeVariant } from './scene/trees.js';
