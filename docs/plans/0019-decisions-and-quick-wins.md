# Plan 0019: Prompt 5 Part A decisions, WGS 84 gravity, tableau cross-check, warning thresholds (Prompt 5 step 1)

**Status:** written 2026-10-12 under autonomous mode; Prompt 5 step 1.
**Phase:** follow-up after the roadmap (`docs/audit.md` §12).

## Goal

Record the owner's Part A answers as decisions, and do the small items they settle: the WGS 84 latitude-dependent gravity (GRAV-2, GRAV-3), the SciPy cross-check of the Dormand–Prince tableau, the user-adjustable warning and stability thresholds in the UI labelled as rules of thumb, and the SOURCES updates (public domain status of NASA TR R-100, NIST SP 811 and the random generator paper approved).

## Sources

| ID     | Content                                                                                                                          | Source                                                                                                                                |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| GRAV-2 | Normal gravity on the WGS 84 ellipsoid (Somigliana): γ = γ_e (1 + k sin²φ)/√(1 − e² sin²φ), with the WGS 84 constants γ_e, k, e² | NIMA TR8350.2, 3rd edition, chapter 4 (the "WGS 84 ellipsoidal gravity formula"); to be downloaded and verified before implementation |
| GRAV-3 | Normal gravity above the ellipsoid: γ_h = γ [1 − 2(1 + f + m − 2f sin²φ) h/a + 3h²/a²]                                           | NIMA TR8350.2, chapter 4 (the Taylor series in h); same                                                                               |
| DYN-11 | Dormand–Prince tableau cross-checked against SciPy 1.18.1 `scipy/integrate/_ivp/rk.py`, class `RK45` (C, A, B and E = b4 − b5)   | the owner's approved cross-check; the numbers are recorded in the test                                                                |

The gravity model keeps the inverse-square altitude dependence of GRAV-1 as an option; with a latitude the WGS 84 formulas replace both the sea-level value and the altitude dependence. OpenRocket's reference value 9.8061992025 m/s² at 45° is the Somigliana value at 45° (a check, not a source).

## Files

`packages/physics/src/flight/gravity.ts` (GRAV-2, GRAV-3, `GravityModel` with `latitude`), `packages/physics/src/flight/integrators.test.ts` (SciPy check), `packages/app/src/components/LaunchEditor.tsx` (threshold editors), `docs/decisions.md` (D-053 to D-058), `reference/SOURCES.md`.

## Tests

- GRAV-2 by hand at the equator (γ = γ_e), the pole (γ = γ_e (1 + k)/√(1 − e²)) and 45° (the OpenRocket reference value to 8 decimals).
- GRAV-3 at 1000 m and 45° by hand from the series.
- The threshold editors change the design and the warnings fire on the new values.
