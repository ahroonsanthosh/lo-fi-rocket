# Plan UI-0001: UI redesign part 1 (review, design, component library)

**Status:** written and carried out 2026-10-12 under autonomous mode (CLAUDE.md section 11).
**Branch:** `feature/ui-redesign`, from `claude/inspiring-tesla-xxp0hh` at 109d117.
**Numbering:** plans and decisions of this workstream use the `UI-` prefix (`docs/plans/ui-NNNN-*.md`, decisions `D-UI-n` in `docs/ui/decisions.md`) because three other sessions are writing plans 0024 onwards and decisions D-060 onwards at the same time. Separate numbering avoids merge conflicts and two decisions with the same number.

## Constraints from the owner

- No existing file under `packages/` changes. The app is reviewed as it is; the new design is applied to the screens in a later prompt, after the other sessions merge.
- New package `packages/ui`: no import from `packages/physics` (nor `packages/formats`, which re-exports physics), no calculation. Components show the values they are given.
- No value the simulator produces may be changed, rounded differently or hidden. Display rules (decimals, unit labels) go in one documented place.
- Every warning and limitation notice the app shows today needs a place in the new design, and no safety warning may become harder to see.

## Tasks

1. **Usability review** (`docs/ui/review.md`). Build the app, drive it in Chromium with a script (`tools/ui-walkthrough/walkthrough.mjs`) through the tasks the owner listed (new rocket, edit, motor, launch, simulate, results, Monte Carlo, `.ork` import, save and reload), save a screenshot per step in `docs/ui/review/`, and rank every finding by how much it hurts a new user. Also an inventory of every warning and notice the app can show today (from the source of `packages/app`, `packages/formats/src/design/to-physics.ts` and the physics warning constants), which the redesign must place.
2. **Redesign** (`docs/ui/redesign.md`): layout tiers (always visible, one click away, advanced), guided path, glossary of terms, warning rules, space for the features of the other sessions (3D viewer, minimum in-flight margin, fin flutter margin, validated-range warnings), visual system (spacing, type, light and dark colour tokens, meaning never by colour alone), accessibility (keyboard, focus, WCAG 2.2 AA), the display formatting rules, and before and after mockups as images in `docs/ui/`.
3. **Component library** (`packages/ui`): layout shell, panel, field with inline validation, number input with unit, stability indicator, warning banner and list, result card, tabs, dialog, tooltip and glossary term, step guide; theme tokens; the display formatting module. Tests for each, including keyboard and accessibility tests (axe-core in jsdom, plus a contrast test of every token pair against WCAG 2.2 AA).
4. **Mockups** are rendered from the library itself (`packages/ui/mockups/`), so the after images show the real components, with data copied from the current app's display of the example rocket (R1) and of R5. Screenshots taken with the same script approach.
5. **Finish**: `pnpm check`, `docs/reports/ui-redesign-part-1.md`, progress note, pull request into `main`.

## Equations and sources

None. This work contains no physics. The glossary's "what a good value looks like" text uses only figures already in the project with a source or a stated status: the stability rules of thumb and the rail exit and thrust-to-weight guidance of CLAUDE.md 9, the 20 m/s deployment rule of thumb of D-042, the 30° NAR rail limit (Niskanen 2009 p. 6, already cited in `validateLaunch`), the parachute drag coefficient 0.8 (Niskanen p. 67, already cited in the recovery editor), and the regime boundaries and validation errors of D-057. Where the project has no sourced figure (for example a typical drag coefficient), the glossary says so instead of giving a number.

WCAG 2.2: the contrast ratio and relative luminance definitions (Success Criteria 1.4.3, 1.4.11 and the "relative luminance" and "contrast ratio" glossary entries) are used only in a test, to check the colour tokens. This is an accessibility standard, not a physics source; recorded in D-UI-2.

## Tests

- Every component: renders what it is given, keyboard behaviour (Tab order, arrow keys in tabs, Escape in dialog and tooltip, focus trap and return in the dialog), ARIA roles and names, axe-core with no violations.
- Number input: valid entries are passed on, invalid ones show the message inline and are not passed on, never shows 0 for a small non-zero value (the defect found in the review).
- Formatting module: decimals table equals the app's current `units/display.ts` decimals (a parity test that reads that file's text, so the two cannot drift before the app adopts the module), `toFixed` behaviour, non-finite values shown as such and never as a number.
- Warnings: acknowledgement never removes or hides the text, the reason sentence is always rendered, danger and caution carry an icon and a text label as well as colour.
- Tokens: every foreground and background pair used for text meets 4.5:1, every non-text indicator 3:1, in both themes.
- Package boundary: an ESLint rule forbids imports of `@lo-fi-rocket/physics` and `@lo-fi-rocket/formats` in `packages/ui`, and a test scans the source for them.
