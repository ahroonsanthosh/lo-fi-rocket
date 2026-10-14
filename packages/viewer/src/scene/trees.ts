/**
 * Trees as billboards of photo-scanned CC0 tree models (plan 3d-0002,
 * D-3D-3; `assets/ASSETS.md`): each tree is a quad that turns about the
 * vertical to face the camera, textured with an offline render of a real
 * tree and lit per pixel from that render's normals by the scene's sun and
 * sky. They stand only outside the flat ground (D-3D-1), where they are seen
 * from far enough for a billboard to read as a tree. Scenery only.
 */
import {
  Color,
  DataTexture,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Float32BufferAttribute,
  Mesh,
  RGBAFormat,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  UnsignedByteType,
  Vector3,
  type Texture,
} from 'three';
import { fbm, seededRandom, SCENERY_SEED, terrainHeight, type SceneryLayout } from './scenery.js';

export interface TreeVariant {
  readonly species: 'conifer' | 'broadleaf';
  /** The variant's rectangle in the atlas (u to the right, v up from the bottom). */
  readonly u0: number;
  readonly u1: number;
  readonly v0: number;
  readonly v1: number;
  /** The scanned tree's width and height, metres. */
  readonly width: number;
  readonly height: number;
}

export interface TreeAtlas {
  readonly colour: Texture;
  readonly normal: Texture;
  readonly variants: readonly TreeVariant[];
}

/** The atlas's variants (`assets/trees.json`, written by `scripts/atlas.py`). */
export const TREE_VARIANTS: readonly TreeVariant[] = [
  {
    species: 'conifer',
    u0: 0.01904296875,
    u1: 0.10546875,
    v0: 0.0,
    v1: 1.0,
    width: 6.546,
    height: 18.921,
  },
  {
    species: 'conifer',
    u0: 0.1376953125,
    u1: 0.2373046875,
    v0: 0.0,
    v1: 1.0,
    width: 5.603,
    height: 14.054,
  },
  {
    species: 'conifer',
    u0: 0.2578125,
    u1: 0.36669921875,
    v0: 0.0,
    v1: 1.0,
    width: 6.32,
    height: 14.526,
  },
  { species: 'broadleaf', u0: 0.375, u1: 0.5, v0: 0.0, v1: 0.40625, width: 4.204, height: 3.408 },
  {
    species: 'broadleaf',
    u0: 0.5,
    u1: 0.625,
    v0: 0.0,
    v1: 0.392578125,
    width: 4.336,
    height: 3.411,
  },
  { species: 'broadleaf', u0: 0.625, u1: 0.75, v0: 0.0, v1: 0.78125, width: 2.919, height: 4.557 },
  {
    species: 'broadleaf',
    u0: 0.75,
    u1: 0.875,
    v0: 0.0,
    v1: 0.5234375,
    width: 4.351,
    height: 4.557,
  },
  { species: 'broadleaf', u0: 0.875, u1: 1.0, v0: 0.0, v1: 0.6328125, width: 3.604, height: 4.557 },
];

/** Scale ranges applied to the scans (drawing choices): the broadleaf scans are young trees of 3.4 to 4.6 m. */
export const TREE_SCALE: Readonly<Record<TreeVariant['species'], readonly [number, number]>> = {
  conifer: [0.75, 1.15],
  broadleaf: [2.2, 3.2],
};

export interface TreeInstance {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly variant: number;
  readonly scale: number;
  readonly tint: number;
}

/**
 * Where the trees stand: seeded and deterministic, in forest patches of the
 * annulus from 1.03 flat radii outwards, never inside the flat radius and
 * never on the highest ground; conifers more likely higher up.
 */
export function placeTrees(
  layout: SceneryLayout,
  variants: readonly TreeVariant[],
  count: number,
): TreeInstance[] {
  const rand = seededRandom(SCENERY_SEED + 101);
  const conifers = variants.map((v, i) => (v.species === 'conifer' ? i : -1)).filter((i) => i >= 0);
  const broadleaf = variants
    .map((v, i) => (v.species === 'broadleaf' ? i : -1))
    .filter((i) => i >= 0);
  const out: TreeInstance[] = [];
  const inner = layout.flatRadius * 1.03;
  const outer = Math.min(layout.outerRadius * 0.45, layout.hillRadius * 4);
  let tries = 0;
  while (out.length < count && tries < count * 25) {
    tries++;
    const r = Math.sqrt(inner * inner + rand() * (outer * outer - inner * inner));
    const phi = 2 * Math.PI * rand();
    const x = r * Math.cos(phi);
    const y = r * Math.sin(phi);
    const forest = fbm(x / 90, y / 90, SCENERY_SEED + 61, 3);
    if (forest < 0.48 && rand() > 0.06) continue;
    const h = terrainHeight(x, y, layout);
    if (h > 0.75 * layout.peakHeight) continue;
    const high = h / layout.peakHeight;
    const pool = rand() < 0.35 + 0.6 * high ? conifers : broadleaf;
    const list = pool.length > 0 ? pool : conifers.length > 0 ? conifers : broadleaf;
    const variant = list[Math.floor(rand() * list.length)] ?? 0;
    const v = variants[variant];
    if (v === undefined) continue;
    const [lo, hi] = TREE_SCALE[v.species];
    out.push({
      x,
      y,
      z: layout.groundZ + h - 0.2,
      variant,
      scale: lo + (hi - lo) * rand(),
      tint: 0.85 + 0.3 * rand(),
    });
  }
  return out;
}

