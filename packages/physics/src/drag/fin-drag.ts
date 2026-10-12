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
 * Eq. (3.89) p. 49: rounded leading edge, flow perpendicular to the edge:
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

export interface FinPressureDrag {
  /** Total, referred to N·t·s. */
  readonly cd: number;
  readonly leadingEdge: number;
  readonly trailingEdge: number;
}

/**
 * DRAG-10. Leading edge: a rounded profile uses eq. (3.89); a square profile
 * the stagnation drag (3.90); both × cos²Γ_L for the leading-edge sweep
 * (3.91). An airfoil (sharp-nosed) profile carries no leading-edge pressure
 * drag: the DATCOM refers the leading-edge pressure drag to the leading-edge
 * frontal area 2 r_LE b/cos Λ (figure 4.1.5.1-30 and eq. 4.1.5.1-n), which
 * is zero for a sharp edge; its wave drag comes from DRAG-18/19 instead
 * (D-062; the thesis applied (3.89) to the whole thickness, the cause of the
 * early transonic drag rise found in plan 0025). Trailing edge (3.92):
 * square = base drag (3.94), rounded = half of it, airfoil = 0. Sum (3.93).
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
  const perpendicular =
    crossSection === 'square'
      ? stagnationDragCoefficient(mach)
      : crossSection === 'rounded'
        ? roundedLeadingEdgeDrag(mach)
        : 0;
  const leadingEdge = perpendicular * Math.cos(leadingEdgeSweep) ** 2;
  const base = baseDragCoefficient(mach);
  const trailingEdge = crossSection === 'square' ? base : crossSection === 'rounded' ? base / 2 : 0;
  return {
    cd: finiteResult('fin pressure drag', leadingEdge + trailingEdge),
    leadingEdge: finiteResult('fin leading-edge drag', leadingEdge),
    trailingEdge,
  };
}
