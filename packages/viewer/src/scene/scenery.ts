/**
 * Illustrative scenery for the replay (plan 3d-0001, D-3D-1): a sky dome,
 * procedural terrain with trees, and the launch pad. Nothing here is a
 * flight value and nothing here feeds one. The simulator assumes flat
 * ground at the pad, so the terrain is exactly flat (height 0 above the
 * drawn ground) over a radius that covers every stored position and every
 * extra ground point with margin; hills rise only outside it. The terrain
 * is generated from a fixed seed, so the same flight always gets the same
 * scenery. No DOM: the textures are data textures, so this runs in Node.
 */
import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  Group,
  InstancedMesh,
  LinearMipmapLinearFilter,
  Matrix4,
  MeshLambertMaterial,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  RepeatWrapping,
  RGBAFormat,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  UnsignedByteType,
  Vector3,
} from 'three';

/** The direction to the sun in the scene (flight frame: x east, y north, z up), unit length. */
export const SUN_DIRECTION: Readonly<Vector3> = new Vector3(-0.45, -0.62, 0.64).normalize();

/** Sky colours, sRGB (drawing choices). */
export const SKY_ZENITH = 0x3f7fd0;
export const SKY_HORIZON = 0xc9dcec;

export interface SceneryLayout {
  /** z of the drawn ground, metres (the flight frame's z = 0 is the CG at rest, D-3D-1). */
  readonly groundZ: number;
  /** Radius about the pad inside which the terrain is exactly flat, metres. */
  readonly flatRadius: number;
  /** Radius at which the hills reach their full height, metres. */
  readonly hillRadius: number;
  /** Outer edge of the terrain, metres (hidden by the fog). */
  readonly outerRadius: number;
  /** Scale of the hill heights, metres. */
  readonly peakHeight: number;
}

/**
 * The scenery's size from the flight's extents (drawing choices): the flat
 * radius is at least 250 m, 1.4 times the horizontal travel plus 30 m, and
 * half the apogee; the hills reach full height at 2.2 flat radii and are
 * about a quarter of that tall; the terrain ends at 10 hill radii.
 */
export function sceneryLayout(
  extents: { readonly horizontal: number; readonly vertical: number },
  groundZ: number,
): SceneryLayout {
  const flatRadius = Math.max(250, 1.4 * extents.horizontal + 30, 0.5 * extents.vertical);
  const hillRadius = 2.2 * flatRadius;
  return {
    groundZ,
    flatRadius,
    hillRadius,
    outerRadius: 10 * hillRadius,
    peakHeight: 0.26 * hillRadius,
  };
}

