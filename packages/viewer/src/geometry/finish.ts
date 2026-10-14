/**
 * Paint schemes and surface finishes for the 3D rocket (plan 3d-0002,
 * D-3D-4). The design stores no colours or finishes, so the user picks a
 * scheme in the viewer; it changes the picture only. Textures are generated
 * here from arrays (no DOM), once per page.
 *
 * Texture coordinates: revolved parts have u around the body (0 to 1) and v
 * along it in metres; fins have u, v = x, r in metres.
 */
import {
  Color,
  DataTexture,
  LinearMipmapLinearFilter,
  MeshPhysicalMaterial,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  DoubleSide,
  type Material,
} from 'three';

export type FinishKind =
  'gloss' | 'matte' | 'carbon' | 'fiberglass' | 'kraft' | 'balsa' | 'plastic' | 'metal';

export interface Finish {
  readonly kind: FinishKind;
  /** Base colour, sRGB (the texture's tint for textured finishes). */
  readonly colour: number;
}

export interface PaintScheme {
  readonly label: string;
  readonly nose: Finish;
  readonly body: Finish;
  readonly fins: Finish;
}

export type PaintSchemeId = 'classic' | 'sport' | 'carbon' | 'fiberglass' | 'kraft' | 'primer';

export const PAINT_SCHEMES: Readonly<Record<PaintSchemeId, PaintScheme>> = {
  classic: {
    label: 'Gloss red, white and black',
    nose: { kind: 'gloss', colour: 0xc4231d },
    body: { kind: 'gloss', colour: 0xf1f0ea },
    fins: { kind: 'gloss', colour: 0x1c2026 },
  },
  sport: {
    label: 'Gloss black and orange',
    nose: { kind: 'gloss', colour: 0xf26a1b },
    body: { kind: 'gloss', colour: 0x16181c },
    fins: { kind: 'gloss', colour: 0xf26a1b },
  },
  carbon: {
    label: 'Carbon fibre',
    nose: { kind: 'gloss', colour: 0x101114 },
    body: { kind: 'carbon', colour: 0xffffff },
    fins: { kind: 'carbon', colour: 0xffffff },
  },
  fiberglass: {
    label: 'Bare fibreglass',
    nose: { kind: 'fiberglass', colour: 0xd8cfa8 },
    body: { kind: 'fiberglass', colour: 0xcfc59c },
    fins: { kind: 'fiberglass', colour: 0xc9bf95 },
  },
  kraft: {
    label: 'Unpainted kraft tube and balsa',
    nose: { kind: 'plastic', colour: 0xeeeeea },
    body: { kind: 'kraft', colour: 0xffffff },
    fins: { kind: 'balsa', colour: 0xffffff },
  },
  primer: {
    label: 'Grey primer',
    nose: { kind: 'matte', colour: 0x9a9c9e },
    body: { kind: 'matte', colour: 0xa3a5a7 },
    fins: { kind: 'matte', colour: 0x95979a },
  },
};

export const PAINT_SCHEME_IDS = Object.keys(PAINT_SCHEMES) as readonly PaintSchemeId[];

function hash(i: number, j: number, seed: number): number {
  let h = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

function texture(
  n: number,
  pixel: (i: number, j: number) => readonly [number, number, number],
): DataTexture {
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const [r, g, b] = pixel(i, j);
      const k = 4 * (j * n + i);
      data[k] = Math.round(255 * Math.min(1, Math.max(0, r)));
      data[k + 1] = Math.round(255 * Math.min(1, Math.max(0, g)));
      data[k + 2] = Math.round(255 * Math.min(1, Math.max(0, b)));
      data[k + 3] = 255;
    }
  }
  const t = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** 2 × 2 twill carbon weave, 8 tows per tile; tiles every 25 mm (TEXTURE_SIZE_M). */
function carbonTexture(): DataTexture {
  const n = 256;
  const tows = 8;
  const px = n / tows;
  return texture(n, (i, j) => {
    const ti = Math.floor(i / px);
    const tj = Math.floor(j / px);
    // Twill: the warp is on top where (ti + tj) mod 4 < 2.
    const warp = (ti + tj) % 4 < 2;
    const along = warp ? (j % px) / px : (i % px) / px;
    const across = warp ? (i % px) / px : (j % px) / px;
    // Each tow is a rounded band: bright along its crown, dark at its edges.
    const crown = Math.sin(Math.PI * across);
    const fibres =
      0.92 + 0.08 * hash(warp ? i : j, warp ? Math.floor(j / 3) : Math.floor(i / 3), 5);
    const v = (0.05 + 0.13 * crown ** 1.5) * fibres * (0.96 + 0.04 * Math.sin(2 * Math.PI * along));
    return [v, v, v * 1.06];
  });
}

