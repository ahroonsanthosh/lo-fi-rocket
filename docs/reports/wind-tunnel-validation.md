# Wind tunnel validation (CLAUDE.md 6.7 item 1, plan 0021)

**Date:** 2026-10-12. **Status:** regenerated after Part C item 4 (plan 0029, D-066: ARCAS fins now 'double-wedge', the NACA fins reported as 'wedge' and 'square') and item 3 (plan 0028, D-065; before it the ARCAS supersonic CP rms was 16.95 % L, now 1.95); no constant was tuned. The ARCAS CP data were used to choose the fin interpolation (D-056) and no longer count as held out (D-061). The tables below are printed by `packages/formats/src/wind-tunnel.validation.test.ts`, which pins the reported errors as regression values (a physics change that moves them fails the test and must be explained in the commit message, CLAUDE.md 7.6).

## What was compared

| Report                                 | Model                                                                                | Data used                                                                                         | Quantity compared                                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NASA TN D-4013 (Ferris 1967)           | ARCAS half-scale short model, fins on, δ_F = 0, φ = 0, Re 9.8·10⁶/m, Mach 0.6 to 1.2 | figure 11 (x_cp and C_A,corr against Mach), figure 7(b) (C_N against α)                           | CP in percent body length; forebody axial force (the report corrects the base to free-stream pressure, so our C_D0 without its base term); C_Nα (indicative) |
| NASA TN D-4014 (Babb and Fuller 1967)  | the same model (configuration 1), Mach 1.5 to 4.63, Re 9.84·10⁶/m                    | figure 7 (x_cp against Mach), figure 5(b) (C_A, C_N against α), figure 4(a) (chamber coefficient) | CP; forebody axial force C_A − C_A,c at α ≈ 0; C_Nα (indicative)                                                                                             |
| NACA RM A53D02 (James and Carros 1953) | fin-stabilised body of fineness ratio 10, free flight, Mach 0.6 to 10                | figure 11 (C_D at zero lift, 30 rounds), Table I (Mach and Reynolds number of each round)         | total C_D0 (free flight: the base is included)                                                                                                               |

The data were digitised twice where the comparison depends on them (CP and C_A,corr of TN D-4013, CP of TN D-4014; the NACA points once by pixel and the faired curve once by eye), with the disagreement recorded in `reference/digitised/wind-tunnel-validation.json`: CP within 1.1 % of body length (transonic) and 1.5 % (supersonic), C_A,corr within 0.05 at the steepest point of the drag rise (Mach 0.95) and 0.01 elsewhere. The geometry transcriptions, with the page references and every modelling choice, are in the same file and in `packages/physics/src/validation/wind-tunnel-models.ts`. The ARCAS and NACA data are held out: nothing in the model was built or adjusted from them (D-053).

Modelling choices that limit the comparison (recorded in the data file):

