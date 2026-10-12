/**
 * Motor thrust, impulse, mass and CG during the burn (plan 0007; register
 * entries MOT-1 to MOT-4 in docs/equations.md).
 *
 * A `MotorDefinition` is format independent: the RASP and RockSim readers
 * in packages/formats build one, and a user-supplied thrust curve with an
 * explicit propellant mass profile (liquid engines, Phase 5) uses the same
 * record with `massRule: 'mass-profile'`. Every quantity here is a stated
 * rule applied to the file's data, and the rule in force is part of the
 * record so results can say which was used.
 *
 * Conventions: time from ignition in seconds; the motor's own x axis runs
 * from its forward end (x = 0) to its aft end (x = length).
 */
import { InvalidInputError } from '../errors.js';
import { finiteResult } from '../numerics/finite.js';
import type { MotorMass } from '../geometry/assembly.js';
import {
  kilograms,
  metres,
  newtons,
  newtonSeconds,
  type Kilograms,
  type Metres,
  type NewtonSeconds,
  type Newtons,
  type Seconds,
} from '../units/si.js';

export interface MotorThrustPoint {
  readonly time: Seconds;
  readonly thrust: Newtons;
}

export interface MotorMassProfilePoint {
  readonly time: Seconds;
  /** Propellant (consumables) remaining at `time`. */
  readonly propellantRemaining: Kilograms;
}

/**
 * MOT-3: propellant consumed in proportion to the impulse delivered (RASP
 * motors, D-028). MOT-4: linear in time (RockSim auto-calculation without a
 * mass column) or interpolated in an explicit profile (RockSim `m` column,
 * custom profiles).
 */
export type MotorMassRule = 'impulse-proportional' | 'linear-in-time' | 'mass-profile';

export interface MotorDefinition {
  readonly designation: string;
  readonly manufacturer: string;
  readonly diameter: Metres;
  readonly length: Metres;
  /** Loaded mass at ignition. */
  readonly totalMass: Kilograms;
  /** Mass of all consumables. */
  readonly propellantMass: Kilograms;
  /** Thrust curve starting at t = 0 (the origin point included) and ending at the burn time. */
  readonly points: readonly MotorThrustPoint[];
  readonly massRule: MotorMassRule;
  /** Required for `massRule: 'mass-profile'`, ignored otherwise. */
  readonly massProfile?: readonly MotorMassProfilePoint[];
  /** Where the data came from, for display only. */
  readonly sourceFormat: 'RASP' | 'RockSim' | 'custom';
}

export interface MotorState {
  readonly time: Seconds;
  readonly thrust: Newtons;
  /** Impulse delivered from ignition to `time`. */
  readonly impulseDelivered: NewtonSeconds;
  readonly propellantRemaining: Kilograms;
  /** Casing plus remaining propellant. */
  readonly mass: Kilograms;
  /** CG from the motor's forward end: mid-length (plan 0004 convention, D-029). */
  readonly cgFromForeEnd: Metres;
  readonly massRule: MotorMassRule;
  readonly burning: boolean;
}

