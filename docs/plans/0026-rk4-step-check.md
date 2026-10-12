# Plan 0026: RK4 step check, extended convergence, liftoff sample (owner's request during the v1.0 completion)

**Status:** written and implemented 2026-10-12 under autonomous mode; D-063.

## Request

The 3D viewer session found RK4 at a 0.01 s fixed step unstable on reference rocket R2 while 0.002 s and Dormand–Prince fly it normally. (1) Explain why the Phase 2 convergence check missed it and extend the check to every integrator and step the app allows for every reference rocket; (2) find the cause from sources; (3) add a safeguard so an unstable run is never shown as a result, with a derived safe step; (4) record a sample at liftoff.

## Findings

- The Phase 2 check (`simulate.r1.test.ts`) flew only R1, in still air, and compared apogees. R1's roll damping rate is 110 s⁻¹ at most (safe step 0.025 s), so 0.01 s is stable for it, and in still air the roll and pitch modes are never excited, so a latent instability leaves the apogee untouched (R2 in still air at 0.01 s gives the right apogee until round-off excites the roll mode; at 0.02 s it diverges after 1.4 s). The check had no case with the stiff mode excited.
- Cause: the roll damping moment of AERO-5 (Niskanen eq. 3.69, C_r ω_x with C_r ∝ q Σ/v₀) acting on a small roll inertia gives a linear decay rate λ = C_r/I_rot that reaches 330 s⁻¹ on R2 at maximum dynamic pressure (54 mm body, 0.35 kg, I_rot 1.4·10⁻⁴ kg·m²). Applying the thesis's RK4 equations (4.20) to (4.21) to y′ = λy gives the growth factor R(hλ) = 1 + z + z²/2 + z³/6 + z⁴/24, which exceeds 1 for hλ < −2.7853: at h = 0.01 s, hλ = −3.3 and R = 2.1, the factor of two per step seen in the viewer session's run; at 0.005 s, hλ = −1.65 and R = 0.42. The pitch natural frequency ω_n = √(q A_ref C_Nα (X_CP − X_CG)/I_long) is 88 rad/s on R2 (hω_n = 0.88 at 0.01 s, inside the 2√2 limit on the imaginary axis), so the pitch mode is not the cause on R2; it is the limit on R5 (125 rad/s) at 0.02 s, where the step angle 2.5 rad would damp the oscillation numerically by more than 100 % per step.

## Safeguard (DYN-16, DYN-17)

Before every RK4 step the simulator linearises the roll, pitch and drag dynamics at the current state from the model's own laws (`LinearisedRates`), finds the largest step for which every eigenvalue lies inside the RK4 stability region (|R(hλ)| ≤ 1, by bisection on the stability polynomial), applies a factor 0.9 for the change of the rates within the step, and stops with `IntegrationUnstableError` naming the mode, the rate and the safe step when the user's step exceeds it. The pitch oscillation's numerical amplitude loss per step 1 − |R(i h ω_n)| stops the run above 10 % and attaches a warning above 1 %. The result carries `stepCheck` (the smallest safe step met, when, which mode, the largest step angle). The app labels fixed-step RK4 as advanced and shows the error with the suggested step; Dormand–Prince stays the default.

## Files

`packages/physics/src/flight/integrators.ts` (stability function, stable step, limits), `simulate.ts` (rates, check, liftoff sample, `stepCheck`), `aerodynamics.ts` (damping coefficients in the result), `errors.ts`; `packages/formats/src/simulate.step-check.test.ts` (hand values, R2 stop and recovery, every event sampled, the extended table); `packages/app/src/components/LaunchEditor.tsx`; `docs/reports/rk4-step-check.md`; `docs/equations.md` DYN-16, DYN-17; D-063; `docs/known-limitations.md`.
