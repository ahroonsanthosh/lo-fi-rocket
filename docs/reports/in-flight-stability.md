# In-flight stability and fin flutter (plans 0030, 0031)

**Date:** 2026-10-12. Written by `packages/formats/src/simulate.stability.test.ts` (`STABILITY_REPORT=<path>`). Every reference rocket in the displayed mode (roll reduction on, base drag while thrusting), standard gravity, a 2 m/s wind on a 1.5 m rail tilted 5°, Dormand–Prince (rtol 1e-8). The margin is (CP − CG)/d at every accepted step, with the CP at that step's Mach number and angle of attack and the CG at that moment; the lowest value of powered flight (rail exit to burnout) and of coast (burnout to apogee) is listed with where it occurred. The flutter margin is V_f/V over the same steps, V_f from NACA TN 4197 at the local pressure and speed of sound (FLUT-2).

| rocket                  | lowest margin, powered flight           | lowest margin, coast to apogee            |
| ----------------------- | --------------------------------------- | ----------------------------------------- |
| r1-three-fin-conical    | 1.71 cal at 0.29 s (Mach 0.05, α 6.19°) | 1.87 cal at 5.80 s (Mach 0.02, α 12.87°)  |
| r2-ogive-boattail       | 1.17 cal at 0.12 s (Mach 0.08, α 4.30°) | 1.18 cal at 9.93 s (Mach 0.02, α 19.91°)  |
| r3-minimum-diameter-24  | 2.86 cal at 0.10 s (Mach 0.09, α 3.62°) | 1.85 cal at 10.04 s (Mach 0.02, α 20.45°) |
| r4-scratch-38mm         | 2.24 cal at 0.22 s (Mach 0.05, α 6.78°) | 2.59 cal at 11.15 s (Mach 0.03, α 6.48°)  |
| r5-transonic-min-dia-29 | 2.01 cal at 0.10 s (Mach 0.11, α 3.13°) | 1.10 cal at 13.70 s (Mach 0.03, α 19.48°) |

| rocket                  | fin material                      | lowest flutter margin                                                  | shear modulus at which V_f = V |
| ----------------------- | --------------------------------- | ---------------------------------------------------------------------- | ------------------------------ |
| r1-three-fin-conical    | plywood (TN 4197 wood, 0.487 GPa) | V_f/V = 3.41 at 1.61 s (Mach 0.18, V_f 213 m/s)                        | 0.042 GPa                      |
| r2-ogive-boattail       | plywood (TN 4197 wood, 0.487 GPa) | V_f/V = 1.10 at 1.27 s (Mach 0.72, V_f 268 m/s)                        | 0.405 GPa                      |
| r3-minimum-diameter-24  | fibreglass                        | not evaluated: fibreglass has no shear modulus in the approved sources | 0.178 GPa                      |
| r4-scratch-38mm         | plywood (TN 4197 wood, 0.487 GPa) | V_f/V = 2.37 at 1.94 s (Mach 0.40, V_f 323 m/s)                        | 0.087 GPa                      |
| r5-transonic-min-dia-29 | fibreglass                        | not evaluated: fibreglass has no shear modulus in the approved sources | 0.422 GPa                      |

The powered minima occur just after rail exit, where the 2 m/s wind gives 3° to 7° angle of attack at low speed and the body lift moves the CP forward. The coast minima occur near apogee, where the angle of attack grows as the airspeed falls (13° to 20° at Mach 0.02 to 0.03); the dynamic pressure there is small, so a low margin near apogee matters less than the same margin early in the flight. No reference rocket falls below the 1.0 caliber default.

The plywood fins of R1, R2 and R4 are taken as TN 4197's wood at the lower end of its range (0.487 GPa); the last column is the shear modulus at which the TN 4197 flutter speed equals the flight speed at the worst point, so any fin material stiffer than that is flutter-free by this criterion. R2 (a G80 on 3 mm plywood) is within 10 % of its flutter speed at Mach 0.72; the criterion's boundary is a shaded band (TN 4197 figure 3), so R2 is marginal. The fibreglass fins of R3 and R5 are not evaluated: no approved source gives a shear modulus for fibreglass laminate; they need 0.18 and 0.42 GPa.