// --- Deterministic noise (a drawing tool; integer hash, no Math.random) ---

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Value noise in [0, 1). */
export function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Value noise that repeats every `period` lattice cells in x and y, in [0, 1). */
function periodicNoise(x: number, y: number, period: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const w = (i: number): number => ((i % period) + period) % period;
  const a = hash2(w(ix), w(iy), seed);
  const b = hash2(w(ix + 1), w(iy), seed);
  const c = hash2(w(ix), w(iy + 1), seed);
  const d = hash2(w(ix + 1), w(iy + 1), seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Fractal sum of `octaves` value-noise layers, in [0, 1). */
export function fbm(x: number, y: number, seed: number, octaves = 5): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x * f, y * f, seed + 17 * o);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

/** A seeded generator for scatter (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SCENERY_SEED = 1967;

/**
 * Terrain height above the drawn ground at (x, y), metres. Exactly 0 for
 * a horizontal distance from the pad up to `flatRadius`; ridged hills that
 * blend in up to `hillRadius` and grow slowly further out.
 */
export function terrainHeight(x: number, y: number, layout: SceneryLayout): number {
  const r = Math.hypot(x, y);
  if (r <= layout.flatRadius) return 0;
  const t = Math.min(1, (r - layout.flatRadius) / (layout.hillRadius - layout.flatRadius));
  const blend = smooth(t);
  const s = 1 / (0.9 * layout.hillRadius);
  const ridged = 1 - Math.abs(2 * fbm(x * s, y * s, SCENERY_SEED) - 1);
  const broad = fbm(x * s * 0.35 + 11.3, y * s * 0.35 - 4.1, SCENERY_SEED + 5, 3);
  const far = 1 + 0.6 * Math.min(1, (r - layout.hillRadius) / (3 * layout.hillRadius));
  return blend * layout.peakHeight * far * (0.15 + 0.85 * ridged * ridged) * (0.35 + 0.9 * broad);
}

function srgb(hex: number): Color {
  return new Color().setHex(hex, SRGBColorSpace);
}

const GRASS_A = srgb(0x4d6b2a);
const GRASS_B = srgb(0x6b7d35);
const GRASS_DRY = srgb(0x8f8a52);
const FOREST = srgb(0x2f4a22);
const ROCK = srgb(0x7a7064);

/** Size of one tile of the grass detail texture on the ground, metres. */
export const GRASS_TILE = 3;

/** A seamless grass detail texture (multiplied with the vertex colours), 256 × 256. */
export function grassTexture(): DataTexture {
  const n = 256;
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      // Periodic noise: sample on a torus by wrapping the lattice (period 32 and 64 cells).
      const fine = hash2(i, j, 3);
      const mid = periodicNoise((i / n) * 32, (j / n) * 32, 32, 7);
      const blade = hash2(i, Math.floor(j / 3), 11);
      const v = 0.72 + 0.16 * mid + 0.08 * fine + 0.06 * blade;
      const k = 4 * (j * n + i);
      data[k] = Math.round(255 * Math.min(1, v * 0.98));
      data[k + 1] = Math.round(255 * Math.min(1, v));
      data[k + 2] = Math.round(255 * Math.min(1, v * 0.9));
      data[k + 3] = 255;
    }
  }
  const tex = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * The terrain mesh: a polar grid about the pad whose ring spacing grows
 * geometrically, so the ground is detailed near the pad and coarse far
 * away. The flat disc is the rings up to the flat radius, all at z = groundZ.
 */
