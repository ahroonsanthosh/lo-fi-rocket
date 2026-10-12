/**
 * Aerodynamic forces and moments at angle of attack (plan 0010 part A,
 * AERO-1 to AERO-5). Body frame of docs/conventions.md, moments about the CG.
 *
 * Sources: Niskanen (2009) §3.1 pp. 15 to 17 (force pair normal force and
 * axial drag; C_N = C_Nα α with C_Nα a function of α, eq. 3.8), §3.2.1
 * pp. 22 to 25 (body C_Nα with sin α/α, eq. 3.19; body lift eqs. 3.26, 3.27;
 * moment sum 3.29), §3.2.2 (fins), §3.2.3 pp. 35 to 36 (pitch damping,
 * eqs. 3.57 to 3.60), §3.3.2 pp. 38 to 39 (roll damping, eqs. 3.69, 3.70),
 * §3.4.7 p. 53 (axial drag at angle of attack, DRAG-14).
 */
import { axialDragScaling } from '../drag/drag.js';
import { InvalidInputError, NotImplementedError } from '../errors.js';
import type { PlacedComponent } from '../geometry/assembly.js';
import type { TrapezoidFinSetComponent } from '../geometry/components.js';
import { noseProfile, transitionProfile, type Profile } from '../geometry/profiles.js';
import { DEFAULT_PANELS, integrate } from '../geometry/revolution.js';
import { finiteResult } from '../numerics/finite.js';
import {
  finSetTerm,
  maximumBodyDiameter,
  noseConeTerm,
  prandtlBeta,
  transitionTerm,
  type AerodynamicTerm,
} from '../stability/barrowman.js';
import {
  metres,
  squareMetres,
  type Dimensionless,
  type Mach,
  type Metres,
  type Pascals,
  type Radians,
} from '../units/si.js';
import type { Vec3 } from './vector.js';

/** K ≈ 1.1 of eq. (3.26), p. 24 (Hoerner p. 3-11). */
const BODY_LIFT_K = 1.1;

export interface AeroModeOptions {
  /** Niskanen eq. (3.54) roll reduction on (displayed) or off (OpenRocket-equivalent, D-016). */
  readonly finRollReduction: boolean;
  readonly referenceDiameter?: Metres;
}

export interface AeroInputs {
  readonly components: readonly PlacedComponent[];
  readonly mach: Mach;
  readonly angleOfAttack: Radians;
  /** Direction of the lateral airflow in the body (y, z) plane from +y (DYN-7); the roll angle of BAR-7. */
  readonly lateralAirflowAngle: Radians;
  /** Sign of the axial airspeed component in the body frame (negative when flying nose first). */
  readonly axialAirspeedSign: -1 | 0 | 1;
  readonly dynamicPressure: Pascals;
  /** Airspeed magnitude, m/s. */
  readonly airspeed: number;
  /** Air density, kg/m³ (for the damping couples, which the thesis writes in terms of ρ). */
  readonly density: number;
  /** Centre of gravity from the nose tip. */
  readonly cg: Metres;
  /** Angular velocity in the body frame, rad/s. */
  readonly angularVelocityBody: Vec3;
  /** Zero-angle drag coefficient from the drag model (DRAG-13). */
  readonly cd0: Dimensionless;
  readonly options: AeroModeOptions;
}

export interface AeroContribution {
  readonly index: number;
  readonly source: string;
  /** C_N of this term at the current α (referred to A_ref). */
  readonly cn: number;
  /** CP of this term from the nose tip. */
  readonly cp: number;
}

export interface AeroResult {
  /** Total force in the body frame, N. */
  readonly forceBody: Vec3;
  /** Total moment about the CG in the body frame, N·m. */
  readonly momentBody: Vec3;
  /** Normal force coefficient at α (AERO-1) and the CP of the α-dependent terms (AERO-2). */
  readonly cn: number;
  readonly cnAlpha: number;
  readonly cp: Metres;
  readonly normalForce: number;
  readonly axialForce: number;
  readonly axialDragCoefficient: number;
  readonly pitchDampingMoment: number;
  readonly rollDampingMoment: number;
  readonly contributions: readonly AeroContribution[];
  readonly warnings: readonly string[];
}

/** Planform area ∫ 2 r dx and its centroid (eq. 3.27) for a profile. */
function planform(profile: Profile): { area: number; centroid: number } {
  const area = integrate((x) => 2 * profile.radius(x), profile.length, DEFAULT_PANELS);
  const moment = integrate((x) => 2 * x * profile.radius(x), profile.length, DEFAULT_PANELS);
  return { area, centroid: area > 0 ? moment / area : 0 };
}

