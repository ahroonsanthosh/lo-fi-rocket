/**
 * Checks that a replayed Monte Carlo run reproduces the stored run (D-061).
 *
 * Replaying a run re-runs the simulator on the identical perturbed design,
 * which is deterministic for one build; a batch produced by another app
 * version or another physics source may replay differently. Two checks,
 * both reported to the user, neither ever hidden or corrected:
 * 1. the provenance stored with the batch against the running build;
 * 2. the replayed landing point against the stored one, exactly. The
 *    replayed point is taken from the flight summary by the same
 *    expressions the batch used (`flyRun` in packages/formats,
 *    east = d sin ψ, north = d cos ψ), so a faithful replay is bit-identical.
 */
import type { DispersionRun } from '@lo-fi-rocket/formats';
import type { FlightSummary } from '@lo-fi-rocket/physics';
import { sameProvenance, type BuildProvenance } from '../build/provenance.js';

export interface LandingPoint {
  readonly east: number;
  readonly north: number;
}

export interface ReplayCheck {
  /** Set when the batch was produced by another app version or physics source. */
  readonly provenance:
    { readonly stored: BuildProvenance; readonly current: BuildProvenance } | undefined;
  /** Set when the replayed landing point is not the stored one (including landed against not landed). */
  readonly landing:
    | { readonly stored: LandingPoint | undefined; readonly replayed: LandingPoint | undefined }
    | undefined;
}

/** The landing point of a flight, as the Monte Carlo batch records it; undefined when it did not land. */
export function landingPointOf(summary: FlightSummary): LandingPoint | undefined {
  const d = summary.landingDistance;
  const dir = summary.landingDirection;
  if (d === undefined || dir === undefined) return undefined;
  return { east: d * Math.sin(dir), north: d * Math.cos(dir) };
}

/** The landing point a stored run recorded; undefined when it did not land. */
export function storedLandingPoint(run: DispersionRun): LandingPoint | undefined {
  if (run.landingEast === undefined || run.landingNorth === undefined) return undefined;
  return { east: run.landingEast, north: run.landingNorth };
}

function samePoint(a: LandingPoint | undefined, b: LandingPoint | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.east === b.east && a.north === b.north;
}

export function checkReplay(
  run: DispersionRun,
  storedProvenance: BuildProvenance,
  replayed: FlightSummary,
  current: BuildProvenance,
): ReplayCheck {
  const stored = storedLandingPoint(run);
  const again = landingPointOf(replayed);
  return {
    provenance: sameProvenance(storedProvenance, current)
      ? undefined
      : { stored: storedProvenance, current },
    landing: samePoint(stored, again) ? undefined : { stored, replayed: again },
  };
}

export function replayMatches(check: ReplayCheck): boolean {
  return check.provenance === undefined && check.landing === undefined;
}
