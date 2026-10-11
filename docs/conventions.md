# Conventions

This file is the single definition of units, coordinate frames, numeric rules, and error rules. Code comments and docs refer here instead of restating these.

## Units

- SI everywhere inside `packages/physics` and `packages/formats`: metre (m), kilogram (kg), second (s), newton (N), kelvin (K), pascal (Pa), radian (rad). Derived units follow: m/s, m/s², kg/m³, N·s, kg·m², Pa·s.
- Conversions happen only at the boundaries: the UI (`packages/app`) and file parsers (`packages/formats`, where a file format defines its own units). Nothing inside `packages/physics` takes or returns a non-SI unit.
- Quantities are branded TypeScript types (`Metres`, `Kilograms`, `Radians`, ...). A plain `number` is never passed where a physical quantity is expected. The branding design is specified in `docs/plans/0001-units-and-atmosphere.md` (pending approval) and will be copied here once approved.
- Angles are radians. Degrees exist only in the UI and in file formats.
- Temperatures are absolute (kelvin). Celsius exists only in the UI.
- Mach number and other dimensionless ratios are still branded (`Mach`, `Dimensionless`) so they cannot be confused with dimensional values.

## Coordinate frames

### Rocket body frame (component positions and CG, CP)

- Origin: the tip of the nose cone.
- x axis: along the rocket's longitudinal axis, positive towards the tail. A component "position" is the x coordinate of its forward end unless the component's documentation says otherwise.
- y and z axes: perpendicular to x, forming a right-handed system (x, y, z). The orientation of y and z around the axis is fixed by fin set placement: the first fin of a fin set lies in the +y half-plane unless rotated.
- CG, CP and stability margin are all reported as x coordinates in this frame, in metres from the nose tip. A larger x is further aft. "CP aft of CG" means x_CP > x_CG.
- Stability margin in calibers = (x_CP − x_CG) / d_ref where d_ref is the reference diameter (the maximum body diameter unless the user overrides it).

### Flight frame (proposed, not yet approved)

The flight simulator (Phase 2) needs an inertial launch-site frame. Proposal, to be confirmed in the Phase 2 plan:

- Origin: the launch pad at the base of the rail, at launch site altitude.
- Flat, non-rotating Earth within the flight domain (see `docs/known-limitations.md` once implemented).
- Axes: East, North, Up (ENU), right-handed. Altitude above the pad is the Up coordinate; altitude above sea level = pad altitude + Up.
- Wind direction follows the meteorological convention (the direction the wind blows from, measured clockwise from North), converted to a velocity vector at the input boundary.
- Attitude: unit quaternion from body frame to flight frame. Body frame for flight reuses the rocket body frame above but with the axis sign convention stated in the Phase 2 plan (Niskanen's convention or ours; this is an open decision, see `docs/decisions.md`).

## Numerics

- IEEE 754 float64 (`number`) everywhere. No `Math.fround`, no integer tricks.
- Every result has a documented numerical tolerance, in the function's doc comment and in `docs/equations.md`.
- Deterministic: the same inputs always produce bit-identical outputs. `Math.random` and `Date.now` are banned in `packages/physics` by lint. Monte Carlo uses a seeded generator and records the seed.
- Prefer operations with fewer roundings: divide by an exactly representable integer rather than multiply by its inexact reciprocal (`x / 1000`, not `x * 1e-3`).
- Never return `NaN` or `±Infinity`. Every public physics function checks its result and throws `NonFiniteResultError` naming the calculation.

## Errors

Defined in `packages/physics/src/errors.ts`:

- `NotImplementedError`: the physics is not implemented. Never return a placeholder instead.
- `InvalidInputError`: an input is invalid, out of range, or outside a model's validity range. Carries the parameter name, the received value, and the requirement in plain language. Never clamp or default instead.
- `NonFiniteResultError`: a calculation produced `NaN` or `±Infinity`. Carries where it happened.

Error messages are written for the user, not the developer: say what was received and what is required ("Fin root chord is invalid: received -0.01; must be greater than 0 m").

## Code layout

- `packages/physics/src/<topic>/<thing>.ts` with the test next to it as `<thing>.test.ts`. Type-level tests (compile-time assertions) are `<thing>.types.test.ts` and are checked by `pnpm typecheck`.
- Every physics function has a doc comment with: the equation ID from `docs/equations.md`, the citation, the validity range, inputs and outputs with units, and the numerical tolerance.
- Constants that come from a source are grouped in a frozen object with the citation above it, never scattered as literals.

## Tests

- Hand-calculated expected values show their working in a comment next to the assertion. The working may be done with an independent tool (a calculator, Python with `decimal`), never by running the code under test.
- Published-table comparisons name the table, the row, and the printed precision, and set the tolerance from that precision.
- Property tests use `fast-check` with a fixed seed written in the test so failures reproduce.
- Golden regression outputs live in `packages/physics/golden/` and are compared bit-exactly. A commit that changes a golden file must explain why in its message (CLAUDE.md section 7.6).
