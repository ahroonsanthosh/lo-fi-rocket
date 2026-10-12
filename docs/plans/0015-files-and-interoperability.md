# Plan 0015: Files and interoperability (Prompt 3 step 5)

**Status:** written 2026-10-12 under autonomous mode; Prompt 3 step 5 of plan 0011, the last step of Phases 3 and 4.
**Phase:** 4 (CLAUDE.md 10: `.ork` import, autosave, file migrations, flight data comparison) and 6.7 item 2 (imported drag curve), plus the Phase 3 acceptance (a new user builds and simulates a basic rocket without documentation, scripted end to end).

## Goal

Save and load `.lofi.json` designs (plan 0011), switch between the designs kept in local storage, import OpenRocket `.ork` files through the plan 0005 reader with clear messages for what it does not support, overlay recorded altimeter data on the simulated altitude (CLAUDE.md 7.5), use an imported C_D versus Mach table in place of the computed drag with the result labelled (CLAUDE.md 6.7 item 2), and prove the whole flow with Playwright end-to-end tests. Then the Phase 3 and 4 acceptance report.

## Sources

- `.ork`: plan 0005 and D-026 (the reader covers the reference rockets' component types and rejects everything else by name).
- Drag curve import: CLAUDE.md 6.7 item 2 ("import a CD versus Mach table from a RASAero II aero plots CSV export, or any CSV, and use it in place of computed drag"). RASAero's export layout is not documented in `reference/`; the importer therefore reads any CSV whose header names a Mach column and a CD column (case-insensitive, "mach" and "cd" or "cd_power_off"/"cd power off"), or the first two numeric columns, with the rules of D-047. The imported C_D is the zero-angle-of-attack coefficient referred to the rocket's reference area and replaces C_D0 (DRAG-13); the angle-of-attack scaling (DRAG-14) still applies. Results carry the mode "imported drag curve".
- Altimeter data: a CSV with a time column and an altitude column (header names containing "time" and "alt", or the first two numeric columns), units metres or feet chosen by the user (UNIT-6). The overlay is a second series on the altitude plot with the difference at apogee reported; nothing is fitted.

## Conventions

- **Drag override in the physics.** `SimulationOptions.dragCurve?: { points: {mach, cd}[]; label }`: `simulateFlight` interpolates linearly in Mach (a Mach outside the table range is an `InvalidInputError`, never clamped) and uses the value as C_D0; the computed drag model is not called. `FlightResult.modes.dragCurve` names the curve. The sample's `cd0` is the imported value.
- **Design files carry the drag curve and the recorded flight** so that a saved design reproduces its comparison (schema version stays 1: both are new optional top-level fields, absent in older files, which the validator accepts; a field added optionally does not need a migration).
- **`.ork` import** produces a design through `orkToDesign`: components with generated ids and the file's names, the motor mount (the tube's index becomes its id, the overhang from the reader's aft end) and, when the file's motor designation and manufacturer match a library motor, that motor with the file's delay; otherwise the mount is left without a motor and the import notice says which motor to pick. Recovery devices and their deployment settings are copied; the reference diameter is the file's maximum body diameter. Any `OrkUnsupportedError` or `OrkParseError` is shown verbatim.
- **Files in the app.** "Save" downloads the `.lofi.json`; "Open" reads one through a file input and replaces the design after validation (with the error shown on failure); "Designs" lists the local-storage designs by name and lets the user switch or delete; "Import .ork" as above. The example design is reloadable.
- **End to end.** Playwright runs the built app in the preinstalled Chromium: a new user starts from "New", adds a nose cone, a body tube, fins and a motor mount tube, picks the D12, simulates, and reads an apogee; the example simulates to the Phase 2 figure; the units toggle, autosave across reload, and the `.ork` import of R1 are covered.

## Files

| File                                                                   | Purpose                                               |
| ---------------------------------------------------------------------- | ----------------------------------------------------- |
| `packages/physics/src/flight/simulate.ts`                              | the drag curve option and mode                        |
| `packages/formats/src/design/model.ts`, `validate.ts`, `to-physics.ts` | optional `dragCurve` and `recordedFlight` fields      |
| `packages/formats/src/motors/drag-curve.ts`, `flight-data.ts`          | CSV readers for the drag table and the altimeter file |
| `packages/formats/src/design/from-ork.ts`                              | `orkToDesign`                                         |
| `packages/app/src/components/FilesMenu.tsx`, `ComparisonPanel.tsx`     | files UI, drag curve and altimeter import             |
| `packages/app/e2e/*.spec.ts`, `playwright.config.ts`                   | end-to-end tests                                      |
| `docs/reports/phase-3-4-acceptance.md`                                 | the report                                            |

## Tests

- Drag curve: a two-point table gives the interpolated C_D0 at a hand Mach; a Mach outside the table throws; R1 with its own computed C_D0 sampled into a table reproduces the apogee within 0.5 % (a self-consistency check, not a validation).
- Altimeter CSV: header detection, feet conversion, rejection of a non-monotonic time column.
- `orkToDesign`: R1 to R4 from the `.ork` files give the same CG, CP and apogee as the formats acceptance tests; R5 imports with its motor unmatched and a notice.
- App: save produces the serialized design; open restores it; the designs list switches; `.ork` import of R1 shows its name and figures; the altimeter overlay adds a series and reports the apogee difference; a drag curve run is labelled.
- Playwright: the new-user flow, the example flight figure, autosave across reload.