const VERTEX = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
attribute vec3 offset;
attribute vec2 size;
attribute vec4 rect;
attribute float tint;
varying vec2 vUv;
varying float vTint;
varying vec3 vRight;
varying vec3 vFacing;
void main() {
  // Turn about the vertical (+z) to face the camera.
  vec3 toCam = cameraPosition - offset;
  vec3 facing = normalize(vec3(toCam.xy, 0.0) + vec3(1e-6, 0.0, 0.0));
  vec3 right = vec3(-facing.y, facing.x, 0.0);
  vec3 world = offset + right * (position.x * size.x) + vec3(0.0, 0.0, position.y * size.y);
  vUv = vec2(mix(rect.x, rect.y, position.x + 0.5), mix(rect.z, rect.w, position.y));
  vTint = tint;
  vRight = right;
  vFacing = facing;
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
  #include <fog_vertex>
}
`;

/** Factor from the atlas's baked colour to a foliage albedo (mean luminance 0.035 → 0.11). */
export const TREE_ALBEDO_SCALE = 3.2;

const FRAGMENT = /* glsl */ `
#define ALBEDO_SCALE ${TREE_ALBEDO_SCALE.toFixed(2)}
#include <common>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
uniform sampler2D colourMap;
uniform sampler2D normalMap;
uniform vec3 sunDir;
uniform vec3 sunColour;
uniform vec3 skyColour;
uniform vec3 groundColour;
varying vec2 vUv;
varying float vTint;
varying vec3 vRight;
varying vec3 vFacing;
void main() {
  #include <logdepthbuf_fragment>
  vec4 c = texture2D(colourMap, vUv);
  if (c.a < 0.5) discard;
  // The render's normal: x right, y up, z towards the viewer; to the world through the billboard.
  vec3 n = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
  vec3 N = normalize(vRight * n.x + vec3(0.0, 0.0, 1.0) * n.y + vFacing * n.z);
  float sun = max(dot(N, normalize(sunDir)), 0.0);
  // Leaves pass some light through: a little of the sun reaches the side away from it.
  float through = 0.4 * max(dot(-N, normalize(sunDir)), 0.0);
  vec3 ambient = mix(groundColour, skyColour, 0.5 + 0.5 * N.z);
  // The bake darkened the albedo (mean luminance 0.035); scaled to a sunlit foliage's 0.11.
  vec3 albedo = c.rgb * ALBEDO_SCALE * vTint;
  vec3 col = albedo * (ambient + sunColour * (sun + through));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

function blank(): DataTexture {
  const t = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, RGBAFormat, UnsignedByteType);
  t.needsUpdate = true;
  return t;
}

/** The instanced billboards; empty until `setAtlas` gives the images and their variants. */
export class TreeBillboards {
  readonly mesh: Mesh;
  private readonly geometry = new InstancedBufferGeometry();
  private readonly material: ShaderMaterial;
  private all = 0;

  /** `sun.colour` is the sun's irradiance over π (as three.js lights a Lambert surface), linear. */
  constructor(
    private readonly layout: SceneryLayout,
    private readonly count: number,
    sun: { readonly direction: Vector3; readonly colour: Color },
  ) {
    // A unit quad: x from −0.5 to 0.5, y (up) from 0 to 1.
    this.geometry.setAttribute(
      'position',
      new Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3),
    );
    this.geometry.setIndex([0, 1, 2, 0, 2, 3]);
    this.geometry.instanceCount = 0;
    this.material = new ShaderMaterial({
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          colourMap: { value: blank() },
          normalMap: { value: blank() },
          sunDir: { value: sun.direction.clone() },
          sunColour: { value: sun.colour.clone() },
          // Ambient radiance from the sky above and the grass below, linear (drawing choices,
          // near the sky photograph's mean above the horizon and a grass bounce below).
          skyColour: { value: new Color(0.45, 0.5, 0.58) },
          groundColour: { value: new Color(0.1, 0.11, 0.07) },
        },
      ]),
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      side: DoubleSide,
      fog: true,
      alphaToCoverage: true,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.name = 'trees';
    this.mesh.frustumCulled = false;
  }

  setAtlas(atlas: TreeAtlas): void {
    const trees = placeTrees(this.layout, atlas.variants, this.count);
    const offset = new Float32Array(3 * trees.length);
    const size = new Float32Array(2 * trees.length);
    const rect = new Float32Array(4 * trees.length);
    const tint = new Float32Array(trees.length);
    trees.forEach((t, i) => {
      const v = atlas.variants[t.variant];
      if (v === undefined) return;
      offset.set([t.x, t.y, t.z], 3 * i);
      size.set([v.width * t.scale, v.height * t.scale], 2 * i);
      rect.set([v.u0, v.u1, v.v0, v.v1], 4 * i);
      tint[i] = t.tint;
    });
    this.geometry.setAttribute('offset', new InstancedBufferAttribute(offset, 3));
    this.geometry.setAttribute('size', new InstancedBufferAttribute(size, 2));
    this.geometry.setAttribute('rect', new InstancedBufferAttribute(rect, 4));
    this.geometry.setAttribute('tint', new InstancedBufferAttribute(tint, 1));
    this.all = trees.length;
    this.geometry.instanceCount = trees.length;
    const u = this.material.uniforms;
    if (u['colourMap'] !== undefined) u['colourMap'].value = atlas.colour;
    if (u['normalMap'] !== undefined) u['normalMap'].value = atlas.normal;
  }

  /** Show all the trees, or a quarter of them (low detail). */
  setLowDetail(low: boolean): void {
    this.geometry.instanceCount = low ? Math.ceil(this.all / 4) : this.all;
  }

  get instanceCount(): number {
    return this.geometry.instanceCount;
  }
}
