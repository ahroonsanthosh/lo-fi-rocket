# Wind tunnel validation (CLAUDE.md 6.7 item 1, plan 0021)

**Date:** 2026-10-15. **Status:** regenerated after plan 0081 (D-120: the DATCOM's wing-body friction for the fins, eq. 4.3.3.1-a) and plan 0076 (D-115, the DATCOM body form factor, not regenerated then): the ARCAS forebody C_A rms moves from 7.8 to 2.8 % subsonic, 29.1 to 25.5 % transonic and 20.2 to 15.5 % supersonic; the RM A53D02 drag with square fins from 4.0 to 0.5 % subsonic and 6.2 to 8.0 % transonic (worse; the two transonic points are over-predicted), supersonic 9.7 to 9.6 %; with wedge fins from 10.0 to 1.8 % subsonic, 1.0 to 3.9 % transonic (worse) and 14.0 to 11.5 % supersonic; earlier after Part C item 7 (plan 0032, D-069: DATCOM body base drag; the RM A53D02 free-flight drag with square fins moved from +23 % to −4 % subsonic and from +35 % to +6 % transonic), item 4 (plan 0029, D-066: ARCAS fins now 'double-wedge', the NACA fins reported as 'wedge' and 'square') and item 3 (plan 0028, D-065; before it the ARCAS supersonic CP rms was 16.95 % L, now 1.95); no constant was tuned. The ARCAS CP data were used to choose the fin interpolation (D-056) and no longer count as held out (D-061). The tables below are printed by `packages/formats/src/wind-tunnel.validation.test.ts`, which bounds the reported errors with loose upper limits only: a physics change that moves them within those limits passes, so a change to these tables is named in its commit message (CLAUDE.md 7.6) rather than caught by the test.

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
| 0.6   | subsonic   | 0.301    | 0.313              | 0.331           | +4 %  |
| 0.7   | subsonic   | 0.310    | 0.313              | 0.331           | +1 %  |
| 0.8   | transonic  | 0.325    | 0.314              | 0.334           | -3 %  |
| 0.85  | transonic  | 0.344    | 0.319              | 0.339           | -7 %  |
| 0.9   | transonic  | 0.385    | 0.327              | 0.350           | -15 % |
| 0.95  | transonic  | 0.494    | 0.362              | 0.392           | -27 % |
| 0.975 | transonic  | 0.559    | 0.388              | 0.425           | -31 % |
| 1     | transonic  | 0.657    | 0.429              | 0.474           | -35 % |
| 1.025 | transonic  | 0.692    | 0.461              | 0.498           | -33 % |
| 1.05  | transonic  | 0.692    | 0.484              | 0.507           | -30 % |
| 1.1   | transonic  | 0.675    | 0.494              | 0.507           | -27 % |
| 1.15  | transonic  | 0.642    | 0.479              | 0.490           | -25 % |
| 1.2   | transonic  | 0.600    | 0.451              | 0.462           | -25 % |
| 1.5   | supersonic | 0.500    | 0.384              | 0.454           | -23 % |
| 1.8   | supersonic | 0.440    | 0.340              | 0.399           | -23 % |
| 2.3   | supersonic | 0.345    | 0.291              | 0.337           | -16 % |
| 2.96  | supersonic | 0.275    | 0.246              | 0.282           | -11 % |
| 3.96  | supersonic | 0.205    | 0.199              | 0.226           | -3 %  |
| 4.63  | supersonic | 0.185    | 0.176              | 0.199           | -5 %  |

- subsonic: n=2 rms 2.83 % max 3.91 % mean +2.37 %
- transonic: n=11 rms 25.50 % max 34.67 % mean -23.47 %
- supersonic: n=6 rms 15.50 % max 23.27 % mean -13.28 %

### ARCAS drag breakdown (contributions to C_D0 on A_ref) at selected Mach numbers

| term                                               | M 0.6 | M 0.9 | M 1.05 | M 1.5 | M 2.96 | M 4.63 |
| -------------------------------------------------- | ----- | ----- | ------ | ----- | ------ | ------ |
| skin friction                                      | 0.256 | 0.227 | 0.236  | 0.218 | 0.159  | 0.112  |
| nose pressure (subsonic-interpolation)             | 0.002 | 0.026 | 0.148  | 0.071 | 0.044  | 0.037  |
| boat tail pressure (γ = 1.867)                     | 0.055 | 0.074 | 0.078  | 0.055 | 0.028  | 0.018  |
| fin pressure (double-wedge, LE 0.0000 + TE 0.0000) | 0.000 | 0.000 | 0.000  | 0.000 | 0.000  | 0.000  |
| fin wave drag (DATCOM transonic-chart)             | 0.000 | 0.000 | 0.021  | 0.040 | 0.016  | 0.010  |
| base (full), DATCOM 4.2.3.1                        | 0.018 | 0.023 | 0.023  | 0.070 | 0.036  | 0.023  |
| total C_D0                                         | 0.331 | 0.350 | 0.507  | 0.454 | 0.282  | 0.199  |

## NACA RM A53D02 C_D at zero lift (free flight, base included; digitisation ±0.01)

| Mach | regime     | Re      | measured | square fins | wedge fins | error (square) | error (wedge) |
| ---- | ---------- | ------- | -------- | ----------- | ---------- | -------------- | ------------- |
| 0.6  | subsonic   | 8.60e+5 | 0.358    | 0.356       | 0.352      | -1 %           | -2 %          |
| 0.91 | transonic  | 1.28e+6 | 0.363    | 0.393       | 0.380      | 8 %            | 5 %           |
| 1.04 | transonic  | 1.54e+6 | 0.536    | 0.578       | 0.551      | 8 %            | 3 %           |
| 1.3  | supersonic | 1.90e+6 | 0.512    | 0.428       | 0.400      | -16 %          | -22 %         |
| 1.47 | supersonic | 2.20e+6 | 0.492    | 0.484       | 0.455      | -2 %           | -8 %          |
| 1.53 | supersonic | 2.20e+6 | 0.492    | 0.488       | 0.459      | -1 %           | -7 %          |
| 1.45 | supersonic | 2.20e+6 | 0.474    | 0.476       | 0.448      | 0 %            | -6 %          |
| 1.46 | supersonic | 2.20e+6 | 0.458    | 0.480       | 0.451      | 5 %            | -1 %          |
| 1.56 | supersonic | 2.30e+6 | 0.455    | 0.480       | 0.451      | 6 %            | -1 %          |
| 1.58 | supersonic | 2.30e+6 | 0.443    | 0.476       | 0.447      | 7 %            | 1 %           |
| 1.94 | supersonic | 2.90e+6 | 0.447    | 0.409       | 0.379      | -8 %           | -15 %         |
| 2.09 | supersonic | 3.20e+6 | 0.423    | 0.387       | 0.356      | -8 %           | -16 %         |
| 2.32 | supersonic | 3.50e+6 | 0.390    | 0.360       | 0.329      | -8 %           | -16 %         |
| 2.56 | supersonic | 3.80e+6 | 0.378    | 0.336       | 0.304      | -11 %          | -20 %         |
| 2.89 | supersonic | 4.30e+6 | 0.322    | 0.308       | 0.276      | -4 %           | -14 %         |
| 3.3  | supersonic | 4.90e+6 | 0.296    | 0.280       | 0.247      | -5 %           | -16 %         |
| 3.99 | supersonic | 6.60e+6 | 0.241    | 0.242       | 0.209      | 1 %            | -13 %         |
| 4.02 | supersonic | 6.80e+6 | 0.217    | 0.241       | 0.207      | 11 %           | -4 %          |
| 4.58 | supersonic | 7.50e+6 | 0.207    | 0.220       | 0.186      | 6 %            | -10 %         |
| 4.59 | supersonic | 7.50e+6 | 0.193    | 0.220       | 0.186      | 14 %           | -4 %          |
| 4.67 | supersonic | 4.20e+6 | 0.187    | 0.225       | 0.191      | 20 %           | 2 %           |
| 4.75 | supersonic | 4.30e+6 | 0.191    | 0.222       | 0.188      | 16 %           | -2 %          |
| 5.34 | hypersonic | 6.70e+6 | 0.152    | 0.200       | 0.166      | 32 %           | 9 %           |
| 5.43 | hypersonic | 7.00e+6 | 0.156    | 0.198       | 0.163      | 27 %           | 5 %           |
| 5.49 | hypersonic | 7.00e+6 | 0.164    | 0.196       | 0.162      | 20 %           | -1 %          |
| 7.16 | hypersonic | 7.10e+6 | 0.163    | 0.166       | 0.132      | 2 %            | -19 %         |
| 7.22 | hypersonic | 1.50e+7 | 0.151    | 0.160       | 0.125      | 6 %            | -17 %         |
| 7.18 | hypersonic | 7.10e+6 | 0.138    | 0.166       | 0.131      | 20 %           | -5 %          |
| 10   | hypersonic | 1.59e+7 | 0.107    | 0.134       | 0.099      | 25 %           | -8 %          |
| 10   | hypersonic | 1.59e+7 | 0.097    | 0.134       | 0.099      | 38 %           | 2 %           |

- square fins:
  - subsonic: n=1 rms 0.51 % max 0.51 % mean -0.51 %
  - transonic: n=2 rms 8.03 % max 8.20 % mean +8.03 %
  - supersonic: n=19 rms 9.64 % max 20.15 % mean +1.14 %
  - hypersonic: n=8 rms 24.08 % max 37.91 % mean +21.24 %
- wedge fins:
  - subsonic: n=1 rms 1.81 % max 1.81 % mean -1.81 %
  - transonic: n=2 rms 3.89 % max 4.74 % mean +3.76 %
  - supersonic: n=19 rms 11.53 % max 21.89 % mean -9.03 %
  - hypersonic: n=8 rms 10.31 % max 19.18 % mean -4.25 %
