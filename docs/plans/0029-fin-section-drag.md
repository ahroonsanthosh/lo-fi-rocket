# Plan 0029: Fin leading-edge and section drag from the DATCOM (completion prompt Part C item 4)

**Status:** written and implemented 2026-10-12 under autonomous mode; D-066.

## Goal

Give each fin section the DATCOM's leading-edge and section drag (thick and round-nosed, blunt, sharp) instead of fitting real sections to the nearest Niskanen type, and rerun the validations.

## Findings that set the scope

- The held-out Blue Scout and TN D-3182 fins are single wedges (sharp leading edge, blunt base) and the ARCAS and RM A53D02 fins are double or asymmetric wedges. The model could only call them 'square' (charging a blunt-plate stagnation drag on a sharp edge: Blue Scout forebody +43 % at Mach 0.6, TN D-3182 +53 %) or 'rounded' (ARCAS, as the thesis did).
- The DATCOM (4.1.5.1 C, p. 4.1.5.1-16) splits the section drag into the wave drag of the sharp-nosed shape (K table: biconvex 16/3, double wedge (c/x_t)/(1 − x_t/c), hexagonal) and, for round-nosed sections, the cylindrical leading-edge pressure drag of figure 4.1.5.1-30, which is printed with its closed form (Ref. 19). It has no method for a blunt flat-faced edge.

## Changes

- New fin sections 'wedge' (sharp leading edge, blunt trailing edge of the full thickness) and 'double-wedge' (sharp at both edges, ridge at mid-chord): no leading-edge term; the wedge keeps the square trailing-edge base drag; wave drag K = 4 for the double wedge (table) and 1 for the single wedge, the forward-face term of the table's double-wedge expression (c/x_t + c/(c − x_t) at x_t = c, the rear faces replaced by the base). The transonic chart (figure 4.1.5.1-29, the biconvex family) is taken in the ratio K/(16/3). For the DATCOM fin force (BAR-15), δ⊥ = atan((t/(2c̄))/cos Λ) for the wedge and atan((t/c̄)/cos Λ) for the double wedge.
- 'rounded' leading edge: DRAG-20, the DATCOM correlation 1.28 M³ cos⁶Λ/(1 + M³ cos³Λ) on 2 r_LE b/cos Λ (= 1.28 M³ cos⁵Λ/(1 + M³ cos³Λ) on t·s), replacing eq. (3.89) × cos²Γ; a warning below Mach 0.5 and above 75° sweep, outside its substantiated range.
- 'square' unchanged (no DATCOM method for a flat-faced edge).
- App: the two new sections in the fin editor; the native format accepts them (no schema change: an added enumeration value).
- Validation models: Blue Scout and TN D-3182 'wedge', ARCAS 'double-wedge', RM A53D02 reported as 'wedge' and 'square'; the changes follow the reports' drawings, made before the results were seen per model.

## Results (C_D)

| set                              | before                                               | after                                                              |
| -------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| Blue Scout forebody (held-out)   | rms 25.5 %, mean +20.1 %                             | rms 16.4 %, mean −14.7 % (−3.5 % at Mach 0.6, −24 % at 1.0)        |
| TN D-3182 (held-out)             | rms 60.0 %, mean +53.5 %                             | rms 21.8 %, mean −21.0 %                                           |
| TM X-1661, Mach 2.01 (held-out)  | +39.5 %                                              | −17.1 %                                                            |
| held-out summary                 | subsonic 38.3, transonic 36.8, supersonic 19.0 % rms | 34.7, 36.8, 14.6 % rms (targets 7, 10, 8: not met)                 |
| ARCAS forebody (non-independent) | transonic rms 19.1 %, supersonic +66 % mean          | transonic −28 % mean, supersonic −19 % mean                        |
| RM A53D02 total                  | square fins: supersonic rms 8.7 %                    | wedge fins: supersonic rms 12.4 %, hypersonic 11.4 % (square 21.4) |

CP is essentially unchanged (held-out transonic rms 4.3, supersonic 3.8 % L). The reference rockets (all square fins) and their golden series are unchanged.

Every sharp-wedge model is now under-predicted supersonically by 17 % to 28 % while the circular-arc RM-10 is within 5 %: the linear-theory wave drag of a thick wedge and the base drag of its blunt edge are the candidates; no further sourced method was found for them (limitations). The remaining subsonic and transonic excess is the body base drag of boat-tailed bodies (L8A05 +35 %), item 7.

## Files

`packages/physics/src/geometry/components.ts`, `drag/fin-drag.ts`, `drag/datcom-fin-wave-drag.ts`, `drag/drag.ts`, `stability/barrowman.ts`, `validation/held-out-models.ts`, `validation/wind-tunnel-models.ts`, `index.ts` (+ tests); `packages/formats/src/design/validate.ts`, `wind-tunnel.validation.test.ts`; `packages/app/src/components/ComponentEditor.tsx`; docs: DRAG-10, DRAG-19, DRAG-20, D-066, limitations, reports.
