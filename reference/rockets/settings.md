# OpenRocket settings used for the reference values

OpenRocket 24.12 (`reference/SOURCES.md`), driven headlessly by `tools/openrocket-harness/src/ReferenceHarness.java`. Every setting below is set explicitly by the harness unless marked "OpenRocket default (not settable here)", in which case the default was read from the OpenRocket 24.12 source and recorded. Values are SI.

## Stability figures (`cg_m`, `cp_m`, `stability_cal`, `mach` in `values.csv`)

| Setting | Value | Note |
| --- | --- | --- |
| Mass state for CG | launch: motor loaded with full propellant (`MassCalculator.calculateLaunch`) | the design window's CG |
| Burnout CG (`cg_burnout_m`) | motor casing without propellant (`MassCalculator.calculateBurnout`) | |
| Mach number for CP | 0.3 | OpenRocket design-window default |
| Angle of attack | 0 rad | |
| Roll rate | 0 rad/s | |
| Roll angle | worst case over roll angle (`getWorstCP`) | the design window uses this when no roll angle is selected. Probe: `getCP` at roll angles 0°, 15°, 30°, 45°, 60°, 90° and 120° returns the identical CP for every reference rocket (three- and four-fin), equal to the worst case, so OpenRocket 24.12 applies no roll-angle dependence to the fin normal force (observed, not read from source; the harness prints the probe) |
| Aerodynamic calculator | `BarrowmanCalculator` | OpenRocket's only calculator |
| Reference length | maximum body diameter (`ReferenceType.MAXIMUM`, OpenRocket default) | `ref_diameter_m` column |
| Stability margin | (CP − CG) / reference length, calibers | |
| Fin cross-section | square | OpenRocket default |
| Surface finish | "regular paint", 60 µm | set explicitly on every external component |

## Flight simulation (`apogee_m`, `max_velocity_ms`, `rail_exit_velocity_ms`, ...)

| Setting | Value | Note |
| --- | --- | --- |
| Integrator | OpenRocket `RK4SimulationStepper` (4th-order Runge-Kutta with OpenRocket's own step control) | only stepper in 24.12 |
| Time step | 0.001 s (OpenRocket's minimum, `AbstractSimulationStepper.MIN_TIME_STEP`) | GUI default is 0.05 s; see sensitivity below. Smaller values are clamped by OpenRocket |
| Maximum step angle | 3° (`RK4SimulationStepper.RECOMMENDED_ANGLE_STEP`, default) | OpenRocket shortens a step when the rocket would rotate more than this |
| Maximum simulation time | 600 s | |
| Random seed | 1 | irrelevant with turbulence 0, pinned anyway |
| Launch rail length | 1.5 m | `launch_rail_m` |
| Launch rail angle | 0 rad (vertical) | |
| Launch rail direction | π/2 rad | OpenRocket default; has no effect with a vertical rail |
| Launch into wind | off | |
| Site altitude | 0 m | `site_altitude_m` |
| Site latitude, longitude | 45.0°, 0.0° | |
| Atmosphere | OpenRocket `ExtendedISAModel`, ISA on, launch temperature and pressure taken from the ISA at 0 m (288.15 K, 101 325 Pa) | |
| Gravity model | OpenRocket `WGSGravityModel`: g = 9.7803267714 × (1 + 0.00193185138639 sin²φ) / √(1 − 0.00669437999013 sin²φ) × (R/(R + h))², R = 6 371 000 m, φ = latitude, h = altitude | at 45°, 0 m: **9.8061992025 m/s²** (printed by the harness). Not settable; OpenRocket default. Phase 2 must account for this when comparing |
| Geodetic computation | FLAT | OpenRocket's flat-Earth mode: no Coriolis acceleration, no Earth curvature. Earth rotation effects are therefore off |
| Wind model | "average" (`PinkNoiseWindModel`) with average 0 or 5 m/s (`wind_ms`), turbulence intensity 0, direction π/2 rad | with turbulence 0 the wind is constant. OpenRocket's wind velocity vector is (v sin θ, v cos θ, 0) in its x (east), y (north) frame for direction θ, so π/2 gives a wind along +x |
| Wind standard deviation | 0 (follows from turbulence 0) | |
| Motor ignition | at launch (OpenRocket default `AUTOMATIC`) | |
| Motor ejection delay | R1 5 s, R2 7 s, R3 6 s, R4 10 s, R5 6 s | fires the ejection-charge event only; parachutes deploy at apogee |
| Recovery deployment | at apogee, delay 0, for every parachute | OpenRocket default would be at the ejection charge |
| Parachute drag coefficient | 0.8, manual | |
| Motor position | aft end flush with the mount's aft end (overhang 0) | |
| Motor mass and CG during burn | from the RASP file: total mass and propellant mass in the header, mass decreasing in proportion to burnt impulse, CG fixed at the motor's mid-length | OpenRocket's RASP loader behaviour (documented in its source comment); recorded here for Phase 2 |

## Determinism

Each simulation is run twice in the same process; apogee, maximum velocity, rail-exit velocity, time to apogee and flight time are compared for exact equality and the harness aborts on any difference. All ten runs were identical on 2026-10-11.

## Time-step sensitivity (zero wind; 0.001 s is what `values.csv` records)

| Rocket | Apogee 0.05 | 0.01 | 0.002 | 0.001 | Max v 0.05 | 0.01 | 0.002 | 0.001 | Rail exit 0.05 | 0.01 | 0.002 | 0.001 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | 167.041 | 167.045 | 167.045 | 167.045 | 61.968 | 61.967 | 61.972 | 61.972 | 18.999 | 18.594 | 18.484 | 18.456 |
| R2 | 820.825 | 820.807 | 820.806 | 820.806 | 245.823 | 245.821 | 245.820 | 245.821 | 27.212 | 26.964 | 26.611 | 26.611 |
| R3 | 832.956 | 832.932 | 832.929 | 832.929 | 233.969 | 233.975 | 233.975 | 233.975 | 33.165 | 32.239 | 31.639 | 31.639 |
| R4 | 692.682 | 692.685 | 692.685 | 692.685 | 136.117 | 136.121 | 136.122 | 136.122 | 17.568 | 17.007 | 16.825 | 16.825 |
| R5 | 1560.563 | 1560.533 | 1560.531 | 1560.531 | 369.490 | 369.487 | 369.486 | 369.487 | 37.617 | 36.592 | 36.685 | 36.684 |

Apogee and maximum velocity are converged to better than 0.01 % at 0.001 s. Rail-exit velocity converges to within 0.15 % (R1) and 0.01 % or better (R2 to R5) between 0.002 s and 0.001 s; OpenRocket detects rail departure at the first integration step whose position exceeds the rail length and reports the velocity there, so the residual is one step of acceleration. OpenRocket refuses steps below 0.001 s. The time series files are decimated to 0.01 s intervals for storage; the simulation itself ran at 0.001 s.

## What Phase 2 must reproduce or account for

- Gravity 9.8061992025 m/s² at the pad, decreasing as (R/(R + h))² with R = 6 371 000 m.
- Flat Earth, no Coriolis.
- ISA atmosphere from sea level.
- Motor CG fixed at mid-length; mass tracks burnt impulse.
- Rail-exit velocity sampled at the first step after rail departure at 0.001 s; the app must instead locate rail exit, burnout, apogee and deployment at the exact crossing by root finding (Prompt 1, Part B2, item 3).
- The design-window CP at Mach 0.3 uses the unreduced three-fin normal force (see `hand-checks.md`).
