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
  Group,
  HemisphereLight,
  Line,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Quaternion as ThreeQuaternion,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import {
  buildCanopy,
  StreamerRibbon,
  deployedCanopies,
  displayThrust,
  groundCloud,
  GROUND_CLOUD_PUFFS,
  type GroundCloudOptions,
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
import { GroundMaterial, type GroundTextures } from './ground.js';
import { sceneryLayout, terrainGeometry, type SceneryLayout } from './scenery.js';
import {
  blend,
  CANOPY_COLLAPSE_S,
  HANG_BLEND_S,
  hangingNose,
  lyingAttitude,
  lyingHeight,
  noseAlong,
  restingPlace,
  TIP_OVER_S,
  type RestPlace,
} from './recovery-pose.js';
import { SKY_HAZE, SkyDome, SUN_DIRECTION } from './sky.js';
import { TreeBillboards, type TreeAtlas } from './trees.js';
import type { PaintSchemeId } from '../geometry/finish.js';
import { motorNozzles, type MotorInputs, type MotorNozzle } from '../geometry/motor-model.js';
import {
  buildRocketObject,
  rocketModelParts,
  type ButtonPart,
  type ModelPart,
  type RevolvedPart,
  type RocketLook,
  type RocketObject,
} from '../geometry/rocket-model.js';
import { buildLauncher, launchGuide } from './launcher.js';
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
  /** The design's motors (case, nozzle, flames), from `designMotor`; none for a rocket without a motor. */
  readonly motor?: MotorInputs;
  /** The paint scheme picked in the viewer (the design stores no colours). */
  readonly scheme?: PaintSchemeId;
}

/** The photographic scenery (plan 3d-0002), loaded by the DOM side and applied when ready. */
export interface SceneryAssets {
  /** The visible sky, sRGB (sky.ts). */
  readonly sky: Texture;
  readonly ground: GroundTextures;
  readonly trees: TreeAtlas;
}

/** Gap from the nozzle at rest to the blast deflector, and the deflector's height above the ground, metres (drawing choices). */
export const PAD_GAP = 0.02;
export const PAD_HEIGHT = 0.12;

/** Trees drawn around the field (a drawing budget). */
export const TREE_COUNT = 2200;

export type LabelKind = 'scale' | 'compass' | 'event' | 'wind' | 'pad';

export interface SceneLabel {
  readonly kind: LabelKind;
  readonly text: string;
  readonly position: Vec3;
  /** For an event's label, the replay time from which it is shown (D-3D-7); always shown otherwise. */
  readonly from?: number;
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
  ignition: 0xd9534f,
  separation: 0x5a6470,
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

/** Rings of radius spacing, 2 spacing, … up to `half`, and the two axes, at height z. */
export function rangeRings(half: number, spacing: number, z: number): Group {
  const g = new Group();
  const material = new LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    fog: false,
  });
  const segments = 128;
  for (let r = spacing; r <= half + 1e-9; r += spacing) {
    const pts: number[] = [];
    for (let j = 0; j < segments; j++) {
      const a = (2 * Math.PI * j) / segments;
      pts.push(r * Math.cos(a), r * Math.sin(a), z);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pts, 3));
    g.add(new LineLoop(geo, material));
  }
  const cross = new BufferGeometry();
  cross.setAttribute(
    'position',
    new Float32BufferAttribute([-half, 0, z, half, 0, z, 0, -half, z, 0, half, z], 3),
  );
  g.add(new LineSegments(cross, material));
  return g;
}

/** The largest radius of the coaxial revolved parts (the body), metres. */
function bodyRadiusOf(parts: readonly ModelPart[]): number {
  let r = 0;
  for (const p of parts) {
    if (p.kind !== 'revolved' || p.offset !== undefined || p.shift !== undefined) continue;
    for (const [, pr] of p.outline) r = Math.max(r, pr);
  }
  return r;
}

