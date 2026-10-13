# Plan 0059: elliptical and freeform fins in the import, the design file and the app (plan 0055 step 2, part 2)

Decision D-088. Plan 0058 (D-087) made the physics fly these planforms; this plan brings them in from `.ork` files and shows them.

## What OpenRocket writes (black box, `tools/openrocket-harness/src/FinShapeProbe.java`, reference/rockets/fin-shape-probe/)

- `<ellipticalfinset>`: the fin set's common elements with `<rootchord>` and `<height>`. OpenRocket flies it as a 31-point polygon (area 6.2717e-3 m² for a 0.1 × 0.08 m fin against the ellipse's 6.2832e-3 m², −0.18 %).
- `<freeformfinset>`: `<finpoints>` of `<point x= y=>`, from the root leading edge (0, 0) round to the root trailing edge, as given.
- OpenRocket's worst-case CP at Mach 0.3 on the same rocket: 0.487149 m (trapezoid), 0.477036 m (elliptical), 0.465957 m (freeform).

## Change

- `packages/formats/src/ork.ts`: `readFinPlanform` reads the three fin set elements; both new ones placed like the trapezoid (tabs, cant, fillets, cross-sections as before).
- `packages/formats/src/design/validate.ts`: a fin set's `shape` (elliptical, or freeform with its points) and its `tab` (D-081) are accepted on load. Before this a design imported with fin tabs could not be loaded back.
- `packages/physics`: `finOutline`, the outline for drawing (the trapezoid's corners, the freeform points, 48 segments of the ellipse).
- `packages/app`: the side view draws the outline; the component editor offers the fin shape (trapezoidal, elliptical, and the imported freeform outline), hides the sizes a shape does not use, and turns a shape back into its equivalent trapezoid.
- `packages/viewer`: a fin of any outline, triangulated by ear clipping and wound as the four-corner plate was.

## Tests

- The probe files import with their shapes; freeform mass and CG exactly as OpenRocket; the ellipse's mass 0.18 % above OpenRocket's polygon, its CG equal; the rocket CP within 0.05 % (trapezoid and ellipse) and 0.2 % (freeform) of OpenRocket, tolerance 2 %.
- Designs with fin tabs, an elliptical or a freeform fin set save and load; an unknown shape is refused on load.
- The side view and the 3D fin draw the outlines; the editor helpers.
