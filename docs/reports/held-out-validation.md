# Held-out validation (version 1.0, Part B baseline)

**Date:** 2026-10-12. **Status:** baseline before Part C; regenerated after each Part C item. The tables are written by `packages/formats/src/held-out.validation.test.ts` (`HELD_OUT_REPORT=<path>`), which reads `reference/digitised/held-out-v1.json`. Nothing in the model was built, chosen or tuned from these data (D-061); the ARCAS CP data of D-056 are no longer independent and are reported in `wind-tunnel-validation.md` instead.

## Datasets, models and comparisons

| Report                | Model                                                                                                                                                | Data                                                                                                                            | Comparison                                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| NASA TN D-1958 (1963) | Blue Scout 1/15 scale, configuration D (`BLUE_SCOUT_COMPONENTS`): 22° cone, 2.06 in body, conical step to 2.67 in, four single-wedge fins ('square') | figure 8(a) x_cp and C_N_alpha; figure 5(c) C_A (adjusted by the report to free-stream pressure at the base); figure 5(d) C_A,b | CP in percent of the 57.72 in length; forebody C_A against C_D0 without the base term; C_A,b against the base term                        |
| NACA RM E50D28 (1950) | half-scale RM-10 (`RM10_COMPONENTS`): parabolic nose and boattail, four parallelogram circular-arc fins ('airfoil')                                  | figure 8(c) x_cp at alpha 2°; figure 8(d) C_D at alpha 0                                                                        | CP in percent of the 73.25 in length; total C_D (the balance drag includes the base)                                                      |
| NACA TN 2944 (1953)   | the same RM-10 (73.25 in flight models)                                                                                                              | figure 9(b) C_D,T and C_D,B; figure 10 Reynolds numbers                                                                         | total C_D in free flight                                                                                                                  |
| NASA TN D-3182 (1966) | model A (`TN_D3182_MODEL_A_COMPONENTS`): parabolic-series nose κ = 0.825 fitted to the coordinate table, cylinder, four wedge fins ('square')        | figure 4(a) x_cp and C_N_alpha; figure 5(a) C_A; Table II Reynolds numbers                                                      | CP in percent of the 65.9 in length; C_A against the total C_D0 (whether the report removes the base is not stated in the extracted text) |
| NASA TM X-1661 (1968) | `ARCAS_COMPONENTS` (configuration 1, ogive nose, basic fins)                                                                                         | figure 4 aerodynamic centre; figure 2(a) C_A                                                                                    | CP in percent of the 40.95 in length at Mach 2.01 (counted as the boundary of the validated range); total C_D                             |
| NACA RM L8A05 (1948)  | fineness-ratio 7.87 model A (`L8A05_COMPONENTS`): parabolic nose and boattail, three circular-arc fins ('airfoil')                                   | figure 8(a) C_D; figure 6 Reynolds numbers                                                                                      | total C_D in free flight                                                                                                                  |

Digitisation: two passes per series (`held-out-v1.json` records both, the pixel calibrations and the disagreement); uncertainties: CP ±0.5 % of body length (Blue Scout, X-1661), ±0.02 to 0.022 diameters (RM-10, 0.2 % of length), ±0.03 calibers (TN D-3182, 0.3 % of length); C_D ±0.01 (Blue Scout, L8A05, TN 2944 plateau), ±0.013 in the TN 2944 drag rise, ±0.005 (RM-10 tunnel), ±0.015 (X-1661 C_A, overlapping symbols), ±0.15 per radian (TN D-3182 C_N_alpha). The L8A05 pass 1 was read from a thumbnail and is superseded by the pixel pass and a by-eye check at full resolution (worst disagreement 0.004).

Regimes: subsonic below 0.8, transonic 0.8 to 1.2, supersonic 1.2 to 2.01; data above 2.01 are reported as "outside" the validated range. CP errors are predicted minus measured in percent of body length (negative = predicted CP forward of measured = conservative). Drag rise: the Mach at which C_D first exceeds its value at the start of the transonic band by a quarter of the rise to the peak in 0.8 to 1.3, applied to the measured points and to the model alike.