/** Mean radius of a profile over [a, b] ⊂ [0, L]. */
function meanRadius(profile: Profile, a: number, b: number): number {
  if (b <= a) return 0;
  const n = 64;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += profile.radius(a + ((i + 0.5) / n) * (b - a));
  return sum / n;
}

interface BodyPiece {
  readonly start: number;
  readonly profile: Profile;
}

/**
 * AERO-1, AERO-2: the normal force coefficient and CP at angle of attack by
 * the moment sum (3.29). Body terms carry sin α/α (eq. 3.19, "we shall not
 * make this simplification"); body lift K A_plan sin²α/A_ref at the planform
 * centroid (eqs. 3.26, 3.27), applied to every body component (p. 24); fins
 * linear in α below Mach 1 (eq. 3.40) and with the Busemann terms above
 * (eq. 3.49). With C_Nα(α) = C_N/α (eq. 3.8).
 */
export function normalForceAtAngle(
  components: readonly PlacedComponent[],
  mach: Mach,
  angleOfAttack: Radians,
  lateralAirflowAngle: Radians,
  options: AeroModeOptions,
): {
  cn: number;
  cnAlpha: number;
  cp: number;
  contributions: AeroContribution[];
  warnings: string[];
  referenceArea: number;
  referenceDiameter: number;
  bodyPieces: BodyPiece[];
  finCps: { fin: TrapezoidFinSetComponent; cp: number }[];
} {
  const a: number = angleOfAttack;
  if (!(a >= 0 && a <= Math.PI))
    throw new InvalidInputError('angle of attack', a, 'must be between 0 and 180 degrees');
  const d: number = options.referenceDiameter ?? maximumBodyDiameter(components);
  const aRef = (Math.PI * d * d) / 4;
  const sinOverAlpha = a === 0 ? 1 : Math.sin(a) / a;
  const liftFactor = a === 0 ? 0 : (BODY_LIFT_K * Math.sin(a) ** 2) / a; // C_Nα of the lift term per unit A_plan/A_ref
  const contributions: AeroContribution[] = [];
  const warnings: string[] = [];
  const bodyPieces: BodyPiece[] = [];
  const finCps: { fin: TrapezoidFinSetComponent; cp: number }[] = [];
  let x = 0;
  let sumCnAlpha = 0;
  let sumMoment = 0;
  const push = (index: number, source: string, cnAlpha: number, cp: number): void => {
    if (cnAlpha === 0) return;
    contributions.push({ index, source, cn: cnAlpha * a, cp });
    sumCnAlpha += cnAlpha;
    sumMoment += cnAlpha * cp;
  };
  components.forEach(({ component: c, position }, index) => {
    const pos: number = position;
    switch (c.kind) {
      case 'noseCone': {
        const profile = noseProfile(c.shape, c.length, c.baseRadius, c.shapeParameter);
        bodyPieces.push({ start: pos, profile });
        x = pos + profile.length;
        const t: AerodynamicTerm = noseConeTerm(c, squareMetres(aRef));
        push(index, 'nose cone (3.19)', t.cnAlpha * sinOverAlpha, pos + t.cpX);
        const pl = planform(profile);
        push(index, 'nose cone body lift (3.26)', (liftFactor * pl.area) / aRef, pos + pl.centroid);
        break;
      }
      case 'bodyTube': {
        const R: number = c.outerRadius;
        const L: number = c.length;
        bodyPieces.push({ start: pos, profile: { length: L, radius: () => R, slope: () => 0 } });
        x = pos + L;
        push(index, 'body tube lift (3.26)', (liftFactor * 2 * R * L) / aRef, pos + L / 2);
        break;
      }
      case 'transition': {
        const profile = transitionProfile(
          c.shape,
          c.length,
          c.foreRadius,
          c.aftRadius,
          c.shapeParameter,
        );
        bodyPieces.push({ start: pos, profile });
        x = pos + profile.length;
        const t = transitionTerm(c, squareMetres(aRef));
        push(index, 'transition (3.19)', t.cnAlpha * sinOverAlpha, pos + t.cpX);
        const pl = planform(profile);
        push(
          index,
          'transition body lift (3.26)',
          (liftFactor * pl.area) / aRef,
          pos + pl.centroid,
        );
        break;
      }
      case 'finSet': {
        const t = finSetTerm(
          c,
          squareMetres(aRef),
          mach,
          lateralAirflowAngle,
          options.finRollReduction,
          a,
        );
        push(
          index,
          `fins (${t.regime}, ${String(c.count)} fins, K ${t.interferenceFactor.toFixed(4)})`,
          t.cnAlpha,
          pos + t.cpX,
        );
        finCps.push({ fin: c, cp: pos + t.cpX });
        break;
      }
      case 'innerTube':
      case 'centeringRing':
      case 'bulkhead':
      case 'massComponent':
      case 'parachute':
      case 'launchLug':
      case 'railButton':
        break;
    }
  });
  if (!(x > 0))
    throw new InvalidInputError(
      'components',
      components.length,
      'at least one external component is needed',
    );
  const M: number = mach;
  if (M >= 0.8 && M <= 1.2)
    warnings.push(`transonic regime (Mach ${M.toFixed(3)}): lower accuracy`);
  const cp = sumCnAlpha > 0 ? sumMoment / sumCnAlpha : Number.NaN;
  if (!(sumCnAlpha > 0)) {
    throw new InvalidInputError(
      'total normal force coefficient derivative',
      sumCnAlpha,
      'must be greater than 0 (Niskanen eq. 3.29)',
    );
  }
  return {
    cn: sumCnAlpha * a,
    cnAlpha: sumCnAlpha,
    cp,
    contributions,
    warnings,
    referenceArea: aRef,
    referenceDiameter: d,
    bodyPieces,
    finCps,
  };
}

