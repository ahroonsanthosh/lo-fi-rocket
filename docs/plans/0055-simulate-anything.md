# Plan 0055: simulate anything, with a confidence report (D-083)

The owner's goal: any kit, any sizes, any weights and any file can be simulated, and swapping a part never breaks the app. CLAUDE.md rules 2 and 3 were changed accordingly (D-083). This plan is the roadmap; each step is its own pull request with tests, merged when CI is green.

## Principle

The design holds what the user built. The simulator models it exactly where it can and otherwise uses a documented approximation, which it lists in the result. When a better model is added, the approximation disappears from results without any change to designs.

## Steps

1. **Confidence report.** `packages/physics/src/fidelity.ts`: `Approximation` (subject, what is not modelled, method, effect, impact minor/moderate/major) and `confidenceOf` (high: none or minor only; medium: any moderate; low: any major). `FlightResult.approximations` and `FlightResult.confidence`; approximations known from the design alone (before flying) from `componentApproximations`. The app shows the confidence with the results and lists the approximations in the checks column. First approximation reported: the slab mass of rounded and airfoil fins (D-077).
2. **Freeform and elliptical fins.** Physics fin kinds holding the real outline: mass from the outline; aerodynamics from Niskanen's treatment of general planforms where the thesis gives it, else an equivalent trapezoid listed as an approximation. `.ork` import of both. Physics: plan 0058 (D-087); import and display: plan 0059.
3. **Import never refuses.** Canted fins kept in the design (roll forcing reported until step 6), drag overrides, stage overrides, clusters (N motors of the same curve), streamers, tube fins, unknown parts carrying a mass, multi-stage and pods: each imported with a listed approximation. Part 1, parts inside the rocket and part settings: plan 0056 (D-084). Part 2: parts outside the body and the motor, and the stage mass override as a design-level measured mass; motor clusters are plan 0057 (D-086).
4. **Physics never refuses a sensible design.** The remaining `NotImplementedError` stops and the "model-limit" flight end become documented approximations.
5. **Robustness tests.** fast-check generates thousands of designs (odd sizes, missing parts, swapped motors); each must give a result or a plain input message, never an exception.
6. **Sourced upgrades** that remove approximations: canted-fin roll forcing (Niskanen), and others as listed in results.

## Tests

Each step adds its own: hand calculations for new physics, OpenRocket black-box comparisons for file meanings (CLAUDE.md 3), and tests that every new approximation appears in results with the right impact.
