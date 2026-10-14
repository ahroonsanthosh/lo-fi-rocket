/**
 * Loads the real-world scenery for a launch site (plan 3d-0001, D-3D-2):
 * the elevation tiles (AWS Terrain Tiles, Terrarium encoding) and two
 * imagery mosaics from a free source, then builds the draped terrain.
 * Tiles are kept in the browser's Cache Storage, so a site seen once
 * works offline. Any tile that cannot be loaded fails the whole load with
 * a message naming the source; the caller keeps the illustrative scenery
 * and shows the message (no silent fallback).
 */
import { CanvasTexture, SRGBColorSpace, type Mesh } from 'three';
import {
  chooseZoom,
  decodeTerrarium,
  ElevationGrid,
  ELEVATION_SOURCE,
  IMAGERY_SOURCES,
  mapLevels,
  metresPerPixel,
  terrainDeviation,
  tileRange,
  TILE_SIZE,
  validateSite,
  type ImagerySource,
  type LaunchSite,
  type TileRange,
} from '../map/tiles.js';
import { buildMapTerrain, rangeBounds } from '../scene/map-terrain.js';
import type { FlightScene } from '../scene/flight-scene.js';
import { loadSceneAssets } from './assets.js';

export interface MapScenery {
  readonly terrain: Mesh;
  /** Radius of the drawn terrain, metres. */
  readonly radius: number;
  /** Fog visibility for the map's size, metres. */
  readonly visibility: number;
  /** Elevation above mean sea level at the pad from the terrain data, metres. */
  readonly padElevation: number;
  /** Largest departure of the terrain under the flight from the pad's elevation, metres (signed). */
  readonly deviation: number;
  /** Where that departure is, metres east and north of the pad. */
  readonly deviationAt: { readonly x: number; readonly y: number };
  readonly attributions: readonly string[];
  /** Ground metres per imagery pixel near the pad. */
  readonly imageryResolution: number;
}

const CACHE_NAME = 'lofi-map-tiles-v1';

async function fetchTile(url: string, signal: AbortSignal | undefined): Promise<Blob> {
  let cache: Cache | undefined;
  try {
    cache = typeof caches === 'undefined' ? undefined : await caches.open(CACHE_NAME);
  } catch {
    cache = undefined; // Cache Storage unavailable (private window): tiles are fetched each time.
  }
  const hit = await cache?.match(url);
  if (hit !== undefined) return hit.blob();
  const init: RequestInit = { mode: 'cors' };
  if (signal !== undefined) init.signal = signal;
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
  if (cache !== undefined) {
    try {
      await cache.put(url, res.clone());
    } catch {
      // Storage full: the tile is still used, only not kept for offline use.
    }
  }
  return res.blob();
}

async function mosaic(
  range: TileRange,
  url: (z: number, x: number, y: number) => string,
  sourceName: string,
  signal: AbortSignal | undefined,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = range.cols * TILE_SIZE;
  canvas.height = range.rows * TILE_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx === null) throw new Error('The browser could not create a 2D canvas for the map.');
  const jobs: (() => Promise<void>)[] = [];
  for (let j = 0; j < range.rows; j++) {
    for (let i = 0; i < range.cols; i++) {
      jobs.push(async () => {
        const u = url(range.z, range.x0 + i, range.y0 + j);
        let blob: Blob;
        try {
          blob = await fetchTile(u, signal);
        } catch (e) {
          if (signal?.aborted === true) throw e;
          throw new Error(
            `A map tile from ${sourceName} could not be loaded (${e instanceof Error ? e.message : String(e)}). Check the internet connection, or choose another imagery source.`,
            { cause: e },
          );
        }
        const bitmap = await createImageBitmap(blob);
        ctx.drawImage(bitmap, i * TILE_SIZE, j * TILE_SIZE);
        bitmap.close();
      });
    }
  }
  // Six requests at a time.
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < jobs.length) {
      const job = jobs[next++];
      if (job !== undefined) await job();
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, jobs.length) }, worker));
  return canvas;
}

