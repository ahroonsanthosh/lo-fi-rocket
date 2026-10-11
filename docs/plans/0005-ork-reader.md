# Plan 0005: Minimal OpenRocket `.ork` reader for the reference rockets

**Status:** written 2026-10-11 under autonomous mode; implemented in the following commit.
**Phase:** 1, step 5. The user-facing importer (every OpenRocket component, overrides, presets, multiple stages, pods, clusters) is Phase 4.

## Purpose

Load the five reference rockets from their `.ork` files so that the Phase 1 acceptance tests (mass, CG, and from plan 0006 CP and stability) run from the same files OpenRocket read, instead of from the hand transcription in `packages/physics/src/geometry/reference-rockets.ts`. Everything the reader understands must be exact; anything else must throw a clear error naming the element and the component.

## Source

OpenRocket publishes no written specification of the `.ork` format, and its source code is GPLv3 and may not be read (CLAUDE.md section 3). The format is therefore taken from the files themselves: `reference/rockets/*.ork`, written by OpenRocket 24.12 (format version 1.10), together with the per-component masses and positions OpenRocket reports for them (`reference/rockets/components/*.csv`), which fix the meaning of every position method and length used. Two enumerations were read from the public class signatures of the OpenRocket jar with `javap` (black-box use of the compiled program, not its source): `AxialMethod` has `ABSOLUTE`, `AFTER`, `TOP`, `MIDDLE`, `BOTTOM`; `DeployEvent` has `LAUNCH`, `EJECTION`, `APOGEE`, `ALTITUDE`, `LOWER_STAGE_SEPARATION`, `NEVER`; `Transition.Shape` has `CONICAL`, `OGIVE`, `ELLIPSOID`, `POWER`, `PARABOLIC`, `HAACK`; `FinSet.CrossSection` has `SQUARE`, `ROUNDED`, `AIRFOIL`.

## File structure (as written by OpenRocket 24.12)

- A `.ork` file is a zip archive whose entry `rocket.ork` is the XML document; a plain XML document is also accepted (older files and hand-written tests).
- `<openrocket version="1.10" creator="...">` contains `<rocket>`, `<simulations>`, `<photostudio>`, `<docprefs>`. Only `<rocket>` is read.
- `<rocket>` contains `name`, `id`, `axialoffset`, `position`, `designtype`, `motorconfiguration` (one, with one `<stage>`), `referencetype`, and `<subcomponents>` with exactly one `<stage>`.
- A stage's `<subcomponents>` holds the external components in order from the nose: `nosecone`, `bodytube`, `transition`. They are stacked: each starts where the previous one ends. The nose tip is x = 0.
- Internal and attached components live in a body tube's `<subcomponents>` and are positioned by `<axialoffset method="...">v</axialoffset>` relative to the parent tube: `top`: forward end at parent forward end + v; `bottom`: aft end at parent aft end + v; `middle`: centre at parent centre + v; `absolute`: forward end at v from the nose tip. The companion `<position type="...">` element is a duplicate and must agree. A component's length for this purpose is its own length (tubes, rings, lugs), the root chord (fin sets), the packed length (mass components, parachutes), or 0 (rail buttons, which OpenRocket positions by their first instance). Verified against the `position_x_m` column of every `components/*.csv` row.
- Materials: `<material type="bulk" density="ρ">name</material>`, density in kg/m³. Only bulk materials are read; surface and line materials (parachute canopy and lines) are accepted only when the parachute's mass is overridden.
- Motor mounts: a `<motormount>` inside a `bodytube` or `innertube` with `overhang`, exactly one `<motor>` (designation, manufacturer, diameter, length, delay). The motor's aft end is the mount's aft end plus the overhang. Motor masses are not in the file; they come from the motor file (plan 0004).

## Mapping to physics components (`packages/physics`)

