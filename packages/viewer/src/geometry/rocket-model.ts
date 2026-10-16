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
import {
  finOutline,
  noseProfile,
  transitionProfile,
  type Component,
  type FinCrossSection,
} from '@lo-fi-rocket/physics';
import { BufferAttribute, BufferGeometry, Group, Mesh, ShapeUtils, Vector2 } from 'three';
import { finSectionGeometry } from './fin-section.js';
import { finishMaterial, PAINT_SCHEMES, type PaintSchemeId } from './finish.js';
import { buildMotors, mountWall, type MotorInputs } from './motor-model.js';

/** An (x, r) outline point in the body frame, metres. */
export type OutlinePoint = readonly [number, number];

export interface RevolvedPart {
  /** A pod set's copy: the part moved off the rocket's axis by this (issue #96). */
  readonly shift?: PartShift;
  readonly kind: 'revolved';
  readonly component: Component['kind'];
  readonly name: string;
  /** Closed outline (x, r), r ≥ 0, revolved about the part's axis. */
  readonly outline: readonly OutlinePoint[];
  /** Radial distance and angle of the part's own axis from the rocket axis (launch lugs); absent for coaxial parts. */
  readonly offset?: { readonly distance: number; readonly angle: number };
  /** Inner radius of a hollow part (a launch lug's bore), metres; drawn as a tube. */
  readonly bore?: number;
}

export interface FinPart {
  /** A pod set's copy: the part moved off the rocket's axis by this (issue #96). */
  readonly shift?: PartShift;
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
  /** The design's cross-section ('square' when the design gives none). */
  readonly section?: FinCrossSection;
}

export interface ButtonPart {
  /** A pod set's copy: the part moved off the rocket's axis by this (issue #96). */
  readonly shift?: PartShift;
  readonly kind: 'button';
  readonly name: string;
  readonly buttonIndex: number;
  /** Axial centre of the button. */
  readonly x: number;
  readonly bodyRadius: number;
  readonly height: number;
  readonly outerDiameter: number;
  readonly angle: number;
  /** Shaft diameter, base and flange heights (the design's), metres; drawn turned when given. */
  readonly innerDiameter?: number;
  readonly baseHeight?: number;
  readonly flangeHeight?: number;
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
    /** A pod set's part (plan 0070): drawn `count` times round the axis, `radialOffset` out. */
    readonly instances?: { readonly count: number; readonly radialOffset: number };
  }[],
): ModelPart[] {
  const out: ModelPart[] = [];
  components.forEach((placed, i) => {
    const c = placed.component;
    const x0 = placed.position;
    const name = placed.name ?? `${c.kind} ${String(i + 1)}`;
    const before = out.length;
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
            bore: Math.max(0, c.outerRadius - c.wallThickness),
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
              section: c.crossSection ?? 'square',
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
              innerDiameter: c.innerDiameter,
              baseHeight: c.baseHeight,
              flangeHeight: c.flangeHeight,
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
    // Pod sets (issue #96): the part's drawing repeated round the rocket's axis, pod k's axis at
    // 2πk/count from +y towards +z, radialOffset out (the first pod's angle is not in the
    // design; the simulation is axisymmetric).
    const pod = placed.instances;
    if (pod !== undefined && pod.count >= 1) {
      const drawn = out.splice(before);
      const n = Math.round(pod.count);
      for (let k = 0; k < n; k++) {
        const a = (2 * Math.PI * k) / n;
        const shift = { y: pod.radialOffset * Math.cos(a), z: pod.radialOffset * Math.sin(a) };
        for (const part of drawn)
          out.push({ ...part, name: `${part.name} (pod ${String(k + 1)})`, shift });
      }
    }
  });
  return out;
}

/** A pod part's displacement from the rocket axis (body y, z), metres. */
export interface PartShift {
  readonly y: number;
  readonly z: number;
}

