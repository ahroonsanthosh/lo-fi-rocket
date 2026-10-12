# Independent physics review

Branch reviewed: `claude/inspiring-tesla-xxp0hh` at 109d117 (identical to `main` at the time of review). Date: 2026-10-12.

The reviewer did not write this code and set out to find mistakes. No project file was changed; everything produced by the review is in `docs/review/`.

**Out of scope.** Another session is rewriting these areas, so they were not reviewed:

- transonic and supersonic aerodynamics (BAR-12, DRAG-15 to DRAG-17, AERO-6, AERO-7)
- fin flutter
- large-angle forces
- in-flight stability

**Severity scale.**

| Severity | Meaning                                   |
| -------- | ----------------------------------------- |
| critical | could give a wrong safety-relevant result |
| major    | wrong result elsewhere                    |
| minor    | quality or documentation                  |

**Finding IDs** are prefixed by area:

| Prefix | Area                                                     |
| ------ | -------------------------------------------------------- |
| U      | units and atmosphere                                     |
| G      | geometry and mass                                        |
| B      | Barrowman CP and stability                               |
| M      | motors                                                   |
| F      | flight, integrators, events, recovery, wind, Monte Carlo |
| R      | independent recalculation                                |

The reviewer re-read the code at the cited lines for every critical and major finding. Findings marked "(confirmed by re-reading)" were checked a second time at the code level by a different reviewer, not only by the probe that found them.

**Source page numbering.** Page numbers are the source's printed page numbers. To get the PDF page:

- Niskanen 2009: add 10.
- USSA 1976: add 16 in Part 1, and 15 in the tables.

## Summary

| Area                            | Critical | Major  | Minor                      |
| ------------------------------- | -------- | ------ | -------------------------- |
| Units and atmosphere            | 0        | 3      | 13 (incl. 1 informational) |
| Geometry, mass, CG, inertia     | 1        | 1      | 6                          |
| Barrowman CP and stability      | 1        | 0      | 3                          |
| Motors and burn                 | 1        | 3      | 14                         |
| Flight, integrators, events, MC | 4        | 6      | 13                         |
| **Total**                       | **7**    | **13** | **52**                     |
| Independent recalculation       | 0        | 0      | 3 (R-3 is B-3)             |

The core equations are correct. Every in-scope register entry was compared symbol by symbol with the cited page. No sign, constant or exponent error was found in:

- the 1976 atmosphere
- the unit conversions
- the nose and transition profiles
- the mass, CG and inertia integrals
- subsonic Barrowman CP as given by Niskanen
- the motor rules (MOT-1 to MOT-6)

The independent recalculation of R1 to R4 reproduces the app's numbers:

- mass and CG to 0.0005 %
- CP to rounding

Both match OpenRocket to within 0.04 %.

The problems are elsewhere:

- inputs that are inconsistent or out of range and are accepted without a message (rule 3)
- missing consistency checks between components
- defaults in the app that put wrong numbers into the physics
- missing warnings when recovery will not happen
- stale documentation

---

## Units and U.S. Standard Atmosphere 1976

### U-1 (major): a temperature override shifts the whole profile up to 86 km

**Where:** `packages/physics/src/atmosphere/ussa1976.ts:127-154` (`buildLayers`) and `:217-222` (`layersFor`).

**What the code does.** Every layer base temperature is re-chained from the overridden sea-level temperature, so an offset at the pad becomes the same offset in the stratosphere. The reviewer computed these independently:

| Override at sea level | Altitude | Standard T | Overridden T | Speed of sound vs standard | Density vs standard |
| --------------------- | -------- | ---------- | ------------ | -------------------------- | ------------------- |
| 313.15 K              | 15 km    | 216.65 K   | 241.65 K     | ×1.056                     | ×1.097              |
| 313.15 K              | 25 km    | 221.55 K   | 246.55 K     | ×1.055                     | ×1.290              |
| 253.15 K              | 15 km    | 216.65 K   | 181.65 K     | ×0.916                     | ×0.827              |
| 253.15 K              | 25 km    | 221.55 K   | 186.55 K     | ×0.918                     | ×0.611              |

**What the sources say.** Niskanen §4.1.1 p. 55 says only that the values "are simply assigned to the first layer of the atmospheric model". It says nothing about the higher layers.

**Documentation and tests:**

- `docs/known-limitations.md:191` says the override shifts "the whole first atmospheric layer". That is not what the code does.
- Plan 0001 (line 88) said this needed its own source and plan. No decision records it.
- No test checks an override above 11 km.

**Suggested fix.** Under CLAUDE.md rule 4, put the choice to the owner. The options are:

- shift layer 0 only, or
- keep the whole-profile shift, with a decision record and a warning above 11 km.

Then add a test above 11 km.

### U-2 (major): the temperature and pressure overrides have no plausibility range

**Where:** `ussa1976.ts:181-188`. The only checks are T > 0 and P > 0.

**What happens with implausible values:**

| Input                             | Result                                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Sea-level override of 150 K       | Accepted; gives 78.5 K at 20 km.                                                                                     |
| Sea-level override of 50 K        | Throws `NonFiniteResultError: pressure produced a non-finite value (NaN)` at 11 km, with no mention of the override. |
| Site at 9 000 m with 10 K         | Returns T_M = 0.28 K and a speed of sound of 10.6 m/s at 10.5 km, with no error.                                     |
| Site at 3 000 m with 1 K          | Implies a sea-level pressure of 5.5e11 Pa.                                                                           |
| Pressures of 1e9 Pa and 1e-300 Pa | Accepted.                                                                                                            |
| Full flight with a 20 K override  | Completes with no warning: apogee 15 m against about 35 m.                                                           |

This breaks CLAUDE.md rule 3 and §8.

**Suggested fix:**

- Define a plausibility range with a source.
- Before simulating, check that T_M > 0 at every layer top.
- Report failures with an `InvalidInputError` that names the override.

### U-3 (major): the app pre-fills sea-level values as values "at the pad" (confirmed by re-reading)

**Where:**

- `packages/app/src/components/LaunchEditor.tsx:63-69` sets 288.15 K and 101 325 Pa when the override box is ticked, whatever the pad altitude.
- `packages/formats/src/design/to-physics.ts:214-221` then passes them as `at: { altitude: site.altitude }`.

**Effect.** At a 1 500 m pad the standard values are 278.40 K and 84 559.7 Pa, so the pre-fill makes pad density 15.8 % too high. A user who ticks the box and edits only the temperature keeps the wrong pressure without knowing it. On the R1 test probe, apogee is 35.22 m with the standard atmosphere and 34.49 m with the default override.

**Suggested fix.** Pre-fill from the standard atmosphere at the pad altitude. Refresh the values, or warn, when the pad altitude changes.

### U-4 (minor): leaving the −5 000 to 86 000 m range aborts the flight with no time or context

**Where:** `simulate.ts:273` does not catch the atmosphere error, and `validateLaunch` checks only that the pad altitude is finite.

**What happens:**

- A pad at 85 990 m throws "geometric altitude is invalid: received 86000.10067698236".
- A pad at −6 000 m throws the same kind of error.
- In both cases the partial trajectory is lost.

The altitude field uses `rule="any"`, although `docs/known-limitations.md:27` promises it rejects out-of-range values.

**Suggested fix.** Validate the pad altitude at the boundary, and end the flight with an event that names the time and altitude.

### U-5 (minor): UNIT-4 does not reject temperatures below absolute zero

`docs/equations.md:31` says it does. In fact:

- `celsiusToKelvin(-300)` returns −26.85 K.
- `fahrenheitToKelvin(-1000)` returns −300.18 K.

There is no test for either. **Fix:** reject the input, or correct the register.

### U-6 (minor): the Fahrenheit conversion is not exact at 212 °F

`convert.ts:327` claims "exact at 212 °F", but the function returns 373.15000000000003. The test at `convert.test.ts:180` uses `toBeCloseTo`, which hides this. **Fix:** correct the comment, or assert the exact value.

### U-7 (minor): the constant comments misquote USSA76 Table 2 and hide misprints in the standard

**Where:** `ussa1976.ts:52,60`.

**What the standard actually prints:**

