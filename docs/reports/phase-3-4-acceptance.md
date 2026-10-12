# Phase 3 and 4 acceptance report (application, interoperability and reliability)

Date: 2026-10-12. Branch `claude/inspiring-tesla-xxp0hh`, commits 76928e1 to the one carrying this report (plans 0011 to 0015). Produced under autonomous mode (CLAUDE.md section 11) at the end of Prompt 3.

## Acceptance criteria

| Phase | Criterion (CLAUDE.md 10)                                                          | Result                                                                                                                                                         |
| ----- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3     | React UI, rocket builder, live view, motor picker, plots, warnings, save and load | all present (plans 0012 to 0015)                                                                                                                               |
| 3     | A new user can build and simulate a basic rocket without documentation            | scripted end to end in Playwright (`packages/app/e2e/new-user.spec.ts`): New, four components, a motor from the library, a parachute, Simulate, an apogee read |
| 4     | `.ork` import                                                                     | the plan 0005 reader through `orkToDesign`; R1 to R4 reproduce the Phase 1 and 2 figures from the files, R5 imports with its motor to pick                     |
| 4     | ThrustCurve.org integration with offline cache                                    | search, download (RASP preferred), one download per motor, cached use with the network off                                                                     |
| 4     | Autosave                                                                          | local storage after every change, restored on start, invalid saves kept aside and reported                                                                     |
| 4     | File migrations                                                                   | versioned `.lofi.json`, migration chain exercised by tests, newer files refused with both versions named                                                       |
| 4     | Flight data comparison                                                            | altimeter CSV overlay on the altitude plot with the apogee difference stated                                                                                   |
| 6.7.2 | Imported C_D versus Mach table used in place of computed drag, labelled           | `SimulationOptions.dragCurve`, results labelled, no extrapolation (D-047)                                                                                      |

## What the user sees

- **Builder** (plan 0012): component list and editors for every component kind of Phase 1, numeric fields in the chosen unit system that reject invalid entries with "Fin root chord must be greater than 0 mm" before the design changes, the side view with CG and CP markers, the stability banner with the margins at liftoff and burnout in colour and in words against editable thresholds labelled as rules of thumb, mass and size.
- **Motors** (plan 0013): the eight reference motors bundled, imports of `.eng`, `.rse` and custom CSV curves, ThrustCurve.org search and download with the cache, the thrust-curve plot, figures named by their definitions (total impulse by the trapezoid rule, burn time to the last point, their quotient), delay list from the RASP file, a mismatch warning when the motor is wider than the mount.
- **Flight** (plan 0014): launch site, rail and wind with the NAR 30° warning, simulation settings, the run in a Web Worker, the summary values of CLAUDE.md 6.5, the events, every warning of CLAUDE.md 9 with its one-sentence reason, four plots, CSV export with the modes in a comment line, and the modes used printed under the results.
- **Files** (plan 0015): Save, Open, Designs (switch and delete), Import `.ork`, the example, recorded flight overlay, imported drag curve.

## Figures reproduced through the application

| Figure                                     | Through the UI                                                    | Reference                                                        |
| ------------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| R1 CG at liftoff                           | 387.0 mm                                                          | 0.387022 m (Phase 1 report)                                      |
| R1 CP, displayed mode                      | 478.9 mm, 1.84 calibers                                           | 0.478890 m, 1.8374 (Phase 1 report)                              |
| R1 CP, imperial                            | 18.854 in                                                         | 0.478890 m / 0.0254                                              |
| R1 apogee, displayed modes, Dormand–Prince | 167.33 m, maximum velocity 62.3 m/s, rail exit 18.5 m/s           | 167.329 m, 62.26 m/s, 18.45 m/s (Phase 2 report, RK4 at 0.002 s) |
| R1 from the `.ork` file                    | the same stability figures; 168.87 m in the OpenRocket-equivalent | 168.866 m (Phase 2 report)                                       |
| R1 with a sampled drag curve               | apogee within 0.5 % of the computed flight                        | self-consistency (D-047)                                         |

The unit tests assert these figures (`App.test.tsx`, `FlightPanel.test.tsx`, `from-ork.test.ts`, `design.test.ts`) and the Playwright tests assert the flight figures in a real browser.

## Found and fixed while testing the application (physics changes, with their reasons)

- **D-046.** The first ballistic flight in the UI (no recovery device) exposed that the fin normal force law, linear in the angle of attack, was being applied at 180° where it gives a large force in an undefined direction; RK4 produced a tumble driven by it and the adaptive integrator crawled at its minimum step. A six-degree-of-freedom flight now ends at 90° angle of attack with `endReason: 'model-limit'`, an event and a warning that explain it; the ascent and apogee are kept; the adaptive integrator throws `SimulationStalledError` instead of continuing at 1 ns steps. No reference figure changed: every comparison flight deploys at apogee and never reaches the limit. **Open question:** a source for the fin force at large angles if backwards and tumbling flight must be simulated.

## Assumptions and decisions made without asking (CLAUDE.md section 11)

D-040 NIST SP 811 for the customary units; D-041 the native file format and its validation; D-042 default settings including the 20 m/s deployment speed placeholder; D-043 reducer store and local-storage autosave; D-044 CSV thrust-curve rules; D-045 injected services, hand-drawn plots, motor cache; D-046 the angle-of-attack limit; D-047 imported drag curves; D-048 `.ork` import, recorded flights and the files menu. Full text in `docs/decisions.md`.

## Not verified, or outside this prompt

- **`.CDX1` import** (CLAUDE.md 6.7 item 3) needs sample RASAero II files from the owner; not started.
- **RASAero's export layout** is not documented in `reference/`; the drag curve reader is format-agnostic by header names and the owner should confirm it reads a real export.
- **ThrustCurve.org** was exercised against fixtures shaped by `swagger.json`, not against the live service from this environment; the first live search will confirm the field names.
- **Impulse class letters** are not computed (no table in the approved sources); shown only as ThrustCurve reports them.
- **Browser coverage:** Playwright ran in the preinstalled Chromium; other browsers are untested. The layout is checked at 1366 × 768.
- **Accessibility** is by construction (native controls, labels, listbox keyboard navigation, text beside colour) and not audited with a screen reader.

## Checks

| Check                     | Result                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `pnpm typecheck`          | clean (3 packages)                                                                      |
| `pnpm lint`               | clean                                                                                   |
| `pnpm format:check`       | clean                                                                                   |
| `pnpm test`               | 45 files, 528 tests passed (physics 26 files 383, formats 9 files 106, app 10 files 39) |
| `pnpm --filter app build` | Vite build with the worker chunk                                                        |
| `pnpm --filter app e2e`   | 3 Playwright tests passed in Chromium (the preinstalled browser)                        |
| Golden outputs            | `golden/ussa1976.json` unchanged                                                        |

CI (`.github/workflows/ci.yml`) runs the same checks plus the build and the Playwright tests.

## Open item: pull request

Unchanged: the repository has a single branch, `claude/inspiring-tesla-xxp0hh`, which is also its default branch, so GitHub cannot open a pull request from it until a separate default branch exists.
