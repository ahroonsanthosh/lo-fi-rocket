/**
 * Map tiles for the replay's real-world scenery (plan 3d-0001, D-3D-2).
 * Pure functions, no DOM and no network: the Web Mercator tile scheme
 * (the "slippy map" XYZ scheme every source below uses), the local
 * east-north projection about the pad, the Terrarium elevation encoding,
 * and the elevation grid that the terrain is built from.
 *
 * The scenery is illustrative. The simulator assumes flat ground at the
 * pad; `terrainDeviation` measures how far the real terrain under the
 * flight departs from that, so the app can say so instead of hiding it.
 *
 * The local projection uses the Mercator scale at the pad's latitude for
 * the whole map: x east = (X − X₀)·s, y north = −(Y − Y₀)·s, with
 * s = 2πR cos φ₀ / (256·2^z) metres per pixel. Mercator's scale grows as
 * 1/cos φ, so the relative error at a north-south distance d is about
 * d·tan φ₀ / R: 0.016 % at 10 km and 45°, below what the picture shows.
 */

/** WGS 84 equatorial radius, metres (the Web Mercator sphere). */
export const EARTH_RADIUS = 6_378_137;
/** Web Mercator's latitude limit, degrees. */
export const MAX_LATITUDE = 85.05112878;
export const TILE_SIZE = 256;

export interface LonLat {
  /** Degrees east. */
  readonly lon: number;
  /** Degrees north. */
  readonly lat: number;
}

export interface LaunchSite extends LonLat {
  /** A name for the place (from the search or typed by the user). */
  readonly label: string;
}

/** Check a site before any request is made: finite, latitude within Web Mercator's limit. */
export function validateSite(site: LonLat): string | undefined {
  if (!Number.isFinite(site.lat) || !Number.isFinite(site.lon))
    return 'The latitude and longitude must be numbers.';
  if (Math.abs(site.lat) > MAX_LATITUDE)
    return `The latitude must be between −${String(MAX_LATITUDE)}° and ${String(MAX_LATITUDE)}° for map tiles.`;
  if (Math.abs(site.lon) > 180) return 'The longitude must be between −180° and 180°.';
  return undefined;
}

