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
  mapExtents,
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

export interface MapScenery {
  readonly terrain: Mesh;
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
  const ext = mapExtents(scene.layout.flatRadius);

  const ez = chooseZoom(site, ext.outer, 4, ELEVATION_SOURCE.maxZoom);
  const eRange = tileRange(site, ext.outer, ez);
  const oz = chooseZoom(site, ext.outer, 8, source.maxZoom);
  const oRange = tileRange(site, ext.outer, oz);
  const iz = chooseZoom(site, ext.inner, 8, source.maxZoom);
  const iRange = tileRange(site, ext.inner, iz);

  const [eCanvas, oCanvas, iCanvas] = await Promise.all([
    mosaic(eRange, ELEVATION_SOURCE.url, 'the elevation service (AWS Terrain Tiles)', signal),
    mosaic(oRange, source.url, source.label, signal),
    iz > oz ? mosaic(iRange, source.url, source.label, signal) : Promise.resolve(undefined),
  ]);

  const ctx = eCanvas.getContext('2d', { willReadFrequently: true });
  if (ctx === null) throw new Error('The browser could not read the elevation tiles.');
  const px = ctx.getImageData(0, 0, eCanvas.width, eCanvas.height).data;
  const metres = new Float32Array(eCanvas.width * eCanvas.height);
  for (let k = 0; k < metres.length; k++) {
    metres[k] = decodeTerrarium(px[4 * k] ?? 0, px[4 * k + 1] ?? 0, px[4 * k + 2] ?? 0);
  }
  const grid = new ElevationGrid(site, eRange, metres);
  const heightAt = (x: number, y: number): number => grid.at(x, y);

  const terrain = buildMapTerrain({
    heightAt,
    half: ext.outer,
    groundZ: scene.layout.groundZ,
    outer: { texture: texture(oCanvas), bounds: rangeBounds(site, oRange) },
    inner:
      iCanvas === undefined
        ? undefined
        : { texture: texture(iCanvas), bounds: rangeBounds(site, iRange) },
  });
  const points = scene.result.samples.map((s) => ({ x: s.position.x, y: s.position.y }));
  const dev = terrainDeviation(heightAt, points);
  return {
    terrain,
    visibility: 1.4 * ext.outer,
    padElevation: heightAt(0, 0),
    deviation: dev.metres,
    deviationAt: dev.at,
    attributions: [source.attribution, ELEVATION_SOURCE.attribution],
    imageryResolution:
      (2 * Math.PI * 6_378_137 * Math.cos((site.lat * Math.PI) / 180)) /
      (TILE_SIZE * 2 ** Math.max(iz, oz)),
  };
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
