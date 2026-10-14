# Plan 0066: Wedge and high-aspect-ratio fins past 90° (task 5 of plan 0055)

The random designs of plan 0065 all fly, but 79 of 300 stopped at the model limit (D-046): the rocket tumbled or fell tail-first past 90° angle of attack. None were supersonic. Each one had a fin set the DATCOM large-angle model (D-070) refused, so the whole flight fell back to the small-angle model and its 90° stop:

- **37 single-wedge fin sets.** A single wedge is thickest at its trailing edge, which neither DATCOM maximum-lift family (figures 4.1.3.4-23a and -23b) covers.
- **42 high-aspect-ratio fin sets.** The exposed pair's A ≥ 4/((C₁ + 1) cos Λ_LE), the limit of the low-aspect-ratio method (DATCOM eq. 4.1.3.4-c). The high-aspect-ratio method needs the section's maximum-lift coefficient, which a flat fin does not have.

Under rule 3 (D-083) such a design must be simulated with the best documented approximation, listed in the result. Ending at 90° is a refusal of the descent, the landing point and the landing speed.

## 1. The approximations

1. **Single wedge (HA-5, HA-6).**
   - Δy is computed from the wedge's own ordinates, as before.
   - The 23b family (maximum thickness at 35 to 50 % of the chord, sharp-edged sections such as the double wedge) is used. It is the nearer of the two: the wedge's maximum thickness is at 100 %, and 23a's is at the leading edge.
   - In reverse flow the wedge leads with its square base, thickest at the leading edge. That is figure 23a exactly, as before (no approximation).
2. **High aspect ratio (HA-6).** The low-aspect-ratio method is used beyond its range. Every chart read past its drawn end is held at that end, and each hold is reported, as for any other design (D-070 item 9).

There is no approved method for either case: the DATCOM has no family for a trailing-edge maximum, and no flat-plate section data for its high-aspect-ratio method. These are the nearest documented readings.

## 2. Where it is said

- **Listed in the result.** In the displayed mode the result's approximations list names the fin set, what is approximated ("its normal force beyond the stall, and past 90° when the rocket tumbles"), the reason, and the expected effect. The impact is minor (section 4).
- **Chart notes.** The analysis notes (`wingAnalysis`) carry the same reason. They become flight warnings beyond the stall, as the other chart notes do.
- **The OpenRocket-equivalent mode** keeps the small-angle model and the 90° limit (D-070), and lists nothing for it.

## 3. Files

- `packages/physics/src/stability/datcom-large-angle.ts`:
  - `computeWingAnalysis` uses the 23b family for a section without one and continues above the aspect-ratio limit, each with a note;
  - `finLargeAngleAvailability` refuses only a fin set with no cross-section;
  - new `finLargeAngleApproximation(fin)` gives the reason, or undefined when the DATCOM covers the fin set.
- `packages/physics/src/flight/simulate.ts`: `largeAngleApproximations` adds the listed approximation in the displayed mode.
- Tests:
  - `datcom-large-angle.test.ts`: a high-aspect-ratio wing gives a finite, positive maximum lift with its note, and a wedge reads the 23b family exactly with its note.
  - `robustness.test.ts`: R1 with wedge fins, a constant 12 N motor and no recovery falls tail-first. It lands in the displayed mode with the approximation listed, and stops at the 90° limit in the OpenRocket-equivalent mode with nothing listed.

## 4. Results

- **Random designs (plan 0065 generator, seed 20261014, 300 designs):** 291 land and 9 reach the time limit; none stop at the model limit (79 before) and none fail. 167 of the 300 list the new approximation: the generator draws spans up to the body's proportions, so high aspect ratios are common among them.
- **What changes below the stall.** These rockets previously flew the small-angle model throughout. They now use the DATCOM model, as every other rocket does in the displayed mode. Of the 125 affected designs that reached apogee in both models, 118 agree within 0.5 % in apogee (the median difference is below 0.0001 %). The other 7 differ by −11 % to +17 %. Four of them are unstable at liftoff (−16.7 to −0.09 calibers), one is overstable at 22.8 calibers and weathercocks to 45°, and two reach 13° and 98° angle of attack on the climb. At such angles the two approved models are known to differ (D-070: up to 0.8 calibers in CP at 10 to 20°). The reported in-flight margin is unaffected: it already takes the more forward CP of the two models (D-070).
- **Sensitivity of the wedge stand-in.** The two families give the same α_CLmax, and C_Lmax within 0.4 %, for typical fins (root 50 to 100 mm, A 2.0 to 2.4). The exception is a strongly swept fin (root 120 mm, tip 20 mm, sweep 100 mm): 23b gives 8 % less maximum lift than 23a, the smaller restoring force.
- **The reference designs:** none of the 37 fin sets in `reference/rockets` (R1 to R5 and every probe) is a wedge or high-aspect-ratio. Their results, the golden outputs and the OpenRocket comparisons are unchanged.
