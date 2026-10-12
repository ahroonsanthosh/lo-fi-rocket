# Plan 0028: Transonic and supersonic fin normal force, body carry-over and their centre of pressure from the DATCOM (completion prompt Part C item 3)

**Status:** written and implemented 2026-10-12 under autonomous mode; D-065.

## Goal

Replace Niskanen's supersonic fin term (BAR-11, eq. 3.49 with K_T(B) of eq. 3.56) by the DATCOM method for a fin pair treated as a wing on a body, check it against the current method on every validation set, and keep the better-validated one as the default.

## Sources and method

- **Fin normal force (BAR-15):** DATCOM 4.1.3.2 C (scan pp. 519 to 520). Step 1: the theoretical C_Nα of the exposed wing (two fin panels joined at the root) from figure 4.1.3.2-56 (panels (a) to (f) by taper ratio, (g) rectangular), "to be used for M ≥ 1.4; for Mach numbers less than 1.4 the transonic method of paragraph B". Step 2: near the sonic-leading-edge condition, multiply by the thickness correction of figure 4.1.3.2-60, a function of the leading-edge semiwedge angle normal to the leading edge δ⊥ (sharp-nosed sections).
- **Interference (BAR-16):** DATCOM 4.3.1.2 C (scan p. 1041), eq. 4.3.1.2-a: [K_N + K_W(B) + K_B(W)](C_Lα)_e S_e/S_W. K_W(B) from figure 4.3.1.2-10 equals 1 + d/b, the factor already used (Niskanen eq. 3.56). K_B(W), the lift carried over from the fins onto the body, which Niskanen and Barrowman leave out: slender-body theory (figure 4.3.1.2-10, K_W(B) + K_B(W) = (1 + d/b)²) when β A_e (1 + λ_e)(tan Λ_LE/β + 1) ≤ 4, otherwise figure 4.3.1.2-11a (body continues behind the fins) or 11b (it does not).
- **Carry-over position (BAR-17):** DATCOM 4.3.2.2 C step 6 (scan p. 1102): figure 4.3.2.2-37 when the parameter is ≥ 4, the slender-body result figure 4.3.2.2-36b below it. The fin panels' own CP stays Niskanen's (BAR-10): the DATCOM's figure 4.1.4.2-26 is consistent with it in the two-dimensional limit and its scan does not allow a reliable trace (recorded in the limitations).
- **Transonic:** BAR-12's fairing now runs from Niskanen's value at Mach 0.8 to the DATCOM value at Mach 1.4 (DATCOM's own start), with the end slope by forward difference; the carry-over share grows linearly over the same band. The DATCOM's transonic wing method (4.1.3.2 B) is not implemented.
- **Digitisation:** figures 4.1.3.2-56 (a, c, e, f, g), 4.1.3.2-60, 4.3.1.2-11a/b and 4.3.2.2-37 (a, b), two passes each, build scripts and JSON in `reference/digitised/`; uncertainties are in the JSON files (0.1 per rad for figure 56, 0.05 in the ordinate of figure 11, 0.01 c_r for figure 37).

## Validation (CP in % of body length, negative = conservative)

| set                     | regime     | Niskanen                                  | DATCOM                          |
| ----------------------- | ---------- | ----------------------------------------- | ------------------------------- |
| Blue Scout (held-out)   | transonic  | rms 4.7, worst −8.0                       | rms 3.5, worst −6.1             |
| RM-10 tunnel (held-out) | supersonic | rms 1.5, mean +0.5                        | rms 3.1, mean +3.1 (worst +3.6) |
| TN D-3182 A (held-out)  | supersonic | rms 15.2, worst −19.2                     | rms 5.7, worst −8.3             |
| TM X-1661 (held-out)    | Mach 2.01  | −14.2                                     | −0.9                            |
| held-out summary        | transonic  | rms 5.4 (target 5), worst 8.0             | rms 4.1, worst 6.1: met         |
| held-out summary        | supersonic | rms 9.9 (target 4), worst 14.2 (target 7) | rms 3.7, worst 5.1: met         |
| ARCAS (non-independent) | transonic  | rms 5.30                                  | rms 4.94                        |
| ARCAS                   | supersonic | rms 16.95, worst −19.8                    | rms 1.95, worst −3.0            |

The RM-10 error is aft (non-conservative) but inside the supersonic rms target, which the definition of done allows. Without the sonic-leading-edge correction it reached +5.9 % L at Mach 1.98, where the 60° leading edge is sonic; the correction is part of the DATCOM method and brings it to +3.6. With the old fairing end at Mach 1.2, against DATCOM's 1.4, the Blue Scout transonic rms was 2.3 % L and ARCAS C_Nα at Mach 1.2 was 54 % high; the DATCOM-sourced end was kept.

Total C_Nα (not a target): ARCAS +11 % to +39 % from Mach 1.0 (was −21 % supersonic), TN D-3182 −15 % to −21 % (was −41 %). The fin force is no longer understated by Niskanen's one-sided Busemann pressure (eq. 3.48 uses one surface's C_P; the DATCOM's linear theory gives β C_Nα → 4, twice Niskanen's 2/β, in the two-dimensional limit).

Reference rockets: the OpenRocket comparisons are unchanged (all subsonic or near-sonic); R5's golden series change (apogee −0.004 m with wind, none in still air).

## Files

`packages/physics/src/stability/datcom-fin.ts`, `datcom-fin-data.ts` (+ test), `barrowman.ts` (`finSetTerm` method option, `SupersonicFinMethod`, default 'datcom'), `flight/aerodynamics.ts` (carry-over as its own contribution, warnings for Mach above 2), `index.ts`; `packages/formats/src/datcom-fin.reference.test.ts`; R5 golden series; docs: equations BAR-15 to BAR-17, D-065, limitations, reports.
