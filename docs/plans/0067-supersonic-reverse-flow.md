# Plan 0067: Tumbling above Mach 1 (task 5 of plan 0055)

After plan 0066 (D-102) one refusal is left in the six-degree-of-freedom flight. In the displayed mode, a rocket whose angle of attack passes 90° at Mach 1 or above ends at the model limit, because the fin normal force there is not modelled (`SUPERSONIC_LARGE_ANGLE_ERROR`, D-070). Under rule 3 (D-083) the flight must go on, with the approximation listed.

## 1. The sourced method and why it is not this step

DATCOM section 4.1.3.3 C (pp. 4.1.3.3-29 to -33) gives the supersonic wing normal force at high angles of attack, in three procedures:

- wings with subsonic leading edges (figures 4.1.3.3-59a and -59b);
- supersonic leading edges with the shock detached at zero angle of attack (figure 4.1.3.3-63a);
- supersonic leading edges with the shock attached (figures 4.1.3.3-60a, -60b, -61a, -61b), with an angle-of-attack transition region.

Seven charts must be digitized and checked against the two sample problems (pp. 4.1.3.3-34 to -39). It covers 0 to 90° only; beyond 90° it would still need the reverse-flow extension of HA-10. It is recorded as future work. It would also replace the small-angle supersonic fin force below 90° in the displayed mode, which changes R5's results and needs its own validation.

## 2. This step: the reverse-flow extension of the present supersonic model

At Mach 1 and above the displayed mode already applies Niskanen's fin force (linear in α, eq. 3.49 with the BAR-10 CP) up to 90° (D-070). Beyond 90° the same model is applied to the reversed fin. This is the HA-10 idea, already used below Mach 1:

- α′ = 180° − α;
- the fin set's own slope (including the interference and roll factors) times α′. This is the forward slope, as in HA-10, so the normal force is continuous at 90°;
- the CP is that of the reversed planform (tan Λ′ = (c_r − x_t − c_t)/s), mirrored along the root chord; the carry-over CP is mirrored too.

The body already has a supersonic reverse-flow model (Jorgensen, eqs. 4.2.1.2-c and 4.2.2.2-c, with c_dc at the crossflow Mach number), so nothing changes there.

## 3. Where it is said

- **Listed only when used.** A flight that reaches more than 90° at Mach 1 or above lists one approximation. Subject: the rocket; what: "the fin normal force while tumbling or flying backward above Mach 1"; the method; the effect; impact major. The sourced method does not exist for this regime, and the small-angle force over-predicts the fin force near 90°, so the tumbling motion, the path and the landing point are uncertain.
- **Warnings.** The aerodynamics warning names the same thing, and becomes a flight note.
- **The model-limit end** remains in the OpenRocket-equivalent mode only (D-046).

## 3b. The D-102 listing, rated by the flight

The wedge and high-aspect-ratio listing of plan 0066 says "minor" in every flight. The app's rule for minor is "under about 1 % on the key results". That holds while the rocket stays below the fins' stall, where they keep their validated slope. It is not shown once the flight goes past the stall, where the approximated maximum lift shapes the force. The listing is therefore minor below the stall and moderate past it. The flight knows which from the chart notes, which the model gives only beyond the stall.

## 4. Files

- `packages/physics/src/flight/aerodynamics.ts`: the M ≥ 1 reverse branch (replacing the throw); the warning constant.
- `packages/physics/src/flight/simulate.ts`:
  - `beyond` stops only in the `'linear'` mode;
  - the accepted-step check records the regime;
  - the approximation is listed;
  - the supersonic model-limit message is removed.
- **Tests:**
  - **Aerodynamics:** at Mach 2 and 120° the fin force equals the forward slope × 60° at the mirrored reversed CP (hand-computed from the reversed planform's CP). It is continuous at 90° in C_N.
  - **Flight:** an unstable R1 variant on a strong constant motor tumbles above Mach 1. It now lands in the displayed mode with the approximation listed, and ends at the model limit in the OpenRocket-equivalent mode.
  - **Rating:** the wedge-finned R1 of plan 0066 lists its fins as minor over its vertical climb and moderate over the whole flight, which falls tail-first.
- **Docs:** D-103; HA-10's validity in `docs/equations.md`; the D-070 and D-046 entries in `docs/known-limitations.md`; progress.

## 5. Checks

- The golden outputs and the OpenRocket comparisons must be unchanged: no reference flight tumbles above Mach 1.
- The 40-design random test still passes.