/** Validate a definition once; every other function assumes a validated one. */
export function validateMotor(def: MotorDefinition): void {
  const d: number = def.diameter;
  const l: number = def.length;
  const mt: number = def.totalMass;
  const mp: number = def.propellantMass;
  if (!(d > 0)) throw new InvalidInputError('motor diameter', d, 'must be greater than 0 m');
  if (!(l > 0)) throw new InvalidInputError('motor length', l, 'must be greater than 0 m');
  if (!(mp > 0)) throw new InvalidInputError('propellant mass', mp, 'must be greater than 0 kg');
  if (!(mt > mp)) {
    throw new InvalidInputError('motor total mass', mt, 'must be greater than the propellant mass');
  }
  const pts = def.points;
  const first = pts[0];
  if (first === undefined)
    throw new InvalidInputError('thrust points', 0, 'at least two points are needed');
  if ((first.time as number) !== 0) {
    throw new InvalidInputError('first thrust point time', first.time, 'must be 0 s (ignition)');
  }
  if (pts.length < 2)
    throw new InvalidInputError('thrust points', pts.length, 'at least two points are needed');
  let prev = -1;
  for (const [i, p] of pts.entries()) {
    const t: number = p.time;
    const f: number = p.thrust;
    if (!Number.isFinite(t) || t < prev) {
      throw new InvalidInputError(
        `thrust point ${String(i)} time`,
        t,
        'must be finite and not before the previous point',
      );
    }
    if (!Number.isFinite(f) || f < 0) {
      throw new InvalidInputError(
        `thrust point ${String(i)} thrust`,
        f,
        'must be finite and 0 N or greater',
      );
    }
    prev = t;
  }
  if (!(prev > 0)) throw new InvalidInputError('burn time', prev, 'must be greater than 0 s');
  if (def.massRule === 'impulse-proportional' && !(rawTotalImpulse(def) > 0)) {
    throw new InvalidInputError(
      'total impulse',
      rawTotalImpulse(def),
      'must be greater than 0 N·s for the impulse-proportional mass rule',
    );
  }
  if (def.massRule === 'mass-profile') {
    const prof = def.massProfile;
    const p0 = prof?.[0];
    if (prof === undefined || p0 === undefined) {
      throw new InvalidInputError('mass profile', prof, 'is required for the mass-profile rule');
    }
    if ((p0.time as number) !== 0)
      throw new InvalidInputError('mass profile first time', p0.time, 'must be 0 s');
    let last = Number.POSITIVE_INFINITY;
    let lastT = -1;
    for (const [i, q] of prof.entries()) {
      const t: number = q.time;
      const m: number = q.propellantRemaining;
      if (!Number.isFinite(t) || t < lastT) {
        throw new InvalidInputError(
          `mass profile point ${String(i)} time`,
          t,
          'must be finite and not before the previous point',
        );
      }
      if (!Number.isFinite(m) || m < 0 || m > mp + 1e-12 * mp) {
        throw new InvalidInputError(
          `mass profile point ${String(i)} propellant`,
          m,
          'must lie between 0 and the propellant mass',
        );
      }
      if (m > last) {
        throw new InvalidInputError(
          `mass profile point ${String(i)} propellant`,
          m,
          'must not increase (mass never increases during a burn)',
        );
      }
      last = m;
      lastT = t;
    }
  } else if (def.massProfile !== undefined) {
    throw new InvalidInputError(
      'mass profile',
      def.massProfile.length,
      `is not used by the ${def.massRule} rule; remove it or choose mass-profile`,
    );
  }
}

/** Time of the last data point (the RASP rule: the final zero-thrust point marks the burn time). */
export function burnTime(def: MotorDefinition): Seconds {
  const last = def.points[def.points.length - 1];
  if (last === undefined)
    throw new InvalidInputError('thrust points', 0, 'at least two points are needed');
  return last.time;
}

/** MOT-1: linear interpolation between data points; zero outside [0, burn time]. */
export function thrustAt(def: MotorDefinition, time: Seconds): Newtons {
  const t: number = time;
  if (!Number.isFinite(t)) throw new InvalidInputError('time', t, 'must be finite');
  const pts = def.points;
  const tb: number = burnTime(def);
  if (t < 0 || t > tb) return newtons(0);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (a === undefined || b === undefined) continue;
    const ta: number = a.time;
    const tbb: number = b.time;
    if (t <= tbb) {
      if (tbb === ta) return newtons(b.thrust);
      const fa: number = a.thrust;
      const fb: number = b.thrust;
      return newtons(finiteResult('thrust', fa + ((fb - fa) * (t - ta)) / (tbb - ta)));
    }
  }
  return newtons(0);
}

function rawTotalImpulse(def: MotorDefinition): number {
  let sum = 0;
  for (let i = 1; i < def.points.length; i++) {
    const a = def.points[i - 1];
    const b = def.points[i];
    if (a === undefined || b === undefined) continue;
    sum +=
      (((a.thrust as number) + (b.thrust as number)) / 2) *
      ((b.time as number) - (a.time as number));
  }
  return sum;
}

