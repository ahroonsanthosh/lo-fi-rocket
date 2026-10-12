# Final audit

Date: 2026-10-12, at the end of Prompt 4 (the last prompt of `docs/roadmap.md`); **updated the same day after Prompt 5 (section 0 and the rows marked "Prompt 5")**. Branch `claude/inspiring-tesla-xxp0hh`, 25 commits from 1b8c7fd to the one carrying this file. Written under autonomous mode (CLAUDE.md section 11). This audit goes through every requirement of CLAUDE.md and states what is done, what is partial, what is not done, and where the evidence is. It does not restate the acceptance reports (`docs/reports/`), which hold the comparison tables.

## 0. Update after Prompt 5 (plans 0019 to 0023)

- Rule 2 (no placeholder physics): the three `NotImplementedError` paths that stopped flights at Mach 0.8 are closed with sourced or data-based models: the transonic nose drag of every shape from NASA TR R-100 (DRAG-15 to DRAG-17, D-055), the transonic fin force chosen against held-out data (BAR-12, D-056), the supersonic roll damping (AERO-6, AERO-7, D-058). Still throwing by name: fin cant, clusters, stages, streamers, `.CDX1`, the large-angle fin force (D-059) and the gravity latitude formula (D-054).
- Rule 4 (stop and ask): the owner's Part A answers are recorded in D-053; the new asks are D-054 (document), D-057 (DATCOM), D-059 (large-angle source).
- Sources: NASA TR R-100 is now model data (its public domain status in `reference/SOURCES.md` section 8), digitised twice with the disagreement recorded; TN D-4013, TN D-4014 and RM A53D02 are held-out validation data, used only by the validation tests. The Box–Muller sampler's statistical verification is accepted by the owner (D-053) in place of the paywalled paper. The Dormand–Prince tableau is additionally checked against SciPy 1.18.1.
- 6.3 Drag: every component across all regimes for every nose shape; validated against wind tunnel data by regime (`docs/reports/wind-tunnel-validation.md`): over-predicted 15 to 20 % subsonic for polished bodies, the transonic rise too early, supersonic within 10 % for thin sharp fins and up to twofold for thick rounded-section fins.
- 6.7 Wind tunnel validation: done, with DATCOM proposed as an additional source for the supersonic body normal force and sharp fin sections.
- 7.4 OpenRocket comparison: R5 added, within every tolerance (apogee +2.5 %, maximum velocity +0.8 %).
- 7.6 Golden outputs: flight time series for R1 to R5 with both winds, compared exactly.
- Trust summary by use: `docs/reports/prompt-5-final-report.md` section 5.
- Figures after Prompt 5: 100 register entries (IDs listed in `docs/equations.md`), 59 decisions, 34 limitation records, 23 plans, 5 reports; tests: see the figure table (section 13), updated below.

## 1. The non-negotiable rules (CLAUDE.md section 1)

| Rule                                            | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. No equation from memory; citation above each | done   | 102 register entries in `docs/equations.md` (UNIT 1 to 11, ATM, GEO 1 to 13, BAR 1 to 11, MOT 1 to 6, DYN 1 to 15, GRAV, ENV 1 to 5, DRAG 1 to 14, AERO 1 to 5, RNG 1 and 2), each with source, page, validity, units, function and test. Two entries are verified by tests rather than by a document in `reference/`: DYN-11 (Dormand–Prince tableau, D-037) and RNG-2 (Box–Muller, D-050); both are open questions. Conventions that are not physics (event bisection, step controller, CSV layouts, profile interpolation) are labelled as conventions in the register and in decisions. |
| 2. No placeholder physics                       | done   | `NotImplementedError` for: transonic drag of non-conical, non-ogive noses (D-034), fin normal force at 0.8 < M < 1.2 (D-039), supersonic roll damping, canted fins, clustered or staged motors, streamers (not representable), `.CDX1` import. No function returns a constant in place of a model.                                                                                                                                                                                                                                                                                          |
| 3. No silent fallback                           | done   | `InvalidInputError` with the received value and the requirement on every boundary; drag tables and thrust curves are never extrapolated (D-047, D-044); a stored design that fails validation is kept aside and reported; a flight that leaves the model's angle-of-attack range ends with `endReason: 'model-limit'` and a warning (D-046); the adaptive integrator throws `SimulationStalledError` rather than crawling.                                                                                                                                                                  |
| 4. Stop and ask on conflicts                    | done   | Section 11 replaced "wait for approval" with recording; every case where sources were silent or conflicting is a decision (D-016, D-027, D-030, D-034, D-035, D-039, D-046) and an open question in `docs/progress.md`. No conflict exceeded a test tolerance (criterion a) and no reference comparison failed (criterion c).                                                                                                                                                                                                                                                               |
| 5. Tests with every physics function            | done   | 579 tests in 49 files (physics 426, formats 112, app 41); each register entry names its test.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 6. Plan before coding                           | done   | 18 plans in `docs/plans/`, one per step, written before the code of that step.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 7. Small verifiable steps, full suite each time | done   | one commit per plan or plan part; `pnpm check` (typecheck, lint, format, tests) green at every commit; CI runs the same plus the build and the Playwright tests.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 8. Honest about limitations                     | done   | 32 limitation records in `docs/known-limitations.md` (model, source statement, effect, behaviour, user-facing), each named in the UI where it applies (stability panel, flight results, motor panel, CSV tabs).                                                                                                                                                                                                                                                                                                                                                                             |

