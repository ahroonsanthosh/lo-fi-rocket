# OpenRocket reference harness

**Licence: GPLv3** (see `LICENSE`). This directory links against OpenRocket, which is GPLv3, so everything here is GPLv3. Nothing in `packages/` may import, bundle or depend on this directory (CLAUDE.md section 3; `docs/decisions.md` D-013).

Purpose: use OpenRocket as a black box to generate the reference rockets and values in `reference/rockets/`. The harness builds five rockets with OpenRocket's public classes, computes CG, CP and stability exactly as the OpenRocket design window does, runs each flight twice at zero and 5 m/s wind to prove determinism, and writes `.ork` files, `values.csv`, per-component mass tables and flight time series.

## Run

```
./build.sh                # writes to ../../reference/rockets
./build.sh /some/dir      # writes elsewhere
```

`build.sh` downloads `OpenRocket-24.12.jar` into `lib/` if missing, verifies its SHA-256 (pinned in the script and in `reference/SOURCES.md`), compiles `src/ReferenceHarness.java` with the JDK's `javac` (Java 17 or newer), and runs it headlessly. No Gradle, no network beyond the one download.

Sensitivity runs: `-Dharness.timeStep=0.05` (pass through `java` directly; see `reference/rockets/settings.md`).

## What it pins

Every OpenRocket option that affects the results is set explicitly in `ReferenceHarness.java` and documented in `reference/rockets/settings.md`. If OpenRocket is upgraded, update the version, URL and hash in `build.sh` and `reference/SOURCES.md`, regenerate, and explain any changed value in the commit message.

## Override probe

`src/OverrideProbe.java` (D-073) asks OpenRocket how it applies component mass and CG overrides; the comment at its top gives the commands. Its output and four of its `.ork` files are in `reference/rockets/override-probe/`.

## Nose child probe

`src/NoseChildProbe.java` (D-076) asks OpenRocket where it places components inside a nose cone. It saves each case and measures it as OpenRocket reloads the file, because a rocket built in memory keeps stale stacking positions. The comment at its top gives the commands; its output and files are in `reference/rockets/nose-child-probe/`.

## Configuration probe

`src/ConfigProbe.java` (D-077) asks OpenRocket which motor configuration it opens a file with, which deployment settings a parachute then uses, and how the fin cross-section changes the fin mass. Output and files in `reference/rockets/config-probe/`.

## Shoulder and selection probes

`src/ShoulderProbe.java` (D-078) measures capped and zero-thickness shoulders and resolved automatic radii; output in `reference/rockets/shoulder-probe/`. `src/SelProbe.java` prints which configuration OpenRocket opens a given `.ork` file in.

## Parts probe

`src/PartsProbe.java` (D-079) measures a parachute's mass from its materials, the automatic parachute C_D, and the mass and CG of a shock cord, a tube coupler and an engine block; output in `reference/rockets/parts-probe/`.

## Automatic ring probe

`src/AutoRingProbe.java` (D-080) measures the radii OpenRocket gives rings, bulkheads and couplers written with a bare "auto", and parts inside a tube coupler; output in `reference/rockets/auto-ring-probe/`.

## Tab probe

`src/TabProbe.java` (D-081) measures fin sets with fin tabs at each tab reference and an engine block in a motor tube; output in `reference/rockets/tab-probe/`.

## Lug probe

`src/LugProbe.java` (D-084) measures a launch lug of three instances against one and two separate lugs (positions, mass, drag), and rail buttons with and without a screw height; output in `reference/rockets/lug-probe/`.

## Transition shoulder probe

`src/TransitionShoulderProbe.java` (D-084) measures the mass and CG of a transition with fore and aft shoulders, open and capped; output in `reference/rockets/transition-shoulder-probe/`.

## Stage override probe

`src/StageOverrideProbe.java` (D-084) measures what a mass or CG override on the stage does to the rocket's structure mass, CG and inertias, with and without the override covering the subcomponents; output in `reference/rockets/stage-override-probe/`.

## Cant probe

`src/CantProbe.java` (D-085) saves a fin set canted 2° and shows the value written in the file (2.0: degrees) and the cant OpenRocket reads back (0.0349 rad); output in `reference/rockets/cant-probe/`.

## Cluster probe

`src/ClusterProbe.java` (plan 0057) prints OpenRocket's motor cluster layouts and measures a rocket with one Estes D12 and with three in a "3-ring" (plain, rotated and scaled, and with a mass override on the tubes): offsets, mass, CG and inertias of the structure and the motors, and a flight with the reference harness's settings; output in `reference/rockets/cluster-probe/`. Compile it with `src/ReferenceHarness.java`.

## Fin shape probe

`src/FinShapeProbe.java` (plan 0059) measures trapezoidal, elliptical and freeform fin sets on the same rocket: the fins' mass, CG, inertias, planform area and outline, and the fin set's and the rocket's CP and C_Nα at Mach 0.3; output in `reference/rockets/fin-shape-probe/`.

## Flipped nose probe

`src/FlippedNoseProbe.java` (plan 0068, D-104) builds the same rocket with a 0.1 m tail for each of the six shapes: once a flipped nose cone and once a transition from 25 mm to 0. It saves, reloads and measures each: the tail's radii, mass, CG, CP and C_Nα, and the rocket's CP and CG. The two agree to every printed digit. A seventh file adds a base shoulder to a flipped cone, which OpenRocket places forward of the base. An eighth puts two mass components inside a flipped cone, at "top" and at "bottom", to show where it places them. Output and files in `reference/rockets/flipped-nose-probe/`.

## Pod probe

`src/PodProbe.java` (plan 0070, D-106) builds R1's airframe with no pods, two plain pods, two finned pods and three pods. It saves, reloads and measures each: every part's instances, position, mass, CP and C_Nα; the rocket's CP, C_Nα, mass, CG and inertias; the drag at Mach 0.3 split into friction, pressure and base; and a flight on a D12-5. Compile it with `src/ReferenceHarness.java`. Output and files in `reference/rockets/pod-probe/`.

## Staging probe

`src/StagingProbe.java` (plan 0064, D-096) reports how OpenRocket stages a rocket: each stage's separation event and delay, each motor mount's ignition event and delays, and a flight's events on every branch, with the mass and CG around each separation. Run on OpenRocket's own staged examples it shows "automatic" ignition as launch for the bottom stage and the ejection charge of the stage below for the others. With `--build <motors> <out>` it first builds two staged rockets of our own (`staged-bp`: D12-0 to C6-5 at the charge; `staged-hpr`: H128W to G80T 0.5 s after burnout, separation at burnout). With `--gaps <motors> <out>` it builds two three-stage rockets with a stage that has no motor (`staged-gap-bottom`, `staged-gap-middle`): with the bottom stage empty nothing ignites, and with the middle stage empty the sustainer never lights, so "automatic" means the ejection charge of the stage directly below. `--events <motors> <out>` prints the words the file uses for every ignition and separation event, and `--inactive <motors> <out>` switches a stage off in the configuration (`staged-off-booster`: the sustainer flies alone and lights at launch; `staged-off-middle`: the middle stage's parts leave the flight, the bottom stage keeps its place and the sustainer never lights). `--override <motors> <out>` puts a mass and CG override on staged-bp's booster stage: OpenRocket measures the stage's CG from the stage's front. Output and files in `reference/rockets/staging-probe/`.