/** MOT-2: ∫₀ᵗ F dt, exact for the piecewise-linear curve; clamped to [0, burn time]. */
export function impulseTo(def: MotorDefinition, time: Seconds): NewtonSeconds {
  const t: number = time;
  if (!Number.isFinite(t)) throw new InvalidInputError('time', t, 'must be finite');
  if (t <= 0) return newtonSeconds(0);
  let sum = 0;
  for (let i = 1; i < def.points.length; i++) {
    const a = def.points[i - 1];
    const b = def.points[i];
    if (a === undefined || b === undefined) continue;
    const ta: number = a.time;
    const tb: number = b.time;
    const fa: number = a.thrust;
    const fb: number = b.thrust;
    if (t >= tb) {
      sum += ((fa + fb) / 2) * (tb - ta);
    } else {
      // partial trapezoid from ta to t
      const ft = fa + ((fb - fa) * (t - ta)) / (tb - ta);
      sum += ((fa + ft) / 2) * (t - ta);
      break;
    }
  }
  return newtonSeconds(finiteResult('impulse', sum));
}

/** MOT-2: I(t_burn). */
export function totalImpulse(def: MotorDefinition): NewtonSeconds {
  return newtonSeconds(finiteResult('total impulse', rawTotalImpulse(def)));
}

function interpolateProfile(profile: readonly MotorMassProfilePoint[], t: number): number {
  const first = profile[0];
  const last = profile[profile.length - 1];
  if (first === undefined || last === undefined) {
    throw new InvalidInputError('mass profile', profile.length, 'needs at least one point');
  }
  if (t <= (first.time as number)) return first.propellantRemaining;
  if (t >= (last.time as number)) return last.propellantRemaining;
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1];
    const b = profile[i];
    if (a === undefined || b === undefined) continue;
    const ta: number = a.time;
    const tb: number = b.time;
    if (t <= tb) {
      if (tb === ta) return b.propellantRemaining;
      const ma: number = a.propellantRemaining;
      const mb: number = b.propellantRemaining;
      return ma + ((mb - ma) * (t - ta)) / (tb - ta);
    }
  }
  return last.propellantRemaining;
}

/**
 * MOT-3 / MOT-4: propellant remaining at `time` by the definition's rule.
 * impulse-proportional: m_p (1 − I(t)/I_total) (Niskanen p. 14 with a constant
 * exhaust velocity, D-028). linear-in-time: m_p (1 − t/t_burn) (Apogee guide
 * p. 1, auto-calc-mass). mass-profile: linear interpolation in the profile.
 */
export function propellantRemainingAt(def: MotorDefinition, time: Seconds): Kilograms {
  const t: number = time;
  if (!Number.isFinite(t)) throw new InvalidInputError('time', t, 'must be finite');
  const mp: number = def.propellantMass;
  const tb: number = burnTime(def);
  let remaining: number;
  switch (def.massRule) {
    case 'impulse-proportional': {
      const total = rawTotalImpulse(def);
      remaining = mp * (1 - (impulseTo(def, time) as number) / total);
      break;
    }
    case 'linear-in-time':
      remaining = t <= 0 ? mp : t >= tb ? 0 : mp * (1 - t / tb);
      break;
    case 'mass-profile': {
      const prof = def.massProfile;
      if (prof === undefined || prof.length === 0) {
        throw new InvalidInputError('mass profile', prof, 'is required for the mass-profile rule');
      }
      remaining = interpolateProfile(prof, t);
      break;
    }
  }
  // Guard against rounding below zero at the end of the burn (never a negative mass).
  if (remaining < 0 && remaining > -1e-12 * mp) remaining = 0;
  return kilograms(finiteResult('propellant remaining', remaining));
}

/** Thrust, impulse, mass and CG at `time` (CLAUDE.md 6.6). */
export function motorStateAt(def: MotorDefinition, time: Seconds): MotorState {
  const remaining = propellantRemainingAt(def, time);
  const casing = (def.totalMass as number) - (def.propellantMass as number);
  const t: number = time;
  return {
    time,
    thrust: thrustAt(def, time),
    impulseDelivered: impulseTo(def, time),
    propellantRemaining: remaining,
    mass: kilograms(finiteResult('motor mass', casing + (remaining as number))),
    cgFromForeEnd: metres((def.length as number) / 2),
    massRule: def.massRule,
    burning: t >= 0 && t < (burnTime(def) as number),
  };
}

/** The motor as `rocketMassProperties` needs it at `time`, with its aft end at `aftEnd` from the nose tip. */
export function motorMassAt(def: MotorDefinition, time: Seconds, aftEnd: Metres): MotorMass {
  const state = motorStateAt(def, time);
  return {
    mass: state.mass,
    length: def.length,
    diameter: def.diameter,
    aftEnd,
    cgFromForeEnd: state.cgFromForeEnd,
  };
}