function shiftOf(p: ModelPart): number {
  return p.shift === undefined ? 0 : Math.hypot(p.shift.y, p.shift.z);
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
          maxRadius = Math.max(maxRadius, r + (p.offset?.distance ?? 0) + shiftOf(p));
        }
        break;
      case 'fin':
        for (const [x, r] of p.corners) {
          length = Math.max(length, x);
          maxRadius = Math.max(maxRadius, r + shiftOf(p));
        }
        break;
      case 'button':
        length = Math.max(length, p.x + p.outerDiameter / 2);
        maxRadius = Math.max(maxRadius, p.bodyRadius + p.height + shiftOf(p));
        break;
    }
  }
  return { length, maxRadius };
}

/** Indexed triangle geometry of a closed outline revolved about the x axis. */
export function revolveOutline(outline: readonly OutlinePoint[], segments: number): BufferGeometry {
  const rings = outline.length;
  const positions = new Float32Array(rings * (segments + 1) * 3);
  // Texture coordinates: u round the axis (0 to 1), v along it in metres (finish.ts).
  const uvs = new Float32Array(rings * (segments + 1) * 2);
  let k = 0;
  let t = 0;
  for (const [x, r] of outline) {
    for (let j = 0; j <= segments; j++) {
      const phi = (2 * Math.PI * j) / segments;
      positions[k++] = x;
      positions[k++] = r * Math.cos(phi);
      positions[k++] = r * Math.sin(phi);
      uvs[t++] = j / segments;
      uvs[t++] = x;
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
  g.setAttribute('uv', new BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/**
 * A rail button turned to the design's dimensions: base, shaft and flange
 * stacked radially on the body surface at the button's angle (the design's
 * RailButtonComponent). Without them, the plain cylinder of `buttonGeometry`.
 */
export function railButtonGeometry(b: ButtonPart): BufferGeometry {
  const ro = b.outerDiameter / 2;
  const ri = (b.innerDiameter ?? b.outerDiameter) / 2;
  const base = b.baseHeight ?? 0;
  const flange = b.flangeHeight ?? 0;
  const top = b.height;
  // Profile along the button's own axis a (from the body surface outward), radius about it.
  const profile: OutlinePoint[] = [
    [-0.001, 0],
    [-0.001, ro],
    [base, ro],
    [base, ri],
    [Math.max(base, top - flange), ri],
    [Math.max(base, top - flange), ro],
    [top, ro],
    [top, 0],
  ];
  const g = revolveOutline(creasedOutline(profile), 24);
  // Local (a, p, q) about local x → body frame: x = b.x + p, radial = bodyRadius + a, normal = q.
  const u = [Math.cos(b.angle), Math.sin(b.angle)] as const;
  const n = [-Math.sin(b.angle), Math.cos(b.angle)] as const;
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const a = pos.getX(i);
    const p = pos.getY(i);
    const q = pos.getZ(i);
    const radial = b.bodyRadius + a;
    pos.setXYZ(i, b.x + p, radial * u[0] + q * n[0], radial * u[1] + q * n[1]);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** A hollow tube's closed outline (a launch lug with its bore). */
export function tubeOutline(outline: readonly OutlinePoint[], bore: number): OutlinePoint[] {
  const xs = outline.map(([x]) => x);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const ro = Math.max(...outline.map(([, r]) => r));
  return [
    [x0, bore],
    [x0, ro],
    [x1, ro],
    [x1, bore],
    [x0, bore],
  ];
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

export interface RocketLook {
  /** The paint scheme (finish.ts); the design stores none. */
  readonly scheme?: PaintSchemeId;
  /** The motors to draw, from the design (motor-model.ts). */
  readonly motor?: MotorInputs;
}

/** The three.js object of the model, built from the parts; origin at the nose tip. */
export function buildRocketObject(
  parts: readonly ModelPart[],
  look: RocketLook = {},
): RocketObject {
  const group = new Group();
  group.name = 'rocket-body';
  const scheme = PAINT_SCHEMES[look.scheme ?? 'classic'];
  const metal = finishMaterial({ kind: 'metal', colour: 0xa7adb4 });
  const button = finishMaterial({ kind: 'plastic', colour: 0x1d1d1f });
  const bodyRadius = parts.reduce(
    (r, p) =>
      p.kind === 'revolved' && p.offset === undefined && p.shift === undefined
        ? Math.max(r, ...p.outline.map(([, pr]) => pr))
        : r,
    0,
  );
  const around = 2 * Math.PI * Math.max(bodyRadius, 1e-3);
  const noseMat = finishMaterial(scheme.nose, around);
  const bodyMat = finishMaterial(scheme.body, around);
  const finMat = finishMaterial(scheme.fins);
  // A single motor on the axis: the aft face of the aftmost body part opens to the motor mount.
  const motor = look.motor;
  const axis = motor?.offsets.length === 1 ? motor.offsets[0] : undefined;
  const onAxis = axis !== undefined && Math.hypot(axis.y, axis.z) < 1e-9 ? motor : undefined;
  const aftX = Math.max(
    0,
    ...parts.flatMap((p) =>
      p.kind === 'revolved' && p.offset === undefined && p.shift === undefined
        ? p.outline.map(([x]) => x)
        : [],
    ),
  );
  const mountRadius = motor === undefined ? 0 : 1.04 * (motor.diameter / 2);
  for (const p of parts) {
    let mesh: Mesh;
    switch (p.kind) {
      case 'revolved': {
        let outline: readonly OutlinePoint[] = p.outline;
        const last = outline[outline.length - 1];
        const opens =
          onAxis !== undefined &&
          p.offset === undefined &&
          p.shift === undefined &&
          last !== undefined &&
          Math.abs(last[0] - aftX) < 1e-9 &&
          last[1] === 0;
        if (opens && mountRadius > 0) outline = [...outline.slice(0, -1), [aftX, mountRadius]];
        if (p.bore !== undefined && p.bore > 0) outline = tubeOutline(outline, p.bore);
        const mat =
          p.component === 'launchLug'
            ? metal
            : p.component === 'noseCone' || p.component === 'transition'
              ? noseMat
              : bodyMat;
        mesh = new Mesh(revolveOutline(creasedOutline(outline), REVOLUTION_SEGMENTS), mat);
        if (p.offset !== undefined) {
          mesh.position.set(
            0,
            p.offset.distance * Math.cos(p.offset.angle),
            p.offset.distance * Math.sin(p.offset.angle),
          );
        }
        if (opens) {
          // The mount tube's inner wall down to a recessed motor.
          const wall = mountWall(aftX, mountRadius, onAxis.aftEnd);
          if (wall !== undefined) {
            const w = new Mesh(wall, finishMaterial({ kind: 'matte', colour: 0x2a2622 }));
            w.name = `${p.name} motor mount`;
            mesh.add(w);
          }
        }
        break;
      }
      case 'fin': {
        const section = p.section ?? 'square';
        // Square: the flat plate with sharp edges, each triangle its own normal; others lofted.
        const g =
          section === 'square' ? finGeometry(p).toNonIndexed() : finSectionGeometry(p, section);
        if (section === 'square') {
          g.computeVertexNormals();
          const pos = g.getAttribute('position');
          const uv = new Float32Array(2 * pos.count);
          for (let i = 0; i < pos.count; i++) {
            uv[2 * i] = pos.getX(i);
            uv[2 * i + 1] = Math.hypot(pos.getY(i), pos.getZ(i));
          }
          g.setAttribute('uv', new BufferAttribute(uv, 2));
        }
        mesh = new Mesh(g, finMat);
        break;
      }
      case 'button':
        mesh = new Mesh(
          p.innerDiameter !== undefined ? railButtonGeometry(p) : buttonGeometry(p),
          button,
        );
        break;
    }
    mesh.name = p.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (p.shift !== undefined) {
      mesh.position.y += p.shift.y;
      mesh.position.z += p.shift.z;
    }
    group.add(mesh);
  }
  if (motor !== undefined) group.add(buildMotors(motor));
  return { group, parts, extent: rocketModelExtent(parts) };
}
