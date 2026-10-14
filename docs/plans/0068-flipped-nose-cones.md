# Plan 0068: Flipped nose cones (tail cones) (task 4 of plan 0055, import part 2)

OpenRocket 23.09 and later can flip a nose cone so that its base faces forward: a tail cone. The `.ork` reader refuses such a file ("flipped nose cones"), so the whole design is refused, against rule 3 (D-083).

## 1. What OpenRocket does (black-box probe)

`tools/openrocket-harness/src/FlippedNoseProbe.java` builds the same rocket twice for each of the six shapes. The rocket is an ogive nose, a 0.4 m body tube with three fins, and a 0.1 m tail of radius 25 mm and wall 2 mm. The tail is once a flipped nose cone and once a transition from 25 mm to 0. Each rocket is saved, reloaded and measured as loaded (`reference/rockets/flipped-nose-probe/values.txt`). The probe found:

- **The file.** A flipped nose cone is written as the cone it is: `<aftradius>` is its base radius, `<aftshoulder…>` its base shoulder, plus `<isflipped>true</isflipped>`.
- **As loaded.** OpenRocket reports a fore radius equal to the base radius, an aft radius of 0, and the shoulder at the base, now the fore end, reaching forward. With a 30 mm shoulder of radius 24 mm and wall 2 mm, the part gains 9.1044 g centred 15 mm ahead of the base: 0.0213953 + 0.0091044 = 0.0304997 kg at 0.541882 m, as OpenRocket gives (0.030499625 kg at 0.541883193 m).
- **Equal to a transition.** For all six shapes (conical, ogive, ellipsoid, power, parabolic, Haack) the flipped cone and the transition give the same part mass, CG, CP and C_Nα (−2.0), and the same rocket CP and CG, to every printed digit.

So a flipped nose cone is a transition from its base radius to 0. That is exact, not an approximation.

## 2. Changes

1. **Physics (GEO-7).** `transitionProfile` accepts an aft radius of 0, a transition that ends in a point. The fore radius must stay positive (a fore radius of 0 is a nose cone).
   - The narrowing profile is then the nose profile reversed, the same function the boat tail already uses.
   - The Barrowman body term needs no change: the CP (L·A_aft − V)/(A_aft − A_fore) becomes V/A_fore, with no zero divisor.
   - The drag needs no change: a base of radius 0 has no base drag, and the boat-tail fineness L/(2(r_fore − r_aft)) is finite.
2. **The `.ork` reader.** `<isflipped>true` reads the cone as a transition:
   - the shape and parameter, the length, the fore radius `<aftradius>`, an aft radius of 0, and the wall;
   - the base shoulder as a fore shoulder ahead of the cone, with its cap at the shoulder's fore end;
   - parts inside it as for a nose cone, against the reversed profile.

   A mass or CG override on a flipped cone with a shoulder is refused, as for a transition with shoulders (D-084); that refusal is a separate item.

3. **App.** The transition's aft radius field accepts 0 (`'non-negative'`), so a tail cone can be built by hand.

## 3. Tests

- **Physics.**
  - A 0.1 m conical transition from 25 mm to 0, wall 2 mm, ABS 1050 kg/m³, by hand: the shell mass and CG, and the CP at L/3 = 33.33 mm from its front (OpenRocket 0.553333 − 0.52).
  - An ogive tail equals the ogive nose profile reversed, point by point.
- **Formats.**
  - Each of the six flipped-cone probe files reads as a transition to 0 with no approximation listed.
  - The tail's mass and CG agree with OpenRocket's to 1e-6 relative, and the rocket's CG within 1 % and CP within 2 % (CLAUDE.md 7.4) in the OpenRocket-equivalent mode.
  - The shoulder file gives OpenRocket's part mass and CG.
  - Parts inside a flipped cone are placed as OpenRocket places them. A 20 mm mass at "top" + 10 mm starts at 0.53 m, 10 mm behind the cone's front. One at "bottom" + 0 ends at the point, starting at 0.60 m (file `flipped-ogive-children`).

## 4. Docs

D-104; GEO-7's validity in `docs/equations.md`; the flipped nose cone line in `docs/known-limitations.md`; the probe in `tools/openrocket-harness/README.md`; progress.
