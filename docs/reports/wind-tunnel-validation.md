# Wind tunnel validation (CLAUDE.md 6.7 item 1, plan 0021)

**Date:** 2026-10-12. **Status:** complete for the data in `reference/`; no constant was tuned. The tables below are printed by `packages/formats/src/wind-tunnel.validation.test.ts`, which pins the reported errors as regression values (a physics change that moves them fails the test and must be explained in the commit message, CLAUDE.md 7.6).

## What was compared

| Report                                 | Model                                                                                | Data used                                                                                         | Quantity compared                                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NASA TN D-4013 (Ferris 1967)           | ARCAS half-scale short model, fins on, δ_F = 0, φ = 0, Re 9.8·10⁶/m, Mach 0.6 to 1.2 | figure 11 (x_cp and C_A,corr against Mach), figure 7(b) (C_N against α)                           | CP in percent body length; forebody axial force (the report corrects the base to free-stream pressure, so our C_D0 without its base term); C_Nα (indicative) |
| NASA TN D-4014 (Babb and Fuller 1967)  | the same model (configuration 1), Mach 1.5 to 4.63, Re 9.84·10⁶/m                    | figure 7 (x_cp against Mach), figure 5(b) (C_A, C_N against α), figure 4(a) (chamber coefficient) | CP; forebody axial force C_A − C_A,c at α ≈ 0; C_Nα (indicative)                                                                                             |
| NACA RM A53D02 (James and Carros 1953) | fin-stabilised body of fineness ratio 10, free flight, Mach 0.6 to 10                | figure 11 (C_D at zero lift, 30 rounds), Table I (Mach and Reynolds number of each round)         | total C_D0 (free flight: the base is included)                                                                                                               |

The data were digitised twice where the comparison depends on them (CP and C_A,corr of TN D-4013, CP of TN D-4014; the NACA points once by pixel and the faired curve once by eye), with the disagreement recorded in `reference/digitised/wind-tunnel-validation.json`: CP within 1.1 % of body length (transonic) and 1.5 % (supersonic), C_A,corr within 0.05 at the steepest point of the drag rise (Mach 0.95) and 0.01 elsewhere. The geometry transcriptions, with the page references and every modelling choice, are in the same file and in `packages/physics/src/validation/wind-tunnel-models.ts`. The ARCAS and NACA data are held out: nothing in the model was built or adjusted from them (D-053).

Modelling choices that limit the comparison (recorded in the data file):

