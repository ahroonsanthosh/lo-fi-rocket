# Phase 1 acceptance report (physics core, no UI)

Date: 2026-10-11. Branch `claude/inspiring-tesla-xxp0hh`, commits 1b8c7fd to 56d35c9. Produced under autonomous mode (CLAUDE.md section 11) at the end of Prompt 1, Part C.

## Reference comparison (CLAUDE.md 7.4: CG within 1 %, CP within 2 %)

All values in metres from the nose tip; OpenRocket 24.12 values from `reference/rockets/values.csv` (design window: Mach 0.3, zero angle of attack, worst roll angle, reference length = maximum body diameter). Ours are computed from the hand-transcribed component lists (`reference-rockets.ts`); the same numbers are reproduced from the `.ork` and `.eng` files by the formats tests.

### CG (liftoff and burnout) and CP in the OpenRocket-equivalent mode (D-016: no roll-angle reduction)

| Rocket | CG liftoff ours | OpenRocket | Diff % | CG burnout ours | OpenRocket | Diff % | CP ours  | OpenRocket | Diff % |
| ------ | --------------- | ---------- | ------ | --------------- | ---------- | ------ | -------- | ---------- | ------ |
| R1     | 0.387022        | 0.387022   | +0.000 | 0.364906        | 0.364906   | +0.000 | 0.487227 | 0.487149   | +0.016 |
| R2     | 0.484547        | 0.484548   | −0.000 | 0.443896        | 0.443897   | −0.000 | 0.571233 | 0.571037   | +0.034 |
| R3     | 0.356247        | 0.356248   | −0.000 | 0.332090        | 0.332091   | −0.000 | 0.449197 | 0.449111   | +0.019 |
| R4     | 0.625038        | 0.625038   | −0.000 | 0.594670        | 0.594671   | −0.000 | 0.807973 | 0.807795   | +0.022 |
| R5     | 0.435529        | 0.435530   | −0.000 | 0.403345        | 0.403346   | −0.000 | 0.527000 | 0.526894   | +0.020 |

Every CG is within 0.0004 % and every CP within 0.035 % of OpenRocket. The acceptance tests assert the CLAUDE.md tolerances and, separately, the observed agreement (CP within 0.05 %) so that a regression of the model, not just of the tolerance, is caught.

### Stability margin in calibers at the liftoff CG

| Rocket | Fins | OpenRocket | Ours, OpenRocket-equivalent | Diff % | Ours, displayed (Niskanen worst roll angle) | Displayed CP |
| ------ | ---- | ---------- | --------------------------- | ------ | ------------------------------------------- | ------------ |
| R1     | 3    | 2.0025     | 2.0041                      | +0.080 | 1.8374                                      | 0.478890     |
| R2     | 3    | 1.6016     | 1.6053                      | +0.231 | 1.2663                                      | 0.552929     |
| R3     | 3    | 3.6560     | 3.6594                      | +0.094 | 3.2880                                      | 0.439761     |
| R4     | 4    | 2.7690     | 2.7717                      | +0.099 | 2.6814                                      | 0.802012     |
| R5     | 3    | 2.8551     | 2.8585                      | +0.118 | 2.3766                                      | 0.511582     |

Margins at the burnout CG (OpenRocket-equivalent / displayed): R1 2.4464 / 2.2797, R2 2.3581 / 2.0191, R3 4.6105 / 4.2390, R4 3.2319 / 3.1415, R5 3.8642 / 3.3824. OpenRocket does not report a burnout margin; these follow from its burnout CG and our CP.

The displayed figures are lower by design (D-016): Niskanen eq. (3.54) reduces the three-fin normal force by 15 % and the four-fin force by 6 % at the worst roll angle, and OpenRocket 24.12 applies no reduction (harness probe, `reference/rockets/settings.md`). R2's displayed margin of 1.27 calibers is the one a user would see; it is still inside the 1.0 to 2.0 target band.

### Explanation of the residual CP differences

The 0.016 to 0.034 % residuals are OpenRocket's (plan 0083, 2026-10-17). Its component analysis (`reference/rockets/cp-probe/`) gives every normal force slope exactly, but places each fin set's CP 0.09 to 0.21 mm forward of the trapezoid's exact value (Niskanen eq. 3.34) and each curved nose's 3 × 10⁻⁵ aft of its exact value: a numerical integration. lo-fi-rocket's component CPs equal the closed forms within 10⁻⁸ (`cp-closed-form.reference.test.ts`; the ogives by an independent integration). Substituting the exact fin CP into OpenRocket's own breakdown reproduces lo-fi-rocket's totals to six digits. Recorded as OpenRocket issue 7 (`docs/reports/openrocket-issues.md`). No constant was tuned.

