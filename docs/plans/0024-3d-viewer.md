# Plan 0024: 3D flight viewer (`packages/viewer`)

**Status:** written 2026-10-12 under autonomous mode (CLAUDE.md section 11); implemented on the branch `feature/3d-viewer` from the head of `claude/inspiring-tesla-xxp0hh` (109d117).
**Phase:** follow-up to the roadmap. Does not touch `packages/physics`, `packages/formats`, `CLAUDE.md`, `docs/equations.md`, `docs/known-limitations.md` or `reference/`.

## Goal

A three.js viewer that replays a `FlightResult` exactly as the simulator computed it. The viewer computes no physics: every position, attitude, velocity, event and number it shows is a stored value of the simulator's output. Between two stored steps the rocket's pose is interpolated for the display only (the picture would otherwise jump); every number on screen is the stored value at the nearest step and is labelled with that step's time.

## Data the viewer reads (unchanged types from `packages/physics` and `packages/formats`)

- `FlightResult.samples[]`: `time`, `position` (world ENU, metres), `velocity`, `orientation` (unit quaternion rotating body vectors into world vectors, docs/conventions.md), `altitude`, `speed`, `airspeed`, `mach`, `angleOfAttack`, `cg`, `cp`, `stabilityCalibers`, `phase`.
- `FlightResult.events[]`: `kind`, `time`, `detail`. The simulator records a sample at every event (`record(true)` after each fired or timed event), so each event has a sample at exactly its time; the viewer places the marker at that sample's stored position and never interpolates an event position. If a result ever lacks the sample (another producer of results), the marker goes to the nearest stored step and is labelled with that step's time.
- The stored `position` is the position of the centre of gravity: the simulator integrates Newton's laws for the point at which the forces act, rotates about the CG, starts it at the pad origin and measures the rail travel on it (`simulate.ts`, DYN-12). The rocket model is therefore drawn with its stored `cg` (x from the nose tip, per sample) at the stored `position`.
- The design's geometry: `PlacedComponent[]` (nose cones, body tubes, transitions, fin sets, launch lugs, rail buttons) and the physics profiles `noseProfile` and `transitionProfile` of GEO-1 and GEO-2, so the drawn outline is the same curve the mass and drag models integrate.
- Launch inputs for the static scene: the rail (`length`, `angleFromVertical`, `azimuth`, direction from the physics `railDirection`, DYN-6) and the ground wind (`speed`, `from`; the first row of a profile when one is given).
- `DispersionResult`: `runs[].landingEast`, `landingNorth`, `summary.meanLanding`, `summary.containmentRadius95`, and `runs[].sampled` to replay a run.

## Requests for later (data the results do not contain; no physics change in this plan)

1. The wind the simulator used is not in `FlightResult` (only the turbulence seed in `modes`). The viewer draws the design's ground wind, which is the simulator's input; a `FlightResult.modes.wind` record would let the viewer show the wind of a stored result alone.
2. `DispersionRun` stores no time series. Replaying a run re-runs the simulator on the identical perturbed design (`perturbDesign(design, run.sampled)` followed by `simulateFlight`, the same two calls `flyRun` makes), which is deterministic and bit-identical; the viewer shows that `FlightResult`. An optional `DispersionRun.result` would avoid the second run.
3. A dispersion ellipse is not in `DispersionSummary` (only the rank-based 95 % containment radius, D-051). The viewer draws the stored containment circle and, in addition, the principal-axes standard-deviation ellipse of the stored landing points (sample covariance, 1σ and 2σ, descriptive only, no distribution assumed; see "Statistics" below). A stored ellipse in the summary would make the two agree by construction.

## Design

### Frames

The three.js scene uses the flight frame of docs/conventions.md directly: x east, y north, z up, metres, with the camera's up vector set to +z. No axis permutation or scaling is applied to a stored value. The rocket model is built in the body frame (x aft from the nose tip, fin 1 in the +y half-plane) and the stored quaternion is assigned to the rocket object as its rotation (three.js rotates by the same Hamilton product v ↦ q v q⁻¹, DYN-4), which a test checks against the physics `noseDirection`.

### Package layout

`packages/viewer` (pure where possible; three.js core only, no DOM, so Vitest runs it in Node):

