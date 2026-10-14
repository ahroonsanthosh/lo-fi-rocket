/**
 * Loads the photographic assets (plan 3d-0002, D-3D-3; `assets/ASSETS.md`)
 * once per page, asynchronously. The scene shows without them and upgrades
 * in place when they arrive. A failed load leaves the plain scenery and is
 * reported to the caller (no silent fallback: the caller shows a note).
 */
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { LinearFilter, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { tileable, type GroundTextures } from '../scene/ground.js';
import { TREE_VARIANTS, type TreeAtlas } from '../scene/trees.js';

export interface SceneAssets {
  /** The visible sky, sRGB, the upper hemisphere (sky.ts). */
  readonly sky: Texture;
  /** The sky's HDR, linear, for the image-based lighting. */
  readonly skyLight: Texture;
  readonly ground: GroundTextures;
  readonly trees: TreeAtlas;
}

// Static URLs, so that the bundler copies each file and rewrites its address.
const URLS = {
  sky: new URL('../../assets/sky.jpg', import.meta.url).href,
  skyLight: new URL('../../assets/sky_light.hdr', import.meta.url).href,
  fieldDiffuse: new URL('../../assets/field_diffuse.jpg', import.meta.url).href,
  fieldNormal: new URL('../../assets/field_normal.jpg', import.meta.url).href,
  grassDiffuse: new URL('../../assets/grass_diffuse.jpg', import.meta.url).href,
  hillsDiffuse: new URL('../../assets/hills_diffuse.jpg', import.meta.url).href,
  treesColour: new URL('../../assets/trees_colour.webp', import.meta.url).href,
  treesNormal: new URL('../../assets/trees_normal.webp', import.meta.url).href,
} as const;

let pending: Promise<SceneAssets> | undefined;

async function load(anisotropy: number): Promise<SceneAssets> {
  const tex = new TextureLoader();
  const image = (url: string): Promise<Texture> => tex.loadAsync(url);
  const [sky, skyLight, fd, fn, gd, hd, tc, tn] = await Promise.all([
    image(URLS.sky),
    new HDRLoader().loadAsync(URLS.skyLight),
    image(URLS.fieldDiffuse),
    image(URLS.fieldNormal),
    image(URLS.grassDiffuse),
    image(URLS.hillsDiffuse),
    image(URLS.treesColour),
    image(URLS.treesNormal),
  ]);
  sky.colorSpace = SRGBColorSpace;
  // Seen at about one texel per pixel: no mipmaps, so the wrap of the azimuth leaves no seam.
  sky.generateMipmaps = false;
  sky.minFilter = LinearFilter;
  skyLight.minFilter = LinearFilter;
  skyLight.magFilter = LinearFilter;
  tc.colorSpace = SRGBColorSpace;
  for (const t of [tc, tn]) t.anisotropy = anisotropy;
  return {
    sky,
    skyLight,
    ground: {
      field: { diffuse: tileable(fd, true, anisotropy), normal: tileable(fn, false, anisotropy) },
      grass: { diffuse: tileable(gd, true, anisotropy) },
      hills: { diffuse: tileable(hd, true, anisotropy) },
    },
    trees: { colour: tc, normal: tn, variants: TREE_VARIANTS },
  };
}

/** The assets, loaded on the first call and shared by every later scene of the page. */
export function loadSceneAssets(anisotropy = 8): Promise<SceneAssets> {
  pending ??= load(anisotropy).catch((e: unknown) => {
    pending = undefined; // a later scene may try again
    throw e;
  });
  return pending;
}
