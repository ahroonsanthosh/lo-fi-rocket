/**
 * The 3D rocket model from the design's component geometry (plan 0034).
 *
 * The outline of every axisymmetric external part is the physics profile
 * of GEO-1 and GEO-2 (`noseProfile`, `transitionProfile`), sampled along
 * x, so the drawn surface is the curve the mass and drag models integrate.
 * Body frame of docs/conventions.md: origin at the nose tip, x aft, fin 1
 * of a fin set in the +y half-plane, angles about +x from +y towards +z.
 * Everything is in metres; nothing is scaled.
 *
 * Drawing conventions that are not in the design (recorded here, no
 * physics): launch lugs and rail buttons have no angular position in the
 * design, so they are drawn at +z (90° from fin 1). Internal components
 * (inner tubes, rings, bulkheads, masses, packed parachutes) are not drawn.
 */
import { finOutline, noseProfile, transitionProfile, type Component } from '@lo-fi-rocket/physics';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  ShapeUtils,
  SRGBColorSpace,
  Vector2,
  type Material,
} from 'three';

/** An (x, r) outline point in the body frame, metres. */
export type OutlinePoint = readonly [number, number];

export interface RevolvedPart {
  readonly kind: 'revolved';
  readonly component: Component['kind'];
  readonly name: string;
  /** Closed outline (x, r), r ≥ 0, revolved about the part's axis. */
  readonly outline: readonly OutlinePoint[];
  /** Radial distance and angle of the part's own axis from the rocket axis (launch lugs); absent for coaxial parts. */
  readonly offset?: { readonly distance: number; readonly angle: number };
}

export interface FinPart {
  readonly kind: 'fin';
  readonly name: string;
  readonly finIndex: number;
  /**
   * Planform outline (x, r) in the fin's half-plane, from the root leading edge round to the root
   * trailing edge: a trapezoid's four corners, or an elliptical or freeform outline (plan 0059).
   */
  readonly corners: readonly OutlinePoint[];
  readonly thickness: number;
  /** Angle of the fin's half-plane about +x from +y towards +z. */
  readonly angle: number;
}

export interface ButtonPart {
  readonly kind: 'button';
  readonly name: string;
  readonly buttonIndex: number;
  /** Axial centre of the button. */
  readonly x: number;
  readonly bodyRadius: number;
  readonly height: number;
  readonly outerDiameter: number;
  readonly angle: number;
}

export type ModelPart = RevolvedPart | FinPart | ButtonPart;

export interface ModelExtent {
  /** Aft end of the outline from the nose tip, metres. */
  readonly length: number;
  /** Largest radial extent of any drawn part, metres. */
  readonly maxRadius: number;
}

/** Angle at which parts without an angular position in the design are drawn (+z). */
export const UNPLACED_PART_ANGLE = Math.PI / 2;

/** Outline samples along a curved profile. */
export const PROFILE_SAMPLES = 48;
/** Facets around the axis of a revolved part. */
export const REVOLUTION_SEGMENTS = 48;

function sampledOutline(x0: number, length: number, radius: (x: number) => number): OutlinePoint[] {
  const pts: OutlinePoint[] = [];
  for (let i = 0; i <= PROFILE_SAMPLES; i++) {
    // The last sample is the exact length (the division would round it).
    const x = i === PROFILE_SAMPLES ? length : (length * i) / PROFILE_SAMPLES;
    pts.push([x0 + x, radius(x)]);
  }
  return pts;
}

function cylinderOutline(x0: number, length: number, radius: number): OutlinePoint[] {
  return [
    [x0, 0],
    [x0, radius],
    [x0 + length, radius],
    [x0 + length, 0],
  ];
}

/**
 * The drawable parts of a design. A component the physics rejects (invalid
 * geometry while editing) is skipped; the editor reports it.
 */
