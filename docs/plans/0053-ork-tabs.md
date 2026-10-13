# Plan 0053: .ork fin tabs, parts inside inner tubes, motor types

## Problem

After plan 0052, the next blockers on OpenRocket's example designs were fin tabs, an engine block inside a motor tube, motor types "reload" and "hybrid", a plugged motor's delay "none", and the `<designer>` element.

## What OpenRocket does (black box, CLAUDE.md 3)

`tools/openrocket-harness/src/TabProbe.java`: a fin set without a tab and with a 0.06 × 0.012 m tab offset 0.01 m from the root's front, centre and end, and an engine block in a motor tube; saved, reloaded and measured (`reference/rockets/tab-probe/values.txt`).

## Change

- `packages/physics/src/geometry/components.ts`: `TrapezoidFinSetComponent.tab` and `combineFinTab` (GEO-14, registered in `docs/equations.md`).
- `packages/formats/src/ork.ts`: `readFinTab`; inner tube children read as inside a tube; motor types; plugged motors; `<designer>` ignored. `orkToDesign` carries a plugged motor as no ejection delay.
- Decision D-081.

## Tests

- `components.test.ts`: tab mass, CG and rotational inertia by hand; a tab higher than the body radius is refused.
- `ork.test.ts`: the fin set's mass and CG against OpenRocket for no tab and each tab reference; the tab front edges; the zero-thickness engine block; a plugged motor; motor types.
