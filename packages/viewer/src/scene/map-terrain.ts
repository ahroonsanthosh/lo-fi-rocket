/**
 * Real-world terrain for the replay (plan 3d-0001, D-3D-2): a height grid
 * from the elevation tiles, draped with two imagery textures (a wide one
 * and a sharper one over the flight area). The grid is drawn relative to
 * the pad: z = groundZ + (elevation − elevation at the pad), so the pad
 * stands on the drawn ground exactly as with the flat scenery. No DOM; the
 * textures are made by the caller.
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

export interface MapTerrainInputs {
  /** Elevation above mean sea level at a local east-north position, metres. */
  readonly heightAt: (x: number, y: number) => number;
  /** Half-size of the drawn square about the pad, metres. */
  readonly half: number;
  readonly groundZ: number;
  readonly outer: { readonly texture: Texture; readonly bounds: LocalBounds };
  readonly inner: { readonly texture: Texture; readonly bounds: LocalBounds } | undefined;
  /** Grid cells per side (a drawing budget). */
  readonly cells?: number;
}

/** Exponent of the grid spacing: cells shrink towards the pad (u ↦ sign(u)|u|^p, a drawing choice). */
export const MAP_GRID_EXPONENT = 1.7;

/** Height grid of the square, z relative to the pad's elevation; cells are finest at the pad. */
function graded(u: number): number {
  return Math.sign(u) * Math.abs(u) ** MAP_GRID_EXPONENT;
}

export function mapTerrainGeometry(
  heightAt: (x: number, y: number) => number,
  half: number,
  groundZ: number,
  cells: number,
): BufferGeometry {
  const pad = heightAt(0, 0);
  const row = cells + 1;
  const positions = new Float32Array(row * row * 3);
  let k = 0;
  for (let j = 0; j <= cells; j++) {
    const y = half * graded((2 * j) / cells - 1);
    for (let i = 0; i <= cells; i++) {
      const x = half * graded((2 * i) / cells - 1);
      positions[k++] = x;
      positions[k++] = y;
      positions[k++] = groundZ + (heightAt(x, y) - pad);
    }
  }
  const indices: number[] = [];
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const a = j * row + i;
      indices.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/**
 * The draped terrain mesh. The material samples the inner texture inside
 * its bounds and the outer one elsewhere, from the fragment's east-north
 * position (texture v runs north to south, as the tiles do).
 */
export function buildMapTerrain(inputs: MapTerrainInputs): Mesh {
  const geometry = mapTerrainGeometry(
    inputs.heightAt,
    inputs.half,
    inputs.groundZ,
    inputs.cells ?? 128,
  );
  // Lambert: the ground is diffuse and covers most pixels, so the cheap model matters.
  const material = new MeshLambertMaterial();
  const b = (r: LocalBounds): Vector4 => new Vector4(r.minX, r.minY, r.maxX, r.maxY);
  const inner = inputs.inner ?? inputs.outer;
  material.onBeforeCompile = (shader) => {
    shader.uniforms['outerMap'] = { value: inputs.outer.texture };
    shader.uniforms['innerMap'] = { value: inner.texture };
    shader.uniforms['outerBounds'] = { value: b(inputs.outer.bounds) };
    shader.uniforms['innerBounds'] = { value: b(inner.bounds) };
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
uniform sampler2D outerMap;
uniform sampler2D innerMap;
uniform vec4 outerBounds;
uniform vec4 innerBounds;
vec2 boundsUv(vec4 r) { return vec2((vEN.x - r.x) / (r.z - r.x), (r.w - vEN.y) / (r.w - r.y)); }`,
      )
      .replace(
        '#include <map_fragment>',
        `vec2 iu = boundsUv(innerBounds);
vec4 texel;
if (iu.x > 0.0 && iu.x < 1.0 && iu.y > 0.0 && iu.y < 1.0) {
  texel = texture2D(innerMap, vec2(iu.x, 1.0 - iu.y));
} else {
  vec2 ou = boundsUv(outerBounds);
  texel = texture2D(outerMap, vec2(ou.x, 1.0 - ou.y));
}
diffuseColor *= texel;`,
      );
  };
  // The shader differs from a plain standard material's; keep its program separate.
  material.customProgramCacheKey = () => 'lofi-map-terrain';
  const mesh = new Mesh(geometry, material);
  mesh.name = 'map-terrain';
  mesh.receiveShadow = true;
  return mesh;
}
