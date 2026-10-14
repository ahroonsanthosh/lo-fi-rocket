/**
 * The ejection delay a newly chosen motor gets (issue #10). The delay
 * decides when the parachute comes out, so it is never changed without
 * saying so: the previous delay is kept when the new motor is sold with
 * it, otherwise the nearest one is taken and the note says what changed.
 */
import { seconds, type Seconds } from '@lo-fi-rocket/physics';

export interface DelayChoice {
  /** The delay to store; undefined for a plugged motor (no ejection charge). */
  readonly delay: Seconds | undefined;
  /** What changed and why, for the user; undefined when the previous delay was kept. */
  readonly note: string | undefined;
}

function list(delays: readonly number[]): string {
  return delays.map((d) => String(d)).join(', ');
}

/**
 * Choose the delay for `name`, which the data file lists as `offered`
 * (seconds, 'plugged', or undefined when the file gives none), after a
 * motor whose delay was `previous` (undefined: none or plugged).
 *
 * - The previous delay, when the new motor offers it.
 * - Otherwise the offered delay nearest to it. On a tie, the longer: just
 *   before apogee the rocket still climbs and slows by gravity and drag
 *   together, so it is faster at a given time before apogee than after it,
 *   and a late deployment is the gentler of the two.
 * - With no previous delay, the shortest delay above 0 s (0 s is a
 *   booster's: ejection at burnout, at full speed), and the note asks the
 *   user to choose the delay for the rocket.
 * - A file with no delays keeps the previous delay, or plugged, and says so.
 */
export function chooseDelay(
  name: string,
  offered: readonly Seconds[] | 'plugged' | undefined,
  previous: Seconds | undefined,
): DelayChoice {
  if (offered === 'plugged') {
    return {
      delay: undefined,
      note:
        previous === undefined
          ? `The ${name} is plugged (no ejection charge): deploy the recovery with an altimeter or timer.`
          : `The ${name} is plugged (no ejection charge), so the ${String(previous)} s delay no longer applies: deploy the recovery with an altimeter or timer.`,
    };
  }
  if (offered === undefined || offered.length === 0) {
    return previous === undefined
      ? {
          delay: undefined,
          note: `The ${name}'s file lists no delays, so it is treated as plugged (no ejection charge). Enter its delay below if it has one.`,
        }
      : {
          delay: previous,
          note: `The ${name}'s file lists no delays: the ${String(previous)} s delay was kept. Check it against the motor you fly.`,
        };
  }
  const sorted = [...offered].sort((a, b) => a - b);
  if (previous !== undefined) {
    if (sorted.includes(previous)) return { delay: previous, note: undefined };
    let best = sorted[0] ?? seconds(0);
    for (const d of sorted) {
      // Ascending order and "<=" make a tie go to the longer delay.
      if (Math.abs(d - previous) <= Math.abs(best - previous)) best = d;
    }
    return {
      delay: best,
      note: `Delay changed from ${String(previous)} s to ${String(best)} s: the ${name} is sold with ${list(sorted)} s.`,
    };
  }
  const first = sorted.find((d) => d > 0);
  if (first === undefined) {
    return {
      delay: seconds(0),
      note: `The ${name} is sold with a 0 s delay only: a booster motor, whose charge fires at burnout at full speed.`,
    };
  }
  return {
    delay: first,
    note: `Delay set to ${String(first)} s, the shortest above 0 s of the ${name}'s ${list(sorted)} s. Choose the delay that fits your rocket.`,
  };
}