/**
 * AERO-4. Niskanen eqs. (3.57) to (3.60): the pitch damping moment, written
 * here as the moment itself (C_damp q A_ref d simplifies to 0.275 ρ r_t l⁴ ω²
 * for each body portion, eq. 3.58, and 0.3 ρ N A_fin ξ³ ω² for the fins),
 * for the body portions fore and aft of the CG with their average radii and
 * for the fins at their CP distance ξ from the CG, N capped at 4 (p. 36).
 * Opposes the transverse angular velocity; applied to pitch and yaw alike.
 */
export function pitchDampingMoment(
  bodyPieces: readonly BodyPiece[],
  finCps: readonly { fin: TrapezoidFinSetComponent; cp: number }[],
  cg: number,
  density: number,
  transverseRate: number,
): number {
  let foreLength = 0;
  let foreRadiusSum = 0;
  let aftLength = 0;
  let aftRadiusSum = 0;
  for (const piece of bodyPieces) {
    const end = piece.start + piece.profile.length;
    const foreEnd = Math.min(end, cg);
    if (foreEnd > piece.start) {
      const l = foreEnd - piece.start;
      foreLength += l;
      foreRadiusSum += meanRadius(piece.profile, 0, foreEnd - piece.start) * l;
    }
    const aftStart = Math.max(piece.start, cg);
    if (end > aftStart) {
      const l = end - aftStart;
      aftLength += l;
      aftRadiusSum += meanRadius(piece.profile, aftStart - piece.start, piece.profile.length) * l;
    }
  }
  const foreRadius = foreLength > 0 ? foreRadiusSum / foreLength : 0;
  const aftRadius = aftLength > 0 ? aftRadiusSum / aftLength : 0;
  let moment =
    0.275 *
    density *
    (foreRadius * foreLength ** 4 + aftRadius * aftLength ** 4) *
    transverseRate ** 2;
  for (const { fin, cp } of finCps) {
    const cr: number = fin.rootChord;
    const ct: number = fin.tipChord;
    const s: number = fin.span;
    const aFin = ((cr + ct) / 2) * s;
    const xi = Math.abs(cp - cg);
    moment += 0.3 * density * Math.min(fin.count, 4) * aFin * xi ** 3 * transverseRate ** 2;
  }
  return finiteResult('pitch damping moment', moment);
}

/**
 * AERO-5. Niskanen eqs. (3.69), (3.70), (3.38): roll damping moment of
 * uncanted fins at subsonic speed, C_ld q A_ref d = N (2π/β)(ω/v₀) q Σ,
 * Σ = (c_r + c_t) r_t² s/2 + (c_r + 2c_t) r_t s²/3 + (c_r + 3c_t) s³/12.
 * Opposes the roll rate. The supersonic form (3.72) is not implemented.
 */
