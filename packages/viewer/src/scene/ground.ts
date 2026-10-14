/**
 * The photographic ground material (plan 3d-0002, D-3D-3). CC0 photo-scanned
 * textures (`assets/ASSETS.md`) give the ground's brightness detail and a
 * grass palette gives its colour, because the scans are dry and orange
 * (the field scan's mean is linear (0.17, 0.12, 0.03)):
 *
 * - the field (`aerial_grass_rock`, 15 m per tile) sampled twice, the second
 *   time rotated and at 2.7 times the scale, mixed by a low-frequency noise;
 * - close-up blades (`leafy_grass`, 2 m per tile) fading out from 12 m to 60 m;
 * - from 30 m to 600 m the texture detail fades into a patchwork of greener,
 *   lusher and drier grass at 40 m to 700 m, so no repeat shows;
 * - close up, a quarter of the scan's own colour (soil, stones);
 * - rocky ground (`rocky_terrain_02`, 90 m per tile) on the hills, by the
 *   vertex attribute `rock` (height and slope);
 * - a darker, scorched patch around the pad.
 *
 * Until the textures load, the vertex colours alone. Scenery only.
 */
import {
  DataTexture,
  LinearMipmapLinearFilter,
  MeshLambertMaterial,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  Vector2,
  type Texture,
} from 'three';

/** Metres per tile of each photo texture on the ground (the scanned sizes, ASSETS.md). */
export const FIELD_TILE = 15;
export const GRASS_TILE = 2;
export const HILLS_TILE = 90;
/** Mean linear luminance of each scan (measured over the whole image; ASSETS.md). */
export const FIELD_MEAN_LUMINANCE = 0.1271;
export const GRASS_MEAN_LUMINANCE = 0.2441;
export const HILLS_MEAN_LUMINANCE = 0.0745;

export interface GroundTextures {
  readonly field: { readonly diffuse: Texture; readonly normal: Texture };
  readonly grass: { readonly diffuse: Texture };
  readonly hills: { readonly diffuse: Texture };
}

