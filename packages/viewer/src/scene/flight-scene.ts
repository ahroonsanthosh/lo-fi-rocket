/**
 * The flight scene (plan 0034): the ground grid with its distance scale,
 * the launch rail, the flight path through every stored position, the
 * event markers at their stored steps, the wind arrow, and the rocket
 * model posed from the stored samples.
 *
 * Frames: the three.js scene *is* the flight frame of docs/conventions.md
 * (x east, y north, z up, metres); the camera's up vector is +z and no
 * stored value is permuted or scaled. The rocket model is built in the
 * body frame (x aft from the nose tip) and the stored body-to-world
 * quaternion is assigned to the rocket object as its rotation; three.js
 * rotates by the same product v ↦ q v q⁻¹ (DYN-4), which the tests check
 * against the physics `noseDirection`. The stored position is the CG's, so
 * the model hangs from the rocket object by the stored CG offset.
 */
import {
  railDirection,
  type FlightResult,
  type PlacedComponent,
  type Radians,
  type Vec3,
} from '@lo-fi-rocket/physics';
import {
  ArrowHelper,
  BufferGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  GridHelper,
  Group,
  HemisphereLight,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
} from 'three';
import {
  buildRocketObject,
  rocketModelParts,
  type RocketObject,
} from '../geometry/rocket-model.js';
import { displayPose, nearestStep } from '../replay/clock.js';
import {
  eventMarkers,
  EVENT_LABELS,
  readoutsAt,
  type EventMarker,
  type Readouts,
} from '../replay/readouts.js';
import type { Formatter } from '../units.js';

export interface RailInputs {
  readonly length: number;
  readonly angleFromVertical: Radians;
  readonly azimuth: Radians;
}

export interface WindInputs {
  /** Ground wind speed, m/s. */
  readonly speed: number;
  /** Direction the wind blows from, clockwise from north, radians (docs/conventions.md). */
  readonly from: number;
}

export interface SceneInputs {
  readonly result: FlightResult;
  readonly components: readonly PlacedComponent[];
  readonly rail: RailInputs;
  readonly wind: WindInputs | undefined;
  readonly format: Formatter;
  /** Extra horizontal points the grid must cover (Monte Carlo landings), metres east and north. */
  readonly extraGroundPoints?: readonly { readonly east: number; readonly north: number }[];
}

export type LabelKind = 'scale' | 'compass' | 'event' | 'wind' | 'pad';

export interface SceneLabel {
  readonly kind: LabelKind;
  readonly text: string;
  readonly position: Vec3;
}

export type CameraMode = 'follow' | 'pad' | 'overview' | 'orbit';
export const CAMERA_MODES: readonly CameraMode[] = ['follow', 'pad', 'overview', 'orbit'];

export const EVENT_COLOURS: Readonly<Record<EventMarker['event']['kind'], number>> = {
  launch: 0x888888,
  liftoff: 0x888888,
  'rail-exit': 0x1f5fbf,
  burnout: 0xd9534f,
  'ejection-charge': 0xb26a00,
  apogee: 0x1b7f3b,
  deployment: 0xb26a00,
  altitude: 0x5a6470,
  landing: 0x1b1f24,
  'max-time': 0x5a6470,
  'model-limit': 0xb3261e,
};

/**
 * A grid spacing of 1, 2 or 5 × 10ⁿ metres such that the extent spans
 * between about 5 and 10 cells (a drawing choice, no physics).
 */
export function gridSpacing(extent: number): number {
  if (!(extent > 0) || !Number.isFinite(extent)) throw new Error('gridSpacing: extent must be > 0');
  const target = extent / 10;
  const k = Math.floor(Math.log10(target));
  const base = 10 ** k;
  for (const m of [1, 2, 5, 10]) {
    const s = m * base;
    if (s >= target) return s;
  }
  return 10 * base;
}

/** Largest horizontal distance from the pad reached by any stored position or extra point, metres. */
export function horizontalExtent(
  result: FlightResult,
  extra: readonly { readonly east: number; readonly north: number }[] = [],
): number {
  let e = 0;
  for (const s of result.samples) e = Math.max(e, Math.abs(s.position.x), Math.abs(s.position.y));
  for (const p of extra) e = Math.max(e, Math.abs(p.east), Math.abs(p.north));
  return e;
}

