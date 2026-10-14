# Plan 0065: Random-design robustness (task 6 of plan 0055)

The owner's goal: "the system cant break every time we swap something out, or replace it" (CLAUDE.md rule 3, section 8). Hand-written tests use designs someone thought of; this plan draws designs no one thought of and flies them all.

## 1. The generator

`packages/formats/src/test-support/random-design.ts` (test support, not exported) draws sensible designs, as a builder could build them:

- **The airframe.**
  - A nose of any of the six shapes, solid or hollow, 1.5 to 8 calibers long.
  - One or two stages, each with one to three body tubes of 0.3 to 1.2 m.
  - A fin set of two to six fins at the aft end of each stage, any cross-section, with any root, tip (down to 0), sweep and span in proportion to the body.
- **The motors.** A motor tube sized to a bundled motor, that motor with a delay or plugged, and a small overhang.
- **Inside.** A payload mass of 0 to 0.5 kg and a packed parachute.
- **Recovery.** A canopy of 0.2 to 2 m opening at apogee, at the ejection charge or at 100 m.
- **The pad.** Rail length 1 to 3 m, tilt 0 to 0.3 rad, any azimuth; wind 0 to 8 m/s from any direction.

Values come from fast-check, so they include the edges: exactly 0, values near 10⁻³⁰⁰, and the bounds.

## 2. The property

Every design:

- survives the file round trip;
- gives finite stability figures;
- flies to a finite result ending in landing, the model limit (D-046) or the time limit, with finite samples.

None may crash or be refused: a refusal of a sensible design is a gap in the models (task 5), not an answer. The test runs 40 designs on a fixed seed in the suite (about 20 s); the exploration behind it flew 300.

## 3. What the first runs found, and the fixes

Of 60 designs, 25 failed before any fix. Each failure was traced to its cause, fixed without changing any result elsewhere, and tested on its own (`packages/physics/src/flight/robustness.test.ts`):

1. **A roll rate decaying to nothing.** At |ω| below about 5·10⁻³⁰⁹ (in the subnormal numbers) the rotation axis ω/|ω| overflowed: "rotation axis length is invalid: received Infinity", 25 % of designs. Fixed by an exact power-of-two scaling of ω before it is normalised (DYN-5 unchanged).
2. **The first instant off a still rail.** At an airspeed of 10⁻³²³ m/s the roll damping divided by the airspeed while q had underflowed to 0: ∞ × 0 = NaN, 17 % of designs. The moment is ½ρωv₀NΣ(2π/β), which goes to 0 with v₀; it is now 0 when q is 0 (AERO-5).
3. **A rail tilted by next to nothing.** The same overflow in the tilt axis. Fixed in `normalise` by the same exact scaling.
4. **A canopy opening on a fast rocket after a long smooth coast.** The Dormand–Prince step had grown to its 0.05 s maximum. The first trial step after the opening is far longer than the drag's millisecond time constant, and its stages flew millions of metres away. The atmosphere refused them before the error estimate could reject the step, so the flight failed (altitudes of 2,059 km and 1.3·10⁹ m in the message). A trial step whose stages leave a model's range is now a rejected step, shrunk and retried like any other (DYN-11). Only when no step down to the minimum works is the error the flight's.
5. **A 0 kg mass item was refused.** A placeholder part of 0 kg now adds nothing, as a 0 kg override already did (GEO-12); negative masses stay refused.

## 4. Results

- **After the fixes:** of 300 designs, 212 land, 79 end at the model limit (an unstable or tumbling rocket past 90° angle of attack, D-046), 8 reach the time limit, and none crash or are refused.
- **The golden outputs:** unchanged.
- **The reference comparisons:** unchanged.