export function rocketModelParts(
  components: readonly {
    readonly component: Component;
    readonly position: number;
    readonly name?: string;
  }[],
): ModelPart[] {
  const out: ModelPart[] = [];
  components.forEach((placed, i) => {
    const c = placed.component;
    const x0 = placed.position;
    const name = placed.name ?? `${c.kind} ${String(i + 1)}`;
    try {
      switch (c.kind) {
        case 'noseCone': {
          const p = noseProfile(c.shape, c.length, c.baseRadius, c.shapeParameter);
          const outline = sampledOutline(x0, p.length, (x) => p.radius(x));
          outline.push([x0 + p.length, 0]);
          out.push({ kind: 'revolved', component: c.kind, name, outline });
          if (c.aftShoulder !== undefined) {
            out.push({
              kind: 'revolved',
              component: c.kind,
              name: `${name} shoulder`,
              outline: cylinderOutline(x0 + c.length, c.aftShoulder.length, c.aftShoulder.radius),
            });
          }
          break;
        }
        case 'transition': {
          const p = transitionProfile(
            c.shape,
            c.length,
            c.foreRadius,
            c.aftRadius,
            c.shapeParameter,
          );
          const outline: OutlinePoint[] = [[x0, 0]];
          outline.push(...sampledOutline(x0, p.length, (x) => p.radius(x)));
          outline.push([x0 + p.length, 0]);
          out.push({ kind: 'revolved', component: c.kind, name, outline });
          break;
        }
        case 'bodyTube':
          out.push({
            kind: 'revolved',
            component: c.kind,
            name,
            outline: cylinderOutline(x0, c.length, c.outerRadius),
          });
          break;
        case 'launchLug':
          out.push({
            kind: 'revolved',
            component: c.kind,
            name,
            outline: cylinderOutline(x0, c.length, c.outerRadius),
            offset: { distance: c.radialOffset ?? 0, angle: UNPLACED_PART_ANGLE },
          });
          break;
        case 'finSet': {
          const n = Math.max(1, Math.round(c.count));
          const r: number = c.bodyRadius;
          const corners: FinPart['corners'] = finOutline(c).map(
            ([x, y]) => [x0 + x, r + y] as OutlinePoint,
          );
          for (let k = 0; k < n; k++) {
            out.push({
              kind: 'fin',
              name: `${name} fin ${String(k + 1)}`,
              finIndex: k,
              corners,
              thickness: c.thickness,
              angle: (2 * Math.PI * k) / n,
            });
          }
          break;
        }
        case 'railButton': {
          const n = Math.max(1, Math.round(c.count));
          const sep = c.separation ?? 0;
          for (let k = 0; k < n; k++) {
            out.push({
              kind: 'button',
              name: `${name} ${String(k + 1)}`,
              buttonIndex: k,
              x: x0 + k * sep,
              bodyRadius: c.bodyRadius,
              height: c.totalHeight,
              outerDiameter: c.outerDiameter,
              angle: UNPLACED_PART_ANGLE,
            });
          }
          break;
        }
        case 'innerTube':
        case 'centeringRing':
        case 'bulkhead':
        case 'massComponent':
        case 'parachute':
          // Internal: not drawn.
          break;
      }
    } catch {
      // Invalid geometry while editing: the editor and the stability panel report it.
    }
  });
  return out;
}

/** The aft end and the largest radius of the drawn parts. */
export function rocketModelExtent(parts: readonly ModelPart[]): ModelExtent {
  let length = 0;
  let maxRadius = 0;
  for (const p of parts) {
    switch (p.kind) {
      case 'revolved':
        for (const [x, r] of p.outline) {
          length = Math.max(length, x);
          maxRadius = Math.max(maxRadius, r + (p.offset?.distance ?? 0));
        }
        break;
      case 'fin':
        for (const [x, r] of p.corners) {
          length = Math.max(length, x);
          maxRadius = Math.max(maxRadius, r);
        }
        break;
      case 'button':
        length = Math.max(length, p.x + p.outerDiameter / 2);
        maxRadius = Math.max(maxRadius, p.bodyRadius + p.height);
        break;
    }
  }
  return { length, maxRadius };
}