- Table 2 (p. 2) prints R\* as "8.31432 × 10⁻³" and r₀ as "6.356766 × 10⁶ km". The comments quote both as × 10³.
- p. 4 prints β as "1.458 × 10⁶", with no minus sign.

The values used in the code are correct, from pp. 3, 4, 8 and 19.

**Fix.** Record the misprints in a decision, as D-021 does for the Sutherland constant, and quote the pages accurately.

### U-8 (minor): the worked arithmetic in `ussa1976.test.ts` contains errors

| Line | Comment shows                | Correct value | Consequence                                                     |
| ---- | ---------------------------- | ------------- | --------------------------------------------------------------- |
| 64   | 284.04272                    | 284.04373     |                                                                 |
| 67   | 0.22335863                   | 0.22335957    | The product shown gives 22 631.97, not the asserted 22 632.064. |
| 74   | 0.24190372                   | 0.24190850    | The product shown gives 5 474.78, not the asserted 5 474.889.   |
| 172  | exponent with the wrong sign | −17.0816      |                                                                 |

The asserted values are right. The working shown could not have produced them, which weakens the CLAUDE.md §7.1 claim that they were worked by hand. **Fix:** correct the working.

### U-9 (minor): gaps in the atmosphere tests

- The kinetic-temperature column of Table I is never compared (86 km prints 186.87 K).
- The 85 km viscosity test only checks a 0.05 % band.
- The `seaLevelEquivalent` branch that rejects a sea-level T at or below 0 K is never exercised.
- No test uses a negative site altitude.
- No test covers an override above 11 km.

### U-10 (minor): stale statements in `docs/known-limitations.md`

| Line | Statement                                       | Reality                              |
| ---- | ----------------------------------------------- | ------------------------------------ |
| 35   | Overrides are "a later task".                   | They are implemented.                |
| 36   | Results carry a "1976 standard" label.          | The app has no such label.           |
| 27   | The altitude field rejects out-of-range values. | It does not (U-4).                   |
| 41   | The tables are uncorrected for M/M₀.            | The 86 km row on p. 68 is corrected. |
| 191  | The override shifts the "whole first layer".    | It shifts every layer (U-1).         |

### U-11 (minor): `docs/audit.md:81` names the wrong test file

It cites the wrong file for the 57 atmosphere table rows. They are in `ussa1976.tables.test.ts`.

### U-12 (minor): the app re-implements the unit conversions

`packages/app/src/units/display.ts` does its own conversions instead of calling UNIT-1 to UNIT-11:

- The mm and g specs compute `x*(1/1000)`. For about 15 % of inputs this differs from `x/1000` by 1 ulp, which breaks the project's own "x / 1000" rule.
- The °C and °F conversions are written inline, so the code users actually run is not the registered implementation.

### U-13 (minor): the temperature field's error message gives the wrong unit

The positive rule is checked in kelvin, but `QuantityField.tsx:26` reports "must be greater than 0 °C".

### U-14 (minor): geometric and geopotential altitude share the `Metres` brand

Passing H where Z is expected compiles. At 10 km that is a 15.7 m altitude error. CLAUDE.md §5 asks for branded types so unit mistakes fail to compile, and m′ is a distinct unit in the source. **Fix:** add a `GeopotentialMetres` brand.

### U-15 (minor): SI Brochure citations use the 2019 titles

The stored file is V4.01 (2026), where §4 and Table 8 are both titled "Non-SI units". The quoted content is correct; only the titles need updating.

### U-16 (informational): a more direct citation exists for UNIT-11

NIST SP 811 p. 48 prints T/K = (t/°F + 459.67)/1.8 directly. UNIT-11 can cite that line instead of deriving it through UNIT-4.

---

## Geometry, mass, CG and inertia

### G-1 (critical): a nose shoulder wall thicker than the shoulder radius gives negative or wrong mass with no error (confirmed by re-reading)

**Where:** `packages/physics/src/geometry/components.ts:193-200`. The code checks only that the shoulder length, radius and wall are positive, then calls `hollowCylinder(s.radius, s.radius - s.wallThickness, ...)`. The inner radius can go negative and is then squared, so the output looks valid. `finiteResult` does not catch it because the numbers are finite.

**Evidence.** Conical nose, 0.1 m long, 0.025 m base radius, 2 mm shell, with a shoulder of 20 mm radius and 30 mm length:

| Shoulder wall | Mass       | Notes                                            |
| ------------- | ---------- | ------------------------------------------------ |
| 15 mm         | 0.0502 kg  | correct                                          |
| 30 mm         | 0.0432 kg  | less than a solid shoulder                       |
| 50 mm         | −0.0322 kg | cgX 0; I_rot −2.6e-5 kg·m²; I_long −5.6e-4 kg·m² |

On the whole of R1, a 60 mm wall on a 24 mm shoulder gives:

|                   | Mass      | CG       |
| ----------------- | --------- | -------- |
| With the bad wall | 0.1374 kg | 0.3567 m |
| Correct           | 0.1483 kg | 0.3359 m |

That is a CG error of 0.42 calibers.

**Related gaps:**

- A shoulder radius larger than the nose base radius is also accepted.
- `packages/formats/src/design/validate.ts:165-171` and the app editor require only that the wall is positive.
- `docs/audit.md:89` claims every physics function validates its inputs.

**Suggested fix:**

- Require the shoulder wall to be smaller than the shoulder radius, as tubes already do at `components.ts:224`.
- Require the shoulder radius to be no larger than the nose base radius.
- Add a property test that every component's mass is positive for random valid inputs (see B-4).

### G-2 (major): a wall at or above the radius silently becomes a solid part

**Where:**

- `revolution.ts:67-71` clamps the inner radius to zero.
- `components.ts:189-191` and `:213-214` check only that the thickness is positive.

**Evidence:**

- A conical nose with a 25 mm radius gives exactly the solid-nose mass (0.06545 kg) for walls of 25 mm, 50 mm and 1 m.
- A transition with a 50 mm wall returns the solid frustum.
- A fin thickness of 0.5 m on a 0.1 m chord is accepted (a 5.4 kg fin set).

**Documentation.** `docs/known-limitations.md:81` promises a warning when the wall exceeds a quarter of the base radius. No such warning exists; the app rule is only "positive" (`ComponentEditor.tsx:50-62`).

**Suggested fix:**

- Reject a wall at or above the base radius.
- Add the promised warning, or remove the promise.
- Bound the fin thickness against the chord.

### G-3 (minor): the longitudinal inertia is silently clamped

**Where:** `revolution.ts:102`, which computes `Math.max(0, iy - m x̄²)`. This clamps a negative result without reporting it (rule 3).

**Fix.** Allow negatives only at the level of rounding, and throw otherwise.

### G-4 (minor): rail button validation gaps

**Where:** `components.ts:330-372`.

- A count of 1.5 is accepted: the loop runs twice and returns two buttons.
- A count above 1 with no separation stacks every button at the same x.
- An inner diameter larger than the outer diameter is accepted.

### G-5 (minor): one- and two-fin sets use equal pitch and yaw inertia

**Where:** `components.ts:313-319`. The longitudinal inertia is the mean of the two transverse inertias, and the simulator uses equal pitch and yaw inertia (DYN-9).

**Evidence.** The reviewer's independent check for R1's fin shape:

| Fins | I_yy (kg·m²) | I_zz (kg·m²) | Value used (mean) |
| ---- | ------------ | ------------ | ----------------- |
| 1    | 6.17e-6      | 5.13e-5      | 2.874e-5          |
| 2    | 1.23e-5      | 1.026e-4     | 5.748e-5          |

So for two fins the true inertia differs by about 8× between the axes.

**Also:**

- A single fin, rail buttons and launch lugs move the CG off the axis; this is ignored.
- `docs/known-limitations.md:86` mentions the ½ factor but not that one and two fins are accepted.

**Fix.** Document the error, or reject fewer than three fins in the 6DOF simulation.

### G-6 (minor): the secant ogive loses precision at very small κ

**Where:** `profiles.ts:93-108`. The formula subtracts two nearly equal large numbers.

