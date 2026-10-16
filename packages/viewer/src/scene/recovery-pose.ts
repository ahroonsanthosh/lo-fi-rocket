/**
 * How the rocket is drawn under its recovery device and after landing
 * (plan 3d-0003, D-3D-7). The simulator's descent is the three-degree-of-
 * freedom recovery model (DYN-14, Niskanen §4.2.5 pp. 67 to 68): canopy
 * drag and gravity act on the CG, no moment acts, so the stored attitude in
 * descent is the attitude at deployment carried along, not a prediction. The
 * drawing therefore hangs the rocket from its shock cord and, after the
 * stored landing, lays it on the ground. In descent the stored position (the
 * CG) is kept exactly. At the landing the hanging rocket touches down tail
 * first at the stored landing point and falls over about its tail, so the
 * resting CG is the tail's distance from the CG beyond that point. Drawing
 * only.
 */
import { Matrix4, Quaternion, Vector3 } from 'three';
import type { LauncherFootprint } from './launcher.js';

/** Time over which the hanging attitude blends in after the deployment, s (a drawing choice). */
export const HANG_BLEND_S = 0.8;
/** The hanging rocket's pendulum sway: period, s, and amplitude, radians (drawing choices). */
export const SWAY_PERIOD_S = 2.6;
export const SWAY_AMPLITUDE = (6 * Math.PI) / 180;
/** Time the rocket takes to tip over onto the ground after the landing, s. */
export const TIP_OVER_S = 1.0;
/** Time the canopy takes to collapse on the ground after the landing, s. */
export const CANOPY_COLLAPSE_S = 1.5;
/** How long the replay runs past the last stored step when the flight lands, s. */
export const AFTER_LANDING_S = 4;

function smooth(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

/** The blend weight of a transition `duration` long starting at `start`, at time t (0 before, 1 after, smooth). */
export function blend(t: number, start: number, duration: number): number {
  return smooth((t - start) / duration);
}

/**
 * The hanging nose direction: along `up` (from the rocket towards the
 * canopy) turned by the sway about the horizontal axis across it.
 */
export function hangingNose(up: Vector3, t: number): Vector3 {
  const u = up.clone().normalize();
  const axis = new Vector3().crossVectors(u, new Vector3(0, 0, 1));
  if (axis.lengthSq() < 1e-12) axis.set(1, 0, 0);
  axis.normalize();
  const angle = SWAY_AMPLITUDE * Math.sin((2 * Math.PI * t) / SWAY_PERIOD_S);
  return u.applyAxisAngle(axis, angle);
}

/** The body-to-world rotation that points the nose (body −x) along `nose`, by the shortest turn. */
export function noseAlong(nose: Vector3): Quaternion {
  return new Quaternion().setFromUnitVectors(new Vector3(-1, 0, 0), nose.clone().normalize());
}

/**
 * The height of the rocket's axis above the ground when it lies on its side:
 * on the body when it has no fins or when the fins are too short to lift it,
 * otherwise on the two fins either side of the lowest gap, whose tips are
 * π/n from the downward direction: max(R_body, R_tip cos(π/n)).
 */
export function lyingHeight(bodyRadius: number, finTipRadius: number, finCount: number): number {
  if (finCount < 2) return bodyRadius;
  return Math.max(bodyRadius, finTipRadius * Math.cos(Math.PI / finCount));
}

/**
 * The attitude of the rocket lying on the ground: the nose horizontal along
 * `drift` (the direction the rocket drifted to land), rolled so that the
 * body direction between fin 1 and fin 2 (at π/n from +y about +x; 0 without
 * fins) points straight down.
 */
export function lyingAttitude(drift: Vector3, finCount: number): Quaternion {
  const d = new Vector3(drift.x, drift.y, 0);
  if (d.lengthSq() < 1e-12) d.set(1, 0, 0);
  d.normalize();
  const a = finCount >= 2 ? Math.PI / finCount : 0;
  const ex = d.clone().negate(); // body +x (aft) points against the nose
  const down = new Vector3(0, 0, -1); // the image of u = (0, cos a, sin a)
  const v = new Vector3().crossVectors(ex, down); // the image of x × u
  const ey = down.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, -Math.sin(a));
  const ez = down.clone().multiplyScalar(Math.sin(a)).addScaledVector(v, Math.cos(a));
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(ex, ey, ez));
}

