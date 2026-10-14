/**
 * The illustrative terrain's shape (plan 3d-0001 D-3D-1; textured by
 * ground.ts, planted by trees.ts, plan 3d-0002). Nothing here is a flight
 * value and nothing here feeds one. The simulator assumes flat ground at the
 * pad, so the terrain is exactly flat (height 0 above the drawn ground) over
 * a radius that covers every stored position and every extra ground point
 * with margin; hills rise only outside it. The terrain is generated from a
 * fixed seed, so the same flight always gets the same scenery. No DOM.
 */
import { BufferAttribute, BufferGeometry, Color, SRGBColorSpace } from 'three';

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
      // uv in metres: the ground material scales it per texture (ground.ts).
      uvs[2 * k] = x;
      uvs[2 * k + 1] = y;
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

  // Vertex colours: grass field patches on the flat, forest, rock on steep slopes; and the
  // weight of the rocky photo texture (`rock`, ground.ts) from the height and the slope.
  const normals = g.getAttribute('normal');
  const colours = new Float32Array(rings * row * 3);
  const rock = new Float32Array(rings * row);
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
    if (rel > 0.02) c.lerp(FOREST, Math.min(0.5, rel * 2));
    const steep = 1 - normals.getZ(v);
    const rocky = Math.min(1, Math.max(0, (steep - 0.25) * 3 + (rel - 0.7) * 2));
    c.lerp(ROCK, rocky);
    rock[v] = Math.min(1, 0.55 * smooth(Math.min(1, Math.max(0, (rel - 0.01) / 0.25))) + rocky);
    colours[3 * v] = c.r;
    colours[3 * v + 1] = c.g;
    colours[3 * v + 2] = c.b;
  }
  g.setAttribute('color', new BufferAttribute(colours, 3));
  g.setAttribute('rock', new BufferAttribute(rock, 1));
  return g;
}
