# Plan 0037: review finding B-1, components must fit together

Lane: physics. Finding: `docs/review/findings.md` B-1 (critical). Decision: D-074.

## Problem

`centreOfPressure` and `simulateFlight` accepted parts that do not fit: a nose base radius smaller than the tube behind it, a fin `bodyRadius` that no longer matches the tube, fins off the rocket, a nose not at x = 0. Each gave a CP with no error, in some cases 0.4 to 0.8 calibers in the unsafe direction.

## Change

- New `packages/physics/src/geometry/fit.ts`, `validateComponentFit`, called first in `centreOfPressure` (so in every stability figure) and in `simulateFlight`.
- Rules and their sources in D-074. No equation changes.
- `barrowman.test.ts`: the lone boat tail used to test a negative total C_Nα is moved to x = 0 so that it passes the new checks; the test's purpose is unchanged.

## Tests (`fit.test.ts`)

- The five reference rockets fit.
- The review's cases are rejected with messages naming the parts: 12.5 mm nose on the 25 mm tube; fin `bodyRadius` 1 m; fins at 5 m and −1 m; body shifted 0.3 m; a 10 mm gap and a 10 mm overlap; rail buttons off the body and with a wrong radius.
- A fin chord running 30 mm past R1's base is accepted (the RM-10 case); a fin set without a body is not checked.
- `simulateFlight` rejects the same design before flying.
- The wind tunnel and held-out validation suites still pass unchanged (ARCAS, RM-10).
