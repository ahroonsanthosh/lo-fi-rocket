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

## In progress

- Waiting for the review-fix pull requests above to be merged. #30, #43 and #58 all append to `docs/decisions.md` (D-073, D-074, D-075): each later one needs `main` merged in, a small conflict. The other open questions depend on the owner: the large-angle fin force source (D-059), DATCOM for the supersonic CP and sharp fin sections (D-057), the WGS 84 document (D-054), `.CDX1` samples, altimeter data, and the `main` branch for pull requests (not created as of this commit).

## Next

- Plan 0064 part 2b (`.ork` stages import, OpenRocket comparison) and part 3 (stage editing in the app and the MCP server). Then plan 0061 step 4 (the modelling benchmark).

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
- **`.CDX1` import.** It needs sample RASAero II files.
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
