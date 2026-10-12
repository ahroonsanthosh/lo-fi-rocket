# Phase 2 acceptance report (simulation)

Date: 2026-10-12. Branch `claude/inspiring-tesla-xxp0hh`, commits fad0f0d to 54b4ffb (plans 0007 to 0010). Produced under autonomous mode (CLAUDE.md section 11) at the end of Prompt 2.

## Acceptance criteria (CLAUDE.md section 10, Phase 2)

| Criterion                                                 | Result                                                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Motor parsing                                             | RASP `.eng` (plan 0004) and RockSim `.rse` (plan 0007, D-029) read precisely, malformed files rejected by name |
| Drag model                                                | Niskanen chapter 3 in full for conical and ogive noses; other noses to Mach 0.8 (D-034)                        |
| 6DOF simulation with both integrators                     | RK4 and Dormand–Prince; agreement within 0.001 m in apogee on R1                                               |
| Events and recovery                                       | Table 4.2 events located by bisection; descent under the deployed devices                                      |
| Analytical cases pass                                     | yes (section 3)                                                                                                |
| Step-size convergence shown                               | yes (section 2): halving the RK4 step changes the apogee by 0.010 m                                            |
| Apogee within 5 % and velocities within 3 % of OpenRocket | yes for R1 to R4 with and without wind (section 1); R5 cannot be simulated (section 5)                         |

## 1. Reference comparison against OpenRocket (CLAUDE.md 7.4)