| κ     | Result                         | Error           |
| ----- | ------------------------------ | --------------- |
| 1e-9  | r(L)                           | 1.8e-6 relative |
| 1e-12 | r(L) = 0.0269775 against 0.027 | 8.3e-4 relative |
| 1e-12 | r(1e-4) = 0                    |                 |

There is no lower bound on κ.

**Fix.** Rewrite in the cancellation-free form (ρ² − (a−x)² − c²)/(√(ρ² − (a−x)²) + c), or set a documented lower bound on κ.

### G-7 (minor): steep-ended transition shells lose their inner radius at the narrow end

Elliptical, power-series and Haack transition shells get an inner radius of zero at the narrow end, although the outer radius there is the full small radius. For example, a 20 to 30 mm elliptical transition with a 2 mm wall has an inner radius of 0 at x = 1e-6 m. The mass effect is well under 1 %.

`docs/known-limitations.md:77` describes this behaviour only near a nose tip, not for transitions.

### G-8 (minor): there is no mass or CG override

CLAUDE.md §6.1 requires "mass (from material density or user-entered override)". No component has a mass or CG override. `.ork` files with overrides are rejected loudly (`ork.ts:283`), which is correct, but `docs/audit.md:66` marks §6.1 as done without mentioning the gap.

If overrides are added:

- a mass override must scale the inertia;
- a CG override must apply the parallel-axis shift.

---

## Subsonic Barrowman CP and stability

### B-1 (critical): no checks that components fit together, so stability can be overstated silently (confirmed by re-reading)

**Where:** `packages/physics/src/stability/barrowman.ts:542-601`.

- The fin set's `bodyRadius` is a free input (`components.ts:93`).
- The app sets it once, when the fin set is created (`packages/app/src/state/reducer.ts:192`).
- After that it is a separate editable field (`ComponentEditor.tsx:106`) and never follows the body tube.

**Evidence.** R1 in OpenRocket-equivalent mode, base CP 0.4872 m:

| Change                                                                       | CP       | Error     | Notes                                                                                                     |
| ---------------------------------------------------------------------------- | -------- | --------- | --------------------------------------------------------------------------------------------------------- |
| Nose base radius set to 12.5 mm on the 25 mm tube, no transition             | 0.5268 m | +0.79 cal | Unsafe direction. The diameter step should add a forward C_Nα term; eq. (3.19) assumes a continuous body. |
| Fin `bodyRadius` set to 1 m (as if the tube were enlarged after adding fins) | 0.5052 m | +0.36 cal | K_T(B) becomes 1.5 instead of 1.238.                                                                      |
| Fins placed 5 m behind the 0.6 m rocket                                      | 4.47 m   |           | Accepted.                                                                                                 |
| Fins at x = −1 m                                                             | −0.84 m  |           | Accepted.                                                                                                 |

A nose starting at x = 0.3 m is also accepted.

**Source.** Eq. (3.56), p. 34, defines r_t as "the body radius at the fin position".

**Suggested fix:**

- Derive r_t from the body tube under the fin root, or reject a mismatch.
- Detect radius steps between consecutive external components, and reject them or add the step as a transition term.
- Require fins and rail buttons to sit on a body tube.
- Require the nose to start at x = 0.

### B-2 (minor): stale statements about the fin CP and β

**What the documentation says.** These places say that Mach 0.5 and above throws, or that the shift from eqs. (3.35) and (3.36) is "Phase 2":

- `docs/equations.md:82` (BAR-5)
- `docs/known-limitations.md:124`
- the comment at `barrowman.ts:390-391`

**What the code does.** `finSetTerm` applies BAR-10 at every Mach number. R1's CP at M = 0.6, 0.7 and 0.8 is 0.49015, 0.49276 and 0.49611 m, with no error.

**Also stale:**

- BAR-1 (`equations.md:78`) names `prandtlBeta` as its implementation, but `finSetTerm` computes β inline (`barrowman.ts:431`) and never calls it.
- The `barrowman.ts` header lists only BAR-1 to BAR-9.

### B-3 (minor, needs the owner's confirmation): the source conflict on fin-body interference is not recorded

**The two sources:**

- **Niskanen eq. (3.56), p. 34:** K_T(B) = 1 + r/(s + r). The code matches this.
- **Barrowman 1967 eq. (3-96), printed p. 31 (PDF p. 41):** a longer slender-body expression.

**Evaluating Barrowman's version.** Two reviewers independently found that, as printed in the scan, it gives a non-physical value below 1 (0.33 for R1). A term has probably dropped out in printing. With the π/4 factor one reviewer believes is missing (not verifiable from `reference/`), it gives:

| Rocket | Barrowman (π/4 added) | Niskanen |
| ------ | --------------------- | -------- |
| R1     | 1.196                 | 1.238    |
| R2     | 1.301                 | 1.351    |

**Effect.** On R1 the CP moves about 1.7 mm forward (0.035 cal). That is within the 2 % CP tolerance, so criterion 11(a) is not strictly triggered.

**Related term.** Barrowman's eq. (3-98) (body lift carried over from the fins) is left out, per Niskanen p. 34. The register already records that omission (BAR-8). If it were included, the combined factor would be (1 + 1/τ)², which is 1.53 to 1.67 for these rockets. That would move the CP well aft, in the non-conservative direction.

**Suggested fix.** Add a decision recording that Niskanen eq. (3.56) is used and that Barrowman 1967 differs, with the reason. Ask the owner to confirm. Get a clean copy of Barrowman p. 31.

### B-4 (minor): weak tests in geometry and stability

**A vacuous property test.** The CLAUDE.md §7.3 property "adding a fin set never moves the CP forward" (`barrowman.test.ts:336-365`) filters its inputs with `fc.pre(fin CP ≥ current CP)`. That makes it true by the definition of a weighted mean, so it tests nothing. It also never tries a negative sweep.

**A claimed test that does not exist.** `docs/audit.md:82` claims a "mass never negative" property test. The only one is for motors (`motor.test.ts:224`); there is none for components, which is why G-1 went unnoticed.

**Never tested:**

- `finSetTerm` and `centreOfPressure` with 1, 2 or 5 to 8 fins
- swept fins, or tip longer than root, in `finSetTerm`
- the secant ogive against eq. (A.4) directly
- the inertia of fins, shoulders, rail buttons, lugs and hollow non-conical noses
- the solid mass properties of the elliptical, parabolic, power-series and LV-Haack shapes

The reviewer checked all of these independently and they are correct today, but nothing would catch a regression.

**A loose tolerance.** The reference CG test allows 1 % while the observed match is 0.0004 %, so it would not catch a regression of up to 1 %.

No test was found that derives its expected value from the code under test.

---

## Motors, thrust curves, mass and CG during burn

### M-4 (critical): with a plugged motor, or an ejection after landing, an ejection-triggered parachute never deploys and there is no warning (confirmed by re-reading)

**Where:**

- `packages/physics/src/flight/simulate.ts:539-548` schedules the ejection event only when `ejectionDelay !== undefined`.
- `packages/formats/src/design/to-physics.ts:307-312` warns only when the design has no recovery devices at all (`design.recovery.length === 0`).

**Effect.** A design with a parachute set to deploy on the ejection charge, flown on a plugged motor, comes out ballistic. The landing speed is terminal velocity, and nothing tells the user that the parachute never opened. The same happens if the ejection time falls after landing.

**Why critical.** The user believes the design has working recovery.

**Suggested fix.** After every run, warn for each recovery device that never deployed, naming its trigger and the reason. Also warn before simulating when an ejection-triggered device is paired with a plugged motor.

### M-1 (major): the RockSim linear-in-time mass rule ignores the file's `burn-time`, and nothing compares the two

**Where:**

- `packages/physics/src/motor/motor.ts:317-318`
- `packages/formats/src/rse.ts:69` and `:214`
- `packages/formats/src/motor-definition.ts:345-346`

**Source.** Apogee RockSim engine file guide, p. 1. It says `burn-time` is "Used for simulation and integration" and gives m(t) = initMass − (propMass / burnTime)·t. MOT-4 quotes the same formula.

**What the code does.** It uses tb = the time of the last data point. `burnTimeAttribute` is stored as "informational" and never checked.

**Evidence:**

