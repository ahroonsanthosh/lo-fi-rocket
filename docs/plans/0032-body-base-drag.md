# Plan 0032: The subsonic drag over-prediction: body base drag from the DATCOM (completion prompt Part C item 7)

**Status:** written and implemented 2026-10-12 under autonomous mode; D-069.

## Investigation

After items 1 to 4 the held-out C_D was still 34.7 % rms high subsonic and 36.8 % transonic. The breakdown by term (a temporary probe over every held-out model) put the excess in one place: the base drag of the free-flight models. The L8A05 (fineness 7.9, a parabolic boattail to d_b/d = 0.67) is 0.115 measured against 0.163 predicted at Mach 0.7, of which 0.080 is skin friction and 0.083 is the base term; Niskanen's eq. (3.94), 0.12 + 0.13 M² on the base area, takes the base pressure of a blunt cylinder whatever the body ahead of it. The NACA RM A53D02 free-flight model (cylindrical base) is +23 % subsonic and +35 % transonic for the same reason. The DATCOM correlates the base drag with the body's own friction drag (Hoerner's relation, eq. 4.2.3.1-b), C_Db = 0.029 (d_b/d)³/√(C_Df)_b on the maximum frontal area, which falls for long, smooth or boattailed bodies.

## Method

DRAG-21 (eqs. 4.2.3.1-a, -b) subsonic; DRAG-22 the DATCOM's transonic step 3: the Mach 0.6 value carried along the guide curves of figure 4.2.3.1-24 (digitised twice; the DATCOM sample problem's readings are reproduced within 0.006) to Mach 1.295, then the DATCOM's "fairing due to possible mismatch between transonic and supersonic base drag estimates" (sketch (a)) linearly to Niskanen's eq. (3.94) at Mach 1.5, where the DATCOM's supersonic base-pressure charts begin (their implementation, figures 4.2.3.1-50, -55, -60, is left for later). The skin-friction coefficient and wetted area are the drag model's own (DRAG-1 to DRAG-3); the motor area is removed from the base as before (D-035).

## Results

| set                                                                                 | Niskanen base (before)                                    | DATCOM base                               |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------- |
| held-out C_D rms, subsonic (target 7 %)                                             | 34.7 %                                                    | 7.1 %                                     |
| held-out C_D rms, transonic (target 10 %)                                           | 36.8 %                                                    | 21.3 %                                    |
| held-out C_D rms, supersonic (target 8 %)                                           | 14.6 %                                                    | 16.4 %                                    |
| L8A05 (free flight, boattail)                                                       | rms 44.4 %, mean +34.5 %                                  | rms 19.2 %, mean −5.5 %                   |
| RM-10 flight (boattail)                                                             | rms 12.2 %, mean +4.8 %                                   | rms 16.8 %, mean −7.6 %                   |
| drag rise placement (target 0.05 Mach)                                              | L8A05 −0.044 already met with item 1 corrections; all met | all met                                   |
| RM A53D02 (free flight, cylindrical base), square fins                              | subsonic +23 %, transonic +35 %                           | −4 %, +6 %                                |
| Blue Scout measured base axial force (sting-mounted tunnel model, cylindrical base) | +9 % at Mach 0.6                                          | −58 % at Mach 0.6, −61 to −68 % transonic |

The one contrary dataset is the Blue Scout's directly measured base force; it is a sting-mounted tunnel model with thick blunt-based wedge fins ending at the base, a configuration whose base flow the DATCOM says the correlation does not cover ("wings or fins (or wind-tunnel stings) can have a sizable effect on base drag"). The free-flight data, which include the base as a rocket flies, favour the DATCOM on both base shapes. The DATCOM method is the default; Niskanen's stays selectable and is used in the OpenRocket-equivalent mode, so the OpenRocket comparisons and the golden series are unchanged. In the displayed mode the reference rockets' apogees rise by 1 % to 4.6 % (within the Phase 2 tolerance against OpenRocket); the example design's displayed apogee is 172.94 m (167.33 m before).

## Files

`packages/physics/src/drag/datcom-base-drag.ts` (+ test), `drag.ts` (`baseDragMethod`, `DEFAULT_BASE_DRAG_METHOD`), `flight/vehicle.ts`, `flight/simulate.ts`, `index.ts`; `reference/digitised/build-datcom-fig-4231-24.py`, `datcom-figure-4-2-3-1-24.json`; `packages/formats/src/design/to-physics.ts` (Niskanen in the OpenRocket-equivalent mode), tests naming their base method; docs: DRAG-21, DRAG-22, D-069, limitations, reports.
