# Plan 3d-0003: realism review of the photoreal replay

Lane: 3d. Paths: `packages/viewer`, `packages/app/src/components/FlightViewer*`,
the 3d lane's docs. Also issues #96 (pod sets drawn on the axis) and #102
(streamers not drawn).

Owner's request: "review realism, enhance and commit". A review of the
replay after 3d-0002 (merged in #79), shot by shot from the pad to the
landing, found these departures from what a launch looks like:

1. **Smoke never clears.** The burn's puffs keep growing (about 10 m across
   20 s after burnout) at full opacity, so the descent and the landing are
   seen through a white-out.
2. **The distance grid** reads as white lines painted across the field.
3. **Labels of future events** (for example "Landing 29.874 s") stand at the
   pad from the first frame, merged into one long label.
4. **The ignition cloud** is a flat white dome.
5. **Under the parachute the rocket keeps its flight attitude**, and at
   landing it hovers upright above the grass. The simulator's descent is the
   three-degree-of-freedom recovery model (DYN-14, Niskanen §4.2.5): no
   moment acts, so the stored attitude in descent is the attitude at
   deployment carried along, not a prediction of how the rocket hangs.
6. **Pod sets** are drawn once on the rocket's axis (#96); **streamers** are
   not drawn (#102).

## Changes (drawing only; D-3D-7)

1. Smoke puffs thin as they grow (opacity × (start size / size)^1, the
   smoke diluting into a larger volume) and fade with a 7 s time constant;
   the ignition cloud has more, varied, translucent puffs.
2. The square grid becomes range rings at the grid spacing with a faint
   north-south and east-west cross; the labels stay. The drop line is hidden
   within 2 m of the ground.
3. An event's label appears once the replay reaches the event.
4. Descent: the rocket hangs from its shock cord towards the canopy (or
   streamer), nose up, with a slow pendulum sway (period 2.6 s, 6°),
   blending in from the stored attitude over 0.8 s after deployment. The
   stored position (the CG) is kept exactly; only the drawn attitude
   changes. Landed: the replay runs 4 s past the last stored step; the
   rocket tips over onto the ground (lying along the drift), its parachute
   collapses beside it. The horizontal landing point stays the stored one.
5. Pod sets (#96): each pod part drawn `count` times at angles 2πk/count
   about the axis, its axis `radialOffset` out; the first pod at +y.
6. Streamers (#102): a strip of the design's length and width trailing
   above the rocket from the shock cord, fluttering (a travelling wave whose
   amplitude grows towards the free end).

## Tests

- Smoke dilution and fade by hand; ground cloud by hand.
- Range rings cover the flight (the existing grid tests).
- Label reveal: future events hidden, past shown (pure function).
- Hanging attitude: in descent the nose axis points along the cord within
  the sway; position exact; landed pose horizontal and on the ground.
- Pod parts: count copies at the radial offset (by hand on the `pods2.ork`
  reference rocket's numbers).
- Streamer: drawn after its deployment event at its length and width.
- The existing pose test keeps checking every stored step before descent.

## Outcome

Implemented as planned, with three changes found while checking the result in a browser:

- The landed rocket falls over about its tail, so its CG rests beyond the stored landing point by the tail's distance from the CG. A rocket falling towards the launcher falls the other way, and a landing inside the launcher's footprint is drawn slid off it between two legs. This happens in a flight without wind, the example design's default.
- Smoke puffs fade out within 1.5 of their sizes of the camera, so a camera inside the ascent's smoke (a windless descent passes through it) is not washed out.
- The landed step's speed is labelled "Landing speed".

Decision D-3D-7.
