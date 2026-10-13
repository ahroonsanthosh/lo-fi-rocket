# Plan 0056: the .ork import approximates instead of refusing (plan 0055 step 3)

Decision D-084. Plan 0055 step 3 is done in two parts; this plan is part 1, parts inside the rocket and part settings. Part 2 is parts outside the body and the motor (pods, stages, clusters, flipped and unknown nose cones, outer-part materials) and the stage mass override as a design-level measured mass.

## Change

- `packages/physics`: `PlacedComponent.approximations` and `FlightVehicle.approximations`; `simulateFlight` lists them before the component approximations of D-083.
- `packages/formats/src/design`: `DesignComponent.approximations` and `RocketDesign.approximations`, validated on load (each field a string, impact one of minor, moderate, major), carried by `orkToDesign`, `designPlacedComponents` and `designVehicle`; `orkToDesign` adds one notice counting them.
- `packages/formats/src/ork.ts`:
  - `Reader.note` attaches an approximation to the part an element placed, or keeps it until the part is placed; `Reader.finishPart` lists unknown settings of a part instead of refusing.
  - `Reader.attempt` takes a stand-in for the child's own problems only, rolls back what the child placed (including a motor mount) and puts in `standInForInternal`'s mass or design-level entry.
  - The settings of D-084: cant, fillets, cross-sections, overrides, radial offsets, automatic C_D, deployment events, clipped transitions, transition shoulders, launch lug instances, rail button screws, stage overrides.
- OpenRocket probes (GPL harness, black box): `LugProbe.java`, `TransitionShoulderProbe.java`, `StageOverrideProbe.java`, outputs in `reference/rockets/`.

## Tests

- `packages/formats/src/ork.test.ts`: every former refusal of these kinds now asserts its approximation (subject, what, impact) and what was kept, stood in or left out; parts outside the body still refused by name; the D-082 list test uses two outer-part refusals; OpenRocket's figures for three lug instances (mass, CG, positions), a lug override, rail button screws, a transition with both shoulders capped and a stage override.
- `packages/formats/src/design/from-ork.test.ts`: approximations go from the import to the design, through a save and load, to the flight result (confidence low with a major one); a saved approximation with an unknown impact is refused on load; the import notice.