/** World pixel coordinates at zoom z (x east from 180° W, y south from the north limit). */
export function worldPixel(p: LonLat, z: number): { readonly x: number; readonly y: number } {
  const n = TILE_SIZE * 2 ** z;
  const phi = (p.lat * Math.PI) / 180;
  return {
    x: ((p.lon + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * n,
  };
}

/** The longitude and latitude of a world pixel at zoom z (the inverse of `worldPixel`). */
export function lonLatOfPixel(x: number, y: number, z: number): LonLat {
  const n = TILE_SIZE * 2 ** z;
  return {
    lon: (x / n) * 360 - 180,
    lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI,
  };
}

/** Ground metres per world pixel at latitude `lat` and zoom z. */
export function metresPerPixel(lat: number, z: number): number {
  return (2 * Math.PI * EARTH_RADIUS * Math.cos((lat * Math.PI) / 180)) / (TILE_SIZE * 2 ** z);
}

/** The local east-north position of a world pixel relative to the site, metres. */
export function pixelToLocal(
  site: LonLat,
  z: number,
  px: number,
  py: number,
): { readonly x: number; readonly y: number } {
  const o = worldPixel(site, z);
  const s = metresPerPixel(site.lat, z);
  return { x: (px - o.x) * s, y: -(py - o.y) * s };
}

/** The world pixel of a local east-north position relative to the site. */
export function localToPixel(
  site: LonLat,
  z: number,
  x: number,
  y: number,
): { readonly x: number; readonly y: number } {
  const o = worldPixel(site, z);
  const s = metresPerPixel(site.lat, z);
  return { x: o.x + x / s, y: o.y - y / s };
}

export interface TileRange {
  readonly z: number;
  /** First tile column and row. */
  readonly x0: number;
  readonly y0: number;
  readonly cols: number;
  readonly rows: number;
}

/** The tiles at zoom z covering the square of half-size `half` metres about the site. */
export function tileRange(site: LonLat, half: number, z: number): TileRange {
  const a = localToPixel(site, z, -half, half);
  const b = localToPixel(site, z, half, -half);
  const max = 2 ** z - 1;
  const x0 = Math.max(0, Math.floor(a.x / TILE_SIZE));
  const y0 = Math.max(0, Math.floor(a.y / TILE_SIZE));
  const x1 = Math.min(max, Math.floor(b.x / TILE_SIZE));
  const y1 = Math.min(max, Math.floor(b.y / TILE_SIZE));
  return { z, x0, y0, cols: x1 - x0 + 1, rows: y1 - y0 + 1 };
}

/**
 * The highest zoom (at most `maxZoom`) at which the square of half-size
 * `half` about the site needs no more than `maxTiles` tiles across.
 */
export function chooseZoom(site: LonLat, half: number, maxTiles: number, maxZoom: number): number {
  for (let z = maxZoom; z > 0; z--) {
    const r = tileRange(site, half, z);
    if (r.cols <= maxTiles && r.rows <= maxTiles) return z;
  }
  return 0;
}

/** Terrarium encoding (AWS Terrain Tiles): metres = R·256 + G + B/256 − 32768. */
export function decodeTerrarium(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

/** Elevation samples on the pixel grid of a tile range: row-major, (cols·256) × (rows·256). */
export class ElevationGrid {
  readonly width: number;
  readonly height: number;

  constructor(
    readonly site: LonLat,
    readonly range: TileRange,
    readonly metres: Float32Array,
  ) {
    this.width = range.cols * TILE_SIZE;
    this.height = range.rows * TILE_SIZE;
    if (metres.length !== this.width * this.height)
      throw new Error('ElevationGrid: the sample count does not match the tile range');
  }

  /** Bilinear elevation above mean sea level at a local east-north position, metres (clamped at the edge). */
  at(x: number, y: number): number {
    const p = localToPixel(this.site, this.range.z, x, y);
    // Sample centres are at pixel + 0.5.
    const u = Math.min(this.width - 1, Math.max(0, p.x - this.range.x0 * TILE_SIZE - 0.5));
    const v = Math.min(this.height - 1, Math.max(0, p.y - this.range.y0 * TILE_SIZE - 0.5));
    const i = Math.floor(u);
    const j = Math.floor(v);
    const i1 = Math.min(this.width - 1, i + 1);
    const j1 = Math.min(this.height - 1, j + 1);
    const fu = u - i;
    const fv = v - j;
    const w = this.width;
    const m = this.metres;
    const a = m[j * w + i] ?? 0;
    const b = m[j * w + i1] ?? 0;
    const c = m[j1 * w + i] ?? 0;
    const d = m[j1 * w + i1] ?? 0;
    return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
  }
}

/**
 * The largest difference between the terrain under the given horizontal
 * positions and the terrain at the pad, metres, and where it is. The
 * simulator's ground is the plane through the pad.
 */
export function terrainDeviation(
  heightAt: (x: number, y: number) => number,
  points: readonly { readonly x: number; readonly y: number }[],
): { readonly metres: number; readonly at: { readonly x: number; readonly y: number } } {
  const pad = heightAt(0, 0);
  let worst = 0;
  let at = { x: 0, y: 0 };
  for (const p of points) {
    const d = heightAt(p.x, p.y) - pad;
    if (Math.abs(d) > Math.abs(worst)) {
      worst = d;
      at = { x: p.x, y: p.y };
    }
  }
  return { metres: worst, at };
}

export interface ImagerySource {
  readonly id: 'esri' | 'eox' | 'osm';
  readonly label: string;
  readonly url: (z: number, x: number, y: number) => string;
  readonly maxZoom: number;
  readonly attribution: string;
}

/**
 * Free imagery sources that need no key and allow browser use with
 * attribution (D-3D-2). Requests are made only after the user picks a site.
 */
export const IMAGERY_SOURCES: readonly ImagerySource[] = [
  {
    id: 'esri',
    label: 'Satellite (Esri World Imagery)',
    url: (z, x, y) =>
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${String(z)}/${String(y)}/${String(x)}`,
    maxZoom: 18,
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  },
  {
    id: 'eox',
    label: 'Satellite (Sentinel-2 cloudless 2016, EOX)',
    url: (z, x, y) =>
      `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${String(z)}/${String(y)}/${String(x)}.jpg`,
    maxZoom: 14,
    attribution:
      'Sentinel-2 cloudless – s2maps.eu by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016), CC BY 4.0',
  },
  {
    id: 'osm',
    label: 'Street map (OpenStreetMap)',
    url: (z, x, y) => `https://tile.openstreetmap.org/${String(z)}/${String(x)}/${String(y)}.png`,
    maxZoom: 18,
    attribution: '© OpenStreetMap contributors (ODbL)',
  },
];

/** AWS Terrain Tiles in Terrarium encoding (public dataset, no key). */
export const ELEVATION_SOURCE = {
  url: (z: number, x: number, y: number): string =>
    `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${String(z)}/${String(x)}/${String(y)}.png`,
  maxZoom: 15,
  attribution:
    'Elevation: Terrain Tiles (Mapzen / AWS Open Data; SRTM, USGS 3DEP, GMTED2010, ETOPO1 and others)',
} as const;

/** Map extents for a flight (drawing choices): the outer square and the sharper inner square. */
export function mapExtents(flatRadius: number): { readonly outer: number; readonly inner: number } {
  const outer = Math.min(40_000, Math.max(8_000, 4 * flatRadius));
  const inner = Math.min(outer, Math.max(400, 1.6 * flatRadius));
  return { outer, inner };
}