## Results

## Blue Scout (TN D-1958, configuration D): x_cp in percent of the 57.72 in length, C_N_alpha per degree

| Mach | regime    | measured x_cp | predicted | error | measured C_N_alpha | predicted | error |
| ---- | --------- | ------------- | --------- | ----- | ------------------ | --------- | ----- |
| 0.6  | subsonic  | 80.0          | 79.5      | -0.5  | 0.157              | 0.146     | -6 %  |
| 0.7  | subsonic  | 80.0          | 80.1      | +0.1  | 0.170              | 0.152     | -11 % |
| 0.8  | transonic | 80.6          | 81.0      | +0.4  | 0.183              | 0.159     | -13 % |
| 0.85 | transonic | 81.7          | 81.3      | -0.3  |                    | 0.162     |       |
| 0.9  | transonic | 83.1          | 81.4      | -1.7  | 0.199              | 0.163     | -18 % |
| 0.95 | transonic | 84.5          | 81.3      | -3.2  | 0.212              | 0.161     | -24 % |
| 1    | transonic | 85.5          | 81.0      | -4.5  | 0.228              | 0.158     | -31 % |
| 1.03 | transonic | 84.5          | 80.7      | -3.9  | 0.199              | 0.154     | -22 % |

## NACA RM-10 (RM E50D28): x_cp in percent of the 73.25 in length (measured at alpha = 2 deg, in diameters ahead of the base)

| Mach | regime     | measured | predicted | error |
| ---- | ---------- | -------- | --------- | ----- |
| 1.49 | supersonic | 86.7     | 89.6      | +2.9  |
| 1.59 | supersonic | 86.4     | 88.4      | +2.0  |
| 1.78 | supersonic | 85.5     | 86.2      | +0.7  |
| 1.98 | supersonic | 84.2     | 84.0      | -0.2  |

## TN D-3182 model A: x_cp in percent of the 65.9 in length (measured in calibers from the nose), C_N_alpha per radian

| Mach | regime     | measured x_cp | predicted | error | measured C_N_alpha | predicted | error |
| ---- | ---------- | ------------- | --------- | ----- | ------------------ | --------- | ----- |
| 1.79 | supersonic | 80.5          | 72.2      | -8.4  | 12.84              | 6.61      | -49 % |
| 1.88 | supersonic | 79.7          | 71.1      | -8.6  | 12.73              | 6.29      | -51 % |
| 1.98 | supersonic | 79.7          | 70.0      | -9.7  | 11.81              | 6.00      | -49 % |
| 2    | supersonic | 79.7          | 69.8      | -9.9  | 11.45              | 5.95      | -48 % |
| 2.06 | outside    | 79.2          | 69.2      | -10.0 | 10.88              | 5.80      | -47 % |
| 2.38 | outside    | 77.7          | 66.2      | -11.5 | 10.52              | 5.17      | -51 % |
| 2.78 | outside    | 76.1          | 63.0      | -13.2 | 9.51               | 4.64      | -51 % |
| 3.17 | outside    | 74.7          | 60.3      | -14.4 | 8.92               | 4.27      | -52 % |
| 3.47 | outside    | 75.1          | 58.5      | -16.6 | 8.64               | 4.06      | -53 % |

## TM X-1661 configuration 1 (the TN D-4013 ARCAS model) at Mach 2.01: aerodynamic centre in percent body length

| Mach | measured | predicted | error |
| ---- | -------- | --------- | ----- |
| 2.01 | 74.2     | 63.6      | -10.6 |

## Blue Scout (TN D-1958): C_A at alpha = 0 is adjusted by the report to free-stream static pressure at the base, so it is the forebody axial force (compared with our C_D0 without the base term); the measured base axial force C_A,b is compared with our base term separately