function texture(canvas: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

export function imagerySource(id: ImagerySource['id']): ImagerySource {
  const s = IMAGERY_SOURCES.find((x) => x.id === id);
  if (s === undefined) throw new Error(`Unknown imagery source ${id}`);
  return s;
}

/** Load and build the real-world terrain for the scene's flight at `site`. */
export async function loadMapScenery(
  scene: FlightScene,
  site: LaunchSite,
  sourceId: ImagerySource['id'],
  signal?: AbortSignal,
): Promise<MapScenery> {
  const invalid = validateSite(site);
  if (invalid !== undefined) throw new Error(invalid);
  const source = imagerySource(sourceId);
  const lv = mapLevels(scene.layout.flatRadius);

  // Elevation: a fine grid over the outer level and a coarse one out to the horizon.
  const nz = chooseZoom(site, lv.nearElevation, 6, ELEVATION_SOURCE.maxZoom);
  const nRange = tileRange(site, lv.nearElevation, nz);
  const fz = chooseZoom(site, lv.far, 4, ELEVATION_SOURCE.maxZoom);
  const fRange = tileRange(site, lv.far, fz);
  // Imagery: four levels, finest first; a level no sharper than the next is skipped.
  const wanted = [
    { half: lv.inner, tiles: 6 },
    { half: lv.mid, tiles: 4 },
    { half: lv.outer, tiles: 6 },
    { half: lv.far, tiles: 4 },
  ].map((l) => ({
    ...l,
    range: tileRange(site, l.half, chooseZoom(site, l.half, l.tiles, source.maxZoom)),
  }));
  const levels = wanted.filter((l, i) => {
    const coarser = wanted[i + 1];
    return coarser === undefined || l.range.z > coarser.range.z;
  });

  const [nCanvas, fCanvas, ...imagery] = await Promise.all([
    mosaic(nRange, ELEVATION_SOURCE.url, 'the elevation service (AWS Terrain Tiles)', signal),
    mosaic(fRange, ELEVATION_SOURCE.url, 'the elevation service (AWS Terrain Tiles)', signal),
    ...levels.map((l) => mosaic(l.range, source.url, source.label, signal)),
  ]);
  const near = elevationGrid(site, nRange, nCanvas);
  const far = elevationGrid(site, fRange, fCanvas);
  const nb = rangeBounds(site, nRange);
  // The fine grid inside its rectangle, blending to the coarse one over its last 10 %.
  const heightAt = (x: number, y: number): number => {
    const e = Math.min(x - nb.minX, nb.maxX - x, y - nb.minY, nb.maxY - y) / (nb.maxX - nb.minX);
    const w = Math.min(1, Math.max(0, e / 0.1));
    return w <= 0
      ? far.at(x, y)
      : w >= 1
        ? near.at(x, y)
        : w * near.at(x, y) + (1 - w) * far.at(x, y);
  };

  const detail = await loadSceneAssets().then(
    (a) => a.ground.grass.diffuse,
    () => undefined,
  );
  const terrain = buildMapTerrain({
    heightAt,
    radius: lv.far,
    groundZ: scene.layout.groundZ,
    levels: levels.map((l, i) => {
      const c = imagery[i];
      if (c === undefined) throw new Error('A map imagery level is missing.');
      return { texture: texture(c), bounds: rangeBounds(site, l.range) };
    }),
    ...(detail === undefined ? {} : { detail }),
  });
  const points = scene.result.samples.map((s) => ({ x: s.position.x, y: s.position.y }));
  const dev = terrainDeviation(heightAt, points);
  const finest = levels[0]?.range.z ?? 0;
  return {
    terrain,
    radius: lv.far,
    // Haze: the ground fades out towards the horizon ring's edge.
    visibility: 1.1 * lv.far,
    padElevation: heightAt(0, 0),
    deviation: dev.metres,
    deviationAt: dev.at,
    attributions: [source.attribution, ELEVATION_SOURCE.attribution],
    imageryResolution: metresPerPixel(site.lat, finest),
  };
}

function elevationGrid(
  site: LaunchSite,
  range: TileRange,
  canvas: HTMLCanvasElement,
): ElevationGrid {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx === null) throw new Error('The browser could not read the elevation tiles.');
  const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const metres = new Float32Array(canvas.width * canvas.height);
  for (let k = 0; k < metres.length; k++) {
    metres[k] = decodeTerrarium(px[4 * k] ?? 0, px[4 * k + 1] ?? 0, px[4 * k + 2] ?? 0);
  }
  return new ElevationGrid(site, range, metres);
}

/** A place search with OpenStreetMap Nominatim (free; one request per search the user makes). */
export async function searchPlace(query: string, signal?: AbortSignal): Promise<LaunchSite[]> {
  const q = query.trim();
  if (q === '') return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`;
  const init: RequestInit = { headers: { Accept: 'application/json' } };
  if (signal !== undefined) init.signal = signal;
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`The place search failed (HTTP ${String(res.status)}).`);
  const body: unknown = await res.json();
  if (!Array.isArray(body)) throw new Error('The place search returned an unexpected answer.');
  const out: LaunchSite[] = [];
  for (const item of body as unknown[]) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Record<string, unknown>;
    const lat = Number(r['lat']);
    const lon = Number(r['lon']);
    const label = typeof r['display_name'] === 'string' ? r['display_name'] : q;
    if (Number.isFinite(lat) && Number.isFinite(lon)) out.push({ lat, lon, label });
  }
  return out;
}
