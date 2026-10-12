# Plan 0025: Transonic drag rise (completion prompt Part C item 1)

**Status:** written and implemented 2026-10-12 under autonomous mode (CLAUDE.md section 11); D-062.
**Phase:** version 1.0 completion, Part C item 1.

## Goal

Find, from sources only, why the predicted drag rise comes too early (0.12 to 0.14 Mach before the measured rise on the two dense free-flight sets of plan 0024; +40 % at Mach 0.9 on ARCAS), and fix it with a sourced method. Rerun the full validation and every reference comparison afterwards.

## Finding

The per-term drag breakdown of the held-out bodies (RM-10 and L8A05, circular-arc fins modelled as 'airfoil') shows that the only term rising between Mach 0.6 and 0.9 is the fin leading-edge pressure drag of Niskanen eq. (3.89), (1 − M²)^(−0.417) − 1, which the thesis applies to rounded and airfoil profiles alike on the whole fin frontal area N t s: on the RM-10 it grows from 0.023 to 0.110 (on A_ref) between Mach 0.6 and 0.9 while the measured drag is flat (0.171 at 0.9); the nose term (TR R-100 data) starts at Mach 0.9 to 0.95 and the base term grows only with 0.13 M². Eq. (3.89) is Hoerner's drag of a cylinder (a blunt round leading edge), and the DATCOM refers the leading-edge pressure drag to the leading-edge frontal area 2 r_LE b/cos Λ (figure 4.1.5.1-30), which is zero for a sharp section. Charging it on the full thickness of a sharp section is the cause.

## Sourced fix (USAF DATCOM 1978, section 4.1.5.1)

- Sharp-nosed ('airfoil') fins carry no leading-edge pressure drag (DRAG-10 amended).
- Fin wave drag (DRAG-18): transonic similarity chart, figure 4.1.5.1-29 (scan p. 750), C_Dw/(t/c)^(5/3) against √|M² − 1|/(t/c)^(1/3) per A (t/c)^(1/3), digitised twice (`reference/digitised/datcom-figure-4-1-5-1-29.json`), with the sweep conversions of eqs. 4.1.5.1-d, -e, -f realised as a stretch of the unswept curve in Mach by 1/√cos Λ_c/4 and a scaling by (cos Λ_c/4)^2.5; on the planform area of the N fins; zero below the chart's origin, so the drag rise begins where the chart does.
- Supersonic wave drag (DRAG-19): eqs. 4.1.5.1-k and -l with K from the table on p. 4.1.5.1-16 (biconvex 16/3; double wedge recorded for Part C item 4); the chart is used to Mach 1.2, the formula from 1.4, a linear fairing between (sketch (a), p. 4.2.3.1-5).
- Rounded fins: the DATCOM round-nosed method (eq. 4.1.5.1-n) is the leading-edge term plus the biconvex wave drag, so they keep Niskanen's (3.89) leading-edge term (the same quantity on the same area) and gain the wave drag; square fins (a blunt flat plate) have no section wave drag in the DATCOM tables and keep Niskanen's terms unchanged (Part C item 4 revisits both).

## Files

- `packages/physics/src/drag/datcom-fin-wave-drag.ts` (new), `fin-drag.ts`, `drag.ts`, `index.ts`.
- `reference/digitised/build-datcom-fig-4151-29.py`, `datcom-figure-4-1-5-1-29.json`.
- Tests: `datcom-fin-wave-drag.test.ts` (physics: hand values, the DATCOM sample problem, sweep construction, fairing continuity, properties), `datcom-fin-wave-drag.reference.test.ts` (formats: table equals the file); the existing drag tests updated where the airfoil leading-edge term changed.
- `docs/equations.md` (DRAG-10, DRAG-18, DRAG-19), `docs/decisions.md` (D-062), `docs/known-limitations.md`, `docs/progress.md`, `docs/reports/held-out-validation.md` and `wind-tunnel-validation.md` regenerated, golden flight series regenerated where the fins are not square (explained in the commit message).

## Checks after the change

Full held-out validation (plan 0024), ARCAS and NACA wind tunnel validation, the five reference rockets against OpenRocket (Phase 2 tolerances), the golden series.
