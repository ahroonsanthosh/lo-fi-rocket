# Progress

Updated after every commit. Read this first when resuming.

## Current prompt

Version 1.0 completion prompt (autonomous): Part A (branches, DATCOM, TN 4197, WGS 84), Part B (held-out datasets), Part C (nine physics items with validation after each), Part D (limitations, README, future work, tag v1.0.0, PR into main). Branch `claude/v1-completion` from `main`.

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

- Prompt 3 step 4 (plan 0014): the simulation UI: launch editor (site, optional temperature and pressure overrides, rail, wind, with the NAR warning live), simulation settings (integrator, tolerances or step, maximum time, recording interval), the simulator in a Web Worker with a synchronous runner for tests, the flight panel (summary values of CLAUDE.md 6.5, events, the thresholds and launch warnings with their reasons, modes used, stale-flight notice), four plots with event markers, CSV export with a modes comment line. Found and fixed while testing a ballistic flight: the fin normal force law applied past 90° angle of attack gave a spurious force in an undefined direction (RK4 tumbled, Dormand–Prince crawled); a six-degree-of-freedom flight now ends with the explicit reason "model-limit" at 90° (D-046) and the adaptive integrator throws `SimulationStalledError` instead of crawling.

- Prompt 3 step 5 (plan 0015): imported drag curves in the simulator (D-047, linear in Mach, never extrapolated, results labelled), the design file's optional `dragCurve` and `recordedFlight`, CSV readers for drag tables and altimeter data, `orkToDesign` with motor matching against the library (D-048), the files menu (Save, Open, Designs, Import `.ork`), the comparison panel with the recorded altitude overlay, Playwright end-to-end tests (new-user flow, the example's figures, autosave across reload, the laptop layout) running in CI, and the Phase 3 and 4 acceptance report. **Prompt 3 (Phases 3 and 4) is complete.**

- Prompt 4 step 1 (plan 0016): wind profile by altitude as a user table (ENV-3, D-049), Niskanen's turbulence (ENV-4 two-pole pink noise, ENV-5 20 Hz samples scaled by 2.252 along the mean direction, intensity I_u) generated once per flight from a seed recorded in the results, the seeded generator xoshiro128** with Box–Muller normals (RNG-1, RNG-2, D-050; the paper added to `reference/`), the design's wind settings (profile rows, turbulence intensity and seed) with the launch editor's profile table and turbulence fields; tests: profile by hand, filter coefficients by hand, the 2.252 scaling, turbulence statistics, step-size independence, determinism, R1 flights with a profile and with turbulence.

- Prompt 4 step 2 (plan 0017): Monte Carlo dispersion (D-051): seeded sampling of wind speed and direction, rail angle and azimuth, thrust-curve and structural-mass scales with user-entered standard deviations (zero by default), turbulence seeds per run, rank-based statistics and a 95 % containment radius, failed and unlanded runs counted; the batch runs in the worker with progress; the dispersion panel with the settings, the summary table and the landing scatter plot; the settings stored in the design file. Tests: statistics by hand, zero variations reproduce the deterministic flight, determinism per seed, a wind spread, failed runs reported, the panel end to end.

- Prompt 4 step 3 (plan 0018): propellant CG profiles for liquid engines (MOT-6, D-052): mass-profile points carry an optional CG from the fore end, interpolated linearly and validated, the CSV reader's fourth column, the design file's optional field; tests by hand including the rocket CG shift.

- Prompt 4 step 4: the final audit `docs/audit.md` (every CLAUDE.md requirement with its status and evidence, the decisions the owner may overturn, what is not done in priority order) and the Phase 5 report `docs/reports/phase-5-acceptance.md`. **Prompt 4 (Phase 5 and the audit) is complete; the roadmap is finished.**

- Prompt 5 step 1 (plan 0019): the owner's answers recorded (D-053); the Dormand–Prince tableau cross-checked against SciPy 1.18.1 (all coefficients agree to 1e-14); the warning and stability thresholds editable in the launch settings, labelled as rules of thumb that change no physics; TR R-100 declared model data and the ARCAS reports held out in `reference/SOURCES.md`; the WGS 84 document could not be downloaded from this environment (D-054, blocked on the file).

