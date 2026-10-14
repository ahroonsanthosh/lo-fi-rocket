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
  DataTexture,
  DoubleSide,
  Group,
  LinearMipmapLinearFilter,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshPhysicalMaterial,
  Points,
  RGBAFormat,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  UniformsLib,
  UniformsUtils,
  UnsignedByteType,
  Vector3,
  type Camera,
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
  /** A fixed number in [0, 1) per puff, for its turn and shape in the drawing. */
  readonly seed: number;
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
      seed: e.scatter.x + 0.5,
    });
  }
  return out;
}

export interface GroundCloudOptions {
  /** The pad's ground level, metres. */
  readonly groundZ: number;
  /** When the motor lit and when the rocket left the rail, s (the cloud forms in between). */
  readonly start: number;
  readonly end: number;
  /** How far the cloud rolls out from the pad, metres. */
  readonly reach: number;
  /** Puff diameter when fully grown, metres. */
  readonly size: number;
  /** e-folding time of the cloud's opacity, s. */
  readonly fade: number;
}

/** Puffs in the ground cloud (a drawing budget). */
export const GROUND_CLOUD_PUFFS = 24;

/**
 * The cloud the exhaust raises from the blast deflector while the rocket is
 * on the rail (illustrative): puffs leave the pad in fixed directions between
 * `start` and `end`, roll out to `reach` (1 − e^(−a/0.8)), rise slowly
 * (0.3 m/s), drift with the wind, grow and fade. A pure function of t.
 */
export function groundCloud(wind: Vec3, t: number, o: GroundCloudOptions): SmokePuff[] {
  const out: SmokePuff[] = [];
  if (!(o.end > o.start)) return out;
  for (let k = 0; k < GROUND_CLOUD_PUFFS; k++) {
    const born = o.start + ((o.end - o.start) * k) / GROUND_CLOUD_PUFFS;
    const age = t - born;
    if (age < 0) break;
    const angle = 2.39996 * k; // golden angle: evenly round the pad
    const roll = o.reach * (0.6 + 0.4 * ((k * 0.618) % 1)) * (1 - Math.exp(-age / 0.8));
    const opacity = Math.exp(-age / o.fade) * Math.min(1, age / 0.15);
    if (opacity < 0.01) continue;
    out.push({
      position: {
        x: roll * Math.cos(angle) + wind.x * age,
        y: roll * Math.sin(angle) + wind.y * age,
        z: o.groundZ + 0.3 * o.size + 0.3 * age,
      },
      size: o.size * (0.35 + 0.65 * (1 - Math.exp(-age / 0.6))),
      opacity: 0.8 * opacity,
      seed: (k * 0.754877) % 1,
    });
  }
  return out;
}

/** A soft, lumpy puff image (fractal noise inside a round falloff), 128 × 128, for the smoke. */
export function puffTexture(): DataTexture {
  const n = 128;
  const data = new Uint8Array(n * n * 4);
  const h = (i: number, j: number, s: number): number => {
    let v = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(s, 0x9e3779b1);
    v = Math.imul(v ^ (v >>> 15), 0x85ebca6b);
    v ^= v >>> 13;
    return (v >>> 0) / 4294967296;
  };
  const vnoise = (x: number, y: number, s: number): number => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = h(ix, iy, s);
    const b = h(ix + 1, iy, s);
    const c = h(ix, iy + 1, s);
    const d = h(ix + 1, iy + 1, s);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) / n - 0.5;
      const y = (j + 0.5) / n - 0.5;
      const r = Math.hypot(x, y) * 2;
      let f = 0;
      let amp = 0.5;
      let freq = 4;
      for (let o = 0; o < 4; o++) {
        f += amp * vnoise(x * freq + 10, y * freq + 10, o);
        amp *= 0.5;
        freq *= 2;
      }
      const edge = 1 - Math.min(1, Math.max(0, (r - 0.35 - 0.35 * f) / 0.3));
      const a = Math.max(0, Math.min(1, edge * (0.55 + 0.6 * f)));
      const k = 4 * (j * n + i);
      data[k] = 255;
      data[k + 1] = 255;
      data[k + 2] = 255;
      data[k + 3] = Math.round(255 * a);
    }
  }
  const t = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType);
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

