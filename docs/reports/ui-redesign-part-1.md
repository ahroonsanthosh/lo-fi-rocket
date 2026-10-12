# UI redesign, part 1: review, design and component library

**Date:** 2026-10-12. **Branch:** `feature/ui-redesign` from `claude/inspiring-tesla-xxp0hh` at 109d117. **Plan:** UI-0001. **Decisions:** D-UI-1 to D-UI-5 (`docs/ui/decisions.md`).

## What was delivered

| Part                 | Deliverable                                                                                                                                                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Usability review  | `docs/ui/review.md`: 26 findings ranked by harm to a new user, 27 screenshots in `docs/ui/review/`, and an inventory of every warning and notice the app shows                                                                                                                                                    |
| 2. Redesign plan     | `docs/ui/redesign.md`: layout tiers, guided path, glossary, warning rules with a place for every current notice, space for the parallel sessions' features, visual system, accessibility, display rules, before and after mockups (`docs/ui/mockups/`)                                                            |
| 3. Component library | `packages/ui`: layout shell and status bar, panel, fields with inline validation, number input with unit, stability indicator, warning banner, list and summary, result card, tabs, dialog, tooltip and glossary term, step guide, file button; tokens for light and dark themes; the display rules; the glossary |

Tools: `tools/ui-walkthrough/walkthrough.js` (drives the app and takes the review screenshots) and `mockups.js` (renders the mockups from the library).

## The most important findings

1. Results of a previous, different rocket stay on screen after New, Open, Load example or Import, including "No warnings." and the plots.
2. Flight results and Monte Carlo figures are cut off at the panel edge at laptop size.
3. A relative tolerance of 1e-8 is shown as 0 in its field.
4. The Mach and angle-of-attack plot is empty for every flight tried; the plot's range code falls back to an empty frame when a value is not finite, so a sample is probably NaN. Not confirmed or fixed here (no changes to `packages/`); listed for the follow-up.
5. All warnings look alike, design-time warnings vanish when another editor is open, and the stability colour reflects liftoff only.

## Rules kept

- **No existing file under `packages/` changed** (`git diff --stat` against the base touches only new files there). The app's three end-to-end tests pass unchanged.
- **`packages/ui` has no physics and no calculation**: an ESLint rule and a test forbid imports of `@lo-fi-rocket/physics` and `@lo-fi-rocket/formats`. Components display what they are given; the stability level, warning severity and step status are decided by the app.
- **No value changed, rounded differently or hidden**: the display rules reproduce today's rounding with `toFixed` itself and are tested against the app's source line by line. Non-finite values are written out, never hidden. The one deliberate change is the edit text of a field that would otherwise misstate its value (D-UI-3).
- **Every warning has a place**: the redesign's section 5 maps every item of the review's inventory to a severity and a place. None can be dismissed; acknowledging changes nothing but the word "Acknowledged" (tested).

## Checks

`pnpm check` (typecheck, lint, format, tests): all clean, **800 tests in 71 files** pass, of which 161 are new in `packages/ui` (17 files): formatting parity and behaviour, token contrast for 27 pairs in each theme, the glossary's sources, the package boundary, and every component's rendering, keyboard behaviour and axe-core result. `pnpm --filter @lo-fi-rocket/app e2e`: 3 passed. No physics changed; no golden output affected.

## Limits of this part

- The mockups are rendered from the library with figures copied from the app; their side view and plots are placeholders for the existing `SideView` and `LinePlot`.
- axe-core cannot check colour contrast in jsdom; the token test covers contrast instead, and a manual contrast check on the applied screens belongs to the next prompt.
- The library has not yet been exercised by the app; adopting it will show gaps (for example the parts list and the plots are not library components).

## Next (the apply prompt, after the other sessions merge)

1. Replace the app's layout and panels with the library, per the mapping in `docs/ui/redesign.md` section 11, keeping the end-to-end tests' figures identical.
2. Fix review findings 1 to 5 in the app, including finding the non-finite sample behind the empty Mach plot.
3. Owner decisions needed: the default ejection delay, warnings as structured data in `packages/formats` (D-UI-4), and how the minimum in-flight margin sits next to the static margin (redesign section 10).
