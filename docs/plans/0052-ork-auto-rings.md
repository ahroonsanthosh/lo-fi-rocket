# Plan 0052: .ork automatic ring radii, parts inside a coupler, radially offset masses

## Problem

After plan 0051, the next blockers on OpenRocket's example designs were centering rings, bulkheads and couplers whose radii are a bare "auto" (OpenRocket writes no value for these), parts inside a tube coupler, and a radially offset nose weight.

## What OpenRocket does (black box, CLAUDE.md 3)

`tools/openrocket-harness/src/AutoRingProbe.java` builds one rocket with automatic bulkheads in an ogive nose, automatic centering rings around and clear of a motor tube, an automatic bulkhead in the body tube, and an automatic coupler holding a bulkhead and a mass; saved, reloaded and measured (`reference/rockets/auto-ring-probe/values.txt`).

## Change

- `packages/formats/src/ork.ts`: `Parent.autoOuterRadius` (body tube, hollow nose cone, coupler) and `Parent.innerTubes` (read ahead with `innerTubeSpans`); `Element.radiusOrAuto`; rings, engine blocks and couplers use them; coupler children read; radially offset mass components placed on the axis with a notice.
- Decision D-080.

## Tests

`packages/formats/src/ork.test.ts`: every automatic radius, the coupler children's positions, and every part's mass and CG against OpenRocket's, the nose radii worked by hand; R1's ring with an automatic inner radius fits its motor tube (0.0125 m); a radially offset weight keeps its mass and axial position and gets a notice.
