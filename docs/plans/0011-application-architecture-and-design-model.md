# Plan 0011: Prompt 3 roadmap, application architecture, design model and native file format

**Status:** written 2026-10-12 under autonomous mode (CLAUDE.md section 11); step 1 of Prompt 3.
**Phase:** 3 (application) and 4 (interoperability and reliability), CLAUDE.md section 10. Phases 1 and 2 passed acceptance (`docs/reports/`).

## Prompt 3 roadmap

Prompt 3 covers Phases 3 and 4 (`docs/roadmap.md`). It is delivered in five steps, each with its own plan file and one or more commits, in this order:

| Step | Plan | Content                                                                                                                                                                                                                                            | Acceptance                                                                                        |
| ---- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1    | 0011 | This plan: architecture decisions, the design model, the native file format with schema version, validation and migrations, the design-to-physics adapter, the exact imperial unit definitions for the units toggle                                | round trip and validation tests; R1 from a design file reproduces the Phase 1 and Phase 2 figures |
| 2    | 0012 | Rocket builder: component list and editors with boundary validation and the units toggle, live SVG side view with CG and CP markers, stability banner with configurable thresholds and plain-language guidance, autosave to local storage          | component tests; keyboard navigation; the key numbers visible without scrolling at 1366×768       |
| 3    | 0013 | Motors: bundled reference motors, `.eng`, `.rse` and CSV import, custom thrust curves with masses, ThrustCurve.org search and download (`swagger.json`) with an offline cache, picker and thrust-curve plot                                        | client tests against recorded responses; cache works with the network off                         |
| 4    | 0014 | Simulation: launch site, rail and wind editors, the simulator in a Web Worker, results summary, events, warnings (rail exit, thrust-to-weight, deployment speed, transonic, model limits), time-series plots, CSV export                           | R1 to R4 from the UI give the Phase 2 figures; warnings fire on the stated thresholds             |
| 5    | 0015 | Files and interoperability: save and load, migrations exercised, `.ork` import with clear errors, altimeter CSV overlay (CLAUDE.md 7.5), imported C_D versus Mach table (6.7 item 2), Playwright end-to-end tests, Phase 3 and 4 acceptance report | a new user builds and simulates a basic rocket without documentation (scripted end-to-end)        |

The `.CDX1` importer (CLAUDE.md 6.7 item 3) needs sample files from the owner and is not scheduled; it is listed as an open question.

## Architecture decisions (recorded as D-040 to D-044 in `docs/decisions.md`)

- **Packages.** The design model, the native file format and the design-to-physics adapter live in `packages/formats/src/design/` (pure TypeScript, no DOM), so that the app, the tests and any future command-line tool share one definition. `packages/app` holds only React code, browser storage and the worker. `packages/physics` stays as it is; the only addition is the exact imperial conversions (UNIT-5 to UNIT-11).
- **Native format.** JSON, UTF-8, extension `.lofi.json`, SI units throughout (no unit fields in the file), a top-level integer `schemaVersion`, an `id` (UUID) and a `name`. Validation on load is a hand-written structural check that reports the JSON path and what was expected; nothing is defaulted or dropped silently. Unknown top-level keys and unknown component kinds are errors, not warnings. Migrations are a list of pure functions from version n to n + 1 applied before validation; a file newer than the app is rejected with a message naming both versions.
- **Motors in a file are embedded,** with their provenance (bundled name, ThrustCurve id and simfile id, imported file name, or custom). A design file therefore simulates offline and is independent of the motor cache.
- **Modes.** A design carries its stability thresholds and warning thresholds (defaults from CLAUDE.md 9, labelled rules of thumb), the finish, and the displayed physics modes (Niskanen roll reduction on, source base-drag rule, standard gravity). The OpenRocket-equivalent modes exist only for the comparison tests and are not in the file.
- **Imperial units.** Display-only conversions use the exact definitions of NIST SP 811 Appendix B (inch, foot, pound, ounce, pound-force, mile per hour, foot per second, degree Fahrenheit), added to `reference/docs/` and `docs/equations.md` as UNIT-5 to UNIT-11. The file and the physics never see them.
- **Identifiers.** Components, recovery devices and designs have string ids (`crypto.randomUUID()` in the app and the formats package; test fixtures use fixed ids). Ids are for editing and references (motor mount, recovery device parent); physics receives positional arrays.

## Step 1 contents

### Sources

