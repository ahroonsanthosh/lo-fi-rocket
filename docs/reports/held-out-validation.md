# Held-out validation (version 1.0, Part B baseline)

**Date:** 2026-10-15. **Status:** regenerated after plan 0081 (D-120: the DATCOM's wing-body zero-lift drag, eq. 4.3.3.1-a, for the fins: each fin set's friction at its own mean chord's Reynolds number, its thickness bracket and lifting-surface factor R_LS, and the wing-body factor R_WB on the fin and body friction; the subsonic C_D rms moves from 6.1 to 6.7 %, within its 7 % target, transonic 21.2 to 20.3 %, supersonic 14.9 to 15.4 %; the fin chord's Reynolds number alone, measured first, gave 8.2, 20.2 and 15.6 %); earlier after plan 0076 (D-115: the DATCOM body form factor, eq. 4.2.3.1-a, in place of eq. 3.85's; the subsonic C_D rms falls from 7.1 to 6.1 %, meeting the 7 % target, transonic 21.3 to 21.2 %, supersonic 15.0 to 14.9 %); earlier after plan 0072 (TN D-3182 model A's fins corrected to the drawing, span 4.95 in and a 1.37 in mean trailing edge, and its C_A compared with the forebody drag, since the report subtracts the measured base drag; before it the supersonic CP rms was 3.8 % L and the C_D rms 16.4 %); earlier after Part C item 7 (plan 0032, D-069: DATCOM body base drag; before it the held-out C_D rms was 34.7 % subsonic, 36.8 % transonic, 14.6 % supersonic), item 4 (plan 0029, D-066: wedge sections, DATCOM rounded leading edge) and item 3 (plan 0028, D-065: DATCOM fin normal force and body carry-over; before it, transonic CP rms 5.4 and supersonic 9.9 % L); the baseline before Part C is recorded in D-061 and the item 1 state in D-062. The tables are written by `packages/formats/src/held-out.validation.test.ts` (`HELD_OUT_REPORT=<path>`), which reads `reference/digitised/held-out-v1.json`. Nothing in the model was built, chosen or tuned from these data (D-061); the ARCAS CP data of D-056 are no longer independent and are reported in `wind-tunnel-validation.md` instead.

## Datasets, models and comparisons

| Report                | Model                                                                                                                                                                                   | Data                                                                                                                                                | Comparison                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| NASA TN D-1958 (1963) | Blue Scout 1/15 scale, configuration D (`BLUE_SCOUT_COMPONENTS`): 22° cone, 2.06 in body, conical step to 2.67 in, four single-wedge fins ('wedge')                                     | figure 8(a) x_cp and C_N_alpha; figure 5(c) C_A (adjusted by the report to free-stream pressure at the base); figure 5(d) C_A,b                     | CP in percent of the 57.72 in length; forebody C_A against C_D0 without the base term; C_A,b against the base term                        |
| NACA RM E50D28 (1950) | half-scale RM-10 (`RM10_COMPONENTS`): parabolic nose and boattail, four parallelogram circular-arc fins ('airfoil')                                                                     | figure 8(c) x_cp at alpha 2°; figure 8(d) C_D at alpha 0                                                                                            | CP in percent of the 73.25 in length; total C_D (the balance drag includes the base)                                                      |
| NACA TN 2944 (1953)   | the same RM-10 (73.25 in flight models)                                                                                                                                                 | figure 9(b) C_D,T and C_D,B; figure 10 Reynolds numbers                                                                                             | total C_D in free flight                                                                                                                  |
| NASA TN D-3182 (1966) | model A (`TN_D3182_MODEL_A_COMPONENTS`): parabolic-series nose κ = 0.825 fitted to the coordinate table, cylinder, four 10° wedge fins ('wedge'), span 4.95, mean trailing edge 1.37 in | figure 4(a) x_cp and C_N_alpha; figure 5(a) C_A, compared with the forebody (the report subtracts the base drag, page 2); Table II Reynolds numbers | CP in percent of the 65.9 in length; C_A against the total C_D0 (whether the report removes the base is not stated in the extracted text) |
| NASA TM X-1661 (1968) | `ARCAS_COMPONENTS` (configuration 1, ogive nose, basic fins)                                                                                                                            | figure 4 aerodynamic centre; figure 2(a) C_A                                                                                                        | CP in percent of the 40.95 in length at Mach 2.01 (counted as the boundary of the validated range); total C_D                             |
| NACA RM L8A05 (1948)  | fineness-ratio 7.87 model A (`L8A05_COMPONENTS`): parabolic nose and boattail, three circular-arc fins ('airfoil')                                                                      | figure 8(a) C_D; figure 6 Reynolds numbers                                                                                                          | total C_D in free flight                                                                                                                  |

