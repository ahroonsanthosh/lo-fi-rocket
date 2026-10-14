/**
 * Replay timing (plan 0034). The stored steps are the truth: `nearestStep`
 * picks the step whose stored time is closest to the replay time, and that
 * step's values are what the readouts show. `displayPose` blends the pose
 * between the two neighbouring stored steps so that the picture moves
 * smoothly; it is used for the drawing only and never for a number shown
 * on screen. The controller is a plain state machine advanced by wall-clock
 * deltas; it computes nothing about the flight.
 */
import type { FlightSample, Quaternion, Vec3 } from '@lo-fi-rocket/physics';

/**
 * Index of the stored time nearest to `t`. `times` must be non-decreasing
 * (the simulator's samples are). Outside the range the first or last step
 * is returned; an exact tie between two neighbours goes to the earlier step.
 */
export function nearestStep(times: readonly number[], t: number): number {
  const n = times.length;
  if (n === 0) throw new Error('nearestStep: no stored steps');
  const first = times[0] ?? 0;
  const last = times[n - 1] ?? 0;
  if (!Number.isFinite(t)) throw new Error(`nearestStep: replay time ${String(t)} is not finite`);
  if (t <= first) return 0;
  if (t >= last) return n - 1;
  // Binary search for the first index whose time is >= t.
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((times[mid] ?? 0) < t) lo = mid + 1;
    else hi = mid;
  }
  const after = times[lo] ?? 0;
  const before = times[lo - 1] ?? after;
  // Tie (t exactly halfway) goes to the earlier step.
  return t - before <= after - t ? lo - 1 : lo;
}

export interface DisplayPose {
  /** Position of the centre of gravity in the world frame (the stored position, blended for display). */
  readonly position: Vec3;
  /** Attitude quaternion, body to world (the stored orientation, blended for display and normalised). */
  readonly orientation: Quaternion;
  /** CG from the nose tip along body x, metres (blended for display). */
  readonly cg: number;
}

function lerp(a: number, b: number, f: number): number {
  return a + f * (b - a);
}

/**
 * The pose to draw at replay time `t`: the stored pose at a stored step
 * when `t` is one (or outside the range), otherwise a linear blend of the
 * positions and a normalised linear blend of the quaternions (taking the
 * shorter arc) between the two neighbouring steps. Display only.
 */
export function displayPose(samples: readonly FlightSample[], t: number): DisplayPose {
  const n = samples.length;
  const first = samples[0];
  const last = samples[n - 1];
  if (first === undefined || last === undefined) throw new Error('displayPose: no stored steps');
  const at = (s: FlightSample): DisplayPose => ({
    position: s.position,
    orientation: s.orientation,
    cg: s.cg,
  });
  if (t <= first.time) return at(first);
  if (t >= last.time) return at(last);
  const times = samples.map((s) => s.time as number);
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((times[mid] ?? 0) < t) lo = mid + 1;
    else hi = mid;
  }
  const b = samples[lo];
  const a = samples[lo - 1];
  if (a === undefined || b === undefined) return at(last);
  if (b.time === t) return at(b);
  const span = (b.time as number) - (a.time as number);
  const f = span > 0 ? (t - (a.time as number)) / span : 0;
  const qa = a.orientation;
  let qb = b.orientation;
  const dotQ = qa.w * qb.w + qa.x * qb.x + qa.y * qb.y + qa.z * qb.z;
  if (dotQ < 0) qb = { w: -qb.w, x: -qb.x, y: -qb.y, z: -qb.z };
  const q = {
    w: lerp(qa.w, qb.w, f),
    x: lerp(qa.x, qb.x, f),
    y: lerp(qa.y, qb.y, f),
    z: lerp(qa.z, qb.z, f),
  };
  const norm = Math.hypot(q.w, q.x, q.y, q.z);
  const orientation =
    norm > 0 ? { w: q.w / norm, x: q.x / norm, y: q.y / norm, z: q.z / norm } : qa;
  return {
    position: {
      x: lerp(a.position.x, b.position.x, f),
      y: lerp(a.position.y, b.position.y, f),
      z: lerp(a.position.z, b.position.z, f),
    },
    orientation,
    cg: lerp(a.cg, b.cg, f),
  };
}

export const REPLAY_SPEEDS: readonly number[] = [0.1, 0.25, 0.5, 1, 2, 4];

/**
 * The most wall-clock time one animation frame may add to the replay,
 * seconds (a drawing choice). A longer interval is a stall (a shader
 * compiled, a texture uploaded, a background tab), not time the user
 * watched: without the limit, the stall before a "Play" would jump the
 * replay forward. Replays still run at their speed down to 4 frames a second.
 */
export const MAX_FRAME_STEP = 0.25;

/** A frame's interval as replay wall-clock time: never negative, at most `MAX_FRAME_STEP`. */
export function frameStep(deltaSeconds: number): number {
  return deltaSeconds > 0 ? Math.min(deltaSeconds, MAX_FRAME_STEP) : 0;
}

export interface ReplayState {
  readonly time: number;
  readonly playing: boolean;
  readonly speed: number;
  readonly duration: number;
}

/** Play, pause, speed and seek over [0, duration]; stops at the end. */
export class ReplayController {
  private state: ReplayState;

  constructor(duration: number, speed = 1) {
    if (!(duration >= 0) || !Number.isFinite(duration)) {
      throw new Error(`ReplayController: duration ${String(duration)} must be 0 or greater`);
    }
    this.state = { time: 0, playing: false, speed, duration };
  }

  get current(): ReplayState {
    return this.state;
  }

  play(): void {
    // Playing from the end starts over.
    const time = this.state.time >= this.state.duration ? 0 : this.state.time;
    this.state = { ...this.state, time, playing: true };
  }

  pause(): void {
    this.state = { ...this.state, playing: false };
  }

  toggle(): void {
    if (this.state.playing) this.pause();
    else this.play();
  }

  setSpeed(speed: number): void {
    if (!(speed > 0) || !Number.isFinite(speed)) {
      throw new Error(`ReplayController: speed ${String(speed)} must be greater than 0`);
    }
    this.state = { ...this.state, speed };
  }

  seek(time: number): void {
    const t = Math.min(this.state.duration, Math.max(0, Number.isFinite(time) ? time : 0));
    this.state = { ...this.state, time: t };
  }

  /** Advance by a wall-clock interval in seconds; pauses at the end. */
  advance(deltaSeconds: number): ReplayState {
    if (!this.state.playing || !(deltaSeconds > 0)) return this.state;
    const next = this.state.time + deltaSeconds * this.state.speed;
    if (next >= this.state.duration) {
      this.state = { ...this.state, time: this.state.duration, playing: false };
    } else {
      this.state = { ...this.state, time: next };
    }
    return this.state;
  }
}
