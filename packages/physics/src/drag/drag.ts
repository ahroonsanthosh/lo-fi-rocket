/**
 * Zero-angle-of-attack drag coefficient of the whole rocket and the axial
 * drag at angle of attack (plan 0009, DRAG-13, DRAG-14, GEO-13).
 *
 * Source: Niskanen (2009) §3.4 pp. 41 to 53. Each component term is
 * computed with its own reference area and scaled to A_ref = π d²/4 by
 * eq. (3.75) p. 41; the sum is eq. (3.97) p. 52. Coordinates and component
 * records are those of docs/conventions.md.
 */
import { InvalidInputError } from '../errors.js';
import type { PlacedComponent } from '../geometry/assembly.js';
import type {
  Component,
  RailButtonComponent,
  TrapezoidFinSetComponent,
} from '../geometry/components.js';
import { finPlanform } from '../geometry/fin-planform.js';
import { noseProfile, transitionProfile, type Profile } from '../geometry/profiles.js';
import { DEFAULT_PANELS, integrate } from '../geometry/revolution.js';
import { finiteResult } from '../numerics/finite.js';
import { maximumBodyDiameter } from '../stability/barrowman.js';
import {
  dimensionless,
  mach,
  metres,
  squareMetres,
  type Dimensionless,
  type Mach,
  type Metres,
  type SquareMetres,
} from '../units/si.js';
import { baseDragArea, launchLugDrag, railButtonDrag } from './base-parasitic.js';
import { finPressureDrag } from './fin-drag.js';
import { openRocketRailButtonDrag } from './openrocket-rail-button.js';
import { finWaveDrag } from './datcom-fin-wave-drag.js';
import {
  DATCOM_BASE_GUIDE_END,
  datcomBaseDragAtMach,
  datcomSubsonicBaseDrag,
} from './datcom-base-drag.js';
import {
  baseDragCoefficient,
  boatTailPressureDrag,
  noseConePressureDrag,
  shoulderPressureDrag,
} from './pressure-drag.js';
import {
  compressibleSkinFriction,
  frictionDragCoefficient,
  skinFrictionCoefficient,
  type SkinFriction,
} from './skin-friction.js';

/** GEO-13. Wetted (lateral) area of a body of revolution: ∫ 2π r √(1 + r′²) dx. */
/** Regime warnings naming the validation status (docs/reports/held-out-validation.md, D-061, D-069). */
export const TRANSONIC_DRAG_WARNING =
  'transonic regime (Mach 0.8 to 1.2): accuracy is lower than in subsonic flight (CLAUDE.md 6.3); against held-out wind tunnel and flight data the drag is within 21 % rms and the drag rise within 0.05 Mach (docs/reports/held-out-validation.md)';
export const SUPERSONIC_DRAG_WARNING =
  'supersonic regime (above Mach 1.2): against held-out data the drag is within 15 % rms to Mach 2.0, low by about 17 % for thick wedge fins (docs/reports/held-out-validation.md); above Mach 2.0 it is outside the validated range';

export function wettedArea(profile: Profile): number {
  return integrate(
    (x) => {
      const slope = profile.slope(x);
      const factor = Number.isFinite(slope) ? Math.sqrt(1 + slope * slope) : 1;
      return 2 * Math.PI * profile.radius(x) * factor;
    },
    profile.length,
    DEFAULT_PANELS,
  );
}

/** GEO-13. Joint angle φ at the component's aft end: atan r′(L), 0 if the slope is zero or undefined. */
export function jointAngle(profile: Profile): number {
  const slope = profile.slope(profile.length);
  if (!Number.isFinite(slope)) return Math.PI / 2;
  return Math.atan(Math.abs(slope));
}

/**
 * Mean aerodynamic chord of a fin, eq. (3.30) p. 26: for the trapezoid (2/3)(c_r² + c_r c_t +
 * c_t²)/(c_r + c_t), for other planforms by integration (D-087).
 */
