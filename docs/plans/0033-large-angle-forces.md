# Plan 0033: Fin and body normal force and centre of pressure from 0 to 180° (completion prompt Part C item 8)

**Status:** written and implemented 2026-10-12 under autonomous mode; D-070. Results in `docs/reports/large-angle.md`.

## Problem

The normal force model is Barrowman's with Niskanen's sin α terms (AERO-1). The fin term is linear in α, which is only valid at small angles, so a six-degree-of-freedom flight stops at 90° (D-046) and a rocket falling tail-first from apogee in still air ends its run at apogee. D-053 approved the DATCOM as the source for the large-angle forces.

## Sources (USAF DATCOM 1978, `reference/docs/usaf-datcom-1978-dtic-adb072483-pp0495-0920.pdf` and `-pp0921-1350.pdf`)

- **Body, 0 to 180°:** section 4.2.1.2 Method 3 (Jorgensen), eq. 4.2.1.2-c. The normal force is a slender-body potential term (S_b/S) sin 2α′ cos(α′/2) plus a viscous cross-flow term η c_dc (S_p/S) sin²α′, with α′ = α up to 90° and 180° − α beyond. The pitching moment is section 4.2.2.2 Method 2, eqs. 4.2.2.2-b and -c. η comes from figure 4.2.1.2-35a against body fineness ratio, and c_dc from figure 4.2.1.2-35b against the cross-flow Mach number M sin α. The method covers Mach 0 to 7. The DATCOM notes no test verification above 60° at subsonic speeds, and that it substantiates the method only for constant cross-section bodies.
- **Fins, 0 to 90°, subsonic:** section 4.1.3.3 A, eqs. 4.1.3.3-a to -f (figures 4.1.3.3-55a and -55b). These need C_Lmax and α_CLmax from section 4.1.3.4 A Method 3 for low aspect ratio, eqs. 4.1.3.4-f, -g and -h (figures 4.1.3.4-23a, -23b, -24a, -24b, -25a and -25b). The leading-edge parameter Δy is defined in section 4.1.3.2 (p. 4.1.3.2-19) as the difference of the upper-surface ordinates at 6 % and 0.15 % chord, in percent chord, at the MAC. It is computed from the section geometry, and figure 2.2.1-8 is not needed.
- **Fin centre of pressure, 0 to 90°, subsonic:** section 4.1.4.3 A Method 1, eqs. 4.1.4.3-a to -f, steps 1 to 5 (figures 4.1.4.3-21a, -21b, -22a, -22b, -23 and -24a, -24b). Step 1's zero-lift CP is the existing fin CP (BAR-10, Niskanen eqs. 3.34 to 3.36).
- **Fin-body combination:** section 4.3.1.3 Method 1, eq. 4.3.1.3-a. The wing-alone nonlinear normal force is multiplied by the linear interference factors K_W(B) + K_B(W). The body-vortex term is not implemented (it needs figures 4.3.1.3-7 to -15). The DATCOM says it "can normally be ignored for normal airplane-type wing-body combinations" but "may become sizable" for missiles, so it is listed in the limitations.

## Equations to add (`docs/equations.md`)

| id    | quantity                                                         | source                                                   |
| ----- | ---------------------------------------------------------------- | -------------------------------------------------------- |
| HA-1  | η against fineness ratio                                         | DATCOM figure 4.2.1.2-35a                                |
| HA-2  | c_dc against M sin α                                             | DATCOM figure 4.2.1.2-35b                                |
| HA-3  | Jorgensen body normal force and CP, 0 to 180°                    | DATCOM eqs. 4.2.1.2-c, 4.2.2.2-b, -c                     |
| HA-4  | C1, C2 against taper ratio                                       | DATCOM figure 4.1.3.4-24b                                |
| HA-5  | Δy of the fin section                                            | DATCOM p. 4.1.3.2-19 (definition), D-070                 |
| HA-6  | low-aspect-ratio C_Lmax, α_CLmax                                 | DATCOM eqs. 4.1.3.4-f, -g, -h; figures 23a/b, 24a, 25a/b |
| HA-7  | wing normal force 0 to 90°                                       | DATCOM eqs. 4.1.3.3-a to -f; figures 55a, 55b            |
| HA-8  | wing CP 0 to 90°                                                 | DATCOM eqs. 4.1.4.3-b to -f; figures 21a to 24b          |
| HA-9  | fin-set normal force: interference × wing-alone nonlinear        | DATCOM eq. 4.3.1.3-a (without the vortex term)           |
| HA-10 | reverse flow, 90 to 180°: α′ = 180° − α on the reversed planform | DATCOM p. 4.1.3.3-3 (sketch (a) and text), D-070         |

## Decisions to record (D-070)

