# Plan 0045: issue #19, plain-language warnings

Lane: physics (the messages come from the simulator and the design adapter); the app shows them. Issue: #19 (major).

## Problem

Flight warnings read like developer logs. They quoted chart edges ("Δy = 0.00 % ... DATCOM figure 4.1.3.4-23a (D-070)"), reading uncertainties, decision IDs, plan numbers and document paths, and named fin sets by index ("component 2"). CLAUDE.md 9: every warning explains why it matters in one sentence.

## Change

- physics `FlightResult.notes` (new) holds the technical detail. `warnings` keeps only what the user should know and act on.
  - Every message from the aerodynamic and drag models (chart limits, fairings, reading uncertainty, regime accuracy statements) goes to `notes`.
  - The large-angle availability message goes to `notes`.
  - The model-limit reason goes to `notes`; its plain message is the existing design warning for `endReason: 'model-limit'`.
  - The RK4 step check, flutter and in-flight margin warnings are rewritten as plain sentences, and their sources go to `notes`.
- physics `summary.regimes` records `{ transonic, supersonic, beyondValidated, largeAngle }` over powered flight and coast. The design warnings turn these into plain messages; the new design code is `large-angle`.
- physics `FlightVehicle.componentNames` (optional) names the fin set in the flutter warnings. formats `designVehicle` fills it from the design.
- formats design warnings drop "(D-046)" and the document paths. The above-Mach-2 message now says "supersonic".
- `packages/app/src/components/FlightPanel.test.tsx` (ui lane): one assertion required the document path `held-out-validation` in the warnings list. It now requires its absence. This is the only change outside the lane, made so that `main` stays green.

The app does not yet show `notes` behind a "Details" toggle; that is ui lane work. The stability panel's "roll-angle reduction applied (D-016)" and "Normal force derivative C_Nα" are app text, also for the ui lane.

## Tests

- physics `simulate.plain-warnings.test.ts`:
  - R1 falling tail first and R5 through the transonic band: no warning matches decision IDs, plan numbers, DATCOM figures, document paths or equation references;
  - the notes keep the detail, and the regime flags are set;
  - a named fin set appears by name.
- formats `plain-warnings.test.ts`: the example without a shear modulus names "Fins"; a supersonic variant gives `supersonic`; no jargon in any design warning.
- Updated tests now read technical text from `notes`: limits, ballistic, R1 and R5.

No golden output changes: the golden files store neither warnings nor notes.
