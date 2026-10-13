/**
 * Illustrative flight effects (plan 3d-0001, D-3D-1): the exhaust flame,
 * the smoke trail, and the parachute canopies. Each is a pure function of
 * the replay time and the stored result, so a seek draws exactly what
 * playing to that time draws, and none of them is a flight value:
 *
 * - the flame shows while the stored thrust, blended between the two
 *   neighbouring stored steps, is above zero;
 * - smoke is emitted from the tail along the stored path while that thrust
 *   is above zero and drifts with the design's ground wind input;
 * - a canopy appears at each stored deployment event of a device of the
 *   design, drawn with that device's canopy diameter.
 */
import {
  noseDirection,
  type FlightResult,
  type FlightSample,
  type Vec3,
} from '@lo-fi-rocket/physics';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  UniformsLib,
  UniformsUtils,
} from 'three';
import { displayPose } from '../replay/clock.js';

/** The two stored steps around `t` and the blend fraction between them (display only). */
export interface Bracket {
  readonly a: FlightSample;
  readonly b: FlightSample;
  readonly f: number;
}

export function bracket(samples: readonly FlightSample[], t: number): Bracket {
  const n = samples.length;
  const first = samples[0];
  const last = samples[n - 1];
  if (first === undefined || last === undefined) throw new Error('bracket: no stored steps');
  if (t <= first.time) return { a: first, b: first, f: 0 };
  if (t >= last.time) return { a: last, b: last, f: 0 };
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((samples[mid]?.time ?? 0) < t) lo = mid + 1;
    else hi = mid;
  }
  const b = samples[lo] ?? last;
  const a = samples[lo - 1] ?? b;
  const span = b.time - a.time;
  return { a, b, f: span > 0 ? (t - a.time) / span : 0 };
}

/** The stored thrust blended between the neighbouring stored steps, N (drawing only). */
export function displayThrust(samples: readonly FlightSample[], t: number): number {
  const { a, b, f } = bracket(samples, t);
  return a.thrust + f * (b.thrust - a.thrust);
}

/** The stored velocity blended between the neighbouring stored steps, m/s (drawing only). */
export function displayVelocity(samples: readonly FlightSample[], t: number): Vec3 {
  const { a, b, f } = bracket(samples, t);
  return {
    x: a.velocity.x + f * (b.velocity.x - a.velocity.x),
    y: a.velocity.y + f * (b.velocity.y - a.velocity.y),
    z: a.velocity.z + f * (b.velocity.z - a.velocity.z),
  };
}

/** The ground wind velocity of the input, m/s: v = −speed (sin ψ, cos ψ, 0) (docs/conventions.md). */
export function windVelocity(
  wind: { readonly speed: number; readonly from: number } | undefined,
): Vec3 {
  if (wind === undefined) return { x: 0, y: 0, z: 0 };
  return { x: -wind.speed * Math.sin(wind.from), y: -wind.speed * Math.cos(wind.from), z: 0 };
}

/** Largest stored thrust, N. */
export function maxThrust(result: FlightResult): number {
  let m = 0;
  for (const s of result.samples) m = Math.max(m, s.thrust);
  return m;
}

// --- Smoke ---

export interface SmokeOptions {
  /** Diameter of a new puff, metres. */
  readonly startSize: number;
  /** Growth of a puff's diameter with age, m/s. */
  readonly growth: number;
  /** Extra diameter a puff billows to in its first second (1 − e^(−a/0.3)), metres. */
  readonly billow: number;
  /** e-folding time of a puff's opacity, s. */
  readonly fade: number;
  /** Random scatter of a puff about its drifted centre, as a fraction of its growth. 0 for none. */
  readonly jitter: number;
}

export interface SmokeEmission {
  readonly time: number;
  /** The tail's position at the emission time (drawn pose). */
  readonly origin: Vec3;
  /** A fixed unit-ish scatter direction for this puff. */
  readonly scatter: Vec3;
}

