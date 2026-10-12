# Plan 0013: Motors in the application and the ThrustCurve.org client (Prompt 3 step 3)

**Status:** written 2026-10-12 under autonomous mode; Prompt 3 step 3 of plan 0011.
**Phase:** 3 (motor picker, CLAUDE.md 10) and 4 (ThrustCurve.org integration with offline cache, CLAUDE.md 6.6 and 10).

## Goal

Let the user choose the motor for the mount from a library (the bundled reference motors, motors imported from `.eng` or `.rse` files, custom thrust curves from CSV, and motors downloaded from ThrustCurve.org, cached so that the app keeps working offline), set the ejection delay, and see the thrust curve with its figures. No new physics: thrust, impulse and mass come from MOT-1 to MOT-5.

## Sources

- ThrustCurve.org API 1.0.3: `reference/docs/thrustcurve-api/swagger.json` (request and response fields of `metadata.json`, `search.json`, `download.json`; diameters and lengths in millimetres, `data` Base64) and `api.html` (the download endpoint returns the uploaded simulator file; `data=file`).
- Motor figures: `reference/docs/thrustcurve-api/glossary.html` and `motorstats.html` define ThrustCurve's average thrust as the total impulse over a burn time normalised by the NFPA 1125 5 % rule. The app's own figures are total impulse (MOT-2, the trapezoidal integral), burn time to the last data point (MOT-1) and the average thrust as their quotient, and say so; ThrustCurve's figures are shown as the site reports them in search results. The impulse class letter is shown only when ThrustCurve provides it: the approved pages give the rule ("each letter twice the previous", G80 at 120 N·s is a G) but no table, so the app does not compute it (recorded in `docs/known-limitations.md`).
- RASP and RockSim files: plans 0004 and 0007.
- CSV thrust curves: no published specification; the rules are the project's own (D-044).

## Conventions

- `packages/formats/src/thrustcurve/client.ts`: `fetchMetadata`, `searchMotors`, `downloadMotor` over an injected transport (the browser's `fetch` in the app, fixtures in tests). Every response field used is checked; a missing or mistyped field is a `ThrustCurveError` naming it. Downloads prefer the RASP file and, among several, the certification-sourced one; RockSim is the fallback.
- `packages/formats/src/thrustcurve/cache.ts`: a key-value store interface; entries keyed by provenance (`thrustcurve:<motorId>`, `file:<name>`, `bundled:<name>`); `getThrustCurveMotor` serves the cache first and downloads once. Corrupt entries are reported, not deleted.
- `packages/formats/src/motors/csv-thrust-curve.ts`: `parseThrustCurveCsv(text, metadata)` with the D-044 rules.
- App: `src/motors/library.ts` assembles the library (bundled `.eng` files imported as raw text at build time, cached and imported motors from local storage); the motor appears as an entry in the left column; selecting it opens `MotorPanel` in the editor column with the mount choice, the delay, the figures, the curve (`LinePlot`, reused for the flight plots in step 4) and the picker tabs: library (filtered to the mount diameter by default), ThrustCurve.org search, file import, CSV import.
- Delay: RASP files list the available delays; the user picks one or "plugged"; a motor without a delay list takes a free entry.
- Motor mount: the user picks which inner tube or body tube is the mount and the overhang; a motor wider than the tube's inside is a visible warning, not an error (the tube may be under design).

## Files

| File                                                                            | Purpose                                           |
| ------------------------------------------------------------------------------- | ------------------------------------------------- |
| `packages/formats/src/thrustcurve/client.ts`, `cache.ts`                        | API client and offline cache                      |
| `packages/formats/src/motors/csv-thrust-curve.ts`                               | custom thrust curves                              |
| `packages/app/src/motors/bundled/*.eng`, `library.ts`                           | bundled motors and the library                    |
| `packages/app/src/components/MotorPanel.tsx`, `MotorPicker.tsx`, `LinePlot.tsx` | UI                                                |
| tests next to each file                                                         | client fixtures, cache offline, CSV rules, picker |

## Tests

- Client: search posts the criteria and converts mm to m; download decodes the Base64 fixture of `Estes_D12.eng` and parses it identically to the `.eng` reader; fallback to RockSim; every failure mode names the cause.
- Cache: one download then offline reads; corrupt entries reported.
- CSV: a hand-integrated curve (20 N·s), the three-column mass profile, and every rule's rejection.
- App: the library lists the eight bundled motors; choosing the D12 at delay 5 reproduces the example's figures; a mismatched diameter shows the warning; the search tab uses an injected transport and adds a motor to the library; the CSV import creates a custom motor.
