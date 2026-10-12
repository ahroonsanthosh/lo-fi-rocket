/**
 * Whole-rocket mass properties from placed components and a motor.
 * GEO-12. Niskanen (2009) section 4.2.3, p. 64: component masses, CGs and the two
 * moments of inertia are combined; the parallel axis theorem moves each
 * longitudinal inertia to the rocket CG.
 */
import { InvalidInputError } from '../errors.js';
import { finiteResult } from '../numerics/finite.js';
import {
  kilogramSquareMetres,
  kilograms,
  metres,
  type KilogramSquareMetres,
  type Kilograms,
  type Metres,
} from '../units/si.js';
import { combine, componentMassProperties, type Component } from './components.js';
import type { MassProperties } from './revolution.js';

export interface PlacedComponent {
  readonly component: Component;
  /** x of the component's forward end in the rocket body frame (from the nose tip). */
  readonly position: Metres;
}

/**
 * A motor for mass purposes: a solid cylinder of the given mass whose aft end
 * is at `aftEnd`; CG at mid-length (the RASP convention recorded in plan 0004).
 */
export interface MotorMass {
  readonly mass: Kilograms;
  readonly length: Metres;
  readonly diameter: Metres;
  readonly aftEnd: Metres;
  /** CG from the motor's forward end; mid-length when absent (plan 0004 convention, MOT-3). */
  readonly cgFromForeEnd?: Metres;
}

export interface RocketMassProperties {
  readonly mass: Kilograms;
  /** CG from the nose tip. */
  readonly cg: Metres;
  readonly inertiaRotational: KilogramSquareMetres;
  readonly inertiaLongitudinal: KilogramSquareMetres;
}

function placed(p: MassProperties, position: number): MassProperties {
  return { ...p, cgX: p.cgX + position };
}

export function rocketMassProperties(
  components: readonly PlacedComponent[],
  motor?: MotorMass,
): RocketMassProperties {
  const parts: MassProperties[] = components.map((pc) =>
    placed(componentMassProperties(pc.component), pc.position),
  );
  if (motor !== undefined) {
    const m: number = motor.mass;
    const l: number = motor.length;
    const r = (motor.diameter as number) / 2;
    if (!(m >= 0)) throw new InvalidInputError('motor mass', m, 'must be 0 or greater');
    if (!(l > 0)) throw new InvalidInputError('motor length', l, 'must be greater than 0 m');
    if (!(r > 0))
      throw new InvalidInputError('motor diameter', motor.diameter, 'must be greater than 0 m');
    parts.push({
      volume: Math.PI * r * r * l,
      mass: m,
      cgX: (motor.aftEnd as number) - l + (motor.cgFromForeEnd ?? l / 2),
      inertiaRotational: 0.5 * m * r * r,
      inertiaLongitudinal: (m * (3 * r * r + l * l)) / 12,
    });
  }
  if (parts.length === 0) {
    throw new InvalidInputError('components', parts.length, 'at least one component is required');
  }
  const total = combine(parts);
  return {
    mass: kilograms(finiteResult('rocket mass', total.mass)),
    cg: metres(finiteResult('rocket CG', total.cgX)),
    inertiaRotational: kilogramSquareMetres(
      finiteResult('rocket rotational inertia', total.inertiaRotational),
    ),
    inertiaLongitudinal: kilogramSquareMetres(
      finiteResult('rocket longitudinal inertia', total.inertiaLongitudinal),
    ),
  };
}