## 2. Product goals (section 2)

| Goal                                                          | Status  | Evidence                                                                                                                                                     |
| ------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Design from components with live stability, mass, dimensions  | done    | plan 0012; `App.test.tsx`; Playwright `new-user.spec.ts`                                                                                                     |
| Real commercial motors and custom thrust curves               | done    | `.eng`, `.rse`, ThrustCurve.org with offline cache, CSV curves with mass and CG profiles (plans 0004, 0007, 0013, 0018)                                      |
| Accurate enough to validate against OpenRocket and altimeters | done    | CG within 0.0004 %, CP within 0.035 %, apogee within 2.5 %, maximum velocity within 0.6 %, ground hit within 0.01 % (reports); altimeter overlay (plan 0015) |
| Easier than OpenRocket                                        | partial | one screen, plain-language warnings, no hidden settings; judged by the scripted new-user flow only, not by users                                             |
| Reliable                                                      | done    | no `any`, strict TypeScript, no NaN or Infinity leaves the simulator, autosave with recovery, validated versioned files, deterministic results               |
| Architecture for liquid engines                               | done    | mass rules and CG profiles in the motor model; no rewrite was needed for plan 0018                                                                           |
| Non-goals respected                                           | done    | no CFD; clusters and stages rejected by name (the `.ork` reader and the design model have single-motor data; the mount is one tube); no combustion modelling |

## 3. Licensing (section 3)

OpenRocket's source was never read; it was run as a black box through `tools/openrocket-harness/` to produce `reference/rockets/values.csv` and the time series (D-013). Its file format was read from the files it wrote (D-026). Every equation is cited to the published literature. The repository keeps third-party documents while private (`reference/SOURCES.md`, "Copyright status").

## 4. Sources (section 4)

Approved sources used: Niskanen (2009), Barrowman (1967) and Barrowman and Barrowman (1966), USSA 1976, Hoerner where Niskanen refers to it, the RASP and RockSim specifications and the ThrustCurve.org API, the NACA and NASA reports as validation data only. Added under section 11 and listed as open questions: the SI Brochure (D-011, Prompt 0), NIST SP 811 (D-040), Blackman and Vigna (D-050). Not in `reference/`: Dormand and Prince (1980), Box and Muller (1958). NASA TR R-100 has not been used as model data (D-034) pending the owner's answer.

## 5. Technology and architecture (section 5)

| Requirement                                         | Status | Evidence                                                                                                         |
| --------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| TypeScript strict, noUncheckedIndexedAccess, no any | done   | `tsconfig.base.json`; ESLint strictTypeChecked with the unsafe rules as errors; lint clean                       |
| Monorepo physics / formats / app                    | done   | pnpm workspace; physics purity enforced by lint (no DOM, network, randomness, clock; D-004)                      |
| Vitest and fast-check                               | done   | property tests on units, geometry, stability, motors, the reducer, the design round trip                         |
| float64 with documented tolerances                  | done   | every register entry and function comment states its tolerance                                                   |
| SI with branded types                               | done   | `packages/physics/src/units/si.ts`; conversions only at the boundaries (UNIT-1 to 11)                            |
| Coordinate system defined once                      | done   | `docs/conventions.md` (body frame, flight ENU frame, quaternion convention)                                      |
| Determinism, seeded randomness with the seed saved  | done   | `Math.random` banned in physics; xoshiro128** with the seed in flight modes, dispersion results and design files |

## 6. Physics scope (section 6)

| Item                                | Status          | Notes                                                                                                                                                                                                                             |
| ----------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 Components, mass, CG, inertia   | done            | all nose shapes of Appendix A, tubes, transitions, fins, lugs, rail buttons, internal parts; propellant burn in mass, CG (MOT-3 to 6)                                                                                             |
| 6.2 Stability                       | done            | Barrowman with Niskanen's extensions, interference, worst roll angle, both display modes (D-016), liftoff and burnout                                                                                                             |
| 6.3 Drag                            | done (Prompt 5) | every Niskanen component across the regimes for every nose shape (DRAG-15 to DRAG-17 from TR R-100, D-055); validated by regime against wind tunnel data (section 0); transonic and supersonic flagged with the validation status |
| 6.4 Atmosphere and environment      | done            | USSA 1976 to 86 km, site overrides, constant wind, profile by altitude, turbulence (plan 0016), rail length, angle, direction                                                                                                     |
| 6.5 Flight simulation               | done            | 6DOF main, 3DOF cross-check labelled; RK4 and Dormand–Prince agree; convergence shown; all events and outputs; the 90° angle-of-attack limit (D-046)                                                                              |
| 6.6 Motors                          | done            | `.eng` and `.rse` per their specifications, ThrustCurve.org with cache, custom curves with masses, linear interpolation, mass rules documented per format (D-028, D-029)                                                          |
| 6.7 RASAero: wind tunnel validation | done (Prompt 5) | `docs/reports/wind-tunnel-validation.md`: CP and C_D by regime against TN D-4013, TN D-4014 and RM A53D02; DATCOM proposed (D-057)                                                                                                |
| 6.7 Drag curve import               | done            | plan 0015 (D-047)                                                                                                                                                                                                                 |
| 6.7 `.CDX1` import                  | not done        | needs sample files from the owner                                                                                                                                                                                                 |