function placeholder(r: number, g: number, b: number, srgb: boolean): DataTexture {
  const t = new DataTexture(new Uint8Array([r, g, b, 255]), 1, 1, RGBAFormat, UnsignedByteType);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Prepare a loaded photo texture for tiling on the ground. */
export function tileable(t: Texture, colour: boolean, anisotropy: number): Texture {
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = anisotropy;
  if (colour) t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

const VERTEX_DECLS = /* glsl */ `
attribute float rock;
varying vec2 vGroundXY;
varying float vRock;
`;

const FRAGMENT_DECLS = /* glsl */ `
uniform sampler2D grassMap;
uniform sampler2D hillsMap;
uniform float hasPhotos;
uniform float padRadius;
varying vec2 vGroundXY;
varying float vRock;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
// Mean linear luminance of each scan (measured over the image, ASSETS.md).
const float FIELD_LUM = ${FIELD_MEAN_LUMINANCE.toFixed(4)};
const float GRASS_LUM = ${GRASS_MEAN_LUMINANCE.toFixed(4)};
const float HILLS_LUM = ${HILLS_MEAN_LUMINANCE.toFixed(4)};
// Grass palette, linear albedo (drawing choices: a summer pasture).
const vec3 GREEN_A = vec3(0.068, 0.118, 0.032);
const vec3 GREEN_B = vec3(0.098, 0.150, 0.043);
const vec3 DRY = vec3(0.150, 0.140, 0.058);
const vec3 HILL_GREEN = vec3(0.050, 0.078, 0.028);
const vec3 ROCK = vec3(0.120, 0.110, 0.090);
float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

const MAP_FRAGMENT = /* glsl */ `
{
  vec2 xy = vGroundXY;
  if (hasPhotos > 0.5) {
    float dist = length(vViewPosition);
    // The field scan at two scales and turns, mixed by noise, as brightness detail.
    vec2 uvA = xy / ${FIELD_TILE.toFixed(1)};
    vec2 uvB = mat2(0.8, -0.6, 0.6, 0.8) * xy / ${(FIELD_TILE * 2.7).toFixed(1)} + vec2(0.37, 0.71);
    float n = gNoise(xy / 55.0) * 0.65 + gNoise(xy / 13.0) * 0.35;
    vec3 scan = mix(texture2D(map, uvA).rgb, texture2D(map, uvB).rgb, mix(0.3, 0.7, n));
    float detail = dot(scan, LUMA) / FIELD_LUM;
    // Close-up blades from the 2 m grass scan.
    float blades = dot(texture2D(grassMap, xy / ${GRASS_TILE.toFixed(1)}).rgb, LUMA) / GRASS_LUM;
    detail *= mix(1.0, clamp(blades, 0.4, 1.7), 1.0 - smoothstep(12.0, 60.0, dist));
    // Further away the texture's repeat would show: its detail fades into the patchwork below.
    float far = smoothstep(30.0, 600.0, dist);
    detail = mix(clamp(detail, 0.3, 2.2), 1.0, 0.75 * far);
    // Patchwork of greener, lusher and drier grass at 40 m to 700 m.
    float m1 = gNoise(xy / 180.0 + 3.1);
    float m2 = gNoise(xy / 40.0 + 7.3);
    float m3 = gNoise(xy / 700.0 - 1.7);
    vec3 grass = mix(GREEN_A, GREEN_B, m2);
    grass = mix(grass, DRY, 0.7 * smoothstep(0.55, 0.85, m1));
    grass *= 0.85 + 0.3 * m3;
    vec3 field = grass * detail;
    // Close up, a quarter of the scan's own colour (bare soil, stones) comes through.
    field = mix(field, scan * (dot(grass, LUMA) / FIELD_LUM), 0.25 * (1.0 - far));
    // Hills: the rocky scan's brightness on forest green, rock where the slope is steep.
    float hillDetail = dot(texture2D(hillsMap, xy / ${HILLS_TILE.toFixed(1)}).rgb, LUMA) / HILLS_LUM;
    vec3 hillCol = mix(HILL_GREEN, ROCK, smoothstep(0.6, 1.0, vRock));
    vec3 hills = hillCol * mix(clamp(hillDetail, 0.3, 2.2), 1.0, 0.5 * far);
    vec3 ground = mix(field, hills, clamp(vRock, 0.0, 1.0));
    // Scorched, trampled ground around the pad.
    ground = mix(ground * vec3(0.55, 0.48, 0.40), ground, smoothstep(0.3 * padRadius, padRadius, length(xy)));
    diffuseColor.rgb = ground;
  }
}
`;

const COLOR_FRAGMENT = /* glsl */ `
#if defined( USE_COLOR )
  // The vertex colours are the stand-in until the photographs load.
  if (hasPhotos < 0.5) diffuseColor.rgb *= vColor.rgb;
#endif
`;

/** The ground material; `setTextures` swaps the placeholders for the photographs. */
export class GroundMaterial {
  readonly material: MeshLambertMaterial;
  private readonly uniforms = {
    grassMap: { value: placeholder(255, 255, 255, true) as Texture },
    hillsMap: { value: placeholder(255, 255, 255, true) as Texture },
    hasPhotos: { value: 0 },
    padRadius: { value: 1 },
  };

  /** `padRadius`: radius of the scorched patch around the pad, metres. */
  constructor(padRadius: number) {
    this.uniforms.padRadius.value = padRadius;
    this.material = new MeshLambertMaterial({
      vertexColors: true,
      map: placeholder(255, 255, 255, true),
      normalMap: placeholder(128, 128, 255, false),
    });
    // The field normal map tiles like the field's first sample.
    this.material.normalScale = new Vector2(0.8, 0.8);
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${VERTEX_DECLS}`)
        .replace(
          '#include <uv_vertex>',
          '#include <uv_vertex>\nvGroundXY = position.xy;\nvRock = rock;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${FRAGMENT_DECLS}`)
        .replace('#include <map_fragment>', MAP_FRAGMENT)
        .replace('#include <color_fragment>', COLOR_FRAGMENT);
    };
    this.material.customProgramCacheKey = () => 'lofi-ground-v2';
  }

  setTextures(t: GroundTextures): void {
    const m = this.material;
    m.map = t.field.diffuse;
    m.normalMap = t.field.normal;
    // The geometry's uv is in metres; the field and its normal map repeat every FIELD_TILE.
    for (const tex of [t.field.diffuse, t.field.normal])
      tex.repeat.set(1 / FIELD_TILE, 1 / FIELD_TILE);
    this.uniforms.grassMap.value = t.grass.diffuse;
    this.uniforms.hillsMap.value = t.hills.diffuse;
    this.uniforms.hasPhotos.value = 1;
    m.needsUpdate = true;
  }
}
