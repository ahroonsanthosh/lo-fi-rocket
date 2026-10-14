/**
 * @lo-fi-rocket/formats
 *
 * Parsers and writers for motor and rocket design files. Implemented: the
 * RASP .eng reader (plan 0004), the minimal OpenRocket .ork reader for the
 * reference rockets (plan 0005), the RockSim .rse reader and the conversion
 * of both motor formats to the physics motor definition (plan 0007).
 * Scheduled: the user-facing .ork importer and the native format (Phase 4).
 */
export { parseEng, type EngMotor, type ThrustPoint } from './eng.js';
export {
  OPENROCKET_FINISHES,
  orkRecoveryDevice,
  parseOrk,
  type OrkDeployEvent,
  type OrkMotorMount,
  type OrkParachute,
  type OrkPlacedComponent,
  type OrkRecoveryDevice,
  type OrkRocket,
  type OrkStreamer,
} from './ork.js';
export {
  parseRse,
  RSE_CG_TOLERANCE_M,
  RSE_ISP_TOLERANCE,
  RSE_MASS_COLUMN_TOLERANCE,
  STANDARD_GRAVITY_GN,
  type RseMassUnit,
  type RseMotor,
  type RseOptions,
  type RsePoint,
} from './rse.js';
export { motorFromEng, motorFromRse } from './motor-definition.js';
export {
  EngParseError,
  FormatError,
  OrkParseError,
  OrkUnsupportedError,
  OrkUnsupportedFeaturesError,
  RseParseError,
  RseUnsupportedError,
} from './errors.js';
export { XmlSyntaxError } from './xml.js';
export {
  InputTooLargeError,
  MAX_INPUT_BYTES,
  MAX_UNZIPPED_BYTES,
  MAX_XML_CHARACTERS,
  requireWithin,
} from './limits.js';
export {
  CURRENT_SCHEMA_VERSION,
  newId,
  type DeployEvent,
  type DesignComponent,
  type DesignPod,
  type DesignParachute,
  type DesignRecoveryDevice,
  type DesignStreamer,
  type DesignStage,
  type IgnitionEvent,
  type LaunchConditions,
  type LaunchRailSettings,
  type LaunchSiteSettings,
  type MotorIgnition,
  type MotorMount,
  type MotorProvenance,
  type MotorSelection,
  type RocketDesign,
  type SimulationSettings,
  type StabilityThresholds,
  type WarningThresholds,
  type WindLayerSettings,
  type WindSettings,
} from './design/model.js';
export { DesignError, DesignFileError } from './design/errors.js';
export { validateDesign } from './design/validate.js';
export {
  applyMigrations,
  migrateDesignDocument,
  MIGRATIONS,
  type Migration,
} from './design/migrate.js';
export { DESIGN_FILE_EXTENSION, parseDesign, serializeDesign } from './design/serialize.js';
export {
  stageMotorMount,
  stageRemovalProblem,
  withBottomStageRemoved,
  withComponentStage,
  withStageAdded,
  withStageMotorMount,
  withStages,
} from './design/stages.js';
export {
  decodeDesignLink,
  DESIGN_LINK_PREFIX,
  DesignLinkError,
  encodeDesignLink,
  isDesignLink,
  MAX_LINK_CHARACTERS,
  MAX_LINK_DESIGN_BYTES,
} from './design/link.js';
export {
  assessMargin,
  DEFAULT_ROUGHNESS_HEIGHT,
  DESIGN_MACH,
  designFlightWarnings,
  designIgnitions,
  designMassProperties,
  designMotor,
  designMotorCount,
  designMotorFitProblems,
  designMotorMass,
  designMotorMounts,
  designMotors,
  designPlacedComponents,
  designSimulationOptions,
  designStability,
  designStageCount,
  designStageStability,
  designStageName,
  designThrustToWeight,
  designVehicle,
  designWindModel,
  type DesignMotor,
  type DesignStability,
  type StageConfigurationStability,
  type DesignWarning,
  type MassCondition,
  type PhysicsMode,
  type StabilityAssessment,
} from './design/to-physics.js';
export {
  DEFAULT_SIMULATION_SETTINGS,
  DEFAULT_STABILITY_THRESHOLDS,
  DEFAULT_WARNING_THRESHOLDS,
  ESTES_D12,
  exampleDesign,
  newDesign,
} from './design/example.js';
export { COMPONENT_FIELDS, validateMotorSelection } from './design/validate.js';
export {
  componentLength,
  defaultComponent,
  defaultRecoveryDevice,
  isExternal,
  withoutComponent,
  type ComponentKind,
} from './design/defaults.js';
export {
  CsvThrustCurveError,
  parseThrustCurveCsv,
  type CustomMotorMetadata,
} from './motors/csv-thrust-curve.js';
export {
  downloadMotor,
  fetchMetadata,
  searchMotors,
  THRUSTCURVE_BASE_URL,
  ThrustCurveError,
  type DownloadedMotor,
  type Metadata,
  type MotorSummary,
  type SearchRequest,
  type SearchResult,
  type Transport,
} from './thrustcurve/client.js';
export {
  cachedThrustCurveMotor,
  getThrustCurveMotor,
  listCachedMotors,
  MOTOR_CACHE_PREFIX,
  putCachedMotor,
  removeCachedMotor,
  type CachedMotor,
  type KeyValueStore,
} from './thrustcurve/cache.js';
export { DragCurveCsvError, parseDragCurveCsv } from './motors/drag-curve.js';
export { BUNDLED_MOTOR_FILES } from './motors/bundled.js';
export { FlightDataCsvError, parseFlightDataCsv } from './motors/flight-data.js';
export { orkToDesign, type LibraryMotorRef, type OrkImport } from './design/from-ork.js';
export {
  Cdx1ParseError,
  importCdx1,
  RASAERO_FINISHES,
  type Cdx1Import,
  type Cdx1Prediction,
} from './cdx1.js';
export type { RecordedFlight } from './design/model.js';
export {
  DispersionError,
  flyRun,
  percentile,
  perturbDesign,
  runDispersion,
  sampleRun,
  sampleStatistics,
  summarise,
  validateDispersionSettings,
  ZERO_VARIATIONS,
  type DispersionResult,
  type DispersionRun,
  type DispersionSettings,
  type DispersionSummary,
  type DispersionVariations,
  type SampledValues,
  type SampleStatistics,
} from './dispersion/dispersion.js';
export type { DispersionSettingsRecord } from './design/model.js';
