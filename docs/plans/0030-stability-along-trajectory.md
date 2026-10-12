# Plan 0030: Stability along the trajectory (completion prompt Part C item 5)

**Status:** written and implemented 2026-10-12 under autonomous mode; D-067.

## Goal

Evaluate the CP and the stability margin at the actual Mach number and angle of attack along the flight, report the minimum margin over powered flight and over coast, and warn when it falls below the threshold.

## Method

- No new equation: the margin is BAR-9, (CP − CG)/d, with the CP from the flight's aerodynamic model at the step's Mach number and angle of attack (AERO-1, AERO-2, with BAR-12 to BAR-17 above Mach 0.8) and the CG of the vehicle at that moment (motor mass rule MOT-*). Samples already carried it; the minimum is now taken over every accepted integrator step, independent of the record interval.
- `FlightSummary.minimumStability.powered` and `.coast`: the margin, time, Mach number, angle of attack, CP and CG at the minimum of each phase (rail exit to burnout; burnout to apogee).
- `SimulationOptions.minimumStabilityMargin` (default `DEFAULT_MINIMUM_STABILITY_MARGIN` = 1.0 caliber, CLAUDE.md section 9's rule of thumb); the app passes the design's "unstable below" threshold. A minimum below it adds a warning naming the phase, time, Mach number and angle of attack.
- App: the flight figures show the lowest margin of each phase; the transonic and supersonic flight warnings were rewritten for the version 1.0 validation (and above Mach 2.0, "outside the validated range").

## Tests

`packages/formats/src/simulate.stability.test.ts`: for all five reference rockets the summary minimum equals the smallest step margin (every step recorded) and (CP − CG)/d at that point; the in-flight CP is within one caliber of the static CP at the same Mach number; the warning appears with a 50-caliber threshold and not with the default. Results: `docs/reports/in-flight-stability.md`.

## Files

`packages/physics/src/flight/simulate.ts`, `vehicle.ts`, `index.ts`; `packages/formats/src/design/to-physics.ts`, `simulate.stability.test.ts`; `packages/app/src/components/FlightPanel.tsx`; docs: D-067, limitations, report.
