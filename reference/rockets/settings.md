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
| Roll angle | worst case over roll angle (`getWorstCP`) | the design window uses this when no roll angle is selected |
| Aerodynamic calculator | `BarrowmanCalculator` | OpenRocket's only calculator |
| Reference length | maximum body diameter (`ReferenceType.MAXIMUM`, OpenRocket default) | `ref_diameter_m` column |
| Stability margin | (CP − CG) / reference length, calibers | |
| Fin cross-section | square | OpenRocket default |
| Surface finish | "regular paint", 60 µm | set explicitly on every external component |

## Flight simulation (`apogee_m`, `max_velocity_ms`, `rail_exit_velocity_ms`, ...)

| Setting | Value | Note |
| --- | --- | --- |
| Integrator | OpenRocket `RK4SimulationStepper` (4th-order Runge-Kutta with OpenRocket's own step control) | only stepper in 24.12 |
| Time step | 0.01 s | GUI default is 0.05 s; see sensitivity below. OpenRocket may use smaller internal steps on the rail and around events, as seen in the time series |
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

## Time-step sensitivity (zero wind; 0.01 s is what `values.csv` records)

| Rocket | Apogee 0.01 s | Apogee 0.05 s | Max v 0.01 s | Max v 0.05 s | Rail exit 0.01 s | Rail exit 0.05 s |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | 167.045 | 167.041 | 61.967 | 61.968 | 18.594 | 18.999 |
| R2 | 820.807 | 820.825 | 245.821 | 245.823 | 26.964 | 27.212 |
| R3 | 832.932 | 832.956 | 233.975 | 233.969 | 32.239 | 33.165 |
| R4 | 692.685 | 692.682 | 136.121 | 136.117 | 17.007 | 17.568 |
| R5 | 1560.533 | 1560.563 | 369.487 | 369.490 | 36.592 | 37.617 |

Apogee and maximum velocity change by less than 0.01 % between the two steps. Rail-exit velocity changes by 1 % to 3 % because OpenRocket reports the velocity at the first integration step after the rail is cleared, so it depends on the step size. Both runs used the final geometry.

## What Phase 2 must reproduce or account for

- Gravity 9.8061992025 m/s² at the pad, decreasing as (R/(R + h))² with R = 6 371 000 m.
- Flat Earth, no Coriolis.
- ISA atmosphere from sea level.
- Motor CG fixed at mid-length; mass tracks burnt impulse.
- Rail-exit velocity sampled at the first step after rail departure (compare with the 0.01 s row, and expect step-size sensitivity).
- The design-window CP at Mach 0.3 uses the unreduced three-fin normal force (see `hand-checks.md`).
