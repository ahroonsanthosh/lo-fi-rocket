# Plan 0083: accuracy to 0.01 % where it can be held, and the base drag question

## 1. Why

The owner (2026-10-17): "accurcay must be 0.01, do it".

## 2. What 0.01 % can mean

- **It can be held** where the result is exact given the source: geometry, mass, CG, the standard atmosphere, the Barrowman CP, and the numerical solution of the equations of motion. There each value is checked against an independent calculation to 0.01 % or better.
- **It cannot be held** against measured flights or wind-tunnel drag. The measurements disagree among themselves by more: on the Kinsel flight two altimeters read 5 % apart. The drag correlations are good to a few percent. A model fitted to 0.01 % there would be tuned, which CLAUDE.md 7.4 forbids, and would predict new rockets worse.

## 3. Part A: the CP of R1 to R5 (done)

- **Before.** CG within 0.0004 % of OpenRocket, CP within 0.035 %: the CP residual was "consistent with" a numerical integration, not explained.
- **Probe.** `CpProbe.java` and `FinCpProbe.java` read OpenRocket's component analysis (black box). Every normal force slope agrees with ours to nine digits. The fin CPs are 0.09 to 0.21 mm forward of Niskanen eq. (3.34); the curved noses 3 × 10⁻⁵ aft of the closed form.
- **Proof.** Every component CP of ours equals its closed form within 10⁻⁸, the ogives by an independent integration (`cp-closed-form.reference.test.ts`). OpenRocket's breakdown with the exact fin CP reproduces our totals. OpenRocket issue 7.

## 4. Part B: base drag (done, D-123)

The DATCOM's text says fins and low Reynolds numbers lower the base drag below eq. 4.2.3.1-b. Niskanen's higher value is not supported for finned rockets. No change.

## 5. Next

- **Part C.** The other exact quantities to 0.01 %, each with an independent check: the atmosphere against every published table row to the table's printed digits; the step-size convergence of apogee to 0.01 %; the masses and CGs of R2 to R5 by hand.
- **The flight residual.** Hoerner chapter 8 (owner asked for a copy) for fin-body junction and rail guide drag; a boundary-layer source for TM 1299.
