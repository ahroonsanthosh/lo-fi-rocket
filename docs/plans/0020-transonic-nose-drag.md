# Plan 0020: Transonic nose pressure drag for every nose shape from NASA TR R-100 (Prompt 5 step 2, part 1)

**Status:** written and implemented 2026-10-12 under autonomous mode; Prompt 5 Part B item 1, first half. Resolves D-034 under the owner's approval in D-053. Implementation notes: the panel (b) curve identities of both passes were swapped and corrected from the report's text (D-055); the join slope is the analytic derivative of (B.9); where the scaled data lie below the low-speed value that value is kept (D-055).
**Phase:** follow-up.

## Goal

Complete Niskanen Appendix B.3 and B.5 for the ellipsoidal, power-series, parabolic-series and Haack-series noses: the transonic and supersonic pressure drag from Stoney's measured curves at fineness ratio 3 (TR R-100 Figure 12), scaled to the nose's fineness ratio by eq. (B.9) with the blunt-cylinder value (B.2), and joined to the low-subsonic value (3.86) by the high-subsonic rise (3.87). After this step every nose shape has a drag model across all Mach regimes and R5 can be simulated once the fins are done (plan 0021).

## Sources

| ID      | Content                                                                                                                                                                               | Source                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| DRAG-15 | C₃(M): nose pressure drag coefficient at fineness ratio 3 against Mach number for the x^1/4, x^1/2, x^3/4, 1/2-, 3/4- and full-parabolic, ellipsoidal, L-V Haack and Von Kármán noses | NASA TR R-100 Figure 12 (a) and (b), p. 16, digitised twice (`reference/digitised/tr-r-100-figure-12.json`, D-055); N09 Appendix B.3 p. 108 |
| DRAG-16 | Fineness-ratio scaling: C = C₀ (C₃/C₀)^{log₄(f_N + 1)}, C₀ the blunt-cylinder value 0.85 q_stag/q (B.1, B.2)                                                                          | N09 eqs. (B.7), (B.9) pp. 108 to 110; (B.1), (B.2) pp. 106 to 107 (already DRAG-5/6)                                                        |
| DRAG-17 | Shape-parameter interpolation: for a parametrised shape whose parameter lies between two measured curves, interpolate C₃ linearly in the parameter                                    | N09 Appendix B.3 p. 108 ("interpolate the data between parameter values")                                                                   |
| DRAG-7  | High-subsonic rise a·M^b + C_{D,M=0} with a, b matched to the value and slope of the transonic curve at its lower boundary                                                            | N09 eq. (3.87) p. 54 and B.5 p. 109 (already implemented for cones and ogives; now applied with the data curve's first point)               |

Curve assignment: power series parameter n → x^1/4 (0.25), x^1/2 (0.5), x^3/4 (0.75), and the cone (1.0) by B.2; parabolic series parameter → 1/2 (0.5), 3/4 (0.75), full (1.0), and the cone (0.0) by B.2; Haack parameter → Von Kármán (0), L-V Haack (1/3); ellipsoidal has no parameter. The Von Kármán curve appears in both panels; the model uses panel (a) below Mach 2.0 and panel (b) above, where the two readings agree within the digitisation uncertainty at 2.0.

## Digitisation uncertainty (D-055)

Two independent passes (plain reading at 300 dpi; pixel transcription with a ruler at 200 dpi converted by the calibration) agree within 0.008 for every curve except the parabolic family, where the transonic rise differs by up to 0.031 (the three parabolic curves cross each other near Mach 1.05 and their styles are hard to separate there). The merged file carries both readings, the mean, the disagreement per point and an uncertainty per curve (half the worst disagreement, at least 0.005). The uncertainty is reported with the model's limitations and in the validation report.

## Conventions

- Data live in `packages/physics/src/drag/stoney-noses.ts` as frozen arrays generated from the merged JSON by `reference/digitised/merge-tr-r-100.py` output (copied, with the uncertainty), so the physics package stays free of file I/O.
- Below the first data point of a curve (0.8 for most, 1.2 for the ellipsoid and x^1/4) the high-subsonic rise (3.87) joins (3.86); above the last data point the last value is held (Stoney's curves are flat there) and a warning names it.
- Results carry a warning naming the digitised data and its uncertainty whenever a nose uses it above Mach 0.8.

## Tests

- Hand values: C₀ at Mach 1.2 from (B.1), (B.2); C₃ of the Von Kármán nose at Mach 1.2 from the table; (B.9) at f_N = 3 returns C₃ exactly and at f_N = 0 returns C₀; a hand case at f_N = 5.
- Continuity at the join (3.87 to the data) and monotonicity of the join.
- R5's Von Kármán nose no longer throws above Mach 0.8 (plan 0021 completes the fins).
- The transcribed arrays equal the merged JSON (a test reads the JSON in the formats package or a build check; here a formats test compares the physics constants with the file).
