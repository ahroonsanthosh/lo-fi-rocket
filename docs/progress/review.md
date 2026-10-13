# Progress: review lane

Updated by the review session after every pull request. See "Parallel sessions" in CLAUDE.md.

## Done

- 2026-10-12: First new-user pass over https://ahroonsanthosh.github.io/lo-fi-rocket/ (Chromium, 1366×768 and 390×844). Filed issues #8 to #29 (22 issues), each labelled `bug` plus the owning lane.
  - Critical: #8 ThrustCurve.org search always empty, #9 no warning when the ejection charge fires before apogee, #11 editing the body tube leaves parts inside it or past its end and changes stability silently.
  - Major: #10, #12, #13, #14, #15, #16, #17, #18, #19.
  - Minor: #20 to #29.
- Hand checks that passed on the example rocket (R1, D12):
  - mass without motor 148.3 g and CG 335.9 mm (hand sum over all nine components)
  - liftoff CG 387.0 mm and burnout CG 364.9 mm
  - CP 478.9 mm (Barrowman with the 15 % three-fin reduction of D-016)
  - descent rate 6.9 m/s from C_D·A = 0.0565 m²
- Flights of the five reference .ork files against `reference/rockets/values.csv`: apogee R1 +3.5 %, R2 -0.8 %, R3 -3.5 %, R4 +2.6 %. Max velocity and rail-exit velocity are within 2 %. R5 runs with transonic warnings.

- 2026-10-13: Second pass. Covered:
  - motor import (.eng, .rse, custom CSV, including malformed files)
  - altimeter comparison and drag-curve import (in range, out of range, negative C_D)
  - every recovery deployment mode, and two parachutes
  - rail angle, wind profile, turbulence (repeat runs bit-identical with the same seed), RK4 against Dormand–Prince (same apogee to 0.01 m), latitude gravity, pad altitude
  - stored designs

  Filed issues #32 to #42.
  - Critical: #32 "At launch" deployment never leaves the pad and shows NaN, #33 no warning when the parachute never opens, #34 deployment before apogee shows "— at —" and NaN with no speed warning.
  - Major: #35, #36, #37, #38, #39.
  - Minor: #40, #41, #42.
  - Added a comment to #23.

- Checks that passed in the second pass:
  - custom curve impulse 41.00 N·s (trapezoid by hand)
  - clear errors for malformed thrust CSV and .eng files
  - drag curve refused outside its Mach range instead of extrapolated
  - deployment-speed and rail-angle warnings for apogee deployments

## Next

- Re-test the fixed issues once they are merged.
- Not yet covered: .ork files with unsupported parts, autosave migration from an older schema version, contrast and screen-reader pass, Monte Carlo with every dispersion input.

## Open questions

- None.