- A file with `burn-time="1"` and a last point at 2 s is accepted. At t = 1 s the code leaves 0.005 kg of propellant; the guide's formula gives 0.
- A file with `burn-time="3"` and a curve ending at 1 s is also accepted without a message.
- The bundled files are not affected (G80T: 1.7 against 1.701).

**Suggested fix.** Use `burn-time` in the rule, or reject a file where `burn-time` and the last point disagree beyond a stated tolerance. Record the choice in D-029.

### M-2 (major): mass profiles are not checked against the declared masses or the burn

**Where:**

- `motor.ts:136-197` (`validateMotor`)
- `packages/formats/src/motors/csv-thrust-curve.ts:136-150`
- `packages/formats/src/design/validate.ts:338-365`

**What is checked.** Only that 0 ≤ m ≤ m_prop, that m never increases, and that the first time is 0. Nothing requires m(0) = m_prop, m(end) = 0, or that the profile spans the burn.

**Evidence.** A CSV motor with total mass 0.030 kg and propellant 0.010 kg:

- A profile running 0.005 → 0.001 kg gives a motor mass of 0.025 kg at t = 0 and 0.021 kg after burnout, with no message.
- A profile running to 3 s against a 1 s burn keeps losing mass during the coast while `burning` is false.
- A profile that reaches 0 at 0.5 s while thrust continues to 1 s is accepted.