- The ARCAS nose coordinate table fits Niskanen's secant ogive with κ = 0.726 to within 0.006 in; the reflexed lip (0.06 in) at the end of the boattail is not modelled.
- Both models have sharp wedge fin sections (ARCAS double wedge 0.123 in mean thickness; NACA asymmetric 20° wedge, thickness ratio 0.04). Niskanen's fin pressure drag offers rounded, square and airfoil sections only: the ARCAS fins use 'rounded', as the thesis used 'airfoil' for the same comparison (p. 89); the NACA fins are reported with both 'square' (blunt base, as built) and 'rounded'.
- Regimes: subsonic below Mach 0.8, transonic 0.8 to 1.2, supersonic 1.2 to 5, hypersonic above 5 (outside the thesis's scope, p. 16; reported for completeness).

## Results

## Fin interpolation candidates: ARCAS x_cp, percent body length, 0.8 ≤ M ≤ 1.2

| Mach | measured | linear | cubic-hermite | quadratic-subsonic |
| ---- | -------- | ------ | ------------- | ------------------ |
| 0.8  | 71.2     | 76.6   | 76.6          | 76.6               |
| 0.85 | 70.6     | 77.3   | 77.3          | 76.9               |
| 0.9  | 71.3     | 78.0   | 78.6          | 77.3               |
| 0.95 | 75.4     | 78.6   | 80.0          | 77.9               |
| 1    | 83.1     | 79.2   | 81.2          | 78.4               |
| 1.05 | 86.2     | 79.8   | 82.0          | 79.1               |
| 1.1  | 87.1     | 80.3   | 82.4          | 79.8               |
| 1.15 | 86.6     | 80.8   | 82.2          | 80.5               |
| 1.2  | 85.1     | 81.2   | 81.2          | 81.2               |

- linear: n=9 rms 5.61 %L max 6.86 %L mean -0.55 %L
- cubic-hermite: n=9 rms 5.03 %L max 7.30 %L mean +0.54 %L
- quadratic-subsonic: n=9 rms 5.69 %L max 7.36 %L mean -0.99 %L

Lowest rms: cubic-hermite; default in code: cubic-hermite.

## ARCAS x_cp, percent body length (digitisation uncertainty ±0.6 transonic, ±0.8 supersonic)

| Mach | regime     | measured | predicted | error |
| ---- | ---------- | -------- | --------- | ----- |
| 0.6  | subsonic   | 74.9     | 75.8      | +0.9  |
| 0.7  | subsonic   | 72.7     | 76.2      | +3.5  |
| 0.8  | transonic  | 71.2     | 76.6      | +5.5  |
| 0.85 | transonic  | 70.6     | 77.3      | +6.7  |
| 0.9  | transonic  | 71.3     | 78.6      | +7.3  |
| 0.95 | transonic  | 75.4     | 80.0      | +4.6  |
| 1    | transonic  | 83.1     | 81.2      | -1.9  |
| 1.05 | transonic  | 86.2     | 82.0      | -4.2  |
| 1.1  | transonic  | 87.1     | 82.4      | -4.8  |
| 1.15 | transonic  | 86.6     | 82.2      | -4.4  |
| 1.2  | transonic  | 85.1     | 81.2      | -3.9  |
| 1.5  | supersonic | 78.4     | 73.5      | -4.9  |
| 2    | supersonic | 74.1     | 63.8      | -10.3 |
| 2.5  | supersonic | 69.8     | 55.8      | -13.9 |
| 3    | supersonic | 66.2     | 48.8      | -17.3 |
| 3.5  | supersonic | 63.2     | 42.6      | -20.7 |
| 4    | supersonic | 60.2     | 36.8      | -23.3 |
| 4.63 | supersonic | 56.9     | 30.3      | -26.6 |

- subsonic: n=2 rms 2.57 %L max 3.52 %L mean +2.20 %L
- transonic: n=9 rms 5.03 %L max 7.30 %L mean +0.54 %L
- supersonic: n=7 rms 18.15 %L max 26.62 %L mean -16.73 %L

## ARCAS C_Nα per radian (single-pass secant slopes of C_N over 0 to 4° and 0 to 8°, about ±15 % each; indicative only)

| Mach | secant 0 to 4° | secant 0 to 8° | predicted | error vs 0 to 8° |
| ---- | -------------- | -------------- | --------- | ---------------- |
| 0.6  | 6.45           | 10.74          | 9.48      | -12 %            |
| 0.8  | 7.16           | 11.46          | 9.79      | -15 %            |
| 0.9  | 7.16           | 11.46          | 10.98     | -4 %             |
| 0.95 | 7.88           | 12.18          | 11.99     | -2 %             |
| 1    | 8.59           | 11.46          | 13.00     | +13 %            |
| 1.2  | 7.88           | 10.74          | 12.77     | +19 %            |
| 1.5  | 7.16           | 10.74          | 7.92      | -26 %            |
| 1.8  | 5.73           | 8.95           | 6.13      | -32 %            |
| 2.3  | 5.01           | 7.16           | 4.66      | -35 %            |
| 2.96 | 4.30           | 6.09           | 3.68      | -40 %            |
| 3.96 | 3.58           | 4.66           | 2.91      | -38 %            |
| 4.63 | 2.86           | 3.94           | 2.59      | -34 %            |

- subsonic: n=1 rms 11.73 % max 11.73 % mean -11.73 %
- transonic: n=5 rms 12.41 % max 18.90 % mean +2.41 %
- supersonic: n=6 rms 34.24 % max 39.50 % mean -33.97 %

## ARCAS forebody axial force coefficient at α ≈ 0 (sting mounted: base at free-stream pressure)

| Mach  | regime     | measured | predicted forebody | predicted total | error  |
| ----- | ---------- | -------- | ------------------ | --------------- | ------ |
| 0.6   | subsonic   | 0.301    | 0.342              | 0.412           | +14 %  |
| 0.7   | subsonic   | 0.310    | 0.371              | 0.448           | +19 %  |
| 0.8   | transonic  | 0.325    | 0.421              | 0.506           | +29 %  |
| 0.85  | transonic  | 0.344    | 0.464              | 0.554           | +35 %  |
| 0.9   | transonic  | 0.385    | 0.538              | 0.633           | +40 %  |
| 0.95  | transonic  | 0.494    | 0.549              | 0.650           | +11 %  |
| 0.975 | transonic  | 0.559    | 0.563              | 0.666           | +1 %   |
| 1     | transonic  | 0.657    | 0.590              | 0.696           | -10 %  |
| 1.025 | transonic  | 0.692    | 0.618              | 0.721           | -11 %  |
| 1.05  | transonic  | 0.692    | 0.635              | 0.736           | -8 %   |
| 1.1   | transonic  | 0.675    | 0.645              | 0.741           | -4 %   |
| 1.15  | transonic  | 0.642    | 0.632              | 0.724           | -2 %   |
| 1.2   | transonic  | 0.600    | 0.607              | 0.695           | +1 %   |
| 1.5   | supersonic | 0.500    | 0.541              | 0.611           | +8 %   |
| 1.8   | supersonic | 0.440    | 0.516              | 0.575           | +17 %  |
| 2.3   | supersonic | 0.345    | 0.484              | 0.530           | +40 %  |
| 2.96  | supersonic | 0.275    | 0.451              | 0.487           | +64 %  |
| 3.96  | supersonic | 0.205    | 0.413              | 0.440           | +102 % |
| 4.63  | supersonic | 0.185    | 0.394              | 0.417           | +113 % |

- subsonic: n=2 rms 16.76 % max 19.45 % mean +16.49 %
- transonic: n=11 rms 19.32 % max 39.69 % mean +7.46 %
- supersonic: n=6 rms 69.79 % max 113.22 % mean +57.41 %

### ARCAS drag breakdown (contributions to C_D0 on A_ref) at selected Mach numbers

| term                                          | M 0.6 | M 0.9 | M 1.05 | M 1.5 | M 2.96 | M 4.63 |
| --------------------------------------------- | ----- | ----- | ------ | ----- | ------ | ------ |
| skin friction                                 | 0.223 | 0.213 | 0.212  | 0.196 | 0.142  | 0.101  |
| nose pressure (subsonic-interpolation)        | 0.002 | 0.026 | 0.148  | 0.071 | 0.044  | 0.037  |
| boat tail pressure (γ = 1.867)                | 0.055 | 0.074 | 0.078  | 0.055 | 0.028  | 0.018  |
| fin pressure (rounded, LE 0.1534 + TE 0.0834) | 0.062 | 0.224 | 0.197  | 0.219 | 0.237  | 0.239  |
| base (full)                                   | 0.070 | 0.095 | 0.101  | 0.070 | 0.036  | 0.023  |
| total C_D0                                    | 0.412 | 0.633 | 0.736  | 0.611 | 0.487  | 0.417  |

## NACA RM A53D02 C_D at zero lift (free flight, base included; digitisation ±0.01)

| Mach | regime     | Re      | measured | square fins | rounded fins | error (square) | error (rounded) |
| ---- | ---------- | ------- | -------- | ----------- | ------------ | -------------- | --------------- |
| 0.6  | subsonic   | 8.60e+5 | 0.358    | 0.439       | 0.403        | 23 %           | 13 %            |
| 0.91 | transonic  | 1.28e+6 | 0.363    | 0.528       | 0.501        | 45 %           | 38 %            |
| 1.04 | transonic  | 1.54e+6 | 0.536    | 0.672       | 0.638        | 25 %           | 19 %            |
| 1.3  | supersonic | 1.90e+6 | 0.512    | 0.537       | 0.509        | 5 %            | -1 %            |
| 1.47 | supersonic | 2.20e+6 | 0.492    | 0.485       | 0.459        | -1 %           | -7 %            |
| 1.53 | supersonic | 2.20e+6 | 0.492    | 0.471       | 0.446        | -4 %           | -9 %            |
| 1.45 | supersonic | 2.20e+6 | 0.474    | 0.490       | 0.463        | 3 %            | -2 %            |
| 1.46 | supersonic | 2.20e+6 | 0.458    | 0.487       | 0.461        | 6 %            | 1 %             |
| 1.56 | supersonic | 2.30e+6 | 0.455    | 0.464       | 0.438        | 2 %            | -4 %            |
| 1.58 | supersonic | 2.30e+6 | 0.443    | 0.460       | 0.435        | 4 %            | -2 %            |
| 1.94 | supersonic | 2.90e+6 | 0.447    | 0.395       | 0.373        | -12 %          | -17 %           |
| 2.09 | supersonic | 3.20e+6 | 0.423    | 0.374       | 0.353        | -12 %          | -17 %           |
| 2.32 | supersonic | 3.50e+6 | 0.390    | 0.347       | 0.328        | -11 %          | -16 %           |
| 2.56 | supersonic | 3.80e+6 | 0.378    | 0.324       | 0.306        | -14 %          | -19 %           |
| 2.89 | supersonic | 4.30e+6 | 0.322    | 0.297       | 0.280        | -8 %           | -13 %           |
| 3.3  | supersonic | 4.90e+6 | 0.296    | 0.271       | 0.254        | -9 %           | -14 %           |
| 3.99 | supersonic | 6.60e+6 | 0.241    | 0.235       | 0.220        | -2 %           | -9 %            |
| 4.02 | supersonic | 6.80e+6 | 0.217    | 0.233       | 0.219        | 8 %            | 1 %             |
| 4.58 | supersonic | 7.50e+6 | 0.207    | 0.213       | 0.199        | 3 %            | -4 %            |
| 4.59 | supersonic | 7.50e+6 | 0.193    | 0.213       | 0.199        | 10 %           | 3 %             |
| 4.67 | supersonic | 4.20e+6 | 0.187    | 0.217       | 0.203        | 16 %           | 9 %             |
| 4.75 | supersonic | 4.30e+6 | 0.191    | 0.215       | 0.201        | 12 %           | 5 %             |
| 5.34 | hypersonic | 6.70e+6 | 0.152    | 0.195       | 0.181        | 28 %           | 19 %            |
| 5.43 | hypersonic | 7.00e+6 | 0.156    | 0.192       | 0.179        | 23 %           | 15 %            |
| 5.49 | hypersonic | 7.00e+6 | 0.164    | 0.191       | 0.178        | 16 %           | 8 %             |
| 7.16 | hypersonic | 7.10e+6 | 0.163    | 0.162       | 0.150        | -0 %           | -8 %            |
| 7.22 | hypersonic | 1.50e+7 | 0.151    | 0.157       | 0.145        | 4 %            | -4 %            |
| 7.18 | hypersonic | 7.10e+6 | 0.138    | 0.162       | 0.150        | 17 %           | 9 %             |
| 10   | hypersonic | 1.59e+7 | 0.107    | 0.131       | 0.120        | 23 %           | 13 %            |
| 10   | hypersonic | 1.59e+7 | 0.097    | 0.131       | 0.120        | 35 %           | 24 %            |

- square fins:
  - subsonic: n=1 rms 22.55 % max 22.55 % mean +22.55 %
  - transonic: n=2 rms 36.81 % max 45.48 % mean +35.40 %
  - supersonic: n=19 rms 8.70 % max 16.25 % mean -0.15 %
  - hypersonic: n=8 rms 21.43 % max 35.36 % mean +18.29 %
- rounded fins:
  - subsonic: n=1 rms 12.57 % max 12.57 % mean +12.57 %
  - transonic: n=2 rms 30.01 % max 37.93 % mean +28.49 %
  - supersonic: n=19 rms 10.01 % max 19.16 % mean -6.01 %
  - hypersonic: n=8 rms 13.95 % max 24.18 % mean +9.49 %

## Reading of the results by regime

**Fin transonic interpolation (D-056).** All three candidates lie within 0.7 % of body length of each other in rms; the cubic Hermite has the lowest rms (5.0 % against 5.6 and 5.7) and is the default. The residual is systematic and not an interpolation question: the measured CP moves forward by 4 % of body length between Mach 0.6 and 0.85 and then aft by 16 % between 0.85 and 1.1, while the model moves aft by 6 % over the whole band. Niskanen's own comparison with the same data (thesis Figure 6.7(a)) shows the same shape.

**Centre of pressure.** Subsonic: within 3.5 % of body length (2 points). Transonic: rms 5.0 %, worst 7.3 % at Mach 0.9. Supersonic: the model's CP moves forward much faster than the measured one (−4.9 % at Mach 1.5, −10 % at 2, −27 % at 4.63). The direction is conservative (the predicted margin is smaller than the real one), and the thesis reports the same ("at higher supersonic speeds the estimate is too pessimistic", p. 91). The cause is in the sources: the body term (BAR-2, BAR-3) is Mach independent while the fin term falls as 1/β (BAR-11), so the CP tends towards the nose; measured bodies gain normal force with Mach.

**Normal force derivative (indicative).** The single-pass secant readings are too uncertain to validate C_Nα (the curves are flat near α = 0 and concave upward; the 0 to 4° and 0 to 8° secants differ by 40 to 60 %). Against the 0 to 8° secant the model is within 19 % in the transonic band and 26 to 40 % low in the supersonic regime; the thesis found its simulated values "notably lower than the experimental values" (p. 91). No conclusion is drawn beyond the direction.

**ARCAS drag.** Subsonic: +14 to +19 %. Transonic: the predicted rise begins too early (+29 to +40 % at Mach 0.8 to 0.9), then −10 % at the peak and within 4 % from Mach 1.1 to 1.2 (rms 19 %). Supersonic: over-predicted by a factor growing from 1.1 at Mach 1.5 to 2.1 at Mach 4.63. The breakdown table shows the driver: the fin pressure drag term (rounded leading edge, eq. 3.89, 0.15 at low speed rising to 0.24) is by itself larger than the whole measured forebody coefficient above Mach 3; the real fins have sharp double-wedge sections whose wave drag is far smaller. The early transonic rise comes from the same term, whose (1 − M²)^−0.417 law rises from Mach 0.8, and from the nose rise of eq. (3.87). The boattail term (eq. 3.88, subsonic data applied at all Mach numbers) is the second contributor the thesis itself flags (p. 90).

**NACA drag (thin sharp fins, free flight).** With the 'square' section (blunt base as built): subsonic +23 % (one point at Mach 0.6, Re 0.86·10⁶ where the skin friction regime matters), transonic +25 to +45 % (the early rise again), supersonic rms 8.7 % with a mean of −0.1 % (the "bucket" of base drag between Mach 2 and 2.6 is −12 %), hypersonic +20 % mean. With 'rounded': supersonic rms 10 %, mean −6 %. For a thin sharp-finned body the supersonic drag is therefore within about 10 %; the ARCAS over-prediction is the fin section, not the body model.

## Error summary by Mach regime

| Regime                 | CP (ARCAS), rms / worst                 | Forebody C_A (ARCAS), rms / worst               | Total C_D (NACA, square fins), rms / worst |
| ---------------------- | --------------------------------------- | ----------------------------------------------- | ------------------------------------------ |
| subsonic (< 0.8)       | 2.6 / 3.5 % of body length              | 17 % / 19 % (over)                              | 23 % (one point, over)                     |
| transonic (0.8 to 1.2) | 5.0 / 7.3 % of body length              | 19 % / 40 % (early rise)                        | 37 % / 45 % (early rise)                   |
| supersonic (1.2 to 5)  | 18 / 27 % of body length (conservative) | 70 % / 113 % (over; thick rounded-section fins) | 8.7 % / 16 %                               |
| hypersonic (> 5)       | no data                                 | no data                                         | 23 % / 38 % (outside the model's scope)    |

## Consequences for users

- Subsonic flight: unchanged from the OpenRocket comparisons (`docs/reports/phase-2-acceptance.md`); the ARCAS and NACA figures confirm the drag is over- rather than under-predicted by 15 to 20 % for polished bodies with thick or blunt fins.
- Transonic flight (Mach 0.8 to 1.2): the drag rise is predicted too early, so apogee predictions for rockets that reach Mach 0.8 to 0.95 err on the low side; the CP is within 7 % of body length. Every result that enters the band carries the warning (CLAUDE.md 6.3).
- Supersonic flight: the CP prediction is conservative and increasingly so with Mach (treat a predicted margin above Mach 1.5 as a lower bound); the drag depends on the fin section: thin sharp fins are within about 10 %, thick fins with the rounded section can be over-predicted up to twofold at Mach 4 and above.

## Proposal (CLAUDE.md 6.7 item 1): USAF DATCOM as an additional source

The transonic and supersonic errors above exceed what a careful user would accept for a rocket designed to fly past Mach 1.5 (CP conservative by 10 % of body length at Mach 2 and 27 % at Mach 4.6; drag up to twofold with thick fins). The gaps are in the sources, not in their implementation: Niskanen gives no Mach dependence for the body normal force and no sharp-section fin wave drag. The public _USAF Stability and Control DATCOM_ (Hoak, D. E. et al., Air Force Flight Dynamics Laboratory, revised 1978; public domain, available from DTIC as AD-B072483 and from NTRS mirrors) contains methods for exactly these: body normal-force-curve slope at supersonic speeds (section 4.2.1.1), wing (fin) wave drag of sharp sections at supersonic speeds (section 4.1.5.1, including double-wedge sections) and transonic drag rise (section 4.1.5.1 transonic methods). Recommendation: approve DATCOM as a source for (1) the supersonic body normal force and CP and (2) the wave drag of sharp fin sections, to be implemented behind explicit section and regime options and validated against the same held-out data, which stay held out. Until then the limitations above stand and are shown as warnings.
