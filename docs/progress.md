# Progress

Updated after every commit. Read this first when resuming.

## Current prompt

Prompt 0: gather reference material (`docs/plans/0002-reference-gathering.md`).

## Done

- Monorepo scaffold, docs, CI, session hook (commit 1b8c7fd).
- Units system, plan 0001 Part A (commit 0b7b9d2).

## In progress

- Prompt 0: reference material gathered (documents, motors, OpenRocket harness, reference rockets, hand check). Writing up and committing.

## Next

- Prompt 1: Phase 1 (autonomous mode in CLAUDE.md, units done, atmosphere, geometry and mass, minimal .eng and .ork readers, Barrowman stability against `reference/rockets/values.csv`).

## Open questions

- Barrowman and Barrowman (1966) NARAM-8 report: only a vendor reprint exists online (Apogee Components, reprinted with the author's permission). Not downloaded; awaiting the owner's decision (see `reference/SOURCES.md`).
- Three-fin roll reduction: Niskanen (2009) eq. 3.54 reduces the three-fin normal force by up to 15 % with roll angle, but OpenRocket 24.12's design-window CP matches the unreduced value (hand check, `reference/rockets/hand-checks.md`). Phase 1 must decide which to show and record the difference.
