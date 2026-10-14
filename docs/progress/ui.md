# Progress: ui lane

Updated by the ui session after every pull request. See "Parallel sessions" in CLAUDE.md.

## Done

- 2026-10-13, branch `claude/gallant-clarke-oi4jv3` (second pull request): the console simplified on the owner's review (`docs/ui/simplify.md`, D-UI-11 to D-UI-14).
  - `packages/ui`: flat neutral palette with one blue accent that follows the system theme, still WCAG 2.2 AA; `AppShell` is now top bar, stage, warnings and task panel; `Gauge`, `Meter`, `Dock`, `StepGuide` and the console mockups removed.
  - `packages/app`: the stage shows the rocket on its side and three numbers (stability, apogee, rail exit velocity) with their status in words; the task panel is one list ("Your rocket") whose rows open pages with a back button; warnings appear only when there are any, and the top bar says "All clear" or how many; Settings holds the theme and the glossary; after a flight the stage shows the 3D replay.
  - Checks: `pnpm check` green; the five Playwright end-to-end tests pass in Chromium; the 3D lane's `FlightViewer` tests pass unchanged.
- 2026-10-13, branch `claude/gallant-clarke-oi4jv3`: the redesign plan (`docs/ui/redesign.md`) applied to `packages/app` in the look of the owner's reference image, an instrument console (D-UI-6 to D-UI-10, redesign section 12).
  - `packages/ui`: palette refitted to the reference, still WCAG 2.2 AA; new `Gauge`, `Meter`, `Dock`, `Segmented` and `Icon`; console `AppShell`; stylesheet rewritten.
  - `packages/app`: views opened from a dock; the upright shaded rocket with dials around it; telemetry, warnings and the stability card always on screen; File menu; More dialog with the theme and the glossary; Lato bundled for offline use.
  - Fixed on the way: the Mach and angle-of-attack plot was blank (NaN samples made its axis NaN); plot event labels overlapped (review finding 25).
  - Checks: `pnpm check` green; the five Playwright end-to-end tests pass in Chromium; the 3D lane's `FlightViewer` tests pass unchanged.

## Next

- Rebuild the editors' fields on `NumberInput` and `SelectField` (today they are restyled, not rebuilt).
- A confirmation dialog before New, Open, Load example and Import replace the design.
- Structured warnings (D-UI-4) once the formats owner agrees.

## Open questions

- Redesign section 10 questions 1 to 3 are still open (default ejection delay, warnings as data, static margin next to the in-flight margin).
- The 3D replay's sky is a fixed light colour in `packages/viewer`; it suits the light theme now, but not the dark one. Raised with the 3D lane: https://github.com/ahroonsanthosh/lo-fi-rocket/issues/51.
