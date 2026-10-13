/**
 * The confidence report (D-083, plan 0055). Every design is simulated; where a
 * part, setting or flight condition is not modelled exactly, the simulator
 * uses a documented approximation and lists it here, so a result always says
 * what was approximated and how far to trust it (CLAUDE.md 1 rules 3 and 8).
 */
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
