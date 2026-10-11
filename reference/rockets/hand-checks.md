# Hand check of reference rocket R1

Independent calculation of R1's liftoff centre of gravity and Barrowman centre of pressure from the plain-number specification in `README.md`, using only the documents in `reference/docs/`. Reproduce with `python3 -I hand-check-r1.py` (the script contains the same arithmetic; it does not use OpenRocket).

## Centre of gravity at liftoff

Masses from volume × density, CG from the centroid of each shape, x from the nose tip.

| Component | Volume or mass rule | Mass kg | CG x m |
| --- | --- | --- | --- |
| Nose cone, solid cone R = 0.025, L = 0.100, balsa 160 | V = πR²L/3 = 6.5450 × 10⁻⁵ m³; centroid at 3L/4 | 0.010472 | 0.075000 |
| Body tube, R = 0.025, t = 0.001, L = 0.500, paper 700 | V = π(R² − (R − t)²)L = 7.6969 × 10⁻⁵ m³; mid-length, position 0.100 | 0.053878 | 0.350000 |
| Fins, 3, root 0.100, tip 0.050, sweep 0.050, span 0.080, t = 0.003, plywood 600 | A = (c_r + c_t)/2 · s = 0.0060 m² per fin; V = 3 A t = 5.4 × 10⁻⁵ m³; planform centroid 0.061111 aft of the root leading edge at 0.500 | 0.032400 | 0.561111 |
| Nose weight, given mass, length 0.020 at 0.100 | mid-length | 0.030000 | 0.110000 |
| Launch lug, r_o = 0.003, r_i = 0.0025, L = 0.050, paper 700 | V = π(r_o² − r_i²)L = 4.3197 × 10⁻⁷ m³; mid-length, position 0.350 | 0.000302 | 0.375000 |
| Motor mount tube, r_o = 0.0125, t = 0.0005, L = 0.075, paper 700 | V = 2.8864 × 10⁻⁶ m³; mid-length, position 0.525 | 0.002020 | 0.562500 |
| Centering rings, 2, r_o = 0.024, r_i = 0.0125, L = 0.005, paper 700 | V = 6.5934 × 10⁻⁶ m³ each; positions 0.530 and 0.590 | 0.004615 each | 0.532500, 0.592500 |
| Parachute, given mass, length 0.050 at 0.200 | mid-length | 0.010000 | 0.225000 |
| Structure total | Σm, Σmx/Σm | **0.148304** | **0.335898** |
| Motor, Estes D12 | mass 0.0426 kg from the `.eng` header (`D12 24 70 0-3-5-7 0.0211 0.0426 Estes`: propellant 0.0211 kg, total 0.0426 kg, length 70 mm); CG at mid-length, aft end at 0.600 | 0.042600 | 0.565000 |
| **Liftoff total** | | **0.190904** | **0.387022** |

Fin centroid: for a trapezoidal fin with leading edge x_LE(y) = x_t y/s and chord c(y) = c_r + (c_t − c_r) y/s, the centroid is ∫(x_LE + c/2) c dy / A, evaluated in the script; the result 0.061111 m equals the closed form (c_r² + c_r c_t + c_t²)/(3(c_r + c_t)) + x_t(c_r + 2c_t)/(3(c_r + c_t)) = 0.038889 + 0.022222.

| Quantity | Hand | OpenRocket (`values.csv`, `components/r1-three-fin-conical.csv`) | Difference |
| --- | --- | --- | --- |
| Structure mass | 0.148304 kg | 0.148304 kg | 0.000 % |
| Liftoff mass | 0.190904 kg | 0.190904 kg | 0.000 % |
| Liftoff CG | 0.387022 m | 0.387022 m | 0.000 % |
| Every component mass and CG | as above | identical to 6 decimals | 0.000 % |

## Centre of pressure (Barrowman, Mach 0.3, zero angle of attack)

Equations from Niskanen (2009), *Development of an Open Source model rocket simulation software*, chapter 3 (`reference/docs/niskanen-2009-openrocket-thesis.pdf`; page numbers are the printed ones, PDF page = printed page + 10).

