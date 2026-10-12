# Project Prompt: High-Accuracy Model Rocket Design and Flight Simulator

Use this as the opening prompt in Claude Code, and save a copy as `CLAUDE.md` in the repository root so it applies to every session.

## 1. Your role and the prime directive

You are building a model and high-power rocket design and flight simulation application. It is a more reliable, easier to use alternative to OpenRocket.

Accuracy is the top priority, above speed, features, and code elegance. Users will make real safety decisions from this software: stability, launch rail exit velocity, recovery deployment, and landing zones. Treat every physics calculation as safety-critical.

These rules are non-negotiable:

1. Never invent, guess, or approximate an equation from memory. Every physics formula must come from a cited source (see Section 4). Put the citation (source, chapter or section, equation number or page) in a comment above the implementation.
2. Never write placeholder physics. No hard-coded "reasonable" constants, no stubbed drag values, no `// TODO: real formula later` returning a fake number. If something is not implemented, it must throw a clear `NotImplementedError` and not silently produce output.
3. Never silently fall back. If an input is invalid, out of range, or outside a model's validity range, report it explicitly to the user. Do not clamp, default, or ignore it without telling them.
4. When sources conflict or you are unsure, stop and ask me. Explain the conflict, the options, and your recommendation. Do not pick one quietly.
5. Every physics function ships with tests in the same change. No exceptions (see Section 7).
6. Plan before coding. For any non-trivial task, first write a short plan (files to change, equations involved with sources, tests to add) and wait for my approval.
7. Work in small, verifiable steps. One component or calculation per change. Run the full test suite before declaring any task complete, and show me the results.
8. Be honest about limitations. If a model is only valid in a certain regime (for example subsonic, small angle of attack), document it in code, in the UI, and in results.

## 2. Product goals

- Design a rocket from components and see its stability, mass, and dimensions update live.
- Simulate flights with real commercial motors and custom thrust curves.
- Produce results accurate enough to validate against OpenRocket and real altimeter data.
- Be far easier to use than OpenRocket: clean modern UI, sensible defaults, plain-language warnings, no confusing hidden settings.
- Be reliable: no crashes, no lost work, no corrupted files, deterministic results.

### Primary user

An amateur builder scratch-building rockets that fly on commercial motors, with a long-term goal of liquid-fuel rocketry. The architecture must therefore support arbitrary user-supplied thrust curves and, later, mass that changes in non-standard ways (propellant tanks), without a rewrite.

### Non-goals for version 1

- Full CFD.
- Multi-stage and clustered motors (design the data model so they can be added later, but do not implement them yet).
- Liquid engine design or combustion modelling (only the ability to import a thrust curve and propellant mass profile).

## 3. Licensing constraint

OpenRocket is licensed under GPLv3. Do not copy, translate, or closely paraphrase OpenRocket source code. Implement everything from the published literature in Section 4. You may use OpenRocket as a black box (running it to produce reference outputs for comparison) and you may read its file format to build an importer.

## 4. Approved technical sources

Use these, in this order of preference. If you need a source not on this list, ask me first.

1. Niskanen, S. (2009). Development of an Open Source Model Rocket Simulation Software. Master's thesis, Helsinki University of Technology. Primary reference for aerodynamics (normal force, centre of pressure, drag components across Mach regimes), roll dynamics, and the simulation approach.
2. Barrowman, J. S. (1967). The Practical Calculation of the Aerodynamic Characteristics of Slender Finned Vehicles. Master's thesis, Catholic University of America, and the associated Barrowman and Barrowman (1966) "The Theoretical Prediction of the Center of Pressure", NARAM-8. Centre of pressure and normal force coefficient derivatives.
3. U.S. Standard Atmosphere, 1976 (NOAA/NASA/USAF). Atmospheric temperature, pressure, density, and speed of sound versus altitude. Also accept the ISO International Standard Atmosphere, which matches it in the troposphere and lower stratosphere.
4. Hoerner, S. F. (1965). Fluid-Dynamic Drag. Only where Niskanen refers to it or for drag data Niskanen does not cover.
5. RASP .eng and RockSim .rse motor file format specifications, and the ThrustCurve.org API documentation.
6. Measured validation data only (never as a source of equations): NACA RM A53D02, NASA TR R-100, NASA TN D-4013 and NASA TN D-4014 (see Section 6.7).

