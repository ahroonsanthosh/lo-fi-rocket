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