| `.ork` element    | Component                                                                                             | Fields read                                                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nosecone`        | `noseCone`                                                                                            | `shape`, `shapeparameter` (required when the shape uses one), `length`, `aftradius`, `thickness` (number or `filled`), material, aft shoulder (radius, length, thickness) |
| `bodytube`        | `bodyTube`                                                                                            | `length`, `radius`, `thickness`, material; optional `motormount`                                                                                                          |
| `transition`      | `transition`                                                                                          | `shape`, `shapeparameter`, `length`, `foreradius`, `aftradius`, `thickness` (number or `filled`), material                                                                |
| `trapezoidfinset` | `finSet`                                                                                              | `fincount`, `rootchord`, `tipchord`, `sweeplength`, `height`, `thickness`, material; body radius from the parent tube                                                     |
| `launchlug`       | `launchLug`                                                                                           | `length`, `radius`, `thickness`, material; radial offset = parent radius + lug radius                                                                                     |
| `railbutton`      | `railButton`                                                                                          | `instancecount`, `instanceseparation`, `outerdiameter`, `innerdiameter`, `height`, `baseheight`, `flangeheight`, material; body radius from the parent tube               |
| `innertube`       | `innerTube`                                                                                           | `length`, `outerradius`, `thickness`, material; optional `motormount`                                                                                                     |
| `centeringring`   | `centeringRing`                                                                                       | `length`, `outerradius`, `innerradius`, material                                                                                                                          |
| `bulkhead`        | `bulkhead`                                                                                            | `length`, `outerradius`, material                                                                                                                                         |
| `masscomponent`   | `massComponent`                                                                                       | `mass`, `packedlength`, `packedradius`                                                                                                                                    |
| `parachute`       | `parachute` plus a recovery record (`diameter`, `cd`, `deployevent`, `deployaltitude`, `deploydelay`) | `overridemass` (required), `packedlength`, `packedradius`                                                                                                                 |

Shape names map `ellipsoid` to `elliptical`; the others are the same words. A `<shapeclipped>` element (written for clippable shapes) is accepted with either value on a nose cone, where a zero fore radius makes the clipped and non-clipped profiles of Niskanen Appendix A.7 identical, and must be `false` on a transition because clipped transitions are not implemented (plan 0003).

## Rejected inputs (each throws `OrkUnsupportedError` or `OrkParseError` naming the element and component)

- Elements the minimal reader does not model: `streamer`, `ellipticalfinset`, `freeformfinset`, `tubefinset`, `tubecoupler`, `engineblock`, `shockcord`, `podset`, `boosterset`, `parallelstage`, and any element the reader does not know inside a component.
- More than one stage, more than one motor configuration or motor, cluster configurations other than `single`, non-zero `radialposition`, `instancecount` other than 1 on lugs and rings.
- `isflipped` true; capped shoulders; shoulders on transitions; `radius` or `innerradius` of `auto`; fin `cant` or `filletradius` other than 0; fin cross-section other than `square`; rail button `screwheight` other than 0; `overridemass`, `overridecg` or `overridesubcomponentsmass` on anything but a parachute's mass; a parachute without `overridemass`; a shape that needs a parameter without one; `referencetype` other than `maximum`; a format major version other than 1; a deploy event outside the enumeration above.
- Missing, duplicated, empty or non-numeric required elements, and a `position` element that disagrees with `axialoffset`.

Nothing is defaulted and no element is silently ignored: a fixed list of cosmetic or bookkeeping elements (`name`, `id`, `comment`, `preset`, `finish`, `appearance`, `color`, `linestyle`, `radialdirection`, `angleoffset`, `rotation`, `radiusoffset`, `instanceseparation` on single instances, `filletmaterial` when the fillet radius is 0, `masscomponenttype`, `digest`, `ignitionevent`, `ignitiondelay`, `ignitionconfiguration`, parachute canopy material and line fields) is consumed and documented in the code; every other element must be understood or the reader throws.

## Output

`parseOrk(data: Uint8Array | string, fileName?: string): OrkRocket` with the rocket name, format version, the placed components in file order (each with its OpenRocket name), the overall length, the maximum body radius (the reference length is its diameter), the motor mount (designation, manufacturer, diameter, length, delay, aft end from the nose tip, mount component index) and the recovery devices.

## Tests (`packages/formats/src/ork.test.ts`)

- Each reference file parses to exactly the component list of `reference-rockets.ts` (same kinds, positions and dimensions to 1e-12 relative, allowing for OpenRocket's `5.000000000000004E-4`), and the motor mount matches `REFERENCE_MOTORS` (designation, diameter, length, aft end).
- Every component's mass and absolute CG from `componentMassProperties` applied to the parsed component matches OpenRocket's `components/*.csv` row: mass within 0.05 % and CG within 0.1 mm for structural parts (the agreement already observed in plan 0003), exact to the printed six decimals for mass components and parachutes.
- End to end: parsed components plus the motor masses from `parseEng` on `reference/motors/*.eng` reproduce `values.csv` liftoff and burnout mass within 0.1 % and CG within 1 % (the Phase 1 acceptance, now from the files alone).
- The zipped and the plain-XML forms give identical results; a zip without `rocket.ork` throws.
- Each rejected input above is exercised by editing the R1 or R2 XML in the test and asserting the error class and that the message names the element.
