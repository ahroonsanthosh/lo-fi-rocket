/**
 * @lo-fi-rocket/formats
 *
 * Parsers and writers for motor and rocket design files. Implemented: the
 * minimal RASP .eng reader (plan 0004). Scheduled: .rse (Phase 2), the
 * user-facing .ork importer and the native format (Phase 4).
 */
export { parseEng, type EngMotor, type ThrustPoint } from './eng.js';
export { EngParseError, FormatError } from './errors.js';
