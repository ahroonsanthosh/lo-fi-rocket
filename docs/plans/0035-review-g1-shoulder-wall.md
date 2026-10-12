# Plan 0035: review finding G-1, nose shoulder wall checks

Lane: physics. Source of the finding: `docs/review/findings.md` G-1 (critical).

## Problem

`componentMassProperties` built the nose shoulder as `hollowCylinder(r, r − t, ...)` after checking only that r, t and the length are positive. With t ≥ r the inner radius is zero or negative and is squared, so the mass came out too small or negative with no error (rule 3). A shoulder wider than the nose base was also accepted.

## Change

- `packages/physics/src/geometry/components.ts`: reject t ≥ r ("must be less than the shoulder radius"), as tubes already do, and reject a shoulder radius larger than the nose base radius. Both throw `InvalidInputError`, which the design adapter and the app already report.
- No equation changes: the hollow cylinder (GEO register) is unchanged.

## Tests

- A 15 mm wall on a 20 mm, 30 mm long shoulder at 1000 kg/m³ adds π(0.020² − 0.005²)(0.030)(1000) = 0.0353429 kg (by hand).
- Walls of 20, 30 and 50 mm on a 20 mm shoulder are rejected (the review's cases).
- A shoulder radius of 26 mm on a 25 mm base is rejected; 25 mm is accepted.
- Property (fast-check, seeded): every accepted nose with a shoulder has positive mass and inertia, and more mass than the bare nose.

## Not in this change

The app editor's field rule (ui lane) is tracked in a GitHub issue.