/** Indexed triangle geometry of a closed outline revolved about the x axis. */
export function revolveOutline(outline: readonly OutlinePoint[], segments: number): BufferGeometry {
  const rings = outline.length;
  const positions = new Float32Array(rings * (segments + 1) * 3);
  let k = 0;
  for (const [x, r] of outline) {
    for (let j = 0; j <= segments; j++) {
      const phi = (2 * Math.PI * j) / segments;
      positions[k++] = x;
      positions[k++] = r * Math.cos(phi);
      positions[k++] = r * Math.sin(phi);
    }
  }
  const indices: number[] = [];
  const row = segments + 1;
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * row + j;
      const b = a + row;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/**
 * A flat plate of the given planform in the half-plane at `angle`, with
 * its thickness centred on the plane (the fin root sits on the body
 * surface at r = bodyRadius, as the physics places it).
 */
export function finGeometry(fin: FinPart): BufferGeometry {
  const u = [0, Math.cos(fin.angle), Math.sin(fin.angle)] as const; // radial direction
  const n = [0, -Math.sin(fin.angle), Math.cos(fin.angle)] as const; // plate normal
  const h = fin.thickness / 2;
  const m = fin.corners.length;
  const positions = new Float32Array(2 * m * 3);
  let k = 0;
  for (const side of [1, -1] as const) {
    for (const [x, r] of fin.corners) {
      positions[k++] = x + side * h * n[0];
      positions[k++] = r * u[1] + side * h * n[1];
      positions[k++] = r * u[2] + side * h * n[2];
    }
  }
  // Faces: the outline triangulated on each side (ear clipping, so concave freeform fins draw
  // right), and two triangles per outline edge round the rim.
  const faces = ShapeUtils.triangulateShape(
    fin.corners.map(([x, r]) => new Vector2(x, r)),
    [],
  );
  // Each triangle wound as the outline is (as the four-corner plate was), so that the normals of
  // the two sides point outward whatever order the triangulation returns.
  const at = (i: number): OutlinePoint => fin.corners[i] ?? [0, 0];
  const signed = (a: number, b: number, c: number): number => {
    const [ax, ar] = at(a);
    const [bx, br] = at(b);
    const [cx, cr] = at(c);
    return (bx - ax) * (cr - ar) - (cx - ax) * (br - ar);
  };
  let outline = 0;
  for (let i = 0; i < m; i++) {
    const [x0, r0] = at(i);
    const [x1, r1] = at((i + 1) % m);
    outline += x0 * r1 - x1 * r0;
  }
  const indices: number[] = [];
  for (const face of faces) {
    const [a = 0, b0 = 0, c0 = 0] = face;
    const flip = Math.sign(signed(a, b0, c0)) !== Math.sign(outline);
    const b = flip ? c0 : b0;
    const c = flip ? b0 : c0;
    indices.push(a, b, c, m + a, m + c, m + b);
  }
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    indices.push(i, m + i, m + j, i, m + j, j);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** A rail button: a short cylinder standing radially on the body at its angle. */
export function buttonGeometry(b: ButtonPart): BufferGeometry {
  const segments = 16;
  const rr = b.outerDiameter / 2;
  const positions = new Float32Array(2 * (segments + 1) * 3);
  let k = 0;
  const u = [0, Math.cos(b.angle), Math.sin(b.angle)] as const;
  const n = [0, -Math.sin(b.angle), Math.cos(b.angle)] as const;
  for (const h of [b.bodyRadius, b.bodyRadius + b.height]) {
    for (let j = 0; j <= segments; j++) {
      const phi = (2 * Math.PI * j) / segments;
      const dx = rr * Math.cos(phi);
      const dn = rr * Math.sin(phi);
      positions[k++] = b.x + dx;
      positions[k++] = h * u[1] + dn * n[1];
      positions[k++] = h * u[2] + dn * n[2];
    }
  }
  const indices: number[] = [];
  const row = segments + 1;
  for (let j = 0; j < segments; j++) {
    indices.push(j, row + j, j + 1, j + 1, row + j, row + j + 1);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** Paint colours, sRGB (drawing choices; the design stores no colours). */
export const PART_COLOURS: Readonly<Record<Component['kind'], number>> = {
  noseCone: 0xc4231d,
  bodyTube: 0xf1f0ea,
  transition: 0xc4231d,
  finSet: 0x1c2026,
  launchLug: 0xa7adb4,
  railButton: 0x2a2a2a,
  innerTube: 0x888888,
  centeringRing: 0x888888,
  bulkhead: 0x888888,
  massComponent: 0x888888,
  parachute: 0x888888,
};

/** Outline corners sharper than this turn are drawn as hard edges (a drawing choice). */
export const CREASE_ANGLE = (25 * Math.PI) / 180;

/**
 * The outline with every corner sharper than `CREASE_ANGLE` doubled, so
 * that the revolved surface gets separate normals on each side of the
 * corner (a crisp edge at a shoulder or a base) instead of a smeared one.
 * The points themselves are unchanged.
 */
export function creasedOutline(outline: readonly OutlinePoint[]): OutlinePoint[] {
  const out: OutlinePoint[] = [];
  outline.forEach((p, i) => {
    out.push(p);
    const prev = outline[i - 1];
    const next = outline[i + 1];
    if (prev === undefined || next === undefined) return;
    const ax = p[0] - prev[0];
    const ar = p[1] - prev[1];
    const bx = next[0] - p[0];
    const br = next[1] - p[1];
    const na = Math.hypot(ax, ar);
    const nb = Math.hypot(bx, br);
    if (na === 0 || nb === 0) return;
    const cos = (ax * bx + ar * br) / (na * nb);
    if (cos < Math.cos(CREASE_ANGLE)) out.push(p);
  });
  return out;
}

export interface RocketObject {
  /** Origin at the nose tip, x aft (body frame). */
  readonly group: Group;
  readonly parts: readonly ModelPart[];
  readonly extent: ModelExtent;
}

/** The three.js object of the model, built from the parts; origin at the nose tip. */
export function buildRocketObject(parts: readonly ModelPart[]): RocketObject {
  const group = new Group();
  group.name = 'rocket-body';
  const materials = new Map<number, Material>();
  const material = (colour: number, metal = false): Material => {
    let m = materials.get(colour);
    if (m === undefined) {
      // Gloss paint: a clear coat over a smooth base; bare metal for lugs.
      m = new MeshPhysicalMaterial({
        color: new Color().setHex(colour, SRGBColorSpace),
        metalness: metal ? 0.85 : 0,
        roughness: metal ? 0.35 : 0.42,
        clearcoat: metal ? 0 : 0.9,
        clearcoatRoughness: 0.12,
        side: DoubleSide,
      });
      materials.set(colour, m);
    }
    return m;
  };
  for (const p of parts) {
    let mesh: Mesh;
    switch (p.kind) {
      case 'revolved': {
        mesh = new Mesh(
          revolveOutline(creasedOutline(p.outline), REVOLUTION_SEGMENTS),
          material(PART_COLOURS[p.component], p.component === 'launchLug'),
        );
        if (p.offset !== undefined) {
          mesh.position.set(
            0,
            p.offset.distance * Math.cos(p.offset.angle),
            p.offset.distance * Math.sin(p.offset.angle),
          );
        }
        break;
      }
      case 'fin': {
        // Flat faces: each triangle its own normal.
        const g = finGeometry(p).toNonIndexed();
        g.computeVertexNormals();
        mesh = new Mesh(g, material(PART_COLOURS.finSet));
        break;
      }
      case 'button':
        mesh = new Mesh(buttonGeometry(p), material(PART_COLOURS.railButton));
        break;
    }
    mesh.name = p.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return { group, parts, extent: rocketModelExtent(parts) };
}
