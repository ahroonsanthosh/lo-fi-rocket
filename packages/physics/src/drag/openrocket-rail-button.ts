/**
 * DRAG-23 (plan 0071, D-108): OpenRocket 24.12's rail button drag, for the OpenRocket-equivalent
 * mode only. The owner chose to reproduce it there (2026-10-14, option (c) of plan 0071), so that
 * the comparison mode follows OpenRocket instead of offsetting Niskanen's larger rail button drag
 * (DRAG-12) with a base drag rule OpenRocket does not apply.
 *
 * Not from an approved source of equations: OpenRocket was run as a black box (CLAUDE.md
 * section 3) and its rail button drag measured (reference/rockets/drag-probe/). The probe found:
 * - one button's C_D·A is a coefficient K times its frontal area
 *   A = OD (base + flange) + ID (height − base − flange), exactly linear in each (sweeps);
 * - K depends on the Mach number and on η = height / δ only, with δ = 0.37 x Re_x^−0.2 the
 *   turbulent flat-plate boundary-layer thickness at the button's front, x from the nose tip and
 *   Re_x = V x / ν (eight positions at the same η agree within 0.05 %; rail-button-collapse.csv);
 * - not on the rocket's length, the body radius, the fins or the other buttons; each of several
 *   buttons counts at its own position.
 * K is tabulated against η and Mach (OPENROCKET_RAIL_BUTTON_TABLE) and interpolated log-log in η,
 * linearly in Mach. On 80 random buttons held out of the table it gives OpenRocket's figure
 * within 0.82 % (rms 0.23 %).
 *
 * Validity: Mach 0.01 to 5 and η from 0.1 to 100, as tabulated. Below the table's η, K is taken
 * proportional to η² (the table's own slope there, 1.97 to 2.07); above it, and outside the Mach
 * range, the nearest tabulated value is held. ν is the flight's own: OpenRocket's viscosity model
 * differs from the 1976 Standard Atmosphere's by about 1.3 % at 293 K, which moves K by about
 * 0.4 %.
 */
import { InvalidInputError } from '../errors.js';
import { finiteResult } from '../numerics/finite.js';
import { OPENROCKET_RAIL_BUTTON_TABLE } from './openrocket-rail-button-table.js';

type Row = readonly (readonly [number, number])[];

/** K at η on one Mach row: log-log interpolation, ∝ η² below the row, held above it. */
function rowCoefficient(row: Row, eta: number): number {
  const first = row[0];
  const last = row[row.length - 1];
  if (first === undefined || last === undefined) throw new Error('empty rail button table row');
  if (eta <= first[0]) return first[1] * (eta / first[0]) ** 2;
  if (eta >= last[0]) return last[1];
  let lo = 0;
  let hi = row.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((row[mid]?.[0] ?? 0) <= eta) lo = mid;
    else hi = mid;
  }
  const a = row[lo];
  const b = row[hi];
  if (a === undefined || b === undefined) throw new Error('rail button table lookup');
  const t = Math.log(eta / a[0]) / Math.log(b[0] / a[0]);
  return Math.exp(Math.log(a[1]) + t * Math.log(b[1] / a[1]));
}

/** K at (Mach, η): linear in Mach between the rows, the nearest row outside them. */
export function openRocketRailButtonCoefficient(mach: number, eta: number): number {
  if (!(mach >= 0)) throw new InvalidInputError('Mach number', mach, 'must be 0 or greater');
  if (!(eta >= 0)) throw new InvalidInputError('rail button η', eta, 'must be 0 or greater');
  const rows = OPENROCKET_RAIL_BUTTON_TABLE;
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (first === undefined || last === undefined) throw new Error('empty rail button table');
  if (mach <= first[0]) return rowCoefficient(first[1], eta);
  if (mach >= last[0]) return rowCoefficient(last[1], eta);
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1];
    const b = rows[i];
    if (a === undefined || b === undefined) continue;
    if (mach <= b[0]) {
      const t = (mach - a[0]) / (b[0] - a[0]);
      return (1 - t) * rowCoefficient(a[1], eta) + t * rowCoefficient(b[1], eta);
    }
  }
  return rowCoefficient(last[1], eta);
}

export interface OpenRocketRailButtonInput {
  readonly outerDiameter: number;
  readonly innerDiameter: number;
  readonly totalHeight: number;
  readonly baseHeight: number;
  readonly flangeHeight: number;
  /** The front of each button from the nose tip, m. */
  readonly positions: readonly number[];
  readonly mach: number;
  /** V/ν, 1/m: the Reynolds number per metre of the flow. */
  readonly reynoldsPerMetre: number;
}

/**
 * The buttons' total C_D·A (m², on the free-stream dynamic pressure) and their total frontal area
 * (m²), by DRAG-23.
 */
export function openRocketRailButtonDrag(input: OpenRocketRailButtonInput): {
  readonly cdA: number;
  readonly area: number;
} {
  const { outerDiameter: od, innerDiameter: id, totalHeight: h } = input;
  const { baseHeight: base, flangeHeight: flange } = input;
  if (!(od > 0))
    throw new InvalidInputError('rail button outer diameter', od, 'must be greater than 0 m');
  if (!(id >= 0 && id <= od))
    throw new InvalidInputError(
      'rail button inner diameter',
      id,
      'must be between 0 and the outer diameter',
    );
  if (!(h > 0)) throw new InvalidInputError('rail button height', h, 'must be greater than 0 m');
  if (!(base >= 0 && flange >= 0 && base + flange <= h)) {
    throw new InvalidInputError(
      'rail button base and flange heights',
      base + flange,
      'must be 0 m or more and add up to no more than the height',
    );
  }
  if (!(input.reynoldsPerMetre >= 0))
    throw new InvalidInputError(
      'Reynolds number per metre',
      input.reynoldsPerMetre,
      'must be 0 or greater',
    );
  const one = od * (base + flange) + id * (h - base - flange);
  let cdA = 0;
  for (const x of input.positions) {
    if (!(x > 0))
      throw new InvalidInputError('rail button position', x, 'must be behind the nose tip');
    // At rest there is no flow and no drag (the boundary layer's thickness has no limit).
    if (input.reynoldsPerMetre === 0) continue;
    const delta = 0.37 * x * (input.reynoldsPerMetre * x) ** -0.2;
    cdA += openRocketRailButtonCoefficient(input.mach, h / delta) * one;
  }
  return {
    cdA: finiteResult('rail button drag', cdA),
    area: one * input.positions.length,
  };
}