/** Woven glass cloth under resin: a faint plain weave over the base colour. */
function fiberglassTexture(): DataTexture {
  const n = 256;
  const px = 16;
  return texture(n, (i, j) => {
    const weave = (Math.floor(i / px) + Math.floor(j / px)) % 2 === 0;
    const across = weave ? (i % px) / px : (j % px) / px;
    const v = 0.9 + 0.07 * Math.sin(Math.PI * across) + 0.03 * hash(i, j, 9);
    return [v, v, v * 0.98];
  });
}

/**
 * Kraft paper tube: brown fibres with the spiral-wound seam. u wraps the
 * body; the seam is a helix one tile per turn.
 */
function kraftTexture(): DataTexture {
  const n = 256;
  return texture(n, (i, j) => {
    const fibre = 0.9 + 0.1 * hash(i, Math.floor(j / 2), 3) + 0.05 * hash(Math.floor(i / 7), j, 4);
    // Helix: seam where (i + j) wraps; a darker line two pixels wide.
    const seam = (i + j) % n < 2 ? 0.72 : 1;
    const base = [0.62, 0.47, 0.31] as const;
    return [base[0] * fibre * seam, base[1] * fibre * seam, base[2] * fibre * seam];
  });
}

/** Balsa: pale wood with grain along the chord. */
function balsaTexture(): DataTexture {
  const n = 256;
  return texture(n, (i, j) => {
    const grain =
      0.5 + 0.5 * Math.sin(j * 0.9 + 6 * Math.sin(i * 0.02 + j * 0.05) + hash(0, j, 2) * 3);
    const v = 0.88 + 0.08 * grain + 0.04 * hash(i, j, 7);
    return [0.86 * v, 0.74 * v, 0.55 * v];
  });
}

/** Metres covered by one tile of a finish texture along the body or the fin. */
export const TEXTURE_SIZE_M: Readonly<Record<'carbon' | 'fiberglass' | 'kraft' | 'balsa', number>> =
  {
    carbon: 0.025,
    fiberglass: 0.03,
    // One turn of the spiral per tile around; along the body the seam pitch is about 60 mm.
    kraft: 0.06,
    balsa: 0.08,
  };

const cache = new Map<string, DataTexture>();

function finishTexture(kind: 'carbon' | 'fiberglass' | 'kraft' | 'balsa'): DataTexture {
  let t = cache.get(kind);
  if (t === undefined) {
    t = {
      carbon: carbonTexture,
      fiberglass: fiberglassTexture,
      kraft: kraftTexture,
      balsa: balsaTexture,
    }[kind]();
    cache.set(kind, t);
  }
  return t;
}

/**
 * The material of a finish. `around` is the circumference (metres) of a
 * revolved part, so a texture keeps its real size round the body; omit it
 * for fins (whose uv is already metres).
 */
export function finishMaterial(f: Finish, around?: number): Material {
  const colour = new Color().setHex(f.colour, SRGBColorSpace);
  const m = new MeshPhysicalMaterial({ color: colour, side: DoubleSide });
  switch (f.kind) {
    case 'gloss':
      m.roughness = 0.4;
      m.clearcoat = 0.9;
      m.clearcoatRoughness = 0.1;
      break;
    case 'matte':
      m.roughness = 0.85;
      break;
    case 'plastic':
      m.roughness = 0.35;
      m.clearcoat = 0.3;
      break;
    case 'metal':
      m.roughness = 0.35;
      m.metalness = 0.9;
      break;
    case 'carbon':
    case 'fiberglass':
    case 'kraft':
    case 'balsa': {
      const base = finishTexture(f.kind);
      const t = base.clone();
      t.needsUpdate = true;
      const size = TEXTURE_SIZE_M[f.kind];
      // Revolved parts: u is a fraction of the circumference; fins: u is metres.
      t.repeat.set(
        around === undefined ? 1 / size : Math.max(1, Math.round(around / size)),
        1 / size,
      );
      m.map = t;
      m.roughness = f.kind === 'carbon' ? 0.3 : f.kind === 'fiberglass' ? 0.45 : 0.9;
      m.clearcoat = f.kind === 'carbon' ? 1 : f.kind === 'fiberglass' ? 0.6 : 0;
      m.clearcoatRoughness = 0.08;
      break;
    }
  }
  return m;
}
