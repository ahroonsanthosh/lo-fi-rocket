/**
 * The launcher drawn from the design (plan 3d-0002, D-3D-4), replacing the
 * generic bar of 3d-0001. The rail's direction and length are the stored
 * inputs, as before; what is drawn along them follows the rocket's launch
 * guides:
 *
 * - a launch lug → a steel launch rod through the lug, its diameter 90 % of
 *   the lug's bore (rod sizes are not in the design);
 * - rail buttons → an aluminium T-slot rail, 1010 (25.4 mm) for buttons up
 *   to 12 mm across and 1515 (38.1 mm) above (the common pairings), its face
 *   just under the buttons' flange;
 * - neither → a 1010 rail beside the body.
 *
 * Plus a blast deflector, a tripod, and igniter leads from the nozzle to the
 * ground that stay on the pad once the rocket has left. Scenery only.
 */
import {
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Path,
  Shape,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  BoxGeometry,
} from 'three';

export type GuideKind = 'rod' | 'rail-1010' | 'rail-1515';

export interface LaunchGuide {
  readonly kind: GuideKind;
  /** Rod diameter, or rail size (the square's side), metres. */
  readonly size: number;
  /** Distance from the rocket axis to the guide's centre line, metres. */
  readonly offset: number;
}

/** 1010 and 1515 rail sides, metres (1.0 and 1.5 inches). */
export const RAIL_1010 = 0.0254;
export const RAIL_1515 = 0.0381;

/**
 * The guide for a design: a rod through the lug when the design has one,
 * otherwise a rail sized from the buttons (or a 1010 when it has neither).
 * `lug`: the lug's bore radius and its axis's distance from the rocket axis;
 * `buttons`: the buttons' outer diameter and base height; `bodyRadius` metres.
 */
export function launchGuide(
  bodyRadius: number,
  lug: { readonly bore: number; readonly offset: number } | undefined,
  buttons: { readonly outerDiameter: number; readonly baseHeight: number } | undefined,
): LaunchGuide {
  if (lug !== undefined && lug.bore > 0) {
    return { kind: 'rod', size: 2 * lug.bore * 0.9, offset: lug.offset };
  }
  if (buttons !== undefined) {
    const big = buttons.outerDiameter > 0.012;
    const size = big ? RAIL_1515 : RAIL_1010;
    // The rail's face just above the buttons' base, the flange inside its slot.
    return {
      kind: big ? 'rail-1515' : 'rail-1010',
      size,
      offset: bodyRadius + buttons.baseHeight + 0.0005 + size / 2,
    };
  }
  return { kind: 'rail-1010', size: RAIL_1010, offset: bodyRadius + 0.004 + RAIL_1010 / 2 };
}

/**
 * The T-slot extrusion's cross-section for a rail of side `a`: a square with
 * a slot on each face (opening 0.256 a, slot 0.43 a wide, lip 0.08 a thick,
 * 0.27 a deep: the 80/20 1010 proportions, a drawing approximation) and the
 * central bore.
 */
export function railProfile(a: number): Shape {
  const h = a / 2;
  const open = 0.128 * a; // half the opening
  const wide = 0.215 * a; // half the slot's width inside
  const lip = 0.08 * a;
  const deep = 0.27 * a;
  const s = new Shape();
  // Walk round the square anticlockwise, cutting each face's slot.
  const corners: [number, number][] = [
    [h, -h],
    [h, h],
    [-h, h],
    [-h, -h],
  ];
  s.moveTo(-h, -h);
  for (let k = 0; k < 4; k++) {
    const [cx, cy] = corners[k] ?? [0, 0];
    const [px, py] = corners[(k + 3) % 4] ?? [0, 0];
    // Face from (px, py) to (cx, cy); outward normal and tangent.
    const tx = Math.sign(cx - px);
    const ty = Math.sign(cy - py);
    const nx = ty;
    const ny = -tx;
    const mx = (px + cx) / 2;
    const my = (py + cy) / 2;
    const at = (t: number, d: number): [number, number] => [
      mx + tx * t - nx * d,
      my + ty * t - ny * d,
    ];
    const pts: [number, number][] = [
      at(-open, 0),
      at(-open, lip),
      at(-wide, lip),
      at(-wide, deep),
      at(wide, deep),
      at(wide, lip),
      at(open, lip),
      at(open, 0),
      [cx, cy],
    ];
    for (const [x, y] of pts) s.lineTo(x, y);
  }
  const bore = new Path();
  bore.absarc(0, 0, 0.1 * a, 0, 2 * Math.PI, true);
  s.holes.push(bore);
  return s;
}

export interface LauncherInputs {
  readonly groundZ: number;
  /** Unit vector along the rail, upwards. */
  readonly direction: Vector3;
  /** Unit vector from the rocket axis towards the guide, perpendicular to the rail. */
  readonly side: Vector3;
  readonly guide: LaunchGuide;
  readonly railLength: number;
  readonly rocketLength: number;
  /** Nozzle exits at rest, world frame, for the igniter leads (none without a motor). */
  readonly nozzles: readonly Vector3[];
  /** Top of the blast deflector, a little under the nozzle, metres. */
  readonly deflectorZ: number;
}

function mat(hex: number, metal: number, rough: number): MeshStandardMaterial {
  return new MeshPhysicalMaterial({
    color: new Color().setHex(hex, SRGBColorSpace),
    metalness: metal,
    roughness: rough,
  });
}

/**
 * Where the tripod stands on the ground: its legs meet at `anchor` (under the
 * guide) and their feet are `spread` from it, at the angles `legAngles`
 * (radians from +x about +z). The drawn launcher fits inside this circle.
 */
export interface LauncherFootprint {
  readonly anchor: { readonly x: number; readonly y: number };
  readonly spread: number;
  readonly legAngles: readonly number[];
}