| ID      | Content                                                               | Source                                                                                                            |
| ------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| UNIT-5  | 1 in = 0.0254 m exactly                                               | NIST SP 811 (2008) B.8 p. 50 (boldface = exact, B.2 p. 40); B.6 p. 42 (1959 definition of the international foot) |
| UNIT-6  | 1 ft = 0.3048 m exactly                                               | NIST SP 811 B.8 p. 49; B.6 p. 42                                                                                  |
| UNIT-7  | 1 lb (avoirdupois) = 0.45359237 kg exactly                            | NIST SP 811 B.8 p. 53, footnote 22                                                                                |
| UNIT-8  | 1 oz (avoirdupois) = 1/16 lb = 0.028349523125 kg exactly              | NIST SP 811 B.8 p. 52 (2.834 952 E−02, rounded) and footnote 22 (the pound); 16 oz = 1 lb                         |
| UNIT-9  | 1 lbf = 0.45359237 × 9.80665 N = 4.4482216152605 N exactly            | NIST SP 811 B.8 p. 53, footnote 23                                                                                |
| UNIT-10 | 1 mi/h = 0.44704 m/s exactly; 1 ft/s = 0.3048 m/s exactly             | NIST SP 811 B.8 p. 52 (mile per hour), p. 49 (foot per second); 1 mi = 1609.344 m (p. 52)                         |
| UNIT-11 | T/K = (t/°F + 459.67) × 5/9; a Fahrenheit interval is 5/9 of a kelvin | NIST SP 811 B.8 p. 48 (degree Fahrenheit, 5.555 556 E−01 °C per °F) together with UNIT-4 (0 °C = 273.15 K)        |

The ounce factor is exact by definition (16 oz = 1 lb, B.9 "MASS" lists both from the same pound); SP 811 prints it rounded to seven digits and the test checks the printed rounding. The Fahrenheit offset 459.67 follows from 32 °F = 0 °C = 273.15 K: 273.15 × 9/5 − 32 = 459.67.

### Files

| File                                        | Purpose                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/physics/src/units/convert.ts`     | UNIT-5 to UNIT-11 as boundary conversions into SI, plus the exact factors as a frozen constant for the UI's reverse conversions             |
| `packages/formats/src/design/model.ts`      | `RocketDesign` and its parts (components with ids and names, motor mount and motor selection, recovery devices, finish, launch, thresholds) |
| `packages/formats/src/design/validate.ts`   | structural validation of an unknown JSON value into a `RocketDesign`, with `DesignFileError` naming the path                                |
| `packages/formats/src/design/migrate.ts`    | the migration chain and `CURRENT_SCHEMA_VERSION`                                                                                            |
| `packages/formats/src/design/serialize.ts`  | `serializeDesign` (stable key order) and `parseDesign` (parse, migrate, validate)                                                           |
| `packages/formats/src/design/to-physics.ts` | `designComponents`, `designMotorMass`, `designStability`, `designVehicle`, `designSimulationOptions`, `designWarnings` (thresholds applied) |
| `packages/formats/src/design/example.ts`    | `newDesign()` (an empty design with defaults) and `exampleDesign()` (the R1 reference rocket with the Estes D12)                            |
| tests next to each file                     | round trip, validation messages, migration, R1 from a design file against the Phase 1 CG and CP and the Phase 2 apogee                      |

### Tests

- UNIT-5 to UNIT-11: exact values (0.0254, 0.3048, 0.45359237, 0.028349523125, 4.4482216152605, 0.44704) and the printed rounded values of SP 811 (4.535 924 E−01, 2.834 952 E−02, 4.448 222 E+00) within half a unit of the last printed digit; 32 °F = 273.15 K, 212 °F = 373.15 K; −40 °F = −40 °C.
- Serialization round trip of the example design is identical; a property test (fast-check) over random valid component lists round-trips with equal numbers.
- Validation: missing field, wrong type, unknown component kind, NaN or Infinity (JSON cannot carry them; a string in a number field), unknown top-level key, newer schema version, each with the path in the message.
- Adapter: the example design gives R1's CG 0.387022 m (liftoff) and 0.364906 m (burnout), CP 0.478890 m displayed and 0.487227 m OpenRocket-equivalent (Phase 1 report), and the Phase 2 displayed apogee 167.33 m at RK4 0.002 s; thresholds produce the stability and rail-exit warnings on constructed cases.