export interface SmokePuff {
  readonly position: Vec3;
  readonly size: number;
  readonly opacity: number;
}

/** Most puffs emitted over a burn (a drawing budget). */
export const SMOKE_MAX_PUFFS = 1500;

/**
 * The emission schedule: times spaced evenly over the stored steps whose
 * blended thrust is above zero, at most `SMOKE_MAX_PUFFS`, each at the
 * tail of the drawn pose (nose tip minus the length along the nose axis).
 */
export function smokeEmissions(result: FlightResult, rocketLength: number): SmokeEmission[] {
  const samples = result.samples;
  let start = Infinity;
  let end = -Infinity;
  for (const s of samples) {
    if (s.thrust > 0) {
      start = Math.min(start, s.time);
      end = Math.max(end, s.time);
    }
  }
  if (!(end >= start)) return [];
  const count = Math.max(1, Math.min(SMOKE_MAX_PUFFS, Math.ceil((end - start) / 0.002)));
  const dt = count > 1 ? (end - start) / (count - 1) : 0;
  const out: SmokeEmission[] = [];
  let seed = 0x2545f491;
  const rnd = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296 - 0.5;
  };
  for (let k = 0; k < count; k++) {
    const t = start + k * dt;
    const scatter = { x: rnd(), y: rnd(), z: rnd() };
    if (!(displayThrust(samples, t) > 0)) continue;
    const pose = displayPose(samples, t);
    const nose = noseDirection(pose.orientation);
    const back = pose.cg - rocketLength;
    out.push({
      time: t,
      origin: {
        x: pose.position.x + back * nose.x,
        y: pose.position.y + back * nose.y,
        z: pose.position.z + back * nose.z,
      },
      scatter,
    });
  }
  return out;
}

/**
 * The puffs alive at replay time `t`: each emitted puff of age a = t − t_e ≥ 0
 * sits at its origin plus the wind velocity times a (plus its scatter), with
 * diameter startSize + growth·a + billow·(1 − e^(−a/0.3)) and opacity e^(−a/fade), faded in over the
 * first 0.1 s. Puffs fainter than 0.01 are dropped.
 */
export function smokePuffs(
  emissions: readonly SmokeEmission[],
  wind: Vec3,
  t: number,
  options: SmokeOptions,
): SmokePuff[] {
  const out: SmokePuff[] = [];
  for (const e of emissions) {
    const age = t - e.time;
    if (age < 0) break;
    const opacity = Math.exp(-age / options.fade) * Math.min(1, 0.25 + age / 0.1);
    if (opacity < 0.01) continue;
    const spread = options.jitter * options.growth * age;
    out.push({
      position: {
        x: e.origin.x + wind.x * age + spread * e.scatter.x,
        y: e.origin.y + wind.y * age + spread * e.scatter.y,
        z: e.origin.z + wind.z * age + spread * e.scatter.z,
      },
      size: options.startSize + options.growth * age + options.billow * (1 - Math.exp(-age / 0.3)),
      opacity,
    });
  }
  return out;
}

