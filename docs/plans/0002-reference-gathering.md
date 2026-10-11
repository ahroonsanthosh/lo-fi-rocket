# Plan 0002: Gather reference material (Prompt 0)

**Status:** approved in advance by the project owner (Prompt 0 grants approval for the whole prompt). Executed 2026-10-11.

## Goal

Before Phase 1 physics, collect every source document, reference motor, and OpenRocket-generated reference value the later phases need, with provenance (URL, date, SHA-256, page count, verification) recorded in `reference/SOURCES.md`.

## Steps

1. **Source documents** into `reference/docs/`: USSA 1976 (NASA NTRS), Niskanen 2009 thesis (Aalto repository or the OpenRocket project site), Barrowman 1967 thesis (NASA NTRS hosts it), Barrowman and Barrowman 1966 (NAR or NASA archive), RASP `.eng` and RockSim `.rse` format descriptions, SI Brochure 9th ed. (BIPM), ThrustCurve.org API documentation. Each verified by title page, authors, date and page count; only publisher, government, university or author-hosted copies.
2. **Reference motors** into `reference/motors/`: 5 to 8 certified commercial motors from C to H class, `.eng` files from the ThrustCurve.org API, hashed and recorded.
3. **OpenRocket harness** in `tools/openrocket-harness/` (GPLv3, isolated from `packages/`): latest stable OpenRocket release from GitHub, verified; a headless Java program using OpenRocket's own classes to build five reference rockets, save `.ork` files, compute CG, CP and stability at liftoff, and simulate with zero wind and with 5 m/s wind, writing `reference/rockets/values.csv`. All settings pinned in `reference/rockets/settings.md`; each simulation run twice to confirm determinism.
4. **Rocket specifications** in `reference/rockets/README.md`: every dimension, material and mass in plain numbers.
5. **Cross-check** in `reference/rockets/hand-checks.md`: hand-calculated CG and Barrowman CP for the simplest rocket, from the documents in `reference/docs/`, compared with OpenRocket within 2%.

## Blockers that stop the work

A document that cannot be downloaded from an allowed host, or whose identity cannot be verified: report the exact title and best URL and wait. No secondary source is substituted without approval.

## Out of scope

No physics code. Phase 1 starts with the next prompt.
