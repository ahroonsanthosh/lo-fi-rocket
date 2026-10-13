# Plan 3d-0001: a realistic 3D replay scene

Lane: 3d. Paths: `packages/viewer`, `packages/app/src/components/FlightViewer*`.
Owner's request: make the replay look and feel like a real launch (reference: a
terrain view with the trajectory, a smoke trail drifting with the wind, the
ground track, a snapshot of altitude and distance, a close-up inset of the
rocket), with the rocket drawn to the design's specification.

## Rule: the picture may be dressed up, the numbers may not

Every change here is drawing only. No stored value is altered, interpolated
into a readout, or replaced; the scene frame stays the flight frame of
docs/conventions.md (D-071). Anything illustrative (scenery, smoke, flame,
canopy shape) is labelled as illustrative in the UI note under the canvas and
recorded in D-3D-1. No new physics, so no new equation sources are needed.

## Changes

1. **Sky and light** (`scene/scenery.ts`). A gradient sky dome with a sun
   glow, a matching sun light (shadows from the rocket near the pad), sky and
   ground hemisphere light, distance fog in the horizon colour, ACES tone
   mapping and sRGB output, a logarithmic depth buffer (scenes span 0.05 m to
   tens of km).
2. **Terrain** (`scene/scenery.ts`). Procedural and seeded (deterministic).
   The ground is **exactly flat** over a radius that covers every stored
   position and Monte Carlo landing point with margin, because the simulator
   assumes flat ground; hills and mountains rise only outside that radius.
   Grass is a procedural texture with large-scale field patches in the vertex
   colours; rock and snow on the high slopes; instanced trees outside the flat
   radius. The note under the canvas says the scenery is illustrative and the
   simulation assumes flat ground at the pad.
3. **Ground level.** The stored altitude is the CG height above its rest
   position, so at rest the tail is below z = 0 and the old scene buried half
   the rocket. The ground is drawn at the lowest point of the rocket at rest
   (minus a small pad clearance) instead; stored positions are untouched.
   Recorded in D-3D-1.
4. **Launch pad.** A blast plate and legs at the ground, and the rail as a
   solid bar along the stored rail direction and length (still named
   `launch-rail`).
5. **Rocket** (`geometry/rocket-model.ts`). Gloss paint materials (clearcoat),
   creased normals at the sharp outline corners so edges look crisp, the
   outline still the physics profile exactly.
6. **Effects** (`scene/effects.ts`), pure functions of replay time so seeking
   is exact and testable:
   - exhaust flame while the blended stored thrust is above zero, its length
     scaled with √(thrust / max thrust) (illustrative);
   - smoke puffs emitted along the stored path while thrust is above zero,
     drifting with the design's ground wind input and spreading with age
     (illustrative);
   - parachute canopies after each stored deployment event, drawn with the
     design's canopy diameter, above the rocket against the air-relative
     stored velocity;
   - ground track (the flown stored positions projected on the ground) and a
     drop line from the rocket to the ground.
7. **Viewer DOM** (`dom/viewer.ts`). Shadows, tone mapping, a close-up inset
   of the rocket (follow camera) in the corner when the main camera is not
   following it.
8. **App** (`FlightViewer.tsx`). A taller canvas, a snapshot overlay of the
   stored altitude and horizontal distance from the pad at the shown step, the
   illustrative-scenery note.

## Tests

- Terrain: height is exactly 0 everywhere inside the flat radius (property
  test with fast-check over random points); the flat radius covers every
  stored position and extra ground point of all reference flights; the
  terrain is deterministic (same inputs, identical heights).
- Ground level: the drawn ground lies below the rocket's lowest point at rest
  for every reference rocket.
- Smoke: no puff exists before its emission time; a puff's drift equals the
  wind velocity times its age (by hand); none is emitted where stored thrust
  is zero.
- Flame: visible exactly where the blended stored thrust is above zero.
- Canopy: absent before the deployment event, present after it, with the
  design's diameter.
- Existing pose, marker and readout tests unchanged and passing.
- Browser: the existing Playwright viewer test, and refreshed screenshots.

## Addendum (owner's follow-up: free map integration, click-to-place)

9. **Real-world scenery** (`map/tiles.ts`, `scene/map-terrain.ts`,
   `dom/map-loader.ts`, `FlightViewerSite.tsx`, `FlightViewerMapPicker.tsx`):
   free, keyless tiles only (Esri World Imagery, EOX Sentinel-2 cloudless 2016,
   OpenStreetMap; AWS Terrain Tiles for elevation; Nominatim for search). The
   user places the pad by clicking a small dependency-free slippy map, by a
   search, by the browser's location or by typed coordinates. Nothing is
   requested until the picker is opened. The real terrain is drawn relative to
   the pad and not flattened; the app reports how far it departs from the flat
   ground the simulator assumes. Recorded in D-3D-2.
10. **Low-detail mode** for software or slow renderers (D-3D-1 (8)).

Tests added: the Web Mercator arithmetic by hand and its inverse (property),
tile ranges covering the square within the budget (property), Terrarium
decoding by hand, bilinear elevation on a plane, the terrain deviation by
hand, site validation, the map grid relative to the pad, and the picker
(no request before opening, click placement, coordinate validation).
