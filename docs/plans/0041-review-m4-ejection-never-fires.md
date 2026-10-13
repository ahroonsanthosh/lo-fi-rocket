# Plan 0041: review finding M-4, ejection-charge devices that can never open

Lane: physics. Finding: `docs/review/findings.md` M-4 (critical). F-4 covers the other triggers in its own change.

## Problem

The ejection event is scheduled only when the motor has an ejection delay. A parachute set to open at the ejection charge, flown on a plugged motor, never opened. The same happened when the charge was due after landing. The result was a ballistic flight landing at terminal speed, and the only warning was the formats-level `no-recovery`, which fires only when the design has no recovery device at all.

## Change

`simulate.ts`:

- Before the flight: for each device on `ejection`, when the motor is plugged (no delay) or is the ideal motor of the analytical cases, add a warning. It names the device, gives the reason, and says what to do.
- After the flight: when the motor has a charge but no ejection-charge event occurred (the flight ended first), add a warning for each ejection device that did not open. It gives the time the charge was due, when the flight ended, and the apogee time with the delay that would reach it.

Warnings are plain language (CLAUDE.md 9) and name the device. Nothing in the physics changes.

## Tests (`simulate.ejection-charge.test.ts`)

R1 with D12, DATCOM large-angle model so that the unrecovered rocket reaches the ground:

- plugged motor: no deployment, and the warning names "Main chute" and the plugged motor;
- ideal motor: the warning names the motor model;
- 100 s delay: lands with no ejection event; the warning gives "due at 101.65 s" (1.65 + 100 by hand) and the apogee time;
- 5 s delay: the chute opens and no such warning appears.

No golden output changes.