export function rollDampingMoment(
  fins: readonly TrapezoidFinSetComponent[],
  mach: Mach,
  dynamicPressure: number,
  airspeed: number,
  rollRate: number,
): number {
  if (rollRate === 0 || airspeed === 0) return 0;
  const M: number = mach;
  if (M >= 0.8) {
    throw new NotImplementedError(
      `roll damping at Mach ${String(M)}: only the subsonic form (Niskanen eq. 3.69) is implemented`,
    );
  }
  const beta = prandtlBeta(mach);
  let moment = 0;
  for (const fin of fins) {
    const cr: number = fin.rootChord;
    const ct: number = fin.tipChord;
    const s: number = fin.span;
    const rt: number = fin.bodyRadius;
    const sum =
      ((cr + ct) * rt * rt * s) / 2 +
      ((cr + 2 * ct) * rt * s * s) / 3 +
      ((cr + 3 * ct) * s ** 3) / 12;
    moment += fin.count * ((2 * Math.PI) / beta) * (rollRate / airspeed) * dynamicPressure * sum;
  }
  return finiteResult('roll damping moment', moment);
}

/** AERO-1 to AERO-5 combined into the body-frame force and moment about the CG. */
export function aerodynamicForcesAndMoments(input: AeroInputs): AeroResult {
  const nf = normalForceAtAngle(
    input.components,
    input.mach,
    input.angleOfAttack,
    input.lateralAirflowAngle,
    input.options,
  );
  const q: number = input.dynamicPressure;
  if (!(q >= 0)) throw new InvalidInputError('dynamic pressure', q, 'must be 0 Pa or greater');
  const aRef = nf.referenceArea;
  const theta: number = input.lateralAirflowAngle;
  // Normal force: magnitude q A_ref C_N, opposing the lateral airflow (AERO-2).
  const normalForce = q * aRef * nf.cn;
  const lateral: Vec3 = { x: 0, y: Math.cos(theta), z: Math.sin(theta) };
  const fN: Vec3 = { x: 0, y: -normalForce * lateral.y, z: -normalForce * lateral.z };
  // Axial drag along the axis, opposing the axial airspeed (AERO-3, DRAG-14).
  const scaling = axialDragScaling(input.angleOfAttack);
  const ca = (input.cd0 as number) * scaling.scale;
  const axialForce = q * aRef * ca;
  const fA: Vec3 = { x: -input.axialAirspeedSign * axialForce, y: 0, z: 0 };
  // Moment of the normal force about the CG: r = (X_CP − X_CG) x̂, τ = r × F_N.
  const dx = nf.cp - (input.cg as number);
  const momentN: Vec3 = { x: 0, y: normalForce * dx * lateral.z, z: -normalForce * dx * lateral.y };
  // Damping couples (AERO-4, AERO-5).
  const w = input.angularVelocityBody;
  const transverse = Math.hypot(w.y, w.z);
  const pitchDamping = pitchDampingMoment(
    nf.bodyPieces,
    nf.finCps,
    input.cg,
    input.density,
    transverse,
  );
  const dampN: Vec3 =
    transverse === 0
      ? { x: 0, y: 0, z: 0 }
      : { x: 0, y: (-pitchDamping * w.y) / transverse, z: (-pitchDamping * w.z) / transverse };
  const fins = input.components
    .map((p) => p.component)
    .filter((c): c is TrapezoidFinSetComponent => c.kind === 'finSet');
  const rollDamping = rollDampingMoment(fins, input.mach, q, input.airspeed, w.x);
  const warnings = [...nf.warnings];
  if (scaling.beyondSource)
    warnings.push(
      `angle of attack ${(((input.angleOfAttack as number) * 180) / Math.PI).toFixed(1)}° is beyond the 90° the drag scaling covers; mirrored (D-033)`,
    );
  const forceBody: Vec3 = {
    x: finiteResult('aerodynamic force x', fN.x + fA.x),
    y: finiteResult('aerodynamic force y', fN.y + fA.y),
    z: finiteResult('aerodynamic force z', fN.z + fA.z),
  };
  const momentBody: Vec3 = {
    x: finiteResult('aerodynamic moment x', -rollDamping),
    y: finiteResult('aerodynamic moment y', momentN.y + dampN.y),
    z: finiteResult('aerodynamic moment z', momentN.z + dampN.z),
  };
  return {
    forceBody,
    momentBody,
    cn: nf.cn,
    cnAlpha: nf.cnAlpha,
    cp: metres(nf.cp),
    normalForce,
    axialForce,
    axialDragCoefficient: ca,
    pitchDampingMoment: pitchDamping,
    rollDampingMoment: rollDamping,
    contributions: nf.contributions,
    warnings,
  };
}
