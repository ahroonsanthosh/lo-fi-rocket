# Plan 0043: issue #9, the motor's ejection charge before apogee or at high speed

Lane: physics (warnings); the app shows them. Issue: #9 (critical).

## Problem

With the parachute set to "apogee", the motor's ejection charge was simulated but never judged. In the example with an F39T, the charge fired 3 s before apogee while climbing fast, and the result said "No warnings". On a model rocket without an altimeter, the motor's charge is the deployment, so the result shown is not what happens on the field.

## Change

- physics `simulate.ts`: `summary.ejectionCharge` holds the time, airspeed |v − v_wind| and vertical velocity at the charge (undefined if it did not fire). When the charge fires while the rocket still climbs (v_z > 0), a plain-language warning gives:
  - the time and airspeed;
  - how long before apogee;
  - the delay after burnout that would fire it near apogee;
  - what an early deployment does.
- formats `designFlightWarnings`: a new code `ejection-velocity`, raised when the charge's airspeed is above the user's deployment-speed threshold (default 20 m/s). This covers a delay that is too long as well as one that is too short. It is skipped when a device deploys at that same instant, because `deployment-velocity` already covers it.

The issue's other suggestion, defaulting the example's parachute to the ejection charge, changes the example's figures used across the app's tests. It is left for the owner to decide.

## Tests

- physics `simulate.early-ejection.test.ts`, R1 with D12:
  - a 2 s delay fires at 3.65 s while climbing and is warned, with the time to apogee and a suggested delay;
  - the shipped 5 s delay fires at 6.65 s after apogee and is not warned;
  - the airspeed in wind is |v − v_wind|.
- formats `ejection-warning.test.ts`, the example design:
  - a 0 s delay gives the exact `ejection-velocity` message;
  - the shipped 5 s delay gives no ejection warning.

No golden output changes: the golden test stores a fixed list of summary fields, and the new field is not among them.