OpenRocket 24.12 values from `reference/rockets/values.csv` (settings in `reference/rockets/settings.md`: flat Earth, gravity 9.8061992 m/s², 1.5 m rail, finish 60 µm, time step 0.001 s, parachute at apogee with C_D 0.8). Ours: the rockets built from the `.ork` and `.eng` files by the formats package, in the OpenRocket-equivalent modes (no fin roll reduction D-016, base-drag rule `'always'` D-035, OpenRocket's gravity value D-030), RK4 at 0.002 s, 6DOF. The acceptance test is `packages/formats/src/simulate.openrocket.test.ts`.

### Apogee (tolerance 5 %) and maximum velocity (tolerance 3 %)

| Rocket, wind | Apogee ours (m) | OpenRocket | Diff % | Max velocity ours (m/s) | OpenRocket | Diff % |
| ------------ | --------------- | ---------- | ------ | ----------------------- | ---------- | ------ |
| R1, 0 m/s    | 168.866         | 167.045    | +1.09  | 62.259                  | 61.972     | +0.46  |
| R1, 5 m/s    | 160.964         | 160.329    | +0.40  | 61.344                  | 61.160     | +0.30  |
| R2, 0 m/s    | 804.796         | 820.806    | −1.95  | 244.598                 | 245.821    | −0.50  |
| R2, 5 m/s    | 797.429         | 813.612    | −1.99  | 244.120                 | 245.364    | −0.51  |
| R3, 0 m/s    | 812.786         | 832.929    | −2.42  | 233.191                 | 233.975    | −0.34  |
| R3, 5 m/s    | 806.714         | 826.785    | −2.43  | 232.770                 | 233.568    | −0.34  |
| R4, 0 m/s    | 691.987         | 692.685    | −0.10  | 136.116                 | 136.122    | −0.00  |
| R4, 5 m/s    | 672.534         | 674.261    | −0.26  | 135.509                 | 135.558    | −0.04  |

Every apogee is within 2.5 % and every maximum velocity within 0.6 %. The test asserts the CLAUDE.md tolerances and, separately, the observed agreement (apogee 3 %, maximum velocity 1 %) so that a regression of the model is caught.

### Other summary values (reported, no tolerance set by CLAUDE.md)

| Rocket, wind | Rail exit ours (m/s) | OR     | Diff % | Time to apogee ours (s) | OR     | Diff % | Ground hit ours (m/s) | OR    | Diff % | Flight time ours (s) | OR      | Diff % |
| ------------ | -------------------- | ------ | ------ | ----------------------- | ------ | ------ | --------------------- | ----- | ------ | -------------------- | ------- | ------ |
| R1, 0 m/s    | 18.453               | 18.456 | −0.02  | 5.868                   | 5.830  | +0.66  | 6.934                 | 6.934 | +0.01  | 30.616               | 30.264  | +1.16  |
| R1, 5 m/s    | 18.428               | 18.450 | −0.12  | 5.742                   | 5.740  | +0.03  | 8.549                 | 8.549 | +0.00  | 29.462               | 29.317  | +0.49  |
| R2, 0 m/s    | 26.600               | 26.611 | −0.04  | 10.197                  | 10.342 | −1.40  | 6.594                 | 6.594 | +0.00  | 130.395              | 132.837 | −1.84  |
| R2, 5 m/s    | 26.586               | 26.594 | −0.03  | 10.172                  | 10.328 | −1.51  | 8.275                 | 8.275 | +0.00  | 129.375              | 131.860 | −1.88  |
| R3, 0 m/s    | 31.592               | 31.639 | −0.15  | 10.478                  | 10.684 | −1.93  | 6.499                 | 6.499 | +0.01  | 133.594              | 136.741 | −2.30  |
| R3, 5 m/s    | 31.581               | 31.624 | −0.14  | 10.451                  | 10.660 | −1.96  | 8.200                 | 8.200 | +0.00  | 132.747              | 135.894 | −2.32  |
| R4, 0 m/s    | 16.815               | 16.825 | −0.06  | 11.378                  | 11.388 | −0.09  | 6.245                 | 6.245 | +0.00  | 120.813              | 120.889 | −0.06  |
| R4, 5 m/s    | 16.810               | 16.818 | −0.05  | 11.209                  | 11.236 | −0.24  | 8.000                 | 8.000 | +0.00  | 117.779              | 118.045 | −0.23  |

Maximum Mach and maximum acceleration agree within 0.5 % and 0.15 %. The deployment velocity differs by convention: ours is the speed at the exact apogee (zero in still air, the horizontal airspeed in wind: 3.90, 1.84, 1.62 and 9.70 m/s for R1 to R4 against OpenRocket's 3.23, 1.79, 1.80 and 9.38 m/s), while OpenRocket reports the speed one step after detecting apogee (about 0.45 m/s in still air). The ground-hit velocity, which depends only on the mass, the canopy and the atmosphere, agrees to three decimals in every case, which checks the mass model, the parachute drag and the atmosphere together.

### Explanation of the residual differences

- R1 (+1.1 %) and R4 (−0.1 %) fly below Mach 0.2 and 0.4, where the drag model has no Mach-dependent terms beyond compressible skin friction, and agree closely.
- R2 (−2.0 %) and R3 (−2.4 %) reach Mach 0.72 and 0.69. The whole difference is in the coast: maximum velocities agree within 0.5 % while the time to apogee is 1.4 to 1.9 % shorter, so our coasting drag is a few per cent higher than OpenRocket's in the Mach 0.3 to 0.7 band. The static drag comparison of plan 0009 (`drag.openrocket.test.ts`) showed our total C_D within 6 % of OpenRocket's column while thrusting and the base-drag rule difference after burnout (D-035); the remaining difference is in the pressure drag terms' Mach dependence (the stagnation-pressure scaling of DRAG-6 and the subsonic rise towards the transonic value). OpenRocket's drag code was not read (GPLv3), so the agreement is observed, not derived. No constant was tuned (CLAUDE.md 7.4). R3's Haack nose additionally has no subsonic pressure-drag rise (D-034), which lowers our drag and is the opposite sign from the observed residual, so it is not the cause.
- Rail-exit velocities within 0.15 % confirm the thrust curve interpolation, the mass model and the rail convention (DYN-12).

### Displayed modes

The figures a user would see (Niskanen's roll reduction, the source base-drag rule `'while-thrusting'`, standard gravity 9.80665 m/s²) are lower: apogee R1 167.33 m, R2 783.2 m, R3 768.4 m, R4 681.2 m in still air (−0.9 % to −5.5 % from the OpenRocket-equivalent figures). The difference is the base-drag rule (D-035): after burnout the source rule restores the motor's share of the base area. Which rule the application displays is an open question for the owner.

## 2. Integrators: convergence and agreement (CLAUDE.md 6.5)

R1 with the Estes D12, still air, OpenRocket-equivalent modes. Test: `simulate.r1.test.ts`.

| Integrator     | Step or tolerance | Apogee (m) | Max velocity (m/s) | Time to apogee (s) | Rail exit (m/s) | Steps  |
| -------------- | ----------------- | ---------- | ------------------ | ------------------ | --------------- | ------ |
| RK4            | 0.01 s            | 168.8604   | 62.2479            | 5.86832            | 18.4513         | 3 065  |
| RK4            | 0.005 s           | 168.8703   | 62.2597            | 5.86841            | 18.4534         | 6 127  |
| RK4            | 0.002 s           | 168.8661   | 62.2588            | 5.86837            | 18.4530         | 15 312 |
| RK4            | 0.001 s           | 168.8667   | 62.2588            | 5.86837            | 18.4530         | 30 620 |
| Dormand–Prince | 1e-6 (atol 1e-8)  | 168.8857   | 62.0681            | 5.86856            | 18.4535         | 644    |
| Dormand–Prince | 1e-8 (atol 1e-10) | 168.8668   | 62.2581            | 5.86837            | 18.4529         | 704    |

Halving the step from 0.01 s to 0.005 s changes the apogee by 0.010 m (0.006 %), and 0.005 s to 0.001 s by 0.004 m; the documented tolerance is 0.05 m. The RK4 result at 0.002 s (used for the acceptance) is within 0.001 m of 0.001 s. Dormand–Prince at 1e-8 agrees with RK4 at 0.001 s within 0.0002 m in apogee and 0.001 m/s in maximum velocity using 2 % of the steps. At the loose tolerance 1e-6 the maximum velocity is read 0.3 % low because the peak falls between accepted steps (`docs/known-limitations.md`); the apogee is still within 0.02 m.

The 3DOF cross-check (axial drag along the velocity, no rotation) gives the same result as the 6DOF simulation in still air (zero angle of attack), as it must.

## 3. Analytical cases (CLAUDE.md 7.2)

Test: `simulate.analytical.test.ts`, ideal motor (constant thrust, constant mass), aerodynamics off.

- Constant thrust 30 N for 1 s on a 1 kg mass, g = 9.80665: a = 20.19335 m/s², rail exit at 1.5 m with v = √(2 a L) = 7.783 m/s, burnout at v = 20.19335 m/s and z = 10.0967 m, apogee z + v²/2g = 10.0967 + 20.8002 = 30.897 m above burnout, that is 41.0969 m; landing when the free fall returns to zero. RK4 and Dormand–Prince reproduce these within 1e-6 m.
- Vacuum coast (property test over thrust and burn time with a rail-clearance precondition): apogee above burnout equals v²/2g within 1e-6 relative, and the mechanical energy is conserved along the coast within 1e-9 relative.
- A thrust below the weight never leaves the pad; a rail 20° towards east sends the rocket east with zero crossrange; two runs are bit-identical.
- Atmosphere at the standard altitudes: Phase 1 (57 published-table rows).

## 4. Property-based tests (CLAUDE.md 7.3)

- Motor: propellant remaining is non-increasing and within [0, m_p]; impulse non-decreasing; thrust non-negative (300 runs, both mass rules).
- Drag: a rougher finish and an extra launch lug both lower the apogee (R1, both integrators).
- Energy conserved in drag-free coast (section 3); quaternion norm preserved by rotation; wind vector round trips.
- Phase 1 properties (mass non-negative, fins never move the CP forward) remain.

## 5. Not verified, or outside this phase

- **R5 (transonic, Mach 1.09) cannot be simulated past Mach 0.8.** Two gaps, both recorded as decisions and reported, not worked around: the transonic pressure drag of Haack, elliptical, parabolic and power-series noses comes from measured curves in NASA TR R-100 that CLAUDE.md lists as validation data only (D-034); and Niskanen does not give the transonic fin interpolation (D-039). The run stops with a `NotImplementedError` naming the component and the Mach number. OpenRocket's values for R5 (apogee 1560.5 m, maximum velocity 369.5 m/s) remain in `values.csv` for when the owner decides. This is the Phase 2 wind-tunnel validation work of CLAUDE.md 6.7 item 1, which also needs a decision on data use.
- **Dormand and Prince (1980)** is not in `reference/`. The tableau is verified by the consistency sums and the order tests (D-037), which is an independent check but not a check against the document.
- **Gravity latitude dependence** (D-030): only a sea-level value is accepted; the OpenRocket-equivalent value at 45° N is observed, not derived.
- **Base-drag rule after burnout** (D-035): the source rule and OpenRocket's rule differ by 1 to 5 % in apogee; the comparison uses OpenRocket's, the display is the owner's choice.
- **Not implemented**, each throwing or rejected by name: wind profiles and turbulence (Phase 5), streamers, supersonic roll damping, fin cant, clusters, stages, Earth curvature and rotation, inertia rate and jet damping terms (`docs/known-limitations.md`).
- **OpenRocket's code** was not read (GPLv3); every agreement above is observed from its output.

## 6. Assumptions and decisions made without asking (CLAUDE.md section 11)

D-028 RASP propellant mass in proportion to the impulse delivered; D-029 `.rse` unit and column rules; D-030 gravity inverse-square with a sea-level parameter; D-031 half-angle quaternion of eq. (4.13) for eq. (4.24); D-032 boat-tail area ratio 1; D-033 cubic Hermite angle-of-attack drag scaling; D-034 no transonic drag for non-conical, non-ogive noses; D-035 base-drag motor rule with the OpenRocket-equivalent option; D-036 Euler's rigid-body equation about the CG; D-037 Dormand–Prince verification and step controller; D-038 orientation derivative; D-039 transonic fin band throws. Full text in `docs/decisions.md`.

## 7. Verification against the sources

- Every implemented equation is in `docs/equations.md` with source, page, validity range, symbols, implementing function and verifying test: MOT-1 to 5, DYN-1 to 15, GRAV-1, GRAV-C, ENV-1, ENV-2, ATM-11, DRAG-1 to 14, GEO-13, BAR-10, BAR-11, AERO-1 to 5.
- Every physics function carries a citation to a page of a document in `reference/docs/` except the Dormand–Prince tableau (above) and the project conventions marked as such (step controller, angle-of-attack scaling reading of D-033, event bisection).
- Hand calculations in the tests: D12 thrust interpolation and impulse trapezoids, RASP mass at 0.282 s against the RockSim file's mass column, skin friction and pressure drag values at stated Mach numbers, fin K₁ to K₃ at Mach 2, R1 normal force and CP at 5°, pitch and roll damping at stated rates, RK4 one step, the constant-thrust flight.

## Checks

| Check               | Result                                                                |
| ------------------- | --------------------------------------------------------------------- |
| `pnpm typecheck`    | clean (3 packages)                                                    |
| `pnpm lint`         | clean (ESLint 10, typescript-eslint strictTypeChecked)                |
| `pnpm format:check` | clean (Prettier)                                                      |
| `pnpm test`         | 28 files, 422 tests passed (physics 24 files 346, formats 4 files 76) |
| Golden outputs      | `golden/ussa1976.json` unchanged                                      |

The eight reference flights take about 20 s in the test suite (RK4 at 0.002 s, 120 to 135 s of flight each).

## Open item: pull request

Unchanged from the Phase 1 report: the repository has a single branch, `claude/inspiring-tesla-xxp0hh`, which is also its default branch, so GitHub cannot open a pull request from it until a separate default branch (for example `main`) exists.
