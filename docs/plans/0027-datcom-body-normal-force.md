# Plan 0027: Transonic and supersonic body normal force and centre of pressure from the DATCOM (completion prompt Part C item 2)

**Status:** written and implemented 2026-10-12 under autonomous mode; D-064.

## Goal

Replace the Mach-independent slender-body term for the nose-cylinder body (BAR-2, BAR-3, Niskanen eqs. 3.19 and 3.28) above Mach 0.8 with the DATCOM's empirical ogive-cylinder and cone-cylinder charts: C_Nα on the maximum frontal area (figures 4.2.1.1-21a/b, section 4.2.1.1 C) and the centre of pressure as a fraction of body length (figures 4.2.2.1-23a/b, section 4.2.2.1 C), faired smoothly across the transonic range as the DATCOM prescribes. Rerun every validation afterwards.

## Sources and method

- DATCOM 4.2.1.1 C (scan pp. 817 to 818) and 4.2.2.1 C (scan pp. 893 to 894): charts against β/f_N (left) and f_N/β (right) for curves of f_A/f_N; validity ogive-cylinder 1.28 < M < 5.04, 1.5 < f_N < 7, f_A/f_N < 3.87; cone-cylinder 1.36 < M < 5.04, 2.5 < f_N < 7, f_A/f_N < 3.17; parabolic noses use the ogive charts, 3/4-power noses the cone charts with the CP 5 % of body length forward (pp. 4.2.1.1-3, 4.2.2.1-10). Transonic: "faired out smoothly" between the subsonic and supersonic values (pp. 4.2.1.1-3, 4.2.2.1-9).
- Charts digitised twice (`reference/digitised/build-datcom-body-charts.py`, `datcom-body-charts.json`): C_Nα uncertainty 0.05 to 0.07 per radian, CP 0.5 % of body length.
- Body assembly: the nose cone plus the contiguous body tubes of the same radius that follow it (l_B = l_N + l_A); transitions, flares and boattails keep Niskanen's terms (the DATCOM boattail increment of figure 4.2.1.1-22a is the Mach-independent slender-body value Niskanen already gives; its CP chart 4.2.2.1-24 is not implemented, recorded in the limitations).
- Fairing: Niskanen's term to Mach 0.8, linear in Mach to the chart's first point at β/f_N = 0.4 (Mach 1.56 for f_N = 3), the chart beyond; the DATCOM C_Nα on S_B referred to A_ref; every validity statement a warning.

## Results (held-out data, D-061)

The supersonic body term adds normal force forward of the fins, so the predicted CP moves further forward (more conservative) where the measured CP lies aft: TN D-3182 −15.0 % (was −11.4), TM X-1661 −14.2 (was −10.6); RM-10 improves to 1.5 % rms (was 1.8); the Blue Scout transonic error grows to 4.7 % rms (was 2.5) through the fairing. The ARCAS supersonic rms improves from 18.2 to 17.0 % (worst 19.8, was 26.6). The remaining gap is on the fins (item 3): the measured force is larger and further aft than Barrowman's fins plus any body term give.

## Files

`packages/physics/src/stability/datcom-body.ts` (+ test), `barrowman.ts`, `flight/aerodynamics.ts`, `index.ts`; `packages/formats/src/datcom-body.reference.test.ts`; R5 golden series regenerated (the Von Kármán nose's body term is faired above Mach 0.8: apogee unchanged in still air, 0.0007 m lower with wind); docs: equations BAR-13, BAR-14; D-064; limitations; reports.
