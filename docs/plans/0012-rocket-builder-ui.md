# Plan 0012: Rocket builder UI (Prompt 3 step 2)

**Status:** written 2026-10-12 under autonomous mode; Prompt 3 step 2 of plan 0011.
**Phase:** 3 (CLAUDE.md section 9 and 10).

## Goal

A React application in `packages/app` where a user builds a rocket from components and sees mass, length, CG, CP and the stability margin update live, with a 2D side view carrying CG and CP markers, plain-language stability guidance against configurable thresholds, a metric/imperial units toggle, keyboard-accessible controls, and an autosave of the design to the browser's local storage. Motors, launch conditions and simulation arrive in steps 3 and 4; files in step 5. This step contains no physics: every number comes from `@lo-fi-rocket/physics` through the adapter of plan 0011.

## Conventions

- **State.** One `RocketDesign` in a `useReducer` store (`src/state/`), actions are the only way to change it; every action returns a new design that still validates. Selection and the unit system are UI state next to it. No external state library (D-043).
- **Units at the boundary.** Inputs show values in the display unit of the chosen system and convert to SI on every edit with the UNIT-1 to UNIT-11 functions or their exact inverses (`src/units/display.ts`); the design holds only SI. Metric shows mm, g, kg, m, m/s, kg/m³, °C, hPa; imperial shows in, oz, lb, ft, ft/s, lb/ft³, °F, psi (the last two derived from the exact factors). Angles are degrees in both systems.
- **Validation at the boundary** (CLAUDE.md 8). Each field has a rule (greater than 0, 0 or greater, an integer of 1 or more); a failing entry shows "<Field> must be greater than 0 mm" under the field and leaves the design unchanged, so the physics never sees it. Any `InvalidInputError` or `NotImplementedError` from the physics (for example a fin set wider than the model allows) is shown in the stability panel with its own message instead of a number.
- **Stability shown at all times** at the design Mach number 0.3, worst roll angle, with Niskanen's roll reduction (D-016). Margins at liftoff and burnout when a motor is selected; otherwise the empty rocket's margin with a note. Colours: red below `unstableBelow`, green inside, amber above `overstableAbove`; the thresholds are editable and labelled as rules of thumb.
- **Side view.** SVG, nose tip at the left, x to the right (docs/conventions.md body frame). External parts drawn from their profiles (nose and transition sampled from `noseProfile` and `transitionProfile`), fins as their planform above and below the body, lugs and rail buttons on the surface, internal parts dashed. CG is the blue-and-white quartered circle, CP the red circle with a dot, both at the stability condition. The view fits the window width.
- **Autosave** (D-043): the serialized design is written to `localStorage` under `lofi-rocket:design:<id>` after each change (debounced 300 ms) and `lofi-rocket:last` names the current id; on start the last design is loaded through `parseDesign`, and a file that fails validation is kept under `lofi-rocket:recovered:<id>` and reported, never deleted.
- **Accessibility.** Native controls only, labels on every input, the component list is a listbox with arrow-key navigation, the units toggle is a radio group, the colour of the stability banner is accompanied by text.

## Files

| File                                     | Purpose                                                                                                                           |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `packages/app/src/units/display.ts`      | unit specs per quantity kind and system, format and parse, exact inverses of UNIT-1 to UNIT-11                                    |
| `packages/app/src/state/reducer.ts`      | actions on the design and UI state; defaults for new components                                                                   |
| `packages/app/src/state/autosave.ts`     | local storage read and write                                                                                                      |
| `packages/app/src/state/store.tsx`       | the React context and hooks                                                                                                       |
| `packages/app/src/components/*.tsx`      | `App`, `Header`, `ComponentList`, `ComponentEditor`, `QuantityField`, `SideView`, `StabilityPanel`, `MassPanel`, `RecoveryEditor` |
| `packages/app/src/styles.css`            | layout and theme                                                                                                                  |
| tests next to each file (`*.test.ts(x)`) | reducer, display units, side view geometry, App with Testing Library in jsdom                                                     |

## Tests

- `display.test.ts`: each imperial unit converts a hand value and round-trips (25.4 mm = 1 in, 1 lb/ft³ = 16.01846337396 kg/m³ from the exact factors, 1 psi = 6894.757293168 Pa, printed SP 811 values 1.601 846 E+01 and 6.894 757 E+03 within half a printed unit), formatting uses the stated decimals.
- `reducer.test.ts`: adding a component appends it with a unique id and a position at the tail; updating keeps other fields; removing the mount's component clears the motor mount; moving reorders; every resulting design passes `validateDesign` (property over random action sequences).
- `SideView.test.tsx`: the example rocket renders one path per external component and the two markers at the CG and CP x positions scaled by the view's factor.
- `App.test.tsx`: renders the example design with the Phase 1 figures (CG 0.387 m, CP 0.479 m, margin 1.84 calibers, "typical"); typing 0 into the fin root chord shows "Fin root chord must be greater than 0 mm" and the figures do not change; switching to imperial shows the chord as 3.937 in; adding a fin set moves the CP aft and the margin up; the autosave key holds the serialized design after an edit, and a reload restores it.
