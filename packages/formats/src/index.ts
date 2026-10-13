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
  parseOrk,
  type OrkDeployEvent,
  type OrkMotorMount,
  type OrkPlacedComponent,
  type OrkRecoveryDevice,
  type OrkRocket,
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
  CURRENT_SCHEMA_VERSION,
  newId,
  type DeployEvent,
  type DesignComponent,
  type DesignRecoveryDevice,
  type LaunchConditions,
  type LaunchRailSettings,
  type LaunchSiteSettings,
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
  assessMargin,
  DEFAULT_ROUGHNESS_HEIGHT,
  DESIGN_MACH,
  designFlightWarnings,
  designMassProperties,
  designMotor,
  designMotorCount,
  designMotorFitProblems,
  designMotorMass,
  designPlacedComponents,
  designSimulationOptions,
  designStability,
  designThrustToWeight,
  designVehicle,
  designWindModel,
  type DesignStability,
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
export { validateMotorSelection } from './design/validate.js';
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
export { FlightDataCsvError, parseFlightDataCsv } from './motors/flight-data.js';
export { orkToDesign, type LibraryMotorRef, type OrkImport } from './design/from-ork.js';
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