1. **Nose cone normal force.** Eq. (3.19), p. 22: C_Nα = (2/A_ref)[A(l) − A(0)] (sin α/α → 1). With A(l) = πR² = A_ref and A(0) = 0: **C_Nα,nose = 2**.
2. **Nose cone CP.** Eq. (3.28), p. 24: X_B = [l A(l) − V] / [A(l) − A(0)]. Cone: V = πR²L/3, so X = L − L/3 = 2L/3 = **0.066667 m**.
3. **Body tube.** A(l) = A(0), so C_Nα = 0 by eq. (3.19); it contributes nothing at zero angle of attack (body lift, eq. (3.26) p. 24, is proportional to sin²α and vanishes).
4. **Fin CP.** Eq. (3.34), p. 27: X_f = (x_t/3)(c_r + 2c_t)/(c_r + c_t) + (1/6)(c_r² + c_t² + c_r c_t)/(c_r + c_t) = 0.022222 + 0.019444 = **0.041667 m** aft of the root leading edge, which is at 0.500 m, so X_fins = **0.541667 m**.
5. **Single-fin normal force.** Eq. (3.37), p. 28, with eqs. (3.38) to (3.40), p. 29: C_Nα0 = 2π/β, β = √(1 − M²) = 0.953939 at M = 0.3; F_D = AR / ((C_Nα0/2π) cos Γ_c) with AR = 2s²/A_fin = 2.1333; mid-chord sweep tan Γ_c = (x_t + c_t/2 − c_r/2)/s = 0.025/0.080, Γ_c = 17.354°. Then (C_Nα)₁ = C_Nα0 F_D (A_fin/A_ref) cos Γ_c / (2 + F_D √(1 + 4/F_D²)) = **8.3195** (eq. (3.40) gives the same: 2π s²/A_ref / (1 + √(1 + (β s²/(A_fin cos Γ_c))²)) = 20.480/2.4617).
6. **Three fins.** Eq. (3.54), p. 34: (C_Nα)₃ = 1.50 (C_Nα)₁ [1 − 0.15 cos²(3θ/2)], θ the roll angle. The bracket ranges from 0.85 to 1.00.
7. **Fin–body interference.** Eqs. (3.55) and (3.56), p. 34: (C_Nα)_T(B) = K_T(B) (C_Nα)₃ with K_T(B) = 1 + r_t/(s + r_t) = 1 + 0.025/0.105 = **1.238095**.
8. **Total CP.** Eq. (3.29), p. 25: X = Σ X_i (C_Nα)_i / Σ (C_Nα)_i.

| Roll-angle factor in eq. (3.54) | (C_Nα)_T(B) | Total C_Nα | CP m | Stability cal (CG 0.387022, d 0.050) |
| --- | --- | --- | --- | --- |
| 1.00 (bracket at its maximum) | 15.4506 | 17.4506 | **0.487227** | 2.0041 |
| 0.85 (bracket at its minimum, the most forward CP) | 13.1330 | 15.1330 | 0.478890 | 1.8374 |
| OpenRocket 24.12 design window (`values.csv`) | | | **0.487149** | 2.0025 |

**Result.** OpenRocket's CP agrees with the hand calculation that uses the unreduced three-fin factor 1.50 to within 0.016 % (0.08 mm), far inside the 2 % reporting threshold. The 0.016 % residual is consistent with OpenRocket evaluating the cone and fin terms slightly differently from the closed forms above (for example a numerically integrated nose cone); it was not investigated further.

**Finding for Phase 1 (decided).** Niskanen's eq. (3.54) makes the three-fin normal force depend on roll angle, dropping to 85 % of the Barrowman value at the worst roll angle. OpenRocket 24.12's CP is the unreduced value: the harness probe (`settings.md`) shows the same CP at every roll angle from 0° to 120° for all five rockets, so OpenRocket applies no roll-angle dependence at all. The reduced value puts R1's CP 1.7 % further forward and lowers its stability from 2.00 to 1.84 calibers. The owner's decision (Prompt 1, Part B2, item 2): the app displays the Niskanen worst-case (reduced) figure because overstating stability is the unsafe direction, and provides an OpenRocket-equivalent mode without the reduction for reference comparisons only; the Phase 1 CP acceptance test uses that mode. Recorded in `docs/decisions.md` and `docs/known-limitations.md`.

## Checks not done here

- R2 to R5 were not hand-checked. Their component masses are in `components/`, computed by OpenRocket from the same densities, and can be checked the same way when needed; the ogive, Haack and transition volumes need the integrals in Niskanen's Appendix A rather than closed forms.
- No flight values were hand-checked; Phase 2 compares them against the simulator.
