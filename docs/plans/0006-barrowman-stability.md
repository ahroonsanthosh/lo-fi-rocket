# Plan 0006: Barrowman normal force, centre of pressure and stability

**Status:** written 2026-10-11 under autonomous mode; implemented in the following commit.
**Phase:** 1, step 6 (the last Phase 1 step).

## Goal

For a rocket built from the plan 0003 components: the normal force coefficient derivative C_Nα and centre of pressure of every aerodynamic component (nose cone, transition, trapezoidal fin set; a cylindrical body tube contributes nothing), the fin–body interference, the total CP by the moment sum, and the stability margin in calibers at liftoff and at burnout. Two modes (D-016): the displayed figure uses Niskanen's roll-angle reduction at the worst roll angle; the OpenRocket-equivalent mode omits the reduction and is used for the Phase 1 acceptance against `reference/rockets/values.csv`. Results carry the mode they were computed in.

## Sources (Niskanen 2009, chapter 3; printed page = PDF page − 10)

| ID    | Equation                                                                                                                                                       | Where                                                                               | Validity                                                                                         |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| BAR-1 | β = √(1 − M²) for M < 1                                                                                                                                        | eq. (3.13), p. 20                                                                   | subsonic branch only; the supersonic branch is Phase 2                                           |
| BAR-2 | Body component C_Nα = (2/A_ref)[A(l) − A(0)]·(sin α/α), with sin α/α → 1 as α → 0                                                                              | eq. (3.19), p. 22                                                                   | axisymmetric body, α → 0; assumed independent of Mach (p. 22)                                    |
| BAR-3 | Body component CP X_B = [l·A(l) − V]/[A(l) − A(0)] from the component's forward end                                                                            | eq. (3.28), p. 24                                                                   | as BAR-2; undefined (and unused) when A(l) = A(0)                                                |
| BAR-4 | Total CP X = Σ X_i (C_Nα)_i / Σ (C_Nα)_i                                                                                                                       | eq. (3.29), p. 25                                                                   | requires Σ (C_Nα)_i > 0                                                                          |
| BAR-5 | Trapezoidal fin CP X_f = (x_t/3)(c_r + 2c_t)/(c_r + c_t) + (1/6)(c_r² + c_t² + c_r c_t)/(c_r + c_t) from the root leading edge                                 | eq. (3.34), p. 27                                                                   | M < 0.5 (quarter-MAC assumption, p. 27); the rearward shift of eqs. (3.35) and (3.36) is Phase 2 |
| BAR-6 | Single fin (C_Nα)₁ = 2π s²/A_ref / (1 + √(1 + (β s²/(A_fin cos Γ_c))²))                                                                                        | eq. (3.40), p. 29 (from 3.37 to 3.39)                                               | subsonic, flat plate fins; Γ_c is the mid-chord sweep angle of Figure 3.2(a), p. 26              |
| BAR-7 | N fins (C_Nα)_N: Σ sin²Λ_k (C_Nα)₁ for N = 1, 2; 1.50[1 − 0.15 cos²(3θ/2)] for N = 3; 2.00[1 − 0.06 sin²(2θ)] for N = 4; 2.37, 2.74, 2.99, 3.24 for N = 5 to 8 | eq. (3.54), p. 34, with Λ_k = 2πk/N + θ from eq. (3.53), p. 32                      | equally spaced uncanted fins, N ≤ 8; θ = 0 has one fin pointing into the lateral airflow         |
| BAR-8 | Fin–body interference (C_Nα)_T(B) = K_T(B)(C_Nα)_N, K_T(B) = 1 + r_t/(s + r_t)                                                                                 | eqs. (3.55), (3.56), p. 34                                                          | the body's extra lift due to the fins is ignored (p. 34)                                         |
| BAR-9 | Stability margin = (X_CP − X_CG)/d in calibers, d the maximum body diameter                                                                                    | caliber: p. 20; margin: CLAUDE.md 6.2, OpenRocket `maximum` reference (settings.md) | definition                                                                                       |

