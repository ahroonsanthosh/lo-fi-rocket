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
  RseParseError,
  RseUnsupportedError,
} from './errors.js';
export { XmlSyntaxError } from './xml.js';
