# Plan 0023: Large-angle fin force proposal, ballistic descents, golden flight time series (Prompt 5 step 4)

**Status:** written and implemented 2026-10-12 under autonomous mode; Prompt 5 Part B items 4 and 5 (D-059).
**Phase:** follow-up.

## Goal

1. Large-angle fin force (D-046): the owner approved Hoerner's flat-plate data if it is in `reference/`. It is not (neither _Fluid-Dynamic Drag_ nor _Fluid-Dynamic Lift_ is there, and the thesis only cites _Fluid-Dynamic Drag_ for drag). So no implementation: alternatives are proposed with sources in D-059 and the final report, and the 90° model limit stands.
2. Ballistic descents: every reference rocket without a recovery device, with and without wind, in the main six-degree-of-freedom mode (which must end at the 90° limit after the turn-over, with the ascent intact) and in the three-degree-of-freedom cross-check mode (axis along the airspeed, drag only), which can land and whose terminal fall is checked against the force balance (the acceleration near landing tends to zero, the ground-hit speed is the terminal speed of the stated drag). A test reports both.
3. Golden flight time series (CLAUDE.md 7.6): for R1 to R5 with winds 0 and 5 m/s in the OpenRocket-equivalent modes, the summary, the events and samples every 1 s (time, phase, position, speed, Mach, angle of attack, mass, CG, CP, C_D0) stored as JSON with full double precision and compared exactly. Regenerated only with `UPDATE_GOLDEN=1`; any change must be explained in the commit message.

## Sources

No new equation. The terminal-speed check uses the simulator's own drag (DYN-9, DYN-14 style force balance m g = ½ ρ v² C_D A at zero acceleration) as a consistency test, not a new model.

## Tests

- `simulate.ballistic.test.ts` (formats): 6DOF ends with `model-limit` after apogee with the same apogee as the flight with recovery (to 1e-6 m); 3DOF lands with a vertical speed equal to the terminal speed computed from the last sample's density, mass and C_D0 within 2 %, and a final acceleration below 0.05 g; no NaN; the table is printed.
- `simulate.golden.test.ts` (formats): exact equality with `golden/flights/*.json`.
