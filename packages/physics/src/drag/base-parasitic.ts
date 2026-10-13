/**
 * Base drag area and parasitic drag (plan 0009, DRAG-11, DRAG-12).
 * Niskanen §3.4.5 pp. 50 to 51 and §3.4.6 pp. 51 to 52.
 */
import { InvalidInputError } from '../errors.js';
import { finiteResult } from '../numerics/finite.js';
import type { Mach } from '../units/si.js';
import { stagnationDragCoefficient } from './pressure-drag.js';

/**
 * DRAG-11 reference area: the base area minus the area of the thrusting
 * motors (p. 51: "subtracting the area of the thrusting motors from the base
 * reference area"), `motorCount` of them for a cluster (plan 0057); never negative.
 */
export function baseDragArea(
  baseRadius: number,
  thrustingMotorDiameter: number | undefined,
  motorCount = 1,
): number {
  if (!(baseRadius >= 0))
    throw new InvalidInputError('base radius', baseRadius, 'must be 0 m or greater');
  const base = Math.PI * baseRadius * baseRadius;
  if (thrustingMotorDiameter === undefined) return base;
  if (!(thrustingMotorDiameter >= 0))
    throw new InvalidInputError('motor diameter', thrustingMotorDiameter, 'must be 0 m or greater');
  if (!(Number.isInteger(motorCount) && motorCount >= 1))
    throw new InvalidInputError('motor count', motorCount, 'must be a whole number, 1 or more');
  const one = (Math.PI * thrustingMotorDiameter * thrustingMotorDiameter) / 4;
  return Math.max(0, base - motorCount * one);
}

export interface ParasiticDrag {
  /** Referred to `area`. */
  readonly cd: number;
  readonly area: number;
}

/**
 * DRAG-12. Eqs. (3.95), (3.96) p. 52: a launch lug of length l, outer radius
 * r_ext, inner radius r_int (d = 2 r_ext): C_D• = max{1.3 − 0.3 l/d, 1} × (C_D•)stag,
 * A = π r_ext² − π r_int² max{1 − l/d, 0}.
 */
export function launchLugDrag(
  length: number,
  outerRadius: number,
  innerRadius: number,
  mach: Mach,
): ParasiticDrag {
  if (!(outerRadius > 0))
    throw new InvalidInputError('launch lug outer radius', outerRadius, 'must be greater than 0 m');
  if (!(innerRadius >= 0 && innerRadius < outerRadius)) {
    throw new InvalidInputError(
      'launch lug inner radius',
      innerRadius,
      'must be between 0 and the outer radius',
    );
  }
  if (!(length >= 0))
    throw new InvalidInputError('launch lug length', length, 'must be 0 m or greater');
  const d = 2 * outerRadius;
  const lOverD = length / d;
  const cd = Math.max(1.3 - 0.3 * lOverD, 1) * stagnationDragCoefficient(mach);
  const area =
    Math.PI * outerRadius * outerRadius -
    Math.PI * innerRadius * innerRadius * Math.max(1 - lOverD, 0);
  return {
    cd: finiteResult('launch lug drag', cd),
    area: finiteResult('launch lug drag area', area),
  };
}

/**
 * DRAG-12, rail pins (p. 52): "approximated as launch lugs with the same
 * frontal area as the pin and a length equal to their diameter", so the
 * factor is max{1.3 − 0.3, 1} = 1 and the area is the pin's frontal area,
 * taken as outer diameter × height (the silhouette seen from the front).
 */
export function railButtonDrag(outerDiameter: number, height: number, mach: Mach): ParasiticDrag {
  if (!(outerDiameter > 0))
    throw new InvalidInputError(
      'rail button outer diameter',
      outerDiameter,
      'must be greater than 0 m',
    );
  if (!(height > 0))
    throw new InvalidInputError('rail button height', height, 'must be greater than 0 m');
  return { cd: stagnationDragCoefficient(mach), area: outerDiameter * height };
}
