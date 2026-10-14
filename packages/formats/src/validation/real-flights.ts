/**
 * Plan 0080 (D-119): what real flights say about the apogee this simulator shows. The ratios
 * below are each flown rocket's measured apogee divided by our displayed-mode apogee, from the
 * flown rockets among RASAero II 1.0.2.0's examples (altimeter, GPS, accelerometer or optical
 * tracking). They are measured facts about the model, never inputs to it: no model constant is
 * fitted to them (CLAUDE.md 7.4). The owner chose to show them beside every apogee as a labelled
 * range (D-119). `real-flights.data.json` is written by `real-flights.test.ts`
 * (REAL_FLIGHTS_WRITE=1); do not edit it by hand.
 */
import data from './real-flights.data.json' with { type: 'json' };

/** Measured over predicted apogee for the flights of one speed range. */
export interface RealFlightRatios {
  readonly flights: number;
  readonly low: number;
  readonly median: number;
  readonly high: number;
}

/** The flights split at this maximum Mach number (plan 0080 section 2). */
export const REAL_FLIGHT_MACH_SPLIT = 0.95;

/** The ratios as the benchmark last wrote them (`real-flights.data.json`). */
export const REAL_FLIGHTS: { readonly below: RealFlightRatios; readonly above: RealFlightRatios } =
  data;

/** A flight's apogee as the measured flights of its speed range suggest it. */
export interface RealFlightRange {
  /** Whether the flight stays below the Mach split. */
  readonly below: boolean;
  readonly flights: number;
  readonly lowRatio: number;
  readonly medianRatio: number;
  readonly highRatio: number;
  /** The apogee times each ratio, metres. */
  readonly low: number;
  readonly median: number;
  readonly high: number;
}

/** The range real flights suggest for a displayed-mode apogee, or undefined without flights. */
export function realFlightRange(
  apogee: number,
  maxMach: number,
  data: typeof REAL_FLIGHTS = REAL_FLIGHTS,
): RealFlightRange | undefined {
  const below = maxMach < REAL_FLIGHT_MACH_SPLIT;
  const r = below ? data.below : data.above;
  if (r.flights === 0 || !Number.isFinite(apogee)) return undefined;
  return {
    below,
    flights: r.flights,
    lowRatio: r.low,
    medianRatio: r.median,
    highRatio: r.high,
    low: apogee * r.low,
    median: apogee * r.median,
    high: apogee * r.high,
  };
}