| Mach | regime    | measured forebody C_A | predicted forebody | error   | measured C_A,b | predicted base term | error (base) |
| ---- | --------- | --------------------- | ------------------ | ------- | -------------- | ------------------- | ------------ |
| 0.6  | subsonic  | 0.354                 | 0.506              | +43.0 % | 0.154          | 0.167               | +8.6 %       |
| 0.8  | transonic | 0.426                 | 0.557              | +30.7 % | 0.173          | 0.203               | +17.5 %      |
| 0.9  | transonic | 0.505                 | 0.611              | +20.8 % | 0.203          | 0.225               | +11.3 %      |
| 1    | transonic | 0.712                 | 0.722              | +1.4 %  | 0.441          | 0.250               | -43.2 %      |
| 1.03 | transonic | 0.724                 | 0.760              | +4.9 %  | 0.429          | 0.243               | -43.4 %      |

## NACA RM-10 (RM E50D28): total C_D at alpha = 0 (the balance drag includes the base; sting interference judged negligible by the report)

| Mach | regime     | Re      | measured | predicted | error   |
| ---- | ---------- | ------- | -------- | --------- | ------- |
| 1.49 | supersonic | 2.91e+7 | 0.251    | 0.320     | +27.5 % |
| 1.59 | supersonic | 2.92e+7 | 0.251    | 0.315     | +25.6 % |
| 1.78 | supersonic | 2.95e+7 | 0.251    | 0.307     | +22.2 % |
| 1.98 | supersonic | 3.11e+7 | 0.251    | 0.299     | +19.3 % |

## NACA RM-10 free flight (TN 2944): total C_D at alpha = 0 (base included; the report notes the flight values lie about 0.03 below the tunnel values with fins)

| Mach  | regime     | Re      | measured | predicted | error   |
| ----- | ---------- | ------- | -------- | --------- | ------- |
| 0.9   | transonic  | 2.00e+7 | 0.171    | 0.330     | +92.8 % |
| 0.95  | transonic  | 2.13e+7 | 0.173    | 0.323     | +86.9 % |
| 0.968 | transonic  | 2.25e+7 | 0.190    | 0.322     | +69.5 % |
| 0.986 | transonic  | 2.37e+7 | 0.207    | 0.321     | +55.2 % |
| 0.998 | transonic  | 2.45e+7 | 0.227    | 0.321     | +41.5 % |
| 1.01  | transonic  | 2.53e+7 | 0.248    | 0.326     | +31.3 % |
| 1.016 | transonic  | 2.57e+7 | 0.261    | 0.326     | +25.1 % |
| 1.03  | transonic  | 2.67e+7 | 0.260    | 0.329     | +26.4 % |
| 1.09  | transonic  | 3.07e+7 | 0.262    | 0.334     | +27.6 % |
| 1.15  | transonic  | 3.47e+7 | 0.254    | 0.333     | +31.2 % |
| 1.21  | supersonic | 3.87e+7 | 0.249    | 0.331     | +32.9 % |
| 1.27  | supersonic | 4.27e+7 | 0.244    | 0.325     | +33.3 % |
| 1.33  | supersonic | 4.67e+7 | 0.241    | 0.320     | +32.9 % |
| 1.39  | supersonic | 5.07e+7 | 0.239    | 0.316     | +32.1 % |
| 1.45  | supersonic | 5.47e+7 | 0.236    | 0.311     | +32.0 % |
| 1.51  | supersonic | 4.66e+7 | 0.234    | 0.311     | +33.0 % |
| 1.57  | supersonic | 5.02e+7 | 0.232    | 0.307     | +32.4 % |
| 1.63  | supersonic | 5.38e+7 | 0.231    | 0.304     | +31.4 % |
| 1.69  | supersonic | 5.74e+7 | 0.228    | 0.300     | +31.6 % |
| 1.81  | supersonic | 6.46e+7 | 0.225    | 0.294     | +30.5 % |
| 1.94  | supersonic | 7.24e+7 | 0.222    | 0.288     | +29.9 % |
| 2.06  | outside    | 5.67e+7 | 0.220    | 0.288     | +30.9 % |
| 2.18  | outside    | 6.25e+7 | 0.220    | 0.283     | +28.5 % |
| 2.3   | outside    | 6.83e+7 | 0.219    | 0.278     | +26.9 % |
| 2.42  | outside    | 7.41e+7 | 0.219    | 0.274     | +24.9 % |
| 2.49  | outside    | 7.75e+7 | 0.219    | 0.271     | +23.8 % |

