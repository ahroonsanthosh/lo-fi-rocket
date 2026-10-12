# Large angles of attack and ballistic descents (Part C items 8 and 9; plan 0033, D-070)

**Date:** 2026-10-12. The large-angle model is DATCOM-based (HA-1 to HA-10). Its tables come from `reference/digitised/build-datcom-large-angle.py`, with two passes per chart.

## The method against the DATCOM's own sample problems

| sample              | quantity                                             | printed                                                             | ours                                                                        |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| p. 4.1.3.3-16       | J                                                    | 6.36                                                                | 6.365                                                                       |
| pp. 4.1.3.3-17, -18 | C′_N at 5, 10, 13.3, 16, 18, 20, 22, 30, 50, 70, 90° | 0.415, 0.823, 1.002, 0.99, 0.90, 0.87, 0.85, 0.94, 1.35, 1.54, 1.30 | 0.415, 0.824, 1.002, 0.984, 0.897, 0.860, 0.856, 0.977, 1.334, 1.576, 1.300 |
| p. 4.1.3.4-9        | C₁, C₂ at λ = 0.3                                    | 0.5, 0.91                                                           | 0.490, 0.902                                                                |
| p. 4.1.3.4-9        | C_Lmax, α_CLmax                                      | 1.04, 34.3°                                                         | within 0.03 and 0.5° (test)                                                 |

The largest differences, at 30° and 70°, come from the D chart, which the sample reads to two figures (−1.32 and −0.30 against our −1.28 and −0.29).

## Centre of pressure at angle of attack: Blue Scout (NASA TN D-1958 figure 7, Mach 0.6)

| α   | measured x_cp/l (read from figure 7, fins on) | small-angle model | DATCOM model (fins as square-edged, comparison only) |
| --- | --------------------------------------------- | ----------------- | ---------------------------------------------------- |
| 0°  | about 0.75                                    | 0.795             | 0.795                                                |
| 2°  | about 0.73                                    | 0.770             | 0.774                                                |
| 4°  | about 0.68                                    | 0.750             | 0.756                                                |
| 6°  | about 0.62                                    | 0.733             | 0.741                                                |

Both models under-predict how far the CP moves forward with angle of attack on this long, slender body. The DATCOM model moves it slightly less than the small-angle model. The in-flight stability margin therefore uses the more forward of the two CPs (D-070). The measured values are approximate readings of the figure, not a digitised dataset.

## Reference rockets, displayed mode, against OpenRocket

The table is written by `simulate.openrocket.test.ts` (`REFERENCE_REPORT=<path>`). All rows are within the Phase 2 tolerances (apogee 5 %, maximum velocity 3 %).

| rocket                  | wind | OpenRocket apogee | displayed apogee | difference | with the small-angle model | OpenRocket max velocity | displayed | difference |
| ----------------------- | ---- | ----------------- | ---------------- | ---------- | -------------------------- | ----------------------- | --------- | ---------- |
| r1-three-fin-conical    | 0    | 167.0 m           | 172.9 m          | 3.53 %     | 172.9 m (3.53 %)           | 62.0 m/s                | 63.0 m/s  | 1.69 %     |
| r1-three-fin-conical    | 5    | 160.3 m           | 164.3 m          | 2.50 %     | 165.0 m (2.94 %)           | 61.2 m/s                | 62.1 m/s  | 1.51 %     |
| r2-ogive-boattail       | 0    | 820.8 m           | 814.4 m          | -0.78 %    | 814.4 m (-0.78 %)          | 245.8 m/s               | 246.4 m/s | 0.24 %     |
| r2-ogive-boattail       | 5    | 813.6 m           | 805.6 m          | -0.99 %    | 807.6 m (-0.74 %)          | 245.4 m/s               | 245.9 m/s | 0.21 %     |
| r3-minimum-diameter-24  | 0    | 832.9 m           | 803.9 m          | -3.48 %    | 803.9 m (-3.48 %)          | 234.0 m/s               | 233.8 m/s | -0.08 %    |
| r3-minimum-diameter-24  | 5    | 826.8 m           | 797.2 m          | -3.58 %    | 798.2 m (-3.45 %)          | 233.6 m/s               | 233.3 m/s | -0.10 %    |
| r4-scratch-38mm         | 0    | 692.7 m           | 710.6 m          | 2.59 %     | 710.6 m (2.59 %)           | 136.1 m/s               | 137.5 m/s | 0.98 %     |
| r4-scratch-38mm         | 5    | 674.3 m           | 685.6 m          | 1.67 %     | 690.7 m (2.43 %)           | 135.6 m/s               | 136.8 m/s | 0.91 %     |
| r5-transonic-min-dia-29 | 0    | 1560.5 m          | 1582.2 m         | 1.39 %     | 1582.2 m (1.39 %)          | 369.5 m/s               | 374.0 m/s | 1.21 %     |
| r5-transonic-min-dia-29 | 5    | 1555.0 m          | 1575.9 m         | 1.34 %     | 1577.1 m (1.41 %)          | 369.2 m/s               | 373.7 m/s | 1.21 %     |