export function terrainGeometry(layout: SceneryLayout, segments = 96): BufferGeometry {
  const radii: number[] = [0];
  let r = Math.min(0.5, layout.flatRadius / 200);
  while (r < layout.outerRadius) {
    radii.push(r);
    r *= 1.075;
  }
  // The flat radius is a ring, so the blend starts exactly there.
  radii.push(layout.flatRadius, layout.outerRadius);
  radii.sort((a, b) => a - b);
  const rings = radii.length;
  const row = segments + 1;
  const positions = new Float32Array(rings * row * 3);
  const uvs = new Float32Array(rings * row * 2);
  const heights = new Float32Array(rings * row);
  let k = 0;
  for (let i = 0; i < rings; i++) {
    const ri = radii[i] ?? 0;
    for (let j = 0; j <= segments; j++) {
      const phi = (2 * Math.PI * j) / segments;
      const x = ri * Math.cos(phi);
      const y = ri * Math.sin(phi);
      const h = terrainHeight(x, y, layout);
      positions[3 * k] = x;
      positions[3 * k + 1] = y;
      positions[3 * k + 2] = layout.groundZ + h;
      uvs[2 * k] = x / GRASS_TILE;
      uvs[2 * k + 1] = y / GRASS_TILE;
      heights[k] = h;
      k++;
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * row + j;
      const b = a + row;
      // Counter-clockwise seen from above (+z), so the top face is the front face.
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.setAttribute('uv', new BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();

  // Vertex colours: grass field patches on the flat, forest, rock on steep slopes, snow high up.
  const normals = g.getAttribute('normal');
  const colours = new Float32Array(rings * row * 3);
  const c = new Color();
  const fieldScale = 1 / Math.max(20, layout.flatRadius / 3);
  for (let v = 0; v < rings * row; v++) {
    const x = positions[3 * v] ?? 0;
    const y = positions[3 * v + 1] ?? 0;
    const h = heights[v] ?? 0;
    const field = fbm(x * fieldScale, y * fieldScale, SCENERY_SEED + 31, 4);
    c.copy(GRASS_A).lerp(GRASS_B, smooth(Math.min(1, Math.max(0, (field - 0.3) * 2.5))));
    const dry = fbm(x * fieldScale * 0.5 + 3, y * fieldScale * 0.5, SCENERY_SEED + 41, 3);
    c.lerp(GRASS_DRY, Math.max(0, (dry - 0.55) * 1.6));
    const rel = h / layout.peakHeight;
    if (rel > 0.02) c.lerp(FOREST, Math.min(0.75, rel * 3));
    const steep = 1 - normals.getZ(v);
    c.lerp(ROCK, Math.min(1, Math.max(0, (steep - 0.25) * 3 + (rel - 0.7) * 2)));
    colours[3 * v] = c.r;
    colours[3 * v + 1] = c.g;
    colours[3 * v + 2] = c.b;
  }
  g.setAttribute('color', new BufferAttribute(colours, 3));
  return g;
}

/** Trees as two instanced meshes (trunks and crowns), scattered outside the flat radius only. */
export function buildTrees(layout: SceneryLayout, count = 1400): Group {
  const group = new Group();
  group.name = 'trees';
  const rand = seededRandom(SCENERY_SEED + 101);
  const trunkGeo = new CylinderGeometry(0.12, 0.2, 1, 6);
  trunkGeo.rotateX(Math.PI / 2);
  trunkGeo.translate(0, 0, 0.5);
  const crownGeo = new ConeGeometry(0.5, 1, 7);
  crownGeo.rotateX(Math.PI / 2);
  crownGeo.translate(0, 0, 0.5);
  const trunks = new InstancedMesh(
    trunkGeo,
    new MeshLambertMaterial({ color: srgb(0x4a3826) }),
    count,
  );
  const crowns = new InstancedMesh(
    crownGeo,
    new MeshLambertMaterial({ color: srgb(0x2d4a26) }),
    count,
  );
  const m = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const p = new Vector3();
  const tint = new Color();
  let placed = 0;
  let tries = 0;
  const inner = layout.flatRadius * 1.03;
  const outer = Math.min(layout.outerRadius * 0.45, layout.hillRadius * 4);
  while (placed < count && tries < count * 20) {
    tries++;
    // Uniform in area over the annulus.
    const r = Math.sqrt(inner * inner + rand() * (outer * outer - inner * inner));
    const phi = 2 * Math.PI * rand();
    const x = r * Math.cos(phi);
    const y = r * Math.sin(phi);
    const forest = fbm(x / 90, y / 90, SCENERY_SEED + 61, 3);
    if (forest < 0.5 && rand() > 0.08) continue;
    const h = terrainHeight(x, y, layout);
    if (h > 0.7 * layout.peakHeight) continue;
    const height = 7 + 11 * rand();
    const width = height * (0.32 + 0.12 * rand());
    p.set(x, y, layout.groundZ + h - 0.3);
    q.setFromAxisAngle(new Vector3(0, 0, 1), 2 * Math.PI * rand());
    s.set(width * 0.25, width * 0.25, height * 0.35);
    m.compose(p, q, s);
    trunks.setMatrixAt(placed, m);
    p.z += height * 0.25;
    s.set(width, width, height * 0.8);
    m.compose(p, q, s);
    crowns.setMatrixAt(placed, m);
    tint.setRGB(0.75 + 0.35 * rand(), 0.85 + 0.3 * rand(), 0.75 + 0.3 * rand());
    crowns.setColorAt(placed, tint);
    placed++;
  }
  trunks.count = placed;
  crowns.count = placed;
  trunks.castShadow = false;
  crowns.castShadow = false;
  group.add(trunks, crowns);
  return group;
}

const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 sunDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.z;
  vec3 col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.55));
  col = mix(col, horizon * 0.92, smoothstep(0.0, -0.08, h));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += vec3(1.0, 0.92, 0.78) * (pow(s, 900.0) * 6.0 + pow(s, 24.0) * 0.18 + pow(s, 4.0) * 0.06);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** A sky dome of the given radius; the caller keeps it centred on the camera. */
export function buildSkyDome(radius: number): Mesh {
  const material = new ShaderMaterial({
    uniforms: {
      zenith: { value: srgb(SKY_ZENITH) },
      horizon: { value: srgb(SKY_HORIZON) },
      sunDir: { value: SUN_DIRECTION.clone() },
    },
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  const dome = new Mesh(new SphereGeometry(radius, 48, 24), material);
  dome.name = 'sky';
  dome.renderOrder = -1000;
  dome.frustumCulled = false;
  return dome;
}

export interface PadInputs {
  readonly groundZ: number;
  /** Unit vector along the rail, upwards. */
  readonly railDirection: Vector3;
  /** Unit vector from the rocket axis to the rail, perpendicular to the rail. */
  readonly railSide: Vector3;
  /** Distance from the rocket axis to the rail's centre line, metres. */
  readonly railOffset: number;
  readonly railLength: number;
  /** The rocket's length, for sizing the plate and the bar (drawing choices). */
  readonly rocketLength: number;
}

/**
 * The launch pad: a blast plate on the ground and the rail as a square bar
 * from the ground to the stored rail length along the rail direction, beside
 * the rocket on the side of its rail buttons. The bar is named `launch-rail`.
 */
export function buildPad(inputs: PadInputs): Group {
  const group = new Group();
  group.name = 'launch-pad';
  const steel = new MeshStandardMaterial({
    color: srgb(0x5d636b),
    metalness: 0.7,
    roughness: 0.45,
  });
  const plateMat = new MeshStandardMaterial({
    color: srgb(0x3b3e42),
    metalness: 0.5,
    roughness: 0.7,
  });
  const L = inputs.rocketLength;
  const d = inputs.railDirection;
  const plateSize = Math.max(0.3, 0.6 * L);
  const plate = new Mesh(new BoxGeometry(plateSize, plateSize, 0.012 * plateSize), plateMat);
  plate.position.set(0, 0, inputs.groundZ + 0.006 * plateSize);
  plate.receiveShadow = true;
  plate.castShadow = true;
  group.add(plate);

  // The rail bar: from where the rail line meets the ground (or the rocket's foot) to the rail top.
  const width = Math.max(0.012, 0.025 * L);
  const s0 = d.z > 1e-6 ? inputs.groundZ / d.z : 0;
  const s1 = inputs.railLength;
  const length = Math.max(1e-3, s1 - s0);
  const bar = new Mesh(new BoxGeometry(width, width, length), steel);
  bar.name = 'launch-rail';
  const mid = d.clone().multiplyScalar((s0 + s1) / 2);
  mid.addScaledVector(inputs.railSide, inputs.railOffset + width / 2);
  bar.position.copy(mid);
  bar.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), d);
  bar.castShadow = true;
  bar.receiveShadow = true;
  group.add(bar);

  // A tripod: three legs from the lower part of the rail to the ground.
  const anchor = d
    .clone()
    .multiplyScalar(s0 + 0.15 * length)
    .addScaledVector(inputs.railSide, inputs.railOffset);
  const spread = Math.max(0.4, 0.8 * L);
  for (let k = 0; k < 3; k++) {
    const a = (2 * Math.PI * k) / 3 + 0.5;
    const foot = new Vector3(
      anchor.x + spread * Math.cos(a),
      anchor.y + spread * Math.sin(a),
      inputs.groundZ,
    );
    const dir = new Vector3().subVectors(anchor, foot);
    const legLength = dir.length();
    const leg = new Mesh(new CylinderGeometry(width * 0.35, width * 0.35, legLength, 6), steel);
    leg.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize());
    leg.position.copy(foot).addScaledVector(dir, legLength / 2);
    leg.castShadow = true;
    group.add(leg);
  }
  return group;
}
