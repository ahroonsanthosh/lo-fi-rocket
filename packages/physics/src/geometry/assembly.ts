/**
 * Whole-rocket mass properties from placed components and a motor.
 * GEO-12. Niskanen (2009) section 4.2.3, p. 64: component masses, CGs and the two
 * moments of inertia are combined; the parallel axis theorem moves each
 * longitudinal inertia to the rocket CG.
 */
import type { Approximation } from '../fidelity.js';
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

/**
 * A user-entered mass or CG for a component (CLAUDE.md 6.1, review finding
 * G-8, D-073). The mass is the total over every instance (all fins of a fin
 * set, all rail buttons); the CG is measured from the component's forward end
 * (`position`) along x. Rule (D-073), matching OpenRocket 24.12 as a black box:
 * - a mass override replaces the computed mass and scales the component's
 *   own moments of inertia by the same ratio (same shape, uniform density);
 * - a CG override moves the component's CG and keeps its own moments of
 *   inertia about that CG; the rocket's longitudinal inertia then follows from
 *   the parallel axis theorem in `combine` (GEO-12).
 */
export interface MassOverride {
  readonly mass?: Kilograms;
  readonly cg?: Metres;
}

export interface PlacedComponent {
  readonly component: Component;
  /** x of the component's forward end in the rocket body frame (from the nose tip). */
  readonly position: Metres;
  /** Optional mass and CG override (D-073). */
  readonly massOverride?: MassOverride;
  /**
   * What this part's entry does not represent exactly, carried with the part so that it travels
   * with it and disappears when the part is replaced (D-083, D-084); listed in every result.
   */
  readonly approximations?: readonly Approximation[];
}

/** The component's own mass properties (cgX from its forward end) with any override applied (D-073). */
export function overriddenMassProperties(
  computed: MassProperties,
  override: MassOverride | undefined,
): MassProperties {
  if (override === undefined) return computed;
  let p = computed;
  if (override.mass !== undefined) {
    const m: number = override.mass;
    if (!(Number.isFinite(m) && m >= 0)) {
      throw new InvalidInputError('mass override', m, 'must be a finite mass of 0 kg or more');
    }
    if (!(computed.mass > 0)) {
      throw new InvalidInputError(
        'mass override',
        m,
        'cannot be applied to a component whose computed mass is 0 kg (its inertia cannot be scaled)',
      );
    }
    const ratio = m / computed.mass;
    p = {
      ...p,
      mass: m,
      inertiaRotational: computed.inertiaRotational * ratio,
      inertiaLongitudinal: computed.inertiaLongitudinal * ratio,
    };
  }
  if (override.cg !== undefined) {
    const x: number = override.cg;
    if (!Number.isFinite(x)) {
      throw new InvalidInputError(
        'CG override',
        x,
        'must be a finite distance from the component front',
      );
    }
    p = { ...p, cgX: x };
  }
  return p;
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

/**
 * The motor as a mass part in the rocket frame: a solid cylinder of the
 * given mass, CG at `cgFromForeEnd` (mid-length when absent), aft end at
 * `aftEnd` (GEO-12).
 */
export function motorMassPart(motor: MotorMass): MassProperties {
  const m: number = motor.mass;
  const l: number = motor.length;
  const r = (motor.diameter as number) / 2;
  if (!(m >= 0)) throw new InvalidInputError('motor mass', m, 'must be 0 or greater');
  if (!(l > 0)) throw new InvalidInputError('motor length', l, 'must be greater than 0 m');
  if (!(r > 0))
    throw new InvalidInputError('motor diameter', motor.diameter, 'must be greater than 0 m');
  return {
    volume: Math.PI * r * r * l,
    mass: m,
    cgX: (motor.aftEnd as number) - l + (motor.cgFromForeEnd ?? l / 2),
    inertiaRotational: 0.5 * m * r * r,
    inertiaLongitudinal: (m * (3 * r * r + l * l)) / 12,
  };
}

/** The structure's mass parts placed in the rocket frame (computed once per design by the simulator). */
export function structuralMassParts(components: readonly PlacedComponent[]): MassProperties[] {
  return components.map((pc) =>
    placed(
      overriddenMassProperties(componentMassProperties(pc.component), pc.massOverride),
      pc.position,
    ),
  );
}

/** Combine precomputed structural parts with a motor part (GEO-12). */
export function combineRocket(
  structure: readonly MassProperties[],
  motor?: MotorMass,
): RocketMassProperties {
  const parts = motor === undefined ? [...structure] : [...structure, motorMassPart(motor)];
  return finishRocket(parts);
}

export function rocketMassProperties(
  components: readonly PlacedComponent[],
  motor?: MotorMass,
): RocketMassProperties {
  return combineRocket(structuralMassParts(components), motor);
}

function finishRocket(parts: MassProperties[]): RocketMassProperties {
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
