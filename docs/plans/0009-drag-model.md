# Plan 0009: Drag model

**Status:** written 2026-10-12 under autonomous mode; implemented in the following commits.
**Phase:** 2, step 3 (CLAUDE.md 6.3).

## Goal

The zero-angle-of-attack drag coefficient C_D0 of a rocket from Niskanen §3.4: skin friction with surface roughness and compressibility, nose and transition pressure drag, fin pressure drag, base drag with the motor's exhaust area removed, parasitic drag of launch lugs and rail buttons; the axial drag coefficient at angle of attack; a per-component breakdown; and warnings whenever a term is used outside the regime its source gives. The transonic regime is flagged (CLAUDE.md 6.3).

## Sources (Niskanen 2009 unless stated; printed pages)

| ID      | Equation                                                                                                                                                                                                    | Where                                                          | Validity                                                                          |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| DRAG-1  | Turbulent skin friction C_f = 1/(1.50 ln R − 5.6)²                                                                                                                                                          | eq. (3.78) p. 43                                               | 10⁴ < R < R_crit; fully turbulent boundary layer assumed (p. 43)                  |
| DRAG-2  | Roughness: R_crit = 51 (R_s/L)^(−1.039); C_f = 0.032 (R_s/L)^0.2 above it; C_f = 1.48·10⁻² below R = 10⁴ (the piecewise rule)                                                                               | eqs. (3.79), (3.80), (3.81) p. 44; Table 3.2 roughness heights | R_s the roughness height, L the rocket length                                     |
| DRAG-3  | Compressibility: C_fc = C_f (1 − 0.1 M²) subsonic; turbulent C_f/(1 + 0.15 M²)^0.58 and roughness-limited C_f/(1 + 0.18 M²) supersonic, the latter not below the turbulent value                            | eqs. (3.82) to (3.84) p. 45                                    |                                                                                   |
| DRAG-4  | Friction drag (C_D)friction = C_fc [(1 + 1/(2f_B)) A_wet,body + (1 + 2t/c̄) A_wet,fins]/A_ref                                                                                                                | eq. (3.85) p. 46                                               | f_B fineness ratio (p. 20), c̄ the MAC (eq. 3.30), fin wetted area both sides      |
| DRAG-5  | Stagnation pressure q_stag/q = 1 + M²/4 + M⁴/40 (M < 1), 1.84 − 0.76/M² + 0.166/M⁴ + 0.035/M⁶ (M > 1); blunt cylinder (C_D•)stag = 0.85 q_stag/q                                                            | eqs. (B.1), (B.2) pp. 106 to 107                               |                                                                                   |
| DRAG-6  | Nose pressure drag at low subsonic speed (C_D•,M=0)p = 0.8 sin²φ, φ the joint angle at the nose base; subsonic interpolation a M^b + (C_D•,M=0)p fitted to the transonic value and slope at its lower bound | eqs. (3.86), (3.87) pp. 47 to 48; B.5 p. 109                   | smooth joints give zero; blunt noses (length under half the diameter) not covered |
| DRAG-7  | Conical nose, transonic and supersonic: (B.4) for M ≥ 1.3, C_D•,M=1 = sin ε (B.6), slope at M = 1 (B.5) = 4/(γ+1)(1 − 0.5 C_D•,M=1), cubic interpolation on 1 ≤ M ≤ 1.3; tan ε = 1/(2f_N) (B.3)             | Appendix B.2 pp. 107 to 108                                    | γ = 1.4                                                                           |
| DRAG-8  | Ogive: the conical value times 0.72 (κ − 0.5)² + 0.82                                                                                                                                                       | eq. (B.8) p. 110, B.4 p. 109                                   | tangent (κ = 1) and secant ogives                                                 |
| DRAG-9  | Shoulder: nose rule with the reference area π(r_aft² − r_fore²); boat tail: (C_D•)base × {1 if γ < 1; (3 − γ)/2 if 1 < γ < 3; 0 if γ > 3}, γ = l/(d₁ − d₂), reference area the annulus (D-032)              | pp. 48 to 49, eq. (3.88)                                       | subsonic data; a warning in transonic flight (p. 49)                              |
| DRAG-10 | Fin pressure drag: leading edge (3.89) rounded, (3.90) square = stagnation; × cos²Γ_L (3.91); trailing edge: square = base, rounded = half, airfoil = 0 (3.92); sum (3.93), reference area N t s            | eqs. (3.89) to (3.93) pp. 49 to 50                             | Γ_L the leading-edge sweep angle, tan Γ_L = x_t/s                                 |
| DRAG-11 | Base drag (C_D•)base = 0.12 + 0.13 M² (M < 1), 0.25/M (M > 1); reference area the base minus the thrusting motors' area                                                                                     | eq. (3.94) pp. 50 to 51                                        |                                                                                   |
| DRAG-12 | Parasitic drag (C_D•)parasitic = max{1.3 − 0.3 l/d, 1} (C_D•)stag, A = π r_ext² − π r_int² max{1 − l/d, 0}; rail pins as lugs with the pin's frontal area and l = d                                         | eqs. (3.95), (3.96) p. 52                                      |                                                                                   |
| DRAG-13 | C_D0 = Σ (A_T/A_ref)(C_D•)T + (C_D)friction                                                                                                                                                                 | eq. (3.97) p. 52                                               |                                                                                   |
| DRAG-14 | Axial drag at angle of attack: C_A = C_D0 × s(α), s a two-part polynomial with s(0) = 1, s(17°) = 1.3, s(90°) = 0 and zero derivative at those angles (cubic Hermite pieces, D-033)                         | §3.4.7 p. 53                                                   | empirical; "sufficiently accurate for small angles of attack"                     |
| GEO-13  | Wetted area of a body of revolution A = ∫ 2π r √(1 + r′²) dx; nose fineness ratio f_N = L/d; joint angle φ = atan r′(L)                                                                                     | definitions; f_N B.3 p. 107                                    |                                                                                   |

