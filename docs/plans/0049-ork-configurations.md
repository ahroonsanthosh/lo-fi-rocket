# Plan 0049: .ork motor configurations, per-configuration deployment, fin cross-sections

## Problem

None of the seventeen example designs bundled with OpenRocket 24.12 opened. The first blocker in thirteen was "N motor configurations"; nine use rounded or airfoil fins, which the reader refused although the drag model supports them.

## What OpenRocket does (black box, CLAUDE.md 3)

`tools/openrocket-harness/src/ConfigProbe.java` saves and reloads four rockets: fins with each cross-section (masses), and a rocket with three configurations, the second marked default, whose parachute opens at apogee by default, at 150 m in the second configuration and never in the third. Output: `reference/rockets/config-probe/values.txt`.

## Change

- `packages/formats/src/ork.ts`: select the configuration marked default; read that configuration's motor, ignition (launch, no delay) and per-parachute deployment; a mount with no motor there imports with no motor; rounded and airfoil fins read with their cross-section; `OrkRocket.notices` carries what was chosen or approximated, passed into the import notices by `orkToDesign`.
- Decision D-077.

## Tests

`packages/formats/src/ork.test.ts`: the probe files (default configuration and notice, the parachute's altitude deployment of 150 m, cross-sections and notices, slab fin mass 0.0324 kg by hand equal to OpenRocket's square figure); refusals for several configurations with none marked default, an ignition delay, and an unknown cross-section.