const SMOKE_VERTEX = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
attribute float size;
attribute float alpha;
attribute float seed;
uniform float projScale;
varying float vAlpha;
varying float vSeed;
void main() {
  vAlpha = alpha;
  vSeed = seed;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(size * projScale / -mvPosition.z, 1.0, 1024.0);
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
uniform vec3 sunView;
uniform vec3 sunColour;
uniform vec3 skyColour;
uniform sampler2D puff;
varying float vAlpha;
varying float vSeed;
void main() {
  #include <logdepthbuf_fragment>
  vec2 c = gl_PointCoord - 0.5;
  c.y = -c.y;
  // Each puff turned by its own angle, so the same image never repeats in a column.
  float a = vSeed * 6.2831853;
  vec2 rc = mat2(cos(a), -sin(a), sin(a), cos(a)) * c;
  float alpha = texture2D(puff, rc + 0.5).a * vAlpha;
  if (alpha < 0.004) discard;
  // Shade the puff as a sphere: brighter towards the sun, darker underneath.
  float r2 = dot(c, c) * 4.0;
  vec3 n = normalize(vec3(c * 2.0, sqrt(max(0.0, 1.0 - r2))));
  float lit = max(dot(n, normalize(sunView)), 0.0);
  vec3 col = color * (skyColour * (0.75 + 0.25 * n.y) + sunColour * (0.35 + 0.65 * lit));
  gl_FragColor = vec4(col, alpha);
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
  private readonly seed: BufferAttribute;
  private readonly sunWorld: Vector3;

  /** `sun`: direction to the sun (world) and its irradiance over π, linear (as the ground is lit). */
  constructor(capacity: number, sun: { readonly direction: Vector3; readonly colour: Color }) {
    const g = new BufferGeometry();
    this.position = new BufferAttribute(new Float32Array(3 * capacity), 3);
    this.size = new BufferAttribute(new Float32Array(capacity), 1);
    this.alpha = new BufferAttribute(new Float32Array(capacity), 1);
    this.seed = new BufferAttribute(new Float32Array(capacity), 1);
    g.setAttribute('position', this.position);
    g.setAttribute('size', this.size);
    g.setAttribute('alpha', this.alpha);
    g.setAttribute('seed', this.seed);
    g.setDrawRange(0, 0);
    this.sunWorld = sun.direction.clone().normalize();
    this.material = new ShaderMaterial({
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          projScale: { value: 400 },
          // Smoke albedo, linear (a bright grey-white).
          color: { value: new Color(0.78, 0.78, 0.8) },
          sunView: { value: new Vector3(0, 1, 0) },
          sunColour: { value: sun.colour.clone() },
          skyColour: { value: new Color(0.45, 0.5, 0.58) },
          puff: { value: puffTexture() },
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

  /** The sun's direction in the camera's view space, for the puffs' shading. */
  setCamera(camera: Camera): void {
    const u = this.material.uniforms['sunView'];
    if (u !== undefined) {
      (u.value as Vector3).copy(this.sunWorld).transformDirection(camera.matrixWorldInverse);
    }
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
      this.seed.setX(i, p.seed);
    }
    this.position.needsUpdate = true;
    this.size.needsUpdate = true;
    this.alpha.needsUpdate = true;
    this.seed.needsUpdate = true;
    this.points.geometry.setDrawRange(0, n);
  }
}

// --- Flame ---

const FLAME_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying float vAlong;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
  // The cone runs from the nozzle (x = 0) to the tip (x = 1) before scaling.
  vAlong = position.x;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalView = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}
`;

const FLAME_FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 core;
uniform vec3 edge;
uniform float strength;
uniform float time;
varying float vAlong;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
  #include <logdepthbuf_fragment>
  float p = clamp(vAlong, 0.0, 1.0);
  // White-hot at the nozzle, through yellow to orange, fading to the tip; brighter through the
  // middle of the plume than at its rim (a thin rim reads as the plume's edge).
  vec3 col = mix(core, edge, smoothstep(0.0, 0.7, p));
  float rim = abs(dot(normalize(vNormalView), normalize(vViewDir)));
  float flicker = 0.85 + 0.15 * sin(40.0 * p - 31.0 * time) * sin(17.0 * p + 23.0 * time);
  float a = strength * pow(1.0 - p, 1.4) * (0.35 + 0.65 * rim) * flicker;
  gl_FragColor = vec4(col * a, a);
}
`;

/** A radial glow image for the light around the nozzle (64 × 64). */
function glowTexture(): DataTexture {
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const r = Math.hypot((i + 0.5) / n - 0.5, (j + 0.5) / n - 0.5) * 2;
      const v = Math.max(0, 1 - r) ** 2.2;
      const k = 4 * (j * n + i);
      data[k] = 255;
      data[k + 1] = 255;
      data[k + 2] = 255;
      data[k + 3] = Math.round(255 * v);
    }
  }
  const t = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType);
  t.needsUpdate = true;
  return t;
}