Digitisation: two passes per series (`held-out-v1.json` records both, the pixel calibrations and the disagreement); uncertainties: CP ±0.5 % of body length (Blue Scout, X-1661), ±0.02 to 0.022 diameters (RM-10, 0.2 % of length), ±0.03 calibers (TN D-3182, 0.3 % of length); C_D ±0.01 (Blue Scout, L8A05, TN 2944 plateau), ±0.013 in the TN 2944 drag rise, ±0.005 (RM-10 tunnel), ±0.015 (X-1661 C_A, overlapping symbols), ±0.15 per radian (TN D-3182 C_N_alpha). The L8A05 pass 1 was read from a thumbnail and is superseded by the pixel pass and a by-eye check at full resolution (worst disagreement 0.004).

Regimes: subsonic below 0.8, transonic 0.8 to 1.2, supersonic 1.2 to 2.01; data above 2.01 are reported as "outside" the validated range. CP errors are predicted minus measured in percent of body length (negative = predicted CP forward of measured = conservative). Drag rise: the Mach at which C_D first exceeds its value at the start of the transonic band by a quarter of the rise to the peak in 0.8 to 1.3, applied to the measured points and to the model alike.

## Results

## Blue Scout (TN D-1958, configuration D): x_cp in percent of the 57.72 in length, C_N_alpha per degree

| Mach | regime    | measured x_cp | predicted | error | measured C_N_alpha | predicted | error |
| ---- | --------- | ------------- | --------- | ----- | ------------------ | --------- | ----- |
| 0.6  | subsonic  | 80.0          | 79.5      | -0.5  | 0.157              | 0.146     | -6 %  |
| 0.7  | subsonic  | 80.0          | 80.1      | +0.1  | 0.170              | 0.152     | -11 % |
| 0.8  | transonic | 80.6          | 81.0      | +0.4  | 0.183              | 0.159     | -13 % |
| 0.85 | transonic | 81.7          | 80.5      | -1.1  |                    | 0.165     |       |
| 0.9  | transonic | 83.1          | 80.0      | -3.1  | 0.199              | 0.171     | -14 % |
| 0.95 | transonic | 84.5          | 79.6      | -5.0  | 0.212              | 0.176     | -17 % |
| 1    | transonic | 85.5          | 79.0      | -6.4  | 0.228              | 0.180     | -21 % |
| 1.03 | transonic | 84.5          | 78.7      | -5.8  | 0.199              | 0.183     | -8 %  |

## NACA RM-10 (RM E50D28): x_cp in percent of the 73.25 in length (measured at alpha = 2 deg, in diameters ahead of the base)

| Mach | regime     | measured | predicted | error |
| ---- | ---------- | -------- | --------- | ----- |
| 1.49 | supersonic | 86.7     | 89.9      | +3.1  |
| 1.59 | supersonic | 86.4     | 89.3      | +2.9  |
| 1.78 | supersonic | 85.5     | 88.4      | +2.9  |
| 1.98 | supersonic | 84.2     | 87.8      | +3.6  |

## TN D-3182 model A: x_cp in percent of the 65.9 in length (measured in calibers from the nose), C_N_alpha per radian

| Mach | regime     | measured x_cp | predicted | error | measured C_N_alpha | predicted | error |
| ---- | ---------- | ------------- | --------- | ----- | ------------------ | --------- | ----- |
| 1.79 | supersonic | 80.5          | 77.4      | -3.1  | 12.84              | 10.68     | -17 % |
| 1.88 | supersonic | 79.7          | 76.8      | -2.8  | 12.73              | 10.51     | -18 % |
| 1.98 | supersonic | 79.7          | 76.2      | -3.5  | 11.81              | 10.32     | -13 % |
| 2    | supersonic | 79.7          | 76.0      | -3.7  | 11.45              | 10.27     | -10 % |
| 2.06 | outside    | 79.2          | 75.7      | -3.5  | 10.88              | 10.12     | -7 %  |
| 2.38 | outside    | 77.7          | 74.2      | -3.5  | 10.52              | 9.44      | -10 % |
| 2.78 | outside    | 76.1          | 71.9      | -4.2  | 9.51               | 8.60      | -10 % |
| 3.17 | outside    | 74.7          | 70.0      | -4.7  | 8.92               | 7.94      | -11 % |
| 3.47 | outside    | 75.1          | 68.7      | -6.4  | 8.64               | 7.56      | -13 % |

