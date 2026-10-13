# Plan 0038: review finding F-1, deployment time and velocity for every trigger

Lane: physics. Finding: `docs/review/findings.md` F-1 (critical).

## Problem

`simulateFlight` set `summary.deploymentTime` and `deploymentVelocity` only for a timed event of kind `deployment` and at apogee. A device on the motor's ejection charge (OpenRocket's default, kept by the `.ork` import) deployed but left both undefined, so `designFlightWarnings` skipped the deployment-speed check: a 23.8 m/s deployment raised no warning.

Found while testing: an altitude-triggered device with a delay deployed at the right moment, but its event and summary time were `delay` later, because the timed action read the moving loop time `t` when it ran.

## Change

`packages/physics/src/flight/simulate.ts`:

- `deploy()` records the first deployment itself, at the current state. Every caller runs at the deployment instant: a timed action at its step boundary, an event handler after the state is advanced to the bisected crossing.
- The three scattered assignments are removed. The altitude one also recorded the crossing time for a delayed device.
- The altitude action captures the crossing time when it is scheduled.
- The velocity is still the ground speed; F-3 changes it to the airspeed in its own change.

## Tests (`simulate.deployment.test.ts`)

- Ejection-charge deployment with a 2 s delay: time 1.65 + 2 = 3.65 s; velocity equals the recorded state's speed at 3.65 s and exceeds 20 m/s.
- Apogee plus 1 s delay: recorded at apogee + 1 s.
- Altitude 100 m plus 0.5 s delay: the summary and the deployment event are both at the crossing + 0.5 s.
- Apogee with no delay is unchanged, and no golden output changes.
