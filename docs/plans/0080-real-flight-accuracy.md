# Plan 0080: real flights at the core

## 1. Why

The owner (2026-10-14): "all these must be done, with real flights at the core. this whole project was built around accuracy … a sim is a sim, and needs accurate info".

**Where we stand.** On the 21 flown rockets of RASAero II's examples (plan 0075), the displayed apogee is above the measured one on every flight:

| Model                 | Below Mach 0.95 (11 flights) | Above Mach 0.95 (10 flights) |
| --------------------- | ---------------------------- | ---------------------------- |
| Displayed             | +17.7 % mean (after D-115)   | about +29 % mean             |
| OpenRocket-equivalent | +9.9 %                       | +18.0 %                      |
| RASAero II            | +0.4 %                       | +3.9 %                       |

The held-out wind tunnel drag is also off by 21 % rms around Mach 1.

The cause is drag that real rockets have and the model leaves out or underestimates (`docs/reports/rasaero-comparison.md` section 4):

- the fins' friction length;
- fin-body interference;
- rail guides and launch shoes;
- thrust at altitude, on the high flights.

## 2. The target, set before any change

- **Below Mach 0.95:** the median and mean apogee error within ±3 %, and the rms within 6 %. That is RASAero II's own scatter on these flights, the practical floor: one flight's four instruments disagree by 11 %.
- **Above Mach 0.95:** reported. Its target is set after the transonic work (section 5, step 6).

## 3. The rule for choosing models

A model is adopted on its source and on physical completeness: it must be the method an approved source gives for a term the rocket really has. The flight benchmark reports each change's effect. It never chooses between models, and no constant is fitted to it (CLAUDE.md 7.4). RASAero II's breakdown is a hint of a term's size, never a per-term target. Its rail-guide rule is its authors' rule of thumb, and a term that large may be absorbing other effects.

## 4. If the sourced models do not reach the target

The owner decides before the work (section 7, question 2):

- **(a)** The residual stays as a listed bias on every result.
- **(b)** A labelled flight-calibrated range is shown beside the physics figure, derived openly from the benchmark's statistics. It never replaces the figure and never changes a model constant.
- **(c)** A rule change permitting an explicit flight-derived correction.

## 5. Steps, one pull request each

1. **The benchmark.**
   - `real-flights.test.ts` reads the 21 `.CDX1` files and their recorded apogees. It needs no Wine and no opt-in, so CI runs it.
   - It writes `docs/reports/real-flights.md`. Per flight it records the instrument (GPS, barometric or accelerometer), the maximum Mach, whether the day's wind is in the file, and our error in each mode. It reports the mean, median and rms by regime.
   - Like the goldens, every physics pull request regenerates the table and names the change.
   - Every flight result gets an info note with the measured bias from this benchmark (owner decision 6 of the RASAero report).
2. **Fin friction at each fin set's own mean chord** (DATCOM eq. 4.1.5.1-a, approved), the displayed default.
   - **Why:** a fin's boundary layer starts at its own leading edge, not at the nose.
   - **Effect, already measured (plan 0076):**
     - flights below Mach 0.95: +18.9 → +15.5 %;
     - held-out subsonic drag: 7.1 → 6.4 %;
     - held-out transonic drag: 21.3 → 19.9 %;
     - held-out supersonic drag: 15.0 → 15.5 % (worse), reported as such.
   - **Correction (2026-10-15, D-120).** The figures above are D-115's "fin chord alone" row, measured against the state before the DATCOM body form factor. With that form factor in place (D-115's "both" row, re-measured now), the effect is:
     - flights below Mach 0.95: +16.4 → +13.2 % mean (above: +24.7 → +21.1 %);
     - held-out subsonic drag: 6.1 → 8.2 % rms, above its 7 % target (met before);
     - held-out transonic drag: 21.2 → 20.2 %; supersonic: 14.9 → 15.6 %.
   - Asked to keep or revert it, the owner asked for another solution. Plan 0081 completes the DATCOM's equation instead (D-120).
3. **The DATCOM wing-body build-up** (eq. 4.3.3.1-a, approved).
   - **Terms:** the fins' thickness factor 1 + L(t/c) + 100(t/c)⁴, the lifting-surface correction R_LS (figure 4.1.5.1-28), and the wing-body interference factor R_WB (figure 4.3.3.1-37). R_WB multiplies the exposed fin and body friction.
   - **Digitising:** each figure is digitised in two passes. Its stated range is recorded: Mach 0.25 and above, and the body Reynolds number covered. Model rockets sit at the low end, which is listed.
   - **Expected effect:** a few per cent either way (the DATCOM's sample problem reads R_WB = 0.955). It is not RASAero's "interference about equal to the fin friction".
4. **Rail buttons, rail guides, launch shoes and lugs: measured protuberance drag.**
   - **Proposed source:** NACA TM 1299 (Tillmann, 1951; public domain, NTRS 19930093931). It gives drag coefficients measured on a wall in a turbulent boundary layer: plates, bars, hoods, a hexagonal nut with washer, rivets.
   - **The physics:** the coefficients are taken on the mean dynamic pressure over the element's height in a 1/7-power boundary layer (its figure 27). A button inside the layer therefore sees less than the free-stream dynamic pressure.
   - **Expected result:** the sourced value will likely land nearer Niskanen's rail pin than RASAero's rule. If so, the flights' residual lies elsewhere, and the report says so.
   - **Boundary-layer thickness:** first check Niskanen and the DATCOM for a usable flat-plate δ, before proposing a further source.
5. **Thrust at altitude.**
   - F(h) = F_static + (p₀ − p(h)) A_e, with the nozzle exit area. `.CDX1` files carry the exit diameter, and a user can enter it.
   - **Proposed source:** NASA SP-125 (public domain), instead of Sutton.
   - **Missing exit diameter:** without it, the static thrust is used and listed.
6. **Transonic drag** (21 % rms), a separate plan.
   - **Method:** the DATCOM's transonic charts (4.1.5.2, 4.2.3.1), validated on the held-out wind tunnel set first.
   - **Target:** set before the work.
7. **Usability**, after accuracy. The first item is the paste box (paste from Claude, or a file, and fly at once), the shortest path from "I have a rocket" to a number. Then an audit and a redesign proposal.

## 6. Independent flights

The 21 flights are RASAero's own showcase set. Matching them measures agreement with its curation as much as with physics. The owner's own altimeter logs (CLAUDE.md 7.5) are asked for, each with:

- the design file or kit;
- the motor and delay;
- the finish;
- the day's wind, if known.

They join the benchmark as they arrive.

## 7. Questions for the owner

1. Approve NACA TM 1299 (rail guides, buttons, shoes, lugs) and NASA SP-125 (thrust at altitude) as sources.
2. Choose the residual rule of section 4.
3. Send any flight data you have.

**Answers (owner, 2026-10-14, D-119):**

1. Both sources are approved.
2. Option (b): the labelled flight-based range.
3. No flight data yet.

**Step 1's first run.** The importer now reads all 24 flown examples' apogees (it had missed three). The benchmark gives the displayed mode +16.4 % mean, +17.0 % median and 17.5 % rms on the 13 flights below Mach 0.95, and +24.7 % mean on the 11 above. The OpenRocket-equivalent mode gives +9.1 % and +17.8 %.
