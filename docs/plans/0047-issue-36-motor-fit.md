# Plan 0047: issue #36, a motor that does not fit its mount

Lane: physics (formats design adapter); the app shows the result. Issue: #36 (major).

## Problem

The example with the Estes E16 (29 mm by 114 mm) in its 24 mm, 75 mm inner tube simulated with "No warnings". The motor panel said that the motor is too wide, but the flight results and the stability panel did not, and nothing mentioned that the motor is 39 mm longer than the tube.

## Change

formats `to-physics.ts`:

- `designMotorFitProblems(design)` returns one plain sentence per problem. It checks:
  - the motor diameter against the mount tube's inside diameter 2 (r − t);
  - the motor's forward end (aft end − length) against the tube's forward end.
    Lengths are compared within 1 µm, as in D-074.
- `designFlightWarnings` adds them as code `motor-fit`.
- The function is exported so that the stability panel can show the same sentences (ui lane).

The physics package is unchanged: the motor's mass and position are still those of the design. These are warnings, because the user may be about to change the tube.

## Tests (`motor-fit.test.ts`)

- The example D12 (24 mm by 70 mm) fits.
- The E16 from `reference/motors/Estes_E16.rse` gives both exact messages: 24.0 mm inside, 2 (12.5 − 0.5), and 39.0 mm ahead, 114 − 75. Both appear in the flight warnings.
- A 39 mm overhang removes the length problem.
