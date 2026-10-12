# Phase 5 acceptance report (advanced)

Date: 2026-10-12. Branch `claude/inspiring-tesla-xxp0hh`, commits 7313c27 to the one carrying this report (plans 0016 to 0018). Produced under autonomous mode (CLAUDE.md section 11) at the end of Prompt 4.

## Scope (CLAUDE.md 10, Phase 5)

| Item                                               | Result                                                                                                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Wind profiles                                      | a user table by altitude, interpolated linearly (ENV-3, D-049); the thesis assumes a constant mean, so no profile law was invented                                                         |
| Turbulence                                         | Niskanen §4.1.2 in full: two-pole pink noise (eqs. 4.5, 4.6), 20 Hz samples scaled by 2.252, U + σ_u x along the mean (ENV-4, ENV-5), from a seeded generator whose seed is in the results |
| Monte Carlo dispersion and landing zones           | seeded normal variations of wind, rail and motor and mass scales with user-entered standard deviations; rank-based statistics, 95 % containment radius, scatter plot (plan 0017, D-051)    |
| Custom propellant mass profiles for liquid engines | mass profile (MOT-4, Phase 2) extended with the CG from the fore end (MOT-6, D-052) and the CSV fourth column                                                                              |

## Verification

- Random generator: xoshiro128** outputs for seed 20261012 equal those of an independent Python implementation of the paper's reference code; uniform mean and variance within 5 standard errors over 10⁵ draws; Box–Muller normals with mean, variance and the tails beyond ±2 and ±3 within tolerance (RNG-1, RNG-2).
- Turbulence: filter coefficients by hand (−0.833333, −0.0694444); the unscaled two-pole sequence's standard deviation within 3 % of the thesis's 2.252; the scaled wind's mean and standard deviation within 1 % of U and σ_u over 2 × 10⁵ samples; the same value at every query time whatever the step; bit-identical flights for a seed.
- Profile: midpoint by hand (4 m/s from 45° between 2 m/s from north and 6 m/s from east); the short way round the compass; a one-row profile reproduces the constant-wind flight exactly.
- Dispersion: statistics by hand on [3, 1, 2, 5, 4]; zero variations reproduce the deterministic flight in every run; determinism per seed; a 2 m/s wind standard deviation spreads the landings and leaves the apogee within 10 %; failing runs reported, not thrown.
- CG profile: 0.05 → 0.04 → 0.03 m by hand; the rocket CG shift from a casing moved 20 mm equals 0.0215 × 0.02 / 0.169804 m.

## Not verified, or outside this phase

- The turbulence spectrum was not compared with the Kaimal spectrum (the thesis's Figure 4.2); the model is the thesis's recipe, implemented as written and checked by its stated figures.
- No source gives default uncertainties for the dispersion; all standard deviations default to zero and the user enters them.
- Tank inertia (D-052) remains the uniform-cylinder value.
- Box and Muller (1958) is not in `reference/` (open question).

## Checks

`pnpm check` clean: typecheck, lint, format, 579 tests in 49 files; the app builds; the Playwright tests pass. The final audit is `docs/audit.md`.