**Tests that bless these profiles:** `motor.test.ts:141-145` (ends at 0.0001 kg) and `motor.test.ts:261-262` (runs to 2 s against the D12's 1.65 s burn).

**Why it matters.** The profile feeds liftoff mass, thrust-to-weight, rail exit velocity and burnout stability. Accepting a bad one silently breaks CLAUDE.md rule 3.

**Suggested fix.** Add endpoint and time-span checks with tolerances, and update the two tests.

### M-3 (major): the app's default ejection delay is the first one listed, which is 0 s for the Estes motors (confirmed by re-reading)

**Where:** `packages/app/src/components/MotorPanel.tsx:78` uses `m.delays[0]`. The ThrustCurve download path (`:456`) feeds the same default.

**Evidence:**

- C6 and D12 list `0-3-5-7`.
- E16 lists `0-4-6-8`.

So by default an ejection-triggered parachute deploys at burnout, near maximum velocity.

**Mitigation already present.** The deployment-velocity warning fires (`to-physics.ts:290-295`). The model result is still not what the user intended.

**Suggested fix.** Make the user choose a delay, or default to the longest and say so. Label a 0 s delay as "booster / no delay".

### M-5 (minor): ThrustCurve downloads that are RockSim-only fail in the motor panel

**Where:** `MotorPanel.tsx:456` calls `parseEng(motor.fileText)`. When no RASP file exists, `downloadMotor` returns the `.rse` XML instead (`client.ts:241-283`).

**Effect.** The panel throws an `EngParseError` ("exactly 7 fields") and the motor is not applied, although it was already cached. `library.ts:60-67` guards the same call; the panel does not.

### M-6 (minor): `.rse` and CSV curves can end with nonzero thrust or contain zero-thrust spans

**Where:**

- `rse.ts:278-290` has no check on the final thrust or on internal zeros.
- `csv-thrust-curve.ts:124-131`
- `motor.ts:200-206`

**Evidence.** An `.rse` file with points (0,0), (0.5,20), (1,20) is accepted: `thrustAt(1)` = 20 N and I = 15 N·s, so a truncated curve goes through silently. A trailing zero-thrust span delays burnout, and therefore the ejection charge, by the length of the span.

**Source.** The RASP format page (`reference/docs/thrustcurve-api/raspformat.html`) rejects both cases.

**Documentation.** `docs/known-limitations.md:292` says "Thrust is zero exactly at the final point", which is false for these inputs.

**Fix.** Reject such curves, or warn.

### M-7 (minor): the `.rse` `m`-column tolerance clashes with `validateMotor`, and negative values are clamped silently

**Where:** `rse.ts:306-311` allows 1 % at each end, and `rse.ts:353-354` applies `Math.max(0, remaining)`.

**Evidence:**

- A column starting at 10.05 g when `propWt` is 10 g passes the reader, then `validateMotor` refuses it with a confusing message.
- A column ending at −0.05 g is set to 0 with no message.
- A column ending at +0.09 g leaves that propellant on board for the rest of the flight.
- A column starting below `propWt` lowers the liftoff mass without a message.

### M-8 (minor): `.rse` `Itot` is never checked against the curve

**Where:** `rse.ts:243`. Apogee guide p. 1 lists `Itot` as required, for "Simulation validation".

**Evidence.** `Itot="20"` is accepted against a curve that integrates to 10 N·s. The reference files agree with their `Itot` within 0.02 %, so a check with a stated tolerance would pass them.

**Also.** The guide marks `type`, `Itot`, `avgThrust` and `peakThrust` as required, but the reader treats them as optional. That leniency is not documented.

### M-9 (minor): the reader rejects the guide's own "Minimal Valid File"

**Where:** `rse.ts:262` accepts only `<eng-data>` elements, and `rse.ts:393-405` require an `engine-database` / `engine-list` wrapper.

**Evidence.** The Apogee guide's example puts `<point>` elements directly inside a bare `<engine>`. Parsed as printed, it throws `RseUnsupportedError`.

**Tests.** `rse.test.ts` rewrites `<point` to `<eng-data` before testing, and calls `eng-data` the "documented element name". It is not documented in `reference/`; it appears only in the ThrustCurve files.

**Fix.** Accept both forms and record where each comes from in D-029.

### M-10 (minor): a file with neither a `cg` column nor `auto-calc-cg` is accepted

**Where:** `motor-definition.ts:318-356`.

The Apogee guide, p. 1, requires one or the other. The code enforces the equivalent rule for mass but not for CG.

### M-11 (minor): a zero-impulse motor is valid under the linear-in-time and mass-profile rules

**Where:** `motor.ts:129-135` requires I > 0 only for the impulse-proportional rule.

**Evidence.** Points (0,0), (1,0) with `auto-calc-mass="1"` are accepted.

**Fix.** Require I > 0 for every rule.

### M-12 (minor): a deployment during the burn silently cuts the thrust, and a negative ejection delay is accepted from files

**Where:**

- `simulate.ts:284-285` sets thrust to 0 in the descent phase.
- `simulate.ts:539-541` and `validate.ts:406-409` do not check the sign of `ejectionDelay`. Only the UI rejects negatives (`MotorPanel.tsx:228`).

**Effect.** A launch-triggered device, an apogee reached while still burning, or a negative delay sets thrust to 0 while propellant mass keeps falling, with no message.

### M-13 (minor, documentation): D-029 describes a check the code does not make

D-029 says the ThrustCurve download passes `massUnit: 'g'` as a cross-check. `client.ts:267` passes `{}`. As a result, a ThrustCurve RockSim file without `Isp` cannot be downloaded; the error message is clear.

### M-14 (minor, documentation): `reference/SOURCES.md:136` misstates the `.rse` masses

It says `initWt` and `propWt` equal the RASP header values × 1000. That is false for:

| Motor | `.rse` (g)   | RASP header (kg)  |
| ----- | ------------ | ----------------- |
| F39T  | 60           | 0.059             |
| H128W | 214.5 / 92.2 | 0.2016 / 0.09408  |
| H238T | 196 / 83.4   | 0.18816 / 0.08064 |

The H128W `.rse` is a different data set altogether: 155.764 N·s over 1.5 s, against 177.772 N·s over 1.293 s in the `.eng`.

### M-15 (minor, documentation): a known-limitations entry cites Niskanen for something the page does not say

`docs/known-limitations.md:266` cites "Niskanen §4.2.3 p. 64 (motors as cylinders)". Page 64 says only that component masses and inertias come from "standard formulae". It does not mention motors or cylinders. The cylinder model is the project's own convention (plan 0004, GEO-12), and the citation should say so.

### M-16 (minor): the ThrustCurve client silently takes the first motor in a multi-entry RASP file

**Where:** `client.ts:262-266`.

The RASP page says ThrustCurve parses multi-motor files, so downloaded files can hold several entries. The file-import path at least tells the user; the download path does not. There is also no cross-check of the parsed file against the search summary (`totImpulseNs`, `totalWeightG`, `propWeightG`).

### M-17 (minor): RASP reader details

- `eng.ts:201-207`: the comment says a blank line is tolerated only after the final point, but blank lines are accepted anywhere in the data.
- `eng.ts:165`: a file with bare-CR line endings reports a misleading "no motor entry found".
- `eng.ts:217-219`: comments after a finished entry are attached to the next motor.

### M-18 (minor): test quality for motors

- `eng.test.ts:134-145` is titled "by hand" but asserts only 16 < I < 18, although the exact value, 16.839 N·s, is known.
- `motor.test.ts:305-307` ("CG with another rule") passes for an unrelated reason: any profile combined with a non-profile rule is rejected, so the CG is never exercised.
- `motor.test.ts:136-153` and `:254-264` assert inconsistent profiles as valid (see M-2).
- The property tests (`:224-248`) cover only the D12 curve and two rules. There are none on random curves or on the mass-profile rule.

Never tested:

- a nonzero final thrust in an `.rse` file
- `burn-time` or `Itot` disagreeing with the curve
- `m` values inside the tolerance band
- the panel's RockSim download path
- a plugged motor with an ejection-triggered parachute

---

## Independent recalculation (`independent_recalc.py`)

`docs/review/independent_recalc.py` is pure Python and imports no project code. Run it with `python3 docs/review/independent_recalc.py`; its output is saved in `independent_recalc_output.txt`.

**Method:**

- Rocket dimensions come from `reference/rockets/README.md`, and motors from the `.eng` headers.
- Nose profiles follow Niskanen Appendix A, eqs. A.1, A.2, A.5, A.9 and A.10 (pp. 100-103).
- The noses are integrated with 40 000 exact frustum slices.
- CP uses Niskanen eqs. 3.19, 3.28 to 3.32, 3.37 to 3.39 and 3.54 to 3.56 (pp. 22-34), with β = √(1 − M²) applied to the fins at M = 0.3.
- The app's values were captured with a temporary test file that was then deleted.

**Results.** Each cell gives independent / app / OpenRocket; "×3" means all three agree to the digits shown. CP is the unreduced value, without the roll bracket, which is what OpenRocket uses.

| Rocket | Liftoff mass (kg)              | Liftoff CG (m)                 | Burnout mass (kg)              | Burnout CG (m)                 | CP (m)                         | Stability (cal)          |
| ------ | ------------------------------ | ------------------------------ | ------------------------------ | ------------------------------ | ------------------------------ | ------------------------ |
| R1     | 0.190904 ×3                    | 0.387022 ×3                    | 0.169804 ×3                    | 0.364906 ×3                    | 0.487227 / 0.487227 / 0.487149 | 2.0041 / 2.0041 / 2.0025 |
| R2     | 0.414486 / 0.414485 / 0.414484 | 0.484546 / 0.484547 / 0.484548 | 0.345486 / 0.345485 / 0.345484 | 0.443894 / 0.443896 / 0.443897 | 0.571233 / 0.571233 / 0.571037 | 1.6053 / 1.6053 / 1.6016 |
| R3     | 0.171874 / 0.171874 / 0.171873 | 0.356247 / 0.356247 / 0.356248 | 0.149174 / 0.149174 / 0.149173 | 0.332089 / 0.332090 / 0.332091 | 0.449197 / 0.449197 / 0.449111 | 3.6595 / 3.6594 / 3.6560 |
| R4     | 1.365941 / 1.365937 / 1.365936 | 0.625036 / 0.625038 / 0.625038 | 1.239605 / 1.239601 / 1.239600 | 0.594669 / 0.594670 / 0.594671 | 0.807973 / 0.807973 / 0.807795 | 2.7718 / 2.7717 / 2.7690 |

The stability the app actually displays uses the worst roll angle. Independent / app values: R1 1.8374 / 1.8374, R2 1.2664 / 1.2663, R3 3.2880 / 3.2880, R4 2.6814 / 2.6814.

No component differs by more than 0.5 % between any two of the three calculations. The author's `reference/rockets/hand-check-r1.py`, compared only after the fact, agrees.

### R-1 (minor, documentation): the cause given for the CP gap to OpenRocket does not fit the numbers

**Where:** `reference/rockets/hand-checks.md:51`.

**Evidence.** The app and the independent CP both sit 0.08 to 0.20 mm aft of OpenRocket in every rocket. Solving eq. (3.29) for the fin C_Nα that reproduces OpenRocket's CP, with the nose and boat-tail terms fixed, gives a fin value lower by:

| Rocket | Fin C_Nα lower by |
| ------ | ----------------- |
| R1     | 0.163 %           |
| R2     | 0.186 %           |
| R3     | 0.157 %           |
| R4     | 0.189 %           |

That is a consistent offset in the fin term. The document blames "for example a numerically integrated nose cone", but R1's nose is a cone, whose CP of 2L/3 is exact under any integration.

**Impact.** Negligible: at most 0.004 cal of stability.

**Fix.** Say the gap is equivalent to a 0.16 to 0.19 % lower fin C_Nα in OpenRocket, with the cause not identified. Do not tune to it.

### R-2 (minor): nose shell walls use a first-order offset

**Where:** GEO-9 and D-024.

**Evidence:**

- The exact inward offset gives nose masses 0.004 % above the app's for R2 and R4.
- The app's first-order offset, r − t√(1 + r′²), matches OpenRocket to 0.0001 %.
- A wall measured radially instead would be off by −0.8 %, so measuring normal to the surface is the right convention.

**Fix.** Optionally state the 0.004 % bound in the GEO-9 validity column.

### R-3: see B-3 (interference factor source conflict)

### R-4 (minor, observation): R2's displayed stability is well below OpenRocket's

**What the user sees.** The app shows 1.27 cal for R2, against OpenRocket's 1.60 cal. Both are correct for what they compute: the app shows the worst roll angle, per Niskanen eq. (3.54) and D-016.

**Why it matters.** A user comparing the two may conclude one program is wrong. The app errs on the safe side.

**Fix.** Make sure the stability panel labels the figure as the worst-roll value, and shows the OpenRocket-equivalent number alongside it.

---

## Flight: gravity, integrators, events, recovery, wind, Monte Carlo

Unless stated otherwise, every probe below uses this setup:

- R1 with the Estes D12, ejection delay 5 s
- a 0.3 m parachute with C_D 0.8
- a 1.5 m vertical rail
- the OpenRocket-equivalent modes
- RK4 with a 0.005 s step

Baseline results: apogee 168.870 m at 5.868 s, rail exit 18.453 m/s, ground hit 6.934 m/s.

All four critical findings in this section are on deployment paths that no flight test exercises (F-23). The five OpenRocket reference rockets all deploy at apogee with no delay.

### F-1 (critical): an ejection-charge deployment never sets the summary deployment velocity or time (confirmed by re-reading)

**Where:** `packages/physics/src/flight/simulate.ts:539-549` and `:655-657`.

**Cause:** `deployment = {...}` is set only when `nextTimed.kind === 'deployment'`. The ejection event's kind is `'ejection-charge'`. The fallback at `:815` runs only at apogee, and apogee is never detected once the phase is `descent` (F-2).

**Evidence:** with the device on `ejection` and a 2 s motor delay, the parachute deploys at 3.650 s at 23.80 m/s. `deploymentVelocity` and `deploymentTime` are both undefined.

**Consequence:** `designFlightWarnings` (`packages/formats/src/design/to-physics.ts:290`) skips the check when the value is undefined. A deployment above the 20 m/s threshold is therefore never warned.

**Why it matters:** `ejection` is OpenRocket's default deployment event, and the `.ork` import keeps it (`design/from-ork.ts:62-65`).

**Suggested fix:** record the first deployment inside `deploy()` itself, using airspeed (F-3).

### F-2 (critical): a deployment before apogee stops apogee detection, so apogee- and altitude-triggered devices never deploy (confirmed by re-reading)

**Where:** `simulate.ts:703-704`, `:708-723` and `:509`.

- Apogee is a candidate event only in the `powered` and `coast` phases.
- Altitude devices are armed only after `apogeeReached`.
- Any deployment switches the phase to `descent`.

**Evidence:** a drogue on `ejection` (2 s delay) plus a main on `altitude` at 50 m. The events are `deployment@3.650 ejection-charge@3.650 landing@17.406`.

|                          | Main opens | Landing speed |
| ------------------------ | ---------- | ------------- |
| This run                 | no         | 13.87 m/s     |
| Main opening as intended | yes        | 3.36 m/s      |

`timeToApogee` is NaN and `warnings` is empty. This is a standard dual-deploy configuration.

**Suggested fix:** detect v_z crossing zero in every airborne phase. Arm altitude devices once that apogee is reached, whatever the phase.

### F-3 (critical): deployment velocity is reported as ground speed, not airspeed (confirmed by re-reading)

**Where:** `simulate.ts:657`, `:815` and `:841` (`norm(velocity)`). Also `simulate.ts:570`, where descent samples fall back to ground speed for the `airspeed` field.

**Evidence:** wind blowing towards +x.

| Wind   | Velocity at apogee | True airspeed | Reported |
| ------ | ------------------ | ------------- | -------- |
| 10 m/s | (−6.193, 0, 0) m/s | 16.19 m/s     | 6.19 m/s |
| 20 m/s | (−7.18, 0, 0) m/s  | 27.18 m/s     | 7.18 m/s |

The 20 m/s case is above the 20 m/s deployment threshold and raises no warning. Deployment loads depend on dynamic pressure, which depends on airspeed. The descent drag in DYN-14 already uses v − v_wind (`simulate.ts:298`), so the code is inconsistent with itself.

**Suggested fix:** report |v − v_wind| at the moment of deployment, and use the same quantity for `airspeed` in descent samples.

### F-4 (critical): a recovery device that never deploys produces no warning

This finding extends M-4.

**Where:**

- `simulate.ts:708-723` and `:829-839`
- `to-physics.ts:307-313`, where the `no-recovery` warning fires only when the device list is empty

**Evidence:** the flight comes out ballistic and the result says nothing.

| Configuration                                           | Result                                                     | Warnings |
| ------------------------------------------------------- | ---------------------------------------------------------- | -------- |
| Drogue at apogee plus main at 500 m (apogee is 168.9 m) | Main never deploys; lands at 13.87 m/s                     | none     |
| Parachute at apogee with a 100 s delay, 5 m/s wind      | Lands at 12.33 s at 38.77 m/s                              | none     |
| Single parachute set to 500 m altitude                  | Run ends at the model limit; the device is never mentioned | none     |

**Suggested fix:**

- At the end of every run, warn for each device that did not deploy, naming its trigger.
- Flag an altitude trigger set above the predicted apogee.
- Warn when a delay is longer than the time from apogee to landing.

### F-5 (major): NaN means "did not happen" in the summary, so a rocket that never leaves the rail gets no rail-exit warning

**Where:** `simulate.ts:900-907` defaults `railExitVelocity`, `timeToApogee`, `railExitTime`, `burnoutTime` and `burnoutVelocity` to NaN. `to-physics.ts:277` then compares `NaN < 15`, which is false, so no warning fires.

**Evidence:**

| Configuration                   | What happens                                                           | Reported                                                  |
| ------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------- |
| R1 plus a 1.4 kg mass, 3 m rail | Lifts off at 0.17 s, rises 0.172 m, slides back and "lands" at 0.902 s | `railExitVelocity` is NaN; no rail-exit event, no warning |
| 1000 m rail                     | Climbs the rail to 168.9 m and slides back down it to 39.2 m/s         | no warning                                                |

**Documentation:** `docs/audit.md:38` says "no NaN or Infinity leaves the simulator". That is false. Besides the summary fields above, descent samples carry NaN `mach`, `angleOfAttack` and `cp`.

**Suggested fix:**

- Use `undefined` for events that did not happen.
- Add a "never left the rail" warning.
- Correct the audit.

### F-6 (major): a `launch` deployment drops the rail constraint and the thrust, and the rocket sinks through the ground

**Where:**

- `simulate.ts:509` switches the phase from on-rail to descent.
- `simulate.ts:284-285` removes thrust in descent.
- `simulate.ts:705-706` detects landing only if z > 0 at the start of a step.

**Evidence:** a device on `launch` with no delay. The run ends at max time (20 s) with z = −134.98 m and v_z = −6.89 m/s, and no warnings.

**Suggested fix:** reject this input, or keep the rail and thrust and detect landing from z ≤ 0.

### F-7 (major): any deployment during the burn silently discards the remaining thrust

**Where:** `simulate.ts:284-285`. This is the same mechanism as M-12.

**Evidence:**

| Configuration             | What happens                                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `launch` with a 1 s delay | Deploys at 1.000 s at 48.3 m/s; apogee 36.8 m. A `burnout@1.650` event is still listed, although thrust was zero from 1.0 s. |
| 60 m/s wind               | Apogee at 0.483 s, during the burn; thrust removed.                                                                          |
| 80° rail                  | Apogee and deployment at 0.990 s at 55.1 m/s; thrust removed.                                                                |

**Source:** Niskanen §4.2.5 p. 67 says nothing about removing thrust at deployment.

**Suggested fix:** keep the thrust, and warn about deployment during the burn.

### F-8 (major): a delayed altitude deployment is logged at twice the delay (confirmed by re-reading)

**Where:** `simulate.ts:829-839`. The closure `() => deploy(device, t + delay, ...)` reads the outer mutable `t` when the action runs, not when it was scheduled.

**Evidence:** a main at 50 m with a 2 s delay.

|                                              | Time                       |
| -------------------------------------------- | -------------------------- |
| Altitude crossed                             | 15.380 s                   |
| Drag actually jumps from 1.667 N to 28.334 N | 17.380 s (correct physics) |
| Deployment event logged                      | 19.380 s                   |

The events array ends up out of time order.

**Suggested fix:** capture the time in a `const` before scheduling.

### F-9 (major): Monte Carlo corrupts profile winds

**Where:** `packages/formats/src/dispersion/dispersion.ts:177-194` and `:261-262`.

**(a) Profile rows are overwritten.** The samples are based on `wind.speed` and `wind.from`, which the flight ignores when a profile exists. They then overwrite profile row 0.

- Setup: speed 3, from 0°, profile [(0 m, 8 m/s, 90°), (100 m, 12 m/s, 90°)].
- The deterministic flight lands 181.13 m away at 270°.
- A Monte Carlo run with zero variations lands 202.43 m away at 263.1°.

This contradicts D-051: "with zero standard deviations every run is the deterministic flight".

**(b) A negative sampled speed reverses every layer.** The direction of every layer flips, while the speed offset uses the absolute value. With rows (1 m/s from 0°) and (10 m/s from 0°) and a sample of −3, row 1 becomes 12 m/s from 180°. The intended result is 6 m/s from 0°.

**(c) A silent clamp.** `Math.max(0, …)` clamps without telling the user, against rule 3.

**Suggested fix:** apply a speed offset and a direction offset to every row, starting from the row values.

### F-10 (minor): Monte Carlo turbulence seeds collide and ignore the design's own seed

**Where:** `dispersion.ts:267`, which sets run k's seed to `settings.seed + k`.

**Evidence:**

- With a design turbulence seed of 9, no run uses seed 9, so a zero-variation turbulent run is not the deterministic flight.
- Batch seed 10 run 1 and batch seed 11 run 0 both get turbulence seed 11.

**Suggested fix:** draw each run's turbulence seed from the dispersion generator.

### F-11 (major): a large RK4 step causes a spurious tumble that is reported as an aerodynamic model limit

**Where:** `simulate.ts:616-620` checks only that h > 0. The D-046 message is at `:870-871`.

**Evidence:**

| Conditions | Step   | Result                                                                        |
| ---------- | ------ | ----------------------------------------------------------------------------- |
| Still air  | 0.1 s  | Ends with `model-limit` at 3.254 s; apogee 132.4 m against 168.87 m converged |
| 5 m/s wind | 0.1 s  | Ends at 1.502 s                                                               |
| Still air  | 0.05 s | Fine (168.645 m)                                                              |

The message tells the user to add a recovery device at apogee, which is the wrong remedy. The documented convergence study covers only steps of 0.01 s and finer.

**Suggested fix:** limit the step, or warn above the converged range, and correct the message.

### F-12 (minor): Dormand-Prince tolerances are not validated

**Where:** `integrators.ts:189-213`, `simulate.ts:589-598` and `validate.ts:536-542`.

**Evidence:**

- rtol = atol = −1 is accepted and runs uncontrolled. Apogee is 168.922 m, the same as with rtol = atol = 1.
- rtol = atol = 0 gives the misleading error "time step is invalid: received NaN". The 0/0 error norm passes the `> 1` test, because NaN > 1 is false.

**Suggested fix:** require rtol ≥ 0 and atol ≥ 0, not both zero, and 0 < initialStep ≤ maxStep, with plain messages.

### F-13 (minor): when apogee is not detected, the reported apogee is the highest recorded sample

**Where:** `simulate.ts:897-899`.

**Evidence:** with an ejection deployment before apogee, the reported apogee is 149.906 m with a 1 s record interval and 149.941 m when every step is recorded. `timeToApogee` is NaN and nothing warns.

**Suggested fix:** the fix for F-2 also fixes this.

### F-14 (minor): the turbulence filter starts from rest

**Where:** `packages/physics/src/environment/wind.ts:154-163`.

**Evidence:** the start-up transient, computed independently, as a fraction of the stationary standard deviation:

| t     | 0 s  | 0.1 s | 0.25 s | 0.5 s | 1 s  |
| ----- | ---- | ----- | ------ | ----- | ---- |
| Ratio | 0.44 | 0.67  | 0.83   | 0.94  | 0.99 |

R1 leaves the rail at 0.29 s, so gusts at rail exit, where they matter most, are understated by about 20 %. Niskanen p. 60 step 2 scales by the stationary value (2.252).

**Suggested fix:** run the filter through a recorded warm-up before t = 0, or document the transient.

### F-15 (minor): no upper limit or warning on turbulence intensity

**Where:** `wind.ts:182`.

**Evidence:**

- I_u = 5 gives negative wind speeds (reversed gusts) and an apogee of 17.4 m.
- I_u = 50 deploys at 120 m/s, and the only warning is the transonic one.

Niskanen p. 60 calls 10 to 20 % "the top of the range" for model rockets.

**Suggested fix:** warn above 0.2.

### F-16 (minor, documentation): "No wind acts before rail exit" is false

**Where:** `docs/known-limitations.md:209`.

`simulate.ts:303-312` and `:378-384` apply the wind-affected aerodynamic force along the rail. The rail exit velocity changes with wind:

| Wind      | Rail exit velocity |
| --------- | ------------------ |
| Still air | 18.4534 m/s        |
| 10 m/s    | 18.4179 m/s        |
| 60 m/s    | 18.3884 m/s        |

### F-17 (minor, documentation): out-of-date register entries

- `docs/equations.md:114` (ENV-1) still says profiles and turbulence throw `NotImplementedError`. Both are implemented.
- DYN-13 and `known-limitations.md:227` say bisection runs to 1e-9 s. The code uses 1e-10 s (`simulate.ts:734`, `:773`).
- `known-limitations.md:209` does not mention the lift-off-then-slide-back case (F-5).

### F-18 (minor, documentation): the RNG-1 citation is wrong

**Where:** `docs/equations.md:119`.

**What is wrong:**

- The register cites Blackman and Vigna "§7 (seeding)". The seeding advice is actually in §5.3, pp. 11-12, plus footnote 10 ("It is immediate to define a 32-bit version of SplitMix").
- The mixer constants 0x85EBCA6B and 0xC2B2AE35 are not in the paper. They are the MurmurHash3 fmix32 finaliser.
- `random.ts:11` says the authors recommend this mixer. The paper does not support that.

**Suggested fix:** correct the citation, and record the 32-bit mixer as a project convention in `decisions.md`.

### F-19 (minor): rail exit is measured by CG travel, which overstates exit speed

**Where:** `simulate.ts:611-612`.

**Why it is optimistic:** the rocket actually leaves the rail when the aft button passes the top of the rail. That happens before the CG has travelled the full rail length.

**Size:** for a 0.1 m button offset on R1's 1.5 m rail, the estimate is about 17.8 m/s instead of 18.45 m/s, roughly 3.4 % lower. This value feeds a safety warning.

**Suggested fix:** document it, and tell users to enter the usable guide travel as the rail length. Alternatively, compute the exit from the aft rail button's position.

### F-20 (minor): liftoff time is not located by bisection

**Where:** `simulate.ts:791-794`. Liftoff is logged at the end of the first step in which the rocket moves.

**Evidence:** the logged liftoff time depends on the integrator and step: 0.040 s at RK4 0.005 s, 0.100 s at RK4 0.1 s, and 0.060 s with Dormand-Prince at 1e-3.

### F-21 (minor): two events in one step can lose the earlier one

**Where:** `simulate.ts:744-751`. When a later candidate's crossing sits at the very end of the step (`hi === hTry`), the `else` branch overwrites `fired`.

Found by reading the code; not reproduced.

### F-22 (minor): the 3DOF cross-check is not "zero angle of attack" in wind

**Where:** `simulate.ts:287-289` and `:432-436`. Thrust follows ground velocity while drag follows airspeed.

**Suggested fix:** align the axis with the airspeed, or label the mode as valid in still air only.

### F-23 (minor): test gaps and weak tests in flight and Monte Carlo

**Untested deployment paths.** No flight test covers any of these:

- `ejection`, `altitude`, `launch` or `never` deployment
- a nonzero deployment delay
- dual deploy
- deployment before apogee
- deployment in wind

F-1, F-2, F-4, F-6, F-7 and F-8 all sit on these paths.

**Weak Monte Carlo tests:**

- `dispersion.test.ts:73` is named "mass and impulse scales move the apogee the expected way" but never applies a scale.
- `dispersion.test.ts:71` is always true (`… || a.runs.length === 6`).
- No Monte Carlo test uses a profile wind or turbulence.

**Analytical cases (CLAUDE.md §7.2):**

- The vacuum-coast test (`simulate.analytical.test.ts:90-118`) builds its expected value from the simulator's own burnout sample. It checks consistency, not the closed form.
- No analytical case uses inverse-square gravity or varying mass.
- Step-size convergence is shown for one still-air flight, between 0.01 s and 0.001 s only.

### Documented behaviour, not counted as findings

- **Late ejection in still air.** When the ejection delay is longer than the coast, the parachute never deploys and the run ends at the model limit (D-046, D-059). This is the most common model-rocket setup. It is documented, but it means the app cannot simulate the flight. It should be raised with the owner, together with the out-of-scope large-angle work.
- **Inertia terms omitted.** The change-of-inertia term (İω) and jet damping are omitted (D-036).

---

## Checked and found correct

These items were compared against the cited document page by page or recomputed independently. No discrepancy was found.

### Units

- **Conversion factors.** NIST SP 811 pp. 40, 41, 42, 48, 49, 50, 52 and 53 match their citations, including the exact footnote factors and the derived values 0.028349523125, 4.4482216152605, 0.44704 and 459.67.
- **SI Brochure.** milli = 10⁻³, 1° = (π/180) rad, and t/°C = T/K − 273.15 are all present as cited.
- **Branded constructors.** They reject NaN and ±Infinity.

### U.S. Standard Atmosphere 1976

The scan has no text layer, so the pages were read as rendered images.

- **Constants.** These match the code digit for digit:
  - g₀, P₀ = 101 325, T₀ = 288.15, β = 1.458e-6 and γ = 1.40 (Table 2, p. 2)
  - S = 110.4 (p. 19)
  - R\* = 8.31432e3 (p. 3)
  - r₀ = 6 356 766 m (p. 8)
  - M₀ = 28.9644 (p. 9)
  - every H_b and L_M,b in Table 4, including their signs
  - all 13 M/M₀ values in Table 8
- **Equations.** Eqs. (17), (18), (19), (22), (23), (33a), (33b), (42), (50), (51) and (52) match the code. T₇ = 186.8673 K is reproduced.
- **Values.** An independent Python implementation agrees with the project to every digit at −5, 0, 11, 20, 32, 47, 51, 71, 80, 82, 84, 85, 85.5 and 86 km. The layer base pressures are bit-identical.
- **Printed tables.** About 25 rows of Table I (pp. 51, 61, 63, 65, 67, 68) agree: T_M to 3 decimals, and pressure to within 4.4e-5 relative.
- **Continuity.** Temperature and pressure are continuous across every layer boundary.
- **Range checks.** Out-of-range altitudes, NaN and Infinity throw with clear messages.
- **ATM-11 inversion.** The algebra is correct, and pad values round-trip.

### Geometry and mass

- **Nose and transition profiles.** All shapes and their slopes match Niskanen Appendix A (pp. 100-103) symbol by symbol, including the secant ogive (eq. A.4) and the Haack slope.
- **Solid mass properties.** Volume, CG and both inertias agree with independent quadrature to 1e-9 relative or better for the tangent ogive, the secant ogive (κ = 0.5), parabolic 0.5, Von Kármán and LV-Haack. They agree with the closed forms for the elliptical, full parabolic and half-power shapes.
- **Fin sets.** Mass, centroid and both inertias match a per-fin brute-force calculation for 1 to 4 fins.
- **Assembly.** The hollow-cylinder formulas, the radial offset of lugs, the parallel-axis combination, and the motor modelled as a solid cylinder placed by its aft end are all correct.
- **Reference rockets.** The independent recalculation of R1 to R4 agrees with the app to 0.0005 % on liftoff and burnout mass and CG.

### Subsonic Barrowman CP and stability (Niskanen)

- **Body terms.** Eqs. (3.19), (3.28) and (3.29) are correct.
- **Fin CP.** Eq. (3.34) uses the leading-edge sweep x_t and the MAC from eq. (3.30), as in the source.
- **Fin normal force.** Eq. (3.40) uses the mid-chord sweep (x_t + c_t/2 − c_r/2)/s, and agrees with Barrowman's 4N(s/d)² at β = 1.
- **Fin count and roll angle.** In eq. (3.54) the θ convention, the worst-roll reductions for 3 and 4 fins, and the 5 to 8 fin values (1.37 and 1.62 of the 4-fin value) are correct.
- **Fin-body interference.** Eq. (3.56) is implemented exactly as printed (see B-3 for the conflict with Barrowman).
- **Stability margin.** It uses the maximum body diameter, and is given at both liftoff and burnout.
- **Scaling.** CP scales exactly from a 2 mm to a 20 m rocket.

### Motors

- **RASP header.** Seven fields in order; mm converted to m; masses in kg; delays include `0` and `P`.
- **RASP data.** The implicit (0,0) point and the ordering and zero-thrust rules all match the RASP page.
- **Reference files.** All 8 `.eng` and 7 `.rse` files parse. The trapezoid integral matches `Itot` (C6 8.8172, D12 16.8391, E16 33.6268, F39T 49.6584, G80T 135.6284, H238T 177.5621 N·s; H128W within 0.02 %).
- **Thrust and impulse by hand (MOT-1, MOT-2).** These were recomputed by hand, including duplicate-time steps and spikes.
- **Mass rules (MOT-3 to MOT-5).** MOT-3 (Niskanen p. 14) and MOT-4 (the Apogee guide's example) are correct. MOT-5 uses g_n = 9.80665.
- **Motor CG (MOT-6).** The CG interpolation is correct.
- **Coupling to the vehicle.** Motor CG and inertia, the burnout event, the ejection timing and the pad hold-down are all correct.
- **ThrustCurve client.** Units match `swagger.json`.

### Flight

- **RK4.** The weights match Niskanen eqs. (4.20) to (4.22), p. 66.
- **Dormand-Prince.** Every c, a, b5 and b4 entry matches the RK5(4)7M tableau. The first-same-as-last property holds but is not exploited, so each step costs 7 evaluations instead of 6.
- **Step controller.** The 0.9·e^(−1/5) factor clamped to [0.2, 5], the RMS norm and the stall exception behave as documented.
- **Quaternions.** The product and eqs. (4.11) to (4.16) match. The half-angle reading of eq. (4.24) (D-031) is correct per the text of p. 63.
- **Orientation.** The derivative q̇ = ½(0, ω)q is correct, with normalisation after each step.
- **Rotational dynamics.** The Euler equations include the gyroscopic term.
- **Frames.** The reference frame is right-handed, and the rail direction is correct.
- **Gravity.** GRAV-1 matches USSA76 eq. (17), p. 8.
- **Rail.** The along-rail component of gravity is correct. T/W below 1 never leaves the pad. A zero-length rail and a 90° rail are rejected.
- **Parachute drag.** It follows Niskanen §4.2.5 pp. 67-68.
- **Turbulence filter.** The coefficients a₁ = −5/6 and a₂ = −5/72 match eq. (4.6). The 2.252 scaling was recomputed independently as 2.2525. Eq. (4.7) is applied as printed.
- **Wind direction.** The "from" convention is consistent across `wind.ts`, `conventions.md` and the UI. Profile interpolation in direction goes the short way across north.
- **Random numbers.** xoshiro128\*\* matches Blackman and Vigna Fig. 4 and Tables 5 and 6. The 53-bit float conversion and Box-Muller are correct.
- **Determinism.** Runs and Monte Carlo batches are bit-identical for the same seed. Seed 0 and a single run work.
- **Finite checks.** NaN and Infinity checks cover every derivative and integrator output.
- **Sites.** Sites at −500, 4 000 and 20 000 m fly.
- **Landing outputs.** Landing bearing, distance and descent rate are correct.

## Documentation honesty

`docs/known-limitations.md` and `docs/audit.md` are mostly accurate, but some statements do not match the code.

**Claims in `docs/audit.md`:**

| Location | Claim                                       | Reality                      | Finding             |
| -------- | ------------------------------------------- | ---------------------------- | ------------------- |
| line 38  | "no NaN or Infinity leaves the simulator"   | false                        | F-5                 |
| line 82  | a property test that mass is never negative | exists only for motors       | B-4                 |
| line 89  | every function validates its inputs         | false                        | G-1, G-2, U-2, F-12 |
| line 66  | §6.1 done                                   | the mass override is missing | G-8                 |
| line 81  | atmosphere table test file                  | names the wrong file         | U-11                |

**Promises in `docs/known-limitations.md` that the code does not keep:**

| Line | Promise                                        | Finding |
| ---- | ---------------------------------------------- | ------- |
| 27   | the altitude field rejects out-of-range values | U-4     |
| 36   | results carry a "1976 standard" label          | U-10    |
| 81   | a warning for a thick nose wall                | G-2     |

**Statements that are wrong or stale:**

- `docs/known-limitations.md`: lines 35, 41, 124, 191, 209, 227, 266 and 292 (U-10, B-2, U-1, F-16, F-17, M-15, M-6).
- `docs/equations.md`: BAR-1, BAR-5, UNIT-4, ENV-1, DYN-13 and RNG-1 (B-2, U-5, F-17, F-18).
- Decision D-029: M-13.

**Recorded honestly.** The limitations that most matter for safety are documented: the ballistic end at the model limit, the 3DOF caveats, and the transonic and supersonic accuracy.

## Recommended order of fixes

1. **Recovery** (F-1 to F-4, M-4). Record every deployment, detect apogee in every airborne phase, report airspeed, warn on every device that did not deploy, and add flight tests for each deployment trigger.
2. **Geometry consistency** (B-1, G-1, G-2). Derive the fin body radius from the tube under the fin, reject radius steps and impossible walls, and add a positive-mass property test.
3. **Atmosphere override** (U-3, U-1, U-2). Pre-fill from the standard atmosphere at the pad, put the higher-layer behaviour to the owner, and bound the inputs.
4. **Motor consistency** (M-1, M-2, M-3, M-6). Check `burn-time`, the profile endpoints and the final thrust, and require an explicit delay.
5. **The remaining major findings**: F-5 to F-9 and F-11.
6. **Documentation corrections.**
