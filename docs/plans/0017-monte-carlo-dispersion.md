# Plan 0017: Monte Carlo dispersion and landing zones (Prompt 4 step 2)

**Status:** written 2026-10-12 under autonomous mode; Prompt 4 step 2 (Phase 5, CLAUDE.md 10: "Monte Carlo dispersion and landing zone plots").
**Phase:** 5.

## Goal

Run a design many times with sampled variations of the inputs the user is uncertain about, from one seed that is saved with the results, and report the dispersion of the apogee and of the landing point: a landing-zone scatter plot with the pad, rank-based percentiles and a containment radius, and the apogee spread. No new physics: every run is a plain `simulateFlight` of a perturbed design.

## Sources

- The simulation itself: plans 0007 to 0016. The seeded generator and the normal deviates: RNG-1, RNG-2 (plan 0016, D-050).
- Statistics are rank based: a percentile is the value at the rank ⌈p N⌉ of the sorted sample (no interpolation, no distributional assumption), the mean and standard deviation are the sample ones (N − 1 denominator). The 95 % containment radius is the 95th percentile of the landing distance from the mean landing point. These are definitions, recorded in D-051.
- The variations are user-entered standard deviations with zero defaults: CLAUDE.md gives no uncertainty figures and no approved source does, so the app proposes none (D-051); the example design carries illustrative values labelled as such.

## Conventions

- `DispersionSettings { runs, seed, variations: { windSpeed (m/s), windDirection (rad), railAngle (rad), railAzimuth (rad), motorImpulseScale (fraction), structuralMassScale (fraction) } }`, each a standard deviation of a normal variation about the design's value. Negative sampled wind speeds and rail angles are kept as the same physical vector by reversing the direction (an identity, not a clamp). The motor's thrust curve is scaled uniformly (impulse scale); structural masses and densities are scaled uniformly (mass scale); the propellant mass is not varied.
- Run k uses the design's wind turbulence with seed `seed + k` when turbulence is enabled, so turbulent runs differ by gusts as well as by the sampled variations.
- `runDispersion(design, settings, onProgress?)` returns `{ seed, settings, runs: DispersionRun[], summary }` with every run's sampled values and the flight summary's apogee, maximum velocity, landing east and north, distance, bearing, flight time, end reason; a run that ends at the model limit or the maximum time is counted and reported, not dropped, and excluded from the landing statistics with the count shown.
- The app runs the batch in the worker with progress; results are kept with the flight state; the plots are the landing scatter (east and north, the pad at the origin, the mean point and the containment circle) and an apogee histogram; the table shows the percentiles. The CSV export of the runs is offered.

## Files

| File                                                                 | Purpose                                             |
| -------------------------------------------------------------------- | --------------------------------------------------- |
| `packages/formats/src/dispersion/dispersion.ts`                      | settings, sampling, runs, statistics (D-051)        |
| `packages/formats/src/design/model.ts`, `validate.ts`                | `dispersion` settings in the design file (optional) |
| `packages/app/src/simulation/worker.ts`, `runner.ts`                 | the batch with progress                             |
| `packages/app/src/components/DispersionPanel.tsx`, `ScatterPlot.tsx` | UI and plots                                        |
| tests next to each file                                              |                                                     |

## Tests

- With every standard deviation 0 and no turbulence, every run equals the deterministic flight.
- The same seed gives identical results; another seed differs; the seed is in the result.
- A wind-speed standard deviation spreads the landing east coordinates (sample standard deviation above 0) and leaves apogees within a few per cent.
- Statistics by hand: for the sample [3, 1, 2, 5, 4], the median is 3, the 95th percentile by rank ⌈0.95 × 5⌉ = 5 is 5, the mean 3 and the sample standard deviation √2.5 = 1.5811.
- The app panel: running 5 runs of the example with a 2 m/s wind standard deviation shows the table and the scatter plot with 5 points and the seed.