export function meanAerodynamicChord(fin: TrapezoidFinSetComponent): number {
  return finPlanform(fin).mac;
}

export interface DragInputs {
  readonly components: readonly PlacedComponent[];
  readonly mach: Mach;
  /** Reynolds number based on the rocket length (DYN-8). */
  readonly reynolds: number;
  /**
   * Surface roughness height R_s (Table 3.2): the design's finish, on every external surface
   * that does not give its own (`PlacedComponent.roughnessHeight`, plan 0073).
   */
  readonly roughnessHeight: Metres;
  /** The motor in the base, if any, and whether it is thrusting now. */
  readonly motor?: {
    readonly diameter: Metres;
    readonly thrusting: boolean;
    /** Motors in a cluster (plan 0057); one when absent. */
    readonly count?: number;
  };
  /**
   * When the motor's area is removed from the base drag area (DRAG-11):
   * 'while-thrusting' is Niskanen p. 51 ("the thrusting motors"); 'never' is OpenRocket 24.12,
   * which keeps the whole base at all times (D-108, reference/rockets/drag-probe/values.txt);
   * 'always' also removes it after burnout (D-035's reading of OpenRocket, which D-108 found
   * wrong; kept for the comparisons that state it).
   */
  readonly baseDragMotorRule: BaseDragMotorRule;
  readonly referenceDiameter?: Metres;
  /** Body base drag method; defaults to `DEFAULT_BASE_DRAG_METHOD` (D-069). */
  readonly baseDragMethod?: BaseDragMethod;
  /**
   * Rail button drag: 'niskanen' (DRAG-12, the default) or 'openrocket', OpenRocket 24.12's as
   * measured (DRAG-23, D-108), for the OpenRocket-equivalent mode.
   */
  readonly railButtonDragMethod?: RailButtonDragMethod;
}

export type BaseDragMotorRule = 'while-thrusting' | 'always' | 'never';
export type RailButtonDragMethod = 'niskanen' | 'openrocket';

export interface DragTerm {
  readonly index: number;
  readonly kind: Component['kind'] | 'base';
  readonly source: string;
  /** The component's own coefficient C_D•. */
  readonly cdComponent: number;
  /** The component's reference area, m². */
  readonly area: number;
  /** Contribution to C_D0 (scaled to A_ref). */
  readonly cd: number;
}

export interface DragResult {
  readonly cd0: Dimensionless;
  readonly mach: Mach;
  readonly reynolds: number;
  readonly referenceDiameter: Metres;
  readonly referenceArea: SquareMetres;
  readonly rocketLength: Metres;
  readonly finenessRatio: number;
  /**
   * The skin friction coefficient of the design's finish (`roughnessHeight`) and the friction
   * drag of every surface, `cd`, each at its own finish (plan 0073).
   */
  readonly skinFriction: SkinFriction & { readonly compressible: number; readonly cd: number };
  readonly terms: readonly DragTerm[];
  readonly warnings: readonly string[];
}

interface ExternalGeometry {
  length: number;
  wettedBody: number;
  baseRadius: number;
  maxRadius: number;
  /** Plan 0073: the body's wetted area by surface roughness height. */
  wettedByFinish: Map<number, number>;
}

/** A fin set's friction surface (eq. 3.85). */
interface FinSurface {
  readonly wettedArea: number;
  readonly thickness: number;
  readonly meanChord: number;
}

const emptyGeometry = (): ExternalGeometry => ({
  length: 0,
  wettedBody: 0,
  baseRadius: 0,
  maxRadius: 0,
  wettedByFinish: new Map(),
});

/** C_fc, eqs. (3.78) to (3.84), at a roughness height and on a length L. */
function compressibleFrictionAt(input: DragInputs, roughness: number, length: number): number {
  const friction = skinFrictionCoefficient(input.reynolds, metres(roughness), metres(length));
  return compressibleSkinFriction(friction, input.mach, input.reynolds);
}