## TN D-3182 model A: C_A at zero normal force (sting mounted with base pressure taps; the extracted text does not say whether C_A is adjusted for the base, so the total is compared and the forebody shown)

| Mach | regime     | Re      | measured | predicted total | error    | predicted forebody |
| ---- | ---------- | ------- | -------- | --------------- | -------- | ------------------ |
| 1.79 | supersonic | 2.76e+7 | 0.524    | 0.645           | +23.1 %  | 0.506              |
| 1.88 | supersonic | 2.75e+7 | 0.497    | 0.637           | +28.3 %  | 0.504              |
| 1.98 | supersonic | 2.69e+7 | 0.467    | 0.630           | +34.9 %  | 0.503              |
| 2    | supersonic | 1.37e+7 | 0.452    | 0.638           | +41.4 %  | 0.513              |
| 2.06 | outside    | 2.76e+7 | 0.450    | 0.623           | +38.5 %  | 0.501              |
| 2.38 | outside    | 1.36e+7 | 0.402    | 0.610           | +51.7 %  | 0.505              |
| 2.78 | outside    | 1.29e+7 | 0.349    | 0.587           | +68.0 %  | 0.497              |
| 3.17 | outside    | 1.32e+7 | 0.306    | 0.567           | +85.4 %  | 0.488              |
| 3.47 | outside    | 1.36e+7 | 0.264    | 0.554           | +109.8 % | 0.482              |

## TM X-1661 configuration 1 at Mach 2.01: C_A at alpha = 0 (ogive nose, basic fins; +-0.015 from the overlapping symbols)

| Mach | measured | predicted total | predicted forebody | error (total) |
| ---- | -------- | --------------- | ------------------ | ------------- |
| 2.01 | 0.422    | 0.554           | 0.502              | +31.3 %       |

## NACA RM L8A05 (fineness ratio 7.87, model A): total C_D in free flight (base included)

| Mach  | regime    | Re      | measured | predicted | error    |
| ----- | --------- | ------- | -------- | --------- | -------- |
| 0.624 | subsonic  | 1.73e+7 | 0.110    | 0.171     | +54.8 %  |
| 0.663 | subsonic  | 1.99e+7 | 0.116    | 0.173     | +48.9 %  |
| 0.693 | subsonic  | 2.19e+7 | 0.115    | 0.176     | +52.5 %  |
| 0.718 | subsonic  | 2.35e+7 | 0.128    | 0.179     | +39.4 %  |
| 0.751 | subsonic  | 2.57e+7 | 0.126    | 0.183     | +45.5 %  |
| 0.784 | subsonic  | 2.79e+7 | 0.120    | 0.188     | +55.6 %  |
| 0.822 | transonic | 3.05e+7 | 0.116    | 0.195     | +67.2 %  |
| 0.858 | transonic | 3.29e+7 | 0.113    | 0.203     | +80.3 %  |
| 0.873 | transonic | 3.39e+7 | 0.110    | 0.208     | +88.4 %  |
| 0.891 | transonic | 3.51e+7 | 0.108    | 0.214     | +98.6 %  |
| 0.906 | transonic | 3.61e+7 | 0.106    | 0.218     | +105.4 % |
| 0.922 | transonic | 3.71e+7 | 0.105    | 0.219     | +108.6 % |
| 0.942 | transonic | 3.85e+7 | 0.101    | 0.221     | +118.9 % |
| 0.957 | transonic | 3.95e+7 | 0.100    | 0.224     | +123.8 % |
| 0.975 | transonic | 4.07e+7 | 0.115    | 0.229     | +98.6 %  |
| 0.993 | transonic | 4.19e+7 | 0.142    | 0.235     | +65.7 %  |
| 1.008 | transonic | 4.29e+7 | 0.167    | 0.241     | +44.3 %  |
| 1.026 | transonic | 4.41e+7 | 0.188    | 0.247     | +31.8 %  |
| 1.043 | transonic | 4.52e+7 | 0.203    | 0.253     | +24.7 %  |
| 1.061 | transonic | 4.64e+7 | 0.214    | 0.257     | +19.6 %  |
| 1.079 | transonic | 4.76e+7 | 0.223    | 0.259     | +15.9 %  |
| 1.094 | transonic | 4.86e+7 | 0.227    | 0.260     | +14.6 %  |
| 1.127 | transonic | 5.08e+7 | 0.234    | 0.260     | +11.4 %  |
| 1.145 | transonic | 5.20e+7 | 0.236    | 0.260     | +10.3 %  |
| 1.173 | transonic | 5.39e+7 | 0.241    | 0.260     | +7.6 %   |

