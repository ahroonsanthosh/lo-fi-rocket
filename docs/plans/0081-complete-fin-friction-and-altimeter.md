# Plan 0081: the complete DATCOM fin friction, and comparing flights with what the altimeter read

## 1. Why

The owner (2026-10-15), asked to keep or revert the fin friction at the fin chord (D-120): "we need another solution. we can't have everything inaccurate".

Two findings answer it.

1. **Step 2 took half of a method.** The DATCOM's wing-body zero-lift drag, eq. 4.3.3.1-a, uses the fin chord's Reynolds number together with three factors:
   - the thickness bracket 1 + L(t/c) + 100(t/c)⁴;
   - the lifting-surface factor R_LS (figure 4.1.5.1-28b): about 1.07 for an unswept fin at low Mach, 0.81 for one swept 60°;
   - the wing-body factor R_WB (figure 4.3.3.1-37), on the fin and the body friction alike: about 1.05 for a model rocket at Mach 0.25, below 1 near Mach 0.8.

   Step 2 took the Reynolds number alone. The one free-flight model it over-predicted, NACA RM L8A05, has fins swept 60° with an airfoil section, where R_LS and the bracket lower the friction.

2. **The flights were compared with the wrong number.** All 13 flights below Mach 0.95 were measured with barometric altimeters. A barometric altimeter converts pressure to height with the standard atmosphere: the 1976 standard names "pressure altimeter calibrations" as its first typical use (U.S. Standard Atmosphere 1976, foreword p. xiv, quoting the WMO definition). The flights were on days of 62 to 100 °F at 2300 to 3900 ft, against a standard 45 to 51 °F there. On a 100 °F day the air column between the pad and the apogee is about 10 % taller than the standard day's for the same pressure drop, so the altimeter reads about 10 % below the true height. The simulator gives the true height on that day: the importer applies each file's temperature (ATM-11).

## 2. What the prototype measured

A prototype read both figures once, by eye, to see whether the work was worth doing. The last row of the table is part A's measured result, with the charts digitised twice.

| Displayed mode                                             | Held-out C_D rms: subsonic (target 7 %) | transonic | supersonic | 13 flights below Mach 0.95, mean |
| ---------------------------------------------------------- | --------------------------------------- | --------- | ---------- | -------------------------------- |
| Before step 2 (D-115)                                      | 6.1 %                                   | 21.2 %    | 14.9 %     | +16.4 %                          |
| Step 2 alone (fin chord Reynolds)                          | 8.2 %                                   | 20.2 %    | 15.6 %     | +13.2 %                          |
| Eq. 4.3.3.1-a complete (prototype)                         | about 6.6 %                             | 20.2 %    | 15.4 %     | about +12.5 %                    |
| Eq. 4.3.3.1-a complete, two-pass charts (part A, measured) | 6.7 % (met)                             | 20.3 %    | 15.4 %     | +12.4 %                          |
| The same, against the barometric reading                   |                                         |           |            | about +5.5 %                     |

- **Datasets.** With the complete method, the mean C_D error improves on five of the six held-out datasets: RM-10 free flight, TN D-3182 model A, TM X-1661, Blue Scout and L8A05. The sixth, the RM-10 tunnel model, is already over-predicted above Mach 1.4 (+5 %, from its wave drag), and the higher friction takes it to about +10 %. That keeps the supersonic rms about 0.5 points above D-115's. Step 6 of plan 0080 (transonic and supersonic drag) is where it belongs.
- **The barometric comparison, flight by flight** (step 2 alone, exact): from −6.3 to +18.3 %; median +7.5 %; rms 8.5 %.

## 3. Part A: eq. 4.3.3.1-a complete (pull request #112, retitled)

- **The fins' friction.** Each fin set: C_f at its mean aerodynamic chord's Reynolds number (DRAG-24, as now) × [1 + L(t/c) + 100(t/c)⁴] × R_LS(M, cos Λ_(t/c)max) × S_wet/S_ref. The bracket replaces Niskanen's 1 + 2t/c.
- **The body's friction.** C_f × the DATCOM form factor (D-115) × S_S/S_ref, as now.
- **R_WB** multiplies both, at the body's Reynolds number on its length (section 4.3.3.1 A).
- **Where L and the sweep line come from**, by cross-section (the DATCOM: L = 2 when the maximum thickness lies ahead of 0.3c, else 1.2; Λ is the sweep of the maximum-thickness line):

  | Cross-section   | x_t at | L   | Λ_(t/c)max            |
  | --------------- | ------ | --- | --------------------- |
  | square, rounded | 0      | 2   | the leading edge's    |
  | airfoil         | 0.3c   | 1.2 | the 30 %-chord line's |
  | double wedge    | 0.5c   | 1.2 | the mid-chord line's  |
  | wedge           | c      | 1.2 | the trailing edge's   |

  A free-form or elliptical fin uses its equivalent trapezoid (D-087).

