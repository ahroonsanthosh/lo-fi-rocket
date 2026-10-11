# Known limitations

Every model limitation and validity range, per CLAUDE.md rule 8. Each entry says what the limitation is, where it applies, how big the effect is if known, and how the software tells the user.

Status: nothing physical is implemented yet. Entries below are placeholders for the sections that will exist; each implemented model adds its own entry in the same change that implements it.

## How to add an entry

| Field            | Content                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| Model            | Function or module affected, and the equation IDs from `docs/equations.md`                      |
| Limitation       | What the model does not capture, or the range outside which it is not valid                     |
| Source statement | What the cited source says about the range, quoted or paraphrased with location                 |
| Effect           | Magnitude of the error if known, or "unknown"                                                   |
| Behaviour        | What the code does at the edge: throws `InvalidInputError`, flags the result, or documents only |
| User-facing      | Where the UI shows this (Phase 3 onwards)                                                       |

## Atmosphere

_Pending plan 0001._ Expected entries: altitude domain (geometric altitude range), the standard atmosphere as a yearly mean at 45° N latitude (real days differ), molecular-weight correction above 80 km, and the treatment of launch-site temperature and pressure overrides.

## Geometry and mass

_Not started._

## Stability (Barrowman)

_Not started._ Expected entries: small angle of attack, subsonic validity, slender-body assumptions, fin thickness and count limits.

## Drag

_Not started._ Expected entries: transonic accuracy, roughness model, Reynolds number range.

## Flight simulation

_Not started._ Expected entries: flat non-rotating Earth, rigid body, no fin flutter, wind model fidelity, integrator tolerances.

## Motors

_Not started._ Expected entries: mass-during-burn assumption of the file format, thrust curve resolution.
