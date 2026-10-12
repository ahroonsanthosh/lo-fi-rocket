# In-flight stability (plan 0030)

**Date:** 2026-10-12. Written by `packages/formats/src/simulate.stability.test.ts` (`STABILITY_REPORT=<path>`). Every reference rocket in the displayed mode (roll reduction on, base drag while thrusting), standard gravity, a 2 m/s wind on a 1.5 m rail tilted 5°, Dormand–Prince (rtol 1e-8). The margin is (CP − CG)/d at every accepted step, with the CP at that step's Mach number and angle of attack and the CG at that moment; the lowest value of powered flight (rail exit to burnout) and of coast (burnout to apogee) is listed with where it occurred.

| rocket                  | lowest margin, powered flight           | lowest margin, coast to apogee            |
| ----------------------- | --------------------------------------- | ----------------------------------------- |
| r1-three-fin-conical    | 1.71 cal at 0.29 s (Mach 0.05, α 6.19°) | 1.87 cal at 5.80 s (Mach 0.02, α 12.87°)  |
| r2-ogive-boattail       | 1.17 cal at 0.12 s (Mach 0.08, α 4.30°) | 1.18 cal at 9.93 s (Mach 0.02, α 19.91°)  |
| r3-minimum-diameter-24  | 2.86 cal at 0.10 s (Mach 0.09, α 3.62°) | 1.85 cal at 10.04 s (Mach 0.02, α 20.45°) |
| r4-scratch-38mm         | 2.24 cal at 0.22 s (Mach 0.05, α 6.78°) | 2.59 cal at 11.15 s (Mach 0.03, α 6.48°)  |
| r5-transonic-min-dia-29 | 2.01 cal at 0.10 s (Mach 0.11, α 3.13°) | 1.10 cal at 13.70 s (Mach 0.03, α 19.48°) |

The powered minima occur just after rail exit, where the 2 m/s wind gives 3° to 7° angle of attack at low speed and the body lift moves the CP forward. The coast minima occur near apogee, where the angle of attack grows as the airspeed falls (13° to 20° at Mach 0.02 to 0.03); the dynamic pressure there is small, so a low margin near apogee matters less than the same margin early in the flight. No reference rocket falls below the 1.0 caliber default.
