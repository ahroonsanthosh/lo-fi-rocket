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
import { finPlanform, trapezoidOf } from '../geometry/fin-planform.js';
import { noseProfile, transitionProfile, type Profile } from '../geometry/profiles.js';
import { DEFAULT_PANELS, integrate } from '../geometry/revolution.js';
import { finiteResult } from '../numerics/finite.js';
import { datcomBodyAssembly, noseCylinderTermAtMach } from '../stability/datcom-body.js';
import { finAfterbodyLength } from '../stability/datcom-fin.js';
import {
  finLargeAngle,
  jorgensenPotentialFactor,
  jorgensenViscousFactor,
} from '../stability/datcom-large-angle.js';
import {
  busemannCoefficients,
  finSetTerm,
  maximumBodyDiameter,
  noseConeTerm,
  transitionTerm,
  type AerodynamicTerm,
  DEFAULT_SUPERSONIC_FIN_METHOD,
  DEFAULT_TRANSONIC_FIN_INTERPOLATION,
  type SupersonicFinMethod,
  type TransonicFinInterpolation,
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

/** Regime warnings naming the validation status (docs/reports/wind-tunnel-validation.md, D-057). */
export const TRANSONIC_CP_WARNING =
  'transonic regime (Mach 0.8 to 1.2): the fin force is an interpolation (BAR-12) and accuracy is lower; against held-out wind tunnel data the centre of pressure was within 4.1 % of body length rms (worst 6.1 %, on the conservative side)';
export const SUPERSONIC_CP_WARNING =
  'supersonic regime (Mach 1.2 to 2.0): fin force and body carry-over from the DATCOM charts (faired in up to Mach 1.4); against held-out wind tunnel data the centre of pressure was within 3.7 % of body length rms (worst 5.1 %)';
export const OUTSIDE_VALIDATED_WARNING =
  'above Mach 2.0: outside the validated range (Mach 0 to 2.0); the centre of pressure and drag have not been checked against measurements here';

export interface AeroModeOptions {
  /** Niskanen eq. (3.54) roll reduction on (displayed) or off (OpenRocket-equivalent, D-016). */
  readonly finRollReduction: boolean;
  readonly referenceDiameter?: Metres;
  /** BAR-12 candidate; defaults to the chosen one (D-056). */
  readonly transonicFinInterpolation?: TransonicFinInterpolation;
  /** Supersonic fin method; defaults to `DEFAULT_SUPERSONIC_FIN_METHOD` (D-065). */
  readonly supersonicFinMethod?: SupersonicFinMethod;
  /**
   * Normal force at large angles of attack (D-070): 'datcom' (HA-1 to HA-10, 0 to 180°, the displayed
   * mode) or 'linear' (Niskanen's small-angle terms with the 90° limit of D-046, the OpenRocket-equivalent
   * mode); defaults to `DEFAULT_LARGE_ANGLE_METHOD`.
   */
  readonly largeAngleMethod?: LargeAngleMethod;
}

/** D-070. */
export type LargeAngleMethod = 'datcom' | 'linear';
export const DEFAULT_LARGE_ANGLE_METHOD: LargeAngleMethod = 'datcom';

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
  /** Pitch damping coefficient C_p of AERO-4: the damping moment is C_p ω_t², N·m·s². */
  readonly pitchDampingCoefficient: number;
  /** Roll damping coefficient of AERO-5 to AERO-7: the damping moment is C_r ω_x, N·m·s (0 at zero airspeed). */
  readonly rollDampingCoefficient: number;
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

/** Static (Mach- and α-independent) data per component, computed once per design and reference area. */
interface StaticAero {
  readonly piece?: BodyPiece;
  readonly end: number;
  /** Barrowman term at α → 0 (nose cones and transitions). */
  readonly term?: AerodynamicTerm;
  readonly planformArea: number;
  readonly planformCentroid: number;
}

const AERO_CACHE = new WeakMap<
  readonly PlacedComponent[],
  { aRef: number; entries: readonly StaticAero[] }
>();

function staticAero(components: readonly PlacedComponent[], aRef: number): readonly StaticAero[] {
  const cached = AERO_CACHE.get(components);
  if (cached?.aRef === aRef) return cached.entries;
  const entries = components.map(({ component: c, position }): StaticAero => {
    const pos: number = position;
    switch (c.kind) {
      case 'noseCone': {
        const profile = noseProfile(c.shape, c.length, c.baseRadius, c.shapeParameter);
        const pl = planform(profile);
        return {
          piece: { start: pos, profile },
          end: pos + profile.length,
          term: noseConeTerm(c, squareMetres(aRef)),
          planformArea: pl.area,
          planformCentroid: pos + pl.centroid,
        };
      }
      case 'bodyTube': {
        const R: number = c.outerRadius;
        const L: number = c.length;
        return {
          piece: { start: pos, profile: { length: L, radius: () => R, slope: () => 0 } },
          end: pos + L,
          planformArea: 2 * R * L,
          planformCentroid: pos + L / 2,
        };
      }
      case 'transition': {
        const profile = transitionProfile(
          c.shape,
          c.length,
          c.foreRadius,
          c.aftRadius,
          c.shapeParameter,
        );
        const pl = planform(profile);
        return {
          piece: { start: pos, profile },
          end: pos + profile.length,
          term: transitionTerm(c, squareMetres(aRef)),
          planformArea: pl.area,
          planformCentroid: pos + pl.centroid,
        };
      }
      case 'finSet':
      case 'innerTube':
      case 'centeringRing':
      case 'bulkhead':
      case 'massComponent':
      case 'parachute':
      case 'launchLug':
      case 'railButton':
        return { end: 0, planformArea: 0, planformCentroid: 0 };
    }
  });
  AERO_CACHE.set(components, { aRef, entries });
  return entries;
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
): NormalForceResult {
  return (options.largeAngleMethod ?? DEFAULT_LARGE_ANGLE_METHOD) === 'datcom'
    ? normalForceLargeAngle(components, mach, angleOfAttack, lateralAirflowAngle, options)
    : normalForceLinear(components, mach, angleOfAttack, lateralAirflowAngle, options);
}

export interface NormalForceResult {
  /** C_N at α, on A_ref. */
  cn: number;
  /** C_N/α (eq. 3.8), or the slope at α = 0. */
  cnAlpha: number;
  cp: number;
  contributions: AeroContribution[];
  warnings: string[];
  referenceArea: number;
  referenceDiameter: number;
  bodyPieces: BodyPiece[];
  finCps: { fin: TrapezoidFinSetComponent; cp: number }[];
}

/** The small-angle model (the 'linear' large-angle method, D-046). */
function normalForceLinear(
  components: readonly PlacedComponent[],
  mach: Mach,
  angleOfAttack: Radians,
  lateralAirflowAngle: Radians,
  options: AeroModeOptions,
): NormalForceResult {
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
  const statics = staticAero(components, aRef);
  const assembly = datcomBodyAssembly(components);
  components.forEach(({ component: c, position }, index) => {
    const pos: number = position;
    const st = statics[index];
    if (st === undefined) return;
    switch (c.kind) {
      case 'noseCone':
      case 'transition': {
        if (st.piece !== undefined) bodyPieces.push(st.piece);
        x = st.end;
        if (st.term !== undefined) {
          let term = { cnAlpha: st.term.cnAlpha, cp: pos + st.term.cpX };
          let label = c.kind === 'noseCone' ? 'nose cone (3.19)' : 'transition (3.19)';
          if (c.kind === 'noseCone' && assembly?.noseIndex === index && (mach as number) > 0.8) {
            // BAR-13, BAR-14: the nose-cylinder body term against Mach (D-064).
            const m = noseCylinderTermAtMach(assembly, term, aRef, mach);
            term = { cnAlpha: m.cnAlpha, cp: m.cp };
            label = `nose-cylinder body (DATCOM ${m.method})`;
            warnings.push(...m.warnings);
          }
          push(index, label, term.cnAlpha * sinOverAlpha, term.cp);
        }
        push(
          index,
          c.kind === 'noseCone' ? 'nose cone body lift (3.26)' : 'transition body lift (3.26)',
          (liftFactor * st.planformArea) / aRef,
          st.planformCentroid,
        );
        break;
      }
      case 'bodyTube': {
        if (st.piece !== undefined) bodyPieces.push(st.piece);
        x = st.end;
        push(
          index,
          'body tube lift (3.26)',
          (liftFactor * st.planformArea) / aRef,
          st.planformCentroid,
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
          options.transonicFinInterpolation ?? DEFAULT_TRANSONIC_FIN_INTERPOLATION,
          {
            method: options.supersonicFinMethod ?? DEFAULT_SUPERSONIC_FIN_METHOD,
            afterbodyLength: finAfterbodyLength(components, index),
          },
        );
        warnings.push(...t.warnings);
        const carry = t.carryOver.cnAlpha;
        // The fin panels' own force and CP; the body carry-over (BAR-16, BAR-17) is a separate term.
        const finCn = t.cnAlpha - carry;
        const finCp = carry > 0 ? (t.cnAlpha * t.cpX - carry * t.carryOver.cpX) / finCn : t.cpX;
        push(
          index,
          `fins (${t.regime}${t.regime === 'subsonic' ? '' : `, ${t.supersonicMethod}`}, ${String(c.count)} fins, K ${t.interferenceFactor.toFixed(4)})`,
          finCn,
          pos + finCp,
        );
        if (carry > 0) {
          push(
            index,
            `fin-body carry-over (DATCOM, K_B(W) ${t.carryOverFactor.toFixed(4)})`,
            carry,
            pos + t.carryOver.cpX,
          );
        }
        finCps.push({ fin: c, cp: pos + finCp });
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
  if (M >= 0.8 && M <= 1.2) warnings.push(TRANSONIC_CP_WARNING);
  else if (M > 1.2 && M <= 2) warnings.push(SUPERSONIC_CP_WARNING);
  else if (M > 2) warnings.push(OUTSIDE_VALIDATED_WARNING);
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

/** DRAG-14 beyond 90° (D-033); a constant string because warnings are deduplicated per flight. */
export const AXIAL_DRAG_MIRRORED_WARNING =
  'angle of attack beyond 90°: the axial drag scaling of Niskanen p. 53 covers 0 to 90° and is mirrored for backward flight (D-033)';

/** Warnings of the large-angle model (constant strings: warnings are deduplicated per flight). */
export const LARGE_ANGLE_UNVERIFIED_WARNING =
  'angle of attack above 60°: the DATCOM body method has no test verification there at subsonic speeds (DATCOM p. 4.2.1.2-6) and the fin method is an empirical correlation; the tumbling or backward-flying part of this flight is approximate (D-070)';
export const LARGE_ANGLE_TRANSITION_WARNING =
  'flying backwards (angle of attack above 90°) with a transition on the body: the DATCOM substantiates the reverse-flow body method only for bodies of constant cross section (D-070)';
export const CROSSFLOW_CHART_HELD_WARNING =
  'body fineness ratio or cross-flow Mach number outside DATCOM figure 4.2.1.2-35 (fineness 2 to 28, cross-flow Mach to 9): the end value of the chart was used (D-070)';
export const SUPERSONIC_LARGE_ANGLE_ERROR =
  'fin normal force beyond 90° angle of attack at Mach 1 or above: the DATCOM supersonic high-angle charts (section 4.1.3.3 C) are not implemented';

/**
 * AERO-1, AERO-2 with the large-angle model of D-070 (HA-1 to HA-10). Body:
 * Jorgensen (DATCOM eq. 4.2.1.2-c). Up to 90° each nose cone and transition
 * keeps its zero-angle slope and CP (Barrowman, or DATCOM BAR-13/14 above
 * Mach 0.8) times sin 2α cos(α/2)/2, the per-component form of the potential
 * term (the slopes sum to 2S_b/S with the combined CP ℓ_B − V_B/S_b, eq.
 * 4.2.2.2-b); beyond 90° the potential term is (S_b/S) sin 2α′ cos(α′/2) at
 * V_B/S_b (eqs. 4.2.1.2-c, 4.2.2.2-c). The viscous term η c_dc (S_p/S) sin²α′
 * is applied to every body component at its planform centroid. Fins below
 * Mach 1: the fin set's slope (and its body carry-over) times the DATCOM wing
 * normal-force shape C′_N/C_Nα (HA-7, HA-9), the panel CP from HA-8; beyond
 * 90° the reversed wing (HA-10). Fins at Mach 1 and above keep Niskanen's
 * eq. (3.49) and are applied up to 90° only.
 */
function normalForceLargeAngle(
  components: readonly PlacedComponent[],
  mach: Mach,
  angleOfAttack: Radians,
  lateralAirflowAngle: Radians,
  options: AeroModeOptions,
): NormalForceResult {
  const a: number = angleOfAttack;
  if (!(a >= 0 && a <= Math.PI))
    throw new InvalidInputError('angle of attack', a, 'must be between 0 and 180 degrees');
  const M: number = mach;
  const reverse = a > Math.PI / 2;
  const aPrime = reverse ? Math.PI - a : a;
  const d = options.referenceDiameter ?? maximumBodyDiameter(components);
  const aRef = (Math.PI * d * d) / 4;
  const contributions: AeroContribution[] = [];
  const warnings: string[] = [];
  const bodyPieces: BodyPiece[] = [];
  const finCps: { fin: TrapezoidFinSetComponent; cp: number }[] = [];
  // At α′ = 0 every term vanishes and the CP is the limit, weighted by the slopes; otherwise by C_N.
  let sumCn = 0;
  let sumWeight = 0;
  let sumMoment = 0;
  const push = (index: number, source: string, slope: number, cn: number, cp: number): void => {
    if (slope === 0 && cn === 0) return;
    const weight = aPrime === 0 ? slope : cn;
    contributions.push({ index, source, cn, cp });
    sumCn += cn;
    sumWeight += weight;
    sumMoment += weight * cp;
  };
  const statics = staticAero(components, aRef);
  const assembly = datcomBodyAssembly(components);
  const bodyLength = statics.reduce(
    (l, st) => (st.piece === undefined ? l : Math.max(l, st.end)),
    0,
  );
  const hasTransition = components.some((p) => p.component.kind === 'transition');
  if (!(bodyLength > 0))
    throw new InvalidInputError(
      'components',
      components.length,
      'at least one external component is needed',
    );
  const potential = jorgensenPotentialFactor(a);
  const viscous = jorgensenViscousFactor(a, M, bodyLength / maximumBodyDiameter(components));
  if (viscous.eta.held || viscous.cdc.held) warnings.push(CROSSFLOW_CHART_HELD_WARNING);
  const viscousLabel = 'cross-flow (DATCOM 4.2.1.2 Jorgensen)';
  components.forEach(({ component: c, position }, index) => {
    const pos: number = position;
    const st = statics[index];
    if (st === undefined) return;
    switch (c.kind) {
      case 'noseCone':
      case 'transition': {
        if (st.piece !== undefined) bodyPieces.push(st.piece);
        if (st.term !== undefined && !reverse) {
          let term = { cnAlpha: st.term.cnAlpha, cp: pos + st.term.cpX };
          let label = c.kind === 'noseCone' ? 'nose cone' : 'transition';
          if (c.kind === 'noseCone' && assembly?.noseIndex === index && M > 0.8) {
            const m = noseCylinderTermAtMach(assembly, term, aRef, mach);
            term = { cnAlpha: m.cnAlpha, cp: m.cp };
            label = `nose-cylinder body (DATCOM ${m.method})`;
            warnings.push(...m.warnings);
          }
          push(
            index,
            `${label} potential (DATCOM 4.2.1.2-c)`,
            term.cnAlpha,
            term.cnAlpha * potential,
            term.cp,
          );
        }
        push(
          index,
          viscousLabel,
          0,
          (viscous.factor * st.planformArea) / aRef,
          st.planformCentroid,
        );
        break;
      }
      case 'bodyTube': {
        if (st.piece !== undefined) bodyPieces.push(st.piece);
        push(
          index,
          viscousLabel,
          0,
          (viscous.factor * st.planformArea) / aRef,
          st.planformCentroid,
        );
        break;
      }
      case 'finSet': {
        const supersonic = {
          method: options.supersonicFinMethod ?? DEFAULT_SUPERSONIC_FIN_METHOD,
          afterbodyLength: finAfterbodyLength(components, index),
        };
        const transonic = options.transonicFinInterpolation ?? DEFAULT_TRANSONIC_FIN_INTERPOLATION;
        const t = finSetTerm(
          c,
          squareMetres(aRef),
          mach,
          lateralAirflowAngle,
          options.finRollReduction,
          aPrime,
          transonic,
          supersonic,
        );
        warnings.push(...t.warnings);
        const cr: number = c.rootChord;
        const carry = t.carryOver.cnAlpha;
        const finSlope = t.cnAlpha - carry;
        const forwardCp =
          carry > 0 ? (t.cnAlpha * t.cpX - carry * t.carryOver.cpX) / finSlope : t.cpX;
        const label = `fins (${t.regime}, ${String(c.count)} fins, K ${t.interferenceFactor.toFixed(4)})`;
        let shape: number;
        let finCp: number;
        let carryCp = t.carryOver.cpX;
        if (M >= 1) {
          if (reverse) throw new NotImplementedError(SUPERSONIC_LARGE_ANGLE_ERROR);
          shape = aPrime;
          finCp = forwardCp;
        } else if (!reverse) {
          const la = finLargeAngle(c, M, aPrime, false, forwardCp / cr);
          warnings.push(...la.warnings);
          shape = la.shape;
          finCp = la.cpOverRoot * cr;
        } else {
          // HA-10: the reversed wing; its apex is the old root trailing edge.
          const reversed = reversedFin(c);
          const r = finSetTerm(
            reversed,
            squareMetres(aRef),
            mach,
            lateralAirflowAngle,
            options.finRollReduction,
            0,
            transonic,
            supersonic,
          );
          const la = finLargeAngle(c, M, aPrime, true, r.cpX / cr);
          warnings.push(...la.warnings);
          shape = la.shape;
          finCp = cr - la.cpOverRoot * cr;
          carryCp = cr - t.carryOver.cpX;
        }
        push(
          index,
          `${label} large-angle (DATCOM 4.1.3.3)`,
          finSlope,
          finSlope * shape,
          pos + finCp,
        );
        if (carry > 0)
          push(
            index,
            `fin-body carry-over (DATCOM, K_B(W) ${t.carryOverFactor.toFixed(4)})`,
            carry,
            carry * shape,
            pos + carryCp,
          );
        finCps.push({ fin: c, cp: pos + finCp });
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
  if (reverse) {
    // Eqs. 4.2.1.2-c and 4.2.2.2-c: (S_b/S) sin 2α′ cos(α′/2) at V_B/S_b from the nose tip.
    const { sBase, volume } = bodyVolumeAndBase(components, bodyPieces);
    if (sBase > 0) {
      const slope = (2 * sBase) / aRef;
      push(
        -1,
        'body potential, reverse flow (DATCOM 4.2.1.2-c, 4.2.2.2-c)',
        slope,
        slope * potential,
        volume / sBase,
      );
    }
    if (hasTransition) warnings.push(LARGE_ANGLE_TRANSITION_WARNING);
  }
  if (M >= 0.8 && M <= 1.2) warnings.push(TRANSONIC_CP_WARNING);
  else if (M > 1.2 && M <= 2) warnings.push(SUPERSONIC_CP_WARNING);
  else if (M > 2) warnings.push(OUTSIDE_VALIDATED_WARNING);
  if (a > Math.PI / 3) warnings.push(LARGE_ANGLE_UNVERIFIED_WARNING);
  if (!(sumWeight > 0))
    throw new InvalidInputError(
      'total normal force coefficient',
      sumWeight,
      'must be greater than 0 (Niskanen eq. 3.29)',
    );
  return {
    cn: finiteResult('normal force coefficient', sumCn),
    cnAlpha: a === 0 ? sumWeight : sumCn / a,
    cp: finiteResult('centre of pressure', sumMoment / sumWeight),
    contributions,
    warnings,
    referenceArea: aRef,
    referenceDiameter: d,
    bodyPieces,
    finCps,
  };
}

/** V_B and S_b of eq. 4.2.2.2-c (the external body's volume and its aft-end area), once per design. */
function bodyVolumeAndBase(
  components: readonly PlacedComponent[],
  pieces: readonly BodyPiece[],
): { sBase: number; volume: number } {
  const cached = BODY_VOLUME_CACHE.get(components);
  if (cached !== undefined) return cached;
  const last = pieces.reduce<BodyPiece | undefined>(
    (best, p) =>
      best === undefined || p.start + p.profile.length > best.start + best.profile.length
        ? p
        : best,
    undefined,
  );
  const rBase = last === undefined ? 0 : last.profile.radius(last.profile.length);
  const volume = pieces.reduce(
    (v, p) =>
      v + integrate((xx) => Math.PI * p.profile.radius(xx) ** 2, p.profile.length, DEFAULT_PANELS),
    0,
  );
  const r = { sBase: Math.PI * rBase * rBase, volume };
  BODY_VOLUME_CACHE.set(components, r);
  return r;
}
const BODY_VOLUME_CACHE = new WeakMap<
  readonly PlacedComponent[],
  { sBase: number; volume: number }
>();

/** HA-10: the planform seen in reverse flow, its leading edge the old trailing edge (tan Λ′ = (c_r − x_t − c_t)/s). */
export function reversedFin(shaped: TrapezoidFinSetComponent): TrapezoidFinSetComponent {
  const cached = REVERSED_FIN_CACHE.get(shaped);
  if (cached !== undefined) return cached;
  // D-087: the reversed planform is a trapezoid's; other planforms use their equivalent trapezoid.
  const c = trapezoidOf(shaped);
  const r = {
    ...c,
    sweep: metres((c.rootChord as number) - (c.sweep as number) - (c.tipChord as number)),
  };
  REVERSED_FIN_CACHE.set(shaped, r);
  return r;
}
/** One reversed planform object per fin set, so the per-component caches of `finSetTerm` keep working. */
const REVERSED_FIN_CACHE = new WeakMap<TrapezoidFinSetComponent, TrapezoidFinSetComponent>();

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
    const aFin = finPlanform(fin).area;
    const xi = Math.abs(cp - cg);
    moment += 0.3 * density * Math.min(fin.count, 4) * aFin * xi ** 3 * transverseRate ** 2;
  }
  return finiteResult('pitch damping moment', moment);
}

/** AERO-5 subsonic form: N (2π/β)(ω/v₀) q I₂ with I₂ of (3.70). */
function subsonicRollDamping(
  fin: TrapezoidFinSetComponent,
  M: number,
  q: number,
  r: number,
): number {
  const beta = Math.sqrt(1 - M * M);
  const sum = finPlanform(fin).stripIntegral(2, fin.bodyRadius);
  return fin.count * ((2 * Math.PI) / beta) * r * q * sum;
}

/**
 * AERO-6 supersonic form, eq. (3.72) with (3.41) and (3.62): the strip
 * pressure coefficient C_Pi = K₁η + K₂η² + K₃η³ at the inclination
 * η = |ω| ξ/v₀ summed over the strips, N q (K₁|r| I₂ + K₂ r² I₃ + K₃ |r|³ I₄),
 * r = ω/v₀; the sign follows the roll rate.
 */
function supersonicRollDamping(
  fin: TrapezoidFinSetComponent,
  M: number,
  q: number,
  r: number,
): number {
  const { k1, k2, k3 } = busemannCoefficients(M);
  const ar = Math.abs(r);
  const planform = finPlanform(fin);
  const i2 = planform.stripIntegral(2, fin.bodyRadius);
  const i3 = planform.stripIntegral(3, fin.bodyRadius);
  const i4 = planform.stripIntegral(4, fin.bodyRadius);
  return Math.sign(r) * fin.count * q * (k1 * ar * i2 + k2 * ar * ar * i3 + k3 * ar ** 3 * i4);
}

/**
 * AERO-5 to AERO-7. Roll damping moment of uncanted fins, opposing the roll
 * rate: Niskanen eqs. (3.69), (3.70), (3.38) below Mach 0.8 (C_ld q A_ref d =
 * N (2π/β)(ω/v₀) q Σ, Σ = (c_r + c_t) r_t² s/2 + (c_r + 2c_t) r_t s²/3 +
 * (c_r + 3c_t) s³/12); eq. (3.72) from Mach 1.2; linear in Mach between the
 * two at 0.8 and 1.2 in the band (AERO-7, D-058: the thesis gives no
 * transonic form).
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
  const r = rollRate / airspeed;
  let moment = 0;
  for (const fin of fins) {
    if (M <= 0.8) moment += subsonicRollDamping(fin, M, dynamicPressure, r);
    else if (M >= 1.2) moment += supersonicRollDamping(fin, M, dynamicPressure, r);
    else {
      const lo = subsonicRollDamping(fin, 0.8, dynamicPressure, r);
      const hi = supersonicRollDamping(fin, 1.2, dynamicPressure, r);
      moment += lo + ((hi - lo) * (M - 0.8)) / 0.4;
    }
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
  const pitchDampingCoefficient = pitchDampingMoment(
    nf.bodyPieces,
    nf.finCps,
    input.cg,
    input.density,
    1,
  );
  const rollDampingCoefficient = rollDampingMoment(fins, input.mach, q, input.airspeed, 1);
  const warnings = [...nf.warnings];
  if (scaling.beyondSource) warnings.push(AXIAL_DRAG_MIRRORED_WARNING);
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
    pitchDampingCoefficient,
    rollDampingCoefficient,
    rollDampingMoment: rollDamping,
    contributions: nf.contributions,
    warnings,
  };
}
