# Plan 0022: Supersonic roll damping, the R5 reference comparison and the regime warnings (Prompt 5 step 3)

**Status:** written and implemented 2026-10-12 under autonomous mode; Prompt 5 Part B items 2 and 3. R5 within every tolerance (`docs/reports/phase-2-acceptance.md` section 7).
**Phase:** follow-up.

## Goal

Let a rolling rocket fly through the transonic band and beyond (the last `NotImplementedError` on R5's path), rerun R5 against `reference/rockets/values.csv` with the Phase 2 tolerances (apogee 5 %, maximum velocity 3 %) and report, and make every result that enters the transonic or supersonic regime carry a warning naming the validation status of `docs/reports/wind-tunnel-validation.md`.

## Sources

| ID     | Content                                                                                                                                                                                                                                                        | Source                                                                                     |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| AERO-6 | Supersonic roll damping: C_ld = N/(A_ref d) Σ C_Pi c_i ξ_i Δξ_i with C_Pi = K₁η_i + K₂η_i² + K₃η_i³ (3.41), η_i = ωξ_i/v₀ (3.62); the strip sum integrated exactly for a trapezoid: Σ = K₁(ω/v₀) I₂ + K₂(ω/v₀)² I₃ + K₃(ω/v₀)³ I₄, I_n = ∫₀ˢ c(y)(r_t + y)ⁿ dy | N09 eqs. (3.72) p. 39, (3.41) to (3.44) p. 30, (3.62) p. 37; I₂ equals the thesis's (3.70) |
| AERO-7 | Roll damping in 0.8 < M < 1.2: linear in Mach between the subsonic moment (3.69) at 0.8 and the supersonic moment (3.72) at 1.2, both at the current ω, v₀ and q                                                                                               | convention, D-058 (the thesis gives no transonic form; no data to choose a better one)     |

## Steps

1. AERO-6 and AERO-7 in `rollDampingMoment` with hand-value tests (I₂ against (3.70); the moment at Mach 2; the band value at Mach 1.0 as the mean of the two ends).
2. Regime warnings: the transonic warning without the Mach number (so the flight's warning set stays one line), a supersonic warning above Mach 1.2 naming the validation status, both in the drag and in the aerodynamics; `designFlightWarnings` gains a `supersonic` code; the app shows them as it shows the others. Confirmed by tests in physics, formats and the app.
3. R5 in `simulate.openrocket.test.ts` with both winds against values.csv; the R5 case in `simulate.r1.test.ts` becomes a flight. If a figure is outside tolerance, investigate before changing anything (CLAUDE.md 7.4) and report.
4. Docs: D-058, the register rows, the limitation records, `docs/reports/phase-2-acceptance.md` R5 section, progress.