## Ballistic descents in still air (item 9)

The table is written by `simulate.ballistic.test.ts` (`BALLISTIC_REPORT=<path>`). The runs use the OpenRocket-equivalent settings with the DATCOM large-angle model, no recovery device and RK4 at 0.002 s. In the "rail tilt" column, 0.1° is the pitch perturbation.

| Rocket                  | rail tilt | apogee   | end     | flight time | landing speed | landing angle of attack | largest α after apogee | nose-down (α < 90°) from    |
| ----------------------- | --------- | -------- | ------- | ----------- | ------------- | ----------------------- | ---------------------- | --------------------------- |
| r1-three-fin-conical    | 0°        | 168.9 m  | landing | 12.64 s     | 39.2 m/s      | 180.0°                  | 180.0°                 | never                       |
| r1-three-fin-conical    | 0.1°      | 168.9 m  | landing | 14.82 s     | 37.5 m/s      | 0.0°                    | 176.7°                 | 2.48 s after apogee, 149 m  |
| r2-ogive-boattail       | 0°        | 804.8 m  | landing | 43.76 s     | 18.0 m/s      | 41.0°                   | 180.0°                 | 33.35 s after apogee, 4 m   |
| r2-ogive-boattail       | 0.1°      | 804.8 m  | landing | 29.99 s     | 63.8 m/s      | 0.0°                    | 176.1°                 | 3.65 s after apogee, 765 m  |
| r3-minimum-diameter-24  | 0°        | 812.8 m  | landing | 52.96 s     | 20.1 m/s      | 161.7°                  | 180.0°                 | never                       |
| r3-minimum-diameter-24  | 0.1°      | 812.8 m  | landing | 29.67 s     | 68.9 m/s      | 0.0°                    | 176.0°                 | 3.45 s after apogee, 773 m  |
| r4-scratch-38mm         | 0°        | 692.0 m  | landing | 26.06 s     | 25.7 m/s      | 154.3°                  | 180.0°                 | never                       |
| r4-scratch-38mm         | 0.1°      | 692.0 m  | landing | 27.10 s     | 81.0 m/s      | 0.0°                    | 175.2°                 | 2.92 s after apogee, 658 m  |
| r5-transonic-min-dia-29 | 0°        | 1599.3 m | landing | 76.42 s     | 26.6 m/s      | 150.9°                  | 180.0°                 | never                       |
| r5-transonic-min-dia-29 | 0.1°      | 1599.3 m | landing | 40.74 s     | 98.6 m/s      | 0.0°                    | 175.4°                 | 4.40 s after apogee, 1533 m |

With the 0.1° perturbation every rocket turns nose-down within 2.5 to 4.4 s of apogee and lands nose-first. The landing speeds agree with the nose-first terminal speeds of the earlier wind runs (38.8, 64.1, 69.3, 82.0 and 99.2 m/s).

Launched exactly vertically, a rocket arrives at apogee exactly tail-first. α = 180° is an equilibrium there, since C_N = 0, but an unstable one: tail-first, the CP stays aft of the CG (R1 at 170°: CP 0.541 m, CG 0.387 m). R1 keeps the equilibrium to the ground because nothing breaks the symmetry. R2 to R5 leave it from round-off and tumble, which gives the lower, high-drag landing speeds. A real rocket is never exactly vertical, so the perturbed rows are the physical result.