- **Mach range.** Both charts end at Mach 0.9. Above it, the DATCOM's transonic method adds the isolated components without R_WB, and the wing friction carries no R_LS (eqs. 4.3.3.1-c and 4.1.5.1-c). The factors are faired linearly to 1 between Mach 0.9 and 1.0. The fairing is not from the DATCOM: it is listed, with its effect, as D-069's base drag fairing is.
- **Where the charts are left, the result says so.** As for the other charts' limits and fairings (the base drag's included), each case is named in the flight's technical notes (issue #19) and in `docs/known-limitations.md`:
  - **R_WB below a body Reynolds number of about 2.5 × 10⁶, or below Mach 0.25.** Both are outside the correlation ("the correlation does not include data below M = 0.25"). The chart's edge value is held. Model rockets often fly there.
  - **R_LS for square-edged flat plates.** The solid curves come from round-nosed airfoil wings.
  - **The fairing** above Mach 0.9.
- **The bracket's 100(t/c)⁴ term** is the wing's pressure drag in the DATCOM. At t/c = 0.05 it is 6 × 10⁻⁴ of the friction, so it does not double-count Niskanen's separate fin pressure terms in any way that matters. It is kept, as the equation writes it.
- **Digitising.** Figures 4.1.5.1-28b and 4.3.3.1-37 are digitised twice, by pixel and by eye, as earlier DATCOM charts were (`reference/digitised/`). Each check is the sample problem's own readings:
  - figure 4.1.5.1-28b: R_LS 0.934 at cos Λ 0.664 and 1.067 at 0.9505 (p. 4.1.5.1-3), and the nine values of the wing-body-tail sample (p. 4.5.3.1-5);
  - figure 4.3.3.1-37: R_WB 1.028, 0.988 and 0.963 at Mach 0.4, 0.6 and 0.7 for 6.68 × 10⁶ (p. 4.5.3.1-5), and 0.955 (p. 4.3.3.1-6).
- **Modes.** The OpenRocket-equivalent mode keeps Niskanen's eq. (3.85) whole.
- **Tests.**
  - Hand calculations: the DATCOM's sample problem 4.1.5.1, both panels, C_D0 0.00834.
  - The bracket for each cross-section.
  - R_LS and R_WB at the sample readings within the digitising tolerance.
  - The fairing's ends.
  - Property tests: the factors are positive and finite for any input; a fin set's friction does not depend on its position.
- **D-120 is rewritten.** It records that the Reynolds number alone was measured and superseded by the complete method.

## 4. Part B: compare like with like (next pull request)

- **The benchmark.**
  - A flight measured barometrically is compared with the barometric reading of the predicted flight. The altimeter's reading is the standard atmosphere's height of the pressure at apogee, minus that of the pressure on the pad, with both pressures from the day's atmosphere.
  - GPS, optical tracking and accelerometer flights stay compared with the true height.
  - The report lists both figures for every flight.
- **What the user sees.**
  - The apogee stays the true height.
  - When the day is not standard, a second line reads: "A barometric altimeter will read about X (it assumes a standard day)". The reason is in one sentence: users compare the simulator with their altimeter.
  - The MCP report adds the same field.
- **The flight-based range (D-119)** is re-based. Each flight's ratio compares like with like, so the range applies to the true apogee and to the barometric reading alike.
- **Uncertainty, stated with it.**
  - The day's atmosphere is modelled as the site's temperature offset carried up with the standard lapse rate (Niskanen §4.1.1, ATM-11). A desert afternoon's offset shrinks with height, so both the simulated density and the predicted reading carry that uncertainty.
  - Altimeters themselves differ. On the Kinsel flight two barometric altimeters read 42 231 and 40 113 ft: 5 % apart, and 1.3 % and 6.2 % below GPS. That flight is far above the layer the model covers, so it is supporting evidence, not a test.
- **Tests.**
  - A standard day: the reading equals the true height within the geopotential difference.
  - A hand calculation for a 100 °F day at 2750 ft.
  - Property tests: hotter is never higher on the altimeter for the same true height, and the reading is monotonic in true height.

**Part B's result (D-121).** Compared as each instrument reads it, the 13 flights below Mach 0.95 are +5.3 % mean, +6.3 % median and 7.7 % rms (from +12.4, +11.5 and 13.7 % against the true apogee). The OpenRocket-equivalent mode, on the same basis, is +2.1 %, +1.8 % and 6.2 %: the difference between the modes is the next thing to trace.

## 5. What follows, and what will not close the gap

- **Rail buttons and guides (plan 0080 step 4).** NACA TM 1299 measures a hexagonal nut with washer, the closest shape to a rail button, at C_w ≈ 0.65 on the mean dynamic pressure over its height. Partly inside the boundary layer, that is about 0.4 to 0.5 on the free stream: below the current rail pin (about 0.87) and far below RASAero's 2.6. The measured value will lower the drag and raise the flight error by a point or two. It is still adopted, because it is measured. A boundary-layer thickness source is needed first; one will be proposed then.
- **The residual.** After parts A and B the 13 flights are expected near +5 to +7 % against the barometric reading, not the ±3 % target. The candidates for the rest:
  - **Fin-body junction drag.** Hoerner's _Fluid-Dynamic Drag_, chapter 8, is approved (source 4) but not in `reference/`. The owner is asked whether a copy can be supplied.
  - **The day's wind.** Most files record none; weathercocking into a real wind lowers the apogee.
  - **Motor-to-motor variation.**
- **RASAero II.** If RASAero takes the site temperature into its atmosphere, its +0.4 % against barometric altimeters means its drag is about 6 % high, and its rail guide rule reads as a compensation. One rerun of a file at another temperature settles whether it does. That is recorded in the RASAero report, as evidence and not inference.
