# Plan 0050: .ork automatic values, shoulders, no default configuration

## Problem

After plan 0049 the next blockers on OpenRocket's example designs were values written "auto 0.0123", capped shoulders, shoulders of zero thickness, a file with three configurations and none marked default, and the cosmetic `<insideappearance>`.

## What OpenRocket does (black box, CLAUDE.md 3)

`tools/openrocket-harness/src/ShoulderProbe.java`: four nose cones (shoulder open or capped, wall 0.002 m or 0) and one rocket with automatic radii, saved, reloaded and measured; output in `reference/rockets/shoulder-probe/values.txt`. `tools/openrocket-harness/src/SelProbe.java`: the configuration OpenRocket opens a file in.

## Change

- `packages/formats/src/ork.ts`: "auto <number>" read as the number in every numeric element; zero-thickness shoulders read as none; capped shoulders add a disc component ("shouldercap"); no default configuration imports with no motor; `<insideappearance>` ignored.
- Decision D-078.

## Tests

`packages/formats/src/ork.test.ts`: the probe files (nose mass and CG against OpenRocket to 1e-6 for all four shoulder cases, the cap's mass and position by hand, the resolved automatic radii); a cap on a nose without a shoulder adds nothing; a capped R2 shoulder adds the cap; a negative shoulder thickness is malformed; two configurations with none default import with no motor and a notice.