The body lift extension (eqs. (3.26), (3.27), p. 24) is proportional to sin²α and contributes nothing to C_Nα at α → 0, which is what the design-window CP needs; it is noted in `docs/known-limitations.md` and belongs to Phase 2 with the angle-of-attack aerodynamics. The derivation's assumptions (p. 21: α near zero, steady irrotational flow, rigid body, sharp nose tip, flat-plate fins, axisymmetric body) go into `docs/known-limitations.md`.

## Conventions

- C_Nα values are referred to the reference area A_ref = π d²/4; d defaults to the maximum body diameter (the largest outer radius of the nose, body tubes and transitions, doubled), and may be given explicitly.
- The volume V in BAR-3 is that of the outer profile (plan 0003 profiles, Gauss–Legendre integration at the default 512 panels); a nose cone's shoulder sits inside the tube and is ignored aerodynamically.
- Roll angle: either a given θ or `worst`, meaning the θ that minimises each fin set's normal force (N = 3: θ = 0, factor 1.275; N = 4: θ = 45°, factor 1.88; N = 1 or 2: zero fin normal force, the fins being edge-on to the lateral airflow; N ≥ 5: no dependence). With several fin sets each uses its own worst θ, which bounds the true worst case from the forward (conservative) side; recorded as a limitation.
- `finRollReduction: false` (OpenRocket-equivalent, D-016) removes the bracketed empirical factors for N = 3 and 4, giving 1.50 and 2.00; everything else is unchanged.
- Mach numbers at or above 0.5 throw `NotImplementedError` (BAR-5's limit); at or above 1 the fin C_Nα is also not implemented. NaN and negative Mach are invalid input.

## Files

| File                                               | Purpose                                                                                                                                                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/physics/src/stability/barrowman.ts`      | `prandtlBeta`, `bodyTerm`, `noseConeTerm`, `transitionTerm`, `finRollFactor`, `finSetTerm`, `maximumBodyDiameter`, `centreOfPressure`, `stabilityMargin`, `rocketStability` |
| `packages/physics/src/stability/barrowman.test.ts` | hand calculations, closed-form oracles, the five-rocket acceptance, mode checks, properties, validity errors                                                                |
| `packages/formats/src/ork.test.ts`                 | acceptance from the `.ork` and `.eng` files alone                                                                                                                           |

## Tests

- R1 by hand (`reference/rockets/hand-checks.md`): nose C_Nα = 2, X = 2L/3 = 0.066667; X_f = 0.041667; (C_Nα)₁ = 8.3195; K = 1.238095; CP 0.487227 without the reduction and 0.478890 with it; margins 2.0041 and 1.8374 calibers at CG 0.387022.
- Closed forms: Von Kármán nose V = πR²L/2 so X = L/2 (R3: 0.050, R5: 0.065); conical frustum (R2 boat tail) V = πl(r_f² + r_f r_a + r_a²)/3 = 8.05818e-5 m³, C_Nα = −1.111111, X_B = 0.023333; tangent ogive V = π[(ρ² + a²)L − L³/3 − a(L√(ρ² − L²) + ρ² asin(L/ρ))], a = ρ − R, giving X = 0.069263 (R2) and 0.092507 (R4).
- Roll factor: N = 3 at θ = 0 → 1.275, at 60° → 1.50; N = 4 at 45° → 1.88, at 0 → 2.00; N = 1 at 90° → 1, N = 2 at 90° → 2, both 0 at worst; N = 5 to 8 constants; N = 9 throws `NotImplementedError`; N = 0 throws `InvalidInputError`.
- Acceptance (OpenRocket-equivalent mode, Mach 0.3, worst roll angle): CP of R1 to R5 within 2 % of `values.csv` (observed 0.016 to 0.034 %, from an independent Python check), stability margin within 1 %, liftoff CG within 1 % (already tested in plan 0003).
- Display mode: CP is never aft of the OpenRocket-equivalent CP for the reference rockets; the result records the mode.
- Properties (fast-check): adding a fin set whose CP lies aft of the rocket's CP never moves the CP forward; raising the Mach number in [0, 0.5) never moves the CP forward for a conventional (fins aft) rocket; the CP lies between the forward-most and aft-most component CPs when every term is positive; identical inputs give identical outputs.
- Errors: Mach 0.5 and above, Mach 1 and above, NaN Mach, a rocket with no aerodynamic components, total C_Nα ≤ 0.
