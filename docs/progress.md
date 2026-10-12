# Progress

Updated after every commit. Read this first when resuming.

## Current prompt

Prompt 3 (roadmap): Phases 3 and 4, started on the owner's "continue" after the Phase 2 report. Steps and plans in `docs/plans/0011-application-architecture-and-design-model.md`.

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

- Phase 2 step 2: frames, orientation quaternions, gravity and environment (plan 0008, DYN-1 to DYN-8, GRAV-1, ATM-11, ENV-1, ENV-2): world ENU frame and reference orientation fixed in `docs/conventions.md`, quaternion algebra per Niskanen §4.2.2, launch rail direction and initial orientation, flight parameters (airspeed, angle of attack, lateral airflow angle, Mach, dynamic pressure, Reynolds), inverse-square gravity with a sea-level parameter (D-030), launch-site atmosphere conditions, constant wind, launch validation with the NAR 30° warning; D-031 on the printed eq. (4.24).

- Phase 2 step 3: the drag model (plan 0009, DRAG-1 to DRAG-14, GEO-13): skin friction with roughness and compressibility, nose (conical and ogive through the transonic and supersonic regimes), shoulder and boat tail pressure drag, fin pressure drag for square, rounded and airfoil sections, base drag with the motor area, lugs and rail buttons, the total and the angle-of-attack scaling; per-component breakdown and warnings. Against OpenRocket's drag coefficient column: within 6 % while thrusting; after burnout OpenRocket keeps the motor area out of the base (D-035, OpenRocket-equivalent rule added). Decisions D-032 to D-035.

- Phase 2 step 4 part A (plan 0010): forces and moments at angle of attack (AERO-1 to AERO-5): normal force with sin α/α, body lift and the moment sum, axial drag with the angle-of-attack scaling, pitch and roll damping; fin CP shift above Mach 0.5 (BAR-10) and the supersonic fin normal force (BAR-11); the transonic fin band throws (D-039).

- Phase 2 step 4 parts B and C (plan 0010, DYN-9 to DYN-15): `simulateFlight` with the 6DOF equations of motion (D-036), the rail constraint, RK4 and the adaptive Dormand–Prince pair (D-037), the orientation derivative (D-038), events located by bisection (launch, liftoff, rail exit, burnout, ejection charge, apogee, altitude, deployment, landing, max time), the 3DOF recovery descent, the full time series and summary, NaN and Infinity detection; the 3DOF cross-check mode. Analytical cases (constant-thrust kinematics, vacuum coast v²/2g, energy conservation), step-size convergence (R1 apogee 168.860 / 168.870 / 168.866 / 168.867 m at 0.01 / 0.005 / 0.002 / 0.001 s; Dormand–Prince 1e-8 168.867 m), and the OpenRocket comparison from the `.ork` and `.eng` files: R1 to R4 with and without wind, apogee within 2.5 % (tolerance 5 %), maximum velocity within 0.6 % (tolerance 3 %), ground-hit velocity within 0.01 %. R5 stops at Mach 0.8 (D-034, D-039). 422 tests.

- Phase 2 acceptance report: `docs/reports/phase-2-acceptance.md` (R1 to R4 with and without wind: apogee within 2.5 %, maximum velocity within 0.6 %, ground hit within 0.01 %; convergence table; analytical cases; 422 tests, checks clean). **Phase 2 is complete** except R5, which cannot be simulated past Mach 0.8 until the owner decides on the transonic data (D-034, D-039).

- Prompt 3 step 1 (plan 0011): Prompt 3 roadmap (five steps), the design model `RocketDesign`, the `.lofi.json` format with schema version, strict validation, sorted-key serialization and a migration chain (D-041), the design-to-physics adapter (mass, stability with plain-language assessments, vehicle, simulation options, warnings against the thresholds, D-042), the example design (R1 with the Estes D12) reproducing the Phase 1 CG and CP and the Phase 2 apogee from a design file; NIST SP 811 added as the source for the customary units UNIT-5 to UNIT-11 (D-040).

- Prompt 3 step 2 (plan 0012): the rocket builder UI in `packages/app`: reducer store with validated actions and new-component defaults, component list (listbox with arrow keys) and editors for every component kind and for recovery devices, numeric fields converting at the boundary with plain-language rejection messages, metric/imperial toggle (UNIT-5 to UNIT-11), live SVG side view with CG and CP markers, stability panel with the margins at liftoff and burnout, colours and guidance against the editable thresholds, mass and size panel, autosave to local storage with recovery of invalid saves (D-043); Testing Library tests in jsdom (the example shows the Phase 1 figures; a zero chord is rejected; the units toggle; autosave round trip; invalid autosave reported).

- Prompt 3 step 3 (plan 0013): ThrustCurve.org client against `swagger.json` (metadata, search, download with RASP preferred and RockSim fallback, every field checked) with an injected transport; offline motor cache in local storage validated on read; custom thrust-curve CSV reader (D-044); the app's motor library (the eight bundled reference motors as build-time text, imported and downloaded motors), the motor panel (mount tube and overhang, figures labelled by their definitions, delay list from the RASP file, thrust-curve plot, diameter warning) and the picker tabs (library filtered to the mount, ThrustCurve search and download, `.eng`/`.rse` import, CSV import); `LinePlot` SVG chart (D-045). Tests: client fixtures, cache offline, CSV rules, picker flows in jsdom with injected transport and stores.

## In progress

- Prompt 3 step 4 (plan 0014, to be written): the simulation UI (launch conditions, worker, results, warnings, plots, CSV export).

## Next

- Step 5 of plan 0011: files and interoperability with the Playwright tests and the Phase 3 and 4 acceptance report.

## Open questions

- Transonic nose drag for Haack, elliptical, parabolic and power-series noses (D-034): Niskanen takes it from Stoney's measured curves in NASA TR R-100 (in `reference/docs/`). CLAUDE.md lists that report as validation data only. May its fineness-ratio-3 curves be transcribed as the model's data points, as Niskanen does? Until then R5 cannot be simulated above Mach 0.8.
- Base drag after burnout (D-035): the source removes the motor area only while thrusting; OpenRocket keeps it removed. Which should the app display? The comparison mode uses OpenRocket's rule.

- Gravity latitude dependence (D-030): the owner is asked to approve a source for a latitude formula (NIMA TR8350.2 or Moritz, Geodetic Reference System 1980) so users can enter a latitude; until then the sea-level value is entered directly, with the OpenRocket-equivalent value available for comparisons. Not blocking.

- Customary units source (D-040): NIST SP 811 was added to `reference/` for the inch, foot, pound, ounce, pound-force, mile per hour, foot per second and Fahrenheit behind the units toggle. Say if another source is preferred; the factors are definitional and would not change.
- Deployment speed warning threshold (D-042): no default is given in CLAUDE.md; 20 m/s is a user-editable placeholder labelled as a rule of thumb. Please state the figure you want.
- `.CDX1` import (CLAUDE.md 6.7 item 3) needs sample RASAero II files; not scheduled until they arrive.

- Dormand and Prince (1980) is not in `reference/`; the tableau is verified by the consistency sums and order tests (D-037). The owner may add the paper to close the verification formally. Not blocking.

- Pull request: the repository has a single branch, `claude/inspiring-tesla-xxp0hh`, which is also its default branch, so no pull request can be opened until a separate default branch exists (see the Prompt 1 report).