- Prompt 5 step 2 part 1 (plan 0020): NASA TR R-100 Figure 12 digitised twice (`reference/digitised/`, merged with the disagreement and a per-curve uncertainty; the panel (b) curve identities corrected from the report's text, D-055); the transonic and supersonic nose pressure drag of Appendix B.3 for the elliptical, parabolic, power-series and Haack noses (DRAG-15 to DRAG-17): data curves linear in Mach, the (B.9) fineness-ratio scaling with its analytic slope, parameter interpolation between curves, the (3.87) join, held values and late data starts flagged. Every nose shape now has a drag model across all Mach regimes; R5 still stops at the fins (D-039). 604 tests.

- Prompt 5 step 2 part 2 (plan 0021): the three transonic fin candidates (BAR-12) compared against the held-out ARCAS CP data, the cubic Hermite chosen (D-056); the wind tunnel validation of CLAUDE.md 6.7 item 1 against TN D-4013, TN D-4014 and NACA RM A53D02 with the errors by Mach regime (D-057, `docs/reports/wind-tunnel-validation.md`): CP within 3.5 % of body length subsonic, rms 5 % transonic, conservative by up to 27 % supersonic; drag over-predicted 15 to 20 % subsonic, the transonic rise too early, supersonic within 9 % for thin sharp fins and up to twofold for thick rounded-section fins. DATCOM proposed as an additional source. **Prompt 5 step 2 is complete.**

- Prompt 5 step 3 (plan 0022): supersonic roll damping from eq. (3.72) with exact trapezoid strip integrals and a linear-in-Mach band (AERO-6, AERO-7, D-058); no regime stops a flight any more. R5 against OpenRocket: apogee +2.5 %, maximum velocity +0.8 %, rail exit −0.3 %, ground hit 0.0 % (both winds; `docs/reports/phase-2-acceptance.md` section 7). Regime warnings without the Mach number (one line per flight) and a supersonic warning, both naming the validation status; `designFlightWarnings` gains `supersonic`; shown in the app.

- Prompt 5 step 4 (plan 0023): the large-angle fin force stays unimplemented because Hoerner is not in `reference/`; three sourced alternatives proposed, DATCOM recommended (D-059). Ballistic descents of R1 to R5: tail-first fall in still air ends at the limit at apogee; in wind every rocket noses over and lands at its terminal speed, within 1 % of the three-degree-of-freedom fall. Golden flight time series for R1 to R5 (`packages/formats/golden/flights/`, exact comparison). Final report `docs/reports/prompt-5-final-report.md`; audit updated. **Prompt 5 is complete.**

- UI redesign part 1 (plan UI-0001, branch `feature/ui-redesign`, decisions D-UI-1 to D-UI-5 in `docs/ui/decisions.md`): usability review with screenshots (`docs/ui/review.md`), redesign plan with before and after mockups (`docs/ui/redesign.md`), new package `packages/ui` (display-only components, tokens, display rules, glossary; 161 tests). No existing file under `packages/` changed. Report: `docs/reports/ui-redesign-part-1.md`. Next: apply the library to the app once the parallel sessions have merged.

- 3D viewer (plan 0034, branch `feature/3d-viewer`, D-071): `packages/viewer` on three.js replays a `FlightResult` exactly as stored (the scene is the flight frame, the stored quaternion is the rocket's rotation, the stored CG position carries the model by the stored CG offset), with play, pause, speed and a scrubber, the readouts of the nearest stored step labelled with its time, the flight path, event markers at their stored steps, the rail, a 1-2-5 ground grid with a distance scale, the wind arrow, four cameras (follow, pad, whole flight, orbit), the Monte Carlo landing points with the stored containment circle and a descriptive covariance ellipse, and a run picker that replays a run by re-running the simulator on the identical perturbed design; units through the app's formatter. Accuracy tests for all five reference rockets (readouts bit-identical to the stored samples at every event and sampled step; model dimensions; rendered axis against `noseDirection` within 1e-12); jsdom and Playwright tests; `docs/reports/3d-viewer.md` with screenshots. No change to `packages/physics` or `packages/formats`.

- Replay provenance check (D-072, owner's request before merging the viewer): every Monte Carlo result carries the app version and a SHA-256 of the physics and formats sources; replaying a run compares both and the landing point with the stored ones, exactly, and warns when either differs.

- Review fixes, physics lane (2026-10-13). One pull request each, every one with `pnpm check` passing:
  - G-1 nose shoulder wall: #7.
  - B-1 component fit, D-074: #43.
  - F-1 deployment for every trigger: #44, which also fixes the delayed altitude deployment time.
  - F-3 deployment airspeed: #46. Stacked on #44, so merge #44 first. It changes `deploymentVelocity` in the five 5 m/s golden flights by exactly +5 m/s.
  - F-2 apogee after an early deployment: #47.
  - M-4 ejection charge never fires: #48.
  - F-4 devices that never open: #49.
  - Issues: #9 ejection before apogee (#50), #17 unstable result (#53), #19 plain warnings and `FlightResult.notes` (#54).
  - The owner's `.ork` mass/CG overrides: #30, D-073. The rule was observed from OpenRocket with `tools/openrocket-harness/src/OverrideProbe.java`.
  - Plans 0035 to 0045. ui follow-ups: #55 and #56.
  - Second review pass (issues #32 to #36):
    - #32 "at launch" refused while the motor burns, and a rocket that never leaves the rail is reported: #58, D-075.
    - #33 is in #49, extended for "never" and a first warning with the landing speed.
    - #34 is covered by #44, #46, #47 and #50 together, verified on a local merge.
    - #36 motor fit: #59.
    - #35 is ui only: the `.rse` parser already reads the delays.
    - Also #53: the in-flight margin minimum now covers the ascent only. The fall after apogee had been counted.

- Simulate anything (the owner's rule change, D-083, plan 0055), 2026-10-13:
  - `.ork` import of OpenRocket's example designs, plans 0048 to 0054 (D-076 to D-082): nose cone children, configurations and cross-sections, automatic sizes and shoulders, parachute materials, shock cords, couplers, engine blocks, automatic ring radii, fin tabs, plugged and reloadable motors, every problem listed at once.
  - Step 1: the confidence report (`fidelity.ts`, `FlightResult.approximations` and `confidence`, shown with the results).
  - Step 3 part 1 (plan 0056, D-084): the import approximates parts inside the rocket and part settings instead of refusing; approximations travel with parts and the design to every result; lug instances and transition shoulders exact against OpenRocket probes.
  - D-085: `.ork` fin cant read in degrees (CantProbe); the cant approximation now states the real angle. OpenRocket's example designs: 10 of 17 import (multi-stage and clusters remain).
  - Step 3 part 2a (plan 0057, D-086): motor clusters in the physics (GEO-15, n motors' thrust and base area), the design file and the `.ork` import; three D12s against OpenRocket: mass and CG within 1e-5, apogee +1.0 %, maximum velocity +0.4 %. OpenRocket's "Clustered motors" example imports (11 of 17).
  - Step 2 physics (plan 0058, D-087): elliptical and freeform fins by Niskanen's general-planform method (BAR-18, GEO-16); trapezoids unchanged; the trapezoid-only methods use an equivalent trapezoid (listed, minor). Next: their `.ork` import and app display (plan 0059).
  - Step 2 import and display (plan 0059, D-088): elliptical and freeform fin sets from `.ork` files (CP within 0.13 % of OpenRocket), saved in the design file with fin tabs (which could not be loaded back before), drawn in the side view and 3D, chosen in the editor. OpenRocket's examples: 11 of 17 import; the rest are multi-stage or air-start (a decision for the owner, below).
  - As-built mass and CG (plan 0060, D-089): the weighed mass and balance point of the empty rocket (GEO-17), in the design file, the app (airframe view, "As built") and the Monte Carlo mass variation; OpenRocket's stage mass and CG overrides import as it, matching its structure mass and CG to 1e-6 in all seven probe cases.
- Claude integration (plan 0061): the owner chose the local route (an MCP server for Claude Code and Claude Desktop on the user's own plan, nothing hosted), deferred the licence, and approved dropping the spent stage at separation (D-091, CLAUDE.md non-goal changed).
  - Step 1, security hardening (D-090): size limits on every reader and in the app, a streaming zip-bomb guard (stops at about 16 MiB whatever the archive claims), stored simulations cut from `.ork` XML, DOCTYPE and ENTITY refused, a Content-Security-Policy in the built site checked by a unit test (every host listed) and by every end-to-end test (no violations), the launch-site privacy note, read-only CI permissions and CodeQL. Dependency review waits for the owner to switch on the dependency graph (open question).
  - Step 2, the local MCP server (plan 0062, D-092), first pull request: `packages/mcp` with 19 tools (design, parts, motor library and files, recovery, launch, as-built, assumptions, review, stability, simulate), unit strings (UNIT-12 and UNIT-13 added), every value not given recorded as an approximation; the example rocket built through the tools matches the engine bit for bit. The app's part defaults and bundled motors moved into `packages/formats`.
  - Plan 0062 parts 2 and 3 (D-093, D-094): ThrustCurve.org search and download (read-only, one host, bounded), Monte Carlo (200 runs per call); the single-file server and the Claude Desktop extension, built and smoke-tested in CI (official manifest validator, run as Desktop runs it), published on the site with checksums and a `claude.html` page linked from the File menu.
  - Step 3, design links (plan 0063, D-095): `#design=v1.` links open a design in the app (fresh id, stored at once, address cleared), bounded like every reader; the MCP server's `design_link` tool makes them.
- Multi-stage (plan 0064, D-091, D-096), part 1: the engine flies staged vehicles (motors igniting on Table 4.2 events, separated stages leaving with their parts, motors and devices); single-stage results bit-identical; two-stage vacuum flights match the closed form.
- Multi-stage part 2a (D-097): OpenRocket's staging measured as a black box (its two examples and four built rockets, including an empty stage). The engine has OpenRocket's nine separation events and a "never" ignition, and says why a motor never lit or a stage never separated. The design file is schema 2 (version-1 files unchanged): stages, a stage per part and device, further motor mounts and OpenRocket's ignition events, with "automatic" as OpenRocket does it. Golden outputs unchanged.
- Multi-stage part 2b (D-098): staged `.ork` files import. The reader handles:
  - stages one after another;
  - every motor mount with its ignition;
  - each stage's separation, per configuration;
  - stages switched off, as OpenRocket does;
  - per-stage mass overrides;
  - ignition delays and second motor mounts, which were refused before.

  The probe's staged rockets fly within tolerance of OpenRocket: apogee +2.78 % and +1.17 %, maximum velocity +2.21 % and −1.89 %, staging times within 1 ms.

- Multi-stage part 3a (D-099): Claude builds staged rockets through the MCP server. The new `set_stages` tool names the stages; parts and parachutes take a stage; `set_motor` gives each stage its motor and ignition, with the resolved ignition shown; `review_design` flags a motor that can never light. A two-stage rocket built through the tools flies exactly as the engine flies it.
- Multi-stage part 3b (D-100): stages are edited in the app.
  - The airframe view has a Stages section: names, separations, adding and removing stages.
  - Parts and parachutes have a stage choice, and the motor view a stage selector with each stage's ignition.
  - The stability details list each configuration's margin as its bottom stage lights and at its burnout.
  - For a staged rocket, the burnout gauge shows the top stage alone.
- Random-design robustness (plan 0065, D-101): a property test flies random sensible designs (40 per run; 300 in the exploration). It found two float64 edge cases (a decaying roll rate and the first instant off the rail overflowing to ∞ or ∞ × 0), a rail tilted by next to nothing, an adaptive-step failure when a canopy opens on a fast rocket after a smooth coast, and the refusal of 0 kg parts. All are fixed and each is tested; golden outputs unchanged. Now 300 of 300 fly: 212 land, 79 end at the model limit (tumbling past 90°), 8 at the time limit.
- Wedge and high-aspect-ratio fins past 90° (plan 0066, D-102): the large-angle model no longer refuses them in the displayed mode. A single wedge reads the 23b family, and a high aspect ratio uses the low-aspect-ratio method with its charts held at their ends. Each is listed in the result as an approximation. These fin sets caused all 79 model-limit endings; now 300 of 300 random designs land (291) or reach the time limit (9). No reference design has such fins, so the golden outputs and the OpenRocket comparisons are unchanged.
- Tumbling above Mach 1 (plan 0067, D-103): the displayed mode now continues past 90° at any Mach number. Above Mach 1 the small-angle supersonic fin force is applied to the reversed fin, and a flight that does this lists it as a major approximation. The wedge and high-aspect-ratio listing of D-102 is now minor below the stall and moderate past it. Only the OpenRocket-equivalent mode still stops at 90°.
- A sample's Mach, angle of attack, C_D0, CP and margin are documented, and tested, as NaN exactly where no attitude is modelled: under a recovery device, after landing, and with no aerodynamics. The app's plots, CSV export, 3D viewer and the MCP report already treat them as "not defined". With this, task 5 (the physics never refuses a sensible design) is complete.
- Flipped nose cones (plan 0068, D-104): an `.ork` tail cone (a flipped nose cone) is read as a transition to a point, which OpenRocket shows is exact for all six shapes; the physics accepts an aft radius of 0, and so does the app. Probe files and values in `reference/rockets/flipped-nose-probe/`. Found on the way: the boat-tail drag combination in the displayed mode (D-104, open).
- The boat-tail drag combination checked (plan 0069, D-105): keeping Niskanen's eq. (3.88) on eq. (3.94) beside the DATCOM base, because the alternative doubled the error against the ARCAS wind-tunnel boat-tail data while moving R2 by only 0.66 %. Two limitation lines that named the wrong side as safe for altitude limits are corrected.
- Pod sets, the physics (plan 0070 steps 1 and 2, D-106, GEO-18): parts repeated around the axis, counted once per pod in the mass, inertias, normal force, drag and damping, with their approximations listed. Against the new OpenRocket pod probe: mass, CG and C_Nα exact, CP within R1's 0.016 %, drag within 0.65 %, apogee +1.1 to +1.7 %.
- The comparison mode's base and rail button drag (plan 0071, D-108, DRAG-23, owner's option (c)):
  - **OpenRocket's base.** OpenRocket 24.12 never removes the motor's area from the base, measured statically and in its flight data. D-035's `'always'` rule had been offsetting our rail button drag, which is 6 to 10 times OpenRocket's.
  - **New comparison mode.** It keeps the whole base and computes rail buttons from a table of OpenRocket's measured coefficients: per button K(Mach, η = height / boundary-layer thickness) times the frontal area, within 0.82 % of OpenRocket on 80 held-out buttons.
  - **Results.** R1 to R5 apogees are now within 0.16 to 0.51 % of OpenRocket (before −2.42 to +2.48 %), maximum velocity within 0.26 %, and static drag within 0.4 to 0.7 % (R1 1.2 %, its lug).
  - **Remaining differences:**
    - OpenRocket's nose pressure drag below Mach 1 (tangent ogives flat to Mach 1 and near zero supersonic; other shapes zero to Mach 0.9), which is not copied;
    - our skin friction, 1.4 % higher;
    - the launch lug.
- Validation corrections (plan 0072, D-109), from the measured-data survey and each checked against the report page:
  - **TN D-3182 model A.** Its fins are corrected to the drawing (span 4.95 in, not 4.38; a 1.37 in mean trailing edge, not 0.69). Its C_A is compared with the forebody drag, since the report subtracts the base. CP rms is 4.1 % of body length (was 5.7 %) and forebody drag −17 %.
  - **Blue Scout at angle of attack.** The values behind D-070 were the fins-off configurations. The fins-on CP moves only about 0.03 body lengths to 6°; both models over-predict this, which is conservative.
  - **Known limitations.** Stale statements were replaced. Two items are newly documented: the ARCAS transonic CP, about 1 caliber on the unsafe side at Mach 0.8 to 0.9, and drag under-predicted just above Mach 1 and on wedge fins.
  - **OpenRocket issues.** Draft list in `docs/reports/openrocket-issues.md`.
- Surface finish from `.ork` files (plan 0073 part 1, D-110), the first of the import gaps found by the OpenRocket validation campaign:
  - **Import.** Each part's `<finish>` is read as OpenRocket's own roughness height (nine names, 0 to 500 µm). The design's finish is the one most parts have; parts with another keep their own (design file schema 4). Before this every part flew at 60 µm, unlisted, moving the apogee −13 to +14 % on the campaign's six rockets with another finish.
  - **Physics.** The skin friction is the sum over the surfaces, each at its own finish. With one finish it is eq. (3.85) exactly, so every existing result is unchanged. A 0 µm finish is a smooth surface.
  - **Against OpenRocket.** 14 probe rockets at Mach 0.1 to 1.5: friction 1.24 to 1.46 % above OpenRocket's, the regular-paint offset within ±0.11 %.
  - **Also fixed.** The MCP part editor dropped a part's pod set; it now keeps that and its finish.
- The finish and fillets in the app (plan 0073 part 1b): every body part's and fin set's editor sets its surface finish, or the whole rocket's; the fin editor sets fillets. The app had no finish control before.
- Fin fillets (plan 0073 part 3b, D-113, GEO-19): their mass, CG and inertias by exact plane geometry, read from `.ork` files instead of being left out. OpenRocket's fillet volume is the same geometry: the 17 `FilletProbe` cases agree to 1e-7 in mass and 1e-9 m in CG. Before this, missing fillets put the CG forward and overstated the margin (up to 2.8 % CG on a campaign rocket).
- Small import and message fixes (plan 0073 part 3a, D-112): an `.ork` file's rail buttons past the end of the body are moved onto it and listed, instead of the stability refusing the design; the RK4 refusal advises a step rounded down, never up; the airfoil fin slab mass is rated moderate by its measured effect.
- Streamers (plan 0073 part 2, D-111, STREAM-1): a recovery device may be a streamer, with Niskanen's Appendix C drag (eq. C.6), in the physics, the design file (schema 5), the `.ork` reader, the app and the MCP. Before this an imported streamer was dropped with a wrong "no mass" message and the rocket fell ballistically. Against OpenRocket on ten strips: mass and CG to 1e-6, C_D exact (OpenRocket uses the same equation, capped at 0.4, which the comparison mode copies).
- Pod sets in files (plan 0070 step 3, D-107): the design file's `pod` group (schema 3, with its migration), the `.ork` reader's pod sets on body tubes, placed as OpenRocket places them (every radius and axial method probed exactly; a parachute in a pod is one per pod), and the app's part list and editor naming pod parts. A motor in a pod is still refused (step 4). Issues opened for the UI and 3D lanes to draw pods off the axis.
- RASAero II import and comparison (plan 0075, D-114):
  - **Importer.** `.CDX1` files are read: the nose, body, fin can, boat tail and boosters, recovery, site and motor. The file's lift-off weight and CG are reproduced exactly, per stage. The app's File menu has "Import RASAero".
  - **Running RASAero.** It runs here under Wine, driven by our own script (`reference/rasaero/`; nothing of RASAero committed). An opt-in test (`RASAERO=1`) writes `docs/reports/rasaero-comparison-data.md`.
  - **Found.** Our trajectory matches RASAero's when flown on its drag (within 1.4 % below Mach 0.95). Our drag is low: on 21 flown rockets our displayed apogee is above the measured one every time, +18.9 % mean below Mach 0.95 and +29.0 % above (RASAero: +0.4 % and +3.9 %). The causes, term by term, are in `docs/reports/rasaero-comparison.md`. The fixes await the owner.
- Friction from the DATCOM (plan 0076, D-115): the displayed mode uses the DATCOM's body form factor (eq. 4.2.3.1-a) instead of eq. (3.85)'s, because it improved both independent datasets: the 21 flights (+18.9 → +17.7 % below Mach 0.95) and the held-out drag in every regime (subsonic 7.1 → 6.1 %, now within its 7 % target). The fin friction at the fin chord (DATCOM eq. 4.1.5.1-a) is implemented and selectable but not the default: it worsened the held-out supersonic drag. The comparison mode and the goldens are unchanged.
- RASAero II export and R1 to R5 in three simulators (plan 0077, D-116):
  - **Export.** The app's File menu and the MCP write a design as a RASAero II `.CDX1` file. What RASAero cannot hold is refused with what to change.
  - **Agreement.** R1 to R5 flown in RASAero with our own motor curves: the CP agrees within 1.3 mm. R1 (launch lug) agrees within 3 % between all three programs.
  - **Disagreement.** R2 to R5 (rail buttons) differ by up to 27 % in apogee, mostly from the rail guide drag, where the three programs' models span a factor of about 30. Measured rail button drag would settle it (owner decision 3).
- The other sessions' work integrated (owner, 2026-10-14):
  - **#77 (UI).** Merged with main's newer features kept: design links, the stages editor, streamers, pod labels and top-stage burnout. A second recovery device can be added (dual deployment). Thrust to weight and the Mach regime are shown again.
  - **#79 (3D).** Merged. A stalled frame no longer jumps the replay (`MAX_FRAME_STEP`, D-3D-6); this fixed a timing failure in CI.
  - **Review issues.** #12, #25, #33 and #34 were closed as already fixed, with the evidence. #29 and #61 were fixed by #79.
  - **Plan 0078 (D-117).** Fixes #8 (ThrustCurve search found nothing), #10 (the delay reset silently), #14 (small values read 0) and #39 (delete without asking).
- The MCP server builds and flies a pasted design in one call (plan 0079, D-118):
  - **`build_and_fly`** takes the parts, the motor by name ("D12-5", "G80-7T"), the recovery and the launch in one call. A motor the library lacks is looked up on ThrustCurve.org.
  - **`import_design`** reads RASAero `.CDX1` too, and can fly the file in the same call.
  - **No questions first.** The instructions no longer ask for every value before flying; what was left out is listed with the result.
- Real flights at the core (plan 0080, D-119), step 1:
  - **The benchmark.** All 24 flown rockets among RASAero II's examples are flown in CI on every change (`docs/reports/real-flights.md`).
  - **Today's gap.** Displayed apogee +16.4 % mean below Mach 0.95 (13 flights) and +24.7 % above (11).
  - **Shown with every result.** Each apogee in the app and the MCP now carries the range measured flights reached.
  - **Sources approved:** NACA TM 1299 and NASA SP-125.
  - **Next:** the fin friction at the fin chord as the default (step 2), then the DATCOM wing-body build-up (step 3).

## In progress

- Waiting for the review-fix pull requests above to be merged. #30, #43 and #58 all append to `docs/decisions.md` (D-073, D-074, D-075): each later one needs `main` merged in, a small conflict. The other open questions depend on the owner: the large-angle fin force source (D-059), DATCOM for the supersonic CP and sharp fin sections (D-057), the WGS 84 document (D-054), `.CDX1` samples, altimeter data, and the `main` branch for pull requests (not created as of this commit).

## Next

- Plan 0073, the rest of the import gaps, one pull request each: none left; re-run the OpenRocket campaign on the fixes, then the owner's decisions of plan 0074 (airfoil drag, lug drag, friction form factor).
- Validation campaign (owner, 2026-10-14):
  - **What runs.** Exhaustive comparison against OpenRocket on many generated designs, against the measured NACA/NASA data by regime, and against RASAero II if it can be run here or from its published predictions. Background agents are running all three.
  - **Output.** A differences report with the reasoning for each difference, and a list of OpenRocket issues for its developers.
  - **Next comparison items:** skin friction (1.4 %) and the nose pressure drag question.
- Plan 0070 step 4: motors in pods, as clusters at the pods' offsets (D-086); then booster sets (step 5). Then plan 0061 step 4 (the modelling benchmark). The MCP server's design tools do not yet set a pod group.

- Plan 0055, in order: step 3 part 2 (multi-stage designs and motor ignition delays, pods and booster sets, nose cone variants; the stage mass override as a design-level measured mass), step 2 (freeform and elliptical fins), step 4 (the physics' remaining refusals), step 5 (random-design robustness tests), step 6 (canted-fin roll forcing).

- The owner's answers to the open questions below decide the follow-up work, in this suggested order: the transonic model sources (D-034, D-039) and then the wind tunnel validation of CLAUDE.md 6.7; the large-angle fin force (D-046); `.CDX1` samples; altimeter data for 7.5; golden flight time series (7.6).

- v1.0 Part D:
  - `docs/known-limitations.md` has a v1.0 summary, and its superseded rows are corrected.
  - `README.md` has "What you can trust", with the evidence for each figure.
  - `docs/future-work.md` lists, in order, what v1.0 leaves out, including the drag targets not met and their remaining sourced methods.
  - The full check passes, plus the Playwright end-to-end tests.
  - Tag `v1.0.0`; pull request from `claude/v1-completion` into `main`.

## Open questions

- **Dependency graph (D-090).** GitHub's dependency review, which blocks a pull request that adds a dependency with a known vulnerability, needs Settings > Advanced Security > Dependency graph switched on (https://github.com/ahroonsanthosh/lo-fi-rocket/settings/security_analysis). It is free on a public repository. Please switch it on; the workflow is then one small pull request.
  At v1.0 these are open. Resolved earlier: gravity latitude (D-060), the large-angle force (D-070), and the transonic models (D-055, D-056).

- **Moderate-angle CP (D-070).** The small-angle model and the DATCOM model differ in the in-flight CP at 10 to 20° by up to 0.8 calibers. Blue Scout's measured CP shift at 6° is larger than either predicts. The in-flight margin uses the more forward CP. Should the ARCAS data of TN D-4013, which goes to 21°, be digitised to decide?
- **Base drag with fins and stings (D-069).** The sting-mounted Blue Scout's base force agrees with Niskanen's eq. (3.94) and not with the DATCOM. The free-flight evidence decided the default.
- **Fibreglass shear modulus (D-068).** No approved source gives it. R3 and R5 need at least 0.18 and 0.43 GPa to be flutter-free by TN 4197.
- **Base drag after burnout (D-035).** The displayed mode uses the source's rule; the comparison mode uses OpenRocket's.
- **Deployment speed warning (D-042).** It is a rule-of-thumb placeholder. Please state the figure you want.
- **Drag against flown rockets (D-114, `docs/reports/rasaero-comparison.md` section 7).** Six decisions:
  - **Fin friction.** Should it use each fin's own chord for the Reynolds number (DATCOM eq. 4.1.5.1-a) instead of the rocket's (Niskanen eq. 3.85)? It is implemented and selectable. It helps the flights (+17.7 → about +14 %) and the held-out subsonic and transonic drag, but worsens the supersonic (15.0 → 15.5 % rms), so by plan 0076's rule it is not the default.
  - **Body form factor.** Done (D-115): the DATCOM's, on the evidence of both datasets.
  - **Rail guides and fin-body interference.** Please supply Hoerner, _Fluid-Dynamic Drag_, chapter 8 (approved source 4), or measured rail guide drag data.
  - **Thrust at altitude.** Approve a propulsion text for the nozzle-exit pressure thrust; needed for high flights and for liquid engines.
  - **The apogee note.** Should every flight carry a note that the apogee of real rockets has been about a fifth lower? The example rocket is currently reviewed to show no warnings.
- **Default branch.** `main` exists. Making it the default branch needs the owner, because the `gh` token here is invalid.
- **Review-fix follow-ups for the owner (2026-10-13):**
  - #9 suggests making the example's parachute open at the motor's ejection charge. That would change the example's figures used across the app tests, so it was not done.
  - #17 suggests a seeded initial disturbance so that an unstable rocket visibly tumbles. It needs a sourced disturbance model.
  - U-1 (the temperature override above 11 km) needs the owner's choice under rule 4 and is not yet done.
- **Not blocking:** papers that would close verifications formally, namely Dormand and Prince (1980), Box and Muller (1958) and Barrowman's 1966 NARAM-8 report.

- Gravity latitude dependence (D-030, D-054): NIMA TR8350.2 is approved but could not be downloaded from this environment (NGA empty reply, DTIC 403, Wayback resets). Please place the PDF in `reference/docs/` or allow the host; the implementation then follows plan 0019.

- Fin normal force at large angles of attack (D-046): a six-degree-of-freedom flight now ends with an explicit "model-limit" reason when the angle of attack reaches 90°, because the fin term is a small-angle flat-plate law and no approved source gives a large-angle law. Ballistic flights and ejection-charge deployments after the turn-over therefore stop at the turn-over with the apogee reported. Approve a source for the large-angle fin force (for example Hoerner, Fluid-Dynamic Lift) if those flights must be simulated to landing.
- Random generator source (D-050): Blackman and Vigna's xoshiro paper was added to `reference/`; the Box and Muller (1958) paper is paywalled and the normal sampler is verified by its distribution tests. Add the paper if a document check is wanted.
- Customary units source (D-040): NIST SP 811 was added to `reference/` for the inch, foot, pound, ounce, pound-force, mile per hour, foot per second and Fahrenheit behind the units toggle. Say if another source is preferred; the factors are definitional and would not change.
- Deployment speed warning threshold (D-042): no default is given in CLAUDE.md; 20 m/s is a user-editable placeholder labelled as a rule of thumb. Please state the figure you want.
- `.CDX1` import (CLAUDE.md 6.7 item 3) needs sample RASAero II files; not scheduled until they arrive. The drag-curve CSV reader (D-047) should be checked against a real RASAero aero-plot export, which is not in `reference/`.

- Dormand and Prince (1980) is not in `reference/`; the tableau is verified by the consistency sums and order tests (D-037). The owner may add the paper to close the verification formally. Not blocking.

- Pull request: `main` now exists (at the same head as `claude/inspiring-tesla-xxp0hh` when the viewer branch was cut); the viewer's pull request targets it and waits for v1.0.0.
- RK4 at a 0.01 s fixed step is unstable for R2 (found while testing the viewer, D-071): the flight ends in a `NonFiniteResultError` from the pitch damping moment, or early at the model limit, while 0.002 s and the Dormand–Prince integrator fly it normally. The app's default is Dormand–Prince. For the physics owner: a step-size stability check or a warning when a fixed RK4 step is coarse against the pitch period would make this explicit to users (CLAUDE.md rule 3).
- The viewer's requests for the results (plan 0034, D-071): a wind record in `FlightResult.modes`, an optional stored time series per `DispersionRun`, and an ellipse in `DispersionSummary`.
