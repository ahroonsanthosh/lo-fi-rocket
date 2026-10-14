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

/**
 * Plan 0070 (D-106): a part repeated `count` times, equally spaced around the rocket's axis with
 * its own axis at `radialOffset` from it: the parts of a pod set (OpenRocket's `<podset>`,
 * reference/rockets/pod-probe/values.txt). Such a part is outside the main body (not part of its
 * stacking, continuity or base); its mass, normal force and drag are its own times the count.
 */
export interface Instances {
  readonly count: number;
  readonly radialOffset: Metres;
}

/** Whether a placed part is a pod part (plan 0070), outside the main body. */
export function isPodPart(p: { readonly instances?: Instances }): boolean {
  return p.instances !== undefined;
}

/** The main body's parts: every part that is not a pod part (plan 0070). */
export function mainBodyParts<T extends { readonly instances?: Instances }>(
  components: readonly T[],
): T[] {
  return components.filter((p) => !isPodPart(p));
}

export interface PlacedComponent {
  readonly component: Component;
  /** x of the component's forward end in the rocket body frame (from the nose tip). */
  readonly position: Metres;
  /** Plan 0070: the part is repeated around the axis (a pod set's part); absent for one on-axis part. */
  readonly instances?: Instances;
  /** Optional mass and CG override (D-073). */
  readonly massOverride?: MassOverride;
  /**
   * Plan 0073 (D-110): the part's own surface roughness height R_s when it differs from the
   * design's finish (an OpenRocket file gives each external part its own). Only the skin friction
   * of a nose cone, body tube, transition or fin set uses it; absent means the design's finish.
   */
  readonly roughnessHeight?: Metres;
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
 * One motor of a cluster: its axis's offset from the rocket's axis, along the body y and z axes
 * (docs/conventions.md). Plan 0057.
 */
export interface ClusterOffset {
  readonly y: Metres;
  readonly z: Metres;
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
  /**
   * A cluster of identical motors, one per offset (plan 0057); `mass` is one motor's. Absent for
   * one motor on the axis.
   */
  readonly cluster?: readonly ClusterOffset[];
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

/** The number of motors and the sum of their squared distances from the axis (plan 0057). */
export function clusterSums(cluster: readonly ClusterOffset[] | undefined): {
  readonly count: number;
  readonly sumSquaredDistance: number;
} {
  if (cluster === undefined) return { count: 1, sumSquaredDistance: 0 };
  if (cluster.length === 0) {
    throw new InvalidInputError('motor cluster', 0, 'must list at least one motor offset');
  }
  let sum = 0;
  for (const { y, z } of cluster) {
    if (!(Number.isFinite(y) && Number.isFinite(z))) {
      throw new InvalidInputError(
        'motor cluster offset',
        Number.isFinite(y) ? z : y,
        'must be finite',
      );
    }
    sum += (y as number) ** 2 + (z as number) ** 2;
  }
  return { count: cluster.length, sumSquaredDistance: sum };
}

/**
 * The motor as a mass part in the rocket frame: a solid cylinder of the
 * given mass, CG at `cgFromForeEnd` (mid-length when absent), aft end at
 * `aftEnd` (GEO-12). A cluster is n such cylinders at the same axial position, each at distance
 * d_i from the axis (GEO-15): m = n m₁, I_x = n I_x1 + m₁ Σd_i², I_y = n I_y1 + m₁ Σd_i²/2, the
 * parallel axis theorem (N09 §4.2.3 p. 64) with the transverse term averaged over the two
 * transverse axes, as the axisymmetric model holds one transverse inertia.
 */
export function motorMassPart(motor: MotorMass): MassProperties {
  const m: number = motor.mass;
  const l: number = motor.length;
  const r = (motor.diameter as number) / 2;
  if (!(m >= 0)) throw new InvalidInputError('motor mass', m, 'must be 0 or greater');
  if (!(l > 0)) throw new InvalidInputError('motor length', l, 'must be greater than 0 m');
  if (!(r > 0))
    throw new InvalidInputError('motor diameter', motor.diameter, 'must be greater than 0 m');
  const { count: n, sumSquaredDistance: d2 } = clusterSums(motor.cluster);
  return {
    volume: n * Math.PI * r * r * l,
    mass: n * m,
    cgX: (motor.aftEnd as number) - l + (motor.cgFromForeEnd ?? l / 2),
    inertiaRotational: n * 0.5 * m * r * r + m * d2,
    inertiaLongitudinal: (n * (m * (3 * r * r + l * l))) / 12 + (m * d2) / 2,
  };
}

/** The structure's mass parts placed in the rocket frame (computed once per design by the simulator). */
export function structuralMassParts(components: readonly PlacedComponent[]): MassProperties[] {
  return components.map((pc) =>
    placed(
      repeated(
        overriddenMassProperties(componentMassProperties(pc.component), pc.massOverride),
        pc.instances,
      ),
      pc.position,
    ),
  );
}

/**
 * GEO-12 with plan 0070's instances: n copies of a part (its own override applied to each) at
 * distance r from the axis, equally spaced. Mass and volume n m, the CG along x unchanged; by the
 * parallel axis theorem the roll inertia is n (I_rot + m r²) and the pitch inertia
 * n (I_long + m r²/2): Σ cos²θ_k = n/2 for n ≥ 3 equally spaced, and the mean of the pitch and yaw
 * inertias for n = 1 or 2 (the axisymmetric model has one transverse inertia; listed).
 */
export function repeated(p: MassProperties, instances: Instances | undefined): MassProperties {
  if (instances === undefined) return p;
  const n = instances.count;
  const r: number = instances.radialOffset;
  if (!(Number.isInteger(n) && n >= 1)) {
    throw new InvalidInputError('pod count', n, 'must be a whole number, 1 or more');
  }
  if (!(r >= 0) || !Number.isFinite(r)) {
    throw new InvalidInputError('pod radial offset', r, 'must be 0 m or greater');
  }
  return {
    volume: n * p.volume,
    mass: n * p.mass,
    cgX: p.cgX,
    inertiaRotational: n * (p.inertiaRotational + p.mass * r * r),
    inertiaLongitudinal: n * (p.inertiaLongitudinal + (p.mass * r * r) / 2),
  };
}

/** The empty rocket as weighed (D-089): its mass and/or its CG from the nose tip, motor excluded. */
export interface AsBuilt {
  readonly mass?: Kilograms;
  readonly cg?: Metres;
}

/**
 * GEO-17 (D-089): the parts scaled and moved to the as-built mass M and CG C. Each part's mass
 * properties (with its own override, D-073) are scaled by M/M₀ and its CG moved by C − X̄₀, M₀ and
 * X̄₀ the parts' computed total and CG; by GEO-12 the result has exactly mass M and CG C, the
 * inertias scaled with the masses (as D-073) and carried by the parallel axis theorem. Expressed as
 * each part's mass override, so every consumer of the parts uses it. Parts of no mass stay so.
 */
export function withAsBuilt(
  components: readonly PlacedComponent[],
  asBuilt: AsBuilt | undefined,
): PlacedComponent[] {
  if (asBuilt === undefined || (asBuilt.mass === undefined && asBuilt.cg === undefined)) {
    return [...components];
  }
  const parts = structuralMassParts(components);
  let m0 = 0;
  let moment = 0;
  for (const p of parts) {
    m0 += p.mass;
    moment += p.mass * p.cgX;
  }
  if (!(m0 > 0)) {
    throw new InvalidInputError(
      'as-built mass and CG',
      m0,
      'need parts with mass to scale: add the parts first',
    );
  }
  if (asBuilt.mass !== undefined && !(Number.isFinite(asBuilt.mass) && asBuilt.mass > 0)) {
    throw new InvalidInputError('as-built mass', asBuilt.mass, 'must be greater than 0 kg');
  }
  if (asBuilt.cg !== undefined && !Number.isFinite(asBuilt.cg)) {
    throw new InvalidInputError(
      'as-built CG',
      asBuilt.cg,
      'must be a finite distance from the nose tip',
    );
  }
  const ratio = asBuilt.mass === undefined ? 1 : (asBuilt.mass as number) / m0;
  const shift = asBuilt.cg === undefined ? 0 : (asBuilt.cg as number) - moment / m0;
  return components.map((pc, i) => {
    const p = parts[i];
    if (p === undefined || !(p.mass > 0)) return pc;
    const position: number = pc.position;
    return {
      ...pc,
      massOverride: {
        ...(asBuilt.mass === undefined ? {} : { mass: kilograms(p.mass * ratio) }),
        ...(asBuilt.cg === undefined ? {} : { cg: metres(p.cgX - position + shift) }),
        // A part's own override that this one does not replace is kept.
        ...(asBuilt.mass === undefined && pc.massOverride?.mass !== undefined
          ? { mass: pc.massOverride.mass }
          : {}),
        ...(asBuilt.cg === undefined && pc.massOverride?.cg !== undefined
          ? { cg: pc.massOverride.cg }
          : {}),
      },
    };
  });
}

/** Combine precomputed structural parts with a motor part (GEO-12). */
export function combineRocket(
  structure: readonly MassProperties[],
  motor?: MotorMass,
): RocketMassProperties {
  const parts = motor === undefined ? [...structure] : [...structure, motorMassPart(motor)];
  return finishRocket(parts);
}

/**
 * Plan 0064: structural parts with several motors (GEO-12), the motors in the order given. With one
 * motor this is `combineRocket` exactly, part for part and in the same order.
 */
export function combineRocketMotors(
  structure: readonly MassProperties[],
  motors: readonly MotorMass[],
): RocketMassProperties {
  return finishRocket([...structure, ...motors.map(motorMassPart)]);
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