## TM X-1661 configuration 1 (the TN D-4013 ARCAS model) at Mach 2.01: aerodynamic centre in percent body length

| Mach | measured | predicted | error |
| ---- | -------- | --------- | ----- |
| 2.01 | 74.2     | 73.3      | -0.9  |

## Blue Scout (TN D-1958): C_A at alpha = 0 is adjusted by the report to free-stream static pressure at the base, so it is the forebody axial force (compared with our C_D0 without the base term); the measured base axial force C_A,b is compared with our base term separately

| Mach | regime    | measured forebody C_A | predicted forebody | error   | measured C_A,b | predicted base term | error (base) |
| ---- | --------- | --------------------- | ------------------ | ------- | -------------- | ------------------- | ------------ |
| 0.6  | subsonic  | 0.354                 | 0.365              | +3.2 %  | 0.154          | 0.064               | -58.2 %      |
| 0.8  | transonic | 0.426                 | 0.396              | -7.0 %  | 0.173          | 0.068               | -60.7 %      |
| 0.9  | transonic | 0.505                 | 0.437              | -13.6 % | 0.203          | 0.079               | -61.2 %      |
| 1    | transonic | 0.712                 | 0.556              | -21.9 % | 0.441          | 0.140               | -68.1 %      |
| 1.03 | transonic | 0.724                 | 0.598              | -17.4 % | 0.429          | 0.122               | -71.5 %      |

## NACA RM-10 (RM E50D28): total C_D at alpha = 0 (the balance drag includes the base; sting interference judged negligible by the report)

| Mach | regime     | Re      | measured | predicted | error   |
| ---- | ---------- | ------- | -------- | --------- | ------- |
| 1.49 | supersonic | 2.91e+7 | 0.251    | 0.290     | +15.5 % |
| 1.59 | supersonic | 2.92e+7 | 0.251    | 0.285     | +13.5 % |
| 1.78 | supersonic | 2.95e+7 | 0.251    | 0.272     | +8.4 %  |
| 1.98 | supersonic | 3.11e+7 | 0.251    | 0.261     | +4.0 %  |

## NACA RM-10 free flight (TN 2944): total C_D at alpha = 0 (base included; the report notes the flight values lie about 0.03 below the tunnel values with fins)

| Mach  | regime     | Re      | measured | predicted | error   |
| ----- | ---------- | ------- | -------- | --------- | ------- |
| 0.9   | transonic  | 2.00e+7 | 0.171    | 0.174     | +1.8 %  |
| 0.95  | transonic  | 2.13e+7 | 0.173    | 0.183     | +5.7 %  |
| 0.968 | transonic  | 2.25e+7 | 0.190    | 0.189     | -0.4 %  |
| 0.986 | transonic  | 2.37e+7 | 0.207    | 0.198     | -4.2 %  |
| 0.998 | transonic  | 2.45e+7 | 0.227    | 0.203     | -10.5 % |
| 1.01  | transonic  | 2.53e+7 | 0.248    | 0.211     | -14.8 % |
| 1.016 | transonic  | 2.57e+7 | 0.261    | 0.211     | -19.3 % |
| 1.03  | transonic  | 2.67e+7 | 0.260    | 0.204     | -21.4 % |
| 1.09  | transonic  | 3.07e+7 | 0.262    | 0.190     | -27.4 % |
| 1.15  | transonic  | 3.47e+7 | 0.254    | 0.186     | -26.7 % |
| 1.21  | supersonic | 3.87e+7 | 0.249    | 0.188     | -24.5 % |
| 1.27  | supersonic | 4.27e+7 | 0.244    | 0.205     | -16.2 % |
| 1.33  | supersonic | 4.67e+7 | 0.241    | 0.228     | -5.3 %  |
| 1.39  | supersonic | 5.07e+7 | 0.239    | 0.257     | +7.7 %  |
| 1.45  | supersonic | 5.47e+7 | 0.236    | 0.270     | +14.5 % |
| 1.51  | supersonic | 4.66e+7 | 0.234    | 0.281     | +20.3 % |
| 1.57  | supersonic | 5.02e+7 | 0.232    | 0.276     | +18.8 % |
| 1.63  | supersonic | 5.38e+7 | 0.231    | 0.270     | +17.0 % |
| 1.69  | supersonic | 5.74e+7 | 0.228    | 0.265     | +16.3 % |
| 1.81  | supersonic | 6.46e+7 | 0.225    | 0.256     | +13.8 % |
| 1.94  | supersonic | 7.24e+7 | 0.222    | 0.248     | +11.7 % |
| 2.06  | outside    | 5.67e+7 | 0.220    | 0.244     | +10.9 % |
| 2.18  | outside    | 6.25e+7 | 0.220    | 0.232     | +5.6 %  |
| 2.3   | outside    | 6.83e+7 | 0.219    | 0.222     | +1.4 %  |
| 2.42  | outside    | 7.41e+7 | 0.219    | 0.213     | -2.9 %  |
| 2.49  | outside    | 7.75e+7 | 0.219    | 0.208     | -5.2 %  |