/** The tripod's footprint for a rocket `rocketLength` long, its guide `offset` along `side` (drawing choices). */
export function launcherFootprint(
  rocketLength: number,
  side: Vector3,
  offset: number,
): LauncherFootprint {
  return {
    anchor: { x: side.x * offset, y: side.y * offset },
    spread: Math.max(0.35, 0.45 * rocketLength),
    legAngles: [0, 1, 2].map((k) => (2 * Math.PI * k) / 3 + 0.4),
  };
}

export interface Launcher {
  readonly group: Group;
  readonly footprint: LauncherFootprint;
  /** The igniter leads, hung from the nozzle at rest; the scene drops them after liftoff. */
  readonly leads: Group;
  readonly fallenLeads: Group;
}

export function buildLauncher(inputs: LauncherInputs): Launcher {
  const group = new Group();
  group.name = 'launch-pad';
  const d = inputs.direction;
  const g = inputs.guide;
  const L = inputs.rocketLength;
  const aluminium = mat(0xc3c7cc, 0.95, 0.38);
  const steel = mat(0x8a9097, 0.9, 0.3);
  const dark = mat(0x3b3e42, 0.6, 0.65);

  // The guide: from where its line meets the ground to the rail length.
  const s0 = d.z > 1e-6 ? inputs.groundZ / d.z - 0.02 : -0.02;
  const s1 = inputs.railLength;
  const length = Math.max(1e-3, s1 - s0);
  let guide: Mesh;
  if (g.kind === 'rod') {
    guide = new Mesh(new CylinderGeometry(g.size / 2, g.size / 2, length, 16), steel);
    guide.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), d);
  } else {
    const geo = new ExtrudeGeometry(railProfile(g.size), {
      depth: length,
      bevelEnabled: false,
      steps: 1,
    });
    geo.translate(0, 0, -length / 2);
    guide = new Mesh(geo, aluminium);
    // Extruded along local z: turn local z to the rail direction and a face towards the rocket.
    const zAxis = d.clone();
    const yAxis = inputs.side.clone().negate();
    const xAxis = new Vector3().crossVectors(yAxis, zAxis).normalize();
    guide.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(xAxis, yAxis, zAxis));
  }
  guide.name = 'launch-rail';
  guide.position
    .copy(d.clone().multiplyScalar((s0 + s1) / 2))
    .addScaledVector(inputs.side, g.offset);
  guide.castShadow = true;
  guide.receiveShadow = true;
  group.add(guide);

  // Blast deflector: a steel plate just under the nozzle, centred under the rocket.
  const plateSize = Math.max(0.18, 0.3 * L);
  const plate = new Mesh(new BoxGeometry(plateSize, plateSize, 0.004), dark);
  plate.position.set(0, 0, inputs.deflectorZ - 0.002);
  plate.castShadow = true;
  plate.receiveShadow = true;
  group.add(plate);

  // Tripod: three legs from the launcher's base (the deflector's level) to the ground.
  const footprint = launcherFootprint(L, inputs.side, g.offset);
  const anchor = new Vector3(
    footprint.anchor.x,
    footprint.anchor.y,
    inputs.deflectorZ - 0.01 + inputs.side.z * g.offset,
  );
  const spread = footprint.spread;
  const legR = Math.max(0.004, 0.25 * g.size);
  for (const a of footprint.legAngles) {
    const foot = new Vector3(
      anchor.x + spread * Math.cos(a),
      anchor.y + spread * Math.sin(a),
      inputs.groundZ,
    );
    const dir = new Vector3().subVectors(anchor, foot);
    const legLength = dir.length();
    const leg = new Mesh(new CylinderGeometry(legR, legR, legLength, 10), aluminium);
    leg.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize());
    leg.position.copy(foot).addScaledVector(dir, legLength / 2);
    leg.castShadow = true;
    group.add(leg);
  }

  // Igniter leads: red and black wires from each nozzle down to a clip on the ground.
  const leads = new Group();
  leads.name = 'igniter-leads';
  const fallen = new Group();
  fallen.name = 'igniter-leads-fallen';
  fallen.visible = false;
  const wireR = 0.0012;
  inputs.nozzles.forEach((n, i) => {
    for (const [k, colour] of [
      [0, 0xc0261c],
      [1, 0x111111],
    ] as const) {
      const sideways = new Vector3(
        Math.cos(k * Math.PI + i),
        Math.sin(k * Math.PI + i),
        0,
      ).multiplyScalar(0.15 + 0.1 * L);
      const ground = new Vector3(
        n.x + sideways.x * 2,
        n.y + sideways.y * 2,
        inputs.groundZ + 0.005,
      );
      const mid = new Vector3(
        (n.x + ground.x) / 2 + sideways.x * 0.3,
        (n.y + ground.y) / 2 + sideways.y * 0.3,
        (n.z + ground.z) / 2 - 0.03,
      );
      const hanging = new CatmullRomCurve3([n.clone(), mid, ground]);
      const wireMat = mat(colour, 0, 0.5);
      leads.add(new Mesh(new TubeGeometry(hanging, 24, wireR, 6), wireMat));
      // After liftoff the leads lie on the deflector.
      const onPlate = new CatmullRomCurve3([
        new Vector3(sideways.x * 0.2, sideways.y * 0.2, inputs.deflectorZ + 0.002),
        new Vector3(sideways.x * 0.6, sideways.y * 0.6, inputs.deflectorZ + 0.002),
        ground,
      ]);
      fallen.add(new Mesh(new TubeGeometry(onPlate, 24, wireR, 6), wireMat));
    }
  });
  group.add(leads, fallen);
  return { group, footprint, leads, fallenLeads: fallen };
}