/**
 * The exhaust flame in the body frame (x aft): two nested additive cones
 * from the nozzle at `aftX`, base radius `radius`, shaded white-hot to
 * orange along their length, and a glow around the nozzle (a stand-in for
 * a camera's bloom). `setThrust` shows it for a thrust fraction in (0, 1]
 * with a length that grows with the square root of the fraction, and hides
 * it at zero.
 */
export class ExhaustFlame {
  readonly group = new Group();
  private readonly outer: Mesh;
  private readonly inner: Mesh;
  private readonly glow: Sprite;
  private readonly materials: ShaderMaterial[] = [];
  private readonly radius: number;

  constructor(aftX: number, radius: number) {
    this.radius = Math.max(1e-3, radius);
    this.group.name = 'exhaust-flame';
    this.group.position.set(aftX, 0, 0);
    const cone = (r: number): ConeGeometry => {
      // ConeGeometry has its apex at +y: base at y = 0, apex at y = 1, then turn +y to +x (aft).
      const g = new ConeGeometry(r, 1, 24, 6, true);
      g.translate(0, 0.5, 0);
      g.rotateZ(-Math.PI / 2);
      return g;
    };
    const flameMat = (core: number, edge: number, strength: number): ShaderMaterial => {
      const m = new ShaderMaterial({
        uniforms: {
          core: { value: new Color().setHex(core, SRGBColorSpace).multiplyScalar(3) },
          edge: { value: new Color().setHex(edge, SRGBColorSpace).multiplyScalar(2) },
          strength: { value: strength },
          time: { value: 0 },
        },
        vertexShader: FLAME_VERTEX,
        fragmentShader: FLAME_FRAGMENT,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      });
      this.materials.push(m);
      return m;
    };
    this.outer = new Mesh(cone(1), flameMat(0xffd27a, 0xff5a12, 0.55));
    this.inner = new Mesh(cone(0.5), flameMat(0xffffff, 0xffb347, 0.9));
    this.glow = new Sprite(
      new SpriteMaterial({
        map: glowTexture(),
        color: new Color().setHex(0xffb066, SRGBColorSpace),
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        opacity: 0.8,
      }),
    );
    this.group.add(this.outer, this.inner, this.glow);
    this.group.visible = false;
  }

