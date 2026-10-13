# Plan 0046: issue #32, a parachute set to open at launch

Lane: physics. Issue: #32 (critical). Decision: D-075.

## Problem

With the parachute set to "At launch", `deploy()` ran at t = 0 and switched the phase to `descent`. Thrust is zero in that phase, so the rocket never left the pad. The run went to the 600 s limit, and the summary showed "Time to apogee NaN s" and "Rail exit NaN m/s at NaN s".

## Change

`simulate.ts`:

- Before the flight: a device on `launch` whose delay is shorter than the burn time is refused with `InvalidInputError`. The message names the device and the burnout time, and lists the alternatives. A delay at or after burnout is a timer deployment and is flown.
- After the flight: when there was no rail exit, a plain warning says that the rocket never left the rail and what to change.

## Tests (`simulate.launch-deployment.test.ts`)

R1 with D12:

- at launch is refused with the exact message;
- 1 s after launch, during the burn, is refused;
- 5 s after launch flies and opens at 5 s;
- a 2.5 N, 0.3 s ideal motor never leaves the rail and is reported;
- a normal flight has no such warning.

No golden output changes.