## Transonic drag rise placement (Mach at a quarter of the rise above the value at Mach 0.8, or the first point above 0.8)

| dataset                                             | measured rise Mach | predicted | difference | target 0.05 |
| --------------------------------------------------- | ------------------ | --------- | ---------- | ----------- |
| Blue Scout forebody (points at 0.8, 0.9, 1.0, 1.03) | 0.894              | 0.917     | +2.3 /100  | met         |
| RM-10 flight (TN 2944)                              | 0.972              | 0.837     | -13.5 /100 | NOT MET     |
| L8A05 model A                                       | 0.996              | 0.873     | -12.3 /100 | NOT MET     |

## Summary by Mach regime (held-out data only; CP errors in percent of body length, C_D errors relative)

| regime               | CP n | CP rms        | target | CP worst       | target | largest non-conservative | C_D n | C_D rms          | target |
| -------------------- | ---- | ------------- | ------ | -------------- | ------ | ------------------------ | ----- | ---------------- | ------ |
| subsonic             | 2    | 0.4 (met)     | 3      | 0.5 (met)      | 6      | 0.1                      | 7     | 48.9 % (NOT MET) | 7 %    |
| transonic            | 6    | 2.9 (met)     | 5      | 4.5 (met)      | 8      | 0.4                      | 33    | 63.0 % (NOT MET) | 10 %   |
| supersonic           | 9    | 7.2 (NOT MET) | 4      | 10.6 (NOT MET) | 7      | 2.9                      | 20    | 30.7 % (NOT MET) | 8 %    |
| outside (above 2.01) | 5    | 13.4          |        | 16.6           |        | 0.0                      | 10    | 56.4 %           |        |

Per dataset:

- CP Blue Scout: n=8 rms 2.5 %L worst 4.5 %L mean -1.7 %L
- CP RM-10: n=4 rms 1.8 %L worst 2.9 %L mean +1.3 %L
- CP TN D-3182 A: n=9 rms 11.7 %L worst 16.6 %L mean -11.4 %L
- CP TM X-1661: n=1 rms 10.6 %L worst 10.6 %L mean -10.6 %L
- C_D Blue Scout (forebody): n=5 rms 25.5 % worst 43.0 % mean +20.1 %
- C_D RM-10 tunnel: n=4 rms 23.8 % worst 27.5 % mean +23.6 %
- C_D RM-10 flight: n=26 rms 41.5 % worst 92.8 % mean +37.5 %
- C_D TN D-3182 A: n=9 rms 60.0 % worst 109.8 % mean +53.5 %
- C_D TM X-1661: n=1 rms 31.3 % worst 31.3 % mean +31.3 %
- C_D L8A05: n=25 rms 67.7 % worst 123.8 % mean +57.3 %
