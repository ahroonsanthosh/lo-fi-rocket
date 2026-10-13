/**
 * The confidence report (D-083, plan 0055). Every design is simulated; where a
 * part, setting or flight condition is not modelled exactly, the simulator
 * uses a documented approximation and lists it here, so a result always says
 * what was approximated and how far to trust it (CLAUDE.md 1 rules 3 and 8).
 */
import type { ClusterOffset } from './geometry/assembly.js';
import type { Component } from './geometry/components.js';

/**
 * How much an approximation can move the results that matter for safety
 * (stability margin, rail exit speed, apogee, deployment speed, landing):
 * minor, under about 1 % or not on those results at all; moderate, a few
 * per cent; major, the results may be wrong in kind (for example a staged
 * flight flown as one body).
 */
export type ApproximationImpact = 'minor' | 'moderate' | 'major';

export interface Approximation {
  /** The part or setting concerned, as the user named it, e.g. `Fin set "Main fins"`. */
  readonly subject: string;
  /** What is not modelled exactly, in plain words. */
  readonly what: string;
  /** How it is simulated instead. */
  readonly method: string;
  /** What that does to the results, in plain words. */
  readonly effect: string;
  readonly impact: ApproximationImpact;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface Confidence {
  readonly level: ConfidenceLevel;
  /** One plain sentence for the results panel. */
  readonly summary: string;
}

/**
 * The overall confidence of a result from its approximations: high when there
 * are none or only minor ones, medium when any is moderate, low when any is
 * major. A rule of this app (D-083), not a measured accuracy.
 */
export function confidenceOf(approximations: readonly Approximation[]): Confidence {
  const count = (impact: ApproximationImpact): number =>
    approximations.filter((a) => a.impact === impact).length;
  const major = count('major');
  const moderate = count('moderate');
  const minor = count('minor');
  const plural = (n: number, word: string): string => `${String(n)} ${word}${n === 1 ? '' : 's'}`;
  if (major > 0) {
    return {
      level: 'low',
      summary: `Low confidence: ${plural(major, 'part')} of this design ${major === 1 ? 'is' : 'are'} approximated in a way that can change the results a lot. Treat the figures as rough until ${major === 1 ? 'it is' : 'they are'} modelled.`,
    };
  }
  if (moderate > 0) {
    return {
      level: 'medium',
      summary: `Medium confidence: ${plural(moderate, 'approximation')} can move the results by a few per cent. See the list for what and why.`,
    };
  }
  return {
    level: 'high',
    summary:
      minor === 0
        ? 'High confidence: every part of this design is modelled by the app’s sourced methods.'
        : `High confidence: ${plural(minor, 'small approximation')}, each under about 1 % on the key results.`,
  };
}

/**
 * Approximations known from the components alone, before any flight: what the
 * mass and aerodynamic models do not represent exactly.
 */
export function componentApproximations(
  components: readonly {
    readonly name?: string;
    readonly component: Component;
    readonly approximations?: readonly Approximation[];
  }[],
): Approximation[] {
  const out: Approximation[] = [];
  for (const { name, component, approximations } of components) {
    // Approximations a part carries from where it came from (an import, D-084).
    out.push(...(approximations ?? []));
    if (component.kind === 'finSet' && component.shape !== undefined) {
      // D-087: Niskanen's general-planform methods use the real outline; the methods written for
      // trapezoids only use the equivalent trapezoid (same span, root chord, area and CP).
      out.push({
        subject: `Fin set${name === undefined ? '' : ` "${name}"`}`,
        what: `the ${component.shape.kind} planform in the methods written for trapezoids (DATCOM large-angle and supersonic fin forces, fin wave drag, TN 4197 flutter)`,
        method: 'a trapezoid with the same span, root chord, area and centre of pressure',
        effect:
          'small at subsonic speeds and angles of attack, where Niskanen’s methods for any planform are used; the supersonic fin force, the fin forces past about 10° and the flutter speed are those of the trapezoid',
        impact: 'minor',
      });
    }
    if (
      component.kind === 'finSet' &&
      (component.crossSection === 'rounded' || component.crossSection === 'airfoil')
    ) {
      // D-077: no approved source gives the volume of a rounded or airfoil fin; the slab is kept.
      out.push({
        subject: `Fin set${name === undefined ? '' : ` "${name}"`}`,
        what: `the volume of ${component.crossSection} fin edges`,
        method: 'mass taken as a flat slab of the same outline (area × thickness × density)',
        effect: `the fins weigh slightly more than they are (OpenRocket uses ${component.crossSection === 'rounded' ? '99' : '85'} % of the slab), putting the CG slightly aft: the stability margin shown is a little low, the cautious side`,
        impact: 'minor',
      });
    }
  }
  return out;
}

/**
 * Approximations of a motor cluster (plan 0057). The thrust is taken along the axis, which is
 * exact when the motors are centred on it, as all of OpenRocket's layouts are; and the pitch and
 * yaw inertias are averaged (GEO-15), exact for layouts with three-fold or higher symmetry.
 */
export function clusterApproximations(
  cluster: readonly ClusterOffset[] | undefined,
): Approximation[] {
  if (cluster === undefined || cluster.length === 0) return [];
  const n = cluster.length;
  let sy = 0;
  let sz = 0;
  let syy = 0;
  let szz = 0;
  let syz = 0;
  for (const o of cluster) {
    const y: number = o.y;
    const z: number = o.z;
    sy += y;
    sz += z;
    syy += y * y;
    szz += z * z;
    syz += y * z;
  }
  // Numerical tolerance, not a physical threshold: a layout's offsets are rounded (to float64 from
  // its trigonometry, or to the decimals of a file), so sums within a millionth of the layout's
  // size (14 nm for a 25 mm 3-ring) are a centred layout.
  const tolerance = 1e-6;
  const size = Math.sqrt((syy + szz) / n);
  const out: Approximation[] = [];
  const centre = Math.hypot(sy / n, sz / n);
  if (centre > tolerance * size) {
    out.push({
      subject: 'Motor cluster',
      what: `a layout whose thrust centre is ${(centre * 1000).toFixed(1)} mm off the rocket’s axis`,
      method: 'the total thrust along the axis',
      effect:
        'the turning moment of off-centre thrust is not simulated: a real rocket would veer, and could be unstable leaving the rail',
      impact: 'major',
    });
  }
  if (Math.abs(syy - szz) + 2 * Math.abs(syz) > tolerance * (syy + szz)) {
    out.push({
      subject: 'Motor cluster',
      what: 'the different pitch and yaw inertias of a layout without three-fold symmetry',
      method: 'their average',
      effect:
        'the pitching motion differs slightly between the two planes; the trajectory changes little',
      impact: 'minor',
    });
  }
  return out;
}
