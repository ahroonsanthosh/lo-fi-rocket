# Plan 0024: Held-out validation datasets for version 1.0 (completion prompt Part B)

**Status:** written and implemented 2026-10-12 under autonomous mode (CLAUDE.md section 11); D-061.
**Phase:** version 1.0 completion, Part B.

## Goal

1. Record that the ARCAS CP data (TN D-4013 figure 11, TN D-4014 figure 7) were used to choose the transonic fin interpolation (D-056) and are no longer independent.
2. Find at least three further published NACA/NASA datasets with CP and drag across Mach, together covering 0.5 to 2.0 and dense in 0.8 to 1.2, preferably fin-stabilised rockets like amateur rockets, and hold them out: nothing in the model is built, chosen or tuned from them.
3. Digitise them twice with the same care as TR R-100 (D-055); re-check curve identity on every digitised panel against legends and text; review the recorded uncertainties; report where the digitisation uncertainty is comparable to a v1.0 target.
4. Build the models of the configurations in `packages/physics/src/validation/held-out-models.ts` and a formats test that reports CP and C_D by Mach regime against the v1.0 targets and the drag-rise placement, writing the tables of `docs/reports/held-out-validation.md`.

## Files

- `reference/docs/`: the six reports (NTRS copies, SHA-256 in `reference/SOURCES.md` sections 16 to 21, `fetch-docs.sh`).
- `reference/digitised/build-held-out-v1.py` and `held-out-v1.json`: both passes, calibrations, geometry transcriptions, test conditions.
- `packages/physics/src/validation/held-out-models.ts`, exported from the package index.
- `packages/formats/src/held-out.validation.test.ts`; `docs/reports/held-out-validation.md`.
- `docs/decisions.md` D-061; `docs/known-limitations.md`; `docs/progress.md`.

## Datasets (all from NTRS)

| Report                | Configuration                                               | Mach         | Quantities                           |
| --------------------- | ----------------------------------------------------------- | ------------ | ------------------------------------ |
| NASA TN D-1958 (1963) | Blue Scout 1/15 scale, body + fins (configuration D)        | 0.60 to 1.03 | x_cp, C_N_alpha, forebody C_A, C_A,b |
| NACA RM E50D28 (1950) | half-scale RM-10 with four fins, 8 by 6 ft tunnel           | 1.49 to 1.98 | x_cp (alpha 2 and 4 deg), total C_D  |
| NACA TN 2944 (1953)   | 73.25 in RM-10 free-flight models                           | 0.90 to 2.49 | total and base C_D                   |
| NASA TN D-3182 (1966) | sounding rocket second stage model A, thick wedge fins      | 1.79 to 3.47 | x_cp, C_N_alpha, C_A                 |
| NASA TM X-1661 (1968) | ARCAS half-scale configuration 1 (the TN D-4013 model)      | 2.01         | aerodynamic centre, C_A              |
| NACA RM L8A05 (1948)  | fineness-ratio 7.87 parabolic body, three fins, free flight | 0.62 to 1.17 | total C_D                            |

No further transonic CP dataset with a usable geometry was found on NTRS (searches recorded in the session); the CP coverage from 1.03 to 1.2 therefore rests on the non-independent ARCAS data, which the report lists separately. NASA TM 74058 (finned projectile, Mach 0.7 to 1.2) was examined and set aside: its fins are raked 30° on pivots and the configuration is not representable.

## Tests

- `held-out.validation.test.ts`: every predicted value finite; the tables; the summary against the targets (reported, not asserted: the targets are the acceptance criteria of the completion prompt and are worked in Part C).
- `build-held-out-v1.py` is deterministic; the JSON it writes is committed and read by the test.
