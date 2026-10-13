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
  Box3,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  FogExp2,
  GridHelper,
  Group,
  HemisphereLight,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  Quaternion as ThreeQuaternion,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import {
  bracket,
  buildCanopy,
  deployedCanopies,
  displayThrust,
  displayVelocity,
  ExhaustFlame,
  inflation,
  maxThrust,
  smokeEmissions,
  smokePuffs,
  SmokeTrail,
  SMOKE_MAX_PUFFS,
  windVelocity,
  type CanopyState,
  type RecoveryInputs,
  type SmokeEmission,
  type SmokeOptions,
} from './effects.js';
import {
  buildPad,
  buildSkyDome,
  buildTrees,
  grassTexture,
  sceneryLayout,
  SKY_HORIZON,
  SUN_DIRECTION,
  terrainGeometry,
  type SceneryLayout,
} from './scenery.js';
import {
  buildRocketObject,
  rocketModelParts,
  type ModelPart,
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
  /** The design's recovery devices, so a deployed canopy is drawn at its own diameter. */
  readonly recovery?: readonly RecoveryInputs[];
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
 * few rocket lengths from the rocket, south-west and a little above, looking at it;
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
      // Offset direction (−1, −1, 0.3), unit length, scaled by d.
      const n = Math.hypot(1, 1, 0.3);
      return {
        position: {
          x: rocketPosition.x - d / n,
          y: rocketPosition.y - d / n,
          z: rocketPosition.z + (0.3 * d) / n,
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
  const line = new Line(g, new LineBasicMaterial({ color: colour, fog: false }));
  line.name = name;
  return line;
}

/** On-screen diameter of an event marker, pixels (a drawing choice). */
export const MARKER_PIXELS = 9;

function materialsOf(o: { material: Material | Material[] }): Material[] {
  return Array.isArray(o.material) ? o.material : [o.material];
}

/** The largest radius of the coaxial revolved parts (the body), metres. */
function bodyRadiusOf(parts: readonly ModelPart[]): number {
  let r = 0;
  for (const p of parts) {
    if (p.kind !== 'revolved' || p.offset !== undefined) continue;
    for (const [, pr] of p.outline) r = Math.max(r, pr);
  }
  return r;
}

/** The radius of the outline at the aft end of the model, metres. */
function aftRadiusOf(parts: readonly ModelPart[]): number {
  let aft = 0;
  for (const p of parts)
    if (p.kind === 'revolved' && p.offset === undefined)
      for (const [x] of p.outline) aft = Math.max(aft, x);
  let r = 0;
  for (const p of parts) {
    if (p.kind !== 'revolved' || p.offset !== undefined) continue;
    for (const [x, pr] of p.outline) if (Math.abs(x - aft) < 1e-9) r = Math.max(r, pr);
  }
  return r;
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
  readonly groundZ: number;
  readonly layout: SceneryLayout;
  readonly rocketLength: number;
  private readonly flown: Line;
  private readonly track: Line;
  private readonly drop: Line;
  private readonly sky: Mesh;
  private readonly fog: FogExp2;
  private readonly sun: DirectionalLight;
  private readonly terrain = new Group();
  private readonly proceduralTerrain: Group;
  private readonly flameHolder = new Group();
  private readonly flame: ExhaustFlame;
  private readonly thrustMax: number;
  private readonly wind: Vec3;
  private readonly emissions: readonly SmokeEmission[];
  private readonly smokeOptions: SmokeOptions;
  private readonly smoke: SmokeTrail;
  private readonly canopyStates: readonly CanopyState[];
  private readonly canopies: readonly Group[];
  private readonly times: readonly number[];
  private readonly markerMeshes: Mesh[] = [];
  private readonly landing = new Group();
  private currentIndex = 0;
  private currentTime = 0;

  constructor(inputs: SceneInputs) {
    this.result = inputs.result;
    this.times = inputs.result.samples.map((s) => s.time as number);
    this.camera = new PerspectiveCamera(50, 16 / 9, 0.05, 50_000);
    this.camera.up.set(0, 0, 1);

    // Rocket model: the body group hangs from the rocket group by the stored CG offset.
    this.model = buildRocketObject(rocketModelParts(inputs.components));
    this.rocket = new Group();
    this.rocket.name = 'rocket';
    this.rocket.add(this.model.group);
    this.scene.add(this.rocket);
    const L = Math.max(0.05, this.model.extent.length);
    this.rocketLength = L;

    // The drawn ground (D-3D-1): the stored z = 0 is the CG at rest, so the ground is drawn at
    // the rocket's lowest point at rest, less a small clearance for the blast plate.
    const first = inputs.result.samples[0];
    if (first === undefined) throw new Error('FlightScene: the result has no stored steps');
    this.place(first.position, first.orientation, first.cg);
    const rest = new Box3().setFromObject(this.model.group);
    this.groundZ = (Number.isFinite(rest.min.z) ? Math.min(0, rest.min.z) : 0) - 0.02 * L;

    const horizontal = horizontalExtent(inputs.result, inputs.extraGroundPoints);
    this.extents = { horizontal, vertical: verticalExtent(inputs.result) };
    this.layout = sceneryLayout(this.extents, this.groundZ);
    this.camera.far = Math.max(50_000, 2.5 * this.layout.outerRadius);
    this.camera.updateProjectionMatrix();

    // Sky, fog and light.
    this.sky = buildSkyDome(0.45 * this.camera.far);
    this.scene.add(this.sky);
    const horizonColour = new Color().setHex(SKY_HORIZON, SRGBColorSpace);
    this.scene.background = horizonColour;
    this.fog = new FogExp2(horizonColour, 2 / this.layout.outerRadius);
    this.scene.fog = this.fog;
    this.scene.add(new HemisphereLight(0xcfe2ff, 0x5b5140, 1.1));
    this.sun = new DirectionalLight(0xfff1dc, 2.8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    const half = 1.6 * L + 0.5;
    sc.left = -half;
    sc.right = half;
    sc.top = half;
    sc.bottom = -half;
    sc.near = 0.1;
    sc.far = 200 * L + 50;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.01 * L;
    this.scene.add(this.sun, this.sun.target);

    // Terrain: illustrative and flat over the flight (D-3D-1); a map may replace it (D-3D-2).
    this.terrain.name = 'terrain';
    this.scene.add(this.terrain);
    this.proceduralTerrain = this.buildProceduralTerrain(this.layout);
    this.terrain.add(this.proceduralTerrain);

    // Ground grid and its scale (translucent over the terrain).
    // The grid covers the horizontal travel (at least 10 m) and a quarter of the height, so a
    // high flight still has a scale under it.
    const extent = Math.max(10, 1.2 * horizontal, this.extents.vertical / 4);
    this.spacing = gridSpacing(extent);
    const cells = Math.ceil(extent / this.spacing);
    this.gridHalfSize = cells * this.spacing;
    const grid = new GridHelper(2 * this.gridHalfSize, 2 * cells, 0xffffff, 0xffffff);
    grid.rotation.x = Math.PI / 2; // GridHelper lies in XZ (y up); the flight frame has z up.
    grid.position.z = this.groundZ + 0.002 * L;
    for (const m of materialsOf(grid)) {
      m.transparent = true;
      m.opacity = 0.22;
      m.depthWrite = false;
      if (m instanceof LineBasicMaterial) m.fog = false;
    }
    grid.name = 'ground-grid';
    this.scene.add(grid);
    // Marker size: a drawing choice, small next to a model rocket, bounded for long flights.
    this.markerRadius = Math.min(2, Math.max(0.04, extent / 300));

    const labels: SceneLabel[] = [];
    // At most five distance labels per axis, so they stay readable.
    const labelEvery = Math.max(1, Math.ceil(cells / 5));
    for (let i = labelEvery; i <= cells; i += labelEvery) {
      const d = i * this.spacing;
      const text = inputs.format.format(d, 'm');
      labels.push({ kind: 'scale', text, position: { x: d, y: 0, z: this.groundZ } });
      labels.push({ kind: 'scale', text, position: { x: 0, y: d, z: this.groundZ } });
    }
    const gz = this.groundZ;
    labels.push({ kind: 'compass', text: 'N', position: { x: 0, y: this.gridHalfSize, z: gz } });
    labels.push({ kind: 'compass', text: 'E', position: { x: this.gridHalfSize, y: 0, z: gz } });
    labels.push({ kind: 'pad', text: 'Pad', position: { x: 0, y: 0, z: gz } });

    // Launch pad: the rail along the stored rail direction and length, beside the rocket on the
    // side of its rail buttons (body +z, D-071), and a blast plate on the ground.
    const d = railDirection(inputs.rail.angleFromVertical, inputs.rail.azimuth);
    const railDir = new Vector3(d.x, d.y, d.z).normalize();
    const side = new Vector3(0, 0, 1).applyQuaternion(this.rocket.quaternion);
    side.addScaledVector(railDir, -side.dot(railDir));
    if (side.lengthSq() < 1e-12) side.set(0, -1, 0);
    side.normalize();
    const bodyRadius = bodyRadiusOf(this.model.parts);
    this.scene.add(
      buildPad({
        groundZ: this.groundZ,
        railDirection: railDir,
        railSide: side,
        railOffset: bodyRadius + 0.004,
        railLength: inputs.rail.length,
        rocketLength: L,
      }),
    );

    // Flight path through every stored position, and the part flown so far (not fogged: data).
    const positions = inputs.result.samples.map((s) => s.position);
    const path = lineThrough(positions, 0xffffff, 'flight-path');
    const pathMat = path.material as LineBasicMaterial;
    pathMat.transparent = true;
    pathMat.opacity = 0.45;
    this.scene.add(path);
    this.flown = lineThrough(positions, 0x2fe06a, 'flight-path-flown');
    this.flown.geometry.setDrawRange(0, 1);
    this.scene.add(this.flown);

    // Ground track (stored positions projected on the drawn ground) and the drop line.
    this.track = lineThrough(
      positions.map((p) => ({ x: p.x, y: p.y, z: this.groundZ + 0.01 * L })),
      0xe3342f,
      'ground-track',
    );
    this.track.geometry.setDrawRange(0, 1);
    this.scene.add(this.track);
    this.drop = lineThrough(
      [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: this.groundZ },
      ],
      0xe76f9a,
      'drop-line',
    );
    this.scene.add(this.drop);

    // Effects (illustrative, D-3D-1).
    this.thrustMax = maxThrust(inputs.result);
    this.flame = new ExhaustFlame(this.model.extent.length, aftRadiusOf(this.model.parts));
    this.flameHolder.add(this.flame.group);
    this.rocket.add(this.flameHolder);
    this.wind = windVelocity(inputs.wind);
    this.emissions = smokeEmissions(inputs.result, this.model.extent.length);
    const diameter = 2 * bodyRadius;
    this.smokeOptions = {
      startSize: Math.max(0.12, 4 * diameter),
      growth: Math.max(0.5, 5 * diameter),
      billow: Math.max(0.3, 8 * diameter),
      fade: 22,
      jitter: 0.5,
    };
    this.smoke = new SmokeTrail(SMOKE_MAX_PUFFS);
    this.scene.add(this.smoke.points);
    this.canopyStates = deployedCanopies(inputs.result, inputs.recovery ?? []);
    const colours: readonly [number, number][] = [
      [0xff6a13, 0xf4f4f4],
      [0xd7263d, 0xffd23f],
      [0x1b998b, 0xf4f4f4],
    ];
    this.canopies = this.canopyStates.map((c, i) => {
      const pair = colours[i % colours.length] ?? [0xff6a13, 0xf4f4f4];
      const g = buildCanopy(c, this.lineLength(c), pair[0], pair[1]);
      g.visible = false;
      this.scene.add(g);
      return g;
    });

    // Event markers at their stored steps; events at the same step share one label.
    this.markers = eventMarkers(inputs.result);
    const sphere = new SphereGeometry(this.markerRadius, 16, 12);
    const byStep = new Map<number, EventMarker[]>();
    for (const m of this.markers) {
      const mesh = new Mesh(
        sphere,
        new MeshBasicMaterial({ color: EVENT_COLOURS[m.event.kind], fog: false }),
      );
      mesh.position.set(m.position.x, m.position.y, m.position.z);
      mesh.name = `event-${m.event.kind}`;
      mesh.userData = { index: m.index, time: m.time };
      this.scene.add(mesh);
      this.markerMeshes.push(mesh);
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
      const origin = new Vector3(0, 0, this.groundZ + 0.5);
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
      labels.push({
        kind: 'wind',
        text: 'No wind',
        position: { x: 0, y: 0, z: this.groundZ + 0.5 },
      });
    }
    this.labels = labels;

    this.landing.name = 'landing';
    this.scene.add(this.landing);
    this.setStep(0);
  }

  private buildProceduralTerrain(layout: SceneryLayout): Group {
    const g = new Group();
    g.name = 'procedural-terrain';
    const ground = new Mesh(
      terrainGeometry(layout),
      // Lambert: the ground is fully diffuse, and it covers most pixels, so the cheap model matters.
      new MeshLambertMaterial({ vertexColors: true, map: grassTexture() }),
    );
    ground.name = 'ground';
    ground.receiveShadow = true;
    g.add(ground, buildTrees(layout));
    return g;
  }

  /** Shroud line length for a canopy (drawing choice: 1.5 rocket lengths plus the diameter). */
  private lineLength(c: CanopyState): number {
    return 1.5 * this.rocketLength + c.diameter;
  }

  /**
   * Replace the illustrative terrain with a real-world one (D-3D-2), or
   * restore it with `undefined`. `visibility` is the distance at which the
   * fog hides the ground, metres.
   */
  setTerrain(terrain: Object3D | undefined, visibility?: number): void {
    this.terrain.clear();
    if (terrain === undefined) {
      this.terrain.add(this.proceduralTerrain);
      this.fog.density = 2 / this.layout.outerRadius;
    } else {
      this.terrain.add(terrain);
      this.fog.density = 2 / Math.max(1, visibility ?? this.layout.outerRadius);
    }
  }

  /**
   * The viewer's low-quality mode for weak or software renderers: no sun
   * shadows and a quarter of the trees. Scenery only; nothing of the flight changes.
   */
  setLowDetail(low: boolean): void {
    this.sun.castShadow = !low;
    this.proceduralTerrain.traverse((o) => {
      if (o instanceof InstancedMesh) {
        const all = (o.userData['placed'] as number | undefined) ?? o.count;
        o.userData['placed'] = all;
        o.count = low ? Math.ceil(all / 4) : all;
      }
    });
  }

  /** The sky's material, for the image-based lighting the renderer derives from it. */
  get skyMaterial(): Material {
    return materialsOf(this.sky)[0] ?? new MeshBasicMaterial();
  }

  /** Per-frame and per-viewport preparation: the sky follows the camera; smoke sizes in pixels. */
  prepareRender(camera: PerspectiveCamera, viewportHeight: number): void {
    this.sky.position.copy(camera.position);
    this.sky.updateMatrixWorld(true);
    const f = Math.tan((camera.fov * Math.PI) / 180 / 2);
    this.smoke.setProjectionScale(viewportHeight / (2 * f));
    // Event markers keep about MARKER_PIXELS on screen at any distance, never above their
    // drawn radius, so they neither vanish on a long flight nor hide the rocket close up.
    const metresPerPixel = (2 * f) / Math.max(1, viewportHeight);
    for (const m of this.markerMeshes) {
      const d = camera.position.distanceTo(m.position);
      const r = (MARKER_PIXELS / 2) * metresPerPixel * d;
      const k = Math.min(1, r / this.markerRadius);
      m.scale.setScalar(k);
      m.updateMatrixWorld(true);
    }
  }

  /** Whether the exhaust flame is shown at the current replay time. */
  get flameVisible(): boolean {
    return this.flame.visible;
  }

  /** The canopies drawn (names, diameters, deployment times). */
  get canopyList(): readonly CanopyState[] {
    return this.canopyStates;
  }

  /** The number of smoke puffs drawn at the current replay time. */
  get smokeCount(): number {
    return this.smoke.points.geometry.drawRange.count;
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

  private place(
    position: Vec3,
    q: { readonly w: number; readonly x: number; readonly y: number; readonly z: number },
    cg: number,
  ): void {
    this.rocket.position.set(position.x, position.y, position.z);
    this.rocket.quaternion.set(q.x, q.y, q.z, q.w);
    this.model.group.position.set(-cg, 0, 0);
    this.rocket.updateMatrixWorld(true);
  }

  private pose(
    position: Vec3,
    q: { readonly w: number; readonly x: number; readonly y: number; readonly z: number },
    cg: number,
  ): void {
    this.place(position, q, cg);
    this.flown.geometry.setDrawRange(0, this.currentIndex + 1);
    this.flameHolder.position.set(-cg, 0, 0);
    this.track.geometry.setDrawRange(0, this.currentIndex + 1);
    const t = this.currentTime;
    const samples = this.result.samples;
    this.flame.setThrust(this.thrustMax > 0 ? displayThrust(samples, t) / this.thrustMax : 0, t);
    this.smoke.update(smokePuffs(this.emissions, this.wind, t, this.smokeOptions));
    // Drop line from the rocket to the drawn ground.
    const dp = this.drop.geometry.getAttribute('position');
    dp.setXYZ(0, position.x, position.y, position.z);
    dp.setXYZ(1, position.x, position.y, this.groundZ);
    dp.needsUpdate = true;
    this.drop.geometry.computeBoundingSphere();
    // Canopies: above the rocket, against the air-relative velocity (blended stored velocity
    // minus the ground wind input), inflating over 0.6 s after the stored deployment.
    const v = displayVelocity(samples, t);
    const air = new Vector3(v.x - this.wind.x, v.y - this.wind.y, v.z - this.wind.z);
    const up = air.lengthSq() > 1e-6 ? air.negate().normalize() : new Vector3(0, 0, 1);
    if (up.z < 0.2) up.z = 0.2;
    up.normalize();
    const along = new ThreeQuaternion().setFromUnitVectors(new Vector3(0, 1, 0), up);
    this.canopies.forEach((g, i) => {
      const c = this.canopyStates[i];
      if (c === undefined) return;
      const s = inflation(t - c.deployedAt);
      g.visible = s > 0 && bracket(samples, t).a.phase !== 'landed';
      if (!g.visible) return;
      const lift = this.lineLength(c) + (g.userData['rimY'] as number);
      // Several canopies side by side.
      const offset = (i - (this.canopies.length - 1) / 2) * 0.6 * c.diameter;
      g.position.set(position.x, position.y, position.z).addScaledVector(up, lift);
      g.position.x += offset;
      g.quaternion.copy(along);
      const dome = g.getObjectByName('canopy-dome');
      dome?.scale.set(s, 0.5 + 0.5 * s, s);
    });
    // The sun's shadow box follows the rocket.
    this.sun.target.position.set(position.x, position.y, position.z);
    this.sun.position
      .set(position.x, position.y, position.z)
      .addScaledVector(SUN_DIRECTION, 100 * this.rocketLength + 20);
    this.sun.target.updateMatrixWorld(true);
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