/** Highest stored altitude, metres. */
export function verticalExtent(result: FlightResult): number {
  let z = 0;
  for (const s of result.samples) z = Math.max(z, s.position.z);
  return z;
}

export interface CameraPose {
  readonly position: Vec3;
  readonly target: Vec3;
}

export interface FlightExtents {
  /** Largest horizontal distance from the pad of anything drawn, metres. */
  readonly horizontal: number;
  /** Highest stored altitude, metres. */
  readonly vertical: number;
}

/**
 * Camera placement for the fixed modes (a drawing choice): `follow` sits a
 * few rocket lengths from the rocket, south-west and above, looking at it;
 * `pad` stands 3 m south of the pad at eye height looking at the rocket;
 * `overview` looks at the middle of the flight's height from far enough,
 * south-west and above, to take in the whole path and the landing points.
 * `orbit` is user-controlled and returns undefined.
 */
export function cameraPose(
  mode: CameraMode,
  rocketPosition: Vec3,
  rocketLength: number,
  extents: FlightExtents = { horizontal: 0, vertical: 0 },
): CameraPose | undefined {
  switch (mode) {
    case 'overview': {
      const target = { x: 0, y: 0, z: extents.vertical / 2 };
      const radius = Math.max(5, extents.horizontal, extents.vertical / 2);
      // Offset direction (−1, −1, 0.35), unit length, 3 radii away: the whole height fits a 50° view.
      const n = Math.hypot(1, 1, 0.35);
      const d = 3 * radius;
      return {
        position: { x: -d / n, y: -d / n, z: target.z + (0.35 * d) / n },
        target,
      };
    }
    case 'follow': {
      const d = Math.max(2, 5 * rocketLength);
      // Offset direction (−1, −1, 0.6), unit length, scaled by d.
      const n = Math.hypot(1, 1, 0.6);
      return {
        position: {
          x: rocketPosition.x - d / n,
          y: rocketPosition.y - d / n,
          z: rocketPosition.z + (0.6 * d) / n,
        },
        target: rocketPosition,
      };
    }
    case 'pad':
      return { position: { x: 0, y: -3, z: 1.7 }, target: rocketPosition };
    case 'orbit':
      return undefined;
  }
}