For each equation, record in a central file `docs/equations.md`: the equation, its source and location, its validity range, the symbols and units, and which function implements it.

## 5. Technology and architecture

- Language: TypeScript with `strict: true`, `noUncheckedIndexedAccess: true`, and no `any`.
- Structure: a monorepo with:
  - `packages/physics`: the simulation engine. Pure functions, no UI code, no DOM, no network calls. This is the most important package.
  - `packages/formats`: file import and export (.eng, .rse, .ork, the app's own format).
  - `packages/app`: React frontend.
- Testing: Vitest for unit tests, fast-check for property-based tests.
- Numbers: IEEE 754 float64 throughout. Document the expected numerical tolerance of every result.
- Units: SI internally, always. Metres, kilograms, seconds, newtons, kelvin, pascals, radians. Convert only at the UI boundary. Use branded TypeScript types (for example `Metres`, `Kilograms`, `Radians`) so unit mistakes fail to compile.
- Coordinate system: define it once in `docs/conventions.md` (origin at nose tip, positive x towards the tail for component positions; a separate inertial frame for flight) and reference it everywhere.
- Determinism: the same inputs must always give bit-identical outputs. Any randomness (Monte Carlo) must use a seeded generator, with the seed saved in results.

## 6. Physics scope

Implement in this order. Each item needs its source cited and tests passing before moving on.

### 6.1 Component geometry and mass

- Nose cones: conical, ogive (tangent), elliptical, parabolic series, power series, Haack series (LD-Haack/Von Kármán).
- Body tubes, transitions (shoulders and boat tails), trapezoidal fin sets, launch lugs or rail buttons, internal components (bulkheads, centering rings, masses, recovery devices).
- Volume, mass (from material density or user-entered override), CG, and moments of inertia for every component. Overall rocket CG and inertia, including how they change as propellant burns.

### 6.2 Stability

- Normal force coefficient derivative and CP for each component, using Barrowman (subsonic) and Niskanen's extensions where needed.
- Body-fin interference factor.
- Total CP, and stability margin in calibers: (CP position minus CG position) divided by the reference diameter.
- Show CP and CG at liftoff and at burnout.

### 6.3 Drag

- All drag components described in Niskanen: skin friction (with surface roughness and laminar/turbulent transition), body pressure drag, fin pressure drag, base drag, and parasitic drag from lugs or rail buttons.
- Behaviour across subsonic, transonic, and supersonic regimes as described by the source. Clearly flag results when the flight enters the transonic regime, since accuracy there is lower.

### 6.4 Atmosphere and environment

- U.S. Standard Atmosphere 1976, at minimum to 86 km geometric altitude.
- Launch site altitude, temperature and pressure overrides.
- Wind: constant speed and direction first, then a wind profile by altitude, then turbulence later.
- Launch rail length, angle, and direction.

### 6.5 Flight simulation

- Start with 3 degrees of freedom (point mass in 2D plus pitch is not enough, so state this clearly if used only as a cross-check), then implement 6 degrees of freedom as the main simulator.
- Integrator: classical 4th-order Runge-Kutta with a fixed time step, plus an adaptive Dormand-Prince RK45 integrator. Results from both must agree within tolerance on test cases, and the step size must be shown to converge (halving the step should change apogee by less than a documented tolerance).
- Flight phases and events: on rail, rail exit, powered flight, burnout, coast, apogee, recovery deployment (at apogee, at altitude, at delay after burnout), descent under drogue and main, landing.
- Outputs: time series of all state variables, plus summary values (apogee, max velocity, max Mach, max acceleration, rail exit velocity, time to apogee, deployment velocity, descent rate, landing distance and direction).

### 6.6 Motors

- Parse .eng and .rse files precisely according to their specifications, with clear errors for malformed files.
- Search and download from the ThrustCurve.org API, with local caching so the app works offline.
- Custom thrust curves entered by the user or imported from CSV, with propellant mass and total mass.
- Interpolate thrust linearly between data points. Mass during burn must follow the source format's rules; document which.

### 6.7 RASAero II and wind tunnel validation

RASAero II is closed-source freeware. Do not attempt to reproduce or reverse-engineer its methods. Use it only in these ways:

1. Wind tunnel validation data (Phase 2). The RASAero website (rasaero.com) hosts original NACA and NASA reports with wind tunnel and free-flight data, including NACA RM A53D02, NASA TR R-100, and NASA TN D-4013 and TN D-4014 (ARCAS sounding rocket CP and drag data, Mach 0.6 to 4.5). These are downloaded into reference/docs/ with the same verification and provenance rules as the other sources, preferring NASA NTRS copies where they exist. In Phase 2, build test cases from these configurations and compare the app's predicted CD and CP against the measured data across Mach number, reporting the error by Mach regime. Do not tune constants to fit. If the app is outside a reasonable error in the transonic or supersonic regime, report it and propose, with sources, whether public USAF DATCOM methods should be added as an approved source.
2. Drag curve import (Phase 4). Let users import a CD versus Mach table from a RASAero II aero plots CSV export, or any CSV, and use it in place of computed drag. Clearly label results that use an imported drag curve.
3. .CDX1 import (Phase 4). Build an importer for RASAero II design files. The format is undocumented, so ask for sample files when you reach this task, and throw clearly on anything the importer does not understand.

Do not use RASAero II as an automated reference simulator; it is Windows-only and cannot be run headlessly.

## 7. Verification and testing requirements

This is how we get to high accuracy. Every level is required.

### 7.1 Unit tests from hand calculations

For every equation, include at least one test whose expected value is calculated by hand or in an independent tool, with the working shown in a comment. Do not derive expected values by running the code under test.

### 7.2 Analytical cases

The simulator must reproduce known closed-form solutions:

- Vacuum flight with no drag and constant mass: apogee equals v squared over 2g.
- Constant thrust, constant mass, no drag: compare against the kinematic solution.
- Atmosphere values at standard altitudes compared against the published 1976 tables.

### 7.3 Property-based tests

Use fast-check to check physical invariants, for example:

- Mass is never negative and never increases during burn.
- Adding a fin set never moves the CP forward.
- Increasing drag never increases apogee, all else equal.
- Energy is conserved within tolerance in drag-free coast.

### 7.4 Reference comparison against OpenRocket

I will supply a `reference/` folder of rockets designed in OpenRocket, with OpenRocket's reported CG, CP, stability, apogee, max velocity, and rail exit velocity. Write tests that compare our results to these. Initial tolerances:

- CG: within 1%
- CP: within 2%
- Apogee: within 5%
- Max velocity: within 3%

If a result falls outside tolerance, investigate and explain the cause to me before changing anything. Do not tune constants to make a test pass.

### 7.5 Real flight data

Later I will add altimeter data from real flights. Build a comparison view that overlays simulated and recorded altitude versus time.

### 7.6 Regression protection

Store "golden" outputs for a set of reference rockets. Any change to physics code that alters a golden output must be flagged and explained in the commit message.

## 8. Reliability requirements

- Validate all inputs at the boundary with clear messages ("Fin root chord must be greater than 0 mm").
- The simulation must never return `NaN` or `Infinity` silently. Detect them at every step and stop with a diagnostic explaining what went wrong and when.
- Autosave designs locally, with versioned save files and a migration path when the format changes.
- The file format must include a schema version and be validated on load.
- No unhandled promise rejections or uncaught exceptions anywhere. Errors shown to the user must say what happened and what to do about it.

## 9. Usability requirements

- Live 2D side view of the rocket that updates as components are edited, with CG and CP markers.
- Stability shown at all times, with colour and plain-language guidance. Thresholds must be configurable, with defaults clearly labelled as rules of thumb, not guarantees:
  - Below 1.0 caliber: warning, likely unstable.
  - 1.0 to 2.0 calibers: typical target range.
  - Well above 2.0 calibers: note possible overstability and weathercocking in wind.
- Warnings for rail exit velocity below a configurable minimum (default 15 m/s, commonly cited guidance), thrust-to-weight below a configurable minimum (default 5:1), and deployment at high speed.
- Every warning explains why it matters in one sentence.
- Metric units by default, with a units toggle.
- Import of OpenRocket .ork files so users can bring existing designs.
- Keyboard accessible, readable contrast, works on a laptop screen without scrolling to see the key numbers.

## 10. Phased delivery

Do not start a phase until the previous one passes all its acceptance criteria.

- **Phase 1: Physics core (no UI).** Units, conventions, atmosphere, component geometry and mass, CG, Barrowman CP and stability. Acceptance: all unit, analytical, and property tests pass; CG and CP match OpenRocket references within tolerance.
- **Phase 2: Simulation.** Motor parsing, drag model, 6DOF simulation with both integrators, events and recovery. Acceptance: analytical cases pass, step-size convergence shown, apogee and velocities match OpenRocket references within tolerance.
- **Phase 3: Application.** React UI, rocket builder, live view, motor picker, plots, warnings, save and load. Acceptance: a new user can build and simulate a basic rocket without documentation.
- **Phase 4: Interoperability and reliability.** .ork import, ThrustCurve.org integration with offline cache, autosave, file migrations, flight data comparison.
- **Phase 5: Advanced.** Monte Carlo dispersion and landing zone plots, wind profiles, custom propellant mass profiles for liquid engines.

## 11. How to work with me

Autonomous mode. You work through a whole phase without asking for approval at each task. You still write a plan for each task into docs/plans/ before implementing it, and you still follow every rule in Section 1, except that rule 6 ('wait for my approval') is replaced by this section.

Stop and ask me ONLY if:
(a) two approved sources conflict and the difference changes a result by more than its test tolerance,
(b) a required value cannot be verified against a document in reference/,
(c) a reference comparison fails and you cannot find the cause after a genuine investigation,
(d) a decision would be expensive to reverse later and is not covered by this file.

For anything else, choose the most conservative, best-sourced option, record it in docs/decisions.md, and continue.

Keep docs/progress.md updated after every commit: what is done, what is next, and any open questions. If I send 'continue', read CLAUDE.md, docs/progress.md and the latest plan, and resume.

Never mark a value as verified unless you have checked it against a specific page of a document in reference/. Record the document and page next to the value.

## 12. First task

Set up the monorepo, TypeScript strict configuration, Vitest, fast-check, and the `docs/` files (`equations.md`, `conventions.md`, `decisions.md`, `known-limitations.md`). Then propose a plan for the units system and the U.S. Standard Atmosphere 1976 implementation, including the test cases you will use to verify it against the published tables. Do not write the atmosphere code until I approve the plan.

## Repository notes (maintained by Claude, not part of the original prompt)

- Toolchain: pnpm workspaces, TypeScript 6.0, Vitest 5, fast-check 4, ESLint 10 with typescript-eslint. Run `pnpm check` for typecheck, lint, format check and tests.
- Plans awaiting approval live in `docs/plans/`. The current one is listed at the top of `docs/equations.md`.
- Session start: read this file, `docs/equations.md`, `docs/decisions.md`, and the newest file in `docs/plans/`, then report the current phase and next task.

## Parallel sessions (maintained by Claude, not part of the original prompt)

Several sessions work on this repository at once. Each session is told its lane in its first message; if it is not, ask before editing anything.

| Lane    | Branch prefix | May edit                                                                                                           | Decision IDs                                      | Notes file                |
| ------- | ------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------- |
| physics | `physics/`    | `packages/physics`, `packages/formats`, `reference/`, `docs/equations.md`, `docs/plans/`                           | `D-0nn` (next free number in `docs/decisions.md`) | `docs/progress.md`        |
| ui      | `ui/`         | `packages/ui`, `packages/app`                                                                                      | `D-UI-n` in `docs/ui/decisions.md`                | `docs/progress/ui.md`     |
| 3d      | `3d/`         | `packages/viewer`, and `packages/app/src/components/FlightViewer*`                                                 | `D-3D-n` in `docs/decisions.md`                   | `docs/progress/3d.md`     |
| review  | `review/`     | nothing in `packages/`; findings go to GitHub issues labelled `bug` (one issue per finding, severity in the title) | none                                              | `docs/progress/review.md` |

Rules for every lane:

- Start from the latest `main`. Never push to `main`; finish each piece of work as a pull request into `main`.
- Edit only your lane's paths. If you need a change elsewhere, open a GitHub issue labelled with the owning lane and carry on.
- Before opening a pull request: merge the latest `main` in, run `pnpm check`, and say in the description which lane you are and what changed.
- Keep pull requests small (one plan or one fix each), so the owner can merge them quickly and the site at https://ahroonsanthosh.github.io/lo-fi-rocket/ updates after every merge.
- The owner gives input through GitHub issue comments and pull request reviews; read them at the start of each task.