/** A horizontal point or direction, metres. */
export interface Flat {
  readonly x: number;
  readonly y: number;
}

/** Below this horizontal speed at the landing, m/s, the rocket has no drift to fall along (a drawing choice). */
export const NO_DRIFT_SPEED = 0.05;

export interface RestInputs {
  /** The stored CG position at the landing, horizontal, metres. */
  readonly landing: Flat;
  /** The stored horizontal velocity at the landing, m/s: the canopy pulls the rocket over this way. */
  readonly drift: Flat;
  /** The rocket's length, nose tip to tail, metres. */
  readonly length: number;
  /** The launcher drawn at the pad. */
  readonly footprint: LauncherFootprint;
  /** Clearance kept from the launcher's footprint: the rocket's largest radius, metres. */
  readonly clearance: number;
}

export interface RestPlace {
  /** Where the tail comes to rest, horizontal, metres. */
  readonly tail: Flat;
  /** The horizontal unit direction from the tail to the nose. */
  readonly fall: Flat;
}

/**
 * Where the landed rocket lies (D-3D-7). It falls along its drift (away from
 * the launcher without one) with its tail at the stored landing point,
 * unless that would lay it across the launcher drawn at the pad, which the
 * simulator does not model:
 *
 * - a landing inside the launcher's footprint (its tripod circle plus the
 *   rocket's radius) is drawn slid off it, the tail on the circle in the gap
 *   between two legs nearest the drift;
 * - a rocket falling towards the launcher falls the other way.
 *
 * The lying axis, tail to nose, then never comes within the footprint.
 */
export function restingPlace(i: RestInputs): RestPlace {
  const a = i.footprint.anchor;
  const radius = i.footprint.spread + i.clearance;
  const rx = i.landing.x - a.x;
  const ry = i.landing.y - a.y;
  const dist = Math.hypot(rx, ry);
  const speed = Math.hypot(i.drift.x, i.drift.y);
  const drifting = speed > NO_DRIFT_SPEED;
  if (dist < radius) {
    const pref: Flat = drifting
      ? { x: i.drift.x / speed, y: i.drift.y / speed }
      : dist > 1e-9
        ? { x: rx / dist, y: ry / dist }
        : { x: 1, y: 0 };
    const legs = [...i.footprint.legAngles].sort((p, q) => p - q);
    let best: Flat = pref;
    let bestDot = -Infinity;
    legs.forEach((l, k) => {
      const next = legs[(k + 1) % legs.length] ?? l;
      const gap = k + 1 < legs.length ? next - l : next + 2 * Math.PI - l;
      const mid = l + gap / 2;
      const g = { x: Math.cos(mid), y: Math.sin(mid) };
      const d = g.x * pref.x + g.y * pref.y;
      if (d > bestDot) {
        bestDot = d;
        best = g;
      }
    });
    return { tail: { x: a.x + radius * best.x, y: a.y + radius * best.y }, fall: best };
  }
  let fall: Flat = drifting
    ? { x: i.drift.x / speed, y: i.drift.y / speed }
    : { x: rx / dist, y: ry / dist };
  // The point of the lying axis nearest the anchor.
  const s = Math.min(i.length, Math.max(0, -(rx * fall.x + ry * fall.y)));
  if (Math.hypot(rx + s * fall.x, ry + s * fall.y) < radius) fall = { x: -fall.x, y: -fall.y };
  return { tail: { x: i.landing.x, y: i.landing.y }, fall };
}
