# Equations register

Every physics equation implemented in this repository is listed here, per CLAUDE.md section 4.
An equation that is not in this register must not be in the code.

**Current phase:** Phase 1, physics core.
**Current task:** U.S. Standard Atmosphere 1976 (Part B of `docs/plans/0001-units-and-atmosphere.md`, approved). Part A (units) is implemented. Part B is blocked until `reference/ussa1976.pdf` is in the repository so every value can be checked against a page of the document.

## How to add an entry

1. Give the equation a stable ID: a short group prefix and a number (`ATM-3`, `BAR-12`, `DRAG-7`). IDs are never reused or renumbered.
2. Quote the source precisely: author, year, title, and the section, equation number, table or page in the source's own numbering.
3. State the validity range exactly as the source states it, plus any extra restriction imposed by our implementation.
4. List every symbol with its SI unit.
5. Name the implementing function as `packages/<pkg>/src/<path>.ts#functionName` and the test file that verifies it with a hand-calculated value.
6. Put the same citation in a comment directly above the implementation.

## Register

| ID         | Equation | Source and location | Validity range | Symbols and units | Implemented in | Verified by |
| ---------- | -------- | ------------------- | -------------- | ----------------- | -------------- | ----------- |
| _none yet_ |          |                     |                |                   |                |             |

## Group prefixes

| Prefix | Topic                                           | Primary source                                                          |
| ------ | ----------------------------------------------- | ----------------------------------------------------------------------- |
| `UNIT` | Unit definitions and conversions                | SI Brochure (pending approval, see plan 0001)                           |
| `ATM`  | Atmosphere                                      | U.S. Standard Atmosphere, 1976                                          |
| `GEO`  | Component geometry, volume, mass, CG, inertia   | Niskanen (2009), Appendix on components, plus elementary calculus       |
| `BAR`  | Normal force coefficient and centre of pressure | Barrowman (1967); Barrowman and Barrowman (1966); Niskanen (2009) ch. 3 |
| `DRAG` | Drag components                                 | Niskanen (2009) ch. 3; Hoerner (1965) where Niskanen refers to it       |
| `MOT`  | Motors and thrust curves                        | RASP .eng and RockSim .rse specifications                               |
| `DYN`  | Flight dynamics and integration                 | Niskanen (2009) ch. 4                                                   |
