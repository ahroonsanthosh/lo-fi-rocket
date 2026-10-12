/**
 * Build the physics package's format-independent `MotorDefinition` from a
 * parsed RASP or RockSim motor (plan 0007), choosing the mass rule the
 * source format implies and validating the result.
 */
import { validateMotor, type MotorDefinition } from '@lo-fi-rocket/physics';
import type { EngMotor } from './eng.js';
import { RseParseError } from './errors.js';
import type { RseMotor } from './rse.js';

/** RASP: thrust points with the implicit origin; mass by the impulse-proportional rule (MOT-3, D-028). */
export function motorFromEng(eng: EngMotor): MotorDefinition {
  const def: MotorDefinition = {
    designation: eng.designation,
    manufacturer: eng.manufacturer,
    diameter: eng.diameter,
    length: eng.length,
    totalMass: eng.totalMass,
    propellantMass: eng.propellantMass,
    points: eng.points,
    massRule: 'impulse-proportional',
    sourceFormat: 'RASP',
  };
  validateMotor(def);
  return def;
}

/**
 * RockSim: the file's `m` column when present (MOT-4, mass profile),
 * otherwise the guide's auto-calculation (linear in time) when
 * `auto-calc-mass` is set; a file with neither is rejected, as the guide
 * says its simulation would be incorrect.
 */
export function motorFromRse(rse: RseMotor, fileName?: string): MotorDefinition {
  const base = {
    designation: rse.designation,
    manufacturer: rse.manufacturer,
    diameter: rse.diameter,
    length: rse.length,
    totalMass: rse.totalMass,
    propellantMass: rse.propellantMass,
    points: rse.points.map((p) => ({ time: p.time, thrust: p.thrust })),
    sourceFormat: 'RockSim' as const,
  };
  let def: MotorDefinition;
  if (rse.massColumn !== 'none') {
    def = {
      ...base,
      massRule: 'mass-profile',
      massProfile: rse.points.map((p) => {
        if (p.propellantRemaining === undefined) {
          throw new RseParseError(
            fileName,
            `engine "${rse.designation}"`,
            'mass column missing on a point',
          );
        }
        return { time: p.time, propellantRemaining: p.propellantRemaining };
      }),
    };
  } else if (rse.autoCalcMass) {
    def = { ...base, massRule: 'linear-in-time' };
  } else {
    throw new RseParseError(
      fileName,
      `engine "${rse.designation}"`,
      'has neither an m column nor auto-calc-mass="1"; the format guide says such a file cannot be simulated correctly',
    );
  }
  validateMotor(def);
  return def;
}