/** The radius of the outline at the aft end of the model, metres. */
function aftRadiusOf(parts: readonly ModelPart[]): number {
  let aft = 0;
  for (const p of parts)
    if (p.kind === 'revolved' && p.offset === undefined && p.shift === undefined)
      for (const [x] of p.outline) aft = Math.max(aft, x);
  let r = 0;
  for (const p of parts) {
    if (p.kind !== 'revolved' || p.offset !== undefined || p.shift !== undefined) continue;
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
  /** The rocket's lowest point at rest (z), metres. */
  readonly restBottomZ: number;
  private readonly baseFar: number;
  /** The first stored deployment and the stored landing, s (D-3D-7); undefined when absent. */
  private readonly deployTime: number | undefined;
  private readonly landTime: number | undefined;
  /** The axis's height above the ground when the rocket lies on its side. */
  private readonly lyingAxisHeight: number;
  /** Where and how the landed rocket lies (undefined without a landing), and its attitude there. */
  private readonly rest: RestPlace | undefined;
  private readonly lyingQ: ThreeQuaternion;
  private readonly flown: Line;
  private readonly track: Line;
  private readonly drop: Line;
  private readonly sky: SkyDome;
  private readonly fog: FogExp2;
  private readonly sun: DirectionalLight;
  private readonly hemisphere: HemisphereLight;
  private readonly groundMaterial: GroundMaterial;
  private readonly trees: TreeBillboards;
  private readonly terrain = new Group();
  private readonly proceduralTerrain: Group;
  private readonly flameHolder = new Group();
  private readonly flames: readonly ExhaustFlame[];
  private readonly nozzles: readonly MotorNozzle[];
  private readonly leads: Group;
  private readonly fallenLeads: Group;
  private readonly liftoffTime: number;
  private readonly thrustMax: number;
  private readonly wind: Vec3;
  private readonly emissions: readonly SmokeEmission[];
  private readonly smokeOptions: SmokeOptions;
  private readonly smoke: SmokeTrail;
  private readonly groundCloudOptions: GroundCloudOptions | undefined;
  private readonly cords: readonly Line[];
  private readonly ribbons = new Map<number, StreamerRibbon>();
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
    const look: RocketLook = {
      ...(inputs.motor === undefined ? {} : { motor: inputs.motor }),
      ...(inputs.scheme === undefined ? {} : { scheme: inputs.scheme }),
    };
    this.model = buildRocketObject(rocketModelParts(inputs.components), look);
    this.rocket = new Group();
    this.rocket.name = 'rocket';
    this.rocket.add(this.model.group);
    this.scene.add(this.rocket);
    const L = Math.max(0.05, this.model.extent.length);
    this.rocketLength = L;

    // The drawn ground (D-3D-1, D-3D-4): the stored z = 0 is the CG at rest, so the ground is
    // drawn below the rocket's lowest point at rest (the nozzle): a 2 cm gap to the blast
    // deflector, and the launcher's base 12 cm above the ground.
    const first = inputs.result.samples[0];
    if (first === undefined) throw new Error('FlightScene: the result has no stored steps');
    this.place(first.position, first.orientation, first.cg);
    const rest = new Box3().setFromObject(this.model.group);
    this.restBottomZ = Number.isFinite(rest.min.z) ? Math.min(0, rest.min.z) : 0;
    this.groundZ = this.restBottomZ - PAD_GAP - PAD_HEIGHT;

    const horizontal = horizontalExtent(inputs.result, inputs.extraGroundPoints);
    this.extents = { horizontal, vertical: verticalExtent(inputs.result) };
    this.layout = sceneryLayout(this.extents, this.groundZ);
    this.baseFar = Math.max(50_000, 2.5 * this.layout.outerRadius);
    this.camera.far = this.baseFar;
    this.camera.updateProjectionMatrix();

    // Sky, fog and light (plan 3d-0002): the photographic sky arrives with the assets; the haze
    // is its horizon colour, so the distant ground fades into the photograph's horizon.
    this.sky = new SkyDome(0.45 * this.camera.far);
    this.scene.add(this.sky.mesh);
    const haze = new Color().setHex(SKY_HAZE, SRGBColorSpace);
    this.scene.background = haze;
    this.fog = new FogExp2(haze, 2 / this.layout.outerRadius);
    this.scene.fog = this.fog;
    // Ambient light until the sky's image-based lighting is ready (the renderer sets it).
    this.hemisphere = new HemisphereLight(0xcfe2ff, 0x5b5140, 1.1);
    this.scene.add(this.hemisphere);
    // The sun stands where the photograph's sun is (sky.ts).
    this.sun = new DirectionalLight(0xfff4e5, 3.0);
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
    this.groundMaterial = new GroundMaterial(Math.max(1, 1.2 * L));
    this.trees = new TreeBillboards(this.layout, TREE_COUNT, {
      direction: SUN_DIRECTION.clone(),
      colour: this.sun.color.clone().multiplyScalar(this.sun.intensity / Math.PI),
    });
    this.proceduralTerrain = this.buildProceduralTerrain(this.layout);
    this.terrain.add(this.proceduralTerrain);

    // Ground grid and its scale (translucent over the terrain).
    // The grid covers the horizontal travel (at least 10 m) and a quarter of the height, so a
    // high flight still has a scale under it.
    const extent = Math.max(10, 1.2 * horizontal, this.extents.vertical / 4);
    this.spacing = gridSpacing(extent);
    const cells = Math.ceil(extent / this.spacing);
    this.gridHalfSize = cells * this.spacing;
    // Range rings at the grid spacing and a faint north-south / east-west cross (D-3D-7): a
    // distance scale that reads like a range map rather than lines painted on the field.
    const grid = rangeRings(this.gridHalfSize, this.spacing, this.groundZ + 0.002 * L);
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

    // Launcher (plan 3d-0002): a rod through the lug or a rail under the buttons, along the stored
    // rail direction and length, on the side of the guides (body +z, D-071), with the igniter leads.
    const d = railDirection(inputs.rail.angleFromVertical, inputs.rail.azimuth);
    const railDir = new Vector3(d.x, d.y, d.z).normalize();
    const side = new Vector3(0, 0, 1).applyQuaternion(this.rocket.quaternion);
    side.addScaledVector(railDir, -side.dot(railDir));
    if (side.lengthSq() < 1e-12) side.set(0, -1, 0);
    side.normalize();
    const bodyRadius = bodyRadiusOf(this.model.parts);
    const lugPart = this.model.parts.find(
      (p): p is RevolvedPart =>
        p.kind === 'revolved' && p.component === 'launchLug' && p.shift === undefined,
    );
    const buttonPart = this.model.parts.find(
      (p): p is ButtonPart => p.kind === 'button' && p.shift === undefined,
    );
    const guide = launchGuide(
      bodyRadius,
      lugPart?.bore === undefined || lugPart.offset === undefined
        ? undefined
        : { bore: lugPart.bore, offset: lugPart.offset.distance },
      buttonPart === undefined
        ? undefined
        : { outerDiameter: buttonPart.outerDiameter, baseHeight: buttonPart.baseHeight ?? 0 },
    );
    this.nozzles = inputs.motor === undefined ? [] : motorNozzles(inputs.motor);
    const nozzlesAtRest = this.nozzles.map((n) =>
      this.model.group.localToWorld(new Vector3(n.x, n.y, n.z)),
    );
    const launcher = buildLauncher({
      groundZ: this.groundZ,
      direction: railDir,
      side,
      guide,
      railLength: inputs.rail.length,
      rocketLength: L,
      nozzles: nozzlesAtRest,
      deflectorZ: this.restBottomZ - PAD_GAP,
    });
    this.scene.add(launcher.group);
    this.leads = launcher.leads;
    this.fallenLeads = launcher.fallenLeads;
    const liftoff = inputs.result.events.find(
      (e) => e.kind === 'liftoff' || e.kind === 'rail-exit',
    );
    this.liftoffTime = liftoff?.time ?? 0;

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
    // One flame per nozzle (a cluster's too); without a motor, one at the aft end.
    this.flames =
      this.nozzles.length > 0
        ? this.nozzles.map((n) => {
            const f = new ExhaustFlame(n.x, n.radius);
            f.group.position.set(n.x, n.y, n.z);
            return f;
          })
        : [new ExhaustFlame(this.model.extent.length, aftRadiusOf(this.model.parts))];
    for (const f of this.flames) this.flameHolder.add(f.group);
    this.rocket.add(this.flameHolder);
    this.wind = windVelocity(inputs.wind);
    const diameter = 2 * bodyRadius;
    // Puffs a third of their starting size apart at most, so the trail stays continuous.
    this.emissions = smokeEmissions(
      inputs.result,
      this.model.extent.length,
      Math.max(0.12, 4 * diameter) / 3,
    );
    this.smokeOptions = {
      startSize: Math.max(0.12, 4 * diameter),
      growth: Math.max(0.5, 5 * diameter),
      billow: Math.max(0.3, 8 * diameter),
      fade: 7,
      jitter: 0.5,
    };
    this.smoke = new SmokeTrail(SMOKE_MAX_PUFFS + GROUND_CLOUD_PUFFS, {
      direction: SUN_DIRECTION.clone(),
      colour: this.sun.color.clone().multiplyScalar(this.sun.intensity / Math.PI),
    });
    // The cloud the exhaust raises at the pad, from ignition to leaving the rail.
    const railExit = inputs.result.events.find((e) => e.kind === 'rail-exit');
    this.groundCloudOptions =
      this.thrustMax > 0
        ? {
            groundZ: this.groundZ,
            start: 0,
            end: (railExit?.time ?? 0.3) + 0.2,
            reach: Math.max(2, 6 * L),
            size: Math.max(0.6, 1.8 * L),
            fade: 4,
          }
        : undefined;
    this.scene.add(this.smoke.points);
    this.canopyStates = deployedCanopies(inputs.result, inputs.recovery ?? []);
    const deployments = inputs.result.events.filter((e) => e.kind === 'deployment');
    this.deployTime =
      deployments.length > 0 ? Math.min(...deployments.map((e) => e.time)) : undefined;
    this.landTime = inputs.result.events.find((e) => e.kind === 'landing')?.time;
    const fins = this.model.parts.filter((p) => p.kind === 'fin' && p.shift === undefined);
    const firstSet = fins[0]?.name.replace(/ fin \d+$/, '');
    const finCount = fins.filter((p) => p.name.replace(/ fin \d+$/, '') === firstSet).length;
    const tip = Math.max(
      0,
      ...fins.flatMap((p) => (p.kind === 'fin' ? p.corners.map(([, r]) => r) : [])),
    );
    this.lyingAxisHeight = lyingHeight(bodyRadius, tip, finCount);
    const last = inputs.result.samples[inputs.result.samples.length - 1] ?? first;
    this.rest =
      this.landTime === undefined
        ? undefined
        : restingPlace({
            landing: last.position,
            drift: last.velocity,
            length: L,
            footprint: launcher.footprint,
            clearance: this.model.extent.maxRadius,
          });
    this.lyingQ = lyingAttitude(
      new Vector3(this.rest?.fall.x ?? 1, this.rest?.fall.y ?? 0, 0),
      finCount,
    );
    const colours: readonly [number, number][] = [
      [0xff6a13, 0xf4f4f4],
      [0xd7263d, 0xffd23f],
      [0x1b998b, 0xf4f4f4],
    ];
    this.canopies = this.canopyStates.map((c, i) => {
      let g: Group;
      if (c.streamer !== undefined) {
        // A streamer (issue #102): its strip hangs from the cord's end.
        g = new Group();
        g.name = `streamer-${c.name}`;
        const ribbon = new StreamerRibbon(c.name, c.streamer.length, c.streamer.width);
        g.add(ribbon.mesh);
        this.ribbons.set(i, ribbon);
      } else {
        const pair = colours[i % colours.length] ?? [0xff6a13, 0xf4f4f4];
        g = buildCanopy(c, this.lineLength(c), pair[0], pair[1]);
      }
      g.visible = false;
      this.scene.add(g);
      return g;
    });
    // Shock cords from each canopy's confluence to the rocket (updated as it moves).
    this.cords = this.canopyStates.map(() => {
      const cord = lineThrough(
        [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 0 },
        ],
        0xd9c27a,
        'shock-cord',
      );
      (cord.material as LineBasicMaterial).fog = true;
      cord.visible = false;
      this.scene.add(cord);
      return cord;
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
        from: first.time,
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
    // Lambert: the ground is fully diffuse and covers most pixels, so the cheap model matters.
    const ground = new Mesh(terrainGeometry(layout), this.groundMaterial.material);
    ground.name = 'ground';
    ground.receiveShadow = true;
    g.add(ground, this.trees.mesh);
    return g;
  }

  /**
   * Apply the photographic scenery (plan 3d-0002): the sky photograph, the
   * ground textures and the tree billboards. Drawing only.
   */
  applyAssets(assets: SceneryAssets): void {
    this.sky.setPhoto(assets.sky);
    this.groundMaterial.setTextures(assets.ground);
    this.trees.setAtlas(assets.trees);
  }

  /**
   * Called by the renderer once the sky's image-based lighting is in place:
   * the stand-in hemisphere light is dimmed to a small fill.
   */
  useImageLighting(): void {
    this.hemisphere.intensity = 0.25;
  }

  /** Trees drawn now (for tests and the low-detail mode). */
  get treeCount(): number {
    return this.trees.instanceCount;
  }

  /** Shroud line length for a canopy (drawing choice: 1.2 canopy diameters, a common rigging). */
  private lineLength(c: CanopyState): number {
    return 1.2 * c.diameter;
  }

  /**
   * Replace the illustrative terrain with a real-world one (D-3D-2), or
   * restore it with `undefined`. `visibility` is the distance at which the
   * fog hides the ground, metres.
   */
  setTerrain(terrain: Object3D | undefined, visibility?: number, radius?: number): void {
    this.terrain.clear();
    if (terrain === undefined) {
      this.terrain.add(this.proceduralTerrain);
      this.fog.density = 2 / this.layout.outerRadius;
      this.camera.far = this.baseFar;
    } else {
      this.terrain.add(terrain);
      this.fog.density = 2 / Math.max(1, visibility ?? this.layout.outerRadius);
      // The real terrain reaches the horizon (D-3D-5): the far plane goes past it.
      this.camera.far = Math.max(this.baseFar, 1.5 * (radius ?? 0));
    }
    this.camera.updateProjectionMatrix();
  }

  /**
   * The viewer's low-quality mode for weak or software renderers: no sun
   * shadows and a quarter of the trees. Scenery only; nothing of the flight changes.
   */
  setLowDetail(low: boolean): void {
    this.sun.castShadow = !low;
    this.trees.setLowDetail(low);
  }

  /** The sky's material, for the image-based lighting the renderer derives from it before the photograph loads. */
  get skyMaterial(): Material {
    return this.sky.material;
  }

  /** Per-frame and per-viewport preparation: the sky follows the camera; smoke sizes in pixels. */
  prepareRender(camera: PerspectiveCamera, viewportHeight: number): void {
    this.sky.mesh.position.copy(camera.position);
    this.sky.mesh.updateMatrixWorld(true);
    const f = Math.tan((camera.fov * Math.PI) / 180 / 2);
    this.smoke.setProjectionScale(viewportHeight / (2 * f));
    camera.updateMatrixWorld();
    this.smoke.setCamera(camera);
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
    return this.flames.some((f) => f.visible);
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
    const t = this.currentTime;
    const samples = this.result.samples;
    // The air-relative velocity's reverse: from the rocket towards a deployed canopy.
    const v = displayVelocity(samples, t);
    const air = new Vector3(v.x - this.wind.x, v.y - this.wind.y, v.z - this.wind.z);
    const up = air.lengthSq() > 1e-6 ? air.negate().normalize() : new Vector3(0, 0, 1);
    if (up.z < 0.2) up.z = 0.2;
    up.normalize();
    // Under the recovery device and after landing the attitude is drawn, not stored (D-3D-7).
    const stored = new ThreeQuaternion(q.x, q.y, q.z, q.w);
    const drawn = stored.clone();
    if (this.deployTime !== undefined && t >= this.deployTime) {
      drawn.slerp(noseAlong(hangingNose(up, t)), blend(t, this.deployTime, HANG_BLEND_S));
    }
    // After the landing the rocket falls over about its tail onto the ground: the tail moves
    // from where it hangs to its resting place while the body turns to lie along the fall.
    const at = new Vector3(position.x, position.y, position.z);
    const lying = this.landTime === undefined ? 0 : blend(t, this.landTime, TIP_OVER_S);
    if (lying > 0 && this.rest !== undefined) {
      const tailToCg = new Vector3(cg - this.model.extent.length, 0, 0);
      const tail = at.clone().sub(tailToCg.clone().applyQuaternion(drawn));
      tail.lerp(
        new Vector3(this.rest.tail.x, this.rest.tail.y, this.groundZ + this.lyingAxisHeight),
        lying,
      );
      drawn.slerp(this.lyingQ, lying);
      at.copy(tail).add(tailToCg.applyQuaternion(drawn));
    }
    this.place(at, drawn, cg);
    this.flown.geometry.setDrawRange(0, this.currentIndex + 1);
    this.flameHolder.position.set(-cg, 0, 0);
    this.track.geometry.setDrawRange(0, this.currentIndex + 1);
    const fraction = this.thrustMax > 0 ? displayThrust(samples, t) / this.thrustMax : 0;
    for (const f of this.flames) f.setThrust(fraction, t);
    const onPad = t < this.liftoffTime;
    this.leads.visible = onPad;
    this.fallenLeads.visible = !onPad;
    const cloud =
      this.groundCloudOptions === undefined
        ? []
        : groundCloud(this.wind, t, this.groundCloudOptions);
    this.smoke.update([...cloud, ...smokePuffs(this.emissions, this.wind, t, this.smokeOptions)]);
    // Drop line from the rocket to the drawn ground.
    const dp = this.drop.geometry.getAttribute('position');
    dp.setXYZ(0, position.x, position.y, position.z);
    dp.setXYZ(1, position.x, position.y, this.groundZ);
    dp.needsUpdate = true;
    this.drop.geometry.computeBoundingSphere();
    // Within 2 m of the ground the drop line says nothing and runs through the pad.
    this.drop.visible = position.z - this.groundZ > 2;
    // Canopies: above the rocket, against the air-relative velocity (blended stored velocity
    // minus the ground wind input), inflating over 0.6 s after the stored deployment.
    const along = new ThreeQuaternion().setFromUnitVectors(new Vector3(0, 1, 0), up);
    // After the landing the canopy or streamer lies on the ground beyond the rocket's nose.
    const flat = new Vector3(this.rest?.fall.x ?? 1, this.rest?.fall.y ?? 0, 0);
    this.canopies.forEach((g, i) => {
      const c = this.canopyStates[i];
      if (c === undefined) return;
      const s = inflation(t - c.deployedAt);
      g.visible = s > 0;
      if (!g.visible) return;
      const collapse = this.landTime === undefined ? 0 : blend(t, this.landTime, CANOPY_COLLAPSE_S);
      const ribbon = this.ribbons.get(i);
      if (ribbon !== undefined) {
        // The strip from the cord's end, unfurling over 0.5 s; after the landing it lies flat
        // on the ground beyond the rocket.
        const cordEnd = at.clone().addScaledVector(up, 1.5 * this.rocketLength);
        g.position.copy(cordEnd);
        g.quaternion.copy(along);
        if (collapse > 0) {
          const ground = at.clone().addScaledVector(flat, 1.5 * this.rocketLength);
          ground.z = this.groundZ + 0.01;
          g.position.lerp(ground, collapse);
          g.quaternion.slerp(
            new ThreeQuaternion().setFromUnitVectors(new Vector3(0, 1, 0), flat),
            collapse,
          );
        }
        ribbon.update(t, (t - c.deployedAt) / 0.5, collapse);
        const cord = this.cords[i];
        if (cord !== undefined) {
          const cp = cord.geometry.getAttribute('position');
          cp.setXYZ(0, at.x, at.y, at.z);
          cp.setXYZ(1, g.position.x, g.position.y, g.position.z);
          cp.needsUpdate = true;
          cord.geometry.computeBoundingSphere();
        }
        return;
      }
      // The confluence hangs a shock cord's length (1.5 rocket lengths) above the rocket; the
      // canopy a line length above that.
      const cordLength = 1.5 * this.rocketLength;
      const lift = cordLength + this.lineLength(c);
      // Several canopies side by side.
      const offset = (i - (this.canopies.length - 1) / 2) * 0.6 * c.diameter;
      g.position.copy(at).addScaledVector(up, lift);
      g.position.x += offset;
      g.quaternion.copy(along);
      // Breathing: a full canopy pulses slightly (drawing only).
      const breathe = 1 + 0.025 * Math.sin((2 * Math.PI * t) / 1.4 + i);
      const dome = g.getObjectByName('canopy-dome');
      dome?.scale.set(s * breathe, 0.5 + 0.5 * s, s * breathe);
      if (collapse > 0) {
        // After the landing the canopy settles on the ground beyond the rocket, flattening.
        const ground = at
          .clone()
          .addScaledVector(flat, cordLength + 0.6 * this.lineLength(c) + 0.5 * c.diameter);
        ground.z = this.groundZ + 0.02;
        g.position.lerp(ground, collapse);
        g.quaternion.slerp(
          new ThreeQuaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(0, 0, 1)),
          collapse,
        );
        dome?.scale.set(1 + 0.3 * collapse, 1 - 0.92 * collapse, 1 + 0.3 * collapse);
        const lines = g.getObjectByName('shroud-lines');
        if (lines !== undefined) lines.visible = collapse < 0.5;
      } else {
        const lines = g.getObjectByName('shroud-lines');
        if (lines !== undefined) lines.visible = true;
      }
      const cord = this.cords[i];
      if (cord !== undefined) {
        const cp = cord.geometry.getAttribute('position');
        cp.setXYZ(0, at.x, at.y, at.z);
        const conf = at.clone().addScaledVector(up, cordLength);
        conf.x += offset;
        // After the landing the cord runs to the collapsed canopy on the ground.
        if (collapse > 0) conf.lerp(g.position, collapse);
        cp.setXYZ(1, conf.x, conf.y, conf.z);
        cp.needsUpdate = true;
        cord.geometry.computeBoundingSphere();
      }
    });
    this.cords.forEach((cord, i) => {
      cord.visible = this.canopies[i]?.visible ?? false;
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
