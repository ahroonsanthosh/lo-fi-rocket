/**
 * Real-world terrain for the replay (plan 3d-0001 D-3D-2, plan 3d-0002
 * D-3D-5): a polar height grid from the elevation tiles out to the horizon,
 * draped with up to four imagery levels (finest over the flight area). The
 * grid is drawn relative to the pad: z = groundZ + (elevation − elevation at
 * the pad) − the Earth's curvature drop, so the pad stands on the drawn
 * ground exactly as with the flat scenery. No DOM; the textures are made by
 * the caller.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  MeshLambertMaterial,
  Vector4,
  type Texture,
} from 'three';
import { pixelToLocal, TILE_SIZE, type LonLat, type TileRange } from '../map/tiles.js';

export interface LocalBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/** The local east-north rectangle a tile range covers, metres. */
export function rangeBounds(site: LonLat, range: TileRange): LocalBounds {
  const nw = pixelToLocal(site, range.z, range.x0 * TILE_SIZE, range.y0 * TILE_SIZE);
  const se = pixelToLocal(
    site,
    range.z,
    (range.x0 + range.cols) * TILE_SIZE,
    (range.y0 + range.rows) * TILE_SIZE,
  );
  return { minX: nw.x, maxX: se.x, minY: se.y, maxY: nw.y };
}

/** Mean Earth radius, metres (for the curvature drop only; a drawing choice). */
export const EARTH_MEAN_RADIUS = 6_371_000;

/**
 * How far the Earth's surface falls below the pad's tangent plane at a
 * horizontal distance r, metres: r² / 2R (the small-angle form of
 * R − √(R² − r²), within 0.01 % up to 120 km).
 */
export function curvatureDrop(r: number): number {
  return (r * r) / (2 * EARTH_MEAN_RADIUS);
}

export interface ImageryLevel {
  readonly texture: Texture;
  readonly bounds: LocalBounds;
}

export interface MapTerrainInputs {
  /** Elevation above mean sea level at a local east-north position, metres. */
  readonly heightAt: (x: number, y: number) => number;
  /** Radius of the drawn terrain about the pad, metres. */
  readonly radius: number;
  readonly groundZ: number;
  /** Imagery from the finest (smallest) to the coarsest; at most four. */
  readonly levels: readonly ImageryLevel[];
  /** The close-up grass scan (ground.ts), for brightness detail near the camera; optional. */
  readonly detail?: Texture;
  /** Rings and segments of the polar grid (a drawing budget). */
  readonly segments?: number;
  readonly ringFactor?: number;
}

/**
 * The terrain as a polar grid about the pad, ring radii growing
 * geometrically (finest at the pad) to `radius`; z = groundZ + (elevation −
 * elevation at the pad) − the curvature drop, so the pad stands on the
 * drawn ground and the far ground falls away below the horizon.
 */
export function mapTerrainGeometry(
  heightAt: (x: number, y: number) => number,
  radius: number,
  groundZ: number,
  segments = 192,
  ringFactor = 1.06,
): BufferGeometry {
  const pad = heightAt(0, 0);
  const radii = [0];
  for (let r = 0.5; r < radius; r *= ringFactor) radii.push(r);
  radii.push(radius);
  const row = segments + 1;
  const positions = new Float32Array(radii.length * row * 3);
  let k = 0;
  for (const r of radii) {
    for (let j = 0; j <= segments; j++) {
      const phi = (2 * Math.PI * j) / segments;
      const x = r * Math.cos(phi);
      const y = r * Math.sin(phi);
      positions[k++] = x;
      positions[k++] = y;
      positions[k++] = groundZ + (heightAt(x, y) - pad) - curvatureDrop(r);
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < radii.length - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * row + j;
      const b = a + row;
      // Counter-clockwise seen from above.
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/**
 * The draped terrain mesh. The material takes each fragment's colour from
 * the finest imagery level whose rectangle holds it, blended over the last
 * 4 % of each rectangle so no level ends in a seam; close to the camera the
 * grass scan adds brightness detail; a slight saturation lift counters the
 * satellite imagery's haze (drawing choice).
 */
export function buildMapTerrain(inputs: MapTerrainInputs): Mesh {
  const geometry = mapTerrainGeometry(
    inputs.heightAt,
    inputs.radius,
    inputs.groundZ,
    inputs.segments,
    inputs.ringFactor,
  );
  const material = new MeshLambertMaterial();
  const levels = inputs.levels.slice(0, 4);
  const coarsest = levels[levels.length - 1];
  if (coarsest === undefined) throw new Error('buildMapTerrain: no imagery');
  const b = (r: LocalBounds): Vector4 => new Vector4(r.minX, r.minY, r.maxX, r.maxY);
  material.onBeforeCompile = (shader) => {
    for (let i = 0; i < 4; i++) {
      const l = levels[i] ?? coarsest;
      shader.uniforms[`level${String(i)}`] = { value: l.texture };
      shader.uniforms[`bounds${String(i)}`] = { value: b(l.bounds) };
    }
    shader.uniforms['levelCount'] = { value: levels.length };
    shader.uniforms['detailMap'] = { value: inputs.detail ?? null };
    shader.uniforms['hasDetail'] = { value: inputs.detail === undefined ? 0 : 1 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vEN;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvEN = (modelMatrix * vec4(transformed, 1.0)).xy;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vEN;
uniform sampler2D level0; uniform sampler2D level1; uniform sampler2D level2; uniform sampler2D level3;
uniform vec4 bounds0; uniform vec4 bounds1; uniform vec4 bounds2; uniform vec4 bounds3;
uniform int levelCount;
uniform sampler2D detailMap;
uniform float hasDetail;
vec2 boundsUv(vec4 r) { return vec2((vEN.x - r.x) / (r.z - r.x), (r.w - vEN.y) / (r.w - r.y)); }
float inside(vec2 uv) { float e = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)); return smoothstep(0.0, 0.04, e); }
vec3 level(sampler2D m, vec2 uv) { return texture2D(m, vec2(uv.x, 1.0 - uv.y)).rgb; }`,
      )
      .replace(
        '#include <map_fragment>',
        `{
  vec2 u3 = boundsUv(bounds3); vec2 u2 = boundsUv(bounds2); vec2 u1 = boundsUv(bounds1); vec2 u0 = boundsUv(bounds0);
  vec3 col = level(level3, u3);
  if (levelCount > 2) col = mix(col, level(level2, u2), inside(u2));
  if (levelCount > 1) col = mix(col, level(level1, u1), inside(u1));
  col = mix(col, level(level0, u0), inside(u0));
  // Saturation lift against the imagery's haze.
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(l), col, 1.18), 0.0);
  if (hasDetail > 0.5) {
    float near = 1.0 - smoothstep(8.0, 45.0, length(vViewPosition));
    float d = dot(texture2D(detailMap, vEN / 2.0).rgb, vec3(0.2126, 0.7152, 0.0722)) / 0.2441;
    col *= mix(1.0, clamp(d, 0.55, 1.45), 0.6 * near);
  }
  diffuseColor.rgb *= col;
}`,
      );
  };
  // The shader differs from a plain Lambert material's; keep its program separate.
  material.customProgramCacheKey = () => `lofi-map-terrain-${String(levels.length)}`;
  const mesh = new Mesh(geometry, material);
  mesh.name = 'map-terrain';
  mesh.receiveShadow = true;
  return mesh;
}
