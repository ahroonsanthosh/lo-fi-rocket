# Plan 0042: review finding F-4, report every recovery device that never opens

Lane: physics. Finding: `docs/review/findings.md` F-4 (critical). M-4 covers ejection-charge devices in its own change.

## Problem

A device that never opened produced no warning. The flight came out ballistic and the result looked like a recovered flight. The review's cases:

- a main set to 500 m above a 168.9 m apogee;
- a parachute 100 s after apogee in 5 m/s wind, landing at 38.8 m/s;
- a single parachute at 500 m, where the run ends at the model limit and the device is never mentioned.

## Change

`simulate.ts`, after the flight: for every apogee- or altitude-triggered device that did not open, a plain-language warning naming it, with the reason and what to do:

- apogee not reached before the flight ended;
- a delay after apogee, or after the altitude crossing, that falls after landing (with the time it was due);
- an altitude at or above the apogee (both heights given);
- an altitude at or below the pad;
- a flight that ended before descending to that altitude.

Each warning ends: "The landing speed and drift shown are for a rocket coming down without it." Devices set to `never` are intentional and get no warning.

## Tests (`simulate.undeployed.test.ts`)

The three review cases, plus a main 30 s after 50 m under a drogue, and a clean flight with a `never` spare (no warning).

No golden output changes: every device in the reference flights opens.