## Verification against the sources

- Every implemented equation is in `docs/equations.md` with source, page, validity range, symbols, implementing function and verifying test: UNIT-1 to 4, ATM-C, ATM-L, ATM-1 to 10, GEO-1 to 12, BAR-1 to 9. The register was found empty at the start of step 6 (IDs existed only in code comments and plans) and was filled in commit 56d35c9; this was a documentation gap, not a code gap, since every function already carried its citation.
- U.S. Standard Atmosphere 1976: every constant, layer and equation verified against the scanned document by page (plan 0001 verification record); 57 published-table rows reproduced within the printing precision (D-023); golden file at 1 km steps.
- Geometry: Appendix A profiles checked against closed forms; shell convention D-024 agrees with OpenRocket's hollow-part masses within 0.01 % (observed); R1 by hand to six decimals.
- Barrowman: R1 by hand (`reference/rockets/hand-checks.md`, independent Python script) to the printed precision; nose cone CPs against closed-form volumes (cone 2L/3, Von Kármán L/2, tangent ogive closed form); boat tail frustum by hand; roll-angle factors at the characteristic angles.

## Assumptions and decisions made without asking (CLAUDE.md section 11)

- D-021 Sutherland constant 110.4 K (the document prints both 110 and 110.4; 110.4 reproduces μ₀).
- D-022 Table 8 linear interpolation in geometric altitude; D-023 published-table tolerance of 1.25 printed units.
- D-024 hollow shells as uniform-wall normal offsets; D-025 mass properties by quadrature of the definitions, not from a formula table.
- D-026 the `.ork` format taken from the written files and OpenRocket's per-component report, with every unknown element rejected.
- D-027 worst-case roll angle taken per fin set (exact for one fin set, a conservative bound for mixed sets); fin CP only below Mach 0.5; reference diameter defaults to the maximum body diameter.
- Motors in Phase 1 are cylinders with the CG at mid-length (OpenRocket's RASP convention, plan 0004); the `.eng` reader rejects comma-separated delay lists and casing-mass inconsistencies.
- Nose cone `shapeparameter` defaults in `noseProfile` (ogive 1, parabolic 1, power 0.5, Haack 0) are Niskanen's named shapes; the `.ork` reader never relies on them and requires the element.

## Not fully verified or outside this phase

- Body lift (Niskanen eqs. 3.26, 3.27) and the pitch damping of §3.2.3 are not implemented; the CP is the zero-angle-of-attack limit. Phase 2.
- Fin CP above Mach 0.5 and fin normal force at Mach 1 and above throw `NotImplementedError`. Phase 2 must add Niskanen eqs. (3.35), (3.36) and (3.41) to (3.49) before simulating R5 (Mach 1.09).
- Clipped transitions, fin cant, fillets, non-square fin sections, more than eight fins, pods, clusters and multiple stages are rejected with clear errors.
- The `.ork` reader covers only the reference rockets' component types (D-026); the user-facing importer is Phase 4.
- OpenRocket's own CP algorithm was not read (GPLv3); agreement is observed, not derived.

## Checks

| Check                | Result                                                       |
| -------------------- | ------------------------------------------------------------ |
| `pnpm typecheck`     | clean (3 packages)                                           |
| `pnpm lint`          | clean (ESLint 10, typescript-eslint strictTypeChecked)       |
| `pnpm format:check`  | clean (Prettier)                                             |
| `pnpm test`          | 13 files, 269 tests passed (physics 217, formats 52)         |
| Property-based tests | fast-check on units, geometry, stability (invariants of 7.3) |
| Golden outputs       | `golden/ussa1976.json` unchanged since its creation          |

Test counts by file: barrowman 27, ussa1976 23, components 16, eng 15, ork 14, profiles 14, convert 14, revolution 10, quantity 4, tables 4, errors 4, infrastructure 2, golden 1 (`it` blocks; several loop over the five rockets or 57 table rows).

## Open item: pull request

The repository has a single branch, `claude/inspiring-tesla-xxp0hh`, which is also its default branch, so GitHub cannot open a pull request from it. Fix: create a `main` branch from this branch (for example from the first commit, or from the current head) and make it the default; then a pull request from `claude/inspiring-tesla-xxp0hh` into `main` can be opened. Nothing in the code depends on this.