## 7. Verification (section 7)

| Level                     | Status          | Evidence                                                                                                                                                               |
| ------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1 Hand calculations     | done            | every equation has at least one hand value with its working in the test (register column "Verified by")                                                                |
| 7.2 Analytical cases      | done            | v²/2g vacuum coast, constant-thrust kinematics, 57 published atmosphere rows (`simulate.analytical.test.ts`, `ussa1976.test.ts`)                                       |
| 7.3 Property tests        | done            | mass never negative or increasing, fins never move the CP forward, more drag never raises the apogee, energy conserved in drag-free coast, and others                  |
| 7.4 OpenRocket comparison | done            | within tolerance on every figure for R1 to R5 (R5 added by Prompt 5: apogee +2.5 %, maximum velocity +0.8 %), not tuned (`docs/reports/phase-2-acceptance.md`)         |
| 7.5 Real flight data      | partial         | the overlay view exists (plan 0015) and is tested with synthetic data; no altimeter file has been supplied yet                                                         |
| 7.6 Golden outputs        | done (Prompt 5) | `golden/ussa1976.json` and `packages/formats/golden/flights/*.json` (R1 to R5, both winds, exact), plus the pinned acceptance figures and the pinned validation errors |

## 8. Reliability (section 8)

Inputs validated at the boundary with plain messages (every editor field, every file reader, every physics function); NaN and Infinity detected at every state and derivative with the time and variable named; autosave with versioned files and a migration chain tested with synthetic steps; no unhandled rejection in the app (every async path reports its error in the UI, tested for the network, files and the simulator). The one hang found (ballistic flight, D-046) is fixed and tested.

## 9. Usability (section 9)

Live side view with CG and CP; stability shown always with configurable thresholds labelled as rules of thumb; warnings for rail exit, thrust-to-weight, deployment speed, transonic flight and model limits, each with its one-sentence reason; metric default with the toggle; `.ork` import; native controls with labels and keyboard list navigation; the key numbers fit 1366 × 768 (Playwright). Not audited with a screen reader.

## 10. Phases and acceptance (section 10)

Phase 1 (`phase-1-acceptance.md`), Phase 2 (`phase-2-acceptance.md`), Phases 3 and 4 (`phase-3-4-acceptance.md`) and Phase 5 (`phase-5-acceptance.md`) each passed their stated criteria, with R5 as the standing exception in Phase 2.

## 11. Decisions made without asking

52 decisions in `docs/decisions.md`. Those the owner may want to overturn, with the cost of doing so:

- D-016 and D-035 (displayed stability and base-drag rules differ from OpenRocket's): a flag each; the comparison modes stay.
- D-034 and D-039: resolved by D-055, D-056 and D-058 (Prompt 5). The conventions inside them (held values, the (3.87) join, the cubic fin interpolation, the linear roll-damping band) are each one function.
- D-046 (flights end at 90° angle of attack in still air): a large-angle fin law needs a source (D-059 proposes three); one function.
- D-042 (20 m/s deployment speed placeholder): one number.
- D-049 and D-051 (profile and dispersion conventions): data conventions, no physics.

## 12. Not done, in priority order

1. Done in Prompt 5: the wind tunnel validation (D-057). Open from it: DATCOM for the supersonic CP and sharp fin sections, and the large-angle fin force (D-059).
2. `.CDX1` import: blocked on sample files.
3. Done in Prompt 5: golden flight time series (D-059).
4. Real altimeter data (7.5): the view exists; data awaited.
5. Gravity latitude formula (D-030, D-054): the WGS 84 document to place in `reference/docs/`.
6. ThrustCurve.org live check: the client is tested against fixtures shaped by `swagger.json`; one live search would confirm the field names.
7. Screen-reader audit; browsers other than Chromium.

## 13. Figures

| Measure                             | Value                                                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Source lines (TypeScript, no tests) | 16 443                                                                                                               |
| Test lines                          | 7 513                                                                                                                |
| Tests                               | 639 in 54 files after Prompt 5 (579 in 49 files at the end of Prompt 4)                                              |
| End-to-end tests                    | 3 (Playwright, Chromium)                                                                                             |
| Register entries                    | 100 distinct IDs after Prompt 5 (DRAG-15 to 17, BAR-12, AERO-6, AERO-7 added; the earlier figure counted table rows) |
| Decisions                           | 59                                                                                                                   |
| Limitation records                  | 34                                                                                                                   |
| Reference documents                 | 10 sections in `reference/SOURCES.md`, SHA-256 pinned                                                                |
| Reference rockets and motors        | 5 `.ork` with OpenRocket figures and time series; 8 `.eng`, 7 `.rse`                                                 |