const SMOKE_VERTEX = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
attribute float size;
attribute float alpha;
uniform float projScale;
varying float vAlpha;
void main() {
  vAlpha = alpha;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(size * projScale / -mvPosition.z, 1.0, 512.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
  #include <fog_vertex>
}
`;

const SMOKE_FRAGMENT = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
uniform vec3 color;
varying float vAlpha;
void main() {
  #include <logdepthbuf_fragment>
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float a = vAlpha * (1.0 - smoothstep(0.35, 1.0, d));
  float shade = 0.82 + 0.18 * (0.5 - c.y);
  gl_FragColor = vec4(color * shade, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

/** A point cloud of soft smoke puffs; `update` rewrites it for a list of puffs. */
export class SmokeTrail {
  readonly points: Points;
  readonly material: ShaderMaterial;
  private readonly position: BufferAttribute;
  private readonly size: BufferAttribute;
  private readonly alpha: BufferAttribute;

  constructor(capacity: number) {
    const g = new BufferGeometry();
    this.position = new BufferAttribute(new Float32Array(3 * capacity), 3);
    this.size = new BufferAttribute(new Float32Array(capacity), 1);
    this.alpha = new BufferAttribute(new Float32Array(capacity), 1);
    g.setAttribute('position', this.position);
    g.setAttribute('size', this.size);
    g.setAttribute('alpha', this.alpha);
    g.setDrawRange(0, 0);
    this.material = new ShaderMaterial({
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          projScale: { value: 400 },
          color: { value: new Color().setHex(0xeeeeee, SRGBColorSpace) },
        },
      ]),
      vertexShader: SMOKE_VERTEX,
      fragmentShader: SMOKE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    this.points = new Points(g, this.material);
    this.points.name = 'smoke';
    this.points.frustumCulled = false;
  }

  /** Pixels per metre at unit distance: viewport height / (2 tan(fov/2)). */
  setProjectionScale(scale: number): void {
    const u = this.material.uniforms['projScale'];
    if (u !== undefined) u.value = scale;
  }

  update(puffs: readonly SmokePuff[]): void {
    const n = Math.min(puffs.length, this.size.count);
    // Oldest first in the list; draw the youngest last so it sits over the older smoke.
    for (let i = 0; i < n; i++) {
      const p = puffs[i];
      if (p === undefined) continue;
      this.position.setXYZ(i, p.position.x, p.position.y, p.position.z);
      this.size.setX(i, p.size);
      this.alpha.setX(i, 0.6 * p.opacity);
    }
    this.position.needsUpdate = true;
    this.size.needsUpdate = true;
    this.alpha.needsUpdate = true;
    this.points.geometry.setDrawRange(0, n);
  }
}

// --- Flame ---

/**
 * The exhaust flame in the body frame (x aft): two nested additive cones
 * from the aft end at `aftX`, base radius `radius`. `setThrust` shows it
 * for a thrust fraction in (0, 1] with a length that grows with the square
 * root of the fraction, and hides it at zero.
 */
export class ExhaustFlame {
  readonly group = new Group();
  private readonly outer: Mesh;
  private readonly inner: Mesh;
  private readonly radius: number;

  constructor(aftX: number, radius: number) {
    this.radius = Math.max(1e-3, radius);
    this.group.name = 'exhaust-flame';
    this.group.position.set(aftX, 0, 0);
    const cone = (r: number): ConeGeometry => {
      // ConeGeometry has its apex at +y: base at y = 0, apex at y = 1, then turn +y to +x (aft).
      const g = new ConeGeometry(r, 1, 20, 1, true);
      g.translate(0, 0.5, 0);
      g.rotateZ(-Math.PI / 2);
      return g;
    };
    this.outer = new Mesh(
      cone(1),
      new MeshBasicMaterial({
        color: new Color().setHex(0xff7a1a, SRGBColorSpace),
        transparent: true,
        opacity: 0.55,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    this.inner = new Mesh(
      cone(0.55),
      new MeshBasicMaterial({
        color: new Color().setHex(0xfff2c0, SRGBColorSpace),
        transparent: true,
        opacity: 0.9,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    this.group.add(this.outer, this.inner);
    this.group.visible = false;
  }

  /** `fraction` is thrust / max thrust; `t` the replay time (for the flicker only). */
  setThrust(fraction: number, t: number): void {
    if (!(fraction > 0)) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    const flicker = 1 + 0.07 * Math.sin(53 * t) + 0.05 * Math.sin(97 * t + 1.3);
    const length = this.radius * (5 + 13 * Math.sqrt(Math.min(1, fraction))) * flicker;
    this.outer.scale.set(length, this.radius, this.radius);
    this.inner.scale.set(0.55 * length, this.radius, this.radius);
  }

  get visible(): boolean {
    return this.group.visible;
  }
}

// --- Parachutes ---

export interface RecoveryInputs {
  readonly name: string;
  /** Canopy diameter, metres (the design's value). */
  readonly diameter: number;
}

export interface CanopyState {
  readonly name: string;
  readonly diameter: number;
  /** Time of the stored deployment event, s. */
  readonly deployedAt: number;
}

/**
 * The canopies to draw: one per stored deployment event whose detail names
 * a device of the design (the simulator writes "<name> deployed (...)"). A
 * deployment of a device not in the list is not drawn, since its size is
 * not known.
 */
export function deployedCanopies(
  result: FlightResult,
  recovery: readonly RecoveryInputs[],
): CanopyState[] {
  const out: CanopyState[] = [];
  for (const e of result.events) {
    if (e.kind !== 'deployment') continue;
    const device = recovery.find((d) => e.detail.startsWith(`${d.name} deployed`));
    if (device === undefined || !(device.diameter > 0)) continue;
    if (out.some((c) => c.name === device.name)) continue;
    out.push({ name: device.name, diameter: device.diameter, deployedAt: e.time });
  }
  return out;
}

/** Inflation fraction of a canopy `age` seconds after deployment (drawing choice: 0.6 s). */
export function inflation(age: number): number {
  if (age < 0) return 0;
  return Math.min(1, 0.15 + age / 0.6);
}

/** Half-angle of the drawn canopy's dome; its rim diameter is the design's canopy diameter. */
export const CANOPY_DOME_ANGLE = 0.42 * Math.PI;

/** A canopy and its shroud lines; local +y points from the payload to the canopy. */
export function buildCanopy(
  c: CanopyState,
  lineLength: number,
  colourA: number,
  colourB: number,
): Group {
  const group = new Group();
  group.name = `canopy-${c.name}`;
  const radius = c.diameter / 2 / Math.sin(CANOPY_DOME_ANGLE);
  const gores = 12;
  const dome = new SphereGeometry(
    radius,
    gores * 2,
    10,
    0,
    2 * Math.PI,
    0,
    CANOPY_DOME_ANGLE,
  ).toNonIndexed();
  // Alternate gore colours by the azimuth of each triangle.
  const pos = dome.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const a = new Color().setHex(colourA, SRGBColorSpace);
  const b = new Color().setHex(colourB, SRGBColorSpace);
  for (let t = 0; t < pos.count; t += 3) {
    let cx = 0;
    let cz = 0;
    for (let k = 0; k < 3; k++) {
      cx += pos.getX(t + k);
      cz += pos.getZ(t + k);
    }
    const phi = Math.atan2(cz, cx) + Math.PI;
    const gore = Math.floor((phi / (2 * Math.PI)) * gores) % 2;
    const c0 = gore === 0 ? a : b;
    for (let k = 0; k < 3; k++) {
      col[3 * (t + k)] = c0.r;
      col[3 * (t + k) + 1] = c0.g;
      col[3 * (t + k) + 2] = c0.b;
    }
  }
  dome.setAttribute('color', new BufferAttribute(col, 3));
  dome.computeVertexNormals();
  const mesh = new Mesh(
    dome,
    new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: DoubleSide }),
  );
  mesh.name = 'canopy-dome';
  mesh.castShadow = true;
  group.add(mesh);
  // Shroud lines from the rim to the payload at (0, −lineLength, 0) below the dome's centre.
  const rimY = radius * Math.cos(CANOPY_DOME_ANGLE);
  const lines: number[] = [];
  const n = 12;
  for (let k = 0; k < n; k++) {
    const phi = (2 * Math.PI * k) / n;
    lines.push(
      (c.diameter / 2) * Math.cos(phi),
      rimY,
      (c.diameter / 2) * Math.sin(phi),
      0,
      -lineLength,
      0,
    );
  }
  const lg = new BufferGeometry();
  lg.setAttribute('position', new BufferAttribute(new Float32Array(lines), 3));
  const shroud = new LineSegments(lg, new LineBasicMaterial({ color: 0x333333 }));
  shroud.name = 'shroud-lines';
  group.add(shroud);
  group.userData = { diameter: c.diameter, rimY };
  return group;
}
