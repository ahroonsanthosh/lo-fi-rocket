# UI redesign decisions

Decisions of the UI workstream (plan UI-0001). They use the `D-UI-` prefix because other sessions are adding D-060 onwards to `docs/decisions.md` at the same time; when the branches merge, these can be copied there with the next free numbers.

## D-UI-1 (2026-10-12): Separate numbering, no changes to existing files in `packages/`

The owner ruled that no existing file under `packages/` changes in this prompt. The review, the design and the new `packages/ui` are additive; the app keeps working exactly as before. Root files touched: `eslint.config.js` (a boundary rule for `packages/ui`), `pnpm-lock.yaml` (the new package), `docs/progress.md` (one section).

## D-UI-2 (2026-10-12): WCAG 2.2 as the accessibility standard; its contrast formula only in a test

The owner asked for WCAG 2.2 AA. The relative-luminance and contrast-ratio definitions of WCAG 2.2 are implemented in `packages/ui/src/tokens/tokens.test.ts` to check the colour tokens: text at least 4.5:1 (SC 1.4.3), indicators, control edges and the focus ring at least 3:1 (SC 1.4.11). This is not a physics source and is not in CLAUDE.md section 4; it is used for no result the app shows. The helper is checked against two known values (21:1 and 4.54:1). axe-core 4.11.4 is added as a development dependency for the component tests.

## D-UI-3 (2026-10-12): Display rules reproduce today's rounding; edit fields never misstate a value

`packages/ui/src/format/display-rules.ts` holds every label and decimal count the app uses, copied from `units/display.ts` and the panels' `toFixed` calls, with parity tests that read those files. `formatFixed` is `toFixed` itself, so displayed results are identical. The one deliberate difference is the text of an editable field: the app shows `toFixed(max(decimals, 3))`, which displays a relative tolerance of 1e-8 as 0 (review finding 4). `editText` keeps that rule unless it would show a non-zero value as 0 or a value more than 0.1 % away from the one held, and then shows six significant digits. The 0.1 % bound is a display choice, not physics: it keeps today's text for every case in the review (for example 4.921 ft for 1.5 m) and catches every misstatement found.

## D-UI-4 (2026-10-12): Warnings split at their first colon now; as structured data later (proposal)

Warning messages are built as sentences in `packages/formats` and the physics, with numbers rounded there and always in SI units. The redesign shows each as title (before the first colon), reason (after it) and detail (the source or decision reference), keeping every word. Proposed for the apply prompt, needing the owner's agreement because it changes `packages/formats`: `designFlightWarnings` returns the code, the numbers with their quantity kinds, and the reason sentence separately, so the app formats the numbers with the display rules and the units setting, and the two reports of the 90° model limit can be grouped.

## D-UI-5 (2026-10-12): Warning severities

Four severities, each with its own icon shape, word and colour: Danger (unstable margin, no recovery, rail exit below the minimum, deployment above the maximum, rail angle above the NAR limit, stability not computable, simulation failed), Caution (overstable margin, thrust-to-weight below the minimum, motor wider than the mount, maximum time reached, Monte Carlo failures), Model limit (transonic and supersonic regimes, every physics model warning, the 90° limit, an imported drag curve), Note (stale results, imports, recovered autosave). The thresholds behind them stay the editable rules of thumb of CLAUDE.md 9 and D-042; the severity changes only how a warning looks, never whether it is shown. No warning can be dismissed; acknowledging records that it was read and changes nothing else.

## D-UI-6 (2026-10-13): The console look of the owner's reference, dark by default

The owner supplied a reference image (a spacecraft "Vehicle overview" console) and asked for the app to look like it: clean, new, refined, adapted where needed. Applied: one screen on a deep indigo field with a lavender glow behind the vehicle, a checklist on the left, square dial tiles around the vehicle, telemetry readouts with thin bars on the right, a trapezoid dock of views at the foot, a joined two-way switch at the bottom left and an outlined More button at the bottom right, small capitals for labels. The dark palette was refitted to colours sampled from the reference image; every token pair still passes the WCAG 2.2 AA test of D-UI-2, with three new pairs (the neutral "finished" mark, control edges and accent on the page background). Dark is the default theme (stored per browser); light remains, from the More dialog or the top-bar switch.

Adaptations, each for a stated reason: the reference marks the open dock item in red, but red is reserved for danger here (D-UI-5), so the open view is marked by the accent colour, weight and `aria-current`; the reference's dials carry no words, but every status here is also written under its dial (redesign section 1, principle 5); Lato is bundled from `@fontsource/lato` 5.2.7 (SIL Open Font License 1.1) so the app keeps working offline, with the system font as fallback.

## D-UI-7 (2026-10-13): What a dial or a bar may picture

A dial or bar is a picture of a number that is always printed beside it; it never stands alone and it is never clamped silently. Scales, all display choices with no physics in them:

- Stability margin: 0 to twice the "may be overstable" threshold (0 to 4 calibers by default), with the two editable thresholds marked.
- Rail exit velocity, thrust-to-weight and deployment velocity: 0 to twice their editable threshold, with the threshold marked; the zone colours follow the direction of the warning in `designFlightWarnings` (below the minimum, or above the maximum).
- Maximum Mach: 0 to 2.0, the validated range, with marks at 0.8 and 1.2: the same boundaries, compared the same way (strictly greater), as the transonic and supersonic warnings in `packages/formats`.
- CG and CP: 0 to the rocket's length, read as "how far back from the nose".
- Apogee, maximum velocity and other figures without a meaningful scale get no bar.

A value beyond the ends says so in words ("above the dial (4.00 calibers)"); a missing one says why ("simulate to see", "choose a motor"); a non-finite one is written out and marked.

## D-UI-8 (2026-10-13): Views, the dock, and where each part of the redesign went

The main column shows one view at a time: Overview, Airframe, Motor, Recovery, Launch and Flight, opened from the dock, from a checklist step or by selecting a part. The redesign's status bar became the telemetry at the top of the right column; the checks column is the rest of it (warnings first, then the stability card, the in-flight checks, mass and size), so both stay on screen as the plan requires. The launch site, rail and wind moved out of the flight panel into the Launch view. The Flight view holds the run button, the results, the 3D replay, the plots, the recorded-flight comparison and the Monte Carlo dispersion together, which keeps the 3D lane's tests (which simulate and then use the replay and "Run dispersion" together) passing without changes. File actions moved behind a File menu; file notes and failures, the recovered-autosave note, stale results and simulation errors are all listed in the checks column (redesign section 5). Units are the switch at the bottom left; the theme and the glossary are in the More dialog.

## D-UI-9 (2026-10-13): Unstored plot values are gaps

The flight samples store NaN where a value does not exist in that phase (the Mach number and angle of attack after the parachute opens). The plot drew those as NaN coordinates and NaN poisoned the axis range, so the Mach plot was blank. Such points are now left out of the axis range and drawn as gaps, and the plot says "Gaps: no value stored there". No value is interpolated or invented. Event labels are staggered (review finding 25).

## D-UI-10 (2026-10-13): D-UI-1 ends with this prompt

D-UI-1 kept every existing file under `packages/` unchanged while the design was prepared. This prompt is the "apply" prompt that D-UI-1 deferred to, so the ui lane now edits `packages/app` and `packages/ui`. No file in `packages/physics`, `packages/formats` or `packages/viewer`, and no `FlightViewer*` file, is changed.

## D-UI-11 (2026-10-13): Simplify after the owner's review of the console

The owner reviewed the console (D-UI-6 to D-UI-8, PR #52) as very cluttered and asked for something far simpler, cleaner and easier to understand, "simple and brutally effective" like Tesla's interfaces, with usability first. Plan UI-0002 (`docs/ui/simplify.md`) replaces the console layout. The rules of `redesign.md` on warnings (section 5), terms (section 4), accessibility (section 7) and display (section 8) are unchanged; no number the app shows changes, and nothing in `packages/physics`, `packages/formats`, `packages/viewer` or any `FlightViewer*` file is touched. The UI library loses `Gauge`, `Meter`, `Dock`, `StepGuide` and the `StatusItem` of `AppShell`, and the console mockups (`packages/ui/mockups`, `tools/ui-walkthrough/mockups.js`) are removed with them.

## D-UI-12 (2026-10-13): A flat neutral palette that follows the system theme

The indigo console palette of D-UI-6, its glow, rings and bezel are replaced by near-white and near-black surfaces, one blue accent, and status colours used only for status, always with an icon and a word. The theme follows the system setting (`prefers-color-scheme`) unless the user picks Light or Dark in Settings; the stored choice is per browser. Every token pair passes the WCAG 2.2 AA test of D-UI-2 in both themes (30 pairs per theme). Radii are 6, 10 and 16 px; Lato stays bundled (D-UI-6).

## D-UI-13 (2026-10-13): Three numbers on the stage; one list with pages in the task panel

The stage shows the rocket on its side with the CG and CP, and three numbers that decide whether a flight is safe and worth flying: stability margin at liftoff (with the burnout margin under it), apogee, and rail exit velocity against the editable minimum. Each has its status in words. One sentence from the physics explains the stability margin. Every other figure is one tap away in the task panel, whose home page ("Your rocket") is a single list: the outside parts, the parts inside the airframe, "Add a part", the motor, recovery, launch, stability and mass, and the flight. Opening a row shows its page with a "Your rocket" back button; selecting a part in the side view opens the same page. A new design offers only the next missing core part (body tube, then nose cone, then fins). The "Simulate the flight" row is an accent bar only when a motor is chosen. This replaces the checklist, the dock, the dial tiles, the telemetry bars and the overview tables of D-UI-7 and D-UI-8. Choices made for the 3D lane's unchanged tests: the Flight row is on the home page, the units switch is in the top bar, and after a simulation the stage shows the 3D replay while the panel shows the results and "Run dispersion".

## D-UI-14 (2026-10-13): Warnings only when there are any; "All clear" otherwise

When the design has no warning, the top bar says "All clear" once, in small type, and the task panel shows no warning area. When it has any, every warning is shown in full at the top of the task panel on every page, and the top bar says how many, in the colour of the most severe, linking to them. Warnings stay never dismissible and never only in a closed panel (redesign section 5); this only removes the empty "No warnings" panel.
