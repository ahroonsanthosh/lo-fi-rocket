/**
 * Readouts and event markers (plan 0034): the simulator's stored values at
 * a stored step, by reference, labelled with that step's time. Nothing is
 * interpolated, converted or derived here.
 */
import type {
  FlightEvent,
  FlightEventKind,
  FlightResult,
  FlightSample,
  Vec3,
} from '@lo-fi-rocket/physics';
import { nearestStep } from './clock.js';

export interface Readouts {
  /** Index of the stored step. */
  readonly index: number;
  /** The stored time of that step, seconds; every value below belongs to it. */
  readonly time: number;
  /** The stored sample itself, by reference. */
  readonly sample: FlightSample;
  /** The stability margin is NaN in the stored sample when there is no CP (descent, no aerodynamics); undefined here. */
  readonly stabilityCalibers: number | undefined;
  /** The angle of attack is NaN when the sample has no flight parameters (descent); undefined here. */
  readonly angleOfAttack: number | undefined;
  readonly mach: number | undefined;
  /** Horizontal distance of the stored position from the pad, √(x² + y²), metres (flight frame). */
  readonly horizontalDistance: number;
}

function defined(v: number): number | undefined {
  return Number.isNaN(v) ? undefined : v;
}

/** The stored values at step `index`. */
export function readoutsAt(result: FlightResult, index: number): Readouts {
  const sample = result.samples[index];
  if (sample === undefined) {
    throw new Error(
      `readoutsAt: step ${String(index)} is not stored (${String(result.samples.length)} steps)`,
    );
  }
  return {
    index,
    time: sample.time,
    sample,
    stabilityCalibers: defined(sample.stabilityCalibers),
    angleOfAttack: defined(sample.angleOfAttack),
    mach: defined(sample.mach),
    horizontalDistance: Math.hypot(sample.position.x, sample.position.y),
  };
}

/** The stored values at the step nearest to replay time `t`. */
export function readoutsNearest(result: FlightResult, t: number): Readouts {
  return readoutsAt(
    result,
    nearestStep(
      result.samples.map((s) => s.time as number),
      t,
    ),
  );
}

export interface EventMarker {
  readonly event: FlightEvent;
  /** The stored step the marker is drawn at. */
  readonly index: number;
  /** The stored position of that step (the CG), world frame. */
  readonly position: Vec3;
  /** The stored time of that step. */
  readonly time: number;
  /** True when a stored step has exactly the event's time (the simulator records one at every event). */
  readonly exact: boolean;
}

export const EVENT_LABELS: Readonly<Record<FlightEventKind, string>> = {
  launch: 'Launch',
  liftoff: 'Liftoff',
  'rail-exit': 'Rail exit',
  burnout: 'Burnout',
  'ejection-charge': 'Ejection charge',
  apogee: 'Apogee',
  deployment: 'Deployment',
  altitude: 'Altitude crossed',
  landing: 'Landing',
  'max-time': 'Maximum time',
  'model-limit': 'Model limit',
};

/**
 * A stored step counts as the event's own step when its time is within
 * this of the event time: the simulator's timed events (burnout, ejection
 * charge) record their sample at the integrated time, which can differ
 * from the scheduled time by the float64 drift of the time sum (about
 * 1e-12 s; the simulator's own tolerance for firing them), far below any
 * displayed digit.
 */
export const EVENT_STEP_TOLERANCE = 1e-9;

/**
 * One marker per event, at the stored step with the event's time (within
 * `EVENT_STEP_TOLERANCE`); when no step has it (liftoff is detected within
 * a rail step and not recorded separately; results from another producer),
 * the nearest step, flagged `exact: false` and labelled with that step's time.
 */
export function eventMarkers(result: FlightResult): EventMarker[] {
  const times = result.samples.map((s) => s.time as number);
  return result.events.map((event) => {
    const t: number = event.time;
    let index = nearestStep(times, t);
    const exact = Math.abs((times[index] ?? Number.NaN) - t) <= EVENT_STEP_TOLERANCE;
    if (!exact) index = nearestStep(times, t);
    const sample = result.samples[index];
    if (sample === undefined) throw new Error('eventMarkers: the result has no stored steps');
    return { event, index, position: sample.position, time: sample.time, exact };
  });
}
