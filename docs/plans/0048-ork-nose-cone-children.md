# Plan 0048: components inside a nose cone in the .ork reader

## Problem

The owner's `.ork` file "Blackhawk 29 supersonic (Wildman BH29, AeroTech DMS I205W-14A, drogueless dual deploy) v2" is rejected: `nosecone "Nose cone 6:1 conical (Wildman)": element <subcomponents> is not supported by the minimal .ork reader`. The reader read children of body tubes only.

## What OpenRocket does (black box, CLAUDE.md 3)

`tools/openrocket-harness/src/NoseChildProbe.java` builds nine rockets (ogive nose 0.150 m, base radius 0.025 m, a 0.020 m mass component with each axial method, with and without a 0.040 m aft shoulder, and one with a parachute and a bulkhead), saves them, reloads them with OpenRocket 24.12 and prints positions, structure mass and CG (`reference/rockets/nose-child-probe/values.txt`). Result: the methods resolve against the cone's own length; the shoulder does not count.

## Change

- `packages/formats/src/ork.ts`: `readNoseInternal` reads mass components, parachutes, bulkheads and centering rings inside a nose cone with the existing readers and `axialPosition`; fins, lugs, rail buttons and inner tubes are refused by name (they use the parent radius, which varies along a cone).
- Decision D-076.

## Tests

`packages/formats/src/ork.test.ts`, "components inside a nose cone": the fore end of the mass component by hand for each method (exact), the structure mass and CG against OpenRocket for all nine files (1e-5; the closed-form ogive shell differs from OpenRocket's numerical one by 5e-6 of the total), and the parachute and bulkhead positions of case 8 by hand.
