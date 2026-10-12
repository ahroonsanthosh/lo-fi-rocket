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
import type { Component, TrapezoidFinSetComponent } from '../geometry/components.js';
import { noseProfile, transitionProfile, type Profile } from '../geometry/profiles.js';
import { DEFAULT_PANELS, integrate } from '../geometry/revolution.js';
import { finiteResult } from '../numerics/finite.js';
import { maximumBodyDiameter } from '../stability/barrowman.js';
import {
  dimensionless,
  metres,
  squareMetres,
  type Dimensionless,
  type Mach,
  type Metres,
  type SquareMetres,
} from '../units/si.js';
import { baseDragArea, launchLugDrag, railButtonDrag } from './base-parasitic.js';
import { finPressureDrag } from './fin-drag.js';
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

/** Mean aerodynamic chord of a trapezoidal fin, eq. (3.30) p. 26 evaluated for the trapezoid: (2/3)(c_r² + c_r c_t + c_t²)/(c_r + c_t). */
export function meanAerodynamicChord(fin: TrapezoidFinSetComponent): number {
  const cr: number = fin.rootChord;
  const ct: number = fin.tipChord;
  return ((2 / 3) * (cr * cr + cr * ct + ct * ct)) / (cr + ct);
}

export interface DragInputs {
  readonly components: readonly PlacedComponent[];
  readonly mach: Mach;
  /** Reynolds number based on the rocket length (DYN-8). */
  readonly reynolds: number;
  /** Surface roughness height R_s (Table 3.2); the same finish on every external surface. */
  readonly roughnessHeight: Metres;
  /** The motor in the base, if any, and whether it is thrusting now. */
  readonly motor?: { readonly diameter: Metres; readonly thrusting: boolean };
  /**
   * When the motor's area is removed from the base drag area (DRAG-11):
   * 'while-thrusting' is Niskanen p. 51 ("the thrusting motors"); 'always'
   * reproduces OpenRocket 24.12, which keeps it removed after burnout
   * (observed in the reference time series, D-035). Comparisons only.
   */
  readonly baseDragMotorRule: 'while-thrusting' | 'always';
  readonly referenceDiameter?: Metres;
}

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
  readonly skinFriction: SkinFriction & { readonly compressible: number; readonly cd: number };
  readonly terms: readonly DragTerm[];
  readonly warnings: readonly string[];
}

interface ExternalGeometry {
  length: number;
  wettedBody: number;
  baseRadius: number;
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
        const cr: number = c.rootChord;
        const ct: number = c.tipChord;
        const s: number = c.span;
        const t: number = c.thickness;
        const planform = ((cr + ct) / 2) * s;
        return {
          ...none,
          kind: 'fins',
          area: c.count * t * s,
          finWetted: 2 * c.count * planform,
          finThickness: t,
          finMeanChord: meanAerodynamicChord(c),
          finSweepAngle: Math.atan((c.sweep as number) / s),
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
  const geometry: ExternalGeometry = { length: 0, wettedBody: 0, baseRadius: 0 };
  const finSets: { wettedArea: number; thickness: number; meanChord: number }[] = [];

  const statics = staticEntries(input.components);
  input.components.forEach(({ component: c }, index) => {
    const st = statics[index];
    if (st === undefined) return;
    switch (c.kind) {
      case 'noseCone': {
        geometry.length += st.length;
        geometry.wettedBody += st.wetted;
        geometry.baseRadius = st.aftRadius;
        const r = noseConePressureDrag(
          c.shape,
          c.shapeParameter,
          st.finenessRatio,
          st.jointAngle,
          input.mach,
        );
        warnings.push(...r.warnings);
        terms.push({
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
        geometry.length += st.length;
        geometry.wettedBody += st.wetted;
        geometry.baseRadius = st.aftRadius;
        break;
      }
      case 'transition': {
        geometry.length += st.length;
        geometry.wettedBody += st.wetted;
        geometry.baseRadius = st.aftRadius;
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
          terms.push({
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
          terms.push({
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
            'must be square, rounded or airfoil for the drag model (Niskanen §3.4.4)',
          );
        }
        finSets.push({
          wettedArea: st.finWetted,
          thickness: st.finThickness,
          meanChord: st.finMeanChord,
        });
        const r = finPressureDrag(c.crossSection, st.finSweepAngle, input.mach);
        terms.push({
          index,
          kind: c.kind,
          source: `fin pressure (${c.crossSection}, LE ${r.leadingEdge.toFixed(4)} + TE ${r.trailingEdge.toFixed(4)})`,
          cdComponent: r.cd,
          area: st.area,
          cd: (r.cd * st.area) / aRef,
        });
        break;
      }
      case 'launchLug': {
        const r = launchLugDrag(
          c.length,
          c.outerRadius,
          (c.outerRadius as number) - (c.wallThickness as number),
          input.mach,
        );
        terms.push({
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
        const r = railButtonDrag(c.outerDiameter, c.totalHeight, input.mach);
        const area = r.area * c.count;
        terms.push({
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
  // Base drag, eq. (3.94), on the base minus the thrusting motor (p. 51).
  const motor = input.motor;
  const removeMotor =
    motor !== undefined && (motor.thrusting || input.baseDragMotorRule === 'always');
  const baseArea = baseDragArea(geometry.baseRadius, removeMotor ? motor.diameter : undefined);
  const baseCd = baseDragCoefficient(input.mach);
  terms.push({
    index: -1,
    kind: 'base',
    source: removeMotor ? `base (motor area removed, ${input.baseDragMotorRule})` : 'base (full)',
    cdComponent: baseCd,
    area: baseArea,
    cd: (baseCd * baseArea) / aRef,
  });

  // Skin friction, eqs. (3.78) to (3.85).
  const friction = skinFrictionCoefficient(
    input.reynolds,
    input.roughnessHeight,
    metres(geometry.length),
  );
  const cfc = compressibleSkinFriction(friction, input.mach, input.reynolds);
  const finenessRatio = geometry.length / d;
  const frictionCd = frictionDragCoefficient(cfc, {
    finenessRatio,
    wettedBodyArea: geometry.wettedBody,
    finSets,
    referenceArea: aRef,
  });

  if (M >= 0.8 && M <= 1.2)
    warnings.push(
      `transonic regime (Mach ${M.toFixed(3)}): accuracy is lower than in subsonic flight (CLAUDE.md 6.3, Niskanen Table 3.1)`,
    );

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
