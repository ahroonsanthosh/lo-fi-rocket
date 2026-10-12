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
