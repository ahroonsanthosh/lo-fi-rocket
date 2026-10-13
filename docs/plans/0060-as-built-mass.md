# Plan 0060: the rocket's as-built mass and CG (plan 0055 step 3, part 2b)

Decision D-089. A builder who weighs the finished rocket wants the simulation to use that weight ("any weights", D-083). OpenRocket files carry it as a stage mass or CG override, which the import lists as not applied (major, D-084).

## Model (GEO-17)

`RocketDesign.asBuilt`: the empty rocket's measured mass M and/or CG C from the nose tip, motor excluded. Every part's mass properties (with its own override, D-073) are scaled by M/M₀ and moved by C − X̄₀, where M₀ and X̄₀ are the parts' computed total and CG; GEO-12 then gives exactly M and C, the inertias scaled with the masses (as D-073 scales one part's) and carried by the parallel axis theorem. Applied where the design becomes physics parts (`designPlacedComponents`), so the stability, the mass figures, the flight and the Monte Carlo runs all use it. Parts of no mass stay at none.

## Import (reference/rockets/stage-override-probe/values.txt)

- Stage mass override covering the parts (case 4): `asBuilt.mass` = M.
- Stage CG override covering the parts (cases 5, 6): `asBuilt.cg` = C (from the stage front, the nose tip for one stage).
- Stage mass override not covering the parts (cases 1, 3): OpenRocket adds M as a point mass at the stage's CG or at the override CG: `asBuilt` = the parts' total plus M at the combined CG, listed as minor (the added mass is spread over the parts, so the inertia differs from a point mass).
- Stage CG override not covering the parts with no mass override (case 2): no effect in OpenRocket, none here.
- A stage drag override stays listed (moderate, D-084).

## App

The parts list offers "As built": the weighed mass and, optionally, the balance point; the Monte Carlo structural mass variation scales it too (and, as it should have, a part's own mass override).

## Tests

GEO-17 by hand on R1; zero-mass parts; the probe files' masses and CGs as OpenRocket; save and load; the dispersion scaling; the editor action.