/** Per-component numbers that do not depend on Mach or Reynolds number, computed once per design. */
interface StaticEntry {
  readonly kind: 'nose' | 'tube' | 'transition' | 'fins' | 'lug' | 'button' | 'none';
  readonly length: number;
  readonly wetted: number;
  readonly aftRadius: number;
  readonly area: number;
  readonly finenessRatio: number;
  readonly jointAngle: number;
  readonly foreRadius: number;
  readonly finWetted: number;
  readonly finThickness: number;
  readonly finMeanChord: number;
  readonly finSweepAngle: number;
}

const STATIC_CACHE = new WeakMap<readonly PlacedComponent[], readonly StaticEntry[]>();

function staticEntries(components: readonly PlacedComponent[]): readonly StaticEntry[] {
  const cached = STATIC_CACHE.get(components);
  if (cached !== undefined) return cached;
  const none: StaticEntry = {
    kind: 'none',
    length: 0,
    wetted: 0,
    aftRadius: 0,
    area: 0,
    finenessRatio: 0,
    jointAngle: 0,
    foreRadius: 0,
    finWetted: 0,
    finThickness: 0,
    finMeanChord: 0,
    finSweepAngle: 0,
  };
  const entries = components.map(({ component: c }): StaticEntry => {
    switch (c.kind) {
      case 'noseCone': {
        const profile = noseProfile(c.shape, c.length, c.baseRadius, c.shapeParameter);
        const R: number = c.baseRadius;
        return {
          ...none,
          kind: 'nose',
          length: profile.length,
          wetted: wettedArea(profile),
          aftRadius: R,
          area: Math.PI * R * R,
          finenessRatio: profile.length / (2 * R),
          jointAngle: jointAngle(profile),
        };
      }
      case 'bodyTube': {
        const R: number = c.outerRadius;
        const L: number = c.length;
        return {
          ...none,
          kind: 'tube',
          length: L,
          wetted: 2 * Math.PI * R * L,
          aftRadius: R,
          foreRadius: R,
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
        const rf: number = c.foreRadius;
        const ra: number = c.aftRadius;
        return {
          ...none,
          kind: 'transition',
          length: profile.length,
          wetted: wettedArea(profile),
          aftRadius: ra,
          foreRadius: rf,
          area: Math.PI * Math.abs(ra * ra - rf * rf),
          jointAngle: jointAngle(profile),
        };
      }
      case 'finSet': {
        // D-087: the planform's area, MAC and average leading-edge angle Γ_L (p. 50).
        const p = finPlanform(c);
        const s: number = c.span;
        const t: number = c.thickness;
        return {
          ...none,
          kind: 'fins',
          area: c.count * t * s,
          finWetted: 2 * c.count * p.area,
          finThickness: t,
          finMeanChord: p.mac,
          finSweepAngle: p.leadingEdgeSweep,
        };
      }
      case 'launchLug':
        return { ...none, kind: 'lug' };
      case 'railButton':
        return { ...none, kind: 'button' };
      case 'innerTube':
      case 'centeringRing':
      case 'bulkhead':
      case 'massComponent':
      case 'parachute':
        return none;
    }
  });
  STATIC_CACHE.set(components, entries);
  return entries;
}

/**
 * DRAG-13. Eq. (3.97) p. 52: C_D0 = Σ (A_T/A_ref)(C_D•)T + (C_D)friction over
 * pressure (nose, shoulder, boat tail, fins), base and parasitic terms.
 */
/** Body base drag method (D-069): Niskanen eq. (3.94), or the DATCOM's body correlation (DRAG-21, DRAG-22). */
export type BaseDragMethod = 'niskanen' | 'datcom';
export const DEFAULT_BASE_DRAG_METHOD: BaseDragMethod = 'datcom';

/** Fairing from the end of figure 4.2.3.1-24 to Niskanen's supersonic base drag (DATCOM sketch (a), p. 4.2.3.1-5). */
export const DATCOM_BASE_FAIRING_END = 1.5;

function cfcForBase(input: DragInputs, geometry: ExternalGeometry): number {
  const finishes = geometry.wettedByFinish;
  if (finishes.size <= 1 && (finishes.size === 0 || finishes.has(input.roughnessHeight))) {
    return compressibleFrictionAt(input, input.roughnessHeight, geometry.length);
  }
  // Plan 0073: the DATCOM's body friction is C_f S_S (eq. 4.2.3.1-b), so with parts of several
  // finishes C_f is their wetted-area mean, Σ C_f,i S_i / Σ S_i.
  let sum = 0;
  let area = 0;
  for (const [roughness, wetted] of finishes) {
    sum += compressibleFrictionAt(input, roughness, geometry.length) * wetted;
    area += wetted;
  }
  return sum / area;
}

/**
 * The base drag coefficient on the base area: DRAG-11 (Niskanen eq. 3.94), or
 * with `baseDragMethod: 'datcom'` DRAG-21 and DRAG-22 to Mach 1.295, a linear
 * fairing to eq. (3.94) at Mach 1.5 (the DATCOM's supersonic base-pressure
 * charts, figures 4.2.3.1-50, -55 and -60, are not implemented), and
 * eq. (3.94) above.
 */
function bodyBaseDrag(
  input: DragInputs,
  geometry: ExternalGeometry,
  skinFriction: number,
): { cd: number; method: string; warnings: string[] } {
  const M: number = input.mach;
  const niskanen = baseDragCoefficient(input.mach);
  if (
    (input.baseDragMethod ?? DEFAULT_BASE_DRAG_METHOD) === 'niskanen' ||
    geometry.baseRadius <= 0
  ) {
    return { cd: niskanen, method: 'Niskanen (3.94)', warnings: [] };
  }
  const subsonic = datcomSubsonicBaseDrag({
    skinFriction,
    wettedArea: geometry.wettedBody,
    length: geometry.length,
    maxRadius: geometry.maxRadius,
    baseRadius: geometry.baseRadius,
  });
  const at = (m: number): number | undefined => datcomBaseDragAtMach(subsonic, m);
  const outside = (): { cd: number; method: string; warnings: string[] } => ({
    cd: niskanen,
    method: 'Niskanen (3.94)',
    warnings: [
      'DATCOM base drag not used: the subsonic value is outside the guide curves of figure 4.2.3.1-24; Niskanen eq. (3.94) is used instead.',
    ],
  });
  if (M <= DATCOM_BASE_GUIDE_END) {
    const v = at(M);
    return v === undefined ? outside() : { cd: v, method: 'DATCOM 4.2.3.1', warnings: [] };
  }
  if (M >= DATCOM_BASE_FAIRING_END) {
    return {
      cd: niskanen,
      method: 'Niskanen (3.94) above the DATCOM fairing',
      warnings: [],
    };
  }
  const end = at(DATCOM_BASE_GUIDE_END);
  if (end === undefined) return outside();
  const w = (M - DATCOM_BASE_GUIDE_END) / (DATCOM_BASE_FAIRING_END - DATCOM_BASE_GUIDE_END);
  return {
    cd: (1 - w) * end + w * baseDragCoefficient(mach(DATCOM_BASE_FAIRING_END)),
    method: 'DATCOM to Niskanen fairing',
    warnings: [
      'base drag: faired linearly between DATCOM figure 4.2.3.1-24 at Mach 1.295 and Niskanen eq. (3.94) at Mach 1.5 (D-069)',
    ],
  };
}

export function dragCoefficient(input: DragInputs): DragResult {
  const M: number = input.mach;
  if (!(M >= 0) || !Number.isFinite(M))
    throw new InvalidInputError('Mach number', M, 'must be 0 or greater');
  const referenceDiameter = input.referenceDiameter ?? maximumBodyDiameter(input.components);
  const d: number = referenceDiameter;
  if (!(d > 0)) throw new InvalidInputError('reference diameter', d, 'must be greater than 0 m');
  const aRef = (Math.PI * d * d) / 4;
  const warnings: string[] = [];
  const terms: DragTerm[] = [];
  const geometry = emptyGeometry();
  const finSets: FinSurface[] = [];
  // Plan 0073 (D-110): the friction surfaces by roughness height, every part at its own finish.
  const surfaces = new Map<number, { body: number; fins: FinSurface[] }>();
  const surface = (roughness: number): { body: number; fins: FinSurface[] } => {
    const found = surfaces.get(roughness);
    if (found !== undefined) return found;
    const made = { body: 0, fins: [] };
    surfaces.set(roughness, made);
    return made;
  };

  const openRocketButtons: {
    index: number;
    component: RailButtonComponent;
    position: number;
    push: (t: DragTerm) => void;
  }[] = [];
  const statics = staticEntries(input.components);
  // Plan 0070 (D-106): a pod set's parts form their own body, outside the main one; each term is
  // the part's own times the count of pods (Niskanen's methods per part, as OpenRocket applies them:
  // reference/rockets/pod-probe/values.txt).
  const podBodies = new Map<string, { count: number; geometry: ExternalGeometry }>();
  input.components.forEach((placed, index) => {
    const c = placed.component;
    const st = statics[index];
    if (st === undefined) return;
    const n = placed.instances?.count ?? 1;
    let body = geometry;
    if (placed.instances !== undefined) {
      const key = `${String(n)}@${String(placed.instances.radialOffset)}`;
      const pod = podBodies.get(key) ?? { count: n, geometry: emptyGeometry() };
      podBodies.set(key, pod);
      body = pod.geometry;
    }
    const roughness: number = placed.roughnessHeight ?? input.roughnessHeight;
    if (!(roughness >= 0 && Number.isFinite(roughness))) {
      throw new InvalidInputError(
        `surface roughness height of component ${String(index)}`,
        roughness,
        'must be 0 m or more (Table 3.2 lists typical values)',
      );
    }
    const wet = (area: number): void => {
      body.wettedBody += area;
      body.wettedByFinish.set(roughness, (body.wettedByFinish.get(roughness) ?? 0) + area);
      surface(roughness).body += n * area;
    };
    const push = (t: DragTerm): void => {
      terms.push(
        n === 1
          ? t
          : { ...t, source: `${t.source}, × ${String(n)} pods`, area: t.area * n, cd: t.cd * n },
      );
    };
    switch (c.kind) {
      case 'noseCone': {
        body.length += st.length;
        wet(st.wetted);
        body.baseRadius = st.aftRadius;
        body.maxRadius = Math.max(body.maxRadius, st.aftRadius, st.foreRadius);
        const r = noseConePressureDrag(
          c.shape,
          c.shapeParameter,
          st.finenessRatio,
          st.jointAngle,
          input.mach,
        );
        warnings.push(...r.warnings);
        push({
          index,
          kind: c.kind,
          source: `nose pressure (${r.method})`,
          cdComponent: r.cd,
          area: st.area,
          cd: (r.cd * st.area) / aRef,
        });
        break;
      }
      case 'bodyTube': {
        body.length += st.length;
        wet(st.wetted);
        body.baseRadius = st.aftRadius;
        body.maxRadius = Math.max(body.maxRadius, st.aftRadius, st.foreRadius);
        break;
      }
      case 'transition': {
        body.length += st.length;
        wet(st.wetted);
        body.baseRadius = st.aftRadius;
        body.maxRadius = Math.max(body.maxRadius, st.aftRadius, st.foreRadius);
        if (st.aftRadius > st.foreRadius) {
          const r = shoulderPressureDrag(
            c.shape,
            c.shapeParameter,
            st.length,
            st.foreRadius,
            st.aftRadius,
            st.jointAngle,
            input.mach,
          );
          warnings.push(...r.warnings);
          push({
            index,
            kind: c.kind,
            source: `shoulder pressure (${r.method})`,
            cdComponent: r.cd,
            area: st.area,
            cd: (r.cd * st.area) / aRef,
          });
        } else if (st.aftRadius < st.foreRadius) {
          const r = boatTailPressureDrag(st.length, st.foreRadius, st.aftRadius, input.mach);
          warnings.push(...r.warnings);
          push({
            index,
            kind: c.kind,
            source: `boat tail pressure (γ = ${r.lengthToHeight.toFixed(3)})`,
            cdComponent: r.cd,
            area: st.area,
            cd: (r.cd * st.area) / aRef,
          });
        }
        break;
      }
      case 'finSet': {
        if (c.crossSection === undefined) {
          throw new InvalidInputError(
            'fin cross-section',
            c.crossSection,
            'must be square, rounded, airfoil, wedge or double-wedge for the drag model (Niskanen §3.4.4, D-066)',
          );
        }
        const fin: FinSurface = {
          wettedArea: st.finWetted * n,
          thickness: st.finThickness,
          meanChord: st.finMeanChord,
        };
        finSets.push(fin);
        surface(roughness).fins.push(fin);
        const r = finPressureDrag(c.crossSection, st.finSweepAngle, input.mach);
        warnings.push(...r.warnings);
        push({
          index,
          kind: c.kind,
          source: `fin pressure (${c.crossSection}, LE ${r.leadingEdge.toFixed(4)} + TE ${r.trailingEdge.toFixed(4)})`,
          cdComponent: r.cd,
          area: st.area,
          cd: (r.cd * st.area) / aRef,
        });
        if (c.crossSection !== 'square') {
          // DRAG-18/19: wave drag of the section (DATCOM 4.1.5.1 B and C) on the
          // planform area of the N fins; the airfoil profile is taken as
          // biconvex and the rounded one as a round-nosed biconvex (D-062), the
          // wedges with their own K (D-066).
          // D-087: the DATCOM method's quarter-chord sweep is a trapezoid's; other planforms use
          // their equivalent trapezoid.
          const p = finPlanform(c);
          const cr: number = c.rootChord;
          const { tipChord: ct, sweep: xt } = p.equivalentTrapezoid;
          const s: number = c.span;
          const planform = p.area;
          const w = finWaveDrag({
            mach: input.mach,
            thicknessRatio: st.finThickness / st.finMeanChord,
            aspectRatio: (2 * s * s) / planform,
            quarterChordSweep: Math.atan((xt + ct / 4 - cr / 4) / s),
            leadingEdgeSweep: st.finSweepAngle,
            section:
              c.crossSection === 'wedge' || c.crossSection === 'double-wedge'
                ? c.crossSection
                : 'biconvex',
          });
          warnings.push(...w.warnings);
          const area = c.count * planform;
          push({
            index,
            kind: c.kind,
            source: `fin wave drag (DATCOM ${w.method})`,
            cdComponent: w.cd,
            area,
            cd: (w.cd * area) / aRef,
          });
        }
        break;
      }
      case 'launchLug': {
        const r = launchLugDrag(
          c.length,
          c.outerRadius,
          (c.outerRadius as number) - (c.wallThickness as number),
          input.mach,
        );
        push({
          index,
          kind: c.kind,
          source: 'launch lug parasitic',
          cdComponent: r.cd,
          area: r.area,
          cd: (r.cd * r.area) / aRef,
        });
        break;
      }
      case 'railButton': {
        if (input.railButtonDragMethod === 'openrocket') {
          // DRAG-23 needs the Reynolds number per metre, known once the body's length is.
          openRocketButtons.push({ index, component: c, position: placed.position, push });
          break;
        }
        const r = railButtonDrag(c.outerDiameter, c.totalHeight, input.mach);
        const area = r.area * c.count;
        push({
          index,
          kind: c.kind,
          source: `rail button parasitic (${String(c.count)})`,
          cdComponent: r.cd,
          area,
          cd: (r.cd * area) / aRef,
        });
        break;
      }
      case 'innerTube':
      case 'centeringRing':
      case 'bulkhead':
      case 'massComponent':
      case 'parachute':
        break;
    }
  });

  if (!(geometry.length > 0)) {
    throw new InvalidInputError(
      'components',
      input.components.length,
      'at least one external component (nose cone, body tube or transition) is needed',
    );
  }
  // DRAG-23: each button at its own position, on the flow's Reynolds number per metre (the input's
  // is based on the rocket's length).
  for (const b of openRocketButtons) {
    const c = b.component;
    const r = openRocketRailButtonDrag({
      outerDiameter: c.outerDiameter,
      innerDiameter: c.innerDiameter,
      totalHeight: c.totalHeight,
      baseHeight: c.baseHeight,
      flangeHeight: c.flangeHeight,
      positions: Array.from(
        { length: c.count },
        (_, i) => b.position + i * ((c.separation as number | undefined) ?? 0),
      ),
      mach: M,
      reynoldsPerMetre: geometry.length > 0 ? input.reynolds / geometry.length : 0,
    });
    b.push({
      index: b.index,
      kind: c.kind,
      source: `rail button, OpenRocket 24.12 (${String(c.count)})`,
      cdComponent: r.area > 0 ? r.cdA / r.area : 0,
      area: r.area,
      cd: r.cdA / aRef,
    });
  }
  // Base drag, eq. (3.94), on the base minus the thrusting motor (p. 51).
  const motor = input.motor;
  const removeMotor =
    motor !== undefined &&
    input.baseDragMotorRule !== 'never' &&
    (motor.thrusting || input.baseDragMotorRule === 'always');
  const baseArea = baseDragArea(
    geometry.baseRadius,
    removeMotor ? motor.diameter : undefined,
    motor?.count,
  );
  const base = bodyBaseDrag(input, geometry, cfcForBase(input, geometry));
  warnings.push(...base.warnings);
  const baseCd = base.cd;
  terms.push({
    index: -1,
    kind: 'base',
    source: `${removeMotor ? `base (motor area removed, ${input.baseDragMotorRule})` : 'base (full)'}, ${base.method}`,
    cdComponent: baseCd,
    area: baseArea,
    cd: (baseCd * baseArea) / aRef,
  });
  // Plan 0070: each pod's own base, by the same method on the pod's own body (OpenRocket: the base
  // drag rises by 2 × 0.25 × 0.1317 for two pods of a quarter of the base area at Mach 0.3).
  for (const pod of podBodies.values()) {
    if (!(pod.geometry.baseRadius > 0)) continue;
    const podBase = bodyBaseDrag(input, pod.geometry, cfcForBase(input, pod.geometry));
    warnings.push(...podBase.warnings);
    const area = pod.count * Math.PI * pod.geometry.baseRadius ** 2;
    terms.push({
      index: -1,
      kind: 'base',
      source: `pod base, × ${String(pod.count)} pods, ${podBase.method}`,
      cdComponent: podBase.cd,
      area,
      cd: (podBase.cd * area) / aRef,
    });
  }

  // Skin friction, eqs. (3.78) to (3.85).
  const friction = skinFrictionCoefficient(
    input.reynolds,
    input.roughnessHeight,
    metres(geometry.length),
  );
  const cfc = compressibleSkinFriction(friction, input.mach, input.reynolds);
  const finenessRatio = geometry.length / d;
  let frictionCd: number;
  if (surfaces.size <= 1 && (surfaces.size === 0 || surfaces.has(input.roughnessHeight))) {
    // Plan 0070: the pods' surfaces are friction surfaces like the body's.
    const podWetted = [...podBodies.values()].reduce(
      (sum, pod) => sum + pod.count * pod.geometry.wettedBody,
      0,
    );
    frictionCd = frictionDragCoefficient(cfc, {
      finenessRatio,
      wettedBodyArea: geometry.wettedBody + podWetted,
      finSets,
      referenceArea: aRef,
    });
  } else {
    // Plan 0073 (D-110): parts of several finishes. The friction force is the sum of each
    // surface's (eq. 3.77), each with its own C_fc from eqs. (3.78) to (3.84) at its own R_s and
    // the rocket's length L (eqs. 3.79, 3.80), and eq. (3.85)'s body and fin factors; with one
    // finish this is eq. (3.85) itself. OpenRocket 24.12 computes each part's friction at its own
    // finish (reference/rockets/finish-probe/values.txt).
    frictionCd = 0;
    for (const [roughness, s] of surfaces) {
      frictionCd += frictionDragCoefficient(
        compressibleFrictionAt(input, roughness, geometry.length),
        { finenessRatio, wettedBodyArea: s.body, finSets: s.fins, referenceArea: aRef },
      );
    }
  }

  if (M >= 0.8 && M <= 1.2) warnings.push(TRANSONIC_DRAG_WARNING);
  else if (M > 1.2) warnings.push(SUPERSONIC_DRAG_WARNING);

  const cd0 = terms.reduce((sum, t) => sum + t.cd, 0) + frictionCd;
  return {
    cd0: dimensionless(finiteResult('zero-angle drag coefficient', cd0)),
    mach: input.mach,
    reynolds: input.reynolds,
    referenceDiameter,
    referenceArea: squareMetres(aRef),
    rocketLength: metres(geometry.length),
    finenessRatio,
    skinFriction: { ...friction, compressible: cfc, cd: frictionCd },
    terms,
    warnings,
  };
}

/** Cubic Hermite step from 0 to 1 with zero slopes at both ends. */
function smoothStep(u: number): number {
  return u * u * (3 - 2 * u);
}

/** The angle of attack at which the scaling peaks, 17° (Niskanen p. 53). */
const PEAK_ANGLE = (17 * Math.PI) / 180;

/**
 * DRAG-14. Niskanen §3.4.7 p. 53: the axial drag coefficient at angle of
 * attack is C_D0 times a two-part polynomial that "starts from 1 at α = 0°,
 * increases to 1.3 at α = 17° and then decreases to zero at α = 90°; the
 * derivative is also zero at these points". Each part is the cubic with
 * those end values and zero end slopes (D-033). Beyond 90° (tail-first
 * flight, which the source does not cover) the function is mirrored,
 * s(α) = s(π − α), and the result is flagged (D-033).
 */
export function axialDragScaling(angleOfAttack: number): { scale: number; beyondSource: boolean } {
  let a = angleOfAttack;
  if (!(a >= 0 && a <= Math.PI))
    throw new InvalidInputError('angle of attack', a, 'must be between 0 and 180 degrees');
  const beyondSource = a > Math.PI / 2;
  if (beyondSource) a = Math.PI - a;
  if (a <= PEAK_ANGLE) return { scale: 1 + 0.3 * smoothStep(a / PEAK_ANGLE), beyondSource };
  return {
    scale: 1.3 * (1 - smoothStep((a - PEAK_ANGLE) / (Math.PI / 2 - PEAK_ANGLE))),
    beyondSource,
  };
}

/** DRAG-14. C_A = C_D0 × s(α). */
export function axialDragCoefficient(cd0: Dimensionless, angleOfAttack: number): Dimensionless {
  return dimensionless(
    finiteResult('axial drag coefficient', (cd0 as number) * axialDragScaling(angleOfAttack).scale),
  );
}
