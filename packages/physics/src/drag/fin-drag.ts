/**
 * Fin pressure drag (plan 0009, DRAG-10). Niskanen §3.4.4 pp. 49 to 50.
 * Coefficients are referred to the fin frontal area N·t·s.
 */
import { InvalidInputError } from '../errors.js';
import type { FinCrossSection } from '../geometry/components.js';
import { finiteResult } from '../numerics/finite.js';
import type { Mach } from '../units/si.js';
import { baseDragCoefficient, stagnationDragCoefficient } from './pressure-drag.js';

/**
 * Eq. (3.89) p. 49 (kept for comparison; the model uses DRAG-20 since D-066):
 * rounded leading edge, flow perpendicular to the edge:
 * (1 − M²)^(−0.417) − 1 for M < 0.9; 1 − 1.785(M − 0.9) for 0.9 ≤ M < 1;
 * 1.214 − 0.502/M² + 0.1095/M⁴ for M ≥ 1.
 */
export function roundedLeadingEdgeDrag(mach: Mach): number {
  const M: number = mach;
  if (!(M >= 0) || !Number.isFinite(M))
    throw new InvalidInputError('Mach number', M, 'must be 0 or greater');
  if (M < 0.9) return (1 - M * M) ** -0.417 - 1;
  if (M < 1) return 1 - 1.785 * (M - 0.9);
  return 1.214 - 0.502 / (M * M) + 0.1095 / M ** 4;
}

/**
 * DRAG-20. DATCOM figure 4.1.5.1-30 (Ref. 19 of section 4.1.5.1, scan p. 751):
 * the pressure drag of a swept cylindrical leading edge,
 * C_D,LE S_ref/(2 r_LE b/cos Λ) = 1.28 M³ cos⁶Λ/(1 + M³ cos³Λ), substantiated
 * for Mach 0.5 to 8 and sweeps 0 to 75° (p. 4.1.5.1-16). Referred to the fin
 * frontal area t·s (2 r_LE = t, leading-edge length s/cos Λ) it is
 * 1.28 M³ cos⁵Λ/(1 + M³ cos³Λ).
 */
export function cylindricalLeadingEdgeDrag(mach: Mach, leadingEdgeSweep: number): number {
  const M: number = mach;
  if (!(M >= 0) || !Number.isFinite(M))
    throw new InvalidInputError('Mach number', M, 'must be 0 or greater');
  const c = Math.cos(leadingEdgeSweep);
  const m3 = M * M * M;
  return (1.28 * m3 * c ** 5) / (1 + m3 * c ** 3);
}

/** The DATCOM correlation's stated range (D-066). */
export const ROUNDED_LEADING_EDGE_WARNING =
  'rounded fin leading edge: the DATCOM cylindrical leading-edge correlation (figure 4.1.5.1-30) was substantiated from Mach 0.5 to 8 and sweeps up to 75°; outside that range it is used as written (the term is small below Mach 0.5)';

export interface FinPressureDrag {
  /** Total, referred to N·t·s. */
  readonly cd: number;
  readonly leadingEdge: number;
  readonly trailingEdge: number;
  readonly warnings: readonly string[];
}

/**
 * DRAG-10. Leading edge: a square profile uses the stagnation drag (3.90)
 * × cos²Γ_L for the leading-edge sweep (3.91); a rounded profile the DATCOM
 * cylindrical leading-edge correlation (DRAG-20, D-066; until plan 0029 the
 * thesis's eq. 3.89 × cos²Γ_L). An airfoil (sharp-nosed) profile carries no leading-edge pressure
 * drag: the DATCOM refers the leading-edge pressure drag to the leading-edge
 * frontal area 2 r_LE b/cos Λ (figure 4.1.5.1-30 and eq. 4.1.5.1-n), which
 * is zero for a sharp edge; its wave drag comes from DRAG-18/19 instead
 * (D-062; the thesis applied (3.89) to the whole thickness, the cause of the
 * early transonic drag rise found in plan 0025). Trailing edge (3.92):
 * square = base drag (3.94), rounded = half of it, airfoil = 0. Sum (3.93).
 * A wedge (sharp leading edge, blunt trailing edge of the full thickness)
 * has no leading-edge term and the square trailing edge; a double wedge
 * (sharp at both edges) has neither (D-066).
 */
export function finPressureDrag(
  crossSection: FinCrossSection,
  leadingEdgeSweep: number,
  mach: Mach,
): FinPressureDrag {
  if (!(leadingEdgeSweep >= 0 && leadingEdgeSweep < Math.PI / 2)) {
    throw new InvalidInputError(
      'leading-edge sweep angle',
      leadingEdgeSweep,
      'must be between 0 and 90 degrees',
    );
  }
  const warnings: string[] = [];
  let leadingEdge = 0;
  if (crossSection === 'square') {
    leadingEdge = stagnationDragCoefficient(mach) * Math.cos(leadingEdgeSweep) ** 2;
  } else if (crossSection === 'rounded') {
    leadingEdge = cylindricalLeadingEdgeDrag(mach, leadingEdgeSweep);
    const M: number = mach;
    if (M < 0.5 || M > 8 || leadingEdgeSweep > (75 * Math.PI) / 180) {
      warnings.push(ROUNDED_LEADING_EDGE_WARNING);
    }
  }
  const base = baseDragCoefficient(mach);
  const trailingEdge =
    crossSection === 'square' || crossSection === 'wedge'
      ? base
      : crossSection === 'rounded'
        ? base / 2
        : 0;
  return {
    cd: finiteResult('fin pressure drag', leadingEdge + trailingEdge),
    leadingEdge: finiteResult('fin leading-edge drag', leadingEdge),
    trailingEdge,
    warnings,
  };
}
