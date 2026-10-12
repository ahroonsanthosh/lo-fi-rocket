# RK4 step check and extended step-size convergence (plan 0026, D-063)

**Date:** 2026-10-12. Written by `packages/formats/src/simulate.step-check.test.ts` (`STEP_CHECK_REPORT=<path>`).

## Why the Phase 2 check missed the R2 instability

The Phase 2 convergence check (`simulate.r1.test.ts`) flew only R1, in still air, and compared apogees across steps of 0.01, 0.005 and 0.001 s. R1's stiffest mode (roll damping, 110 s⁻¹) is inside the RK4 stability limit at every one of those steps, and in still air the roll and pitch modes of any rocket are never excited, so a latent instability leaves the apogee untouched until round-off grows. The check had neither a stiff rocket nor an excited mode.

## Cause

The roll damping moment C_r ω_x (AERO-5, Niskanen eq. 3.69) on a small roll inertia decays at λ = C_r/I_rot, 330 s⁻¹ on R2 at maximum dynamic pressure. The thesis's RK4 equations (4.20) to (4.21) applied to y′ = λy give the per-step factor R(hλ) = 1 + z + z²/2 + z³/6 + z⁴/24 (DYN-16), which exceeds 1 for hλ < −2.7853: at 0.01 s R(−3.3) = 2.1, the doubling per step seen in the viewer session; at 0.005 s R(−1.65) = 0.42. The pitch natural frequency (88 rad/s on R2) is not the limit there; it limits R5 (125 rad/s) at 0.02 s through the numerical damping of the oscillation.

## Safeguard

Every RK4 step is checked against the linearised roll, pitch and drag rates (DYN-17); a step outside the stability region (with a 0.9 margin) or one that would damp the pitch oscillation by more than 10 % per step stops the run with `IntegrationUnstableError`, which names the mode, the rate and the safe step; above 1 % per step a warning is attached. A sample is recorded at liftoff so every event has one.

## Results: every reference rocket, both settings, every step

Cells give apogee / maximum velocity; "stopped" rows show the check acting. Agreement with Dormand–Prince (1e-8) is within 0.1 % (observed within 0.01 m and 0.03 m/s) wherever a run completes.

## openrocket-still-air

| rocket                  | Dormand–Prince 1e-8    | RK4 0.02 s                              | RK4 0.01 s                              | RK4 0.005 s            | RK4 0.002 s            | RK4 0.001 s            | smallest safe step (mode, time) |
| ----------------------- | ---------------------- | --------------------------------------- | --------------------------------------- | ---------------------- | ---------------------- | ---------------------- | ------------------------------- |
| r1-three-fin-conical    | 168.87 m / 62.26 m/s   | 168.80 m / 62.23 m/s                    | 168.86 m / 62.25 m/s                    | 168.87 m / 62.26 m/s   | 168.87 m / 62.26 m/s   | 168.87 m / 62.26 m/s   | 0.0252 s (roll, 1.61 s)         |
| r2-ogive-boattail       | 804.79 m / 244.60 m/s  | stopped: roll dynamics, safe ≤ 0.019 s  | stopped: roll dynamics, safe ≤ 0.0099 s | 804.81 m / 244.60 m/s  | 804.80 m / 244.60 m/s  | 804.79 m / 244.60 m/s  | 0.00752 s (roll, 1.27 s)        |
| r3-minimum-diameter-24  | 812.79 m / 233.15 m/s  | stopped: roll dynamics, safe ≤ 0.020 s  | 812.84 m / 233.20 m/s                   | 812.79 m / 233.19 m/s  | 812.79 m / 233.19 m/s  | 812.78 m / 233.19 m/s  | 0.0136 s (roll, 1.12 s)         |
| r4-scratch-38mm         | 691.99 m / 136.12 m/s  | 691.98 m / 136.11 m/s                   | 691.98 m / 136.11 m/s                   | 691.99 m / 136.12 m/s  | 691.99 m / 136.12 m/s  | 691.98 m / 136.12 m/s  | 0.0327 s (roll, 1.94 s)         |
| r5-transonic-min-dia-29 | 1599.28 m / 372.41 m/s | stopped: pitch accuracy, safe ≤ 0.015 s | 1599.28 m / 372.46 m/s (warning)        | 1599.26 m / 372.46 m/s | 1599.29 m / 372.46 m/s | 1599.28 m / 372.46 m/s | 0.0211 s (roll, 0.58 s)         |

## displayed-wind-2-rail-5

| rocket                  | Dormand–Prince 1e-8    | RK4 0.02 s                              | RK4 0.01 s                              | RK4 0.005 s            | RK4 0.002 s            | RK4 0.001 s            | smallest safe step (mode, time) |
| ----------------------- | ---------------------- | --------------------------------------- | --------------------------------------- | ---------------------- | ---------------------- | ---------------------- | ------------------------------- |
| r1-three-fin-conical    | 164.57 m / 62.16 m/s   | 164.50 m / 62.13 m/s                    | 164.56 m / 62.15 m/s                    | 164.57 m / 62.16 m/s   | 164.57 m / 62.16 m/s   | 164.57 m / 62.16 m/s   | 0.0252 s (roll, 1.61 s)         |
| r2-ogive-boattail       | 777.05 m / 244.55 m/s  | stopped: roll dynamics, safe ≤ 0.019 s  | stopped: roll dynamics, safe ≤ 0.0099 s | 777.07 m / 244.55 m/s  | 777.05 m / 244.55 m/s  | 777.05 m / 244.55 m/s  | 0.00751 s (roll, 1.27 s)        |
| r3-minimum-diameter-24  | 762.54 m / 233.15 m/s  | stopped: roll dynamics, safe ≤ 0.020 s  | 762.56 m / 233.16 m/s                   | 762.54 m / 233.15 m/s  | 762.54 m / 233.15 m/s  | 762.53 m / 233.15 m/s  | 0.0136 s (roll, 1.12 s)         |
| r4-scratch-38mm         | 672.02 m / 136.09 m/s  | 672.01 m / 136.08 m/s                   | 672.01 m / 136.08 m/s                   | 672.02 m / 136.09 m/s  | 672.02 m / 136.09 m/s  | 672.02 m / 136.09 m/s  | 0.0327 s (roll, 1.94 s)         |
| r5-transonic-min-dia-29 | 1443.13 m / 372.44 m/s | stopped: pitch accuracy, safe ≤ 0.015 s | 1443.13 m / 372.44 m/s                  | 1443.11 m / 372.44 m/s | 1443.12 m / 372.44 m/s | 1443.12 m / 372.44 m/s | 0.0211 s (roll, 0.58 s)         |
