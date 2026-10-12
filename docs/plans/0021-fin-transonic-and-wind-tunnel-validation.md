# Plan 0021: Transonic fin interpolation chosen against held-out data, and the wind tunnel validation (Prompt 5 step 2, part 2)

**Status:** written and implemented 2026-10-12 under autonomous mode; Prompt 5 Part B item 1, second half. Resolves D-039 under D-053 (D-056); the validation is recorded in D-057 and `docs/reports/wind-tunnel-validation.md`.
**Phase:** follow-up.

## Goal

Give the fin normal force a value across 0.8 < M < 1.2 by the candidate interpolation that best matches the held-out ARCAS data (never used to build or tune anything else), then run the wind tunnel validation of CLAUDE.md 6.7 item 1: predicted C_D and CP against the measured data of NASA TN D-4013, TN D-4014 and NACA RM A53D02, reporting the error by Mach regime.

## Sources

| ID     | Content                                                                                                                                                                                   | Source                                                                                     |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| BAR-12 | (C_Nα)₁ for 0.8 < M < 1.2: candidates joining eq. (3.40) at 0.8 and eq. (3.49) at 1.2: linear; cubic Hermite with the end slopes of both formulas; quadratic with the subsonic slope only | N09 p. 19 (interpolation required, not given), eqs. (3.40) p. 29, (3.49) p. 31; D-056      |
| none   | Validation data: x_cp and C_A,corr against Mach (TN D-4013 figure 11), x_cp (TN D-4014 figure 7), C_A and chamber coefficient (TN D-4014 figures 5(b), 4(a)), C_D (RM A53D02 figure 11)   | `reference/digitised/wind-tunnel-validation.json`, two passes where the comparison uses it |

The ARCAS and NACA models are transcribed from the reports' drawings (`geometry` in the data file, with page references) into `packages/physics/src/validation/wind-tunnel-models.ts`. Where a feature is not representable (reflexed lip, double-wedge and wedge fin sections, fin root on the boattail) the choice and its direction are recorded in the file and the report.

## Procedure

1. Implement the three candidates behind one option (`transonicFinInterpolation`) with hand-value tests and continuity tests at both ends.
2. Compute the CP of the ARCAS model at the Mach numbers of TN D-4013 for each candidate; the error against the digitised x_cp in percent body length over 0.8 to 1.2 decides (root mean square, with the maximum shown). Record the comparison and the choice in D-056; set the default.
3. Compute C_D and CP for the three models across every measured Mach number; report the signed error and the absolute error by regime (subsonic < 0.8, transonic 0.8 to 1.2, supersonic 1.2 to 5, hypersonic above 5 reported separately as outside the model's range). For the sting-mounted ARCAS the forebody drag (our C_D0 minus the base term) is compared with C_A,corr and C_A − C_A,c; for the free-flight NACA model the total C_D0.
4. Write `docs/reports/wind-tunnel-validation.md` with the tables and the digitisation uncertainties, and the limitation records. No constant is tuned.

## Tests

- Candidates: hand values at Mach 1.0 for a test fin (linear, cubic, quadratic), continuity at 0.8 and 1.2 (value for all; slope for the cubic at both ends and the quadratic at 0.8).
- The ARCAS model's geometry equals the data file's transcription (formats test reading the JSON).
- The validation test asserts the reported errors (so a physics change that moves them is flagged) and prints the tables.