- The ARCAS nose coordinate table fits Niskanen's secant ogive with κ = 0.726 to within 0.006 in; the reflexed lip (0.06 in) at the end of the boattail is not modelled.
- Both models have sharp wedge fin sections (ARCAS double wedge 0.123 in mean thickness; NACA asymmetric 20° wedge, thickness ratio 0.04). Niskanen's fin pressure drag offers rounded, square and airfoil sections only: the ARCAS fins used 'rounded' (as the thesis used 'airfoil' for the same comparison, p. 89) until D-066 added the 'double-wedge' section they now use; the NACA fins are reported with 'wedge' (since D-066) and 'square' (blunt base).
- Regimes: subsonic below Mach 0.8, transonic 0.8 to 1.2, supersonic 1.2 to 5, hypersonic above 5 (outside the thesis's scope, p. 16; reported for completeness).

## Results

## Fin interpolation candidates: ARCAS x_cp, percent body length, 0.8 ≤ M ≤ 1.2

| Mach | measured | linear | cubic-hermite | quadratic-subsonic |
| ---- | -------- | ------ | ------------- | ------------------ |
| 0.8  | 71.2     | 76.6   | 76.6          | 76.6               |
| 0.85 | 70.6     | 77.2   | 77.0          | 76.7               |
| 0.9  | 71.3     | 77.6   | 77.8          | 76.9               |
| 0.95 | 75.4     | 78.1   | 78.8          | 77.1               |
| 1    | 83.1     | 78.5   | 79.8          | 77.4               |
| 1.05 | 86.2     | 78.9   | 80.7          | 77.7               |
| 1.1  | 87.1     | 79.3   | 81.5          | 78.1               |
| 1.15 | 86.6     | 79.6   | 82.1          | 78.5               |
| 1.2  | 85.1     | 79.9   | 82.4          | 79.0               |

- linear: n=9 rms 6.08 %L max 7.87 %L mean -1.22 %L
- cubic-hermite: n=9 rms 4.98 %L max 6.45 %L mean +0.01 %L
- quadratic-subsonic: n=9 rms 6.57 %L max 9.02 %L mean -2.07 %L

Lowest rms: cubic-hermite; default in code: cubic-hermite.

## ARCAS x_cp, percent body length (digitisation uncertainty ±0.6 transonic, ±0.8 supersonic)

| Mach | regime     | measured | predicted | error |
| ---- | ---------- | -------- | --------- | ----- |
| 0.6  | subsonic   | 74.9     | 75.8      | +0.9  |
| 0.7  | subsonic   | 72.7     | 76.2      | +3.5  |
| 0.8  | transonic  | 71.2     | 76.6      | +5.5  |
| 0.85 | transonic  | 70.6     | 77.0      | +6.3  |
| 0.9  | transonic  | 71.3     | 77.8      | +6.4  |
| 0.95 | transonic  | 75.4     | 78.8      | +3.4  |
| 1    | transonic  | 83.1     | 79.8      | -3.3  |
| 1.05 | transonic  | 86.2     | 80.7      | -5.5  |
| 1.1  | transonic  | 87.1     | 81.5      | -5.6  |
| 1.15 | transonic  | 86.6     | 82.1      | -4.5  |
| 1.2  | transonic  | 85.1     | 82.4      | -2.7  |
| 1.5  | supersonic | 78.4     | 79.7      | +1.3  |
| 2    | supersonic | 74.1     | 73.4      | -0.7  |
| 2.5  | supersonic | 69.8     | 68.6      | -1.2  |
| 3    | supersonic | 66.2     | 64.5      | -1.7  |
| 3.5  | supersonic | 63.2     | 60.8      | -2.4  |
| 4    | supersonic | 60.2     | 57.9      | -2.3  |
| 4.63 | supersonic | 56.9     | 53.9      | -3.0  |

- subsonic: n=2 rms 2.57 %L max 3.52 %L mean +2.20 %L
- transonic: n=9 rms 4.98 %L max 6.45 %L mean +0.01 %L
- supersonic: n=7 rms 1.95 %L max 3.03 %L mean -1.43 %L

## ARCAS C_Nα per radian (single-pass secant slopes of C_N over 0 to 4° and 0 to 8°, about ±15 % each; indicative only)

| Mach | secant 0 to 4° | secant 0 to 8° | predicted | error vs 0 to 8° |
| ---- | -------------- | -------------- | --------- | ---------------- |
| 0.6  | 6.45           | 10.74          | 9.48      | -12 %            |
| 0.8  | 7.16           | 11.46          | 9.79      | -15 %            |
| 0.9  | 7.16           | 11.46          | 10.75     | -6 %             |
| 0.95 | 7.88           | 12.18          | 11.61     | -5 %             |
| 1    | 8.59           | 11.46          | 12.60     | +10 %            |
| 1.2  | 7.88           | 10.74          | 16.22     | +51 %            |
| 1.5  | 7.16           | 10.74          | 13.19     | +23 %            |
| 1.8  | 5.73           | 8.95           | 11.12     | +24 %            |
| 2.3  | 5.01           | 7.16           | 9.05      | +26 %            |
| 2.96 | 4.30           | 6.09           | 7.53      | +24 %            |
| 3.96 | 3.58           | 4.66           | 6.25      | +34 %            |
| 4.63 | 2.86           | 3.94           | 5.49      | +39 %            |

- subsonic: n=1 rms 11.73 % max 11.73 % mean -11.73 %
- transonic: n=5 rms 24.40 % max 51.03 % mean +7.11 %
- supersonic: n=6 rms 29.06 % max 39.37 % mean +28.40 %

## ARCAS forebody axial force coefficient at α ≈ 0 (sting mounted: base at free-stream pressure)

| Mach  | regime     | measured | predicted forebody | predicted total | error |
| ----- | ---------- | -------- | ------------------ | --------------- | ----- |
| 0.6   | subsonic   | 0.301    | 0.280              | 0.351           | -7 %  |
| 0.7   | subsonic   | 0.310    | 0.283              | 0.361           | -9 %  |
| 0.8   | transonic  | 0.325    | 0.290              | 0.376           | -11 % |
| 0.85  | transonic  | 0.344    | 0.298              | 0.389           | -13 % |
| 0.9   | transonic  | 0.385    | 0.313              | 0.408           | -19 % |
| 0.95  | transonic  | 0.494    | 0.342              | 0.443           | -31 % |
| 0.975 | transonic  | 0.559    | 0.366              | 0.469           | -35 % |
| 1     | transonic  | 0.657    | 0.405              | 0.510           | -38 % |
| 1.025 | transonic  | 0.692    | 0.437              | 0.540           | -37 % |
| 1.05  | transonic  | 0.692    | 0.460              | 0.560           | -34 % |
| 1.1   | transonic  | 0.675    | 0.470              | 0.566           | -30 % |
| 1.15  | transonic  | 0.642    | 0.455              | 0.547           | -29 % |
| 1.2   | transonic  | 0.600    | 0.427              | 0.515           | -29 % |
| 1.5   | supersonic | 0.500    | 0.361              | 0.432           | -28 % |
| 1.8   | supersonic | 0.440    | 0.319              | 0.378           | -28 % |
| 2.3   | supersonic | 0.345    | 0.272              | 0.318           | -21 % |
| 2.96  | supersonic | 0.275    | 0.230              | 0.266           | -16 % |
| 3.96  | supersonic | 0.205    | 0.186              | 0.213           | -9 %  |
| 4.63  | supersonic | 0.185    | 0.165              | 0.188           | -11 % |

- subsonic: n=2 rms 7.84 % max 8.65 % mean -7.80 %
- transonic: n=11 rms 29.14 % max 38.38 % mean -27.73 %
- supersonic: n=6 rms 20.18 % max 27.73 % mean -18.81 %

### ARCAS drag breakdown (contributions to C_D0 on A_ref) at selected Mach numbers

| term                                               | M 0.6 | M 0.9 | M 1.05 | M 1.5 | M 2.96 | M 4.63 |
| -------------------------------------------------- | ----- | ----- | ------ | ----- | ------ | ------ |
| skin friction                                      | 0.223 | 0.213 | 0.212  | 0.196 | 0.142  | 0.101  |
| nose pressure (subsonic-interpolation)             | 0.002 | 0.026 | 0.148  | 0.071 | 0.044  | 0.037  |
| boat tail pressure (γ = 1.867)                     | 0.055 | 0.074 | 0.078  | 0.055 | 0.028  | 0.018  |
| fin pressure (double-wedge, LE 0.0000 + TE 0.0000) | 0.000 | 0.000 | 0.000  | 0.000 | 0.000  | 0.000  |
| fin wave drag (DATCOM transonic-chart)             | 0.000 | 0.000 | 0.021  | 0.040 | 0.016  | 0.010  |
| base (full)                                        | 0.070 | 0.095 | 0.101  | 0.070 | 0.036  | 0.023  |
| total C_D0                                         | 0.351 | 0.408 | 0.560  | 0.432 | 0.266  | 0.188  |

## NACA RM A53D02 C_D at zero lift (free flight, base included; digitisation ±0.01)

| Mach | regime     | Re      | measured | square fins | wedge fins | error (square) | error (wedge) |
| ---- | ---------- | ------- | -------- | ----------- | ---------- | -------------- | ------------- |
| 0.6  | subsonic   | 8.60e+5 | 0.358    | 0.439       | 0.417      | 23 %           | 17 %          |
| 0.91 | transonic  | 1.28e+6 | 0.363    | 0.528       | 0.504      | 45 %           | 39 %          |
| 1.04 | transonic  | 1.54e+6 | 0.536    | 0.672       | 0.646      | 25 %           | 21 %          |
| 1.3  | supersonic | 1.90e+6 | 0.512    | 0.537       | 0.510      | 5 %            | -0 %          |
| 1.47 | supersonic | 2.20e+6 | 0.492    | 0.485       | 0.458      | -1 %           | -7 %          |
| 1.53 | supersonic | 2.20e+6 | 0.492    | 0.471       | 0.444      | -4 %           | -10 %         |
| 1.45 | supersonic | 2.20e+6 | 0.474    | 0.490       | 0.463      | 3 %            | -2 %          |
| 1.46 | supersonic | 2.20e+6 | 0.458    | 0.487       | 0.460      | 6 %            | 1 %           |
| 1.56 | supersonic | 2.30e+6 | 0.455    | 0.464       | 0.436      | 2 %            | -4 %          |
| 1.58 | supersonic | 2.30e+6 | 0.443    | 0.460       | 0.432      | 4 %            | -3 %          |
| 1.94 | supersonic | 2.90e+6 | 0.447    | 0.395       | 0.366      | -12 %          | -18 %         |
| 2.09 | supersonic | 3.20e+6 | 0.423    | 0.374       | 0.344      | -12 %          | -19 %         |
| 2.32 | supersonic | 3.50e+6 | 0.390    | 0.347       | 0.317      | -11 %          | -19 %         |
| 2.56 | supersonic | 3.80e+6 | 0.378    | 0.324       | 0.293      | -14 %          | -22 %         |
| 2.89 | supersonic | 4.30e+6 | 0.322    | 0.297       | 0.266      | -8 %           | -17 %         |
| 3.3  | supersonic | 4.90e+6 | 0.296    | 0.271       | 0.239      | -9 %           | -19 %         |
| 3.99 | supersonic | 6.60e+6 | 0.241    | 0.235       | 0.202      | -2 %           | -16 %         |
| 4.02 | supersonic | 6.80e+6 | 0.217    | 0.233       | 0.201      | 8 %            | -8 %          |
| 4.58 | supersonic | 7.50e+6 | 0.207    | 0.213       | 0.180      | 3 %            | -13 %         |
| 4.59 | supersonic | 7.50e+6 | 0.193    | 0.213       | 0.180      | 10 %           | -7 %          |
| 4.67 | supersonic | 4.20e+6 | 0.187    | 0.217       | 0.184      | 16 %           | -2 %          |
| 4.75 | supersonic | 4.30e+6 | 0.191    | 0.215       | 0.181      | 12 %           | -5 %          |
| 5.34 | hypersonic | 6.70e+6 | 0.152    | 0.195       | 0.161      | 28 %           | 6 %           |
| 5.43 | hypersonic | 7.00e+6 | 0.156    | 0.192       | 0.158      | 23 %           | 2 %           |
| 5.49 | hypersonic | 7.00e+6 | 0.164    | 0.191       | 0.157      | 16 %           | -4 %          |
| 7.16 | hypersonic | 7.10e+6 | 0.163    | 0.162       | 0.128      | -0 %           | -22 %         |
| 7.22 | hypersonic | 1.50e+7 | 0.151    | 0.157       | 0.122      | 4 %            | -19 %         |
| 7.18 | hypersonic | 7.10e+6 | 0.138    | 0.162       | 0.128      | 17 %           | -8 %          |
| 10   | hypersonic | 1.59e+7 | 0.107    | 0.131       | 0.096      | 23 %           | -10 %         |
| 10   | hypersonic | 1.59e+7 | 0.097    | 0.131       | 0.096      | 35 %           | -1 %          |

- square fins:
  - subsonic: n=1 rms 22.55 % max 22.55 % mean +22.55 %
  - transonic: n=2 rms 36.81 % max 45.48 % mean +35.40 %
  - supersonic: n=19 rms 8.70 % max 16.25 % mean -0.15 %
  - hypersonic: n=8 rms 21.43 % max 35.36 % mean +18.29 %
- wedge fins:
  - subsonic: n=1 rms 16.60 % max 16.60 % mean +16.60 %
  - transonic: n=2 rms 31.13 % max 38.91 % mean +29.74 %
  - supersonic: n=19 rms 12.43 % max 22.36 % mean -10.00 %
  - hypersonic: n=8 rms 11.37 % max 21.54 % mean -6.91 %
