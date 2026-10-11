/**
 * @lo-fi-rocket/formats
 *
 * Parsers and writers for motor and rocket design files. Implemented: the
 * minimal RASP .eng reader (plan 0004) and the minimal OpenRocket .ork reader
 * for the reference rockets (plan 0005). Scheduled: .rse (Phase 2), the
 * user-facing .ork importer and the native format (Phase 4).
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
export { EngParseError, FormatError, OrkParseError, OrkUnsupportedError } from './errors.js';
