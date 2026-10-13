# Plan 0036: component mass and CG overrides (review G-8, owner's .ork file)

Lane: physics. Decision: D-073.

## Why now

The owner's `.ork` file "Blackhawk 29 supersonic (Wildman BH29, AeroTech DMS I205W-14A, drogueless dual deploy) v2" was rejected: "nosecone ... mass or CG override (<overridemass>) is not supported by the minimal .ork reader". CLAUDE.md 6.1 requires user-entered mass overrides (review finding G-8).

## Reference behaviour

No literature source defines an override; OpenRocket 24.12 is used as a black box. `tools/openrocket-harness/src/OverrideProbe.java` builds a nose cone, body tube and mass component (and in case 10 a fin set and rail buttons), applies overrides, and prints OpenRocket's structure mass, CG and inertias and each component's figures; it saves the `.ork` files. Output and four of the files are in `reference/rockets/override-probe/`.

## Change

- physics `geometry/assembly.ts`: `MassOverride`, `PlacedComponent.massOverride`, `overriddenMassProperties`, applied in `structuralMassParts` (the one path every mass, CG, stability and flight figure takes).
- formats `ork.ts`: read `<overridemass>` and `<overridecg>` on every component; reject `<overridecd>`, and a subcomponents override on a component with subcomponents. The parachute keeps reading `<overridemass>` as its own mass.
- formats design: optional `massOverride` in the model, validator, `.ork` import and physics adapter. No schema version bump: the field is optional and old files are unchanged (as for `dragCurve` and `recordedFlight`).

## Tests

- physics: R1-like probe rocket with no override, mass, CG and both, against OpenRocket's mass, CG and both inertias within 1e-6; the mass-override CG worked by hand; own-inertia scaling; invalid values.
- formats: OpenRocket-written probe files: the nose override (mass from OpenRocket, CG by hand), fin set and rail button totals (OpenRocket mass), the subcomponents case rejected, `<overridecd>` and a negative mass rejected; design file round trip, the liftoff mass change and validation messages.

## Not in this change

The app editor fields (ui lane issue). The owner's file may use further features the minimal reader rejects; the next message names them.
