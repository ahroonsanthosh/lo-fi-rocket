# Plan 0016: Wind profiles by altitude, turbulence and the seeded random generator (Prompt 4 step 1)

**Status:** written 2026-10-12 under autonomous mode; Prompt 4 step 1 (Phase 5, CLAUDE.md 6.4 "then a wind profile by altitude, then turbulence later").
**Phase:** 5.

## Goal

Complete the wind model of ENV-1: a mean wind that may vary with altitude (a user table), and Niskanen's turbulence (pink noise from a two-pole filter at 20 Hz, scaled to a standard deviation, interpolated between samples), driven by a seeded pseudorandom generator so that the same inputs give bit-identical flights and the seed is kept with the results (CLAUDE.md 5). The generator and the Gaussian sampling are also the basis of the Monte Carlo of plan 0017.

## Sources

| ID    | Content                                                                                                                                                                                                                                                            | Source                                                                                                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ENV-3 | Mean wind as a table of altitude, speed and direction, interpolated linearly in altitude between rows; the thesis assumes a constant mean ("to simplify the model") and names layers as a future extension, so the table is the project's own convention (D-049)   | N09 §4.1.2 p. 56 ("different layers of air may have different wind velocities and directions"), p. 60 ("the average wind speed is assumed to be constant with altitude")      |
| ENV-4 | Pink noise by the IIR filter x_n = w_n − a₁ x_{n−1} − a₂ x_{n−2} with a₀ = 1, a_k = (k − 1 − α/2) a_{k−1}/k, α = 5/3, two poles; w_n Gaussian white noise                                                                                                          | N09 eqs. (4.5), (4.6) pp. 57 to 58 (after Kasdin [30]); "two memory terms", p. 60 step 1                                                                                      |
| ENV-5 | Turbulence velocity: samples at 20 Hz (Δt = 0.05 s), x_n divided by 2.252 (the standard deviation of a long unscaled two-pole sequence), U_n = U + σ_u x_n along the mean wind direction, linear interpolation between samples; σ_u = I_u U with the intensity I_u | N09 p. 58 (20 Hz, "the simulation resolution does not affect the wind conditions"), p. 60 steps 1 to 3 and eq. (4.7); intensities of 10 to 20 % are "at the top of the range" |
| RNG-1 | xoshiro128\*\* pseudorandom generator (32-bit state words, output rotl(s₁ × 5, 7) × 9), seeded from a 32-bit seed through SplitMix32-style mixing                                                                                                                  | Blackman and Vigna, _Scrambled Linear Pseudorandom Number Generators_, arXiv:1805.01407 (`reference/docs/blackman-vigna-xoshiro.pdf`), §5 and the reference code in Figure 1  |
| RNG-2 | Standard normal deviates by the Box–Muller transform z = √(−2 ln u₁) cos(2π u₂) from two uniforms in (0, 1]                                                                                                                                                        | Box and Muller (1958); the paper is not in `reference/` (paywalled); verified by the distribution tests (D-050), as D-037 does for Dormand–Prince                             |

## Conventions

- `WindModel` gains `{ kind: 'profile', layers: {altitude, speed, from}[] }` (altitudes increasing from 0; above the last row the last row holds, below the first the first holds, both documented) and `{ kind: 'turbulent', mean: ConstantWind | ProfileWind, intensity, seed }`. The turbulence is a scalar gust along the mean direction (the thesis's U_n), so the wind never reverses direction unless σ_u x_n < −U, which the thesis's model allows.
- `windField(model, maxTime)` returns `(altitudeAbovePad, time) => Vec3`; the turbulent sequence is generated once per flight for `maxTime` at 20 Hz from the seed, so RK stages at any time read the same interpolated value (p. 58). `simulateFlight` builds the field once; `modes.windSeed` records the seed.
- The generator lives in `packages/physics/src/numerics/random.ts`: `createRandom(seed)` with `nextUint32`, `nextFloat` (53-bit uniform in [0, 1)), `nextNormal`. Tests check xoshiro128\*\* against outputs of an independent Python implementation of the paper's reference code, and the normal sampler's mean, variance and tail fractions over 10⁵ samples.

## Files

| File                                           | Purpose                                                     |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `packages/physics/src/numerics/random.ts`      | RNG-1, RNG-2                                                |
| `packages/physics/src/environment/wind.ts`     | ENV-3, ENV-4, ENV-5, `windField`                            |
| `packages/physics/src/flight/simulate.ts`      | the field built once per flight; `modes.windSeed`           |
| `packages/formats/src/design/*`                | wind settings in the design (profile rows, intensity, seed) |
| `packages/app/src/components/LaunchEditor.tsx` | profile table and turbulence fields                         |
| tests next to each file                        |                                                             |

## Tests

- Filter coefficients by hand: a₁ = (0 − 5/6)/1 = −0.833333, a₂ = (1 − 5/6)(−0.833333)/2 = −0.0694444.
- A long unscaled two-pole sequence from unit Gaussian noise has a standard deviation near 2.252 (the thesis's value; tolerance 3 % over 2 × 10⁵ samples at a fixed seed).
- The scaled turbulence has a standard deviation near σ_u, a mean near U, and the same values at every query time whatever the integrator step (sampled at 20 Hz, interpolated).
- Determinism: two flights with the same seed are identical sample by sample; a different seed differs.
- Profile: a two-row table interpolates speed and direction by hand at the midpoint; R1 with a profile equal to a constant wind reproduces the constant-wind flight.