function lineThrough(points: readonly Vec3[], colour: number, name: string): Line {
  const arr = new Float32Array(points.length * 3);
  points.forEach((p, i) => {
    arr[3 * i] = p.x;
    arr[3 * i + 1] = p.y;
    arr[3 * i + 2] = p.z;
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(arr, 3));
  const line = new Line(g, new LineBasicMaterial({ color: colour }));
  line.name = name;
  return line;
}

export class FlightScene {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly result: FlightResult;
  readonly rocket: Group;
  readonly model: RocketObject;
  readonly markers: readonly EventMarker[];
  readonly labels: readonly SceneLabel[];
  readonly spacing: number;
  readonly gridHalfSize: number;
  readonly markerRadius: number;
  readonly extents: FlightExtents;
  private readonly flown: Line;
  private readonly times: readonly number[];
  private readonly landing = new Group();
  private currentIndex = 0;
  private currentTime = 0;

  constructor(inputs: SceneInputs) {
    this.result = inputs.result;
    this.times = inputs.result.samples.map((s) => s.time as number);
    this.scene.background = new Color(0xdfe8f2);
    this.camera = new PerspectiveCamera(50, 16 / 9, 0.05, 50_000);
    this.camera.up.set(0, 0, 1);

    // Lights.
    this.scene.add(new HemisphereLight(0xffffff, 0x667788, 1.1));
    const sun = new DirectionalLight(0xffffff, 1.4);
    sun.position.set(-200, -300, 500);
    this.scene.add(sun);

    // Ground grid and its scale.
    const horizontal = horizontalExtent(inputs.result, inputs.extraGroundPoints);
    this.extents = { horizontal, vertical: verticalExtent(inputs.result) };
    // The grid covers the horizontal travel (at least 10 m) and a quarter of the height, so a
    // high flight still has a scale under it.
    const extent = Math.max(10, 1.2 * horizontal, this.extents.vertical / 4);
    this.spacing = gridSpacing(extent);
    const cells = Math.ceil(extent / this.spacing);
    this.gridHalfSize = cells * this.spacing;
    const grid = new GridHelper(2 * this.gridHalfSize, 2 * cells, 0x6b7785, 0xb8c2cc);
    grid.rotation.x = Math.PI / 2; // GridHelper lies in XZ (y up); the flight frame has z up.
    grid.name = 'ground-grid';
    this.scene.add(grid);
    const ground = new Mesh(
      new CircleGeometry(3 * Math.max(this.gridHalfSize, this.extents.vertical), 64),
      new MeshBasicMaterial({ color: 0xcfd9c8 }),
    );
    ground.position.z = -0.01;
    ground.name = 'ground';
    this.scene.add(ground);
    // Marker size: a drawing choice, small next to a model rocket, bounded for long flights.
    this.markerRadius = Math.min(2, Math.max(0.04, extent / 300));

    const labels: SceneLabel[] = [];
    // At most five distance labels per axis, so they stay readable.
    const labelEvery = Math.max(1, Math.ceil(cells / 5));
    for (let i = labelEvery; i <= cells; i += labelEvery) {
      const d = i * this.spacing;
      const text = inputs.format.format(d, 'm');
      labels.push({ kind: 'scale', text, position: { x: d, y: 0, z: 0 } });
      labels.push({ kind: 'scale', text, position: { x: 0, y: d, z: 0 } });
    }
    labels.push({ kind: 'compass', text: 'N', position: { x: 0, y: this.gridHalfSize, z: 0 } });
    labels.push({ kind: 'compass', text: 'E', position: { x: this.gridHalfSize, y: 0, z: 0 } });
    labels.push({ kind: 'pad', text: 'Pad', position: { x: 0, y: 0, z: 0 } });

    // Rocket model: the body group hangs from the rocket group by the stored CG offset.
    this.model = buildRocketObject(rocketModelParts(inputs.components));
    this.rocket = new Group();
    this.rocket.name = 'rocket';
    this.rocket.add(this.model.group);
    this.scene.add(this.rocket);

    // Launch rail: from the tail of the rocket at rest to the rail length along the rail direction.
    const d = railDirection(inputs.rail.angleFromVertical, inputs.rail.azimuth);
    const L = this.model.extent.length;
    const rail = lineThrough(
      [
        { x: -d.x * L, y: -d.y * L, z: -d.z * L },
        { x: d.x * inputs.rail.length, y: d.y * inputs.rail.length, z: d.z * inputs.rail.length },
      ],
      0x333333,
      'launch-rail',
    );
    this.scene.add(rail);

    // Flight path through every stored position, and the part flown so far.
    const positions = inputs.result.samples.map((s) => s.position);
    const path = lineThrough(positions, 0x9aa5b1, 'flight-path');
    this.scene.add(path);
    this.flown = lineThrough(positions, 0x1f5fbf, 'flight-path-flown');
    this.flown.geometry.setDrawRange(0, 1);
    this.scene.add(this.flown);

    // Event markers at their stored steps; events at the same step share one label.
    this.markers = eventMarkers(inputs.result);
    const sphere = new SphereGeometry(this.markerRadius, 16, 12);
    const byStep = new Map<number, EventMarker[]>();
    for (const m of this.markers) {
      const mesh = new Mesh(sphere, new MeshBasicMaterial({ color: EVENT_COLOURS[m.event.kind] }));
      mesh.position.set(m.position.x, m.position.y, m.position.z);
      mesh.name = `event-${m.event.kind}`;
      mesh.userData = { index: m.index, time: m.time };
      this.scene.add(mesh);
      const group = byStep.get(m.index);
      if (group === undefined) byStep.set(m.index, [m]);
      else group.push(m);
    }
    for (const group of byStep.values()) {
      const first = group[0];
      if (first === undefined) continue;
      const names = group.map((m) => EVENT_LABELS[m.event.kind]).join(', ');
      labels.push({
        kind: 'event',
        text: `${names} ${inputs.format.format(first.time, 'time')}${group.every((m) => m.exact) ? '' : ' (nearest step)'}`,
        position: first.position,
      });
    }

    // Wind arrow at the pad, along the wind velocity: v = −speed (sin ψ, cos ψ, 0).
    if (inputs.wind !== undefined && inputs.wind.speed > 0) {
      const dir = new Vector3(-Math.sin(inputs.wind.from), -Math.cos(inputs.wind.from), 0);
      const length = 0.6 * this.spacing;
      const origin = new Vector3(0, 0, 0.5);
      const arrow = new ArrowHelper(dir, origin, length, 0x1b7f3b, 0.2 * length, 0.1 * length);
      arrow.name = 'wind-arrow';
      this.scene.add(arrow);
      const tip = origin.clone().addScaledVector(dir, length);
      labels.push({
        kind: 'wind',
        text: `Wind ${inputs.format.format(inputs.wind.speed, 'velocity')} from ${inputs.format.format(inputs.wind.from, 'angle')}`,
        position: { x: tip.x, y: tip.y, z: tip.z },
      });
    } else {
      labels.push({ kind: 'wind', text: 'No wind', position: { x: 0, y: 0, z: 0.5 } });
    }
    this.labels = labels;

    this.landing.name = 'landing';
    this.scene.add(this.landing);
    this.setStep(0);
  }

  get duration(): number {
    return this.times[this.times.length - 1] ?? 0;
  }

  get stepIndex(): number {
    return this.currentIndex;
  }

  get time(): number {
    return this.currentTime;
  }

  /** The stored values at the current nearest step. */
  readouts(): Readouts {
    return readoutsAt(this.result, this.currentIndex);
  }

  /** Pose the rocket at the stored step `index` exactly. */
  setStep(index: number): void {
    const s = this.result.samples[index];
    if (s === undefined) throw new Error(`setStep: step ${String(index)} is not stored`);
    this.currentIndex = index;
    this.currentTime = s.time;
    this.pose(s.position, s.orientation, s.cg);
  }

  /**
   * Pose the rocket at replay time `t`: the drawing blends between the two
   * neighbouring stored steps; the readouts use the nearest stored step.
   */
  setTime(t: number): void {
    this.currentIndex = nearestStep(this.times, t);
    this.currentTime = t;
    const p = displayPose(this.result.samples, t);
    this.pose(p.position, p.orientation, p.cg);
  }

  private pose(
    position: Vec3,
    q: { readonly w: number; readonly x: number; readonly y: number; readonly z: number },
    cg: number,
  ): void {
    this.rocket.position.set(position.x, position.y, position.z);
    this.rocket.quaternion.set(q.x, q.y, q.z, q.w);
    this.model.group.position.set(-cg, 0, 0);
    this.rocket.updateMatrixWorld(true);
    this.flown.geometry.setDrawRange(0, this.currentIndex + 1);
  }

  /** The rocket's nose direction in the scene (body −x through the object's world matrix). */
  noseAxisInScene(): Vec3 {
    const tip = new Vector3(0, 0, 0);
    const aft = new Vector3(1, 0, 0);
    this.model.group.localToWorld(tip);
    this.model.group.localToWorld(aft);
    const v = tip.sub(aft);
    return { x: v.x, y: v.y, z: v.z };
  }

  /** The nose tip's position in the scene. */
  noseTipInScene(): Vec3 {
    const tip = new Vector3(0, 0, 0);
    this.model.group.localToWorld(tip);
    return { x: tip.x, y: tip.y, z: tip.z };
  }

  /** Point the camera for a fixed mode; orbit leaves it where the user put it. */
  applyCamera(mode: CameraMode): void {
    const p = this.rocket.position;
    const pose = cameraPose(
      mode,
      { x: p.x, y: p.y, z: p.z },
      this.model.extent.length,
      this.extents,
    );
    if (pose === undefined) return;
    this.camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    this.camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
    this.camera.updateMatrixWorld(true);
  }

  /** Replace the Monte Carlo landing objects (none when `group` is undefined). */
  setLandingObjects(group: Group | undefined): void {
    this.landing.clear();
    if (group !== undefined) this.landing.add(group);
  }
}
