# Plan 0014: Simulation UI (Prompt 3 step 4)

**Status:** written 2026-10-12 under autonomous mode; Prompt 3 step 4 of plan 0011.
**Phase:** 3 (CLAUDE.md 9 and 10: plots, warnings, a basic rocket simulated without documentation).

## Goal

From the builder, set the launch conditions and the simulation settings, run the Phase 2 simulator without freezing the page, and read the results: the summary values of CLAUDE.md 6.5, the events, the warnings of CLAUDE.md 9 with their one-sentence reasons, time-series plots, and a CSV export of the time series. No new physics.

## Conventions

- **Runner.** The simulation runs in a Web Worker (`src/simulation/worker.ts`) fed with the design and the mode; the worker calls `designVehicle`, `designSimulationOptions` and `simulateFlight` and posts the result or the error's message. The page keeps a single in-flight run; a new request cancels the pending one's display. Tests inject a synchronous runner through the services context (jsdom has no Worker), so the same panel code runs in both.
- **Errors are results.** A `NotImplementedError` (for example a Haack nose past Mach 0.8, D-034) or an `InvalidInputError` is shown in the results area with its message; nothing is clamped to make a run succeed.
- **Launch editor.** Pad altitude, optional temperature and pressure overrides (both or neither, ATM-11), rail length, angle from vertical and azimuth, wind speed and the direction it blows from. The NAR 30° warning from `validateLaunch` shows live.
- **Simulation settings.** Integrator (RK4 with a time step, or Dormand–Prince with tolerances and step bounds), maximum time, recording interval, with the defaults of D-042 and a note on what each changes.
- **Results.** Apogee, time to apogee, maximum velocity, Mach and acceleration, rail-exit velocity and time, burnout, deployment velocity and time, descent rate, ground-hit velocity, landing distance and bearing, flight time, end reason; the event list with times; the modes used (integrator, roll reduction, base-drag rule, gravity); warnings from `designFlightWarnings` and the launch validation, each with its reason.
- **Plots.** Altitude, velocity and acceleration against time (`LinePlot`), with burnout, apogee and deployment marked; Mach and angle of attack in a second row. Units follow the toggle.
- **CSV export.** One row per sample with time, phase, position, velocity, altitude, speed, airspeed, Mach, angle of attack, acceleration, thrust, mass, CG, CP, stability; SI units named in the header; a comment line with the modes. The browser download is a service so tests can capture the text.

## Files

| File                                                 | Purpose                                            |
| ---------------------------------------------------- | -------------------------------------------------- |
| `packages/app/src/simulation/worker.ts`, `runner.ts` | the worker and the runner interface                |
| `packages/app/src/simulation/csv-export.ts`          | time series to CSV                                 |
| `packages/app/src/components/LaunchEditor.tsx`       | launch conditions and simulation settings          |
| `packages/app/src/components/FlightPanel.tsx`        | run button, results, warnings, events, export      |
| `packages/app/src/components/FlightPlots.tsx`        | the plots                                          |
| tests next to each file                              | CSV content, panel flows with a synchronous runner |

## Tests

- `csv-export.test.ts`: header, one row per sample, the comment line names the modes.
- `FlightPanel.test.tsx` (synchronous runner): simulating the example shows the Phase 2 displayed figures (apogee 167.3 m, maximum velocity 62.3 m/s, rail exit 18.5 m/s) and the events in order; a 5 m/s wind gives a landing distance; a rail of 0 m is rejected at the field; a 45° rail shows the NAR warning; the example with no recovery device shows the "no recovery" warning; a transonic design shows the model's error message; the export produces the CSV.
