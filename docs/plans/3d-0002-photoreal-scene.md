# Plan 3d-0002: a photoreal replay scene

Lane: 3d. Paths: `packages/viewer`, `packages/app/src/components/FlightViewer*`,
the 3d lane's docs. Also fixes issues #61 (page freeze without a GPU) and #29
(stacked labels at the pad).

Owner's feedback on 3d-0001: "terrain, map and all objects do not look real
life enough". Decisions are left to the 3d lane ("decide yourself"), at no
cost.

## Rule (unchanged from 3d-0001, D-071, D-3D-1)

Drawing only. No stored value, readout or simulation input changes. The
scenery and effects are labelled as illustrative; the procedural ground stays
exactly flat over the flight; the real-world terrain is drawn as it is and
its departure from the simulator's flat ground is reported.

## What makes a 3D scene read as real, and what this plan does about each

1. **Photographic sky and light.** A CC0 HDRI photograph of a partly cloudy
   sky (Poly Haven, "Kloofendal 48d Partly Cloudy (Pure Sky)") replaces the
   gradient dome: the visible sky is the photograph, the ambient light is the
   same photograph (image-based lighting), and the sun light is placed where
   the sun is in the photograph (47.8° elevation, measured from the HDR), so
   shadows and highlights agree with the sky. The distance haze takes the
   photograph's horizon colour.
2. **Photographic ground.** CC0 photo-scanned textures (Poly Haven
   `aerial_grass_rock` at 15 m per tile for the field, `leafy_grass` at 2 m
   per tile for close-up detail, `rocky_terrain_02` at 90 m per tile for the
   hills), with normal maps, blended at several scales so no tiling shows, and
   with large-scale colour variation.
3. **Real trees.** Billboards rendered offline from CC0 photo-scanned tree
   models (Poly Haven), with an albedo and a normal image each, lit in the
   scene by the same sun; placed only outside the flat area, as before.
4. **Camera-like rendering.** Bloom on the flame and the sun, anti-aliasing,
   a slight vignette, ACES tone mapping; all off in the low-detail mode.
5. **Real-world terrain (map mode).** Several imagery levels (finest at the
   pad), finer elevation near the pad, a far ring to about 120 km so real
   mountains stand on the horizon, the Earth's curvature applied to the far
   ring (drop d²/2R), a photographic detail texture blended in close up so the
   ground near the camera is not a smear, the HDRI sky above it.
6. **The rocket to specification.** The motor case and nozzle drawn from the
   motor's diameter, length and aft position (one per motor of a cluster);
   fin edges drawn with the design's fin cross-section (square, rounded,
   airfoil, wedge, double-wedge); rail buttons with base, shaft and flange
   from their dimensions; launch lugs as hollow tubes; a paint scheme chosen
   by the user (the design stores no colours), including carbon fibre and
   fibreglass finishes.
7. **Launch equipment to specification.** A launch rod through the lug for a
   design with a launch lug, sized from the lug's inner diameter; a 1010 or
   1515 aluminium rail with its slot profile for a design with rail buttons,
   chosen from the button size; a blast deflector and the igniter leads.
8. **Smoke, flame, parachute.** Smoke as lit billboards with a noise texture
   (brighter on the sun side), a ground cloud at ignition, all still a pure
   function of replay time; a shader flame per motor that blooms; a canopy
   with gores that bulge between the seams, an apex vent, shroud lines to a
   confluence and a shock cord to the rocket.

## Performance (#61)

- The scene is built after the flight results have painted (deferred one
  frame), so the numbers never wait for the 3D scene.
- Assets load asynchronously; the scene first shows without them and
  upgrades in place.
- Shaders compile asynchronously where the browser supports it.
- Rendering on demand: while paused and still, no frame is drawn.
- Software renderers: low detail from the start (no post-processing, no
  shadows, fewer trees, smaller terrain grids).

## Labels (#29)

Labels whose anchors fall within a few pixels of each other on screen are
merged into one label ("Launch 0.000 s · Liftoff 0.036 s"), recomputed when
the camera moves.

## Assets and licences

All new assets are CC0 (public domain) from Poly Haven; no attribution is
required, but `packages/viewer/assets/ASSETS.md` lists each source URL and
the processing, and the scripts that made them are in
`packages/viewer/scripts/`. Total about 4 MB, loaded only when the 3D
replay is shown.

## Tests

- Sky direction mapping: the sun direction from the HDRI position (by hand).
- Fin cross-section outlines (by hand for each section), motor placement from
  the design (by hand), rail profile choice from the button size.
- Label merging (by hand, and a property: no two shown labels closer than
  the threshold).
- Smoke and canopy functions as before; the canopy's gore geometry keeps the
  design diameter at the rim.
- Curvature drop by hand (10 km → 7.84 m).
- Existing pose, marker and readout tests unchanged.

## Outcome

Implemented as planned, with one change: no post-processing composer (D-3D-3 (4)); the flame's glow is a halo sprite. Grass blades near the pad were left for later (the close-up grass scan carries the near ground). Decisions D-3D-3 to D-3D-6.