Not implemented, throws `NotImplementedError`: pressure drag above Mach 0.8 of elliptical, parabolic, power-series and Haack noses (Niskanen Appendix B.3 takes it from Stoney's measured curves, NASA TR R-100, which the thesis does not reproduce; using that report's figures as model data needs the owner's confirmation since CLAUDE.md lists it as validation data only); the partially laminar boundary layer (p. 43, Niskanen drops it); interference drag and fin-tip vortices (p. 41, ignored by the source).

## Conventions

- Reference area A_ref = π d²/4 with d the maximum body diameter (as for stability); the rocket length L for the Reynolds number is the sum of the external components' lengths.
- Roughness height R_s is a property of the rocket's finish. Presets from Table 3.2 p. 44 and Figure 3.10 p. 45; the reference rockets use 60 µm ("regular paint", `settings.md`).
- Fin cross-section ('square', 'rounded', 'airfoil') is a property of the fin set; the `.ork` reader sets 'square' (the only one it accepts).
- Every drag result carries its Mach number, Reynolds number, the regime, the component breakdown and a list of warnings (transonic regime; shoulder or boat tail in transonic flight).

## Files

| File                                                    | Purpose                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/physics/src/drag/skin-friction.ts`            | DRAG-1 to DRAG-4, roughness presets                                             |
| `packages/physics/src/drag/pressure-drag.ts`            | DRAG-5 to DRAG-9 (stagnation, nose, shoulder, boat tail)                        |
| `packages/physics/src/drag/fin-drag.ts`                 | DRAG-10                                                                         |
| `packages/physics/src/drag/base-parasitic.ts`           | DRAG-11, DRAG-12                                                                |
| `packages/physics/src/drag/drag.ts`                     | DRAG-13, DRAG-14, geometry helpers (GEO-13), the rocket-level `dragCoefficient` |
| tests next to each file, plus `drag.openrocket.test.ts` | hand calculations and the black-box comparison with OpenRocket's time series    |

## Tests

- Skin friction by hand: R = 2.2·10⁶ gives C_f = 1/(1.5 × 14.604 − 5.6)² = 1/(16.306)² = 3.761·10⁻³; R_s = 60 µm, L = 0.6 m: R_crit = 51 × (10⁻⁴)^(−1.039) = 7.386·10⁵, roughness-limited C_f = 0.032 × (10⁻⁴)^0.2 = 5.072·10⁻³; below 10⁴: 1.48·10⁻²; compressibility at M = 0.5: × 0.975; supersonic M = 1.5: turbulent ÷ (1.3375)^0.58, roughness ÷ 1.405.
- Stagnation at M = 0.5: 1.0640625, × 0.85 = 0.90445; at M = 2: 1.84 − 0.19 + 0.010375 + 0.000547 = 1.660922.
- Conical nose f_N = 2 (ε = atan 0.25 = 14.036°): B.4 at M = 2: 2.1/17 + 0.5/√(17 × 3) = 0.123529 + 0.070014 = 0.193543; B.6: sin ε = 0.242536; B.5 slope: (4/2.4)(1 − 0.121268) = 1.464553; subsonic (3.87) from (0.8 sin²φ = 0.8 × 0.058824 = 0.047059) rises to 0.242536 at M = 1 with slope 1.464553: b = 1.464553/(0.242536 − 0.047059) = 7.4924, a = 0.195477; continuity at M = 1 and 1.3.
- Ogive factor: κ = 1 → 1.0, κ = 0.5 → 0.82.
- Boat tail R2: γ = 0.05/(0.054 − 0.036) = 2.778, factor (3 − 2.778)/2 = 0.1111.
- Fin leading edge rounded at M = 0.5: 0.75^(−0.417) − 1 = 0.12746; square = stagnation; cos²Γ_L for x_t = 0.05, s = 0.08: cos² atan(0.625) = 0.7191.
- Base drag at M = 0.5: 0.1525; at M = 2: 0.125; R1 base area minus the D12: π(0.025² − 0.012²) = 1.5111·10⁻³ m².
- Parasitic: R1 lug l/d = 50/6 → factor 1, area π 0.003² = 2.827·10⁻⁵ m² (inside included since l > d); a wire loop with l = 0: factor 1.3 and the annulus only.
- Axial drag polynomial: s(0) = 1, s(17°) = 1.3, s(90°) = 0, s(8.5°) by the Hermite formula, zero slopes at the knots, continuity.
- R1 at 54.1 m/s (Mach 0.159, sea level, the motor thrusting): every term by hand in the test comment and the total compared with OpenRocket's 0.776 at that time step (observed agreement recorded, no tuning); R1 at rest: 1.39.
- Black box: for R1 to R4 (zero wind, α = 0) sample OpenRocket's `drag_coefficient` against ours at the same Mach, altitude and thrust state at twenty time steps each; report the maximum relative difference and assert the observed bound.
- Properties: C_D0 > 0; adding a launch lug never reduces C_D0; C_f non-increasing with R in the turbulent regime; the roughness-limited value is independent of R; results are deterministic.