## TN D-3182 model A: C_A at zero normal force (sting mounted; the report subtracts the measured base drag from the balance drag, page 2, so the forebody is compared and the total shown; plan 0072)

| Mach | regime     | Re      | measured | predicted forebody | error   | predicted total |
| ---- | ---------- | ------- | -------- | ------------------ | ------- | --------------- |
| 1.79 | supersonic | 2.76e+7 | 0.524    | 0.416              | -20.7 % | 0.555           |
| 1.88 | supersonic | 2.75e+7 | 0.497    | 0.399              | -19.6 % | 0.532           |
| 1.98 | supersonic | 2.69e+7 | 0.467    | 0.384              | -17.7 % | 0.510           |
| 2    | supersonic | 1.37e+7 | 0.452    | 0.394              | -12.7 % | 0.519           |
| 2.06 | outside    | 2.76e+7 | 0.450    | 0.372              | -17.3 % | 0.493           |
| 2.38 | outside    | 1.36e+7 | 0.402    | 0.346              | -14.0 % | 0.451           |
| 2.78 | outside    | 1.29e+7 | 0.349    | 0.309              | -11.4 % | 0.399           |
| 3.17 | outside    | 1.32e+7 | 0.306    | 0.280              | -8.3 %  | 0.359           |
| 3.47 | outside    | 1.36e+7 | 0.264    | 0.262              | -0.7 %  | 0.334           |

## TM X-1661 configuration 1 at Mach 2.01: C_A at alpha = 0 (ogive nose, basic fins; +-0.015 from the overlapping symbols)

| Mach | measured | predicted total | predicted forebody | error (total) |
| ---- | -------- | --------------- | ------------------ | ------------- |
| 2.01 | 0.422    | 0.370           | 0.317              | -12.4 %       |

## NACA RM L8A05 (fineness ratio 7.87, model A): total C_D in free flight (base included)