- `src/geometry/rocket-model.ts`: `rocketModelParts(components)` → the revolved outlines (nose cones, body tubes, transitions, launch lugs), fin planforms (root and tip chords, sweep, span, thickness, count, root at the body radius, angles 2πi/n from +y) and rail buttons, all in body-frame metres; `rocketModelExtent(parts)`; `buildRocketObject(parts)` → a three.js `Group` whose origin is the nose tip.
- `src/replay/clock.ts`: `nearestStep(times, t)` (binary search; ties go to the earlier step), `displayPose(samples, t)` (linear position and normalised linear quaternion blend between the two neighbouring steps, display only, documented as such), `ReplayController` (play, pause, speed, seek, loop state machine advanced by wall-clock deltas).
- `src/replay/readouts.ts`: `readoutsAt(result, index)` → the stored values at step `index` with that step's time; `eventMarkers(result)` → each event with its sample's stored position.
- `src/scene/flight-scene.ts`: the static scene (ground grid with a distance scale chosen from the trajectory's extent, the rail, the flight path polyline through every stored position, event markers, the wind arrow at the pad) and the dynamic rocket; `setTime(t)` sets the rocket pose; cameras: follow, pad, orbit (`cameraPose(mode, ...)` pure).
- `src/dispersion/landing-scatter.ts`: landing points, the stored containment circle, the covariance ellipse (pure), and their scene objects.
- `src/dom/viewer.ts`: the only DOM module: `WebGLRenderer`, `OrbitControls`, `CSS2DRenderer` labels, resize and the animation loop.
- `src/units.ts`: a `Formatter` interface the app supplies (`format(si, kind)`), so the viewer converts nothing itself and the app's units toggle applies at the display boundary (CLAUDE.md 5).

`packages/app`:

- `components/FlightViewer.tsx`: the React wrapper: canvas, play/pause, speed, scrubber, camera selector, readouts (altitude, velocity, Mach, angle of attack, stability margin when the result has it, each with the step's time), the event list (click to seek), the Monte Carlo run picker.
- `FlightPanel` lifts the dispersion result to the App (like the flight), so the viewer can draw the landing points and replay a run.
- `simulation/runner.ts`: no new physics; replaying a Monte Carlo run calls `perturbDesign` then the existing `run`.

### Statistics (not physics)

Sample covariance of the landing points (east, north): s_ee = Σ(e − ē)²/(n − 1), s_nn, s_en. Principal axes from the eigen-decomposition of the symmetric 2 × 2 matrix: λ = (s_ee + s_nn)/2 ± √(((s_ee − s_nn)/2)² + s_en²), angle θ = ½ atan2(2 s_en, s_ee − s_nn). Semi-axes √λ (1σ) and 2√λ (2σ). This is elementary linear algebra on stored outputs, labelled "descriptive, computed by the viewer" in the UI; it is not a containment claim and no distribution is assumed. Tested by hand on a 4-point sample.

## Accuracy checks (tests)

- `readouts.test.ts`: for all five reference rockets (the `.ork` and `.eng` files of `reference/`, flown through `simulateFlight` as the golden test does), at every event and at every 25th step: the readouts equal the stored sample values exactly (`Object.is`), and the readout time equals the sample time.
- `rocket-model.test.ts`: R1 by hand (nose 0.100 long, radius 0.025; tube 0.500; fins 3 with the planform corners (0.500, 0.025), (0.550, 0.105), (0.600, 0.105), (0.600, 0.025); overall length 0.600, maximum radius 0.105 over the fins); all five rockets: the model's extent equals the aft end of the last external component and the maximum of the outline radii; nose outline points lie on the physics profile.
- `flight-scene.test.ts`: at sampled steps of each rocket, the rocket object's world nose axis (body −x transformed by the object's world matrix) equals `noseDirection(sample.orientation)` within 1e-12, and the object's world position equals the stored position plus the stored CG offset along the axis; event markers sit at the stored sample positions exactly.
- `clock.test.ts`: nearest step and tie rule by hand; display pose at a stored step equals the stored pose; the controller's play, pause, speed and seek.
- `landing-scatter.test.ts`: covariance ellipse by hand.
- End-to-end (`packages/app/e2e/viewer.spec.ts`): the example flies, the viewer shows, seeking to apogee shows the flight panel's apogee value; screenshots for `docs/reports/3d-viewer.md`.

## Not in scope

No physics, no new equation. Recovery devices are not drawn as canopies (the result stores no canopy state); the descent phase is shown by the rocket alone. Internal components are not drawn.

## Findings while implementing (2026-10-12)

- The simulator records a sample at every event except **liftoff**, which it detects within a rail step and does not record separately; the timed events (burnout, ejection charge) record their sample at the integrated time, within about 1e-12 s of the scheduled time. `eventMarkers` therefore matches a step within 1e-9 s and flags liftoff as "nearest step" (D-060). The accuracy tests check this for all five reference rockets.
- The apogee sample of a flight that deploys at apogee is recorded after the deployment, in the descent phase: it stores no Mach, angle of attack or CP (NaN), and the viewer shows "not available in this phase" for them rather than a number.
- RK4 at a 0.01 s fixed step is unstable for R2 (see D-060 and docs/progress.md); the viewer tests fly the reference rockets at 0.002 s as the golden flight test does.
- A fourth camera, "whole flight" (overview), was added: the fixed follow and pad views cannot show the trajectory and the landing points together.
- A swept fin's tip trailing edge can lie aft of the root's (R3), so the model's length is the aft-most drawn point, not the last external component's end.
