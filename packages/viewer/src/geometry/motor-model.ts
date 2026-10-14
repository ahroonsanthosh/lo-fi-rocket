/**
 * The motor drawn to its data (plan 3d-0002, D-3D-4): one case per motor of
 * the mount (a cluster's offsets included), its diameter and length from the
 * motor definition and its aft end where the design puts it
 * (`designMotor`: the mount's aft end plus the overhang). The nozzle and
 * case styles are drawing choices from the manufacturer: single-use motors
 * of Estes, Quest and Apogee have a paper case and a clay nozzle; others
 * (reloadable and composite) an aluminium case with a graphite nozzle.
 * Body frame (x aft from the nose tip).
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
} from 'three';
import { revolveOutline, type OutlinePoint } from './rocket-model.js';

export interface MotorInputs {
  readonly diameter: number;
  readonly length: number;
  /** x of the motor's aft end in the body frame, metres. */
  readonly aftEnd: number;
  /** Each motor's axis offset from the rocket axis (body y, z), metres; one entry (0, 0) for a single motor. */
  readonly offsets: readonly { readonly y: number; readonly z: number }[];
  readonly manufacturer: string;
}

export type MotorStyle = 'paper' | 'reload';

/** The case and nozzle style for a manufacturer (a drawing choice). */
export function motorStyle(manufacturer: string): MotorStyle {
  return /estes|quest|apogee|klima|centuri/i.test(manufacturer) ? 'paper' : 'reload';
}

export interface MotorNozzle {
  /** Centre of the nozzle exit in the body frame, metres. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Exit radius, metres. */
  readonly radius: number;
}

/**
 * The nozzle exits of the motors: on each motor's axis, at the aft end plus
 * the nozzle's protrusion (reload: 0.2 d; paper: flush), radius 0.3 d (a
 * drawing proportion).
 */
export function motorNozzles(m: MotorInputs): MotorNozzle[] {
  const d = m.diameter;
  const protrude = motorStyle(m.manufacturer) === 'reload' ? 0.2 * d : 0;
  return m.offsets.map((o) => ({ x: m.aftEnd + protrude, y: o.y, z: o.z, radius: 0.3 * d }));
}

/** Revolved outline of a motor case's outer wall from its forward end to its aft end (x local, 0 = aft end). */
export function caseOutline(m: MotorInputs): OutlinePoint[] {
  const r = m.diameter / 2;
  return [
    [-m.length, 0],
    [-m.length, r],
    [0, r],
  ];
}

/** Revolved outline of the aft closure and nozzle (x local, 0 = the case's aft end). */
export function nozzleOutline(m: MotorInputs): OutlinePoint[] {
  const d = m.diameter;
  if (motorStyle(m.manufacturer) === 'paper') {
    // Clay nozzle flush with the case end, a conical recess to the throat.
    return [
      [0, 0.5 * d],
      [0, 0.3 * d],
      [-0.12 * d, 0.1 * d],
      [-0.12 * d, 0],
    ];
  }
  // Aluminium aft closure with a chamfer, then the graphite nozzle's exit cone to the throat.
  return [
    [0, 0.5 * d],
    [0.06 * d, 0.46 * d],
    [0.1 * d, 0.36 * d],
    [0.2 * d, 0.34 * d],
    [0.2 * d, 0.3 * d],
    [0.06 * d, 0.1 * d],
    [0.06 * d, 0],
  ];
}

function material(hex: number, metal: number, rough: number): MeshStandardMaterial {
  return new MeshPhysicalMaterial({
    color: new Color().setHex(hex, SRGBColorSpace),
    metalness: metal,
    roughness: rough,
    side: DoubleSide,
  });
}

/** The motors as meshes, in the body frame. */
export function buildMotors(m: MotorInputs): Group {
  const group = new Group();
  group.name = 'motors';
  const paper = motorStyle(m.manufacturer) === 'paper';
  const caseMat = paper ? material(0xb08a5c, 0, 0.9) : material(0xc9ccd1, 0.9, 0.32);
  const nozzleMat = paper ? material(0x9c9a94, 0, 0.95) : material(0x2b2b2d, 0.2, 0.6);
  const caseGeo = revolveOutline(caseOutline(m), 32);
  const nozzleGeo = revolveOutline(nozzleOutline(m), 32);
  for (const o of m.offsets) {
    const c = new Mesh(caseGeo, caseMat);
    c.position.set(m.aftEnd, o.y, o.z);
    c.name = 'motor-case';
    c.castShadow = true;
    const n = new Mesh(nozzleGeo, nozzleMat);
    n.position.set(m.aftEnd, o.y, o.z);
    n.name = 'motor-nozzle';
    group.add(c, n);
  }
  return group;
}

/**
 * Open the aft end of the body for the motor: a ring from the body's aft
 * radius in to the motor mount (the centering ring, drawn in the body's
 * finish), and the mount tube's inner wall forward to the motor's aft end
 * when the motor sits inside (dark). Returns the replacement outline end and
 * a wall mesh, or undefined when the motor does not reach the body's aft face.
 */
export function mountWall(
  bodyAftX: number,
  mountRadius: number,
  motorAftX: number,
): BufferGeometry | undefined {
  if (!(mountRadius > 0)) return undefined;
  const depth = Math.max(0, bodyAftX - motorAftX);
  if (depth <= 0) return undefined;
  const g = revolveOutline(
    [
      [bodyAftX, mountRadius],
      [bodyAftX - depth, mountRadius],
    ],
    32,
  );
  // Inside wall only.
  g.setAttribute(
    'uv',
    new BufferAttribute(new Float32Array(2 * g.getAttribute('position').count), 2),
  );
  return g;
}
