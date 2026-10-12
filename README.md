# lo-fi-rocket

lo-fi-rocket designs and simulates model and high-power rockets. It shows stability, mass and dimensions live as you edit, and simulates the flight in six degrees of freedom. It runs with commercial motor files (.eng, .rse, ThrustCurve.org) or your own thrust curves. Accuracy comes first: every equation is cited to a source in `reference/`, and every result is checked against hand calculations, OpenRocket and measured wind-tunnel or flight data.

## Getting started

```sh
pnpm install
pnpm --filter @lo-fi-rocket/app dev    # the application in the browser
pnpm check                              # typecheck, lint, format check and every test
```

Node 22.12 or later and pnpm 10 are required.

The code lives in three packages:

- `packages/physics`: the simulation engine. It is pure TypeScript with SI branded units and no UI.
- `packages/formats`: file readers and writers (.eng, .rse, .ork, CSV, the app's own format).
- `packages/app`: the React application.

The documentation lives in `docs/`:

- `equations.md`: every equation, with its source, validity and tests.
- `decisions.md`: every modelling choice, with the reason.
- `known-limitations.md`: what each model does not capture.
- `reports/`: the validation reports.
- `future-work.md`: what v1.0 leaves out.

## What you can trust

The numbers below come from the tests and reports named beside them. They are the agreement found on the cases tested, not a guarantee for every design.

| Result                                                  | Agreement                                                                                                                                                                                             | Evidence                                                               |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Atmosphere (U.S. Standard Atmosphere 1976, −5 to 86 km) | the published tables to their printed precision                                                                                                                                                       | `docs/reports/phase-1-acceptance.md`                                   |
| Mass, CG and static CP of the five reference rockets    | CG within 0.0004 %, CP within 0.035 % of OpenRocket                                                                                                                                                   | `docs/reports/phase-1-acceptance.md`                                   |
| CP against measured data, Mach 0 to 0.8                 | 0.4 % of body length rms (worst 0.5 %)                                                                                                                                                                | `docs/reports/held-out-validation.md`                                  |
| CP against measured data, Mach 0.8 to 1.2               | 4.3 % of body length rms (worst 6.4 %)                                                                                                                                                                | same                                                                   |
| CP against measured data, Mach 1.2 to 2.0               | 3.8 % of body length rms (worst 5.1 %)                                                                                                                                                                | same                                                                   |
| Drag coefficient against measured data, subsonic        | 7.1 % rms                                                                                                                                                                                             | same                                                                   |
| Apogee, maximum velocity, rail-exit velocity            | in the OpenRocket-equivalent mode, apogee within 3 %, maximum velocity within 1 %, rail exit within 0.3 % of OpenRocket; in the displayed mode, apogee within 3.6 % and maximum velocity within 1.7 % | `simulate.openrocket.test.ts`, `docs/reports/large-angle.md`           |
| Integration                                             | step-size convergence shown; RK4 and Dormand–Prince agree; the RK4 step is checked against the stability limit of every mode at every step                                                            | `docs/reports/phase-2-acceptance.md`, `docs/reports/rk4-step-check.md` |
| Determinism                                             | the same inputs give bit-identical outputs; Monte Carlo seeds are saved                                                                                                                               | golden-file tests                                                      |

**Trust with care:**

- **Transonic and supersonic drag.** It is 21 % (transonic) and 16 % (supersonic) rms from measured data. Apogees of rockets that pass Mach 0.8 are correspondingly less certain. The app warns in those regimes.
- **Above Mach 2.** Nothing has been validated there; every result says so.
- **In-flight stability margin.** It uses the more conservative of two normal-force models at angle of attack. Real long, slender rockets have shown a larger forward CP shift than either model predicts (D-070).
- **Large angles of attack.** Tumbling and backward flight above 60° use DATCOM correlations with no test verification there. They are approximate and flagged.
- **Fin flutter.** The check uses NACA TN 4197, an empirical criterion with a shaded safe/unsafe band. A flutter-speed ratio near 1 is uncertain either way, and fibreglass has no sourced shear modulus.
- **Warning thresholds.** The stability, rail-exit, thrust-to-weight and deployment-speed limits are rules of thumb. They are editable, and they are not guarantees.

**Do not rely on these for v1.0:**

- multi-stage or clustered motors (not implemented);
- RASAero `.CDX1` files (not implemented);
- combustion modelling of liquid engines (only imported thrust and mass profiles).

## Licence and sources

OpenRocket (GPLv3) was used only as a black box to produce reference outputs; none of its source code was read or translated. The physics follows the documents listed in `CLAUDE.md` section 4 and `reference/`.
