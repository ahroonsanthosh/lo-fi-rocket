# Plan 0072: Corrections to the measured-data validation (TN D-3182 model A; Blue Scout at angle of attack; stale limitations)

The owner asked for exhaustive testing against the sources, with every difference explained (2026-10-14). A survey of every comparison against measured NACA and NASA data found two transcription errors and several stale statements. Each finding below was checked against the report page before anything was changed (CLAUDE.md section 11).

## 1. NASA TN D-3182 model A: fin geometry and the drag basis

**Fin span.** Figure 1 (PDF page 9) dimensions model A's fin span as 4.95 in. The 0.57 in strip at the tip is "section B", removed from model B to make model C. The caption gives model C's planform area as 70.34 sq in, and Table I gives model A's as 77.66 sq in, which is 2 × (9.15 + 6.54)/2 × 4.95 exactly. The model used span 4.38, model C's, and a 45° sweep of 4.38.

**Trailing-edge thickness.** The 10° wedge is an included angle: the figure dimensions the angle between the two surfaces, and the drawn section is 0.16 of the chord thick at the trailing edge (2 tan 5° = 0.175). The blunt trailing edge is therefore 2 c tan 5° thick: 1.60 in at the root and 1.14 in at the tip, 1.37 in on average over the span. Our 'wedge' section takes the trailing edge's full thickness (D-066). The model used 0.69 in. That came from reading the 0.57 strip as the tip's thickness (6.54 tan 5° = 0.572, a coincidence) and averaging it with 0.80.

**Drag basis.** The report subtracts the measured base drag from the balance drag (page 2: the base and cavity pressure taps "were used to obtain actual base drag, which was subtracted from the balance drag"). So its C_A is a forebody axial force. The test compared it with our total because the extracted text was thought not to say so.

**Result:**

| Quantity   | Before                  | Now                                                                             |
| ---------- | ----------------------- | ------------------------------------------------------------------------------- |
| CP, rms    | 5.7 % of body length    | 4.1 %                                                                           |
| CP, mean   | −5.6 %                  | −3.9 % (conservative)                                                           |
| C_Nα, mean | −17 %                   | −12 %                                                                           |
| Drag       | −21 % against the total | −16.7 % mean against the forebody, the report's basis (rms 17.5 %, worst −23 %) |

Over all held-out data, supersonic CP rms goes from 3.8 to 3.1 % of body length, and C_D rms from 16.4 to 15.0 % up to Mach 2.01 and from 13.8 to 11.3 % above it. The remaining forebody shortfall is the wedge fins' own drag (section 3).

## 2. Blue Scout at angle of attack (D-070's comparison)

D-070 and `docs/reports/large-angle.md` quoted Blue Scout's CP as 0.75, 0.73, 0.68 and 0.62 at 0, 2, 4 and 6° (Mach 0.6) as "fins on". Those are figure 7(a), configurations B and C with the fins and protuberances off.

The fins-on configuration D is figure 7(b) (PDF page 29): about 0.805, 0.80, 0.79 and 0.77, a forward shift of about 0.03 body lengths, not 0.13. Both models move the CP further (small-angle 0.062, DATCOM 0.054). That is conservative, and the DATCOM model is the closer. D-070's stated reason ("both under-predict") was reversed. Its choice, the more forward CP for the in-flight margin, stays on the safe side and is kept.

## 3. Statements updated in `docs/known-limitations.md`

- **Supersonic CP.** "conservative by 5 to 27 %" described the state before D-064 and D-065. It is now within 1.9 % of body length rms on ARCAS and 3.1 % on the held-out data, with RM-10's +3.1 % (non-conservative) named.
- **ARCAS transonic CP, newly documented.** At Mach 0.8 to 0.9 the predicted CP is 5.5 to 6.4 % of body length aft of measured, about 1 caliber on the unsafe side. The dataset is not independent (D-056), so it was outside the targets table, but the error is real and is now stated.
- **Sharp fins.** "Not representable" predates D-066. The limitation now is that their drag is low against measurement: the ARCAS fins' own drag is 53 to 82 % low, and the X-1661 fins 56 % low. Total drag is also low just above Mach 1 on every dataset (−18 to −38 %). The effect is that the apogee is over-predicted: the rocket flies lower than shown, but an ejection delay chosen from the predicted coast may fire after apogee.
- **Blue Scout and TN D-3182 fins.** They are 'wedge', not 'square'. TN D-3182's base basis is resolved.
- **The supersonic regime warning** now quotes 15 % (was 16 %) and 17 % for thick wedge fins (was 20 %).

## 4. Not changed here (open items for the validation campaign)

- **Transonic drag rise above Mach 1** is under-predicted on every dataset. The causes are the fin wave drag (zero to Mach 1.2 for highly swept fins), the boat-tail term (zero for long boat tails) and the wedge-fin drag. Improving any of these needs a sourced method (the DATCOM transonic wing and body methods are approved but not implemented, future-work item 2).
- **Measured data in `reference/docs` not yet used.** These include TN D-4013 figures 7 to 10 (roll angles 0, 22.5 and 45° to 21°), which are the only data that can tell the two modes apart. The list is in the campaign report.

## 5. Tests

- **`held-out.validation.test.ts`.** TN D-3182 is now compared on the forebody. Its report, `docs/reports/held-out-validation.md`, is regenerated.
- **`held-out-v1.json`.** Only the geometry and basis notes changed (regenerated by `build-held-out-v1.py`).
- **Not affected.** No physics code changed. The reference rockets, golden outputs and OpenRocket comparisons are unaffected.
