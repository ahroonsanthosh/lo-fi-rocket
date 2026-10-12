# Progress

Updated after every commit. Read this first when resuming.

## Current prompt

Prompt 2 (roadmap): all of Phase 2, started on the owner's "continue" after the Phase 1 report. Phase 1 (Prompt 1) is complete.

## Done

- Monorepo scaffold, docs, CI, session hook (commit 1b8c7fd).
- Units system, plan 0001 Part A (commit 0b7b9d2).
- Prompt 0: reference documents, motors, OpenRocket harness, reference rockets, hand check (commit deb0202).
- Prompt 1 housekeeping: CLAUDE.md section 11 (autonomous mode) and 6.7 (RASAero scope); Barrowman 1966 reprint and the four NACA/NASA validation reports downloaded and recorded; `reference/fetch-docs.sh`; roll-angle probe confirms OpenRocket applies no roll reduction; reference values regenerated at 0.001 s; decisions D-016 to D-020 (commit 01552e7).
- Phase 1 step 2: U.S. Standard Atmosphere 1976 (plan 0001 Part B), every value verified against the document with page numbers; 82 tests including 57 published-table rows and a golden file; decisions D-021 to D-023.

- Phase 1 step 3: component geometry, mass, CG and inertia (plan 0003): Appendix A profiles, shell convention D-024, integrator, all component types, assembly; R1 by hand to 6 decimals, R1 to R5 liftoff and burnout mass and CG against OpenRocket.

- Phase 1 step 4: minimal RASP .eng reader in `packages/formats` (plan 0004): header, delays, data lines, mass model per the thrustcurve.org format notes; 22 tests over the eight reference motors and malformed inputs.

- Phase 1 step 5: minimal OpenRocket .ork reader in `packages/formats` (plan 0005): zip or bare XML, the eleven element types of the reference rockets, position methods verified against OpenRocket's per-component report, every other feature rejected by name; 25 tests, including every component of the five files against `components/*.csv` and liftoff/burnout from the files alone against `values.csv`; decision D-026.

- Phase 1 step 6: Barrowman normal force, CP, interference and stability margin (plan 0006, BAR-1 to BAR-9): both modes of D-016, worst-case roll angle, Mach 0.5 limit (D-027); R1 by hand, closed-form noses and boat tail, R1 to R5 CP within 0.04 % of OpenRocket in the OpenRocket-equivalent mode; CP from the `.ork` files in the formats tests.
- The equations register `docs/equations.md` was found empty (only IDs in code and plans) and was filled with UNIT-1 to 4, ATM-C, ATM-L, ATM-1 to 10, GEO-1 to 12 and BAR-1 to 9.

- Phase 1 acceptance report: `docs/reports/phase-1-acceptance.md` (all five rockets: CG within 0.0004 %, CP within 0.035 %, 269 tests, checks clean). **Phase 1 is complete.**

- Phase 2 step 1: motor thrust and mass model (plan 0007, MOT-1 to MOT-5): format-independent `MotorDefinition` with three mass rules, RockSim `.rse` reader with the unit and column checks of D-029, `motorFromEng`/`motorFromRse`; Apogee's `.rse` format guide and the seven ThrustCurve `.rse` files added to `reference/` (the Prompt 0 "RockSim format page" was a saved 404 and its verification claim was corrected in `reference/SOURCES.md`); decisions D-028, D-029.

## In progress

- Phase 2 step 2: frames, gravity and environment (plan 0008, to be written next).

## Next

- Phase 2 steps 3 and 4: drag model across Mach (plan 0009), 6DOF simulation with RK4 and RK45, events and recovery (plan 0010), then the Phase 2 acceptance report.

## Open questions

- Pull request: the repository has a single branch, `claude/inspiring-tesla-xxp0hh`, which is also its default branch, so no pull request can be opened until a separate default branch exists (see the Prompt 1 report).
