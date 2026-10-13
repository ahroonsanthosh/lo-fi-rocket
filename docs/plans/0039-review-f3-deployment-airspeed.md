# Plan 0039: review finding F-3, deployment velocity as airspeed

Lane: physics. Finding: `docs/review/findings.md` F-3 (critical). Builds on plan 0038 (F-1).

## Problem

The summary's deployment velocity was the ground speed |v|. The deployment load depends on the dynamic pressure, so on the speed relative to the air. In the review's case (10 m/s wind) the rocket moved at 6.19 m/s against the wind at apogee: true airspeed 16.19 m/s, reported 6.19 m/s. At 20 m/s wind the airspeed was 27.18 m/s, above the 20 m/s warning threshold, and no warning was raised. Descent samples also filled their `airspeed` field with the ground speed.

## Change

`simulate.ts`: `airspeedAt(t, y)` = |v − v_wind(z, t)|. This is the airspeed of DYN-7 (Niskanen §4.2.4 p. 65), which the descent drag of DYN-14 already uses. It is used for:

- the first-deployment velocity;
- the `airspeed` of samples without flight parameters (descent, landed).

## Golden outputs

Only `summary.deploymentVelocity` of the five 5 m/s wind flights changes, each by exactly +5 m/s: at apogee every rocket has weathercocked into the wind and moves against it, so its airspeed is its ground speed plus the wind speed. No other summary value, event or sample changes.

## Tests

- 10 m/s wind, apogee deployment: the deployment velocity equals |v − (10, 0, 0)| of the state at that instant and differs from |v| by more than 1 m/s.
- Every descent sample's `airspeed` equals |v − v_wind|.
