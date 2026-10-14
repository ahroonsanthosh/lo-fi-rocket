/**
 * Recovery device drag (plan 0073 part 2): the parachute of Niskanen (2009) p. 67, C_D on the
 * canopy area, and the streamer of Appendix C (STREAM-1).
 */
import { InvalidInputError } from '../errors.js';
import type { Approximation } from '../fidelity.js';
import { finiteResult } from '../numerics/finite.js';
import type { RecoveryDevice, StreamerDevice } from './vehicle.js';

/**
 * The streamers Appendix C measured: lengths about 0.2 to 1 m and widths about 0.02 to 0.09 m
 * (Figure C.1 p. 113, read from the plot; the text gives no range), surface densities 10 to
 * 80 g/m² (Table C.1 p. 116). In SI.
 */
export const STREAMER_MEASURED_RANGE = {
  length: [0.2, 1],
  width: [0.02, 0.09],
  surfaceDensity: [0.01, 0.08],
} as const;

/**
 * STREAM-1. Niskanen (2009) Appendix C, eq. (C.6) p. 115: a streamer's drag coefficient on its
 * strip area w l,
 *   C_D = 0.034 · ((ρ_m + 25 g/m²)/(105 g/m²)) · ((l + 1 m)/l),
 * an empirical fit to wind tunnel measurements at 6, 9 and 12 m/s (p. 112) of polyethylene,
 * cellophane and crêpe paper strips. The thesis validates it within 12 to 27 % on an independent
 * set (Table C.2) and quotes about 20 % on C_D, 15 % on the descent speed (p. 68). The rocket is
 * taken as a point mass at the end of the streamer (p. 111).
 */
export function streamerDragCoefficient(strip: {
  readonly length: number;
  readonly width: number;
  readonly surfaceDensity: number;
}): number {
  const { length: l, width: w, surfaceDensity: rho } = strip;
  if (!(l > 0 && Number.isFinite(l)))
    throw new InvalidInputError('streamer length', l, 'must be greater than 0 m');
  if (!(w > 0 && Number.isFinite(w)))
    throw new InvalidInputError('streamer width', w, 'must be greater than 0 m');
  if (!(rho >= 0 && Number.isFinite(rho)))
    throw new InvalidInputError('streamer surface density', rho, 'must be 0 kg/m² or more');
  // Eq. (C.6) in SI: 25 g/m² = 0.025 kg/m², 105 g/m² = 0.105 kg/m², 1 m.
  return finiteResult('streamer drag coefficient', 0.034 * ((rho + 0.025) / 0.105) * ((l + 1) / l));
}

/**
 * How a streamer's automatic drag coefficient is found: 'niskanen' is eq. (C.6) (STREAM-1);
 * 'openrocket' is OpenRocket 24.12's, the same equation capped at 0.4 (`FinishProbe` part 3,
 * reference/rockets/finish-probe/values.txt), for the OpenRocket-equivalent mode.
 */
export type StreamerDragMethod = 'niskanen' | 'openrocket';

/** OpenRocket 24.12's largest automatic streamer C_D (`Streamer.MAX_COMPUTED_CD`, FinishProbe). */
export const OPENROCKET_STREAMER_CD_LIMIT = 0.4;

/** A device's drag coefficient times its reference area, m², once deployed. */
export function recoveryDragArea(
  device: RecoveryDevice,
  method: StreamerDragMethod = 'niskanen',
): number {
  if (device.kind === 'streamer') {
    const auto = (): number => {
      const cd = streamerDragCoefficient(device);
      return method === 'openrocket' ? Math.min(cd, OPENROCKET_STREAMER_CD_LIMIT) : cd;
    };
    const cd = device.dragCoefficient ?? auto();
    if (!(cd > 0 && Number.isFinite(cd)))
      throw new InvalidInputError(
        `streamer "${device.name}" drag coefficient`,
        cd,
        'must be greater than 0',
      );
    return cd * (device.width as number) * (device.length as number);
  }
  const d: number = device.diameter;
  if (!(d > 0 && Number.isFinite(d)))
    throw new InvalidInputError(`"${device.name}" canopy diameter`, d, 'must be greater than 0 m');
  // The canopy area as DYN-14 has always computed it, so that every result is unchanged to the bit.
  return device.dragCoefficient * ((Math.PI * d ** 2) / 4);
}

/** Which of a streamer's dimensions lie outside the streamers Appendix C measured. */
export function streamerOutsideMeasured(device: StreamerDevice): readonly string[] {
  const r = STREAMER_MEASURED_RANGE;
  const out: string[] = [];
  const outside = (v: number, [lo, hi]: readonly [number, number]): boolean => v < lo || v > hi;
  if (outside(device.length, r.length)) out.push('length');
  if (outside(device.width, r.width)) out.push('width');
  if (outside(device.surfaceDensity, r.surfaceDensity)) out.push('surface density');
  return out;
}

/**
 * Rule 3 (D-083): a streamer whose drag comes from eq. (C.6) outside the strips Appendix C
 * measured is listed. One with its own drag coefficient is the user's figure and is not.
 */
export function recoveryApproximations(devices: readonly RecoveryDevice[]): Approximation[] {
  return devices.flatMap((d) => {
    if (d.kind !== 'streamer' || d.dragCoefficient !== undefined) return [];
    const outside = streamerOutsideMeasured(d);
    if (outside.length === 0) return [];
    return [
      {
        subject: `Streamer "${d.name}"`,
        what: `a streamer ${outside.join(' and ')} outside the strips Niskanen measured (0.2 to 1 m long, 0.02 to 0.09 m wide, 10 to 80 g/m²)`,
        method: 'his eq. (C.6) used beyond them',
        effect:
          'the descent speed may be further from the real one than the ±15 % the equation gives inside them; enter a measured drag coefficient if you have one',
        impact: 'moderate',
      },
    ];
  });
}