1. **Two modes.** The displayed mode uses the DATCOM large-angle model (`largeAngleMethod: 'datcom'`). The OpenRocket-equivalent mode keeps the linear model and the 90° limit (`'linear'`), so the OpenRocket comparisons and the golden series are unchanged.
2. **Potential term.** Below 90° each body component keeps its validated slope (Barrowman, or DATCOM BAR-13/14 above Mach 0.8) times sin 2α cos(α/2)/2. This is the Jorgensen form, and the per-component slopes sum to Jorgensen's 2S_b/S with the combined CP ℓ_B − V_B/S_b. The DATCOM's introduction to 4.2.1.2 says "the lift-curve slope at zero angle of attack is used for the potential-flow term". Beyond 90°, eq. 4.2.1.2-c and 4.2.2.2-c are used as printed: the term is (S_b/S) sin 2α′ cos(α′/2) at x = V_B/S_b.
3. **Viscous term.** η c_dc replaces Niskanen's K = 1.1 (eq. 3.26), on the same planform areas and centroids. Fineness ratio outside 2 to 28 and M sin α beyond the chart are held at the chart ends with a warning.
4. **Fin nonlinearity.** The wing is the exposed two-panel wing of the existing DATCOM code (BAR-15). The fin set's normal force is its linear slope (interference, roll and carry-over included) times the wing's normal-force shape [sin 2α/2 + (C_Naa/C_Nα) sin α |sin α|]. This is eq. 4.3.1.3-a with the interference applied to the nonlinear wing.
5. **Mach range.** The fin charts stop at Mach 0.6. From Mach 0.6 to 1 every chart quantity is taken at Mach 0.6, with the actual C_Nα. This is the DATCOM's own transonic guidance, 4.1.3.3 B steps 1 and 2. A warning is given when α exceeds α_CLmax there. At Mach 1 and above, the existing supersonic fin model (Busemann terms) is kept below 90° and the 90° limit stays. The DATCOM's supersonic high-angle charts (4.1.3.3 C) are future work.
6. **Δy and sections.** Square edges give Δy = 0. Rounded edges are semicircles of radius t/2. 'Airfoil' is the circular arc of D-065 and double-wedge is as drawn; for both, Δy = 5.85 tan δ (DATCOM p. 4.1.3.2-19). The position of maximum thickness selects figure 23a (square, rounded) or 23b (double-wedge, circular arc). A single wedge has its maximum thickness at the trailing edge, which neither chart covers. The method is then unavailable and the fin set keeps the linear model and the 90° limit, with a warning.
7. **Chart reading.** Figure 23a and 23b carry two label sets on the same drawn lines. Where all five curves are drawn (up to X = 1.04 in 23a and 1.13 in 23b), the left labels (Δy 0 to ≥1.0) apply. Where three are drawn, the right labels apply (Δy 0.5, 1.0, ≥1.35). A Δy below the lowest drawn curve uses that curve, with a warning. ΔC_Naa below tan α/tan α_CLmax = 0.2, where the curves start, is held at the 0.2 value; it multiplies sin²α, which vanishes there. Steps 3 and 5 of 4.1.4.3 interpolate as the charts allow. Step 5 is read as linear in α.
8. **Reverse flow.** From 90 to 180° the fin is evaluated at α′ = 180° − α as the reversed wing, whose leading edge is the old trailing edge. Its sweep is tan Λ′ = (c_r − x_t − c_t)/s, and its Δy comes from the trailing-edge shape. The DATCOM uses this as its own example (sketch (a): "the same wing with a sharp leading edge (represented by the wing in reverse flow)"). A forward-swept reversed leading edge (tan Λ′ < 0) is outside the charts and is evaluated as unswept, with a warning. The carry-over CP is mirrored along the root chord.
9. **Warnings.** One warning above 60° explains that the DATCOM has no test verification there at subsonic speeds and that the tumbling or backward part of the flight is approximate. Every warning string is constant (no per-step numbers), because warnings are deduplicated per flight. The existing angle-of-attack drag warning gets the same treatment.

## Tests

- Hand values for each chart function at digitised points, interpolation midpoints and range errors.
- HA-3: R1 at 30°, 90° and 150° by hand (η, c_dc, S_b, V_B, S_p, x_c), with continuity at 90° and zero force at 0° and 180°.
- HA-4 to HA-8: the DATCOM sample problems on pp. 4.1.3.4-8 (Method 3) and 4.1.4.3-8 to -10 (Method 1) where their inputs fit, and R1's wing at 20°, 45° and 90° by hand.
- HA-9 and HA-10: continuity at 90°, C_N(180°) = 0, the sign of the moment, and properties: C_N ≥ 0 on [0, 180°] and CP within the body.
- Flight: in the displayed mode R1 to R5 ballistic in still air no longer stop at apogee. They run to landing, or to a stated limit. The OpenRocket-mode goldens are unchanged.
- Full validation rerun (held-out, wind tunnel, reference rockets, in-flight stability) to show that nothing at small angles moved beyond its tolerance.
