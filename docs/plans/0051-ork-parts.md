# Plan 0051: .ork parachute materials, automatic parachute C_D, shock cords, tube couplers, engine blocks

## Problem

After plan 0050, the next blockers on OpenRocket's example designs were parachutes whose mass comes from their canopy and line materials, the automatic parachute drag coefficient, and three part types the reader did not know: shock cords, tube couplers and engine blocks.

## What OpenRocket does (black box, CLAUDE.md 3)

`tools/openrocket-harness/src/PartsProbe.java` builds one rocket with a 0.6 m parachute of 0.067 kg/m² fabric and eight 0.5 m lines of 0.0018 kg/m on the automatic C_D, a 1.5 m shock cord of 0.005 kg/m, a tube coupler and an engine block; saves, reloads and prints each part's mass and CG and the parachute's C_D (`reference/rockets/parts-probe/values.txt`).

## Change

- `packages/formats/src/ork.ts`: parachute mass from materials; automatic C_D 0.8 with a notice (the owner's choice); `readShockCord`, `readTubeCoupler`, `readEngineBlock`, accepted in body tubes and nose cones; `Element.materialDensity` for surface and line materials.
- Decision D-079.

## Tests

`packages/formats/src/ork.test.ts`: every part's mass and CG by hand against OpenRocket's; the C_D and its notice; R1 without its parachute override computes the mass from materials; a canopy of the wrong material type is refused.
