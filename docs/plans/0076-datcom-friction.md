# Plan 0076: skin friction by the DATCOM's reference lengths in the displayed mode

## 1. Why

Plan 0075 (D-114) compared our drag with RASAero II's term by term, on 24 designs, 21 of them with measured apogees. Our displayed apogee was above the measured one on every flight: +18.9 % on average below Mach 0.95 and +29.0 % above.

Two of the causes have a method in an approved source in `reference/` that differs from the one we use (`docs/reports/rasaero-comparison.md` sections 4.1 and 4.3):

- **Fin friction's Reynolds number.** Niskanen takes one skin friction coefficient for the whole rocket, at "the rocket's Reynolds number" (p. 43, eqs. 3.78 and 3.85). The DATCOM computes a lifting surface's friction at the Reynolds number of its own reference length, "for a wing (or wing panel ...) the length of the mean aerodynamic chord" (section 4.1.5.1, eq. 4.1.5.1-a). A fin's boundary layer starts at its own leading edge, so its chord is the length that governs it.
- **Body form factor.** Niskanen's eq. (3.85) multiplies the body's friction by 1 + 1/(2 f_B). The DATCOM's eq. 4.2.3.1-a multiplies it by 1 + 60/(l/d)³ + 0.0025 (l/d), with C_f at the body length's Reynolds number, as ours.

The owner asked to "fix any obvious gaps" and accepts differing from OpenRocket and RASAero where we are more accurate, with the reasoning (2026-10-14). D-069 is the precedent: the DATCOM's base drag became the displayed mode's default on measured evidence, with Niskanen's kept in the OpenRocket-equivalent mode and the conflict recorded for the owner.

## 2. What changes

- **Two drag inputs and simulation options:**
  - **`bodyFormFactor`:** `'niskanen'` (eq. 3.85 as now, bit-identical) or `'datcom'` (1 + 60/f_B³ + 0.0025 f_B, with C_fc unchanged; DRAG-25).
  - **`finFrictionLength`:** `'rocket'` (eq. 3.85 as now) or `'fin-chord'` (DRAG-24). With `'fin-chord'`, each fin set's C_fc is eqs. (3.78) to (3.84) at the Reynolds number of its own mean aerodynamic chord, Re_c = Re_L · c̄/L. The roughness's critical Reynolds number (3.79) and the roughness-limited value (3.80) are taken on c̄ as well; the DATCOM's admissible roughness is on the same reference length (figure 4.1.5.1-27). Niskanen's thickness factor (1 + 2t/c̄) is kept.
- **Not taken from the DATCOM:**
  - its lifting-surface correction R_LS (figure 4.1.5.1-28b, 1.0 to 1.07 below Mach 0.6);
  - its thickness term L′(t/c) + 100(t/c)⁴, which would need a chart digitised;
  - its skin-friction chart (figure 4.1.5.1-26), where Niskanen's eq. (3.78) is kept.

  These are recorded as limitations.

- **Modes.** Each option is adopted in the displayed mode only if it passes section 3; the OpenRocket-equivalent mode keeps Niskanen's, as OpenRocket does. The default of `dragCoefficient` follows the displayed mode, as `DEFAULT_BASE_DRAG_METHOD` does.

**Outcome (D-115).** The body form factor passed and is the displayed mode's. The fin chord failed on the held-out supersonic drag (15.0 → 15.5 % rms). It stays selectable, and adopting it is the owner's decision.

## 3. Acceptance

The change is adopted only if it is not worse on the independent measured data:

1. **The 21 flown rockets** (plan 0075's opt-in comparison): the mean apogee error below and above Mach 0.95 must fall.
2. **The held-out wind tunnel and free-flight data** (`held-out.validation.test.ts`): the C_D rms per regime must not rise beyond its v1.0 target where it met it, and must not get worse where it did not.
3. **The OpenRocket-equivalent mode** is unchanged, bit for bit (golden outputs).

## 4. Tests

- **Hand-calculated values** for the fin and body terms at a chosen Reynolds number, smooth and rough, subsonic and supersonic.
- **Property:** at zero fin chord ratio difference (c̄ = L) the two methods give the same fin friction.
- **The displayed-mode figures** that change (the example's apogee and the like) are updated, each change explained in the commit message (CLAUDE.md 7.6).

## 5. Equations

DRAG-24 (fin friction at the fin's own Reynolds number) and DRAG-25 (the DATCOM body form factor) in `docs/equations.md`.
