# Plan 0044: issue #17, an unstable rocket must not get a normal-looking result

Lane: physics (the statement); the app shows it. Issue: #17 (major).

## Problem

The example with its fins removed (−5.70 calibers) flew to a normal-looking 167 m apogee in still air: nothing disturbs the model, so it flies straight. The only hint was the in-flight margin warning "the rocket may not fly straight there", listed among other warnings.

## Change

- physics `simulate.ts`: `summary.unstable` is the most negative of the powered and coast minimum margins (plan 0030), or undefined when the margin stayed at 0 or above. When it is set:
  - the first warning states that the rocket is unstable, where and by how much;
  - it says that the apogee, speeds and landing point are not a prediction, and what to change;
  - the in-flight margin warning is not repeated for the negative phases. Positive margins below the minimum still get it.
- formats `designFlightWarnings`: code `unstable`, first in the list, carrying that statement once.

Not done: the issue's suggestion of a seeded initial disturbance so that the 6DOF model shows the instability. It needs a sourced disturbance model (CLAUDE.md rule 1) and a decision; it is left as an open question for the owner. The app can use the code to dim or hide the summary figures (ui lane).

## Tests

- physics `simulate.unstable.test.ts`:
  - R1 without fins: `unstable` is the minimum of the two phase minima (below −1 caliber);
  - the first warning is the exact statement;
  - no "fell to −" warning;
  - R1 as built: neither appears.
- formats `unstable-warning.test.ts`: the finless example leads with `unstable`, once; the shipped example has none.

No golden output changes: the five reference rockets stay stable.

## Follow-up: the margin covers the ascent only

Found while checking issue #33: a rocket with no open recovery device stays in the `coast` phase after apogee, and its fall was counted in the coast minimum margin (0.73 calibers at Mach 0.04 and 54° on the example). That contradicts plan 0030 and the `minimumStability` documentation (burnout to apogee). It would also have let a stable rocket falling tail first be reported unstable. The minimum is now taken only before apogee.

Test: R1 with no recovery on the large-angle model lands; its coast minimum is at or before apogee; it is not reported unstable; and there is no in-flight margin warning. No golden output changes: the reference flights deploy at apogee.