  /** `fraction` is thrust / max thrust; `t` the replay time (for the flicker only). */
  setThrust(fraction: number, t: number): void {
    if (!(fraction > 0)) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    const f = Math.min(1, fraction);
    const flicker = 1 + 0.07 * Math.sin(53 * t) + 0.05 * Math.sin(97 * t + 1.3);
    const length = this.radius * (6 + 16 * Math.sqrt(f)) * flicker;
    this.outer.scale.set(length, 1.1 * this.radius, 1.1 * this.radius);
    this.inner.scale.set(0.5 * length, this.radius, this.radius);
    const g = this.radius * (8 + 10 * Math.sqrt(f));
    this.glow.scale.set(g, g, 1);
    this.glow.position.set(0.15 * length, 0, 0);
    for (const m of this.materials) {
      const u = m.uniforms['time'];
      if (u !== undefined) u.value = t;
    }
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
/** Gores (panels) of the drawn canopy, and its apex vent's half-angle (drawing choices). */
export const CANOPY_GORES = 12;
export const CANOPY_VENT_ANGLE = 0.05 * Math.PI;

/**
 * The canopy's surface point at azimuth φ and polar angle θ (from the apex)
 * for a dome of radius R: each gore bulges out between its seams (the seams
 * at φ = 2πk/N are pulled in to 93 %), and the hem is scalloped (raised
 * mid-gore). Local frame: +y from the payload to the apex.
 */
export function canopyPoint(
  phi: number,
  theta: number,
  radius: number,
  gores = CANOPY_GORES,
): Vector3 {
  const f = (phi * gores) / (2 * Math.PI);
  const mid = Math.sin(Math.PI * (f - Math.floor(f))); // 0 at a seam, 1 mid-gore
  const bulge = 0.93 + 0.07 * mid;
  const hem = CANOPY_DOME_ANGLE - 0.035 * Math.PI * mid;
  const th = Math.min(theta, hem);
  const r = radius * Math.sin(th) * bulge;
  return new Vector3(r * Math.cos(phi), radius * Math.cos(th), r * Math.sin(phi));
}

/** A canopy, its shroud lines to the confluence and its gore colours; local +y points from the payload to the canopy. */
export function buildCanopy(
  c: CanopyState,
  lineLength: number,
  colourA: number,
  colourB: number,
): Group {
  const group = new Group();
  group.name = `canopy-${c.name}`;
  const radius = c.diameter / 2 / Math.sin(CANOPY_DOME_ANGLE);
  const gores = CANOPY_GORES;
  const nPhi = gores * 8;
  const nTheta = 14;
  const positions: number[] = [];
  const colours: number[] = [];
  const a = new Color().setHex(colourA, SRGBColorSpace);
  const b = new Color().setHex(colourB, SRGBColorSpace);
  const vertex = (i: number, j: number): void => {
    const phi = (2 * Math.PI * i) / nPhi;
    const theta = CANOPY_VENT_ANGLE + ((CANOPY_DOME_ANGLE - CANOPY_VENT_ANGLE) * j) / nTheta;
    const p = canopyPoint(phi, theta, radius, gores);
    positions.push(p.x, p.y, p.z);
  };
  for (let i = 0; i < nPhi; i++) {
    const gore = Math.floor((i * gores) / nPhi) % 2;
    const col = gore === 0 ? a : b;
    for (let j = 0; j < nTheta; j++) {
      vertex(i, j);
      vertex(i + 1, j);
      vertex(i, j + 1);
      vertex(i + 1, j);
      vertex(i + 1, j + 1);
      vertex(i, j + 1);
      for (let k = 0; k < 6; k++) colours.push(col.r, col.g, col.b);
    }
  }
  const dome = new BufferGeometry();
  dome.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  dome.setAttribute('color', new BufferAttribute(new Float32Array(colours), 3));
  dome.computeVertexNormals();
  const mesh = new Mesh(
    dome,
    new MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.7,
      sheen: 0.6,
      sheenRoughness: 0.5,
      side: DoubleSide,
    }),
  );
  mesh.name = 'canopy-dome';
  mesh.castShadow = true;
  group.add(mesh);
  // Shroud lines from each seam at the hem to the confluence, lineLength below the dome's centre.
  const lines: number[] = [];
  for (let k = 0; k < gores; k++) {
    const p = canopyPoint((2 * Math.PI * k) / gores, CANOPY_DOME_ANGLE, radius, gores);
    lines.push(p.x, p.y, p.z, 0, -lineLength, 0);
  }
  const lg = new BufferGeometry();
  lg.setAttribute('position', new BufferAttribute(new Float32Array(lines), 3));
  const shroud = new LineSegments(lg, new LineBasicMaterial({ color: 0xdddddd }));
  shroud.name = 'shroud-lines';
  group.add(shroud);
  group.userData = { diameter: c.diameter, rimY: radius * Math.cos(CANOPY_DOME_ANGLE), lineLength };
  return group;
}
