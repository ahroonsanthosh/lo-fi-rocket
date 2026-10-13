# Plan 0040: review finding F-2, apogee detection after an early deployment

Lane: physics. Finding: `docs/review/findings.md` F-2 (critical).

## Problem

Apogee was a candidate event only in the `powered` and `coast` phases. Any deployment switches the phase to `descent`, so a recovery device that opened on the way up stopped apogee detection. Altitude-triggered devices are armed at apogee, so they never opened either. In the review's dual-deploy case (drogue on an early ejection charge, main at 50 m), the main never opened: the rocket landed at 13.87 m/s instead of 3.36 m/s, `timeToApogee` was NaN, and there was no warning.

## Change

`simulate.ts`: the apogee candidate (v_z crossing zero downwards) is also checked in the `descent` phase until apogee is reached. Its handler is unchanged: it records the apogee, schedules the apogee-triggered devices, and arms the altitude-triggered ones.

## Tests (`simulate.early-deployment.test.ts`)

R1 with a D12 and a 2 s delay, a drogue (0.15 m) on the ejection charge and a main (0.6 m) at 50 m:

- the drogue opens at 3.65 s; apogee is detected later, with v_z within 1e-6 m/s of zero, and the summary's apogee and time are that event's;
- the main opens at the 50 m crossing, after apogee and before landing;
- the landing speed is more than three times lower than with the drogue alone. The terminal-speed ratio is √17 ≈ 4.1 by hand.

No golden output changes: the reference flights deploy at apogee.