| Mach  | regime    | Re      | measured | predicted | error   |
| ----- | --------- | ------- | -------- | --------- | ------- |
| 0.624 | subsonic  | 1.73e+7 | 0.110    | 0.125     | +13.7 % |
| 0.663 | subsonic  | 1.99e+7 | 0.116    | 0.123     | +6.0 %  |
| 0.693 | subsonic  | 2.19e+7 | 0.115    | 0.122     | +5.9 %  |
| 0.718 | subsonic  | 2.35e+7 | 0.128    | 0.121     | -5.5 %  |
| 0.751 | subsonic  | 2.57e+7 | 0.126    | 0.120     | -4.5 %  |
| 0.784 | subsonic  | 2.79e+7 | 0.120    | 0.120     | -0.6 %  |
| 0.822 | transonic | 3.05e+7 | 0.116    | 0.120     | +3.0 %  |
| 0.858 | transonic | 3.29e+7 | 0.113    | 0.121     | +7.2 %  |
| 0.873 | transonic | 3.39e+7 | 0.110    | 0.122     | +10.3 % |
| 0.891 | transonic | 3.51e+7 | 0.108    | 0.123     | +13.9 % |
| 0.906 | transonic | 3.61e+7 | 0.106    | 0.125     | +17.3 % |
| 0.922 | transonic | 3.71e+7 | 0.105    | 0.127     | +21.2 % |
| 0.942 | transonic | 3.85e+7 | 0.101    | 0.132     | +30.8 % |
| 0.957 | transonic | 3.95e+7 | 0.100    | 0.138     | +38.1 % |
| 0.975 | transonic | 4.07e+7 | 0.115    | 0.150     | +30.0 % |
| 0.993 | transonic | 4.19e+7 | 0.142    | 0.163     | +15.2 % |
| 1.008 | transonic | 4.29e+7 | 0.167    | 0.176     | +5.5 %  |
| 1.026 | transonic | 4.41e+7 | 0.188    | 0.180     | -3.8 %  |
| 1.043 | transonic | 4.52e+7 | 0.203    | 0.176     | -13.4 % |
| 1.061 | transonic | 4.64e+7 | 0.214    | 0.170     | -20.6 % |
| 1.079 | transonic | 4.76e+7 | 0.223    | 0.166     | -25.5 % |
| 1.094 | transonic | 4.86e+7 | 0.227    | 0.164     | -27.8 % |
| 1.127 | transonic | 5.08e+7 | 0.234    | 0.160     | -31.4 % |
| 1.145 | transonic | 5.20e+7 | 0.236    | 0.160     | -32.2 % |
| 1.173 | transonic | 5.39e+7 | 0.241    | 0.160     | -33.6 % |

## Transonic drag rise placement (Mach at a quarter of the rise above the value at Mach 0.8, or the first point above 0.8)

| dataset                                             | measured rise Mach | predicted | difference | target 0.05 |
| --------------------------------------------------- | ------------------ | --------- | ---------- | ----------- |
| Blue Scout forebody (points at 0.8, 0.9, 1.0, 1.03) | 0.894              | 0.929     | +3.5 /100  | met         |
| RM-10 flight (TN 2944)                              | 0.972              | 0.954     | -1.8 /100  | met         |
| L8A05 model A                                       | 0.996              | 0.950     | -4.6 /100  | met         |

## Summary by Mach regime (held-out data only; CP errors in percent of body length, C_D errors relative)

| regime               | CP n | CP rms    | target | CP worst  | target | largest non-conservative | C_D n | C_D rms          | target |
| -------------------- | ---- | --------- | ------ | --------- | ------ | ------------------------ | ----- | ---------------- | ------ |
| subsonic             | 2    | 0.4 (met) | 3      | 0.5 (met) | 6      | 0.1                      | 7     | 6.7 % (met)      | 7 %    |
| transonic            | 6    | 4.3 (met) | 5      | 6.4 (met) | 8      | 0.4                      | 33    | 20.3 % (NOT MET) | 10 %   |
| supersonic           | 9    | 3.1 (met) | 4      | 3.7 (met) | 7      | 3.6                      | 20    | 15.4 % (NOT MET) | 8 %    |
| outside (above 2.01) | 5    | 4.6       |        | 6.4       |        | 0.0                      | 10    | 9.4 %            |        |

Per dataset:

- CP Blue Scout: n=8 rms 3.7 %L worst 6.4 %L mean -2.7 %L
- CP RM-10: n=4 rms 3.1 %L worst 3.6 %L mean +3.1 %L
- CP TN D-3182 A: n=9 rms 4.1 %L worst 6.4 %L mean -3.9 %L
- CP TM X-1661: n=1 rms 0.9 %L worst 0.9 %L mean -0.9 %L
- C_D Blue Scout (forebody): n=5 rms 14.3 % worst 21.9 % mean -11.3 %
- C_D RM-10 tunnel: n=4 rms 11.3 % worst 15.5 % mean +10.3 %
- C_D RM-10 flight: n=26 rms 14.8 % worst 27.4 % mean -1.3 %
- C_D TN D-3182 A: n=9 rms 14.8 % worst 20.7 % mean -13.6 %
- C_D TM X-1661: n=1 rms 12.4 % worst 12.4 % mean -12.4 %
- C_D L8A05: n=25 rms 20.2 % worst 38.1 % mean +0.8 %
