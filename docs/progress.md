# Progress

Updated after every commit. Read this first when resuming.

## Current prompt

Prompt 1: autonomous mode and all of Phase 1 (CLAUDE.md section 11 now defines autonomous mode).

## Done

- Monorepo scaffold, docs, CI, session hook (commit 1b8c7fd).
- Units system, plan 0001 Part A (commit 0b7b9d2).
- Prompt 0: reference documents, motors, OpenRocket harness, reference rockets, hand check (commit deb0202).
- Prompt 1 housekeeping: CLAUDE.md section 11 (autonomous mode) and 6.7 (RASAero scope); Barrowman 1966 reprint and the four NACA/NASA validation reports downloaded and recorded; `reference/fetch-docs.sh`; roll-angle probe confirms OpenRocket applies no roll reduction; reference values regenerated at 0.001 s; decisions D-016 to D-020.

## In progress

- Phase 1 step 2: U.S. Standard Atmosphere 1976 (plan 0001 Part B). Verifying every value against `reference/docs/ussa1976-nasa-ntrs-19770009539.pdf` page by page (printed page = PDF page − 16) before writing tests.

## Next

- Phase 1 steps 3 to 6: geometry and mass (plan 0003), minimal .eng reader (0004), minimal .ork reader (0005), Barrowman stability with both modes and acceptance against `reference/rockets/values.csv` (0006).

## Open questions

- Pull request: the repository has a single branch, `claude/inspiring-tesla-xxp0hh`, which is also its default branch, so no pull request can be opened until a separate default branch exists (see the Prompt 1 report).
